// train.boiret.com: the site's files, and /relay, the WebSocket that pairs a TV with an iPad remote. The TV is the playground on a big
// screen (loco/03j-remote.js), the remote is /remote/ (site/remote.html); the relay passes the iPad's commands to the TV and the TV's
// state back. Node 22, no dependencies, one process: the rooms live in memory, so the service runs as a single replica.
// Usage: node site/server.mjs [dir]   (the Dockerfile serves /srv; locally site/public). PORT picks the port (Railway sets it), else 8080.
// RELAY_ANY_ORIGIN=1 lets a page from anywhere use the relay (local tests); otherwise only this site's own pages may.
import http from 'node:http';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { brotliCompressSync, gzipSync, constants as Z } from 'node:zlib';

const ROOT = process.argv[2] || '/srv', PORT = +process.env.PORT || 8080, ANY_ORIGIN = process.env.RELAY_ANY_ORIGIN === '1';

/* ---- the files: all in memory, the text ones compressed once at start (brotli for today's browsers, gzip for the others) */
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.txt':'text/plain; charset=utf-8', '.svg':'image/svg+xml', '.xml':'application/xml', '.webmanifest':'application/manifest+json',
  '.mp3':'audio/mpeg', '.ogg':'audio/ogg', '.wav':'audio/wav', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
  '.gif':'image/gif', '.ico':'image/x-icon', '.woff2':'font/woff2', '.glb':'model/gltf-binary', '.wasm':'application/wasm' };
const files = new Map();   // '/playground/index.html' → { type, tag, id, br, gz }: the bytes as they are and compressed
(function load(dir, url){
  for (const e of readdirSync(dir, { withFileTypes:true })){
    if (e.isDirectory()){ load(join(dir, e.name), url + e.name + '/'); continue; }
    if (!e.isFile()) continue;
    const id = readFileSync(join(dir, e.name)), type = TYPES[(/\.[^.]+$/.exec(e.name) || [''])[0].toLowerCase()] || 'application/octet-stream';
    const f = { type, id, tag:createHash('sha1').update(id).digest('base64url').slice(0, 16) };
    if (/^text\/|^image\/svg|^application\/(json|xml|manifest)/.test(type) && id.length >= 512){   // tiny files gain nothing
      const br = brotliCompressSync(id, { params:{ [Z.BROTLI_PARAM_QUALITY]:11, [Z.BROTLI_PARAM_MODE]:Z.BROTLI_MODE_TEXT, [Z.BROTLI_PARAM_SIZE_HINT]:id.length } });
      const gz = gzipSync(id, { level:9 });
      if (br.length < id.length) f.br = br;
      if (gz.length < id.length) f.gz = gz;
    }
    files.set(url + e.name, f);
  }
})(ROOT, '/');

function accepts(h = ''){   // the codings the browser takes, 'q=0' meaning no
  const ok = new Set();
  for (const part of h.toLowerCase().split(',')){ const [name, ...ps] = part.split(';').map(s => s.trim()); const q = ps.find(p => p.startsWith('q=')); if (!q || +q.slice(2) > 0) ok.add(name); }
  return ok;
}

