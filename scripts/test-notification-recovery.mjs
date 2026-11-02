import assert from 'node:assert/strict';
import { recoveryUpdate, recover } from './notification-recovery.mjs';
const now = Date.parse('2026-10-16T00:00:00Z');
const row = { id: 'fixture', email_status: 'pending', email_claimed_at: '2026-10-15T23:00:00Z', email_attempts: 0 };
let checks = 0;
function check(fn) { fn(); checks++; }
check(() => assert.throws(() => recoveryUpdate(row, 'fax', 'accepted', now), /Invalid channel/));
check(() => assert.throws(() => recoveryUpdate(row, 'email', 'unknown', now), /verified/));
check(() => assert.throws(() => recoveryUpdate({ ...row, email_claimed_at: new Date(now - 60_000).toISOString() }, 'email', 'not-accepted', now), /eligible/));
check(() => assert.throws(() => recoveryUpdate({ ...row, email_claimed_at: null }, 'email', 'not-accepted', now), /eligible/));
check(() => assert.throws(() => recoveryUpdate({ ...row, email_status: 'sent' }, 'email', 'not-accepted', now), /eligible/));
check(() => assert.throws(() => recoveryUpdate({ ...row, email_attempts: 3 }, 'email', 'not-accepted', now), /budget/));
check(() => assert.deepEqual(recoveryUpdate(row, 'email', 'not-accepted', now), {
  email_status: 'pending', email_claimed_at: null, email_attempts: 1, updated_at: new Date(now).toISOString(),
}));
check(() => assert.equal(recoveryUpdate({ ...row, email_attempts: 3 }, 'email', 'accepted', now).email_status, 'sent'));
let current = { ...row };
const client = { from(table) {
  assert.equal(table, 'notification_outbox');
  return { update(patch) {
    const predicates = [];
    const q = { eq(k, v) { predicates.push([k, v]); return q; }, async select(columns) {
      assert.equal(columns, 'id');
      assert.equal(predicates.length, 4);
      if (!predicates.every(([k, v]) => current[k] === v)) return { data: [] };
      current = { ...current, ...patch };
      return { data: [{ id: current.id }] };
    } }; return q;
  } };
} };
const raced = await Promise.allSettled([recover(client, row, 'email', 'not-accepted', now), recover(client, row, 'email', 'not-accepted', now)]);
check(() => { assert.equal(raced.filter(r => r.status === 'fulfilled').length, 1); assert.match(raced.find(r => r.status === 'rejected').reason.message, /Claim changed/); });
check(() => assert.equal(raced.find(r => r.status === 'fulfilled').value.provider_request_made, false));
console.log(`${checks} notification recovery checks passed (isolated conditional-update adapter; no hosted writes or provider calls)`);
