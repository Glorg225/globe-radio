import { readFileSync } from 'node:fs';

// Prints category scores and every audit that lost points (score < 1) with its weight.
const r = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const c of Object.values(r.categories)) {
  console.log(`${c.title}: ${Math.round(c.score * 100)}`);
  for (const ref of c.auditRefs) {
    const a = r.audits[ref.id];
    if (ref.weight > 0 && a.score !== null && a.score < 1) console.log(`  - ${ref.id} (w${ref.weight}, ${a.score}) ${a.displayValue ?? ''} ${a.title}`);
  }
}
