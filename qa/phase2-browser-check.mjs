const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || "playwright");
import fs from "node:fs";
(async()=>{
 const browser=await chromium.launch({headless:true,channel:"msedge"});
 const page=await browser.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const results=[];
 for(const width of [375,390,430,768,1024,1440]){
 await page.setViewportSize({width,height:900});
 for(const route of ["/","/shop","/drops","/product/distressed-hoodie","/shop/hoodies"]){
  const response=await page.goto("http://localhost:3000"+route);await page.waitForLoadState("networkidle");
  if(response.status()!==200)throw new Error(route+" response "+response.status());
  if(!await page.getByText("The collection is being prepared. Check back soon.",{exact:true}).isVisible())throw new Error("Missing unconfigured notice");
  if(await page.locator(".product-card").count()!==0)throw new Error("Mock product fallback");
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw new Error("Overflow "+width+" "+route);
  results.push({width,route,status:response.status(),overflow,unconfiguredNotice:true});
 }
 }
 await page.setViewportSize({width:390,height:844});await page.goto("http://localhost:3000");
 await page.getByRole("button",{name:"Open navigation"}).click();
 if(!await page.locator("dialog").isVisible())throw new Error("Mobile navigation broken");
 await page.keyboard.press("Escape");
 await page.screenshot({path:"qa/phase2-unconfigured-mobile.png",fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:"qa/phase2-unconfigured-desktop.png",fullPage:true});
 if(errors.length)throw new Error(JSON.stringify(errors));
 fs.writeFileSync("qa/phase2-browser-results.json",JSON.stringify({scope:"Production app with Supabase intentionally unconfigured",checks:results.length,results,errors,mobileNavigation:"passed"},null,2));
 console.log("30 responsive route checks passed; zero mock fallback products; no browser errors.");
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
