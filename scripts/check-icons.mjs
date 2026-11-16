// Fails when the icon set breaks a rule: count, unique keys, names, groups, grid, dot size, emoji, clashes, defaults.
// Path outlines need a renderer, so their bounds are checked on the contact sheet instead.
import { readFileSync } from 'node:fs';
import { ICON_LIST, ICON_GROUPS, ICON_MAP, DEFAULT_ICONS, FALLBACK_SHAPES } from '../src/icons.js';

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

if (problems.length) {
  console.error(`check:icons failed (${problems.length}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`check:icons ok: ${ICON_LIST.length} icons in ${ICON_GROUPS.length} groups, defaults covered`);
