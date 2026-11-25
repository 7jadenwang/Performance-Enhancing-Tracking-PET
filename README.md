# PET — Training companion

A phone-friendly web app for following Linear and Undulating Periodization training programs, comparing planned and actual training, logging measured lifting velocity, and monitoring morning CMJ trends.

The repository’s original longer-term goals—creating monthly/quarterly plans and evaluating performance—remain future work. This version establishes the logging and measurement foundation needed to assess those features.

## Run locally

Use Node.js 24 or later.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. For a production preview with offline caching:

```sh
npm run build
npm run preview
```

The app is a static client application with optional private Supabase authentication and sync. It works locally without cloud configuration. A deployed static host must use HTTPS; localhost also supports service workers. `npm run dev` is for development and does not generate the production service worker. Install from the browser's Add to Home Screen / Install app option where supported. All 160 original images are included in the first offline cache preparation. Wait for **Offline ready** before disconnecting.

## Daily use

1. Set equipment availability in Settings, then choose LP or UP and queue/start an enrollment in Program. Running is always available. D1–D7 mean Monday–Sunday. Missing days are unspecified, not automatically rest days.
2. Enter three CMJ heights from your existing jump app, using a consistent protocol, and complete the optional recovery check-in. Invalid trials and unsuitable baseline days can be excluded. A changed protocol starts a separate comparison series.
3. Open the scheduled session or browse Program. Original Chinese plan images are bundled for inspection, including continuation pages.
4. Record actual sets. Copy planned sets creates **unconfirmed drafts**; confirm completed sets and choose partial/completed status to count their work. Record whole-session minutes and session RPE separately from exercise RPE.
5. Enter measured velocity, metric, device/method, and range of motion. Confirm what the source's MV target means before comparing it to your measurement. Per-repetition velocity loss needs a complete series; a set average alone cannot produce it.
6. Check Progress for load completeness and separate exercise-specific measures. Record an equipment substitution explicitly; running is not mechanically equivalent to rowing, skiing, or cycling.

## Records and backups

Personal workout, CMJ, recovery, and settings records are stored in IndexedDB **in your browser on your device**. They are never sent to GitHub. With configured Supabase, sign-in and an accepted link, saved records synchronize to your private account. Changing device/browser, clearing site data, or browser storage eviction can remove access to them.

Export a versioned JSON backup in Settings regularly. Import previews record counts and asks before replacing current records; export the current data first. Corrupt or incompatible imports leave existing data intact. Without configured sync, export/import transfers records between devices. Linked-account imports explicitly replace account history and queue those changes for other devices. The session editor can also export an unsaved entry if persistence fails; this single-entry recovery file is not a full-state backup.

GitHub stores the source code, lockfile, tests, specifications, and original program assets. Dependencies, build output, test output, execution scratch files, and personal backups are not intended for source control.

## Calculations and limits

- Internal session load: minutes × whole-session RPE (0–10), in arbitrary units. Planned duration/RPE must be entered explicitly. Missing measurements remain unknown and totals show completeness.
- External work retains its units: kilograms/repetitions, jumps, holds, sprint distances, interval work, and velocity are not added into a fictional universal score. Confirm per-hand versus total external load and per-side conventions. For per-hand weights, enter whether one or two hands carry a weight per repetition; this is independent of doing both working sides.
- A matching dated 1RM can produce target kilograms only where the source specifies its reference exercise. Different exercises and ranges of motion do not automatically share references. Saved historical workouts can be reopened from Progress even after rescheduling.
- CMJ baseline: first 14 eligible daily averages of three valid trials, mean and sample standard deviation. Establish it in Settings; it remains frozen until explicitly recalibrated. Prior baseline versions are retained.
- Low-CMJ signal: below baseline mean minus two SD. Zero variance suppresses the statistical flag. Questionnaire concern: fatigue/soreness/stress 4–5 or sleep quality 1–2. These are provisional product heuristics, not validated fatigue predictions. No flag detected does not guarantee readiness.
- Technique and take-off/landing posture affect flight-time-derived jump height. Height alone can miss fatigue-related changes in movement strategy.
- The app explains signals and preserves your original plan. It never silently changes prescribed work.

