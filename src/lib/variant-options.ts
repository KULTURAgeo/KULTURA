export const STANDARD_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

const SWATCHES = new Map(Object.entries({
  black: "#181818", brown: "#75533a", white: "#ffffff", cream: "#f0e4ce",
  gray: "#808080", grey: "#808080", navy: "#23365c", blue: "#345cb8",
  green: "#41684d", red: "#b33336", beige: "#c7af87", pink: "#d990ab",
  "შავი": "#181818", "ყავისფერი": "#75533a", "თეთრი": "#ffffff",
}));

export function optionKey(value: string) {
  return value.trim().toLowerCase();
}

export function defaultSwatch(color: string) {
  return SWATCHES.get(optionKey(color)) ?? "#777777";
}

export function orderSizes(values: readonly string[]) {
  return [...new Map(values.map((size) => [optionKey(size), size])).values()].sort((a, b) => {
    const rank = (size: string) => STANDARD_SIZES.indexOf(size.toUpperCase().replace("2XL", "XXL"));
    const first = rank(a), second = rank(b);
    return (first < 0 ? Infinity : first) - (second < 0 ? Infinity : second)
      || a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
  });
}

const COLOR_CODES = new Map(Object.entries({
  black: "BLK", brown: "BRN", white: "WHT", gray: "GRY", grey: "GRY",
  navy: "NVY", blue: "BLU", green: "GRN", red: "RED", beige: "BGE",
  "შავი": "BLK", "ყავისფერი": "BRN", "თეთრი": "WHT",
}));

function skuPart(value: string) {
  const ascii = value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (ascii) return ascii;
  let hash = 0;
  for (const character of optionKey(value)) hash = (Math.imul(hash, 31) + character.codePointAt(0)!) >>> 0;
  return hash.toString(36).toUpperCase();
}

export function defaultBaseSku(slug: string) {
  return skuPart(slug).slice(0, 40);
}

export function makeVariantSku(base: string, color: string, size: string, used: Set<string>) {
  const code = COLOR_CODES.get(optionKey(color)) ?? skuPart(color).slice(0, 24);
  const stem = `${base}-${code}-${skuPart(size).slice(0, 24)}`;
  let sku = stem;
  for (let n = 2; used.has(sku); n++) sku = `${stem}-${n}`;
  return sku;
}

export function variantOptionKey(color: string, size: string) {
  return JSON.stringify([optionKey(color), optionKey(size)]);
}
