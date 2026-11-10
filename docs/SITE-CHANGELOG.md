# KULTURA — Change Log

Keep this document up to date whenever storefront code, database schema, assets or admin behavior changes. Git commit history is the authoritative fine-grained audit trail; this file is the human-readable summary.

## 2026-11-10 — Wishlist heart next to the shopping bag

- Added a small outlined heart directly before the cart icon in the shared site header.
- Heart links to the existing protected `/account/wishlist` page and reuses the same accessible icon treatment in both light and dark themes.
- On the narrowest phones the duplicate account button is hidden (the account remains in the mobile menu), keeping the heart and bag visible.
- Existing wishlist data, account security and bag behavior are unchanged.

## 2026-11-10 — Full-screen theme ripple on every visible UI section

- Expanded the established SHOP / DROPS / ABOUT view-transition ripple to visible titles, descriptions, buttons, form fields, controls, cards, icons, product imagery and footer elements.
- The existing left-to-right / right-to-left theme wipe remains intact. Individual named View Transition snapshots reveal at their matching horizontal positions, then ripple like the top menu words.
- Named snapshots are assigned only to visible items during the transition, capped at 72 on desktop / 44 on mobile for performance and automatically restored afterward.
- The existing named navigation transitions are excluded from the general wave to prevent double animation.
- Browsers without View Transitions get a lightweight direct-animation fallback. Reduced-motion preference bypasses all added motion.
- No product, account, payment, inventory, layout, image asset or database changes.

## 2026-11-10 — Match division navigation order and repair light-theme contrast

- Product division switcher now lists X → UNISEX → Y, matching the SHOP landing page.
- Switcher colors use site theme variables in light and dark mode; inactive options, hover and active tab all remain readable.
- Light-theme category buttons use stronger text/border colors and a dark active selection for clear state.
- Preserved light-on-dark text for product badges and order status badges, plus legible light-theme form success/error colors.
- No product, catalog assignment, routing or stored assets changed.

## 2026-11-10 — Center UNISEX on the SHOP landing

- Reordered the three full-height shop cards to X → UNISEX → Y on desktop and mobile.
- Made the center UNISEX column wider so its group photo has more room.
- Updated visible sequence labels 01 / 02 / 03; links, images, product assignments and the one-screen layout are unchanged.

## 2026-11-10 — Full-viewport three-column SHOP landing

- Removed the global "INDEPENDENT SPIRIT. EVERYDAY UNIFORM." announcement strip from the Header component.
- The SHOP gateway title now starts closer to the header with compact spacing.
- X, Y and UNISEX category cards appear in **one horizontal row** on desktop, with viewport-height responsive cards to show the complete entry layout without vertical scrolling on typical desktop screens.
- The UNISEX group image uses a dual background treatment: an uncropped contain layer over a cover layer.
- On mobile, the three cards remain in one horizontally swipeable row with scroll snapping instead of shrinking to illegible narrow tiles.
- Links, admin controls, product division membership, and product photos are unchanged.

## 2026-11-10 — Redirect to admin products after deletion

- Product deletion now returns a full-page redirect to `/admin/products`, including the image-cleanup-warning outcome.
- Client-side action form starts the full navigation as soon as a successful destructive action returns, without waiting for the deleted product page to re-render.
- Removed direct revalidation of the deleted `/admin/products/[id]` detail route, which could trigger a 404 before navigation.
- Failed deletion stays on the existing edit form with a visible error. No product data was changed in this code update.

## 2026-11-10 — Client-side 4:5 product photo preview and upload

- ProductImagePicker now prepares the actual selected image on a white 4:5 canvas as soon as the user chooses it.
- Image conversion preserves the full product without cropping, stretching or artificial upscaling, using high-quality WebP with a 3 MB limit.
- The transformed WebP is assigned back to the real file input, so the form submits the processed file rather than the original.
- The preview renders the same selected processed file and identifies it as ready; submission is blocked until conversion succeeds.
- Applies to the new-product form and the existing-product image-upload form.
- Server-side image verification and re-encoding still enforce file type and upload limits. Existing product images are not rewritten.

## 2026-11-10 — Fix overriding product-card background rule

- Root cause: a later shared CSS rule `.product-image, .gallery-main { background: #8b8b8b }` was overriding the earlier white product-card background.
- Separated the styles to keep `.product-image` white while preserving the detail gallery's grey styling.
- Existing photos now display white letterboxing rather than gray/brown bands, with `object-fit: contain` and no garment cropping or pixel distortion.
- No product data or original photo files were changed.

## 2026-11-10 — Remove letterbox bars and auto-pad new product photos

