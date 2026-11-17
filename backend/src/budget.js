export const spentStates = new Set([
  "PURCHASED",
  "CLAIM_SUBMITTED",
  "REIMBURSED",
]);

export function monthOf(timestamp, timezone) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(timestamp));
  return (
    parts.find((p) => p.type === "year").value +
    "-" +
    parts.find((p) => p.type === "month").value
  );
}

/** Reservations protect the money promised to a buyer until a receipt or handover. */
export function budget(refills, officeId, office, now) {
  const month = monthOf(now, office.timezone);
  const own = refills.filter((r) => r.officeId === officeId);
  const spent = own
    .filter(
      (r) =>
        spentStates.has(r.state) &&
        r.purchase &&
        monthOf(r.purchase.purchasedAt, office.timezone) === month,
    )
    .reduce((sum, r) => sum + r.purchase.amountMinor, 0);
  // A live commitment still needs funding after the month rolls over.
  const reserved = own
    .filter((r) => r.state === "COMMITTED")
    .reduce((sum, r) => sum + r.reservedMinor, 0);
  return {
    month,
    currency: office.currency,
    spent,
    reserved,
    remaining: office.monthlyBudget - spent - reserved,
  };
}
