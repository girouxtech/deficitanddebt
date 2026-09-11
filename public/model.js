/*
 * Deficit and Debt Calculator — fiscal model
 * Giroux Technologies · girouxtech.com
 *
 * Plain JavaScript, no dependencies. Works in the browser (window.FiscalModel)
 * and in Node (module.exports) so the same math can be checked from the CLI.
 *
 * Units: dollars in trillions, shares in percent of GDP, rates in percent.
 * Year index t = 0 is the last actual fiscal year (FY2025). Years 1..H are projected.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FiscalModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Starting point: FY2025 actuals (Treasury Final Monthly Statement, Sept 2025)
  // and CBO's February 2026 baseline for the path assumptions.
  const DEFAULTS = {
    baseYear: 2025,
    horizon: 10,            // projected years
    gdp0: 30.3,             // nominal GDP, FY2025, $T
    debt0: 30.2,            // debt held by the public, end of FY2025, $T
    growth: 3.9,            // nominal GDP growth, % per year (CBO: ~1.8 real + ~2.1 inflation)
    revenue0: 17.7,         // revenues, % of GDP, first projected year
    revenueDrift: 0.01,     // change in revenue share, pp per year
    spending0: 20.2,        // non-interest ("primary") outlays, % of GDP, first projected year
    spendingDrift: -0.03,   // change in primary spending share, pp per year
    rate0: 3.44,            // effective interest rate on debt held by the public, %
    rateDrift: 0.05,        // pp per year as low-rate debt rolls over at today's yields
    rateDebtSens: 0,        // bp added to the rate per 1 pp of debt/GDP above the starting ratio (CBO uses ~2-3)
    stabilizers: 0.15,      // extra deficit (% of GDP) per 1% GDP shortfall, beyond proportional revenue loss

    // Policy levers
    cutPct: 0,              // spending cuts at full phase-in, % of GDP
    cutPhase: 3,            // years to phase in the cuts
    revPct: 0,              // revenue increases at full phase-in, % of GDP
    revPhase: 3,            // years to phase in the revenue increases
    startYear: 1,           // first projected year the policy starts (1 = FY2026)
    cutMultiplier: 1.0,     // GDP lost per dollar of spending cut, in the year it lands
    revMultiplier: 0.5,     // GDP lost per dollar of tax increase, in the year it lands
    fadeYears: 4,           // years for a given year's GDP hit to fade to zero (0 = never fades)

    // Growth scenario (applied to the scenario, not the baseline)
    aiBoost: 0,             // extra real GDP growth from AI at full effect, pp per year
    aiRamp: 5,              // years to reach the full boost
    aiStart: 1,             // first projected year the boost begins (1 = FY2026)
    aiSpendFollow: 0.1      // share of the extra GDP that program spending follows (CBO's rule of thumb implies a small share over ten years)
  };

  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

  // Phase-in schedule: share of the full policy in effect in projected year t.
  function phase(t, start, years) {
    if (t < start) return 0;
    const k = t - start + 1;
    return years <= 0 ? 1 : clamp(k / years, 0, 1);
  }

  // Fade factor for a hit that landed d years ago.
  function fade(d, fadeYears) {
    if (fadeYears <= 0) return 1;            // permanent
    return clamp(1 - d / fadeYears, 0, 1);
  }

  /**
   * Run one projection. `policy` is true for the scenario, false for the baseline.
   * Returns an array of yearly rows (index 0 = base year actuals, no policy).
   */
  function project(p, policy, ai) {
    const H = p.horizon;
    const rows = [];
    let debt = p.debt0;
    let gdpPrev = p.gdp0;
    const ratio0 = p.debt0 / p.gdp0 * 100;
    let ratioPrev = ratio0;

    // Base-year row (actuals, for context in tables)
    rows.push({
      t: 0, year: p.baseYear, gdp: p.gdp0, potential: p.gdp0, drag: 0,
      revenue: NaN, spending: NaN, interest: NaN, deficit: NaN,
      deficitPct: NaN, debt: p.debt0, debtPct: ratio0, rate: NaN,
      cutShare: 0, revShare: 0, aiGain: 0
    });

    const cutSched = [], revSched = [];
    for (let t = 1; t <= H; t++) {
      cutSched[t] = policy ? p.cutPct * phase(t, p.startYear, p.cutPhase) : 0;
      revSched[t] = policy ? p.revPct * phase(t, p.startYear, p.revPhase) : 0;
    }

    let potential = p.gdp0, potentialNoAI = p.gdp0;
    for (let t = 1; t <= H; t++) {
      const boost = ai ? p.aiBoost * phase(t, p.aiStart, p.aiRamp) : 0;
      potentialNoAI *= 1 + p.growth / 100;
      potential *= 1 + (p.growth + boost) / 100;

      // GDP drag: each year's new consolidation lands with its multiplier, then fades.
      let drag = 0;
      for (let k = 1; k <= t; k++) {
        const dCut = cutSched[k] - (cutSched[k - 1] || 0);
        const dRev = revSched[k] - (revSched[k - 1] || 0);
        drag += (p.cutMultiplier * dCut + p.revMultiplier * dRev) * fade(t - k, p.fadeYears);
      }
      drag = clamp(drag, -50, 50);
      const gdp = potential * (1 - drag / 100);

      const revShare = p.revenue0 + p.revenueDrift * (t - 1) + revSched[t];
      const spendShare = p.spending0 + p.spendingDrift * (t - 1) - cutSched[t];

      // Revenue follows actual GDP (so a smaller economy collects less).
      // Program spending is set in dollars against the planned (potential) economy,
      // plus automatic stabilizers when GDP falls short.
      const revenue = revShare / 100 * gdp;
      // Program spending is planned against the no-AI economy; only a share follows the AI upside.
      const spendBase = potentialNoAI + p.aiSpendFollow * (potential - potentialNoAI);
      const spending = spendShare / 100 * spendBase + p.stabilizers / 100 * drag / 100 * potential;

      const rate = p.rate0 + p.rateDrift * (t - 1) + p.rateDebtSens / 100 * (ratioPrev - ratio0);
      const interest = rate / 100 * debt;

      const deficit = spending + interest - revenue;
      debt = debt + deficit;
      const debtPct = debt / gdp * 100;

      rows.push({
        t, year: p.baseYear + t, gdp, potential, drag,
        revenue, spending, interest, deficit,
        deficitPct: deficit / gdp * 100, debt, debtPct, rate,
        cutShare: cutSched[t], revShare: revSched[t], aiGain: (potential / potentialNoAI - 1) * 100,
        revenuePct: revenue / gdp * 100, spendingPct: spending / gdp * 100,
        interestPct: interest / gdp * 100
      });
      gdpPrev = gdp;
      ratioPrev = debtPct;
    }
    return rows;
  }

  /** Run baseline and scenario, plus a decomposition of the deficit change. */
  function run(overrides) {
    const p = Object.assign({}, DEFAULTS, overrides || {});
    p.horizon = clamp(Math.round(p.horizon), 1, 40);
    const baseline = project(p, false, false);
    const scenario = project(p, true, true);
    const growthOnly = project(p, false, true);

    // Decompose each year's deficit change vs baseline into:
    //  direct   = cuts + new revenue measured on the baseline economy (what the policy "books")
    //  growth   = smaller primary deficit because AI makes the economy bigger
    //  feedback = revenue lost + stabilizer spending because austerity shrinks GDP
    //  interest = change in interest cost because debt is different
    const decomposition = [];
    for (let t = 1; t <= p.horizon; t++) {
      const b = baseline[t], s = scenario[t], g = growthOnly[t];
      const direct = -(s.cutShare + s.revShare) / 100 * b.potential;
      const growth = (g.deficit - b.deficit) - (g.interest - b.interest);
      const interest = s.interest - b.interest;
      const total = s.deficit - b.deficit;
      const feedback = total - direct - growth - interest;
      decomposition.push({ year: s.year, direct, growth, feedback, interest, total });
    }

    const H = p.horizon;
    const sum = (rows, k) => rows.slice(1).reduce((a, r) => a + r[k], 0);
    const summary = {
      endYear: baseline[H].year,
      baselineDeficitPct: baseline[H].deficitPct,
      scenarioDeficitPct: scenario[H].deficitPct,
      baselineDebtPct: baseline[H].debtPct,
      scenarioDebtPct: scenario[H].debtPct,
      cumulativeDeficitChange: sum(scenario, 'deficit') - sum(baseline, 'deficit'),
      cumulativeGdpLost: sum(scenario, 'gdp') - sum(baseline, 'gdp'),
      peakDrag: Math.max(0, ...scenario.slice(1).map(r => r.drag)),
      peakDragYear: scenario.slice(1).reduce((best, r) => (r.drag > best.drag ? r : best), scenario[1]).year,
      cumulativeDirect: decomposition.reduce((a, d) => a + d.direct, 0),
      cumulativeFeedback: decomposition.reduce((a, d) => a + d.feedback, 0),
      cumulativeInterest: decomposition.reduce((a, d) => a + d.interest, 0),
      cumulativeGrowth: decomposition.reduce((a, d) => a + d.growth, 0),
      endGdpVsBaseline: (scenario[H].gdp / baseline[H].gdp - 1) * 100,
      endAiGain: scenario[H].aiGain,
      balancedYear: (scenario.slice(1).find(r => r.deficit <= 0) || {}).year || null,
      debtStabilizedYear: (function () {
        for (let t = 2; t <= H; t++) if (scenario[t].debtPct <= scenario[t - 1].debtPct) return scenario[t].year;
        return null;
      })()
    };
    return { params: p, baseline, scenario, growthOnly, decomposition, summary };
  }

  return { DEFAULTS, run, project };
});
