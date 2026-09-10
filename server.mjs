import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const types = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const name = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!['index.html', 'app.js', 'model.js', 'cloud.js', 'config.js', 'style.css', 'icon.svg'].includes(name)) { res.writeHead(404).end(); return; }
    const body = await readFile(fileURLToPath(new URL('./public/' + name, import.meta.url)));
    res.writeHead(200, { 'Content-Type': types[name.split('.').pop()], 'Cache-Control': 'no-store' }).end(body);
  } catch { res.writeHead(500).end('No se pudo cargar la página.'); }
}).listen(5173, '127.0.0.1', () => console.log('http://localhost:5173'));
