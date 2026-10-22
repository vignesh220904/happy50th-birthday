// Zero-dependency static server for local viewing and the smoke test.
//   node scripts/serve.mjs [port] [--open]    (default 8080; --open launches the browser)
// If the port is busy, the next free one is used.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.vtt': 'text/vtt', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

export function serve(port = 8080) {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    let stat;
    try { stat = statSync(file); } catch { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
    if (stat.isDirectory()) { res.writeHead(302, { location: `${path}/` }).end(); return; }
    const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
    // Range requests let browsers seek inside videos
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : stat.size - 1;
      res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${stat.size}`, 'accept-ranges': 'bytes' });
      createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { 'content-type': type, 'content-length': stat.size, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, () => ok(server));
  });
}

async function serveFirstFree(port, attempts = 10) {
  for (let p = port; p < port + attempts; p++) {
    try {
      await serve(p);
      return p;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
    }
  }
  throw new Error(`No free port between ${port} and ${port + attempts - 1}`);
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 8080;
  serveFirstFree(port).then((p) => {
    const url = `http://localhost:${p}/`;
    console.log(`Birthday site running at ${url}`);
    console.log('Keep this window open while viewing. Close it (or press Ctrl+C) to stop.');
    if (process.argv.includes('--open')) openBrowser(url);
  }).catch((err) => { console.error(err.message); process.exit(1); });
}
