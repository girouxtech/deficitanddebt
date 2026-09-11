/* Deficit and Debt Calculator · Giroux Technologies
   Policy menu. Ten-year savings in billions of dollars, FY2026–2035 window.
   Source: CBO, Options for Reducing the Deficit: 2025 to 2034 (December 2024), with
   CRFB's re-estimates for the 2026–2035 window; Social Security options from CBO's
   solvency options as summarized by CRFB. Each option is scored on its own; CBO warns
   that overlapping options do not add cleanly.

   mult = short-run GDP lost per dollar, set near the lower-middle of CBO's published
   ranges because the economy is near potential:
     purchases 1.0 · grants to states 0.8 · broad transfers 0.7 · low-income transfers 1.0
     broad taxes 0.6 · high-income taxes 0.3 · corporate taxes 0.2 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.POLICY_OPTIONS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
return [
  // ---------- Revenue ----------
  { id: 'r1',  group: 'Income tax rates', kind: 'rev', savings: 1200, mult: 0.6, name: 'Raise every individual income tax rate by 1 point' },
  { id: 'r2',  group: 'Income tax rates', kind: 'rev', savings: 300,  mult: 0.3, name: 'Raise the top four brackets by 1 point' },
  { id: 'r3',  group: 'Income tax rates', kind: 'rev', savings: 560,  mult: 0.3, name: 'Add a 1% surtax on income above $100,000 ($200,000 joint)' },
  { id: 'r4',  group: 'Income tax rates', kind: 'rev', savings: 560,  mult: 0.2, name: 'Raise the corporate rate from 21% to 25%' },
  { id: 'r5',  group: 'Income tax rates', kind: 'rev', savings: 110,  mult: 0.3, name: 'Raise capital gains and dividend rates by 2 points' },
  { id: 'r6',  group: 'Income tax rates', kind: 'rev', savings: 570,  mult: 0.3, name: 'Tax capital gains at death' },
  { id: 'r7',  group: 'Income tax rates', kind: 'rev', savings: 440,  mult: 0.3, name: 'Extend the net investment income tax to pass-through business income' },
  { id: 'r8',  group: 'Income tax rates', kind: 'rev', savings: 15,   mult: 0.3, name: 'Tax carried interest as ordinary income' },

  { id: 'r9',  group: 'Tax breaks', kind: 'rev', savings: 3700, mult: 0.3, name: 'Eliminate all itemized deductions' },
  { id: 'r10', group: 'Tax breaks', kind: 'rev', savings: 2000, mult: 0.3, name: 'Convert itemized deductions to a 15% credit' },
  { id: 'r11', group: 'Tax breaks', kind: 'rev', savings: 1200, mult: 0.6, name: 'Cap the employer health insurance exclusion at the median premium' },
  { id: 'r12', group: 'Tax breaks', kind: 'rev', savings: 630,  mult: 0.6, name: 'Cap the employer health insurance exclusion at the 75th percentile' },
  { id: 'r13', group: 'Tax breaks', kind: 'rev', savings: 345,  mult: 0.2, name: 'Tax foreign income of US corporations at the full rate' },
  { id: 'r14', group: 'Tax breaks', kind: 'rev', savings: 215,  mult: 0.6, name: 'Eliminate head-of-household filing status' },
  { id: 'r15', group: 'Tax breaks', kind: 'rev', savings: 195,  mult: 0.3, name: 'Lower 401(k) and IRA contribution limits' },
  { id: 'r16', group: 'Tax breaks', kind: 'rev', savings: 130,  mult: 0.6, name: 'Eliminate higher-education tax credits' },

  { id: 'r17', group: 'New taxes', kind: 'rev', savings: 3500, mult: 0.6, name: '5% value-added tax on a broad base' },
  { id: 'r18', group: 'New taxes', kind: 'rev', savings: 2300, mult: 0.6, name: '5% value-added tax on a narrow base' },
  { id: 'r19', group: 'New taxes', kind: 'rev', savings: 1300, mult: 0.6, name: 'New 1% payroll tax on all earnings' },
  { id: 'r20', group: 'New taxes', kind: 'rev', savings: 960,  mult: 0.6, name: 'Carbon tax at $25 per ton, rising 5% a year' },
  { id: 'r21', group: 'New taxes', kind: 'rev', savings: 340,  mult: 0.3, name: '0.01% financial transaction tax' },
  { id: 'r22', group: 'New taxes', kind: 'rev', savings: 215,  mult: 0.6, name: 'Raise motor fuel taxes and index them to inflation' },
  { id: 'r23', group: 'New taxes', kind: 'rev', savings: 105,  mult: 0.6, name: 'Raise and standardize alcohol taxes' },
  { id: 'r24', group: 'New taxes', kind: 'rev', savings: 50,   mult: 0.6, name: 'Raise tobacco taxes by 50%' },

  { id: 'r25', group: 'Social Security and Medicare taxes', kind: 'rev', savings: 1600, mult: 0.3, name: 'Apply the Social Security payroll tax to wages above $250,000' },
  { id: 'r26', group: 'Social Security and Medicare taxes', kind: 'rev', savings: 800,  mult: 0.3, name: 'Raise the taxable maximum to cover 90% of wages' },
  { id: 'r27', group: 'Social Security and Medicare taxes', kind: 'rev', savings: 675,  mult: 0.6, name: 'Raise the Medicare payroll tax by 0.5 point' },
  { id: 'r28', group: 'Social Security and Medicare taxes', kind: 'rev', savings: 180,  mult: 0.6, name: 'Bring newly hired state and local workers into Social Security' },

  // ---------- Spending ----------
  { id: 's1',  group: 'Medicare', kind: 'cut', savings: 615, mult: 0.7, name: 'Cut Medicare Advantage benchmarks by 10%' },
  { id: 's2',  group: 'Medicare', kind: 'cut', savings: 200, mult: 0.7, name: 'Raise the Medicare Advantage coding-intensity adjustment to 8%' },
  { id: 's3',  group: 'Medicare', kind: 'cut', savings: 180, mult: 1.0, name: 'Pay the same rate for most services regardless of site of care' },
  { id: 's4',  group: 'Medicare', kind: 'cut', savings: 610, mult: 0.7, name: 'Raise Part B premiums from 25% to 35% of program costs' },
  { id: 's5',  group: 'Medicare', kind: 'cut', savings: 165, mult: 0.7, name: 'Restrict first-dollar Medigap coverage' },
  { id: 's6',  group: 'Medicare', kind: 'cut', savings: 110, mult: 1.0, name: 'Reform graduate medical education payments' },

  { id: 's7',  group: 'Medicaid', kind: 'cut', savings: 1100, mult: 1.0, name: 'Cap federal Medicaid spending per enrollee, growing with inflation' },
  { id: 's8',  group: 'Medicaid', kind: 'cut', savings: 720,  mult: 0.8, name: 'End provider-tax financing schemes' },
  { id: 's9',  group: 'Medicaid', kind: 'cut', savings: 650,  mult: 1.0, name: 'Pay the regular match rate for the ACA expansion population' },
  { id: 's10', group: 'Medicaid', kind: 'cut', savings: 140,  mult: 1.0, name: 'Require work for certain adult enrollees' },

  { id: 's11', group: 'Social Security benefits', kind: 'cut', savings: 150, mult: 0.7, name: 'Raise the full retirement age two months a year until it reaches 70' },
  { id: 's12', group: 'Social Security benefits', kind: 'cut', savings: 260, mult: 0.7, name: 'Use chained CPI for cost-of-living adjustments' },
  { id: 's13', group: 'Social Security benefits', kind: 'cut', savings: 280, mult: 0.5, name: 'Reduce benefits for the top half of earners, phased in by 2030' },
  { id: 's14', group: 'Social Security benefits', kind: 'cut', savings: 820, mult: 0.7, name: 'Replace the benefit formula with a flat benefit at 125% of poverty' },

  { id: 's15', group: 'Other mandatory programs', kind: 'cut', savings: 440, mult: 0.7, name: 'Means-test VA disability compensation' },
  { id: 's16', group: 'Other mandatory programs', kind: 'cut', savings: 90,  mult: 0.8, name: 'Use chained CPI to index other mandatory programs' },
  { id: 's17', group: 'Other mandatory programs', kind: 'cut', savings: 50,  mult: 0.7, name: 'Cut federal crop insurance subsidies' },
  { id: 's18', group: 'Other mandatory programs', kind: 'cut', savings: 50,  mult: 1.0, name: 'End the mandatory add-on to Pell Grants' },
  { id: 's19', group: 'Other mandatory programs', kind: 'cut', savings: 40,  mult: 0.7, name: 'Raise employee contributions to federal retirement' },
  { id: 's20', group: 'Other mandatory programs', kind: 'cut', savings: 35,  mult: 0.7, name: 'Add out-of-pocket minimums to TRICARE for Life' },
  { id: 's21', group: 'Other mandatory programs', kind: 'cut', savings: 15,  mult: 1.0, name: 'End school meal subsidies above 185% of poverty' },

  { id: 's22', group: 'Defense', kind: 'cut', savings: 1145, mult: 1.0, name: 'Cut active-duty military personnel 17% by 2034' },
  { id: 's23', group: 'Defense', kind: 'cut', savings: 959,  mult: 1.0, name: 'Cut the Defense budget about 10% and hold it there' },
  { id: 's24', group: 'Defense', kind: 'cut', savings: 30,   mult: 1.0, name: 'Retire the F-22 fleet' },
  { id: 's25', group: 'Defense', kind: 'cut', savings: 20,   mult: 1.0, name: 'Stop building Ford-class carriers after 2030' },
  { id: 's26', group: 'Defense', kind: 'cut', savings: 20,   mult: 0.7, name: 'Trim military pay raises by 0.5 point a year through 2030' },
  { id: 's27', group: 'Defense', kind: 'cut', savings: 15,   mult: 1.0, name: 'Cancel the nuclear long-range standoff weapon' },

  { id: 's28', group: 'Nondefense discretionary', kind: 'cut', savings: 390, mult: 0.8, name: 'Cut transportation and education grants to states by one-third' },
  { id: 's29', group: 'Nondefense discretionary', kind: 'cut', savings: 215, mult: 0.5, name: 'Cut international affairs programs by 25%' },
  { id: 's30', group: 'Nondefense discretionary', kind: 'cut', savings: 75,  mult: 0.7, name: 'Trim civilian federal pay raises by 0.5 point a year' },
  { id: 's31', group: 'Nondefense discretionary', kind: 'cut', savings: 45,  mult: 0.7, name: 'Move federal employee health benefits to a voucher' },
  { id: 's32', group: 'Nondefense discretionary', kind: 'cut', savings: 35,  mult: 0.7, name: 'End VA medical enrollment for priority groups 7 and 8' },
  { id: 's33', group: 'Nondefense discretionary', kind: 'cut', savings: 35,  mult: 1.0, name: 'Restrict Pell Grants to students eligible for the full award' },
  { id: 's34', group: 'Nondefense discretionary', kind: 'cut', savings: 25,  mult: 0.8, name: 'Cut Community Development Block Grants in half' },
  { id: 's35', group: 'Nondefense discretionary', kind: 'cut', savings: 20,  mult: 1.0, name: 'Cut EPA water infrastructure grants in half' },
  { id: 's36', group: 'Nondefense discretionary', kind: 'cut', savings: 20,  mult: 1.0, name: 'Repeal Davis-Bacon prevailing-wage rules' },
  { id: 's37', group: 'Nondefense discretionary', kind: 'cut', savings: 10,  mult: 0.8, name: 'End federal funding for AmeriCorps' }
];
});
