import type { Locale } from "./i18n";

// Display-only translation. Category slug and database name remain untouched
// so filtering, SEO slugs, admin tools and stock references do not change.
const bySlug: Record<string, string> = {
  clothing: "ტანსაცმელი",
  clothes: "ტანსაცმელი",
  apparel: "ტანსაცმელი",
  hoodies: "ჰუდები",
  hoodie: "ჰუდები",
  sweatshirts: "სვიტშოტები",
  sweaters: "სვიტერები",
  tees: "მაისურები",
  tshirts: "მაისურები",
  "t-shirts": "მაისურები",
  shirts: "პერანგები",
  tops: "ზედები",
  pants: "შარვლები",
  trousers: "შარვლები",
  jeans: "ჯინსები",
  shorts: "შორტები",
  jackets: "ქურთუკები",
  outerwear: "ზედა ტანსაცმელი",
  coats: "პალტოები",
  dresses: "კაბები",
  skirts: "ქვედაბოლოები",
  sets: "კომპლექტები",
  shoes: "ფეხსაცმელი",
  footwear: "ფეხსაცმელი",
  sneakers: "კედები",
  boots: "ჩექმები",
  sandals: "სანდლები",
  accessories: "აქსესუარები",
  accessory: "აქსესუარები",
  bags: "ჩანთები",
  hats: "ქუდები",
  caps: "კეპები",
  jewelry: "სამკაულები",
  jewellery: "სამკაულები",
  belts: "ქამრები",
  socks: "წინდები",
  "new-arrivals": "სიახლეები",
  uncategorized: "კატეგორიის გარეშე",
};
const byName: Record<string, string> = {
  "t shirts": "მაისურები",
  "t shirt": "მაისურები",
  "t-shirts": "მაისურები",
  "t-shirt": "მაისურები",
  "sweatshirt": "სვიტშოტები",
  "clothing & apparel": "ტანსაცმელი",
  "clothing and apparel": "ტანსაცმელი",
};
export function categoryDisplayName(locale: Locale, name: string, slug?: string): string {
  if (locale === "en") return name;
  const key = slug?.trim().toLowerCase();
  if (key && bySlug[key]) return bySlug[key];
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  return byName[normalized] ?? bySlug[normalized.replace(/\s+/g, "-")] ?? name;
}
const colorNames: Record<string, string> = {
  black: "შავი", white: "თეთრი", grey: "ნაცრისფერი", gray: "ნაცრისფერი",
  silver: "ვერცხლისფერი", red: "წითელი", blue: "ლურჯი", navy: "მუქი ლურჯი",
  green: "მწვანე", pink: "ვარდისფერი", yellow: "ყვითელი", beige: "ბეჟი",
  brown: "ყავისფერი", cream: "კრემისფერი", purple: "იისფერი", orange: "ნარინჯისფერი",
  gold: "ოქროსფერი", multicolor: "მრავალფეროვანი",
};
export function colorDisplayName(locale: Locale, name: string): string {
  return locale === "ka" ? colorNames[name.trim().toLowerCase()] ?? name : name;
}
