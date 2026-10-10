// Minimal gradient-boosted regression trees (pure TypeScript, no deps).
//
// Histogram-based (quantile bins per feature, like LightGBM/XGBoost "hist"):
// squared-error loss, depth-limited trees, shrinkage, L2 on leaf values,
// deterministic row subsampling. Small and fast enough to train on ~50k rows
// on a 2-core VPS in seconds.

export interface GbdtParams {
  nTrees: number;
  learningRate: number;
  maxDepth: number;
  minLeaf: number;     // min rows per leaf
  lambda: number;      // L2 regularization on leaf values
  subsample: number;   // row fraction per tree (0..1]
  bins: number;        // histogram bins per feature (≤ 255)
  seed: number;
}

export const DEFAULT_GBDT: GbdtParams = {
  nTrees: 150, learningRate: 0.05, maxDepth: 3, minLeaf: 80, lambda: 5, subsample: 0.7, bins: 32, seed: 7
};

interface Node {
  feature: number;   // -1 for leaf
  threshold: number; // go left if x[feature] <= threshold
  left: number;
  right: number;
  value: number;     // leaf output (already scaled by learning rate)
}

export interface GbdtModel {
  base: number;
  trees: Node[][];
  nFeatures: number;
  /** Total split gain per feature (importance), normalized to sum 1. */
  importance: number[];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Quantile bin edges per feature (upper edges, ascending). NaN-safe. */
function binEdges(X: number[][], bins: number): number[][] {
  const nF = X[0]?.length ?? 0;
  const edges: number[][] = [];
  for (let f = 0; f < nF; f++) {
    const col = X.map((r) => r[f]!).filter((v) => isFinite(v)).sort((a, b) => a - b);
    const e: number[] = [];
    for (let b = 1; b < bins; b++) {
      const v = col[Math.min(col.length - 1, Math.floor((b / bins) * col.length))];
      if (v != null && (e.length === 0 || v > e[e.length - 1]!)) e.push(v);
    }
    edges.push(e);
  }
  return edges;
}

function binOf(edges: number[], v: number): number {
  if (!isFinite(v)) return 0;
  let lo = 0;
  let hi = edges.length; // bin index in [0, edges.length]
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (v <= edges[mid]!) hi = mid; else lo = mid + 1;
  }
  return lo;
}

/**
 * Boosting as a generator that yields after every tree, so callers can either
 * run it to completion (trainGbdt) or interleave it with the event loop
 * (trainGbdtAsync) and keep a single-threaded server responsive.
 */
export function* gbdtSteps(X: number[][], y: number[], params: Partial<GbdtParams> = {}): Generator<void, GbdtModel, void> {
  const p = { ...DEFAULT_GBDT, ...params };
  const n = X.length;
  const nF = X[0]?.length ?? 0;
  const base = n ? y.reduce((a, b) => a + b, 0) / n : 0;
  const model: GbdtModel = { base, trees: [], nFeatures: nF, importance: new Array(nF).fill(0) };
  if (n < 2 * p.minLeaf || nF === 0) return model;

  const edges = binEdges(X, p.bins);
  const B = X.map((r) => r.map((v, f) => binOf(edges[f]!, v)));
  const pred = new Float64Array(n).fill(base);
  const rand = mulberry32(p.seed);

  for (let t = 0; t < p.nTrees; t++) {
    const grad = new Float64Array(n);
    for (let i = 0; i < n; i++) grad[i] = y[i]! - pred[i]!; // residual (negative gradient)
    const rows: number[] = [];
    for (let i = 0; i < n; i++) if (p.subsample >= 1 || rand() < p.subsample) rows.push(i);

    const tree: Node[] = [];
    const build = (idx: number[], depth: number): number => {
      let sum = 0;
      for (const i of idx) sum += grad[i]!;
      const nodeId = tree.length;
      tree.push({ feature: -1, threshold: 0, left: -1, right: -1, value: (p.learningRate * sum) / (idx.length + p.lambda) });
      if (depth >= p.maxDepth || idx.length < 2 * p.minLeaf) return nodeId;

      const parentScore = (sum * sum) / (idx.length + p.lambda);
      let bestGain = 1e-12;
      let bestF = -1;
      let bestBin = -1;
      for (let f = 0; f < nF; f++) {
        const nb = edges[f]!.length + 1;
        if (nb < 2) continue;
        const hs = new Float64Array(nb);
        const hc = new Int32Array(nb);
        for (const i of idx) { const b = B[i]![f]!; hs[b] = hs[b]! + grad[i]!; hc[b] = hc[b]! + 1; }
        let ls = 0;
        let lc = 0;
        for (let b = 0; b < nb - 1; b++) {
          ls += hs[b]!; lc += hc[b]!;
          const rc = idx.length - lc;
          if (lc < p.minLeaf || rc < p.minLeaf) continue;
          const rs = sum - ls;
          const gain = (ls * ls) / (lc + p.lambda) + (rs * rs) / (rc + p.lambda) - parentScore;
          if (gain > bestGain) { bestGain = gain; bestF = f; bestBin = b; }
        }
      }
      if (bestF < 0) return nodeId;
      model.importance[bestF]! += bestGain;
      const L: number[] = [];
      const R: number[] = [];
      for (const i of idx) (B[i]![bestF]! <= bestBin ? L : R).push(i);
      const node = tree[nodeId]!;
      node.feature = bestF;
      node.threshold = edges[bestF]![bestBin]!;
      node.left = build(L, depth + 1);
      node.right = build(R, depth + 1);
      return nodeId;
    };
    build(rows, 0);
    model.trees.push(tree);
    for (let i = 0; i < n; i++) pred[i] = pred[i]! + predictTree(tree, X[i]!);
    yield;
  }
  const tot = model.importance.reduce((a, b) => a + b, 0);
  if (tot > 0) model.importance = model.importance.map((v) => v / tot);
  return model;
}

export function trainGbdt(X: number[][], y: number[], params: Partial<GbdtParams> = {}): GbdtModel {
  const it = gbdtSteps(X, y, params);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

/** Same as trainGbdt, but yields to the event loop between trees. */
export async function trainGbdtAsync(X: number[][], y: number[], params: Partial<GbdtParams> = {}): Promise<GbdtModel> {
  const it = gbdtSteps(X, y, params);
  let r = it.next();
  while (!r.done) {
    await new Promise<void>((res) => setImmediate(res));
    r = it.next();
  }
  return r.value;
}

function predictTree(tree: Node[], x: number[]): number {
  let k = 0;
  for (;;) {
    const nd = tree[k]!;
    if (nd.feature < 0) return nd.value;
    const v = x[nd.feature]!;
    k = isFinite(v) && v <= nd.threshold ? nd.left : !isFinite(v) ? nd.left : nd.right;
  }
}

export function predictGbdt(model: GbdtModel, x: number[]): number {
  let s = model.base;
  for (const t of model.trees) s += predictTree(t, x);
  return s;
}
