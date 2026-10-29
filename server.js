// Whitespace Hub web server. Serves index.html and its icons/images from this folder.
// No dependencies.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
  ? path.join(__dirname, 'public') : __dirname;
// Only these file types are served, so server.js, package.json etc. stay private.
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function send(res, file, status = 200) {
  const ext = path.extname(file).toLowerCase();
  res.writeHead(status, {
    'Content-Type': TYPES[ext],
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff'
  });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); } catch { urlPath = '/'; }
  if (urlPath === '/healthz') { res.writeHead(200); return res.end('ok'); }
  const index = path.join(ROOT, 'index.html');
  if (urlPath === '/' || !path.extname(urlPath)) return send(res, index);
  const file = path.normalize(path.join(ROOT, urlPath));
  const ext = path.extname(file).toLowerCase();
  if (!file.startsWith(ROOT + path.sep) || !TYPES[ext] || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found');
  }
  send(res, file);
}).listen(PORT, () => console.log(`Whitespace Hub running on port ${PORT}`));
