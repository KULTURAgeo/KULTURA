// Top-level application segments. Checked against src/app by test:security.
// Reject unknown information routes before the root loading boundary streams a 200.
export const applicationSegments = [
  "account", "admin", "auth", "cart", "checkout", "drops", "forgot-password",
  "login", "order-confirmation", "product", "register", "reset-password", "shop",
  "about", "contact", "shipping", "returns", "privacy", "terms", "size-guide",
] as const;

export function unknownRootRoute(pathname: string | null) {
  if (!pathname || pathname === "/") return false;
  const segment = pathname.split("/")[1];
  return !applicationSegments.some((value) => value === segment);
}
