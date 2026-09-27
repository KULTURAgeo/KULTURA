const TEST_PRODUCT_SLUGS = new Set([
  "kultura-test-t-shirt",
]);

const TEST_CATEGORY_SLUGS = new Set([
  "kultura-development-test-products",
]);

export function isSearchIndexableProductSlug(slug: string): boolean {
  return !TEST_PRODUCT_SLUGS.has(slug);
}

export function isSearchIndexableCategorySlug(slug: string): boolean {
  return !TEST_CATEGORY_SLUGS.has(slug);
}
