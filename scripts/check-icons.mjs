// Fails when the icon set breaks a rule: count, unique keys, names, groups, grid, dot size, emoji, clashes, defaults, logo files.
// Path outlines need a renderer, so their bounds are checked on the contact sheet instead.
import { readFileSync, readdirSync } from 'node:fs';
import { ICON_LIST, ICON_GROUPS, ICON_MAP, DEFAULT_ICONS, FALLBACK_SHAPES, BRAND_LIST, BRAND_GROUPS } from '../src/icons.js';

const MIN_ICONS = 72;
const problems = [];
const fail = (msg) => problems.push(msg);
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

if (ICON_LIST.length < MIN_ICONS) fail(`only ${ICON_LIST.length} icons, need at least ${MIN_ICONS}`);

const groups = new Set(ICON_GROUPS.map((g) => g.key));
const seen = new Set();
for (const icon of ICON_LIST) {
  const at = `icon "${icon.key}"`;
  if (seen.has(icon.key)) fail(`${at}: duplicate key`);
  seen.add(icon.key);
  if (!groups.has(icon.group)) fail(`${at}: unknown group "${icon.group}"`);
  if (!icon.id?.trim() || !icon.en?.trim()) fail(`${at}: missing Indonesian or English name`);
  if (!Array.isArray(icon.d) || !icon.d.length) fail(`${at}: no shapes`);
}
for (const g of ICON_GROUPS) {
  if (!g.id || !g.en) fail(`group "${g.key}": missing name`);
  if (!ICON_LIST.some((i) => i.group === g.key)) fail(`group "${g.key}": empty`);
}

// Shapes stay inside 2..22 so the 1.5px stroke is never clipped by the 24px viewBox.
const inside = (lo, hi) => lo >= 2 && hi <= 22;
for (const icon of [...ICON_LIST, { key: 'fallback', d: FALLBACK_SHAPES }]) {
  for (const s of icon.d) {
    const at = `icon "${icon.key}" ${s[0]}`;
    if (s[0] === 'p') { if (typeof s[1] !== 'string' || !/^M/.test(s[1])) fail(`${at}: path must start with M`); }
    else if (s[0] === 'c') { if (!inside(s[1] - s[3], s[1] + s[3]) || !inside(s[2] - s[3], s[2] + s[3])) fail(`${at}: circle leaves the grid`); }
    else if (s[0] === 'r') { if (!inside(s[1], s[1] + s[3]) || !inside(s[2], s[2] + s[4])) fail(`${at}: rect leaves the grid`); }
    else if (s[0] === 'dot') { if (s[3] > 1.2) fail(`${at}: dot radius ${s[3]} is above 1.2`); }
    else fail(`${at}: unknown shape type`);
  }
}

// Interface icons win over record icons in <Icon>, so a shared key would hide the record icon.
const uiKeys = [...src('ui.jsx').matchAll(/^ {2}([a-zA-Z]+): </gm)].map((m) => m[1]);
for (const k of uiKeys) if (ICON_MAP[k]) fail(`icon "${k}": key also used by an interface icon in ui.jsx`);

// Every built-in record has an icon.
const need = (kind, ids, map) => { for (const id of ids) if (!ICON_MAP[map[id]]) fail(`${kind} "${id}": no icon in DEFAULT_ICONS`); };
const store = src('store.js');
need('category', [...store.matchAll(/cat\('([a-z-]+)'/g)].map((m) => m[1]), DEFAULT_ICONS.categories);
need('member', [...store.matchAll(/id: '(mem-[a-z]+)'/g)].map((m) => m[1]), DEFAULT_ICONS.members);
const wallet = src('Wallet.jsx').match(/const TYPES = \[([^\]]+)\]/);
need('wallet type', wallet ? [...wallet[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]) : [], DEFAULT_ICONS.walletTypes);
if (!ICON_MAP[DEFAULT_ICONS.ledger]) fail('default ledger: no icon');

if (/\p{Extended_Pictographic}/u.test(src('icons.js'))) fail('src/icons.js contains an emoji');

// Bank and e-wallet logos: one SVG per key in src/brands/, small, with nothing that runs or loads
// (an embedded PNG is allowed: Neo Commerce only ships its mark that way).
const MAX_LOGO = 40 * 1024;
const drawn = new Set(ICON_LIST.map((i) => i.key));
const brandGroups = new Set(BRAND_GROUPS.map((g) => g.key));
for (const brand of BRAND_LIST) {
  const at = `logo "${brand.key}"`;
  if (drawn.has(brand.key)) fail(`${at}: key also used by a drawn icon`);
  if (!brandGroups.has(brand.group)) fail(`${at}: unknown group "${brand.group}"`);
  if (!/^(bank|ew)-[a-z]+$/.test(brand.key)) fail(`${at}: key must look like bank-x or ew-x`);
  if (!/^#[0-9a-f]{6}$/.test(brand.color)) fail(`${at}: colour must be #rrggbb`);
  let svg = '';
  try { svg = src(`brands/${brand.key}.svg`); } catch { fail(`${at}: missing src/brands/${brand.key}.svg`); continue; }
  if (svg.length > MAX_LOGO) fail(`${at}: ${svg.length} bytes, above ${MAX_LOGO}`);
  if (!/<svg[\s>]/.test(svg) || !/viewBox=/.test(svg)) fail(`${at}: not an SVG with a viewBox`);
  if (/<script|<foreignObject|\son[a-z]+=|href="(?:https?:|data:(?!image\/png;base64,))/i.test(svg)) fail(`${at}: script, event handler or outside reference`);
}
const files = readdirSync(new URL('../src/brands/', import.meta.url)).filter((f) => f.endsWith('.svg'));
for (const f of files) if (!BRAND_LIST.some((x) => `${x.key}.svg` === f)) fail(`src/brands/${f}: not in BRAND_LIST`);

if (problems.length) {
  console.error(`check:icons failed (${problems.length}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`check:icons ok: ${ICON_LIST.length} icons in ${ICON_GROUPS.length} groups, ${BRAND_LIST.length} logos, defaults covered`);
