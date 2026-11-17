import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApplication } from '../src/application.js';
import { createHttpServer } from '../src/server.js';

async function setup(t) {
  const app = createApplication('2026-11-17T09:00:00Z');
  const server = createHttpServer(app);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const send = body => fetch(base + '/api/command', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const state = () => fetch(base + '/api/state').then(r => r.json());
  return { app, base, send, state };
}
const receipt = amountMinor => ({ amountMinor, receiptRef: 'mock://test.png', items: [{ name: 'Nuts', qty: 4 }] });

test('HTTP drives concurrent acceptance, automatic claims and a combined two-office report', async t => {
  const { send, state } = await setup(t);
  for (const [officeId, amount] of [['oslo', 90_000], ['bengaluru', 200_000]]) {
    const { refill } = await send({ action: 'empty', officeId });
    const outcomes = await Promise.all(refill.offeredTo.slice(0, 2).map(employeeId => send({ action: 'accept', refillId: refill.id, employeeId })));
    assert.equal(outcomes.filter(o => o.ok).length, 1);
    assert.equal(outcomes.find(o => !o.ok).reason, 'ALREADY_TAKEN');
    const employeeId = outcomes.find(o => o.ok).refill.committedBy;
    const result = await send({ action: 'receipt', refillId: refill.id, employeeId, receipt: receipt(amount) });
    assert.equal(result.refill.state, 'CLAIM_SUBMITTED');
    await send({ action: 'hrDecision', refillId: refill.id, approved: true });
  }
  const data = await state();
  assert.equal(data.report.combinedMinor, 115_000);
  assert.equal(data.claims.length, 2);
  assert.ok(data.refills.every(r => r.state === 'REIMBURSED'));
});

test('HTTP admin review gates HR and lost responses retry without duplicate claims', async t => {
  const { app, send, state } = await setup(t);
  const { refill } = await send({ action: 'empty', officeId: 'oslo' });
  const employeeId = refill.offeredTo[0];
  await send({ action: 'accept', refillId: refill.id, employeeId });
  await send({ action: 'receipt', refillId: refill.id, employeeId, receipt: receipt(130_000) });
  assert.equal((await state()).claims.length, 0);
  await send({ action: 'hrFailure', mode: 'lostResponse' });
  await send({ action: 'decide', refillId: refill.id, employeeId: 'oslo-admin', approved: true });
  assert.equal((await state()).refills[0].state, 'PURCHASED');
  await send({ action: 'tick' });
  assert.equal((await state()).refills[0].state, 'CLAIM_SUBMITTED');
  assert.equal(app.hr.claims.size, 1);
  await send({ action: 'hrDecision', refillId: refill.id, approved: false });
  assert.equal((await state()).refills[0].state, 'CLAIM_REJECTED');
});

test('HTTP availability, visits and clock controls change real eligibility and handover', async t => {
  const { send, state } = await setup(t);
  await send({ action: 'availability', employeeId: 'oslo-01', away: true });
  await send({ action: 'visit', employeeId: 'oslo-02', officeId: 'bengaluru' });
  let data = await state();
  assert.ok(!data.offices[0].eligible.includes('oslo-01'));
  assert.ok(data.offices[1].eligible.includes('oslo-02'));
  await send({ action: 'endVisit', employeeId: 'oslo-02' });
  const { refill } = await send({ action: 'empty', officeId: 'oslo' });
  await send({ action: 'accept', refillId: refill.id, employeeId: refill.offeredTo[0] });
  await send({ action: 'advance', hours: 24 });
  data = await state();
  assert.equal(data.refills[0].state, 'OPEN');
  assert.equal(data.offices[0].budget.reserved, 0);
  assert.ok(data.refills[0].excluded.includes(refill.offeredTo[0]));
  assert.ok(!data.offices[1].eligible.includes('oslo-02'));
});

test('HTTP rejects malformed requests and invalid actions without crashing', async t => {
  const { base, send, state } = await setup(t);
  for (const body of ['{', 'null', '[]']) {
    const result = await fetch(base + '/api/command', { method: 'POST', body });
    assert.equal(result.status, 400);
  }
  assert.equal((await fetch(base + '/api/state?month=garbage')).status, 400);
  assert.equal((await send({ action: 'empty', officeId: '__proto__' })).reason, 'UNKNOWN_OFFICE');
  assert.equal((await send({ action: 'advance', hours: -1 })).reason, 'INVALID_HOURS');
  assert.equal((await send({ action: 'somethingElse' })).reason, 'UNKNOWN_ACTION');
  assert.equal((await state()).refills.length, 0);
});
