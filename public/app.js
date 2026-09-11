/* Deficit and Debt Calculator · Giroux Technologies
   Controls, charts, table, and shareable links. Depends on model.js (window.FiscalModel). */
(function () {
  'use strict';
  const M = window.FiscalModel;
  const D = M.DEFAULTS;

  const COLORS = {
    scenario: '#5CE1E6',   // GT Cyan: the scenario is the point of the page
    baseline: '#9B9B9B',   // Industrial Gray: context
    ink: '#F5F0E8',
    muted: '#9B9B9B',
    grid: '#2e2e2c',
    axis: '#3d3d3a',
    surface: '#1A1A1A',
    direct: '#5CE1E6',
    growth: '#F5F0E8',
    interest: '#B8B3AA',
    feedback: '#7A7A78'
  };

  // ---------- State ----------
  const NUMERIC_KEYS = ['cutPct', 'revPct', 'cutPhase', 'revPhase', 'startYear', 'horizon',
    'cutMultiplier', 'revMultiplier', 'fadeYears', 'gdp0', 'debt0', 'growth', 'rate0',
    'revenue0', 'spending0', 'revenueDrift', 'spendingDrift', 'rateDrift', 'rateDebtSens', 'stabilizers',
    'aiBoost', 'aiRamp', 'aiStart', 'aiSpendFollow'];
  const PAIRED = ['cutPct', 'revPct', 'cutMultiplier', 'revMultiplier', 'fadeYears'];
  const AI_SCENARIOS = {
    none: { aiBoost: 0, aiRamp: 5, aiStart: 1, note: 'No AI effect beyond what CBO already assumes.' },
    acemoglu: { aiBoost: 0.1, aiRamp: 3, aiStart: 1, note: 'Acemoglu (2024): AI can profitably do about 5% of tasks within ten years, so GDP ends about 1% higher.' },
    pwbm: { aiBoost: 0.2, aiRamp: 6, aiStart: 1, note: 'Penn Wharton (2025): productivity 1.5% higher by 2035, annual boost peaking at 0.2 points in 2032, deficits about $400B lower over ten years.' },
    middle: { aiBoost: 0.5, aiRamp: 5, aiStart: 1, note: 'OECD, IMF, ECB, and Aghion and Bunel cluster between 0.2 and 1.3 points a year over ten years.' },
    goldman: { aiBoost: 1.5, aiRamp: 4, aiStart: 2, note: 'Goldman Sachs (2023): 1.5 points a year of extra productivity growth for a decade once adoption is broad, with the boost starting around 2027.' },
    transformative: { aiBoost: 3, aiRamp: 5, aiStart: 2, note: 'Baily, Brynjolfsson, and Korinek (2023): a sustained lift of several points a year if AI accelerates research and automation.' },
    custom: { note: 'Your own numbers.' }
  };
  const state = Object.assign({}, D);
  let tableView = 'scenario';
  let result = null;
  const OPTIONS = window.POLICY_OPTIONS || [];
  const Analysis = window.Analysis;
  const selected = new Set();

  const $ = (id) => document.getElementById(id);

  // ---------- Formatting ----------
  const fmtT = (x, d) => (x < 0 ? '−' : '') + '$' + Math.abs(x).toFixed(d == null ? 2 : d) + 'T';
  const fmtPct = (x, d) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(d == null ? 1 : d) + '%';
  const fmtSigned = (x, d, unit) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d) + unit;
  const fmtPp = (x, d) => fmtSigned(x, d == null ? 1 : d, ' pp');

  // ---------- Controls ----------
  function readControls() {
    NUMERIC_KEYS.forEach(k => {
      const el = $(k);
      if (!el) return;
      const v = parseFloat(el.value);
      if (!isNaN(v)) state[k] = v;
    });
  }
  function writeControls() {
    NUMERIC_KEYS.forEach(k => {
      const el = $(k);
      if (el) el.value = state[k];
      const n = $(k + '_n');
      if (n) n.value = state[k];
    });
    syncStartYearOptions();
  }
  function syncStartYearOptions() {
    const H = state.horizon;
    ['startYear', 'aiStart'].forEach(key => {
      const sel = $(key);
      const current = state[key];
      sel.innerHTML = '';
      for (let t = 1; t <= H; t++) {
        const o = document.createElement('option');
        o.value = t; o.textContent = 'FY' + (D.baseYear + t);
        sel.appendChild(o);
      }
      state[key] = Math.min(current, H);
      sel.value = state[key];
    });
  }
  function matchAiScenario() {
    for (const k in AI_SCENARIOS) {
      const s = AI_SCENARIOS[k];
      if (k !== 'custom' && s.aiBoost === state.aiBoost && s.aiRamp === state.aiRamp && s.aiStart === state.aiStart) return k;
    }
    return 'custom';
  }
  function syncAiScenario() {
    const k = matchAiScenario();
    $('aiScenario').value = k;
    $('aiNote').textContent = AI_SCENARIOS[k].note;
  }

  function bindControls() {
    NUMERIC_KEYS.forEach(k => {
      const el = $(k);
      if (!el) return;
      el.addEventListener('input', () => {
        const n = $(k + '_n');
        if (n) n.value = el.value;
        onChange();
      });
      el.addEventListener('change', () => {
        clampInput(el);
        const n = $(k + '_n');
        if (n) n.value = el.value;
        onChange();
      });
    });
    PAIRED.forEach(k => {
      const n = $(k + '_n');
      n.addEventListener('input', () => {
        if (n.value === '') return;
        $(k).value = n.value;
        onChange();
      });
      n.addEventListener('change', () => {
        clampInput(n);
        $(k).value = n.value;
        onChange();
      });
    });
    $('horizon').addEventListener('change', () => { readControls(); syncStartYearOptions(); onChange(); });
    $('aiScenario').addEventListener('change', () => {
      const s = AI_SCENARIOS[$('aiScenario').value];
      if (s.aiBoost != null) { state.aiBoost = s.aiBoost; state.aiRamp = s.aiRamp; state.aiStart = s.aiStart; writeControls(); }
      onChange();
    });

    document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
    document.querySelectorAll('.segmented [role="tab"]').forEach(b => b.addEventListener('click', () => {
      tableView = b.dataset.view;
      document.querySelectorAll('.segmented [role="tab"]').forEach(x => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
      renderTable();
    }));
    $('resetBaseline').addEventListener('click', () => {
      ['gdp0', 'debt0', 'growth', 'rate0', 'revenue0', 'spending0', 'revenueDrift', 'spendingDrift', 'rateDrift', 'rateDebtSens', 'stabilizers']
        .forEach(k => { state[k] = D[k]; });
      writeControls();
      onChange();
    });
    $('copyLink').addEventListener('click', copyLink);
    window.addEventListener('resize', debounce(renderCharts, 120));
  }
  function clampInput(el) {
    const min = parseFloat(el.min), max = parseFloat(el.max);
    let v = parseFloat(el.value);
    if (isNaN(v)) v = parseFloat(el.defaultValue) || 0;
    if (!isNaN(min)) v = Math.max(min, v);
    if (!isNaN(max)) v = Math.min(max, v);
    el.value = v;
  }
  function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  // ---------- Policy menu ----------
  const fmtB = x => x >= 1000 ? '$' + (x / 1000).toFixed(1) + 'T' : '$' + Math.round(x) + 'B';
  function buildMenu() {
    const root = $('menuGroups');
    root.innerHTML = '';
    const groups = [];
    OPTIONS.forEach(o => { if (groups.indexOf(o.group) < 0) groups.push(o.group); });
    groups.forEach(g => {
      const opts = OPTIONS.filter(o => o.group === g);
      const det = document.createElement('details'); det.className = 'menu-group'; det.dataset.group = g;
      const sum = document.createElement('summary');
      const name = document.createElement('span'); name.textContent = g;
      const kind = document.createElement('span'); kind.className = 'menu-group-kind'; kind.textContent = opts[0].kind === 'rev' ? 'revenue' : 'cuts';
      name.appendChild(document.createTextNode(' ')); name.appendChild(kind);
      const count = document.createElement('span'); count.className = 'menu-group-count';
      sum.appendChild(name); sum.appendChild(count); det.appendChild(sum);
      const list = document.createElement('div'); list.className = 'menu-list';
      opts.forEach(o => {
        const label = document.createElement('label'); label.className = 'menu-item';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = o.id; cb.checked = selected.has(o.id);
        cb.addEventListener('change', () => { if (cb.checked) selected.add(o.id); else selected.delete(o.id); applyMenu(); });
        const txt = document.createElement('span'); txt.textContent = o.name;
        const amt = document.createElement('span'); amt.className = 'amt'; amt.textContent = fmtB(o.savings);
        label.appendChild(cb); label.appendChild(txt); label.appendChild(amt); list.appendChild(label);
      });
      det.appendChild(list); root.appendChild(det);
    });
    $('menuClear').addEventListener('click', () => { selected.clear(); syncMenuChecks(); applyMenu(); });
  }
  function syncMenuChecks() {
    document.querySelectorAll('.menu-item input').forEach(cb => { cb.checked = selected.has(cb.value); });
  }
  function menuTotals() {
    let cut = 0, rev = 0, cutW = 0, revW = 0;
    OPTIONS.forEach(o => {
      if (!selected.has(o.id)) return;
      if (o.kind === 'cut') { cut += o.savings; cutW += o.savings * o.mult; }
      else { rev += o.savings; revW += o.savings * o.mult; }
    });
    return { cut, rev, cutMult: cut ? cutW / cut : null, revMult: rev ? revW / rev : null };
  }
  // Ten-year savings -> share of GDP, using the sum of baseline GDP over FY2026-2035.
  function tenYearGdp() {
    const b = M.run(Object.assign({}, state, { horizon: 10 })).baseline;
    return b.slice(1, 11).reduce((s, r) => s + r.gdp, 0) * 1000; // $B
  }
  function applyMenu() {
    const t = menuTotals();
    const g = tenYearGdp();
    const r1 = x => Math.round(x * 10) / 10;
    state.cutPct = r1(t.cut / g * 100);
    state.revPct = r1(t.rev / g * 100);
    if (t.cutMult != null) state.cutMultiplier = r1(t.cutMult);
    if (t.revMult != null) state.revMultiplier = r1(t.revMult);
    writeControls();
    onChange();
  }
  function renderMenuSummary() {
    const t = menuTotals();
    const n = selected.size;
    $('menuTotals').textContent = n === 0 ? 'Nothing selected'
      : n + (n === 1 ? ' option' : ' options') + ' · ' + fmtB(t.cut) + ' cuts · ' + fmtB(t.rev) + ' revenue over ten years';
    document.querySelectorAll('.menu-group').forEach(det => {
      const opts = OPTIONS.filter(o => o.group === det.dataset.group);
      const on = opts.filter(o => selected.has(o.id));
      const sum = on.reduce((s, o) => s + o.savings, 0);
      const el = det.querySelector('.menu-group-count');
      el.textContent = on.length ? on.length + ' · ' + fmtB(sum) : opts.length + ' options';
      el.classList.toggle('on', on.length > 0);
    });
  }

  // ---------- Presets ----------
  function applyPreset(name) {
    let cut = 0, rev = 0;
    if (name === 'cuts') cut = 3;
    if (name === 'revenue') rev = 3;
    if (name === 'balanced') { cut = 1.5; rev = 1.5; }
    if (name === 'stabilize') {
      // Smallest half-and-half package that leaves debt/GDP no higher at the end than in the first projected year.
      let lo = 0, hi = 16;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        const r = M.run(Object.assign({}, state, { cutPct: mid / 2, revPct: mid / 2 }));
        const H = r.params.horizon;
        if (r.scenario[H].debtPct <= r.scenario[1].debtPct) hi = mid; else lo = mid;
      }
      cut = Math.round(hi / 2 * 10) / 10; rev = cut;
    }
    selected.clear(); syncMenuChecks();
    state.cutPct = cut; state.revPct = rev;
    writeControls();
    onChange();
  }
  function markPreset() {
    const c = state.cutPct, r = state.revPct;
    let active = null;
    if (c === 0 && r === 0) active = 'nothing';
    else if (c === 3 && r === 0) active = 'cuts';
    else if (c === 0 && r === 3) active = 'revenue';
    else if (c === 1.5 && r === 1.5) active = 'balanced';
    document.querySelectorAll('.preset').forEach(b => b.setAttribute('aria-pressed', b.dataset.preset === active ? 'true' : 'false'));
  }

  // ---------- URL sharing ----------
  function stateToHash() {
    const parts = [];
    NUMERIC_KEYS.forEach(k => { if (state[k] !== D[k]) parts.push(k + '=' + state[k]); });
    if (selected.size) parts.push('opts=' + Array.from(selected).join(','));
    return parts.join('&');
  }
  function hashToState() {
    const h = location.hash.replace(/^#/, '');
    if (!h) return;
    h.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (NUMERIC_KEYS.indexOf(k) >= 0 && !isNaN(parseFloat(v))) state[k] = parseFloat(v);
      if (k === 'opts' && v) v.split(',').forEach(id => { if (OPTIONS.some(o => o.id === id)) selected.add(id); });
    });
  }
  const updateHash = debounce(() => {
    const h = stateToHash();
    history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
  }, 250);
  function copyLink() {
    const url = location.href.split('#')[0] + (stateToHash() ? '#' + stateToHash() : '');
    const note = $('copyNote');
    const done = () => { note.textContent = 'Link copied. It carries every setting on this page.'; setTimeout(() => { note.textContent = ''; }, 4000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => { note.textContent = url; });
    else note.textContent = url;
  }

  // ---------- Main update ----------
  function onChange() {
    readControls();
    result = M.run(state);
    renderNotes();
    renderMenuSummary();
    syncAiScenario();
    renderKpis();
    renderVerdict();
    renderCharts();
    renderTable();
    markPreset();
    updateHash();
    if (analysisShown) $('analysisStatus').textContent = 'Settings changed since this summary was written. Ask again for a fresh one.';
  }

  // ---------- Side-effects summary (Claude) ----------
  // Two transports: the claude.ai artifact viewer's own Claude access, or this
  // server's /api/analyze route. Both send only validated numbers and option ids.
  let analysisShown = false;
  let sampleFn = null;      // artifact viewer transport
  let serverOk = false;     // Replit transport
  let analysisBusy = false;

  function analysisPayload() {
    const params = {};
    NUMERIC_KEYS.forEach(k => { if (state[k] !== D[k]) params[k] = state[k]; });
    return { params, opts: Array.from(selected) };
  }
  async function detectAnalysis() {
    const btn = $('analyzeBtn'), status = $('analysisStatus');
    btn.disabled = true;
    try {
      if (window.claude && typeof window.claude.use === 'function') sampleFn = await window.claude.use('sample');
    } catch (e) { sampleFn = null; }
    if (!sampleFn) {
      try {
        const r = await fetch('api/status', { headers: { 'Accept': 'application/json' } });
        serverOk = r.ok && !!(await r.json()).analysis;
      } catch (e) { serverOk = false; }
    }
    if (sampleFn || serverOk) { btn.disabled = false; status.textContent = ''; }
    else { btn.hidden = true; status.textContent = 'Not available on this host. The server needs an ANTHROPIC_API_KEY to turn this on.'; }
  }
  async function runAnalysis() {
    if (analysisBusy) return;
    const btn = $('analyzeBtn'), status = $('analysisStatus'), body = $('analysisBody');
    analysisBusy = true; btn.disabled = true;
    status.textContent = 'Asking Claude. Usually 20 to 90 seconds.';
    try {
      let analysis = null;
      if (sampleFn) {
        const req = Analysis.buildRequest(result, OPTIONS, Array.from(selected));
        const raw = await sampleFn.json(req.system + '\n\n' + req.user + '\n\n' + req.formatHint, { modelTier: 'default', cache: true });
        analysis = Analysis.validateAnalysis(raw);
        if (!analysis) throw { code: 'bad_shape' };
      } else {
        const headers = { 'Accept': 'application/json', 'X-Requested-With': 'deficit-calculator' };
        const r = await fetch('api/analyze', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
          body: JSON.stringify(analysisPayload())
        });
        let data = await r.json().catch(() => ({}));
        if (!r.ok) throw { code: 'server', message: data.error || ('Request failed (' + r.status + ').') };
        if (r.status === 202 && data.jobId) {
          // The server runs the Claude call in the background; poll until it lands.
          const started = Date.now();
          while (true) {
            await new Promise(res => setTimeout(res, 2500));
            const elapsed = Math.round((Date.now() - started) / 1000);
            status.textContent = 'Asking Claude. ' + elapsed + 's so far. Usually 20 to 90 seconds.';
            if (elapsed > 240) throw { code: 'server', message: 'Claude took too long. Try again.' };
            const p = await fetch('api/analyze/' + data.jobId, { headers });
            data = await p.json().catch(() => ({}));
            if (p.status === 404) throw { code: 'server', message: 'The request expired. Try again.' };
            if (!p.ok) throw { code: 'server', message: data.error || ('Request failed (' + p.status + ').') };
            if (data.status === 'done') break;
          }
        }
        analysis = Analysis.validateAnalysis(data.analysis);
        if (!analysis) throw { code: 'bad_shape' };
      }
      renderAnalysis(analysis);
      body.hidden = false; analysisShown = true;
      status.textContent = '';
    } catch (e) {
      const code = e && e.code;
      if (code === 'not_granted') { btn.hidden = true; status.textContent = 'Claude access was not granted for this page.'; }
      else if (code === 'rate_limited') status.textContent = 'Too many requests right now. Wait a minute and try again.';
      else if (code === 'refused') status.textContent = 'Claude declined to write this one.';
      else if (code === 'cancelled') status.textContent = '';
      else if (code === 'server') status.textContent = e.message;
      else if (code === 'bad_shape' || code === 'invalid_json') status.textContent = 'The answer came back in an unexpected shape. Try again.';
      else status.textContent = 'Could not reach Claude. Try again in a moment.';
    } finally {
      analysisBusy = false;
      if (!btn.hidden) btn.disabled = false;
    }
  }
  // Everything below renders with textContent. No HTML from the model ever reaches the DOM.
  function renderAnalysis(a) {
    const body = $('analysisBody');
    body.innerHTML = '';
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    body.appendChild(el('p', 'analysis-headline', a.headline));

    const effWrap = el('div');
    effWrap.appendChild(el('h3', null, 'Side effects'));
    const ul = el('ul', 'effects');
    a.sideEffects.forEach(s => {
      const li = el('li', 'effect');
      const top = el('div', 'effect-top');
      top.appendChild(el('span', 'chip ' + s.direction, s.direction));
      top.appendChild(el('span', 'effect-area', s.area));
      li.appendChild(top);
      li.appendChild(el('p', null, s.effect));
      li.appendChild(el('p', 'who', 'Who feels it: ' + s.whoFeelsIt));
      ul.appendChild(li);
    });
    effWrap.appendChild(ul);
    body.appendChild(effWrap);

    const cols = el('div', 'analysis-cols');
    [['Trade-offs', a.tradeoffs], ['What to watch', a.watchFor]].forEach(([title, items]) => {
      const c = el('div');
      c.appendChild(el('h3', null, title));
      const l = el('ul');
      items.forEach(t => l.appendChild(el('li', null, t)));
      c.appendChild(l);
      cols.appendChild(c);
    });
    body.appendChild(cols);
    body.appendChild(el('p', 'analysis-foot', 'Written by Claude from this scenario\'s numbers and the selected options. A first read, not a source. Check it against the references below before you quote it.'));
  }

  function renderNotes() {
    const g1 = result.baseline[1].gdp;
    const t = menuTotals();
    $('cutPct_note').textContent = state.cutPct > 0
      ? 'About ' + fmtT(state.cutPct / 100 * g1) + ' a year at FY2026 GDP, out of ' + fmtT(result.baseline[1].spending, 1) + ' of program spending.'
      : 'No spending cuts.';
    if (t.cut > 0) $('cutPct_note').textContent += ' From the menu: ' + fmtB(t.cut) + ' over ten years.';
    $('revPct_note').textContent = state.revPct > 0
      ? 'About ' + fmtT(state.revPct / 100 * g1) + ' a year at FY2026 GDP, on top of ' + fmtT(result.baseline[1].revenue, 1) + ' collected.'
      : 'No revenue increases.';
    if (t.rev > 0) $('revPct_note').textContent += ' From the menu: ' + fmtB(t.rev) + ' over ten years.';
  }

  function renderKpis() {
    const s = result.summary;
    document.querySelectorAll('.end-year').forEach(e => { e.textContent = s.endYear; });
    document.querySelectorAll('.span-years').forEach(e => { e.textContent = (D.baseYear + 1) + '–' + s.endYear; });

    const surplus = s.scenarioDeficitPct < 0;
    $('kpiDeficit').textContent = fmtPct(Math.abs(s.scenarioDeficitPct));
    $('kpiDeficitSub').textContent = (surplus ? 'of GDP surplus' : 'of GDP') + ' · baseline ' + fmtPct(s.baselineDeficitPct) + ' deficit';
    document.querySelector('#kpis .kpi:first-child .gt-label').firstChild.textContent = (surplus ? 'Surplus in ' : 'Deficit in ');

    $('kpiDebt').textContent = Math.round(s.scenarioDebtPct) + '%';
    $('kpiDebtSub').textContent = (s.debtPaidOffYear ? 'paid off in ' + s.debtPaidOffYear : 'of GDP') + ' · baseline ' + Math.round(s.baselineDebtPct) + '%';

    $('kpiSaved').textContent = fmtT(-s.cumulativeDeficitChange, 1);
    $('kpiSavedSub').textContent = Math.abs(s.cumulativeFeedback) >= 0.05
      ? 'cumulative · ' + fmtT(s.cumulativeFeedback, 1) + ' given back to slower growth'
      : Math.abs(s.cumulativeGrowth) >= 0.05 ? 'cumulative · ' + fmtT(-s.cumulativeGrowth, 1) + ' of it from AI growth' : 'cumulative vs baseline';

    const gdpDiff = s.endGdpVsBaseline;
    $('kpiGdp').textContent = fmtSigned(gdpDiff, 1, '%');
    const bits = [];
    if (Math.abs(s.cumulativeGdpLost) >= 0.05) bits.push(fmtT(Math.abs(s.cumulativeGdpLost), 1) + (s.cumulativeGdpLost > 0 ? ' more' : ' less') + ' output over the period');
    if (s.peakDrag > 0.05) bits.push('austerity low point ' + fmtSigned(-s.peakDrag, 1, '%') + ' in ' + s.peakDragYear);
    $('kpiGdpSub').textContent = bits.length ? bits.join(' · ') : 'same as the CBO path';
  }

  function renderVerdict() {
    const s = result.summary, p = result.params;
    const H = p.horizon;
    const sc = result.scenario, bl = result.baseline;
    let text;
    if (p.cutPct === 0 && p.revPct === 0) {
      text = 'No spending or revenue change. On the CBO path the deficit runs ' + fmtPct(bl[H].deficitPct) + ' of GDP in ' + s.endYear +
        ' and debt held by the public reaches ' + Math.round(bl[H].debtPct) + '% of GDP, with net interest at ' + fmtPct(bl[H].interestPct) + ' of GDP.';
    } else {
      const parts = [];
      if (s.debtStabilizedYear) parts.push('Debt-to-GDP stops rising in ' + s.debtStabilizedYear + '.');
      else parts.push('Debt-to-GDP is still rising in ' + s.endYear + '.');
      if (s.balancedYear) parts.push('The budget balances in ' + s.balancedYear + '.');
      if (s.debtPaidOffYear) parts.push('The debt is paid off in ' + s.debtPaidOffYear + ', after which the model stops accumulating surpluses.');
      parts.push((sc[H].deficitPct < 0 ? 'The surplus is ' : 'The deficit is ') + fmtPct(Math.abs(sc[H].deficitPct)) + ' of GDP in ' + s.endYear + ', against a ' + fmtPct(bl[H].deficitPct) + ' deficit on the baseline.');
      if (s.peakDrag > 0.05) {
        const shortfall = s.cumulativeFeedback;
        parts.push('Austerity pushes the economy ' + fmtPct(s.peakDrag) + ' below trend at the low point in ' + s.peakDragYear +
          ', which gives back ' + fmtT(shortfall, 2) + ' of the ' + fmtT(-s.cumulativeDirect, 2) + ' booked in direct savings.');
      }
      text = parts.join(' ');
    }
    if (p.aiBoost > 0) {
      text += ' AI growth leaves GDP ' + fmtPct(s.endAiGain) + ' larger by ' + s.endYear + ' and trims deficits by ' + fmtT(-s.cumulativeGrowth, 2) + ' over the period before interest.';
    }
    $('verdict').textContent = text;
  }

  // ---------- Charts ----------
  function renderCharts() {
    if (!result) return;
    const sc = result.scenario.slice(1), bl = result.baseline.slice(1);
    const years = sc.map(r => r.year);

    lineChart($('chartDebt'), years, [
      { name: 'Baseline', color: COLORS.baseline, values: bl.map(r => r.debtPct), key: 'line' },
      { name: 'Scenario', color: COLORS.scenario, values: sc.map(r => r.debtPct), key: 'line' }
    ], { unit: '%', decimals: 0, zero: false });

    lineChart($('chartDeficit'), years, [
      { name: 'Baseline', color: COLORS.baseline, values: bl.map(r => r.deficitPct), key: 'line' },
      { name: 'Scenario', color: COLORS.scenario, values: sc.map(r => r.deficitPct), key: 'line' }
    ], { unit: '%', decimals: 1, zero: true });

    lineChart($('chartGdp'), years, [
      { name: 'GDP vs baseline', color: COLORS.scenario, values: sc.map((r, i) => (r.gdp / bl[i].gdp - 1) * 100), key: 'line', area: true }
    ], { unit: '%', decimals: 1, zero: true, single: true });

    stackChart($('chartDecomp'), years, [
      { name: 'Direct cuts and revenue', color: COLORS.direct, values: result.decomposition.map(d => d.direct) },
      { name: 'AI growth dividend', color: COLORS.growth, values: result.decomposition.map(d => d.growth) },
      { name: 'Interest', color: COLORS.interest, values: result.decomposition.map(d => d.interest) },
      { name: 'Austerity feedback', color: COLORS.feedback, values: result.decomposition.map(d => d.feedback) }
    ], { unit: 'T', decimals: 2 });
  }

  function niceTicks(lo, hi, count) {
    const span = hi - lo || 1;
    const rough = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return { ticks, lo: start, hi: end };
  }
  function svgEl(tag, attrs) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function textEl(x, y, str, attrs) {
    const t = svgEl('text', Object.assign({ x, y, fill: COLORS.muted, 'font-size': 11 }, attrs || {}));
    t.textContent = str;
    return t;
  }
  function frame(card) {
    const body = card.querySelector('.chart-body');
    body.innerHTML = '';
    const W = Math.max(280, body.clientWidth || 480);
    const H = 240;
    const m = { top: 14, right: 52, bottom: 26, left: 40 };
    const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img' });
    body.appendChild(svg);
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    body.appendChild(tip);
    return { body, svg, tip, W, H, m, pw: W - m.left - m.right, ph: H - m.top - m.bottom };
  }
  function fmtVal(v, o) { return o.unit === 'T' ? fmtT(v, o.decimals) : fmtPct(v, o.decimals); }

  function drawAxes(f, years, ys) {
    const { svg, m, pw, ph } = f;
    ys.ticks.forEach(tv => {
      const y = m.top + ph - (tv - ys.lo) / (ys.hi - ys.lo) * ph;
      svg.appendChild(svgEl('line', { x1: m.left, x2: m.left + pw, y1: y, y2: y, stroke: tv === 0 ? COLORS.axis : COLORS.grid, 'stroke-width': 1 }));
      svg.appendChild(textEl(m.left - 8, y + 4, Math.round(tv * 100) / 100, { 'text-anchor': 'end' }));
    });
    const n = years.length;
    const step = n > 12 ? Math.ceil(n / 8) : n > 6 ? 2 : 1;
    let idx = years.map((_, i) => i).filter(i => i % step === 0);
    if (idx.indexOf(n - 1) < 0) { idx = idx.filter(i => n - 1 - i >= step); idx.push(n - 1); }
    years.forEach((yr, i) => {
      if (idx.indexOf(i) < 0) return;
      const x = f.xOf(i);
      svg.appendChild(textEl(x, m.top + ph + 18, yr, { 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }));
    });
  }

  function legend(card, series, shape) {
    const lg = card.querySelector('.legend');
    lg.innerHTML = '';
    series.forEach(s => {
      const item = document.createElement('span'); item.className = 'legend-item';
      const key = document.createElement('span'); key.className = 'legend-key' + (shape === 'swatch' ? ' swatch' : ''); key.style.background = s.color;
      const name = document.createElement('span'); name.textContent = s.name;
      item.appendChild(key); item.appendChild(name); lg.appendChild(item);
    });
  }

  function tooltipRows(tip, year, rows, shape) {
    tip.innerHTML = '';
    const y = document.createElement('p'); y.className = 'tooltip-year'; y.textContent = 'FY' + year; tip.appendChild(y);
    rows.forEach(r => {
      const row = document.createElement('div'); row.className = 'tooltip-row';
      const name = document.createElement('span'); name.className = 'tooltip-name';
      const key = document.createElement('span'); key.className = 'tooltip-key' + (shape === 'swatch' ? ' swatch' : ''); key.style.background = r.color;
      const nm = document.createElement('span'); nm.textContent = r.name;
      name.appendChild(key); name.appendChild(nm);
      const val = document.createElement('span'); val.className = 'tooltip-val'; val.textContent = r.value;
      row.appendChild(name); row.appendChild(val); tip.appendChild(row);
    });
  }
  function placeTip(f, x) {
    const tip = f.tip;
    tip.classList.add('on');
    const tw = tip.offsetWidth || 160;
    let left = x + 14;
    if (left + tw > f.W - 4) left = x - tw - 14;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = f.m.top + 'px';
  }

  function lineChart(card, years, series, o) {
    const f = frame(card);
    const { svg, m, pw, ph } = f;
    const n = years.length;
    const all = series.flatMap(s => s.values);
    let lo = Math.min(...all), hi = Math.max(...all);
    if (o.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (hi - lo < 1e-9) { hi = lo + 1; }
    const pad = (hi - lo) * 0.08;
    const ys = niceTicks(o.zero && lo >= 0 ? 0 : lo - pad, hi + pad, 4);
    f.xOf = (i) => m.left + (n === 1 ? pw / 2 : i / (n - 1) * pw);
    const yOf = (v) => m.top + ph - (v - ys.lo) / (ys.hi - ys.lo) * ph;
    drawAxes(f, years, ys);

    series.forEach(s => {
      const pts = s.values.map((v, i) => [f.xOf(i), yOf(v)]);
      if (s.area) {
        const y0 = yOf(0);
        const d = 'M' + pts[0][0] + ',' + y0 + ' ' + pts.map(p => 'L' + p[0] + ',' + p[1]).join(' ') + ' L' + pts[n - 1][0] + ',' + y0 + ' Z';
        svg.appendChild(svgEl('path', { d, fill: s.color, 'fill-opacity': 0.12, stroke: 'none' }));
      }
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ');
      svg.appendChild(svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      const end = pts[n - 1];
      svg.appendChild(svgEl('circle', { cx: end[0], cy: end[1], r: 6, fill: COLORS.surface }));
      svg.appendChild(svgEl('circle', { cx: end[0], cy: end[1], r: 4, fill: s.color }));
      s.endY = end[1];
    });
    // End labels: skip the baseline label when it would collide with the scenario label.
    const labelled = series.slice().sort((a, b) => a.endY - b.endY);
    let lastY = -Infinity;
    labelled.forEach(s => {
      const collides = Math.abs(s.endY - lastY) < 14;
      if (collides && s.name === 'Baseline') return;
      svg.appendChild(textEl(m.left + pw + 10, s.endY + 4, fmtVal(s.values[n - 1], o), { fill: COLORS.ink, 'font-size': 12, 'font-weight': 500 }));
      lastY = s.endY;
    });

    // Hover layer: crosshair snaps to nearest year, tooltip lists every series.
    const cross = svgEl('line', { x1: 0, x2: 0, y1: m.top, y2: m.top + ph, stroke: COLORS.muted, 'stroke-width': 1, opacity: 0 });
    svg.appendChild(cross);
    const dots = series.map(s => { const c = svgEl('circle', { r: 4, fill: s.color, stroke: COLORS.surface, 'stroke-width': 2, opacity: 0 }); svg.appendChild(c); return c; });
    const hit = svgEl('rect', { x: m.left - 10, y: m.top, width: pw + 20, height: ph, fill: 'transparent' });
    svg.appendChild(hit);
    const show = (clientX) => {
      const rect = svg.getBoundingClientRect();
      const px = (clientX - rect.left) * (f.W / rect.width);
      const i = Math.max(0, Math.min(n - 1, Math.round((px - m.left) / (pw / Math.max(1, n - 1)))));
      const x = f.xOf(i);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('opacity', 1);
      series.forEach((s, k) => { dots[k].setAttribute('cx', x); dots[k].setAttribute('cy', yOf(s.values[i])); dots[k].setAttribute('opacity', 1); });
      tooltipRows(f.tip, years[i], series.slice().reverse().map(s => ({ name: s.name, color: s.color, value: fmtVal(s.values[i], o) })), 'line');
      placeTip(f, x * (rect.width / f.W));
    };
    const hide = () => { cross.setAttribute('opacity', 0); dots.forEach(d => d.setAttribute('opacity', 0)); f.tip.classList.remove('on'); };
    hit.addEventListener('pointermove', e => show(e.clientX));
    hit.addEventListener('pointerleave', hide);
    legend(card, o.single ? [] : series, 'line');
    svg.setAttribute('aria-label', card.querySelector('.chart-title').textContent + ', ' + years[0] + ' to ' + years[n - 1] + '. Values are in the table below.');
  }

  function stackChart(card, years, series, o) {
    const f = frame(card);
    const { svg, m, pw, ph } = f;
    const n = years.length;
    const pos = years.map((_, i) => series.reduce((a, s) => a + Math.max(0, s.values[i]), 0));
    const neg = years.map((_, i) => series.reduce((a, s) => a + Math.min(0, s.values[i]), 0));
    let hi = Math.max(0, ...pos), lo = Math.min(0, ...neg);
    if (hi - lo < 1e-9) { hi = 0.5; lo = -0.5; }
    const ys = niceTicks(lo - (hi - lo) * 0.05, hi + (hi - lo) * 0.05, 4);
    const band = pw / n;
    const bw = Math.min(24, band * 0.6);
    f.xOf = (i) => m.left + band * (i + 0.5);
    const yOf = (v) => m.top + ph - (v - ys.lo) / (ys.hi - ys.lo) * ph;
    drawAxes(f, years, ys);
    const y0 = yOf(0);
    svg.appendChild(svgEl('line', { x1: m.left, x2: m.left + pw, y1: y0, y2: y0, stroke: COLORS.axis, 'stroke-width': 1 }));

    const GAP = 2;
    years.forEach((yr, i) => {
      let upTop = 0, downTop = 0;
      const x = f.xOf(i) - bw / 2;
      series.forEach(s => {
        const v = s.values[i];
        if (Math.abs(v) < 1e-9) return;
        let y1, y2;
        if (v > 0) { y2 = yOf(upTop); upTop += v; y1 = yOf(upTop); }
        else { y1 = yOf(downTop); downTop += v; y2 = yOf(downTop); }
        const h = Math.max(0, y2 - y1 - GAP);
        svg.appendChild(svgEl('rect', { x, y: v > 0 ? y1 + (h > 0 ? 0 : 0) : y1 + GAP, width: bw, height: h, fill: s.color }));
      });
    });

    // Hover: the year band is the hit target.
    const hl = svgEl('rect', { x: 0, y: m.top, width: band, height: ph, fill: COLORS.ink, opacity: 0 });
    svg.insertBefore(hl, svg.firstChild.nextSibling);
    const hit = svgEl('rect', { x: m.left, y: m.top, width: pw, height: ph, fill: 'transparent' });
    svg.appendChild(hit);
    hit.addEventListener('pointermove', e => {
      const rect = svg.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (f.W / rect.width);
      const i = Math.max(0, Math.min(n - 1, Math.floor((px - m.left) / band)));
      hl.setAttribute('x', m.left + band * i); hl.setAttribute('opacity', 0.06);
      const rows = series.map(s => ({ name: s.name, color: s.color, value: fmtVal(s.values[i], o) }));
      rows.push({ name: 'Total change', color: 'transparent', value: fmtVal(series.reduce((a, s) => a + s.values[i], 0), o) });
      tooltipRows(f.tip, years[i], rows, 'swatch');
      placeTip(f, f.xOf(i) * (rect.width / f.W));
    });
    hit.addEventListener('pointerleave', () => { hl.setAttribute('opacity', 0); f.tip.classList.remove('on'); });
    legend(card, series, 'swatch');
    svg.setAttribute('aria-label', card.querySelector('.chart-title').textContent + ', ' + years[0] + ' to ' + years[n - 1] + '. Values are in the table below.');
  }

  // ---------- Table ----------
  function renderTable() {
    const tbody = $('yearTable').querySelector('tbody');
    tbody.innerHTML = '';
    const rows = tableView === 'baseline' ? result.baseline : result.scenario;
    const isDiff = tableView === 'diff';
    rows.forEach((r, t) => {
      const tr = document.createElement('tr');
      if (t === 0) tr.className = 'actual';
      const b = result.baseline[t];
      const cells = [];
      cells.push(['FY' + r.year + (t === 0 ? ' actual' : ''), false]);
      if (t === 0) {
        cells.push([fmtT(r.gdp, 1), true], ['$5.24T', true], ['$6.01T', true], ['$1.00T', true], ['$1.78T', true], [fmtPct(1.775 / r.gdp * 100), true], [fmtT(r.debt, 1), true], [fmtPct(r.debtPct, 0), true], ['—', true]);
      } else if (isDiff) {
        const s = result.scenario[t];
        cells.push(
          [fmtSigned(s.gdp - b.gdp, 2, 'T'), true], [fmtSigned(s.revenue - b.revenue, 2, 'T'), true],
          [fmtSigned(s.spending - b.spending, 2, 'T'), true], [fmtSigned(s.interest - b.interest, 2, 'T'), true],
          [fmtSigned(s.deficit - b.deficit, 2, 'T'), true], [fmtPp(s.deficitPct - b.deficitPct), true],
          [fmtSigned(s.debt - b.debt, 2, 'T'), true], [fmtPp(s.debtPct - b.debtPct), true],
          [fmtSigned((s.gdp / b.gdp - 1) * 100, 1, '%'), true]);
      } else {
        cells.push(
          [fmtT(r.gdp, 1), true], [fmtT(r.revenue), true], [fmtT(r.spending), true], [fmtT(r.interest), true],
          [fmtT(r.deficit), true], [fmtPct(r.deficitPct), true], [fmtT(r.debt, 1), true], [fmtPct(r.debtPct, 0), true],
          [tableView === 'baseline' ? '0.0%' : fmtSigned((r.gdp / b.gdp - 1) * 100, 1, '%'), true]);
      }
      cells.forEach(c => { const td = document.createElement('td'); if (c[1]) td.className = 'num'; td.textContent = c[0]; tr.appendChild(td); });
      tbody.appendChild(tr);
    });
  }

  // ---------- Init ----------
  hashToState();
  buildMenu();
  writeControls();
  bindControls();
  $('analyzeBtn').addEventListener('click', runAnalysis);
  detectAnalysis();
  if (selected.size && !/(^|[#&])(cutPct|revPct)=/.test(location.hash)) applyMenu(); else onChange();
})();
