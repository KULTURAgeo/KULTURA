import {pathToFileURL} from "node:url";
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
import assert from "node:assert/strict";
import fs from "node:fs";
(async()=>{
const browser=await chromium.launch({headless:true,channel:"msedge"});
const page=await browser.newPage();const errors=[],checks=[];page.on("pageerror",e=>errors.push(e.message));
const base="http://localhost:3002";const visit=async route=>{const r=await page.goto(base+route);await page.locator("main h1").first().waitFor(); await page.waitForTimeout(250);assert.equal(r.status(),200,route);};
for(const route of ["/account","/account/orders","/account/addresses","/admin","/admin/products","/admin/products/new","/admin/orders"]){await visit(route);assert.match(page.url(),/\/login/);checks.push("Anonymous guard "+route);}
for(const width of [375,390,430,768,1024,1440]){
await page.setViewportSize({width,height:900});
for(const route of ["/login","/register","/forgot-password","/shop","/product/distressed-hoodie","/cart"]){
await visit(route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+" "+route);checks.push(width+" "+route);
}
}
await visit("/product/distressed-hoodie");await page.locator(".size-options button").filter({hasText:/^M/}).click();await page.getByRole("button",{name:/ADD TO CART/}).click();
await page.locator(".cart-drawer[open]").waitFor();assert.match(await page.locator(".cart-drawer").innerText(),/Distressed Hoodie/i);
await page.keyboard.press("Escape");await visit("/cart");assert.equal(await page.locator("main .cart-line").count(),1);await page.reload();await page.locator("main h1").first().waitFor(); await page.waitForTimeout(250);assert.equal(await page.locator("main .cart-line").count(),1);checks.push("Variant add, drawer and persisted cart");
async function login(email){await visit("/login");await page.locator('[name=email]').fill(email);await page.locator('[name=password]').fill("TEST_ONLY_PASSWORD");await page.getByRole("button",{name:"SIGN IN",exact:true}).click();await page.waitForURL(/\/account/);await page.locator("main h1").first().waitFor(); await page.waitForTimeout(250);}
await login("customer@example.invalid");
await visit("/admin/products");assert.match(page.url(),/\/account\?restricted=1/);checks.push("Customer admin route rejected");
for(const width of [375,390,430,768,1024,1440]){await page.setViewportSize({width,height:900});for(const route of ["/account","/account/orders","/account/addresses"]){await visit(route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+" "+route);checks.push(width+" "+route);}}
await page.getByRole("button",{name:"SIGN OUT",exact:true}).click();await page.waitForURL(/\/login/);checks.push("Logout");
await login("admin@example.invalid");
await visit("/admin/products");const edit=await page.locator('a[href^="/admin/products/"]').filter({hasText:/EDIT/i}).first().getAttribute("href");
assert.ok(edit);for(const width of [375,768,1440]){await page.setViewportSize({width,height:1000});for(const route of ["/admin","/admin/products","/admin/products/new",edit,"/admin/orders"]){await visit(route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+" "+route);checks.push(width+" "+route);}await visit(edit);await page.screenshot({path:"qa/phase3-admin-"+width+".png",fullPage:true});}
await visit("/admin/products/new");
await page.locator('[name=name]').fill("Browser QA product");
await page.locator('[name=slug]').fill("invalid slug");
await page.locator('[name=price]').fill("12.34");
await page.locator('[name=category_id]').selectOption({index:1});
await page.getByRole("button",{name:"CREATE PRODUCT",exact:true}).click();
await page.getByRole("alert").filter({hasText:/Slug must/}).waitFor();
assert.equal(await page.locator('[name=name]').inputValue(),"Browser QA product");
checks.push("Invalid product rejected and entered form values retained");
await page.locator('[name=slug]').fill("browser-qa-product");
let actionRequest;
page.on("request",request=>{if(request.headers()["next-action"]&&request.postData()?.includes("browser-qa-product"))actionRequest={headers:request.headers(),body:request.postData()};});
await page.getByRole("button",{name:"CREATE PRODUCT",exact:true}).click();
await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}$/);await page.locator("main h1").first().waitFor(); await page.waitForTimeout(250);
assert.equal(await page.locator('[name=name]').inputValue(),"Browser QA product");
checks.push("Authorized admin product creation through real Server Action");
await page.locator('[name=price]').fill("15.50");await page.getByRole("button",{name:"SAVE PRODUCT",exact:true}).click();await page.getByText("Product saved.",{exact:true}).waitFor();
checks.push("Authorized admin product edit through real Server Action");
assert.ok(actionRequest);
await visit("/account");await page.getByRole("button",{name:"SIGN OUT",exact:true}).click();await page.waitForURL(/\/login/);await login("customer@example.invalid");
const denied=await page.request.post(base+"/admin/products/new",{headers:{"next-action":actionRequest.headers["next-action"],"content-type":actionRequest.headers["content-type"],origin:base},data:actionRequest.body});
assert.match(await denied.text(),/permission|authorized|administrator|access/i);checks.push("Customer replay of admin mutation rejected by server");
assert.deepEqual(errors,[]);fs.writeFileSync("qa/phase3-browser-results.json",JSON.stringify({scope:"Production Next.js and real server actions with TEST-ONLY Auth/PostgREST transport and RLS-protected local PostgreSQL. Not hosted Supabase.",count:checks.length,checks,errors},null,2));console.log(checks.length+" browser checks passed");await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});