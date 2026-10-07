import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import sharp from "sharp";

const page = await readFile("src/app/page.tsx", "utf8");
const names = await readdir("public/images");
const paths = [...page.matchAll(/src="(\/images\/kultura-globe-[^"]+)"/g)].map(match => match[1]);
assert.deepEqual(paths.sort(), ["/images/kultura-globe-phone.webp", "/images/kultura-globe-scene.webp"]);
assert.doesNotMatch(page, /kultura-phone-badge\.png|kultura-scene-logo\.jpg|kultura-globe-badge/);
for (const path of paths) {
  assert.ok(names.includes(path.split("/").at(-1)), "Exact case-sensitive filename: " + path);
  const bytes = await readFile("public" + path);
  const meta = await sharp(bytes).metadata();
  assert.equal(meta.format, "webp");
  // Full pixel decode catches files that have a header but corrupted image data.
  const { data, info } = await sharp(bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
  assert.ok(data.some(value => value > 180), "Chrome artwork is visible");
  if (path.includes("scene")) { assert.ok(info.width >= 980); assert.ok(info.height >= 560); }
  else {
    assert.ok(info.width >= 192);
    let left=info.width, right=0, top=info.height, bottom=0;
    for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) if(data[y*info.width+x]>64) {
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    assert.ok((right-left)/info.width > .85 && (bottom-top)/info.height > .8, "Badge has no excessive empty padding");
    assert.ok(left > 0 && right < info.width-1 && top > 0 && bottom < info.height-1, "Artwork is not cropped at the edges");
  }
  if (process.env.QA_BASE_URL) {
    const response = await fetch(new URL(path,process.env.QA_BASE_URL));
    assert.equal(response.status,200);
    assert.match(response.headers.get("content-type"),/image\/webp/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes,"Production server serves the exact asset bytes");
  }
}
await sharp("public/images/kultura-globe-original.jpeg").raw().toBuffer();
if (process.env.QA_BASE_URL) {
  const html=await (await fetch(process.env.QA_BASE_URL)).text();
  for(const path of paths) assert.ok(html.includes('src="'+path+'"'),"Built homepage uses direct public asset path");
}
console.log("Both logo files fully decode, match exact public paths, have appropriate resolution and retain the complete artwork." + (process.env.QA_BASE_URL ? " Production HTTP assets and HTML verified." : ""));
