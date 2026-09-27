const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
import fs from "node:fs";
(async () => {
const browser = await chromium.launch({headless:true,channel:"msedge"});
const page = await browser.newPage();
const errors=[]; page.on("pageerror",e=>errors.push(e.message));
const report={layouts:[],routes:[],interactions:[],errors};
for(const width of [375,390,430,768,1024,1440]){
 await page.setViewportSize({width,height:1000});
 for(const route of ["/","/shop","/product/distressed-hoodie"]){
  await page.goto("http://localhost:3000"+route); await page.waitForLoadState("networkidle"); await page.evaluate(async()=>{ for(const img of document.images){img.loading="eager"; await img.decode().catch(()=>{});} });
  const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).length}));
  report.layouts.push({width,route,...metrics}); if(metrics.overflow||metrics.brokenImages) throw new Error(JSON.stringify(report.layouts.at(-1)));
 }
 await page.goto("http://localhost:3000"); await page.screenshot({path:"qa/home-"+width+".png",fullPage:true});
}
await page.setViewportSize({width:390,height:844});
await page.getByRole("button",{name:"Open navigation"}).click();
if(!await page.locator("dialog").isVisible())throw new Error("Menu not open");
await page.keyboard.press("Escape");
if(await page.locator("dialog").isVisible())throw new Error("Escape failed");
report.interactions.push("Mobile menu opens and closes with Escape");
await page.goto("http://localhost:3000/shop");
await page.getByRole("button",{name:"Tees",exact:true}).click();
if(await page.locator(".product-card").count()!==1)throw new Error("Filter failed");
await page.getByRole("button",{name:"All",exact:true}).click();
await page.getByRole("searchbox").fill("missing");
if(await page.locator(".product-card").count()!==0)throw new Error("Search failed");
report.interactions.push("Category filtering and empty search");
await page.goto("http://localhost:3000/product/distressed-hoodie");
const add=page.getByRole("button",{name:"ADD TO CART"});
if(!await add.isDisabled())throw new Error("Must select size");
await page.getByRole("button",{name:"M",exact:true}).click();
await add.click();
if(!await page.getByText("This is a storefront preview.",{exact:false}).isVisible())throw new Error("Preview feedback missing");
await page.getByRole("button",{name:"Detail crop",exact:true}).click();
if(!await page.locator(".detail-crop").count())throw new Error("Gallery failed");
await page.getByText("DELIVERY & RETURNS",{exact:true}).click();
report.interactions.push("Size selection, stock, cart preview, gallery, accordion");
await page.goto("http://localhost:3000/product/star-cap");
if(!await page.getByRole("button",{name:"SOLD OUT",exact:true}).isDisabled())throw new Error("Sold-out enabled");
report.interactions.push("Sold-out selection blocked");
await page.goto("http://localhost:3000");
await page.getByLabel("YOUR EMAIL").fill("test@example.com");
await page.getByRole("button",{name:"Check newsletter availability"}).click();
if(!await page.getByText("Newsletter signup is not open yet.",{exact:false}).isVisible())throw new Error("Newsletter feedback");
report.interactions.push("Newsletter explicitly does not save email");
for(const route of ["/","/shop","/drops","/about","/contact","/shipping","/returns","/privacy","/terms","/cart","/account","/size-guide","/shop/hoodies","/shop/tees","/shop/pants","/shop/accessories","/product/distressed-hoodie","/product/heavy-tee","/product/wide-leg-pants","/product/star-cap","/not-a-page","/product/not-a-product","/shop/not-a-category"]){
 const response=await page.goto("http://localhost:3000"+route); const status=response.status();
 const expected=route.includes("not-a-")?404:200;
 report.routes.push({route,status}); if(status!==expected)throw new Error(route+" status "+status);
}
await page.emulateMedia({reducedMotion:"reduce"});
await page.goto("http://localhost:3000");
if(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior)!=="auto")throw new Error("Reduced motion");
report.interactions.push("Reduced motion honored");
fs.writeFileSync("qa/results.json",JSON.stringify(report,null,2));
await browser.close();
console.log(JSON.stringify(report,null,2));
if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
