// Draws the PNG home-screen icons (ink tile with a white coin) without extra packages.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}

function draw(size) {
  const ink = [23, 23, 23]; const white = [255, 255, 255];
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2; const cy = size * 0.53; const r = size * 0.3;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx; const dy = y + 0.5 - cy; const d = Math.hypot(dx, dy);
      let col = ink;
      if (d < r) col = white;
      // simple "$"-like bar and two arcs in ink inside the coin
      const u = dx / r; const v = dy / r;
      const bar = Math.abs(u) < 0.07 && Math.abs(v) < 0.72;
      const ring = (oy) => { const dd = Math.hypot(u, v - oy); return dd > 0.24 && dd < 0.38; };
      const s = (ring(-0.28) && !(u > 0.05 && v > -0.28 && v < 0)) || (ring(0.28) && !(u < -0.05 && v < 0.28 && v > 0));
      if (d < r && (bar || s)) col = ink;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
for (const s of [192, 512]) writeFileSync(new URL(`../public/icon-${s}.png`, import.meta.url), draw(s));
console.log('icons ok');
