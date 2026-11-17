/** Clock: now() returns epoch milliseconds; tests advance without waiting. */
export function fakeClock(start = "2026-11-10T08:00:00Z") {
  let time = new Date(start).getTime();
  return {
    now: () => time,
    advance: (milliseconds) => {
      time += milliseconds;
    },
  };
}
