// Persistence for guided-learning progress (single-user).
//
// STORAGE BOUNDARY: this module is the ONLY place that touches storage for
// learning progress. It currently uses the same file-store pattern as
// watchlist/portfolio (atomic tmp+rename, no native module → safe Mac→Linux
// deploy). If you ever move to SQLite/MySQL (e.g. when the app becomes
// multi-user), reimplement only getProgress()/saveProgress() here — the API and
// pages depend solely on these two functions and the LearningProgress shape.

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface QuizResult {
  score: number;   // correct answers
  total: number;   // total questions
  at: string;      // ISO date the quiz was last taken
}

export interface LearningProgress {
  completed: string[];                    // completed lesson ids
  quiz: Record<string, QuizResult>;       // lessonId → last quiz result
  lastLessonId: string | null;            // for "continue learning"
  streak: { count: number; lastDay: string | null };
  updatedAt: string | null;
}

const DIR = process.env.DATA_STORE_DIR || './.data-store';
const FILE = 'learning-progress.json';

const EMPTY: LearningProgress = {
  completed: [],
  quiz: {},
  lastLessonId: null,
  streak: { count: 0, lastDay: null },
  updatedAt: null,
};

export async function getProgress(): Promise<LearningProgress> {
  try {
    const raw = await fs.readFile(path.join(DIR, FILE), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LearningProgress>;
    // Merge with EMPTY so older/partial files stay valid.
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      quiz: parsed.quiz && typeof parsed.quiz === 'object' ? parsed.quiz : {},
      lastLessonId: parsed.lastLessonId ?? null,
      streak: parsed.streak ?? { count: 0, lastDay: null },
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return { ...EMPTY, quiz: {}, completed: [], streak: { count: 0, lastDay: null } };
  }
}

export async function saveProgress(progress: LearningProgress): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = path.join(DIR, FILE + '.tmp');
  await fs.writeFile(tmp, JSON.stringify(progress, null, 2), 'utf-8');
  await fs.rename(tmp, path.join(DIR, FILE)); // atomic swap
}

// Today's date in WIB (Asia/Jakarta), YYYY-MM-DD — for streak bookkeeping.
function todayWIB(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

// Advance the daily streak: +1 if the last active day was yesterday, reset to 1
// if the chain broke, unchanged if already active today.
export function bumpStreak(streak: LearningProgress['streak']): LearningProgress['streak'] {
  const today = todayWIB();
  if (streak.lastDay === today) return streak; // already counted today
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const count = streak.lastDay === yesterday ? streak.count + 1 : 1;
  return { count, lastDay: today };
}