- Changed the product card fallback background from grey to white so existing white-background products no longer show grey horizontal bands.
- New product uploads are automatically laid out onto a matching 4:5 canvas, padded using the input photo's top-left background color, or white for transparent photos.
- Full product imagery remains visible without stretching, cropping, artificial upscale or modifying garment details. The padding respects original image proportions.
- Canvas output is capped at 1600 × 2000 and encoded as high-quality WebP using the existing file size limit.
- Older uploaded images are not rewritten or deleted; mixed-background legacy photos may still benefit from a fresh upload.

## 2026-11-10 — Consistent, high-quality product image presentation

- Product cards now show images inside a uniform 4:5 frame with `object-fit: contain`, preserving every edge instead of cropping or stretching differing aspect ratios.
- New product image uploads retain original proportions and EXIF orientation; only source files exceeding 2400px on an edge are downscaled, never upscaled.
- Upload WebP encoding now attempts quality 95, 92, 88, then 85 if necessary to stay within the preexisting 3 MB upload limit.
- Product card delivery requests Next.js optimized image quality 90; permitted optimized quality values are explicit in Next.js config.
- Existing stored product photos are not destructively rewritten. Source images that are already blurry cannot gain missing details.

## 2026-11-10 — Division Switcher navigation

- Added a three-option switcher between the X / Y / UNISEX page heading and catalog filters on all shop division pages.
- Current division has a white background and `aria-current="page"`; other divisions link directly without returning to the SHOP landing page.
- Styled for desktop and mobile using scoped CSS, keyboard focus indicators and accessible navigation label.
- This is presentation-only: product visibility, inventory and admin behavior remain unchanged.

## 2026-11-10 — Shop division heading labels

- `/shop/x` now displays **X - WOMAN**, `/shop/y` displays **Y - MEN**.
- `/shop/unisex` remains **UNISEX**; catalog products and filters remain unchanged.
- The generated page title metadata uses the same labels.

## 2026-11-10 — XYS product visibility in all three divisions

- Admin Product Editor SHOP DIVISION now includes XYS — All 3 divisions.
- XYS products are linked to all three existing shop collections (X, Y and UNISEX) by the existing atomic admin product-save RPC.
- Editing a product back to a single division removes its other two shop-collection associations.
- XYS products require a category marked XYS so shared items have a valid category in all three shop sections.
- The editor detects three existing shop-collection links and selects XYS when reopening the product; no products were reassigned automatically.
- X/Y/UNISEX-exclusive products and category behavior remain unchanged; new Git commit is included in the backup history.

## 2026-11-10 — XYS shared category availability

- Added XYS to the Admin Categories shop division dropdown.
- XYS categories can be used by products assigned individually to X, Y, or UNISEX, without copying products between divisions.
- Existing category X/Y/UNISEX behavior is unchanged. UNISEX products stay in UNISEX only.
- Reassigning an existing populated category to XYS is permitted; changing from XYS to an exclusive division still requires moving products first.
- Updated the Supabase production and staging `categories_audience_check` constraints; changes are backed up with Git history and a new migration record.

## 2026-11-10 — Category division assignments

- Added SHOP DIVISION (X / Y / UNISEX) to Admin → Categories create/edit forms and category summary table.
- A category now stores its own division; existing categories remain unassigned until explicitly edited.
- Saving a product rejects a mismatch between its shop division and its category division.
- To prevent silently moving products, a populated category cannot be reassigned to a different division; reassign its products first.
- Production and staging Supabase schema updated with a nullable `categories.audience` check-constrained column.
- Each source change is tracked in Git and included in the existing source-backup workflow.

## 2026-11-10 — Initial preservation baseline

- SHOP landing changed from direct OUTERWEAR/SHOES category tiles to three divisions: **X** (women), **Y** (men), and full-width **UNISEX**.
- Admin Product Editor now requires a single SHOP DIVISION selection (X / Y / UNISEX) when saving a product.
- Public division pages `/shop/x`, `/shop/y`, `/shop/unisex` read only products assigned to their own corresponding collections.
- Separate Supabase collection records created for `shop-x`, `shop-y`, `shop-unisex`. Pre-existing products were not automatically assigned.
- Three approved editorial images used for the division cards; assets subsequently replaced with higher-resolution versions:
  - `public/images/shop-x.webp`
  - `public/images/shop-y.webp`
  - `public/images/shop-unisex.webp`
- Source snapshot before preservation workflow: `a74e39f854df16397c03b12422e63ce97ef111bf`.
- Added preservation documentation and a GitHub Actions source-archive workflow to export each subsequent main-branch source revision.

### Background, not deployed changes

Standalone HTML product-viewer, Complete-the-Look and filter/sort mockups were explored in conversation. They must **not** be assumed to be in production unless their related source changes appear in Git history.

## Adding future changes

For each meaningful update, append:
- Date, change summary, affected pages/components.
- Database migration and deployed environment, if any.
- Commit SHA or PR URL.
- Verification status and any rollback notes.

Do not log environment variable values, access tokens, API secrets, passwords, private customer information, or production database dumps here.
