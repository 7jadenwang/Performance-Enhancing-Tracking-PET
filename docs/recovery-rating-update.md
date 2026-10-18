# Recovery rating and chart update

This frontend update adds 1–10 ratings in 0.5 steps for sleep quality, fatigue, soreness, and stress. New check-ins carry an optional `ratingScale: 10` marker. Existing check-ins without the marker retain their original 1–5 values in storage and backups. Charts and inputs show those legacy values ×2 for comparison; viewing them does not rewrite them. Editing a rating converts that one check-in to the new scale when you save it. Editing another field alone retains its original rating scale.

The existing concern thresholds retain the same meaning: fatigue/soreness/stress ≥8 and sleep quality ≤4 on the 10-point scale. These are descriptive check-in flags, not a readiness diagnosis.

CMJ height and body mass use padded, data-based Y-axis ranges labelled “Zoomed Y-axis.” Other load charts retain a zero baseline. Daily values and existing CMJ baseline calculations are unchanged.

Confirmed rest days have zero load across all three training-demand dimensions. Days with no training log or training annotation are displayed as zero in the training-demand charts and connected automatically. Point details identify these assumed zeroes; they do not create or alter saved rest annotations. Recorded sessions with missing load measurements remain unknown. A completed/partial session explicitly logged with zero duration × RPE also has zero demand even without sets.

Empty days display zero automatically in the demand charts; no manual rest annotation is required to connect those lines. Any recorded training day—including an unfinished log—remains unknown if required inputs are missing. October 13 must therefore remain unknown if it contains such a log. The chart data table names the missing duration, session RPE, status or confirmed sets. To also store a confirmed rest annotation, use **Progress → Correct a rest / training day**, select the date and choose **Confirmed rest day**. Existing workouts and morning records are preserved. Recorded sessions with incomplete load measurements remain gaps rather than being silently discarded.

Deployment: merge the update and let Vercel rebuild the frontend as usual. No Supabase SQL migration or new environment variable is needed; the existing backend stores the versioned JSON payload. **Update/reload the app on every signed-in device before recording or synchronizing new 10-point ratings.** Older cached frontend versions only understand the previous scale. Keep the same site address and browser storage. The app's update-ready button applies the cached app update without clearing athlete data.
