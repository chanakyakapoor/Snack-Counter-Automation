import { monthOf, spentStates } from "./budget.js";
import { money, add, convert } from "./money.js";

export function createReportService({ store, config }) {
  async function monthlyReport(month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      throw new TypeError("Expected YYYY-MM");
    const refills = await store.listRefills(),
      perOffice = {},
      quantities = new Map();
    const fxRate = structuredClone(config.fxRate);
    let combined = money(0, "NOK");
    for (const [officeId, office] of Object.entries(config.offices)) {
      const purchases = refills.filter(
        (r) =>
          r.officeId === officeId &&
          r.purchase &&
          monthOf(r.purchase.purchasedAt, office.timezone) === month,
      );
      const counted = purchases.filter((r) => spentStates.has(r.state));
      const total = counted.reduce(
        (sum, r) =>
          add(sum, money(r.purchase.amountMinor, r.purchase.currency)),
        money(0, office.currency),
      );
      perOffice[officeId] = {
        totalMinor: total.amountMinor,
        currency: office.currency,
        refillCount: counted.length,
        pendingApprovalMinor: purchases
          .filter((r) => r.state === "NEEDS_APPROVAL")
          .reduce((sum, r) => sum + r.purchase.amountMinor, 0),
      };
      combined = add(
        combined,
        total.currency === "NOK" ? total : convert(total, "NOK", fxRate),
      );
      for (const refill of counted)
        for (const item of refill.purchase.items) {
          const name = item.name.trim().toLowerCase();
          quantities.set(name, (quantities.get(name) ?? 0) + item.qty);
        }
    }
    const topItems = [...quantities]
      .map(([name, qty]) => ({ name, qty }))
      .sort(
        (a, b) =>
          b.qty - a.qty || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
      );
    return {
      month,
      perOffice,
      reportingCurrency: "NOK",
      fxRate,
      combinedMinor: combined.amountMinor,
      topItems,
    };
  }
  return { monthlyReport };
}
