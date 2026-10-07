import sharp from "sharp";

// The supplied original chrome artwork, restored byte-for-byte after the
// landing merge committed invalid image data. Only crop/encode; never redraw.
const source = "public/images/kultura-globe-original.jpeg";
await sharp(source).extract({ left: 82, top: 300, width: 1091, height: 630 })
  .webp({ lossless: true }).toFile("public/images/kultura-globe-scene.webp");
// Tight bounds preserve the entire globe and its highlights at badge scale.
await sharp(source).extract({ left: 130, top: 365, width: 985, height: 530 })
  .resize({ width: 256, withoutEnlargement: true })
  .webp({ lossless: true }).toFile("public/images/kultura-globe-phone.webp");
console.log("Generated scene and phone crops from the original KULTURA artwork.");