const server = http.createServer((req, res) => {
  const H = { 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' }, end = (code, h = {}) => { res.writeHead(code, { ...H, 'Content-Length':0, ...h }); res.end(); };
  if (req.method !== 'GET' && req.method !== 'HEAD') return end(405, { Allow:'GET, HEAD' });
  let url, path;
  try { url = new URL(req.url, 'http://x'); path = decodeURIComponent(url.pathname); } catch { return end(400); }
  const f = files.get(path.endsWith('/') ? path + 'index.html' : path);
  if (!f) return files.has(path + '/index.html') ? end(308, { Location:url.pathname + '/' + url.search }) : end(404);   // a folder named without its slash: there, the query kept
  const ok = accepts(req.headers['accept-encoding']), [coding, body] = ok.has('br') && f.br ? ['br', f.br] : ok.has('gzip') && f.gz ? ['gzip', f.gz] : [null, f.id];
  const h = { ...H, 'Content-Type':f.type, ETag:`"${f.tag}${coding ? '-' + coding : ''}"` };
  if (f.br || f.gz) h.Vary = 'Accept-Encoding';
  if (coding) h['Content-Encoding'] = coding; else h['Accept-Ranges'] = 'bytes';
  if ((req.headers['if-none-match'] || '').includes(f.tag)){ res.writeHead(304, h); return res.end(); }
  const r = !coding && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');   // one byte range of a file sent as it is (audio)
  if (r && (r[1] || r[2])){
    const n = body.length, a = r[1] ? +r[1] : Math.max(0, n - +r[2]), b = r[1] && r[2] ? Math.min(+r[2], n - 1) : n - 1;
    if (a > b || a >= n) return end(416, { 'Content-Range':`bytes */${n}` });
    res.writeHead(206, { ...h, 'Content-Range':`bytes ${a}-${b}/${n}`, 'Content-Length':b - a + 1 });
    return res.end(req.method === 'HEAD' ? undefined : body.subarray(a, b + 1));
  }
  res.writeHead(200, { ...h, 'Content-Length':body.length });
  res.end(req.method === 'HEAD' ? undefined : body);
});

/* ---- /relay: a bare WebSocket (RFC 6455) carrying JSON text, nothing else */
const MAX_MSG = 16384, PING_MS = 25000, sockets = new Set();
function sameSite(req){   // a browser always names the page that opens a socket: only this site's own; a program can claim anything, so none is asked of it
  const o = req.headers.origin;
  if (!o) return true;
  try { const h = new URL(o).host; return h === req.headers.host || h === req.headers['x-forwarded-host']; } catch { return false; }
}
server.on('upgrade', (req, sock, head) => {
  const deny = (code, text) => sock.end(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  let url; try { url = new URL(req.url, 'http://x'); } catch { return deny(400, 'Bad Request'); }
  const key = req.headers['sec-websocket-key'];
  if (url.pathname !== '/relay') return deny(404, 'Not Found');
  if (req.headers.upgrade?.toLowerCase() !== 'websocket' || !key || req.headers['sec-websocket-version'] !== '13') return deny(400, 'Bad Request');
  if (!ANY_ORIGIN && !sameSite(req)) return deny(403, 'Forbidden');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')}\r\n\r\n`);
  const ip = String(req.headers['x-real-ip'] || '').trim() || req.socket.remoteAddress;   // Railway's edge sets X-Real-IP to the visitor; X-Forwarded-For's first entry is whatever the client wrote
  enter(socket(sock, head), url.searchParams, ip);
});

function socket(sock, head){   // frames in and out of one connection; ws.on(text) gets each message, ws.gone() runs once at the end
  const ws = { alive:true, closing:false, on:null, gone:null, n:0, t0:0, room:null, role:null };
  let buf = head?.length ? Buffer.from(head) : Buffer.alloc(0);
  const frame = (op, data) => {
    if (sock.destroyed || !sock.writable) return;
    const n = data.length, h = Buffer.alloc(n < 126 ? 2 : n < 65536 ? 4 : 10);
    h[0] = 0x80 | op;
    if (n < 126) h[1] = n; else if (n < 65536){ h[1] = 126; h.writeUInt16BE(n, 2); } else { h[1] = 127; h.writeUInt32BE(n, 6); }
    sock.write(Buffer.concat([h, data]));
    if (sock.writableLength > 1 << 20) sock.destroy();   // a peer that reads nothing is dropped rather than queued for
  };
  ws.frame = frame;
  ws.send = text => { if (!ws.closing) frame(0x1, Buffer.from(text)); };
  ws.close = (code = 1000, reason = '') => {
    if (ws.closing) return; ws.closing = true;
    const r = Buffer.from(reason).subarray(0, 120), p = Buffer.alloc(2 + r.length); p.writeUInt16BE(code); r.copy(p, 2);
    frame(0x8, p); sock.end(); setTimeout(() => sock.destroy(), 2000).unref();
  };
  const parse = () => {
    while (buf.length >= 2 && !ws.closing){
      const b0 = buf[0], b1 = buf[1], fin = b0 & 0x80, op = b0 & 0x0f;
      let len = b1 & 0x7f, at = 2;
      if (len === 126){ if (buf.length < 4) return; len = buf.readUInt16BE(2); at = 4; }
      else if (len === 127){ if (buf.length < 10) return; len = buf.readUInt32BE(2) ? Infinity : buf.readUInt32BE(6); at = 10; }
      if (!(b1 & 0x80) || (b0 & 0x70) || (op >= 8 && (len > 125 || !fin))) return ws.close(1002);   // a browser masks every frame; no extension was agreed
      if (len > MAX_MSG) return ws.close(1009);
      if (buf.length < at + 4 + len) return;
      const mask = buf.subarray(at, at + 4), data = Buffer.from(buf.subarray(at + 4, at + 4 + len));
      for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(at + 4 + len);
      ws.alive = true;
      if (op === 0x8){ const c = data.length >= 2 ? data.readUInt16BE(0) : 1000; return ws.close(c >= 1000 && c < 5000 && ![1004, 1005, 1006, 1015].includes(c) ? c : 1000); }   // the other side hangs up: answered with its code
      if (op === 0x9){ frame(0xA, data); continue; }
      if (op === 0xA) continue;
      if (op !== 0x1 || !fin) return ws.close(1003);   // the pages send each message as one text frame
      const now = Date.now(); if (now - ws.t0 > 1000){ ws.t0 = now; ws.n = 0; }
      if (++ws.n > 60) continue;                        // more than 60 a second: the rest dropped
      try { ws.on?.(data.toString()); } catch (e) { console.error('relay:', e); }
    }
  };
  sock.setNoDelay(true);
  sock.on('data', d => { buf = buf.length ? Buffer.concat([buf, d]) : d; parse(); });
  sock.on('error', () => {});
  sock.on('close', () => { sockets.delete(ws); try { ws.gone?.(); } catch (e) { console.error('relay:', e); } });
  sockets.add(ws);
  if (buf.length) setImmediate(parse);
  return ws;
}
setInterval(() => {   // a protocol ping every 25 s: no answer by the next one and the connection is dropped (a sleeping iPad, a lost network)
  for (const ws of sockets){ if (!ws.alive){ ws.close(1001); continue; } ws.alive = false; ws.frame(0x9, Buffer.alloc(0)); }
}, PING_MS).unref();

/* ---- rooms: one TV and up to 8 remotes. The TV gets a code of 4 letters to show and a secret key to take its room back after a reload
   or a redeploy: the server forgets everything when it restarts, and the TV coming back re-creates its room under the same code */
const ABC = 'BCDFGHJKLMNPQRSTVWXZ', CODE = /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/, KEY = /^[\w-]{20,64}$/;   // consonants only: no word ever spelled
const MAX_ROOMS = 1000, MAX_REMOTES = 8, ROOM_TTL = 30 * 60e3, FAIL_MAX = 20, FAIL_MS = 10 * 60e3;
const rooms = new Map(), fails = new Map();   // code → room; visitor → { n, t } wrong codes since t
const newCode = () => { let c; do c = Array.from({ length:4 }, () => ABC[randomInt(ABC.length)]).join(''); while (rooms.has(c)); return c; };
const J = JSON.stringify;

function enter(ws, q, ip){
  const role = q.get('role'), code = String(q.get('code') || '').toUpperCase(), key = String(q.get('key') || '');
  if (role === 'tv'){
    let r = rooms.get(code);
    if (r && r.key !== key) r = null;   // someone else's room: a new one
    if (!r){
      if (rooms.size >= MAX_ROOMS) return ws.close(1013, 'busy');
      const back = CODE.test(code) && KEY.test(key) && !rooms.has(code);   // a TV back after a restart keeps its code: the iPad finds it again
      r = { code:back ? code : newCode(), key:back ? key : randomBytes(18).toString('base64url'), tv:null, remotes:new Set(), state:null, line:null, left:0 };
      rooms.set(r.code, r);
    }
    if (r.tv) r.tv.close(4001, 'replaced');   // the same TV in another tab, or a reload faster than the old socket's end
    r.tv = ws; ws.room = r; ws.role = 'tv';
    ws.send(J({ t:'room', code:r.code, key:r.key, n:r.remotes.size }));
    for (const x of r.remotes) x.send(J({ t:'tv', on:true }));
  } else if (role === 'remote'){
    const f = fails.get(ip), now = Date.now();
    if (f && now - f.t < FAIL_MS && f.n >= FAIL_MAX) return ws.close(4029, 'slow down');   // codes tried one after another
    const r = CODE.test(code) && rooms.get(code);
    if (!r){
      if (!f || now - f.t >= FAIL_MS) fails.set(ip, { n:1, t:now }); else f.n++;
      ws.send(J({ t:'nope' })); return ws.close(4004, 'no such TV');
    }
    if (r.remotes.size >= MAX_REMOTES) return ws.close(4008, 'full');
    r.remotes.add(ws); ws.room = r; ws.role = 'remote';
    ws.send(J({ t:'hi', code:r.code, tv:!!r.tv }));
    if (r.line) ws.send(r.line);
    if (r.state) ws.send(r.state);
    r.tv?.send(J({ t:'peers', n:r.remotes.size }));
  } else return ws.close(1008, 'role');
  ws.on = text => {
    let m; try { m = JSON.parse(text); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ping') return ws.send('{"t":"pong"}');   // the pages' own check that the line is alive (a browser never sees protocol pings)
    const r = ws.room;
    if (ws.role === 'tv'){   // the TV's state and its line are kept for the remotes that join later; its messages go to every remote
      if (m.t === 'state') r.state = text; else if (m.t === 'line') r.line = text; else if (m.t !== 'toast') return;
      for (const x of r.remotes) x.send(text);
    } else if (m.t === 'cmd') r.tv?.send(text);
  };
  ws.gone = () => {
    const r = ws.room;
    if (ws.role === 'tv' && r.tv === ws){ r.tv = null; r.left = Date.now(); for (const x of r.remotes) x.send(J({ t:'tv', on:false })); }
    if (ws.role === 'remote' && r.remotes.delete(ws)) r.tv?.send(J({ t:'peers', n:r.remotes.size }));
  };
}
setInterval(() => {   // a room whose TV left half an hour ago goes, its remotes told; old wrong-code counts are forgotten
  const now = Date.now();
  for (const r of rooms.values()) if (!r.tv && now - r.left > ROOM_TTL){ rooms.delete(r.code); for (const x of r.remotes) x.close(4004, 'TV gone'); }
  for (const [ip, f] of fails) if (now - f.t >= FAIL_MS) fails.delete(ip);
}, 60e3).unref();

const bye = () => {   // a redeploy: every page is told to come back (1012), and comes back to the new server
  for (const ws of sockets) ws.close(1012, 'restart');
  server.close(); setTimeout(() => process.exit(0), 300);
};
process.on('SIGTERM', bye); process.on('SIGINT', bye);
server.keepAliveTimeout = 120e3;   // longer than the proxy in front keeps an idle connection: it never sends on one closing here
server.listen(PORT, () => console.log(`train: ${files.size} files from ${ROOT}, port ${PORT}`));
