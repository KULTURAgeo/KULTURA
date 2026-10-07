# Homepage globe asset repair

Based on GitHub main `df686f4143d484764f508c2f679a08e336e54ba0`.

Both production paths existed, but their bytes were not valid images. The phone
PNG lacked a PNG signature; the scene JPEG had a header but could not decode.
The repository's original JPEG also failed decoding. In the live browser both
logo images reported `complete: true` with natural width/height zero.

Restored `public/images/kultura-globe-original.jpeg` from the supplied
`KULTURA - LOGO.jpeg`, byte-for-byte (1254×1254). No artwork was redrawn.
`pnpm assets:logos` creates lossless WebP crops from that source:

- `/images/kultura-globe-scene.webp`: 1091×630, native resolution, no upscaling.
- `/images/kultura-globe-phone.webp`: 256×138, tightly cropped full globe.

Removed the two corrupt render assets and replaced their only source references
in `src/app/page.tsx`. Filenames use exact lowercase root-relative public paths.
Next Image already used `unoptimized`, emitting a normal direct-source img; it
was not the failure. Kept it and enabled eager loading for the animated logos.
No animation code, timing, transforms, CSS, card positions, navigation, or
stacking levels changed. The phone pill remains 64×26 with contain fitting.

Verification:

- TypeScript and lint passed; 154 existing automated checks passed.
- Production `next build` passed.
- `pnpm test:logos` fully decodes both images, checks exact filenames, resolution,
  nonempty artwork and tight but unclipped badge bounds. Included in `pnpm check`.
- With `QA_BASE_URL=http://127.0.0.1:3002`, the same test verified the production
  server returned HTTP 200, image/webp, exact file bytes, and the built homepage
  referenced both direct asset URLs.
- Visually checked the actual production build in a 1440×900 browser at the phone
  and final transition stages. Both logos render; scene z-index 0 remains below
  card layer z-index 2. Both images have object-fit contain, opacity 1 and no filter.
  No browser console errors. Screenshots: `qa/logo-phone-desktop.png` and
  `qa/logo-scene-desktop.png` (local QA images are ignored by Git).
- Local catalog was unconfigured, so cards used the homepage's existing campaign
  image fallback. No production data or styles were changed for testing.

The aggregate check has one pre-existing failure on main: `pnpm db:types:check`
reports stale generated database types. Database sources/types/generator were
not modified by this asset fix. This is separate from the passing TypeScript,
test suites and production build.

Changes are local on branch `fix/kultura-logo-assets`. Production still needs
the fix merged and deployed; visual verification above is of the local production
build, not a claim that the public Vercel deployment has already changed.
