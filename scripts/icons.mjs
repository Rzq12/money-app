// Draws the PNG home-screen icons (ink tile, white K, pink plus) without extra packages.
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

// opts.scale shrinks the mark into the middle (Android adaptive icons and splash screens need padding),
// opts.bg = false leaves the background transparent, opts.aa smooths the stroke edges.
function draw(size, opts = {}) {
  const { scale = 1, bg = true, aa = false } = opts;
  const ink = [23, 23, 23]; const white = [255, 255, 255]; const pink = [240, 98, 146];
  const raw = Buffer.alloc((size * 4 + 1) * size);
  // Same mark as public/icon.svg (64-unit grid): a white K and a pink plus, drawn as round-capped strokes.
  const k = (size * scale) / 64; const off = (size * (1 - scale)) / 2; const half = 2.75;
  const dist = (px, py, [x1, y1, x2, y2]) => {
    const vx = x2 - x1; const vy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
  };
  const K = [[18, 18, 18, 46], [18, 33, 32, 18], [24, 27, 35, 46]];
  const PLUS = [[46, 14, 46, 26], [40, 20, 52, 20]];
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const o = y * (size * 4 + 1) + 1 + x * 4;
      if (!k) { raw.set(bg ? [...ink, 255] : [0, 0, 0, 0], o); continue; } // background only
      const px = (x + 0.5 - off) / k; const py = (y + 0.5 - off) / k;
      // Stroke coverage: hard-edged by default, a one-pixel ramp when smoothing.
      const cover = (segs) => {
        const d = Math.min(...segs.map((s) => dist(px, py, s)));
        return aa ? Math.max(0, Math.min(1, (half - d) * k + 0.5)) : d < half ? 1 : 0;
      };
      const cw = cover(K); const cp = cw >= 1 ? 0 : cover(PLUS);
      const fa = Math.max(cw, cp); const fc = cw >= cp ? white : pink;
      const a0 = bg ? 1 : 0; const alpha = fa + a0 * (1 - fa);
      for (let i = 0; i < 3; i++) raw[o + i] = alpha ? Math.round((fc[i] * fa + ink[i] * a0 * (1 - fa)) / alpha) : 0;
      raw[o + 3] = Math.round(alpha * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
for (const s of [192, 512]) writeFileSync(new URL(`../public/icon-${s}.png`, import.meta.url), draw(s));

// Sources for `npm run mobile:assets` (@capacitor/assets), which renders every Android/iOS size from them.
const res = (n) => new URL(`../resources/${n}`, import.meta.url);
mkdirSync(res(''), { recursive: true });
writeFileSync(res('icon-only.png'), draw(1024, { aa: true }));
writeFileSync(res('icon-foreground.png'), draw(1024, { scale: 0.62, bg: false, aa: true }));
writeFileSync(res('icon-background.png'), draw(1024, { scale: 0 }));
writeFileSync(res('splash.png'), draw(2732, { scale: 0.22, aa: true }));
writeFileSync(res('splash-dark.png'), draw(2732, { scale: 0.22, aa: true }));
console.log('icons ok');
