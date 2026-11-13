import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const site = fileURLToPath(new URL('../dist', import.meta.url));
const scratch = dirname(require.resolve('@scratch/scratch-gui'));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm',
  '.sb3': 'application/octet-stream'
};

createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const scratchPrefix = path.startsWith('/scratch/');
    const packaged = scratchPrefix || /^\/(static|chunks|libraries)\//.test(path) ||
      path === '/extension-worker.js' || path === '/scratch-gui.js';
    const root = packaged ? scratch : site;
    const relative = scratchPrefix ? path.slice('/scratch/'.length) : path.slice(1);
    const filename = resolve(root, relative || 'index.html');
    if (!filename.startsWith(root + sep)) {
      res.writeHead(404).end();
      return;
    }
    const info = await stat(filename);
    if (!info.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[extname(filename)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'X-Content-Type-Options': 'nosniff'
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(filename).on('error', () => res.destroy()).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
}).listen(5173, '127.0.0.1', () => {
  console.log('http://127.0.0.1:5173');
});
