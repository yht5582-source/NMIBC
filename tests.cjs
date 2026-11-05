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
t('complete Ta HG with muscle → EAU no; AUA consider only when AUA high risk', () => {
  const small = RE({ stage: 'Ta', g04: 'HG' }); assert.ok(!small.need); assert.ok(!small.auaWhy.some(x => /HG Ta/.test(x)));
  const multi = RE({ stage: 'Ta', g04: 'HG', multi: 'multiple' }); assert.ok(!multi.need); assert.ok(multi.auaWhy.some(x => /HG Ta/.test(x)));
});
t('no muscle in recurrent pure CIS → re-TURBT (exemption is primary CIS only)', () => assert.ok(RE({ stage: 'CIS', muscle: 'no', hist: 'recurrent' }).need));
t('T1 or any CIS → prostatic urethra biopsy prompt; Ta without CIS → none', () => { assert.ok(RE({ stage: 'T1', g04: 'HG' }).pu); assert.ok(RE({ stage: 'Ta', g04: 'HG', cis: 'yes' }).pu); assert.ok(!RE({ stage: 'Ta', g04: 'HG' }).pu); });

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

console.log('v2.0 regressions');
const prefs = r => r.tx.opts.filter(o => o.pref).map(o => o.t);
t('progression table matches EAU 2026 Table 6.3 for both WHO systems', () => {
  assert.deepEqual(NB.PROG['04'].vhigh, ['16%', '40%', '53%']); assert.deepEqual(NB.PROG['73'].vhigh, ['20%', '44%', '59%']);
  assert.deepEqual(NB.PROG['04'].low, ['0.06%', '0.93%', '3.7%']); assert.deepEqual(NB.PROG['73'].int, ['0.65%', '3.6%', '7.4%']);
});
t('WHO 1973 only → result carries sys 73 so the 1973 progression row is used', () => assert.equal(ev({ ...B, ...RF(1), stage: 'T1', g73: 'G2' }).eau.sys, '73'));
t('BCG failure on a high-risk tumour → BCG not preferred, classify first, no BCG-naive ICI option', () => {
  const r = ev({ ...B, ...RF(0), stage: 'T1', g04: 'HG', hist: 'recurrent', bcgPrior: true });
  assert.match(prefs(r)[0], /失敗分類/); assert.ok(!prefs(r).some(x => /全劑量 BCG/.test(x))); assert.ok(!r.tx.opts.some(o => /檢查點/.test(o.t)));
});
t('BCG-naive high risk → ICI option mentions maintenance', () => { const o = ev({ ...B, ...RF(0), stage: 'T1', g04: 'HG' }).tx.opts.find(x => /檢查點/.test(x.t)); assert.ok(o); assert.match(o.t + o.x, /維持/); });
t('stale recurrence boxes ignored once tumour is primary', () => {
  const r = ev({ ...B, ...RF(1), stage: 'Ta', g04: 'HG', hist: 'primary', bcgPrior: true, rec1y: true, ivtFail: true });
  assert.equal(r.ibcg.n, 0); assert.ok(!prefs(r).some(x => /失敗分類/.test(x))); assert.ok(!r.aua.why.some(x => /BCG/.test(x)));
});
t('chemo failure, intermediate → BCG 1 year preferred over more chemo', () => { const p = prefs(ev({ ...B, ...RF(2), stage: 'Ta', g04: 'LG', hist: 'recurrent', ivtFail: true })); assert.ok(p.some(x => /BCG 1 年/.test(x))); assert.ok(!p.some(x => /化療，誘導/.test(x))); });
t('small late LG recurrence → single instillation; ≥3 cm or early or frequent → not', () => {
  const base = { ...B, ...RF(0), stage: 'Ta', g04: 'LG', hist: 'recurrent', recNone: true };
  assert.ok(prefs(ev(base)).some(x => /小型 LG 復發/.test(x)));
  assert.ok(!ev({ ...base, size: 'ge3' }).tx.opts.some(x => /小型 LG 復發/.test(x.t)));
  assert.ok(!ev({ ...base, rec1y: true, recNone: false }).tx.opts.some(x => /小型 LG 復發/.test(x.t)));
  assert.ok(ev({ ...base, recFreq: true, recNone: false }).tx.opts.some(x => /單獨使用無效/.test(x.t)));
});
t('office fulguration / surveillance offered only for LG Ta, not T1 LG or Ta HG', () => {
  const has = x => ev({ ...B, ...x }).tx.opts.some(o => /電燒/.test(o.t));
  assert.ok(has({ ...RF(2), stage: 'Ta', g04: 'LG' })); assert.ok(!has({ ...RF(1), stage: 'T1', g04: 'LG' })); assert.ok(!has({ ...RF(0), stage: 'Ta', g04: 'HG' }));
});
t('Ta G2 reported only in WHO 1973 → intermediate Ta schedule', () => assert.equal(ev({ ...B, ...RF(0), stage: 'Ta', g73: 'G2' }).fu.key, 'intLG'));
t('pure CIS does not ask papillary number or size, and step 2 can complete', () => {
  const r = ev({ stage: 'CIS', hist: 'primary', vhNone: true, complete: 'yes', muscle: 'yes' });
  assert.ok(!keys(r).includes('rf')); assert.ok(r.path[1].done);
});
t('T2 completes the first path step', () => assert.ok(ev({ stage: 'T2' }).path[0].done));
t('invalid age treated as unknown and asked again', () => {
  const r = ev({ ...B, multi: 'single', size: 'lt3', stage: 'T1', g04: 'HG', age: 900 });
  assert.equal(r.d.age, null); assert.ok(r.d.ageBad); assert.deepEqual(r.asks.find(a => a.key === 'rf').fields, ['age']);
  assert.ok(!ev({ age: 70 }).d.ageBad); assert.equal(ev({ age: 71 }).d.rf, 1); assert.equal(ev({ age: 70 }).d.rf, 0);
});
t('pending item clears once its ask is answered, stays while unanswered', () => {
  assert.deepEqual(NB.prunePending({ stage: 'T1', g04: 'HG', cis: 'no', _pending: ['cis', 'hist'] }), ['hist']);
  assert.deepEqual(NB.prunePending({ _pending: ['path'] }), ['path']);
});
t('summary labels demo, lists pending and BCG failure class', () => {
  const s = NB.summary({ ...B, ...RF(0), stage: 'CIS', _demo: 8, hist: 'recurrent', _pending: ['qual'], _pendT: { qual: '切除品質' }, _fail: { course: 'adequate', finding: 'CIS', timing: '6m' } });
  assert.match(s, /示範病例/); assert.match(s, /待回報：切除品質/); assert.match(s, /BCG 失敗分類：BCG-refractory/);
  assert.ok(!/示範/.test(NB.summary({ stage: 'T2' })));
});
t('BCG before TURBT date warns about the dates, not a negative day count', () => { const w = NB.bcgSchedule('2026-11-02', 1, '2026-11-10').warn; assert.equal(w.length, 1); assert.match(w[0], /早於/); });
t('after-BCG timing needs a course before classifying', () => { const r = BF({ finding: 'TaHG', timing: 'after', months: 10 }); assert.equal(r.id, null); assert.match(r.t, /療程/); assert.equal(BF({ course: 'adequate', finding: 'TaHG', timing: 'after', months: -1 }).id, null); });

