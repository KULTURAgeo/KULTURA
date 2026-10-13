// Component logic with deterministic hook/effect adapters, not a browser E2E.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
let hooks = [], cursor = 0, effects = [], transitions = [];
globalThis.__audit = {
  ref(value) { const i = cursor++; return hooks[i] ??= { current: value }; },
  state(value) { const i = cursor++; if (!(i in hooks)) hooks[i] = value; return [hooks[i], v => { hooks[i] = typeof v === "function" ? v(hooks[i]) : v; }]; },
  effect(fn) { effects.push(fn); },
  transition() { return [false, fn => transitions.push(fn())]; },
};
const mock = source => ({ shortCircuit: true, url: "data:text/javascript," + encodeURIComponent(source) });
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "react/jsx-runtime") return mock("export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment='fragment';");
  if (specifier === "react") return mock(`export const useRef=v=>globalThis.__audit.ref(v),useState=v=>globalThis.__audit.state(v),useEffect=f=>globalThis.__audit.effect(f),useCallback=f=>f,useMemo=f=>f(),useTransition=()=>globalThis.__audit.transition(),createContext=()=>({Provider:'provider'}),useContext=()=>globalThis.__audit.cart;`);
  if (specifier === "next/image" || specifier === "next/link") return mock("export default 'test-element';");
  if (specifier === "next/navigation") return mock("export const useRouter=()=>globalThis.__audit.router; export function redirect(url){throw Object.assign(new Error('redirect'),{redirectTo:url})}");
  if (specifier.endsWith("language-provider")) return mock("export const useLanguage=()=>({t:v=>v,locale:'en'});");
  if (specifier === "@/lib/category-i18n") return mock("export const colorDisplayName=(_,v)=>v;");
  if (specifier === "@/lib/catalog") return mock("export const money=v=>String(v);");
  if (specifier === "@/app/cart/actions") return mock("export const refreshCart=v=>globalThis.__audit.quote(v);");
  if (specifier === "@/app/checkout/actions") return mock("export const createTestOrder=()=>{throw new Error('unexpected')};export const quotePromo=()=>{throw new Error('unexpected')};");
  if (specifier === "@/app/checkout/unpaid-actions") return mock("export const createUnpaidOrder=v=>globalThis.__audit.submit(v);");
  if (specifier === "@/lib/auth/guards") return mock("export const requireActor=()=>globalThis.__audit.actor();export const requirePage=()=>globalThis.__audit.actor();");
  if (specifier === "@/components/ui") return mock("export const Container='container';");
  if (specifier.startsWith("@/")) {
    const suffix = specifier.startsWith("@/components/") ? ".tsx" : ".ts";
    return next(pathToFileURL(resolve("src", specifier.slice(2) + suffix)).href, context);
  }
  return next(specifier, context);
}});
const { CartProvider } = await import("../src/components/cart-provider.tsx");
const { Checkout } = await import("../src/components/checkout.tsx");
const { default: CheckoutPage } = await import("../src/app/checkout/page.tsx");
const { CART_KEY } = await import("../src/lib/cart/model.ts");
const checks = [];
async function check(name, fn) { await fn(); checks.push(name); }
function reset() { hooks = []; cursor = 0; effects = []; transitions = []; }
function render(component, props) { cursor = 0; effects = []; return component(props); }
function nodes(node) { if (!node || typeof node !== "object") return []; if (Array.isArray(node)) return node.flatMap(nodes); return [node, ...nodes(node.props?.children)]; }
const line = { productId: "10000000-0000-4000-8000-000000000001", variantId: "10000000-0000-4000-8000-000000000002", size: "M", color: "Black", quantity: 3, observedPrice: 4900 };
const storage = new Map([[CART_KEY, JSON.stringify({version: 1, items: [line]})]]);
globalThis.localStorage = {getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value)};
globalThis.window = {addEventListener(){},removeEventListener(){}};
let quoted;
__audit.quote = async lines => { quoted = lines; return {ok:true,quote:{lines:lines.map(l=>({...l,price:4900,lineTotal:14700,available:true})),subtotal:14700}}; };
await check("Child refresh before provider mount restores stored quantity without erasing it", async () => {
  reset(); const first = render(CartProvider, {}); const mount = effects[0];
  await first.props.value.refresh(); mount();
  const current = render(CartProvider, {}).props.value;
  assert.equal(quoted[0].quantity,3); assert.equal(current.quote.subtotal,14700);
  assert.equal(current.count,3); assert.equal(JSON.parse(storage.get(CART_KEY)).items[0].quantity,3);
});
await check("Failed quote preserves storage and explicit refresh can retry", async () => {
  const success = __audit.quote; __audit.quote = async()=>{throw Error("fixture outage")};
  const current = render(CartProvider, {}).props.value;
  assert.equal(await current.refresh(),false);
  assert.equal(JSON.parse(storage.get(CART_KEY)).items[0].quantity,3);
  assert.match(render(CartProvider,{}).props.value.error,/try again/i);
  __audit.quote = success; assert.equal(await current.refresh(),true);
});
const props = {addresses:[{id:"address",recipient_name:"Test",phone:"123",city:"Tbilisi",address_line_1:"Test only",is_default:true}],profile:{fullName:"Test",email:"test@example.invalid",phone:"123"},shippingSettings:{shippingTotal:0,freeShippingThreshold:null},testCheckoutEnabled:false};
let clears = 0, destinations = [], calls = 0;
__audit.router = {push:p=>destinations.push(p),refresh(){}};
__audit.cart = {ready:true,busy:false,error:"",quote:{lines:[{...line,price:4900,lineTotal:14700,available:true}],subtotal:14700},clear(){clears++},refresh:async()=>true};
function place() { return nodes(render(Checkout,props)).find(n=>n.type==="button" && n.props.children==="PLACE UNPAID ORDER").props.onClick; }
await check("Cold checkout requests its authoritative quote",async()=>{
  reset(); let refreshes=0; const original=__audit.cart;
  __audit.cart={...original,ready:false,refresh:()=>{refreshes++}};
  render(Checkout,props); effects.forEach(f=>f()); assert.equal(refreshes,1); __audit.cart=original;
});
await check("Concurrent clicks submit once; success clears and redirects after persistence",async()=>{
  reset(); let finish; __audit.submit=async input=>{calls++;assert.equal(input.lines[0].quantity,3);return new Promise(r=>finish=r)};
  const submit=place(); submit(); submit(); assert.equal(calls,1);assert.equal(clears,0);
  finish({ok:true,orderId:"persisted-id"}); await Promise.all(transitions);
  assert.equal(clears,1);assert.deepEqual(destinations,["/order-confirmation/persisted-id"]);
});
for (const rejected of [false,true]) await check(`Order ${rejected?'transport exception':'validation failure'} preserves bag and stays on checkout`,async()=>{
  reset(); clears=0;destinations=[];
  __audit.submit=async()=>{if(rejected)throw Error('private fixture failure');return{ok:false,message:'Stock changed'}};
  place()(); await Promise.all(transitions); assert.equal(clears,0);assert.deepEqual(destinations,[]);
  const alerts=nodes(render(Checkout,props)).filter(n=>n.props?.role==='alert');
  assert.ok(alerts.length); assert.ok(!JSON.stringify(alerts).includes('private fixture failure'));
});
await check("Shipping transport failure cannot silently display free delivery",async()=>{
  __audit.actor=async()=>({user:{email:'test@example.invalid'},profile:{role:'customer'},client:{from:()=>({select:()=>({eq:()=>({order:()=>({order:async()=>({data:[],error:null})})})})}),rpc:async()=>({data:null,error:{message:'private upstream error'}})}});
  await assert.rejects(CheckoutPage,/temporarily unavailable/);
});
console.log(JSON.stringify({scope:'Local component logic with hook adapters; not browser or hosted proof',passed:checks.length,checks},null,2));
