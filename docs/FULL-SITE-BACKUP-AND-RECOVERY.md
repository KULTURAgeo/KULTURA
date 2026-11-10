# KULTURA — Complete Source Backup & Recovery Guide

Baseline date: **2026-11-10**  
Production URL: https://kultura-liart.vercel.app  
GitHub repository: https://github.com/KULTURAgeo/KULTURA  
Source baseline immediately before preservation setup: `a74e39f854df16397c03b12422e63ce97ef111bf`  
Production hosting: Vercel; application: Next.js / React / TypeScript; data platform: Supabase / PostgreSQL.

## 1. What is backed up

All **Git-tracked source files** are included in the source ZIP: Next.js app, components, server actions, public images, CSS, configurations, deployment files, scripts, dependency lockfile, SQL migrations, documentation and tests. A change history snapshot accompanies each automated ZIP.

The ZIP deliberately does **not** contain runtime secrets, private environment files, live production customer data, session records, database rows, deployed Supabase Storage objects, or deployment account credentials. The Git ZIP is a **complete source-code backup**, not a fully functioning copy of all external services or a point-in-time database recovery image.

## 2. Download the complete code immediately

- Latest source from main: https://github.com/KULTURAgeo/KULTURA/archive/refs/heads/main.zip
- Pinned snapshot before the backup workflow: https://github.com/KULTURAgeo/KULTURA/archive/a74e39f854df16397c03b12422e63ce97ef111bf.zip
- GitHub commits / changes: https://github.com/KULTURAgeo/KULTURA/commits/main
- GitHub Actions runs (future source ZIPs): https://github.com/KULTURAgeo/KULTURA/actions/workflows/source-backup.yml

Download the ZIP and keep **an independent copy off GitHub** (e.g. an encrypted external drive or a private cloud drive). A ZIP of main includes only the current files; Git commit history on GitHub retains earlier versions. To preserve full history offline, use `git clone --mirror https://github.com/KULTURAgeo/KULTURA.git` and store that mirror privately.

## 3. Automatic source snapshots

The workflow at `.github/workflows/source-backup.yml` runs on pushes to `main` (and manually from Actions), and creates an artifact:
`KULTURA-source-<commit SHA>`

Each artifact includes:
- `KULTURA-source-<commit SHA>.zip` — tracked project source + `SITE_CHANGE_HISTORY.txt`.
- `SHA256SUMS.txt` — checksum for integrity checking.

**Important:** GitHub Actions artifacts have an expiration period (configured to 90 days, or the repository/organization limit if lower). The GitHub repository's revision history and your independently downloaded archives are the durable copies.

## 4. Database — back up separately

Production Supabase project is `KULTURA` (project ref: `asnkxfudkodgyhdawhfq`); the staging project `KULTURA staging` (ref: `fpahkxmlcvywspamftma`) is **not** the production database.

- Inspect backups at https://supabase.com/dashboard/project/asnkxfudkodgyhdawhfq/database/backups.
- Check whether your Supabase plan has automatic daily backups and their retention.
- For a portable **complete live database copy** (including orders/customer rows, RLS policies and schema), perform an encrypted/private logical export using the official Supabase CLI `db dump` or approved `pg_dump` workflow. Never upload the dump into the public GitHub repository.
- Back up actual objects in the Supabase Storage buckets **separately**. Database backups contain storage metadata, **not** the image/object bytes.
- Preserve the existing `supabase/migrations` AND `docs/production-migrations` directories. The historical production database is **not cleanly aligned to ordinary CLI migration history**; review `docs/production-migrations/README.md` and `docs/PRODUCTION-COMPATIBILITY-PLAN.md` before applying migrations. **Do not run `supabase db push` blindly against production.**

Official Supabase backup documentation: https://supabase.com/docs/guides/platform/backups

## 5. Secrets and integrations — recover separately

In the private password manager / secure vault, retain the ability to configure:
- Supabase public URL/publishable key, any authorized backend-only keys.
- Vercel Production/Preview environment variables.
- Redis/rate-limiting integration settings.
- Payment, shipping, notification and third-party credentials (if configured).
- Custom domain and DNS ownership, OAuth/auth settings and Supabase Storage policies.

Names of expected variables are listed safely in `.env.example`. Do not store their real values in ZIPs, the repository, screenshots or these docs.

## 6. Restore the code onto a new machine or host

1. Extract the downloaded KULTURA source ZIP or clone the GitHub repo.
2. Install **Node.js 24** and the package manager pinned in `package.json` (`pnpm@11.25.0`).
3. Run `pnpm install --frozen-lockfile`.
4. Configure required variables privately based on `.env.example`, pointed at the intended environment.
5. Run `pnpm typecheck`, `pnpm lint`, `pnpm build` and appropriate tests.
6. Deploy to Vercel or another Next.js-capable host. Configure the same environment variables, domains and security settings.
7. Independently restore/attach the **proper** Supabase database and Storage backup after checking schema and policies; never overwrite a production database on assumption.
8. Check login/admin authorization, catalog, X/Y/UNISEX visibility, checkout and order workflows, webhooks, image loading, SEO settings and responsive layouts.

Production deploy guidance: `docs/DEPLOYMENT.md`; production migration context: `docs/production-migrations/README.md`.

## 7. Rollback and change tracking

- Before changes: note the existing production deployment/commit and verify a backup is available.
- Make one logical Git commit for each change and update `docs/SITE-CHANGELOG.md` with what changed.
- GitHub commit history records exact file diffs; a new source archive is triggered automatically on a push to main.
- For an emergency code rollback, redeploy a previously verified Git commit/Vercel deployment. **Code rollback does not reverse database schema/data modifications.** Reversing live data or schema must be planned and performed separately.

## 8. Backup completeness checklist

- [x] Git-tracked full application code and public images in source archive.
- [x] SQL migrations and database-related scripts in source archive.
- [x] Current design and routing files in source archive.
- [x] Human-readable change log and Git commit history references.
- [x] Automated archive on each main-branch push.
- [ ] Encrypted production Supabase **data** backup verified and stored separately.
- [ ] Supabase Storage contents backed up privately.
- [ ] Real production environment values recorded in a secure vault.
- [ ] Test-restore onto a separate environment.

A checked code backup is not by itself evidence that a full production application could be recovered without its associated data, assets and credentials.
