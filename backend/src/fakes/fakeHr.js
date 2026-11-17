/** HR: async createClaim(key, fields) -> {id, status}; async getStatus(id) -> status.
 * fields: amountMinor, currency, description, receiptRef, employeeId.
 * The provider retains the same claim for repeated keys, including lost responses.
 */
export function fakeHr() {
  const claims = new Map(),
    calls = [];
  let failures = 0,
    lostResponses = 0;
  return {
    claims,
    calls,
    failNext: (count = 1) => {
      failures = count;
    },
    loseNextResponse: () => {
      lostResponses += 1;
    },
    async createClaim(key, fields) {
      await Promise.resolve();
      calls.push({ key, ...structuredClone(fields) });
      if (
        !Number.isSafeInteger(fields.amountMinor) ||
        fields.amountMinor <= 0 ||
        !["currency", "description", "receiptRef", "employeeId"].every(
          (k) => fields[k],
        )
      ) {
        throw new Error("Missing required HR claim field");
      }
      if (failures > 0) {
        failures -= 1;
        throw new Error("HR unavailable");
      }
      if (!claims.has(key))
        claims.set(key, { id: "hr-" + key, status: "SUBMITTED", ...fields });
      if (lostResponses > 0) {
        lostResponses -= 1;
        throw new Error("HR response lost");
      }
      return structuredClone(claims.get(key));
    },
    async getStatus(id) {
      await Promise.resolve();
      if (failures > 0) {
        failures -= 1;
        throw new Error("HR unavailable");
      }
      return [...claims.values()].find((c) => c.id === id)?.status;
    },
    approve(id) {
      [...claims.values()].find((c) => c.id === id).status = "APPROVED";
    },
    reject(id) {
      [...claims.values()].find((c) => c.id === id).status = "REJECTED";
    },
  };
}
