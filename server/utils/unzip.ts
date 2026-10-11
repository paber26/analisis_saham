// Minimal ZIP reader for single-file archives (no dependencies).
// Reads sizes from the central directory, so archives written with a data
// descriptor (sizes zeroed in the local header) work too.

import { inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const CEN = 0x02014b50;
const LOC = 0x04034b50;

/** Contents of the first file in a ZIP archive (stored or deflate), or null. */
export function unzipFirst(buf: Buffer): Buffer | null {
  const stop = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= stop; i--) {
    if (buf.readUInt32LE(i) !== EOCD) continue;
    const cd = buf.readUInt32LE(i + 16);
    if (cd + 46 > buf.length || buf.readUInt32LE(cd) !== CEN) return null;
    const method = buf.readUInt16LE(cd + 10);
    const compSize = buf.readUInt32LE(cd + 20);
    const loc = buf.readUInt32LE(cd + 42);
    if (loc + 30 > buf.length || buf.readUInt32LE(loc) !== LOC) return null;
    const start = loc + 30 + buf.readUInt16LE(loc + 26) + buf.readUInt16LE(loc + 28);
    const data = buf.subarray(start, start + compSize);
    if (method === 0) return Buffer.from(data);
    if (method === 8) return inflateRawSync(data);
    return null;
  }
  return null;
}
