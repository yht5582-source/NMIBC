// Rule tests for the decision engine embedded in index.html.
// Run: node tests.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/\/\*ENGINE-START\*\/([\s\S]*?)\/\*ENGINE-END\*\//);
if (!m) throw new Error('engine block not found');
const mod = { exports: {} };
new Function('module', m[1])(mod);
const NB = mod.exports;

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
const ev = s => NB.evaluate(s);
const keys = r => r.asks.map(a => a.key);
// rf helpers: 0–3 EAU clinical risk factors (age >70, multiple, ≥3 cm)
const RF = n => ({ age: n >= 1 ? 75 : 60, multi: n >= 2 ? 'multiple' : 'single', size: n >= 3 ? 'ge3' : 'lt3' });
const B = { hist: 'primary', vhNone: true, complete: 'yes', muscle: 'yes', cis: 'no' };
const E04 = (stage, g, n, x) => ev({ ...B, ...RF(n), stage, g04: g, ...x }).eau.id;
const E73 = (stage, g, n, x) => ev({ ...B, ...RF(n), stage, g73: g, ...x }).eau.id;

console.log('Guided asks');
t('nothing entered → asks only for pathology', () => assert.deepEqual(keys(ev({})), ['path']));
t('Ta LG only → asks CIS, risk factors, primary/recurrent, high-risk features, resection quality', () => {
  const k = keys(ev({ stage: 'Ta', g04: 'LG' }));
  ['cis', 'rf', 'hist', 'vh', 'qual'].forEach(x => assert.ok(k.includes(x), x));
});
t('recurrent → asks recurrence history', () => assert.ok(keys(ev({ ...B, ...RF(0), stage: 'Ta', g04: 'LG', hist: 'recurrent' })).includes('recur')));
t('T2 → no asks, MIBC', () => { const r = ev({ stage: 'T2' }); assert.equal(r.asks.length, 0); assert.equal(r.eau.id, 'mibc'); });
t('pending item leaves the ask list', () => assert.ok(!keys(ev({ stage: 'Ta', g04: 'LG', _pending: ['cis'] })).includes('cis')));

console.log('EAU 2021 groups — WHO 2004/2016');
t('primary single Ta LG <3 cm ≤70 → low', () => assert.equal(E04('Ta', 'LG', 0), 'low'));
t('PUNLMP counts as LG → low', () => assert.equal(E04('Ta', 'PUNLMP', 0), 'low'));
t('Ta LG with 1 risk factor → low', () => assert.equal(E04('Ta', 'LG', 1), 'low'));
t('Ta LG with 2 → intermediate; with 3 → high', () => { assert.equal(E04('Ta', 'LG', 2), 'int'); assert.equal(E04('Ta', 'LG', 3), 'high'); });
t('T1 LG with 0 risk factors → low (first low-risk bullet)', () => assert.equal(E04('T1', 'LG', 0), 'low'));
t('T1 LG with 1 → intermediate; ≥2 → high', () => { assert.equal(E04('T1', 'LG', 1), 'int'); assert.equal(E04('T1', 'LG', 2), 'high'); });
t('Ta HG: 0–1 → intermediate; ≥2 → high', () => { assert.equal(E04('Ta', 'HG', 0), 'int'); assert.equal(E04('Ta', 'HG', 1), 'int'); assert.equal(E04('Ta', 'HG', 2), 'high'); });
t('T1 HG no CIS: 0–2 → high; 3 → very high', () => { assert.equal(E04('T1', 'HG', 2), 'high'); assert.equal(E04('T1', 'HG', 3), 'vhigh'); });
t('T1 HG + CIS: 0 → high; ≥1 → very high', () => { assert.equal(E04('T1', 'HG', 0, { cis: 'yes' }), 'high'); assert.equal(E04('T1', 'HG', 1, { cis: 'yes' }), 'vhigh'); });
t('Ta HG + CIS: 2 → high; 3 → very high', () => { assert.equal(E04('Ta', 'HG', 2, { cis: 'yes' }), 'high'); assert.equal(E04('Ta', 'HG', 3, { cis: 'yes' }), 'vhigh'); });
t('Ta LG + CIS → high (all CIS)', () => assert.equal(E04('Ta', 'LG', 0, { cis: 'yes' }), 'high'));
t('primary pure CIS → high', () => assert.equal(ev({ ...B, stage: 'CIS' }).eau.id, 'high'));

