# Branch cleanup recovery manifest — 2026-10-07

Production `main` was **not modified** during this cleanup setup.

Safety snapshot: `backup/pre-cleanup-2026-10-07` points to the pre-cleanup `main` commit.

## Branch refs before deletion

| Branch | Commit SHA | Classification |
|---|---|---|
| `admin-account-performance` | `a1c7adbc47f39622bd9ed2105b7b90289468df66` | SAFE-CLEANUP (ahead=0 vs main) |
| `admin-first-render-performance` | `076e4a0a825d87f3ffffa8298a74f7be563db92a` | SAFE-CLEANUP (ahead=0 vs main) |
| `admin-fulfillment-controls` | `247466bb379f4ac3e786608c2235e17b8a9b6c8b` | REVIEW BEFORE DELETE |
| `admin-inventory-panel` | `c8fcc366c12b48031cec065bc3f2e81e0352ae1a` | SAFE-CLEANUP (ahead=0 vs main) |
| `admin-orders-dashboard` | `f9adf93d940a348bbad597b45d4cdfdd5019bb2f` | REVIEW BEFORE DELETE |
| `admin-shipping-settings` | `b765fbadfde7b23ec06254de1f380b9f6ae3d23b` | SAFE-CLEANUP (ahead=0 vs main) |
| `analytics-meta-pixel` | `67e0e9742c72ed2e621592cdaec051c3c2e5f6ff` | REVIEW BEFORE DELETE |
| `animejs-home-motion` | `fcb0e4b001aa6894bb919093e8ba2f56f0959ca6` | SAFE-CLEANUP (ahead=0 vs main) |
| `backup/pre-cleanup-2026-10-07` | `52b15fd262755ae7ae51bbb88b7c5853d4b7f0b6` | SAFETY/WORK |
| `categories-admin-shop` | `3d5b29d9bb12cc658d99a9104e3ff614c618ab07` | SAFE-CLEANUP (ahead=0 vs main) |
| `checkout-page` | `14cde5de3dfefe61d31a897e866feb75e8642134` | REVIEW BEFORE DELETE |
| `cookie-consent` | `6af61d653f61898918b0e299f6ded2a0d9877dfb` | REVIEW BEFORE DELETE |
| `customer-order-detail` | `9d6b41e6845b07145d5abceb298dbc79f646b3ac` | SAFE-CLEANUP (ahead=0 vs main) |
| `customer-order-status-ui` | `834617641281111b34970757f6baff348a051d8a` | SAFE-CLEANUP (ahead=0 vs main) |
| `edit-product-image-preview` | `89f39e00e02fbb31d46b084e83ca6ce5ee5c0c83` | SAFE-CLEANUP (ahead=0 vs main) |
| `email-sms-notifications` | `73b3ff3d33ea26c93597221f56bb189e1100e86b` | SAFE-CLEANUP (ahead=0 vs main) |
| `feature/full-commerce-polish-20261001` | `26559ec1a15dbd3625d0b16b038cda2914997123` | SAFE-CLEANUP (ahead=0 vs main) |
| `fix/kultura-logo-assets` | `4ae5aceb1cfe49628be60a7b974d029e2d4a2ba9` | SAFE-CLEANUP (ahead=0 vs main) |
| `fix/kultura-logo-preview` | `6f698117fff5b2aef6913ebb80ddb7ae9f735f1a` | REVIEW BEFORE DELETE |
| `fix-order-total-fit` | `2d1f38988e0dbcd1d392b8b162bf3579c035050d` | REVIEW BEFORE DELETE |
| `internal-pages-performance` | `850e5cd0b703ea4ba31ded5edc47aaa6155d2665` | SAFE-CLEANUP (ahead=0 vs main) |
| `main` | `52b15fd262755ae7ae51bbb88b7c5853d4b7f0b6` | PRODUCTION |
| `maintenance/cleanup-2026-10-07` | `52b15fd262755ae7ae51bbb88b7c5853d4b7f0b6` | SAFETY/WORK |
| `order-confirmation-production` | `0b41c617909b0af70d601753738bf24cc380c703` | REVIEW BEFORE DELETE |
| `performance-cleanup-ui` | `8596e1550ba84af713ae9c07818ac470b8618056` | REVIEW BEFORE DELETE |
| `performance-optimization` | `1ebb3ed9aca5b26cc61d7f73cf8b2728dfb7bd18` | REVIEW BEFORE DELETE |
| `performance-pass-2` | `f9472e880d86de78f027badedec2a32a76abec67` | REVIEW BEFORE DELETE |
| `polish-customer-order-detail` | `63577ee9057260170739f33bd78fa75e1cf3a2a2` | SAFE-CLEANUP (ahead=0 vs main) |
| `privacy-policy` | `e82bddee0788d6b5b94629b201c6d2c3cc1b8d91` | REVIEW BEFORE DELETE |
| `product-image-on-create` | `926a3783b5336debd46179fafee7d44399dbffd6` | SAFE-CLEANUP (ahead=0 vs main) |
| `product-image-preview` | `f35a2c0294a04adf95ffd876a124825c115bba48` | SAFE-CLEANUP (ahead=0 vs main) |
| `product-quantity-selector` | `ad0eb7f836c94dc7208aa1e3cafab00a73166b9e` | REVIEW BEFORE DELETE |
| `promo-codes` | `8ee7cd36b4ea8f0de442258cc5c70ec03ebb9ff0` | REVIEW BEFORE DELETE |
| `return-refund-requests` | `32ec0ab32449d5743c7ae6fddcb0b47fe708e2cf` | SAFE-CLEANUP (ahead=0 vs main) |
| `search-filters` | `0e7d7cdd8d486f56da087c46aa9cb0d070b1b68f` | SAFE-CLEANUP (ahead=0 vs main) |
| `security-hardening-2026-10-06` | `d7a34bd7cf7905f39a6c547a213a0d7854da672d` | REVIEW BEFORE DELETE |
| `seo-google-setup` | `3d9a011bf89545439c1656a6aa91ba2f07398e8d` | REVIEW BEFORE DELETE |
| `seo-hide-test-content` | `e9455df9e660ee5cc027e9cf4c6315916b41b6e1` | REVIEW BEFORE DELETE |
| `shipping-returns-policy` | `2d80cb43a45d9e253f57d38ec8d6b51a6c2224e5` | REVIEW BEFORE DELETE |
| `static-product-pages` | `57d41755c45426b39d9c764ec76fc3933985ae27` | SAFE-CLEANUP (ahead=0 vs main) |
| `storefront-engagement-analytics` | `e3a84402c6776280f4e4d9f364555a1442620ff9` | SAFE-CLEANUP (ahead=0 vs main) |
| `stripe-test-checkout` | `23408f83e7b1c4a62f180e6fc18ba5a3e501c267` | REVIEW BEFORE DELETE |
| `supabase-query-performance` | `d14e1b755fb40f17590593592ac94c264d9d05f6` | SAFE-CLEANUP (ahead=0 vs main) |
| `terms-conditions` | `75fc9d6e727227c1d49566c49ada6fc819102c47` | REVIEW BEFORE DELETE |
| `test-checkout-flow` | `7b0dd86c620b8b831d8400c298230600303ae69a` | REVIEW BEFORE DELETE |
| `tinker-faithful-motion-v3` | `a1fe9546e1ea55f465b88050a84c27429b6226aa` | SAFE-CLEANUP (ahead=0 vs main) |
| `tinker-inspired-home` | `a18f619fce83ef44603ab5146769f74caf18b636` | SAFE-CLEANUP (ahead=0 vs main) |
| `tinker-inspired-scroll-v2` | `64c2f6bc775085e05db38dd041b7f13a515d64c2` | REVIEW BEFORE DELETE |

## Restore procedure

If any deleted branch ever needs to be restored, recreate the branch using the exact commit SHA listed above. Deleting a branch does not delete commits that remain reachable from `main` or another ref.
