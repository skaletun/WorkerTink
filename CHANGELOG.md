# Changelog

## 2.5.0

### Calculation core
- Reworked shift-hour accounting: planned hours, manual extra shifts and actual work are separated.
- Added configurable night-shift premium with a 20% default.
- Holiday premium is now calculated from worked hours, including 24-hour `full` shifts.
- Manual work added to a scheduled day off is treated as an extra paid shift instead of changing the monthly salary denominator.
- Income history is sorted chronologically before averaging.
- `7/0` now uses the configured 1–6 month continuous work period; after the selected period the schedule becomes `off` until a new start date is configured.
- Dates before `startDate` remain outside the schedule and payroll.

### Storage
- Introduced schema version `4`.
- Added normalization for imported JSON as well as normal loads.
- Added migration handling for legacy `v2`/`v3` storage keys.
- Invalid storage is copied to a recovery snapshot when possible before falling back to defaults.

### Vacation and absence
- Vacation usage in the overview now excludes non-working federal holidays from the used vacation-day count.

### Notes
- Moved Markdown/WYSIWYG conversion logic out of `App.tsx` into `src/markdown.ts`.
- Preserved the inline WYSIWYG editor, mobile toolbar and Markdown table support.

### Documentation / CI
- Rewrote README to match the actual product and its limitations.
- GitHub Pages workflow now runs the test suite before production build.
- Added regression coverage for night premiums, extra shifts, income ordering, vacation holidays and storage migration.