console.log('EAU 2021 groups — WHO 1973');
t('Ta G1: ≤1 → low; 2 and 3 → intermediate', () => { assert.equal(E73('Ta', 'G1', 1), 'low'); assert.equal(E73('Ta', 'G1', 2), 'int'); assert.equal(E73('Ta', 'G1', 3), 'int'); });
t('T1 G1: 0 → low; 1–2 → intermediate; 3 → high', () => { assert.equal(E73('T1', 'G1', 0), 'low'); assert.equal(E73('T1', 'G1', 2), 'int'); assert.equal(E73('T1', 'G1', 3), 'high'); });
t('Ta G2: 0–2 → intermediate; 3 → high', () => { assert.equal(E73('Ta', 'G2', 0), 'int'); assert.equal(E73('Ta', 'G2', 2), 'int'); assert.equal(E73('Ta', 'G2', 3), 'high'); });
t('T1 G2: 0 → intermediate; ≥1 → high', () => { assert.equal(E73('T1', 'G2', 0), 'int'); assert.equal(E73('T1', 'G2', 1), 'high'); });
t('T1 G2 + CIS: 1 → high; ≥2 → very high', () => { assert.equal(E73('T1', 'G2', 1, { cis: 'yes' }), 'high'); assert.equal(E73('T1', 'G2', 2, { cis: 'yes' }), 'vhigh'); });
t('Ta G3: ≥2 → high; + CIS with 3 → very high', () => { assert.equal(E73('Ta', 'G3', 2), 'high'); assert.equal(E73('Ta', 'G3', 3, { cis: 'yes' }), 'vhigh'); });
t('T1 G3 + CIS + 1 → very high; T1 G3 no CIS + 3 → very high', () => { assert.equal(E73('T1', 'G3', 1, { cis: 'yes' }), 'vhigh'); assert.equal(E73('T1', 'G3', 3), 'vhigh'); });

console.log('EAU modifiers');
t('recurrent Ta LG small → intermediate (low only for primary)', () => assert.equal(E04('Ta', 'LG', 0, { hist: 'recurrent' }), 'int'));
t('LVI, subtype or prostatic-urethra CIS → very high', () => { ['lvi', 'subtype', 'cisPU'].forEach(k => assert.equal(E04('Ta', 'LG', 0, { vhNone: false, [k]: true }), 'vhigh', k)); });
t('both grading systems given and differ → takes higher, flags disagreement', () => {
  const r = ev({ ...B, ...RF(3), stage: 'Ta', g04: 'LG', g73: 'G1' }).eau;
  assert.equal(r.id, 'high'); assert.ok(r.disagree); assert.equal(r.by['73'], 'int');
});
t('unknown age, Ta LG single <3 cm → low either way (not provisional)', () => { const r = ev({ ...B, stage: 'Ta', g04: 'LG', multi: 'single', size: 'lt3' }).eau; assert.equal(r.id, 'low'); assert.ok(!r.prov); });
t('unknown risk factors that change the group → provisional with range', () => { const r = ev({ ...B, stage: 'T1', g04: 'HG', multi: 'multiple' }).eau; assert.ok(r.prov); assert.deepEqual(r.range, ['high', 'vhigh']); assert.equal(r.id, 'vhigh'); });
t('CIS status unknown → no EAU group yet', () => assert.equal(ev({ stage: 'T1', g04: 'HG' }).eau.id, null));