t('trial numbers follow the primary papers where they differ from the guideline text', () => {
  const ici = ev({ ...B, ...RF(0), stage: 'T1', g04: 'HG' }).tx.opts.find(x => /檢查點/.test(x.t)).x;
  assert.match(ici, /29\.1%/); assert.doesNotMatch(ici, /29\.8%/);
  assert.ok(/EORTC 復發分數 ≥5/.test(html)); assert.ok(!/或 EORTC 復發分數 >5/.test(html)); assert.ok(!/86\.5%/.test(html));
});

console.log('Exhaustive input sweep');
t('no combination throws; asks have fields; BCG-failure tumours never get BCG as preferred', () => {
  const stages = ['Ta', 'T1', 'CIS', 'T2'], g04s = [undefined, 'PUNLMP', 'LG', 'HG'], g73s = [undefined, 'G1', 'G2', 'G3'], cis = [undefined, 'no', 'yes'], age = [undefined, 60, 75], multi = [undefined, 'single', 'multiple'], size = [undefined, 'lt3', 'ge3'], hist = [undefined, 'primary', 'recurrent'], flags = [{}, { lvi: true }, { bcgPrior: true }, { recFreq: true }, { perf: true }];
  let n = 0;
  for (const st of stages) for (const a of g04s) for (const b of g73s) for (const c of cis) for (const ag of age) for (const m of multi) for (const z of size) for (const h of hist) for (const f of flags) {
    const s = { stage: st, g04: a, g73: b, cis: c, age: ag, multi: m, size: z, hist: h, ...f };
    const r = ev(s); n++;
    r.asks.forEach(q => assert.ok(q.fields.length, q.key));
    NB.summary(s);
    if (r.tx && f.bcgPrior && h === 'recurrent' && r.eau.id !== 'low') assert.ok(!prefs(r).some(x => /BCG/.test(x) && !/失敗分類/.test(x)), JSON.stringify(s));
    if (r.tx && f.perf && r.eau.id !== 'mibc') assert.ok(!prefs(r).some(x => /單次立即/.test(x)), JSON.stringify(s));
    if (r.eau && r.eau.id && r.eau.id !== 'mibc' && !r.eau.prov && h === 'recurrent') assert.notEqual(r.eau.id, 'low', JSON.stringify(s));
    if (r.eau && f.lvi && st !== 'T2') assert.equal(r.eau.id, 'vhigh');
    if (r.eau && r.eau.id === 'vhigh') assert.ok(r.tx.opts[0].pref);
  }
  console.log('    ' + n + ' combinations');
});

