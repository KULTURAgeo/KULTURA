# KULTURA — Change Log

Keep this document up to date whenever storefront code, database schema, assets or admin behavior changes. Git commit history is the authoritative fine-grained audit trail; this file is the human-readable summary.

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