console.log('AUA/SUO');
const A = (x) => ev({ ...B, ...RF(0), ...x }).aua.id;
t('LG solitary Ta ≤3 cm → low; PUNLMP → low', () => { assert.equal(A({ stage: 'Ta', g04: 'LG' }), 'low'); assert.equal(A({ stage: 'Ta', g04: 'PUNLMP' }), 'low'); });
t('LG Ta multifocal or >3 cm → intermediate', () => { assert.equal(A({ stage: 'Ta', g04: 'LG', multi: 'multiple' }), 'int'); assert.equal(A({ stage: 'Ta', g04: 'LG', size: 'ge3' }), 'int'); });
t('LG Ta recurrence within 1 year → intermediate', () => assert.equal(A({ stage: 'Ta', g04: 'LG', hist: 'recurrent', rec1y: true }), 'int'));
t('HG Ta ≤3 cm primary → intermediate; recurrent HG Ta → high', () => { assert.equal(A({ stage: 'Ta', g04: 'HG' }), 'int'); assert.equal(A({ stage: 'Ta', g04: 'HG', hist: 'recurrent' }), 'high'); });
t('LG T1 → intermediate; HG T1 → high', () => { assert.equal(A({ stage: 'T1', g04: 'LG' }), 'int'); assert.equal(A({ stage: 'T1', g04: 'HG' }), 'high'); });
t('any CIS, LVI, subtype → high', () => { assert.equal(A({ stage: 'Ta', g04: 'LG', cis: 'yes' }), 'high'); assert.equal(A({ stage: 'Ta', g04: 'LG', lvi: true }), 'high'); });
t('WHO 1973 G2 alone cannot map to AUA', () => assert.equal(ev({ ...B, ...RF(0), stage: 'Ta', g73: 'G2' }).aua.id, null));

console.log('IBCG intermediate sub-stratification');
t('counts five factors', () => assert.equal(NB.ibcg({ multi: 'multiple', size: 'ge3', rec1y: true, recFreq: true, ivtFail: true }).n, 5));
t('≥3 → high band; 0 → low band', () => { assert.equal(NB.ibcg({ multi: 'multiple', size: 'ge3', rec1y: true }).band, 'high'); assert.equal(NB.ibcg({}).band, 'low'); });

console.log('re-TURBT');
const RE = x => ev({ ...B, ...RF(0), ...x }).re;
t('T1 → re-TURBT', () => assert.ok(RE({ stage: 'T1', g04: 'HG' }).need));
t('incomplete or doubtful resection → re-TURBT', () => { assert.ok(RE({ stage: 'Ta', g04: 'LG', complete: 'no' }).need); assert.ok(RE({ stage: 'Ta', g04: 'LG', complete: 'doubt' }).need); });
t('no muscle in Ta HG → re-TURBT; in Ta LG → exempt', () => { assert.ok(RE({ stage: 'Ta', g04: 'HG', muscle: 'no' }).need); const r = RE({ stage: 'Ta', g04: 'LG', muscle: 'no' }); assert.ok(!r.need); assert.ok(r.exemptNote); });
t('no muscle in primary CIS → exempt', () => assert.ok(!RE({ stage: 'CIS', muscle: 'no' }).need));
t('complete Ta HG with muscle → EAU no, AUA consider', () => { const r = RE({ stage: 'Ta', g04: 'HG' }); assert.ok(!r.need); assert.ok(r.auaWhy.some(x => /HG Ta/.test(x))); });

console.log('Treatment & follow-up');
const TX = x => ev({ ...B, ...x }).tx;
t('low → single immediate instillation preferred', () => assert.match(TX({ ...RF(0), stage: 'Ta', g04: 'LG' }).opts[0].t, /單次立即/));
t('perforation → single instillation not preferred', () => { const o = TX({ ...RF(0), stage: 'Ta', g04: 'LG', perf: true }).opts[0]; assert.ok(!o.pref); assert.match(o.x, /穿孔/); });
t('intermediate → chemo ≤1 year preferred, BCG 1 year alternative', () => { const o = TX({ ...RF(2), stage: 'Ta', g04: 'LG' }).opts; assert.ok(o.find(x => /化療，誘導/.test(x.t)).pref); assert.ok(o.some(x => /BCG 1 年/.test(x.t))); });
t('high → BCG 1–3 years preferred and discuss RC', () => { const o = TX({ ...RF(0), stage: 'T1', g04: 'HG' }).opts; assert.ok(o[0].pref && /BCG 1–3 年/.test(o[0].t)); assert.ok(o.some(x => /根除性膀胱切除/.test(x.t))); });
t('very high → discuss immediate RC first', () => assert.match(TX({ ...RF(1), stage: 'T1', g04: 'HG', cis: 'yes' }).opts[0].t, /根除性膀胱切除/));
t('follow-up: low / intermediate Ta LG / intermediate HG Ta / high', () => {
  assert.equal(ev({ ...B, ...RF(0), stage: 'Ta', g04: 'LG' }).fu.key, 'low');
  assert.equal(ev({ ...B, ...RF(2), stage: 'Ta', g04: 'LG' }).fu.key, 'intLG');
  assert.equal(ev({ ...B, ...RF(0), stage: 'Ta', g04: 'HG' }).fu.key, 'high');
  assert.equal(ev({ ...B, ...RF(0), stage: 'T1', g04: 'HG' }).fu.key, 'high');
});
t('intermediate T1 LG → individualized follow-up', () => assert.equal(ev({ ...B, ...RF(1), stage: 'T1', g04: 'LG' }).fu.key, 'intOther'));

