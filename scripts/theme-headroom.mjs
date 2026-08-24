import { readFileSync } from 'node:fs';

const css = readFileSync('app/globals.css', 'utf8');

const lum = (hex) => {
  const c = hex.replace('#', '');
  const v = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const s = [0, 2, 4]
    .map((i) => parseInt(v.slice(i, i + 2), 16) / 255)
    .map((u) => (u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)));
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};
const ratio = (a, b) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const rows = [];
for (const m of css.matchAll(/\[data-theme='([a-z-]+)'\]\s*\{([^}]*)\}/g)) {
  const [, name, body] = m;
  const get = (k) => body.match(new RegExp(`--${k}:\\s*(#[0-9a-fA-F]{3,6})`))?.[1];
  const bg = get('bg');
  const surface = get('surface');
  const ink = get('ink');
  const muted = get('muted');
  if (!bg || !surface || !ink || !muted) continue;
  rows.push({
    name,
    onBg: Math.min(ratio(ink, bg), ratio(muted, bg)),
    onSurface: Math.min(ratio(ink, surface), ratio(muted, surface)),
  });
}

rows.sort((a, b) => a.onSurface - b.onSurface);
console.log('theme'.padEnd(15), 'worst-on-bg', 'worst-on-surface', 'panel fill safe?');
for (const r of rows) {
  console.log(
    r.name.padEnd(15),
    r.onBg.toFixed(2).padStart(9),
    r.onSurface.toFixed(2).padStart(14),
    '  ',
    r.onSurface >= 4.5 ? 'yes' : 'NO',
  );
}
const unsafe = rows.filter((r) => r.onSurface < 4.5);
console.log(`\n${unsafe.length} of ${rows.length} themes cannot carry a --surface panel fill.`);
console.log(`${rows.filter((r) => r.onBg < 5).length} sit under 5:1 on their own page ground.`);
