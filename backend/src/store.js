export const activeStates = new Set([
  "OPEN",
  "COMMITTED",
  "PURCHASED",
  "NEEDS_APPROVAL",
]);

/** Detached snapshots prevent accidental writes; CAS checks and writes without an await between them. */
export function createStore({ employees = [], visits = [] } = {}) {
  const refills = new Map(),
    claims = new Map();
  return {
    employees: structuredClone(employees),
    visits: structuredClone(visits),
    async listRefills() {
      await Promise.resolve();
      return structuredClone([...refills.values()]);
    },
    async getRefill(id) {
      await Promise.resolve();
      return structuredClone(refills.get(id));
    },
    async compareAndSet(id, expectedVersion, next) {
      await Promise.resolve(); // Let competing requests read the same old version in tests.
      if ((refills.get(id)?.version ?? null) !== expectedVersion) return false;
      // Also enforce uniqueness when two /empty calls race with different IDs.
      if (
        activeStates.has(next.state) &&
        [...refills.values()].some(
          (r) =>
            r.id !== id &&
            r.officeId === next.officeId &&
            activeStates.has(r.state),
        )
      )
        return false;
      refills.set(id, structuredClone(next));
      return true;
    },
    async getClaim(refillId) {
      await Promise.resolve();
      return structuredClone(claims.get(refillId));
    },
    async saveClaim(claim) {
      await Promise.resolve();
      claims.set(claim.refillId, structuredClone(claim));
    },
  };
}
