// Pure view-count helpers, mirroring the web admin's view-format.ts.

export function suggestedClimbTarget(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r = (h >>> 0) / 4294967295;
  return randomishTarget(r);
}

export function randomClimbTarget(): number {
  return randomishTarget(Math.random());
}

function randomishTarget(r: number): number {
  const raw = 25000 + r * 150000;
  const step = raw < 100000 ? 2500 : 5000;
  return Math.round(raw / step) * step;
}