console.log('Teaching content');
const tm = html.match(/\/\*TEACH-START\*\/([\s\S]*?)\/\*TEACH-END\*\//);
if (!tm) throw new Error('teach block not found');
const { CASES, QUIZ, MINDMAP } = new Function(tm[1] + ';return { CASES, QUIZ, MINDMAP };')();
t('8 cases with unique ids and at least 3 teaching points', () => { assert.equal(CASES.length, 8); assert.equal(new Set(CASES.map(c => c.id)).size, 8); CASES.forEach(c => assert.ok(c.points.length >= 3 && c.story, c.id)); });
CASES.forEach(c => t(`case ${c.id} (${c.tag}) matches its engine output`, () => {
  const r = ev(c.s), x = c.expect;
  assert.equal(r.eau.id, x.eau); assert.equal(r.aua.id, x.aua); assert.equal(!!r.re.need, x.re); assert.equal(r.fu.key, x.fu);
  assert.ok(!r.eau.prov); assert.ok(!r.aua.prov);
  assert.ok(r.tx.opts.filter(o => o.pref).some(o => x.pref.test(o.t)), 'pref ' + x.pref);
  assert.deepEqual(r.asks.filter(a => a.pri !== 'later').map(a => a.key), [], 'case leaves no open questions');
  if (x.ibcg !== undefined) assert.equal(r.ibcg.n, x.ibcg);
  if (x.fail) assert.equal(NB.bcgFail(c.fail).id, x.fail);
}));
t('all EAU groups are represented in the cases', () => { const g = new Set(CASES.map(c => c.expect.eau)); ['low', 'int', 'high', 'vhigh'].forEach(x => assert.ok(g.has(x), x)); });
t('20 questions, 10 basic + 10 advanced, unique ids', () => { assert.equal(QUIZ.length, 20); assert.equal(QUIZ.filter(q => q.lv === '基礎').length, 10); assert.equal(QUIZ.filter(q => q.lv === '高階').length, 10); assert.equal(new Set(QUIZ.map(q => q.id)).size, 20); });
t('answers spread A–D 5 each, four distinct options, explanation and source present', () => {
  const n = [0, 0, 0, 0]; QUIZ.forEach(q => { n[q.a]++; assert.equal(q.o.length, 4, q.id); assert.equal(new Set(q.o).size, 4, q.id); assert.ok(q.e && q.s, q.id); }); assert.deepEqual(n, [5, 5, 5, 5]);
});
t('correct option is not usually the longest', () => { const c = QUIZ.filter(q => q.o[q.a].length === Math.max(...q.o.map(x => x.length))).length; assert.ok(c <= 8, 'longest correct = ' + c); });
QUIZ.filter(q => q.chk).forEach(q => t(`quiz ${q.id} answer agrees with engine`, () => {
  const e = ev(q.chk.s).eau; if (q.chk.eau) assert.equal(e.id, q.chk.eau); if (q.chk.by) assert.deepEqual(e.by, q.chk.by);
}));
QUIZ.filter(q => q.chkFail).forEach(q => t(`quiz ${q.id} answer agrees with BCG classifier`, () => assert.equal(BF(q.chkFail.i).id, q.chkFail.id)));
t('mind map has branches with content and no empty node', () => {
  assert.ok(MINDMAP.length >= 6); const walk = n => { if (typeof n === 'string') return assert.ok(n.trim()); assert.ok(n.t && n.c && n.c.length, n.t); n.c.forEach(walk); }; MINDMAP.forEach(walk);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
