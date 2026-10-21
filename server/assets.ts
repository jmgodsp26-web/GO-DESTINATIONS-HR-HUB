import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';

// Build the lookup once at startup; compression consumes no request-time CPU.
// Only files found inside the build's public assets directory can be served.
export function compressedAssets(root: string): RequestHandler {
  const files = new Map<string, Partial<Record<'br' | 'gzip', string>>>();
  for (const name of fs.readdirSync(root, { recursive: true }) as string[]) {
    const match = /^(.*\.(?:js|css|svg|json))\.(br|gz)$/.exec(name);
    if (!match) continue;
    const key = '/' + match[1].split(path.sep).join('/');
    const variants = files.get(key) || {};
    variants[match[2] === 'br' ? 'br' : 'gzip'] = path.join(root, name);
    files.set(key, variants);
  }
  return (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    const variants = files.get(req.path);
    if (!variants) return next();
    res.vary('Accept-Encoding');
    const supported = (['br', 'gzip'] as const).filter(encoding => variants[encoding]);
    const encoding = req.acceptsEncodings(...supported, 'identity');
    if (!encoding) return res.status(406).end();
    if (encoding === 'identity') return next();
    res.setHeader('Content-Encoding', encoding);
    res.type(path.extname(req.path));
    res.sendFile(variants[encoding as 'br' | 'gzip']!, { maxAge: '1y', immutable: true }, error => { if (error) next(error); });
  };
}
