// Fails when any source file under src/ contains an emoji, listing file, line and the character.
// Kasku+ draws its own icons (src/icons.js); emoji typed by users are data and live outside src/.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const EMOJI = /\p{Extended_Pictographic}/gu;
const hits = [];

const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(jsx?|mjs|css|html|json)$/.test(name)) continue;
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(EMOJI)) hits.push(`${relative(root, p)}:${i + 1}  U+${m[0].codePointAt(0).toString(16).toUpperCase()}  ${line.trim().slice(0, 80)}`);
    });
  }
};
walk(join(root, 'src'));

if (hits.length) {
  console.error(`check:emoji failed: ${hits.length} emoji in src/\n${hits.map((h) => `  ${h}`).join('\n')}`);
  process.exit(1);
}
console.log('check:emoji ok: no emoji in src/');
