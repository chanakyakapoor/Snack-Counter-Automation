// Keep arithmetic in minor units; payroll FX never enters the spending ledger.
export function money(amountMinor, currency) {
  if (!Number.isSafeInteger(amountMinor) || !currency)
    throw new TypeError("Invalid money");
  return { amountMinor, currency };
}
function same(a, b) {
  money(a.amountMinor, a.currency);
  money(b.amountMinor, b.currency);
  if (a.currency !== b.currency) throw new TypeError("Currency mismatch");
}
export function add(a, b) {
  same(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}
export function sub(a, b) {
  same(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}
export function compare(a, b) {
  same(a, b);
  return Math.sign(a.amountMinor - b.amountMinor);
}
export function convert(value, to, rate) {
  money(value.amountMinor, value.currency);
  if (
    rate.from !== value.currency ||
    rate.to !== to ||
    !Number.isSafeInteger(rate.numerator) ||
    rate.numerator <= 0 ||
    !Number.isSafeInteger(rate.denominator) ||
    rate.denominator <= 0
  ) {
    throw new TypeError("Invalid exchange rate");
  }
  const product = BigInt(value.amountMinor) * BigInt(rate.numerator);
  const denominator = BigInt(rate.denominator);
  // Floor(x + 1/2): exact round-half-up, including negative half ties.
  const dividend = 2n * product + denominator,
    divisor = 2n * denominator;
  let rounded = dividend / divisor;
  if (dividend < 0n && dividend % divisor !== 0n) rounded -= 1n;
  return money(Number(rounded), to);
}
