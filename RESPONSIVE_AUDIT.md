# Responsive Audit — Baseline Findings (measured, 2026-09-07)

Harness: `tools/shoot.mjs` (Playwright + Chromium, Supabase REST/auth stubbed).
Run with: `npm run dev` then `OUT_DIR=gui-test-screenshots/before node tools/shoot.mjs`
Widths captured: 375x812 (mobile, touch), 768x1024 (tablet, touch), 1280x900 (desktop).
Pages: dashboard `/`, assets `/assets`, settings `/settings`, audit `/audit`,
membership `/membership`, admin `/admin`.

Baseline screenshots: `gui-test-screenshots/before/`

## Confirmed defects at 375px

1. **Header overflows the viewport — worst offender.**
   Dashboard full-page screenshot renders **519px wide at a 375px viewport**
   (`01-dashboard_375.png` = 519x3877). The header row keeps business name,
   bell, Export CSV, refresh, A+, theme toggle, and logout all on one line with
   no wrap/hide. Export CSV is the main culprit and per the brief must move into
   a `⋯` menu, leaving only: business name + bell + `⋯`.

2. **Assets page overflows to 625px** at a 375px viewport
   (`02-assets_375.png` = 625x2403). Header is the same problem plus the
   `+ เพิ่มสินทรัพย์` button sitting inline.

3. **Modal footer buttons are below the 44px tap minimum — the "กดไม่ติด" cause.**
   Footers use `py-2.5 text-sm`, which computes to roughly **38px tall**.
   There are **12 modals** matching the `fixed inset-0 z-…` + `max-w-…` shell
   pattern. All need: bottom sheet at 375px (`rounded-t-3xl`, `max-h-[92vh]`,
   internal scroll) and full-width `py-4` confirm/save buttons.

4. **Audit-log table has no horizontal-scroll wrapper.** The `<table>` in the
   audit view is not wrapped in `overflow-x-auto`, so it forces page-level
   horizontal overflow instead of scrolling within its own container. Per the
   brief this table (plus members/admins/history) should become stacked cards at
   375px and revert to the table at 768px+.

## Confirmed good

- **768px has no horizontal overflow** (`01-dashboard_768.png` = 768x2821).
  The tablet problems are grid density and tap-target size, not overflow.
- **BillPage is already mobile-first** — uses `max-w-md` centering, so it stays
  centered and correct at 768px and above. Needs verification only, not changes.
- **1280px desktop layout is intact** and must not be touched; every fix below
  belongs behind a `sm:`/`lg:` boundary so desktop output is byte-identical.

## Remaining work (not yet started — no source edits were made)

- Bottom nav (4 buttons + founder's 5th admin button), 56px tall, shown below
  `lg`, hidden at `lg:` where the existing sidebar takes over.
- Header: collapse to name + bell + `⋯` overflow menu on small widths.
- Dashboard: KPI 2-col at 375 / 4-col at 768; chase + slip approve/reject rows
  to `flex-col` full-width; charts `h-40` at 375.
- Assets: full-width manage buttons, `overflow-x-auto` type tabs, `py-3` search,
  2-col cards at 768.
- Tables → stacked cards below `sm`.
- Verify: `npm run build` passes and lint reports 0 errors; re-shoot into
  `gui-test-screenshots/after/` and diff against `before/`.

**No application logic should change** — these are all presentational
class-level changes.
