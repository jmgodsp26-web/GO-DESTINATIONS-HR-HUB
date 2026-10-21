import { readdir, readFile, writeFile } from 'node:fs/promises';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import path from 'node:path';

const root = path.resolve('dist/assets');
let before = 0, after = 0;
for (const name of await readdir(root, { recursive: true })) {
  if (!/\.(js|css|svg|json)$/.test(name)) continue;
  const file = path.join(root, name), bytes = await readFile(file);
  if (bytes.length < 1024) continue;
  const br = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 6 } });
  const gzip = gzipSync(bytes, { level: 9 });
  if (br.length < bytes.length) await writeFile(file + '.br', br);
  if (gzip.length < bytes.length) await writeFile(file + '.gz', gzip);
  before += bytes.length; after += Math.min(bytes.length, br.length);
}
console.log(`Prepared compressed assets: ${before} bytes → ${after} bytes with Brotli.`);
