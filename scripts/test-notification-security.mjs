// All provider HTTP calls and privileged clients are replaced; no customer sends.
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){
  if(specifier==='./client' && context.parentURL?.endsWith('/notifications/order-notifications.ts'))
    return {shortCircuit:true,url:'data:text/javascript,export const notificationClient=()=>globalThis.__notificationClient;'};
  return next(specifier,context);
}});
const {notifyOrderEvent}=await import('../src/lib/notifications/order-notifications.ts');
const originalFetch=globalThis.fetch;
const names=['RESEND_API_KEY','NOTIFICATION_EMAIL_FROM','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM','TWILIO_MESSAGING_SERVICE_SID'];
const saved=Object.fromEntries(names.map(n=>[n,process.env[n]]));
const sessionClient={rpc(){throw Error('Customer session must not perform privileged delivery')}};
let requests=0,claimed=false,recorded=[];
const prepared={id:'notification',order_id:'order',event_type:'order_received',recipient_email:'test@example.invalid',email_status:'pending',sms_status:'pending',payload:{order_number:'TEST',delivery_name:'TEST',currency:'GEL',final_total:4900}};
try{
  names.forEach(n=>delete process.env[n]);
  globalThis.fetch=async()=>{requests++;return {ok:true}};
  globalThis.__notificationClient=null;
  await notifyOrderEvent(sessionClient,'order','order_received');
  assert.equal(requests,0);
  globalThis.__notificationClient={async rpc(name,args){
    if(name==='notification_prepare') return {data:prepared,error:null};
    if(name==='notification_claim'){const first=!claimed;claimed=true;return {data:first,error:null}};
    if(name==='notification_record_delivery'){recorded.push(args);return {error:null}};
    throw Error('Unexpected RPC');
  }};
  await notifyOrderEvent(sessionClient,'order','order_received');
  assert.equal(requests,0);assert.equal(claimed,false);
  process.env.RESEND_API_KEY='synthetic-test-only';process.env.NOTIFICATION_EMAIL_FROM='test@example.invalid';
  await Promise.all([notifyOrderEvent(sessionClient,'order','order_received'),notifyOrderEvent(sessionClient,'order','order_received')]);
  assert.equal(requests,1);assert.equal(recorded.length,1);assert.equal(recorded[0].p_status,'sent');
  claimed=false;recorded=[];
  globalThis.fetch=async()=>{throw Error('Synthetic provider outage')};
  await notifyOrderEvent(sessionClient,'order','order_received');
  assert.equal(recorded[0].p_status,'failed');
  recorded=[];
  globalThis.__notificationClient={async rpc(){return {data:null,error:{code:'22023'}}}};
  await notifyOrderEvent(sessionClient,'order','payment_paid');
  assert.deepEqual(recorded,[]);
  console.log('5 notification service checks passed: missing backend key, missing provider config, single claimed send, safe provider outage, rejected preparation; no real HTTP');
}finally{
  globalThis.fetch=originalFetch;
  for(const n of names){if(saved[n]===undefined)delete process.env[n];else process.env[n]=saved[n];}
  delete globalThis.__notificationClient;
}
