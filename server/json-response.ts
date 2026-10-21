import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import type { Request, Response } from 'express';

const compress = promisify(gzip);
export async function sendJson(req: Request, res: Response, body: unknown) {
  const text = JSON.stringify(body);
  if (text === undefined) return res.json(body);
  const bytes = Buffer.from(text);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (bytes.length >= 2048) {
    res.vary('Accept-Encoding');
    if (req.acceptsEncodings('gzip', 'identity') === 'gzip') {
      let compressed: Buffer | undefined;
      try {
        // Async gzip uses Node's worker pool; large HR lists do not block the
        // event loop while compressing. Small responses avoid this overhead.
        compressed = await compress(bytes, { level: 4 });
      } catch {
        // The transaction already committed: a compression failure must never
        // turn a successful save into a misleading database error.
      }
      if (compressed && compressed.length < bytes.length) {
        res.setHeader('Content-Encoding', 'gzip');
        return res.send(compressed);
      }
    }
  }
  return res.send(bytes);
}