console.log('BCG schedule');
t('1 year = 6 induction + 9 maintenance = 15', () => assert.equal(NB.bcgSchedule('2026-11-02', 1).total, 15));
t('3 years = 6 + 21 = 27, last series at month 36', () => { const s = NB.bcgSchedule('2026-11-02', 3); assert.equal(s.total, 27); assert.equal(s.rows[s.rows.length - 3].date, '2029-11-02'); });
t('induction weekly dates', () => assert.deepEqual(NB.bcgSchedule('2026-11-02', 1).rows.slice(0, 6).map(r => r.date), ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07']));
t('month-end start clamps (Jan 31 + 3 months → Apr 30)', () => assert.equal(NB.bcgSchedule('2027-01-31', 1).rows[6].date, '2027-04-30'));
t('<14 days after TURBT → warning', () => { assert.equal(NB.bcgSchedule('2026-11-02', 1, '2026-10-25').warn.length, 1); assert.equal(NB.bcgSchedule('2026-11-02', 1, '2026-10-19').warn.length, 0); });

console.log('BCG failure categories (EAU 2026 Table 7.2)');
const BF = x => NB.bcgFail(x);
t('LG recurrence is not a BCG failure', () => assert.equal(BF({ course: 'adequate', finding: 'LG', timing: 'after', months: 3 }).id, 'lg'));
t('T1 HG at 3 months → refractory/unresponsive', () => assert.equal(BF({ course: 'ind', finding: 'T1HG', timing: '3m' }).id, 'unresponsive'));
t('Ta HG at 3 months after induction only → BCG-resistant (exposed)', () => { const r = BF({ course: 'ind', finding: 'TaHG', timing: '3m' }); assert.equal(r.id, 'exposed'); assert.equal(r.sub, 'resistant'); });
t('CIS at 3 months → not yet refractory; persisting at 6 months → refractory', () => { assert.equal(BF({ course: 'ind', finding: 'CIS', timing: '3m' }).id, 'exposed'); assert.equal(BF({ course: 'adequate', finding: 'CIS', timing: '6m' }).id, 'unresponsive'); });
t('HG during maintenance → refractory', () => assert.equal(BF({ course: 'adequate', finding: 'TaHG', timing: 'maint' }).id, 'unresponsive'));
t('after adequate BCG: Ta/T1 HG ≤6 months → unresponsive; 7 months → relapsing', () => { assert.equal(BF({ course: 'adequate', finding: 'TaHG', timing: 'after', months: 6 }).id, 'unresponsive'); assert.equal(BF({ course: 'adequate', finding: 'TaHG', timing: 'after', months: 7 }).id, 'relapsing'); });
t('after adequate BCG: CIS ≤12 months → unresponsive; 13 → relapsing', () => { assert.equal(BF({ course: 'adequate', finding: 'CIS', timing: 'after', months: 12 }).id, 'unresponsive'); assert.equal(BF({ course: 'adequate', finding: 'CIS', timing: 'after', months: 13 }).id, 'relapsing'); });
t('induction only, HG at 10 months → exposed (delayed relapse after inadequate BCG)', () => assert.equal(BF({ course: 'ind', finding: 'TaHG', timing: 'after', months: 10 }).id, 'exposed'));
t('>24 months → late relapse', () => assert.equal(BF({ course: 'adequate', finding: 'T1HG', timing: 'after', months: 30 }).id, 'late'));
t('MIBC → MIBC; intolerance → intolerance', () => { assert.equal(BF({ finding: 'MIBC', timing: '3m' }).id, 'mibc'); assert.equal(BF({ intol: true }).id, 'intol'); });

console.log('Summary');
t('summary includes EAU group, re-TURBT and follow-up', () => {
  const s = NB.summary({ ...B, ...RF(0), stage: 'T1', g04: 'HG' });
  assert.match(s, /EAU 2021 風險：高風險/); assert.match(s, /re-TURBT：需要/); assert.match(s, /追蹤（EAU）/);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
