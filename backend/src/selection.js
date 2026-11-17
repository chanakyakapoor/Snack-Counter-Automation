const owedStates = new Set(["PURCHASED", "NEEDS_APPROVAL", "CLAIM_SUBMITTED"]);

export function exposure(employeeId, currency, refills) {
  return refills
    .filter(
      (r) =>
        r.committedBy === employeeId &&
        owedStates.has(r.state) &&
        r.purchase?.currency === currency,
    )
    .reduce((sum, r) => sum + r.purchase.amountMinor, 0);
}

/** Pure ranking: protect people waiting for money, then share the work fairly. */
export function selectVolunteers({
  employees,
  visits,
  refills,
  officeId,
  office,
  now,
  excluded = [],
  historyWindow,
}) {
  return employees
    .filter(
      (employee) =>
        employee.isVolunteer &&
        (employee.homeOffice === officeId ||
          visits.some(
            (v) =>
              v.employeeId === employee.employeeId &&
              v.officeId === officeId &&
              Date.parse(v.from) <= now &&
              now < Date.parse(v.to),
          )) &&
        !(Date.parse(employee.awayUntil) > now) &&
        !excluded.includes(employee.employeeId) &&
        exposure(employee.employeeId, office.currency, refills) <
          office.exposureCap,
    )
    .map((employee) => {
      const purchases = refills.filter(
        (r) =>
          r.committedBy === employee.employeeId &&
          r.purchase &&
          r.purchase.purchasedAt <= now,
      );
      return {
        employeeId: employee.employeeId,
        owed: exposure(employee.employeeId, office.currency, refills),
        recent: purchases.filter(
          (r) => r.purchase.purchasedAt >= now - historyWindow,
        ).length,
        last: Math.max(
          -Infinity,
          ...purchases.map((r) => r.purchase.purchasedAt),
        ),
      };
    })
    .sort(
      (a, b) =>
        a.owed - b.owed ||
        a.recent - b.recent ||
        (a.last === b.last ? 0 : a.last < b.last ? -1 : 1) ||
        (a.employeeId < b.employeeId
          ? -1
          : a.employeeId > b.employeeId
            ? 1
            : 0),
    )
    .map((candidate) => candidate.employeeId);
}
