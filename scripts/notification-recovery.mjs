import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// Operator-only recovery. No provider is called, and recipient/payload data is
// never selected. Unknown provider outcomes must remain quarantined.
export const STAGING_REF = 'fpahkxmlcvywspamftma';
export function recoveryUpdate(row, channel, outcome, now = Date.now()) {
  if (!['email', 'sms'].includes(channel)) throw Error('Invalid channel');
  if (!['accepted', 'not-accepted'].includes(outcome)) throw Error('Provider outcome must be verified');
  const status = row[`${channel}_status`];
  const claim = row[`${channel}_claimed_at`];
  const attempts = row[`${channel}_attempts`];
  if (!['pending', 'failed'].includes(status) || !claim ||
      !Number.isFinite(Date.parse(claim)) || now - Date.parse(claim) < 15 * 60_000 ||
      !Number.isInteger(attempts) || attempts < 0)
    throw Error('Not an eligible stale claim');
  if (outcome === 'not-accepted' && attempts >= 3) throw Error('Recovery budget exhausted; leave quarantined');
  return outcome === 'accepted'
    ? { [`${channel}_status`]: 'sent', [`${channel}_sent_at`]: new Date(now).toISOString(), updated_at: new Date(now).toISOString() }
    : { [`${channel}_status`]: 'pending', [`${channel}_claimed_at`]: null, [`${channel}_attempts`]: attempts + 1, updated_at: new Date(now).toISOString() };
}

export async function recover(client, row, channel, outcome, now = Date.now()) {
  const update = recoveryUpdate(row, channel, outcome, now);
  const { data, error } = await client.from('notification_outbox').update(update)
    .eq('id', row.id).eq(`${channel}_status`, row[`${channel}_status`])
    .eq(`${channel}_claimed_at`, row[`${channel}_claimed_at`])
    .eq(`${channel}_attempts`, row[`${channel}_attempts`]).select('id');
  if (error) throw Error('Recovery write failed; no provider request was made');
  if (data?.length !== 1) throw Error('Claim changed; recovery refused');
  return { id: row.id, channel, outcome, provider_request_made: false };
}

async function main(args) {
  const [command, expectedRef, id, channel, outcome, acknowledgement] = args;
  // Deliberately staging-only until production release/backup gates are proven.
  if (expectedRef !== STAGING_REF || process.env.SUPABASE_URL !== `https://${STAGING_REF}.supabase.co`)
    throw Error('Exact staging project identity required');
  if (!process.env.SUPABASE_SECRET_KEY?.trim()) throw Error('Server-only Supabase credential required');
  if (!['list', 'resolve'].includes(command)) throw Error('Use list or resolve');
  if (command === 'resolve' && (!/^[0-9a-f-]{36}$/i.test(id ?? '') || acknowledgement !== '--workers-paused-provider-verified'))
    throw Error('Explicit fixture ID and worker/provider verification acknowledgement required');
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
  });
  let query = client.from('notification_outbox').select('id,email_status,sms_status,email_claimed_at,sms_claimed_at,email_attempts,sms_attempts');
  query = command === 'resolve' ? query.eq('id', id) : query.or('email_claimed_at.not.is.null,sms_claimed_at.not.is.null').order('created_at').limit(100);
  const { data, error } = await query;
  if (error) throw Error('Recovery read failed');
  if (command === 'list') {
    console.log(JSON.stringify({ project_ref: expectedRef, rows: data, limit: 100, sends: 0 }));
  } else {
    if (data?.length !== 1) throw Error('Notification unavailable');
    console.log(JSON.stringify(await recover(client, data[0], channel, outcome)));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    // Only our own fixed messages; never dump SDK/network errors or credentials.
    const safe = ['Exact staging project identity required', 'Server-only Supabase credential required', 'Use list or resolve',
      'Explicit fixture ID and worker/provider verification acknowledgement required', 'Recovery read failed', 'Notification unavailable',
      'Invalid channel', 'Provider outcome must be verified', 'Not an eligible stale claim',
      'Recovery budget exhausted; leave quarantined', 'Recovery write failed; no provider request was made', 'Claim changed; recovery refused'];
    console.error(safe.includes(error?.message) ? error.message : 'Recovery failed safely');
    process.exitCode = 1;
  });
}
