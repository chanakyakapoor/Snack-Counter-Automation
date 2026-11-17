import test from "node:test";
import assert from "node:assert/strict";
import { money, add, sub, compare, convert } from "../src/money.js";

test("Mixed-currency arithmetic throws; conversion uses exact round-half-up", () => {
  const nok = money(100, "NOK"),
    inr = money(100, "INR");
  for (const operation of [add, sub, compare])
    assert.throws(() => operation(nok, inr));
  assert.equal(add(nok, nok).amountMinor, 200);
  assert.equal(sub(nok, nok).amountMinor, 0);
  assert.equal(compare(nok, money(50, "NOK")), 1);
  const rate = { from: "INR", to: "NOK", numerator: 1, denominator: 8 };
  assert.equal(convert(money(100, "INR"), "NOK", rate).amountMinor, 13);
  assert.equal(convert(money(99, "INR"), "NOK", rate).amountMinor, 12);
  assert.equal(convert(money(-100, "INR"), "NOK", rate).amountMinor, -12);
  assert.throws(() => money(1.5, "NOK"));
  assert.throws(() => add(money(Number.MAX_SAFE_INTEGER, "NOK"), nok));
});
