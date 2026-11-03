# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** marketing strategist / analyst on an internal team that manages TikTok creator relationships. Their daily job is to keep a clean, searchable record of creators, import bulk data, and attribute individual creators to brand/product campaigns for reporting and outreach.

## Product Purpose

Creator Data Finder is an internal database tool for managing TikTok creator records. It stores a master list of creators (date, creator ID, TikTok URL/username, email), supports daily bulk import from CSV, and maintains a second "Hijack" dataset that attributes creators to specific brand/product campaigns. Success means the team can look up any creator by whatever identifier they have, pull the field they need, keep records deduplicated, and always know what was added and when.

## Positioning

Simultaneously manages two linked sets — the master **Listing** and the campaign-attribution **Hijack** dataset — and lets you search across them by any identifier (email, TikTok URL, username, auto-detected) and return any other field, including a "Match replies" mode that fills in creator data from Hijack matches against the Listing master.

## Operating Context

- Used daily by an internal team; data is loaded via daily CSV exports from Excel (~3,000 records/day), imported in batches of 500.
- Data is stored in Supabase (Postgres); access requires a Supabase login, and Row Level Security restricts reads/writes to authenticated users.
- Common operations are paste-heavy: users paste lists from Excel, paste into multi-row input grids, and copy results back out.
- The activity log shows a selected day's listing vs. hijack activity (5 rows by default) with copy-usernames/emails actions.
- Local development runs on Vite; the app is also deployable to GitHub Pages (frontend only, database stays in Supabase).

## Capabilities and Constraints

Confirmed capabilities:
- **Single search** by email, TikTok URL, or username (with auto-detect), returning full record details.
- **Batch search** over pasted inputs with selectable search field, return field (Email / TikTok URL / TikTok username / Date), status per input (Found, Not Found, Duplicate Input, Multiple Matches), and match count.
- **Batch "Match replies"** mode: accepts emails/usernames/TikToks, matches against Hijack data first, then completes creator data from the master Listing.
- **Add records** manual grid with paste-from-Excel column fill, "fill date down", keyboard undo, and duplicate checking against both Listing and Hijack before saving.
- **CSV import** with preview and progress, and bulk delete by date or delete-all.
- **Hijack records** panel with a brand/product catalog picker (searches available brands/products) and saves rows attributed to a chosen campaign target.
- **Pipeline and Duplicate-check** panels.
- **Dashboard** metrics: Listing vs. Hijack monthly counts, monthly total, top brand and top product.

Constraints and notes:
- `service_role` key must not be used in the browser; only publishable/anon key is exposed client-side.
- Production data would need backups, an admin role, and a duplicate-review process before allowing all users to delete.

## Brand Commitments

- Product name: **Creator Data Finder**.
- Header eyebrow copy: "CLOUD CREATOR DATABASE".
- **Interface language is English** (confirmed). Some legacy UI copy is in Indonesian; future work should use English as the primary interface language. The README documentation is in Indonesian.

## Evidence on Hand

- `README.md` — documents setup, Supabase configuration, daily CSV workflow, batch search examples, and GitHub Pages deployment.
- `supabase/schema.sql` — defines the `creators` table, search indexes, and Row Level Security rules.
- `public/brand-catalog.json` — brand/product catalog used by the Hijack target picker.
- `scripts/migrate-useeview-to-justin.mjs` — a one-time data migration script.
- `src/main.tsx`, `src/services/*`, `src/components/PipelinePanel.tsx`, `src/components/DupCheckPanel.tsx` — implementation of the features above.

## Product Principles

1. **Any identifier in, any field out** — search should accept whatever the user has (email, URL, username) and return whatever they need.
2. **Listing and Hijack are distinct but linked** — keep the master creator list and campaign-attribution records as separate, auditable datasets.
3. **Bulk and paste-first** — the tool is built around importing and processing many records at once (CSV batches, pasted lists), not single-record data entry.
4. **Safety on destructive actions** — deletes and duplicates are gated with confirmation and duplicate checks; data stays protected behind login and RLS.
5. **Data provenance is visible** — the activity log and dashboard always show what was added, when, and whether it was listing or hijack records.
