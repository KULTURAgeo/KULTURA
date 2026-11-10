# KULTURA — Change Log

Keep this document up to date whenever storefront code, database schema, assets or admin behavior changes. Git commit history is the authoritative fine-grained audit trail; this file is the human-readable summary.

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