Research links and method descriptions are available in Settings and in the [design specification](docs/superpowers/specs/2026-10-13-training-companion-design.md).

## Program provenance

160 source images, 135 sessions, and 1,072 main prescription summaries. LP summaries live in `scripts/reviewed-prescriptions.json`. UP summaries live in `scripts/reviewed-up-prescriptions.json` and `scripts/reviewed-up-final-prescriptions.json`. Run `python scripts/import-program.py` to regenerate the bundled catalogue and source manifest.

Summaries retain the principal prescriptions; original images retain detailed coaching instructions and are the authority. Complex wave/cluster/circuit structures and source contradictions remain explicitly flagged rather than guessed. Source MV notation and unclear 1RM references require confirmation. Each completed set can be logged separately even when the original block cannot be safely flattened.

## Verify

```sh
npm test
npm run check:program
npm run typecheck
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Browser tests use installed system Chromium when available, otherwise Playwright's bundled Chromium. Override with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if needed. GitHub Actions runs the checks on feature-branch pushes and pull requests; no deployment is configured.

## LP and UP programs

Choose Linear Periodization (12 supplied weeks) or Undulating Periodization (16 supplied weeks). Program phases are named for their training purpose, with the original images available for reference. UP Phase 3 emphasizes velocity-guided strength, reactive power, and jump and lift testing. Phase 4 emphasizes bar-speed baselines and fixed-load comparisons alongside Zone 2 work, FTP testing, and sprint performance. D1 is Monday through D7 Sunday. Start dates anchor the chosen entry on/after your requested date. Rescheduling preserves recorded actual dates.

Progress shows every prescribed source week before logging. Weight volume, repetitions, relative intensity, rest, cluster rest, compatible velocity, jump contacts/demand, sprint distance and conditioning work/recovery stay separate. Unknown data remains unknown. Select an enrollment to see accepted target revisions alongside actual confirmed work; original-source mode retains the supplied plan. Neither LP nor UP is forced into a mathematically ideal curve.

Transfers compare recent global exposure, CMJ baseline, check-ins and data coverage. Incomplete history produces provisional options; pain/illness defers the suggestion. Reviewed seven-day bridges exclude unsupported novelty. Preview/accept is explicit and stale previews fail. No workload band predicts injury or guarantees a safe transfer. Movement alternatives require equipment/skill review and replacement-specific weight/velocity references; source alternatives and mutually exclusive choices are preserved.

The dark blue/purple dashboard includes CMJ, sleep, subjective fatigue/soreness/stress and optional body mass/resting HR/compatible HRV. CMJ deviation is a performance change, not a fatigue percentage. Rolling 7/28-day load means require every day's coverage; unlogged days are gaps, confirmed rest can be zero, and rest/training contradictions stay incomplete. ACWR is not an injury score. Version-one backups migrate without rewriting actual dates or IDs; unsupported data remains raw-exportable.

## Private device synchronization

See [the complete Supabase and HTTPS setup guide](docs/device-sync-setup.md). No Supabase project is configured by default; local logging works until you configure the public settings and sign in. Guest/account caches are separate, first-link upload requires a preview, and conflicts preserve both versions. Source pages are bundled for offline use; **Offline ready** verifies all 119 source assets.

## Movement log and progress update

The log groups sets by movement, adds sets progressively, and saves edits automatically with local refresh recovery. Progress leads with daily recovery and estimated Force / Explosive-power / Metabolic trends, with day, week, and month views. Historical records are calculated for display without rewriting them.

See [frontend update and data-preservation instructions](docs/training-update-deployment.md). This update requires a frontend rebuild/redeployment and no new Supabase migration.
