const hour = 60 * 60 * 1000;
export const config = {
  offerWindow: 4 * hour,
  buyWindow: 24 * hour,
  escalationWindow: 24 * hour,
  historyWindow: 60 * 24 * hour,
  // Caps prevent one volunteer carrying too much cost while waiting for HR.
  offices: {
    oslo: {
      name: "Oslo",
      currency: "NOK",
      timezone: "Europe/Oslo",
      monthlyBudget: 600_000,
      refillCap: 120_000,
      exposureCap: 300_000,
    },
    bengaluru: {
      name: "Bengaluru",
      currency: "INR",
      timezone: "Asia/Kolkata",
      monthlyBudget: 1_500_000,
      refillCap: 300_000,
      exposureCap: 750_000,
    },
  },
  // Illustrative fixed rate, not a live market quote; used only in reports.
  fxRate: { from: "INR", to: "NOK", numerator: 1, denominator: 8 },
};
