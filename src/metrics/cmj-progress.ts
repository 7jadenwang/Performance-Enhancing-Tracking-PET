import type { AthleteState } from "../domain/schema";
import { baselineForDate, dailyCmj } from "./recovery";

// Descriptive Progress comparison only. Never calibrates or changes readiness signals.
export function cmjComparisonForDate(
  state: AthleteState,
  protocolId: string,
  date: string,
) {
  const morning = state.mornings.find(
    (m) => m.protocolId === protocolId && m.localDate === date,
  );
  const daily = morning ? dailyCmj(morning) : null;
  const baseline = baselineForDate(state, protocolId, date);
  const seen = new Set<string>();
  const prior = state.mornings
    .filter(
      (m) =>
        m.protocolId === protocolId &&
        m.localDate < date &&
        m.baselineEligible &&
        !m.exclusionReason &&
        m.pain !== true &&
        m.illness !== true &&
        dailyCmj(m).meanCm !== null,
    )
    .sort((a, b) => b.localDate.localeCompare(a.localDate))
    .filter((m) => {
      if (seen.has(m.localDate)) return false;
      seen.add(m.localDate);
      return true;
    })
    .slice(0, 14);
  const calibrated = baseline && baseline.meanCm > 0 ? baseline : null;
  const referenceCm =
    calibrated?.meanCm ??
    (prior.length
      ? prior.reduce((sum, m) => sum + dailyCmj(m).meanCm!, 0) / prior.length
      : null);
  const source = calibrated
    ? "calibrated"
    : prior.length
      ? "provisional"
      : null;
  const referenceDays = calibrated?.eligibleRecordIds.length ?? prior.length;
  const note =
    referenceCm === null
      ? "No earlier suitable CMJ reference for this protocol; record another comparable day or establish a baseline in Settings."
      : `${source === "calibrated" ? "Calibrated baseline" : "Provisional reference (not calibrated)"} · ${referenceDays} ${source === "calibrated" ? "calibration" : "earlier recorded"} days · ${referenceCm.toFixed(2)} cm`;
  return {
    referenceCm,
    source,
    referenceDays,
    percentageChange:
      referenceCm !== null &&
      referenceCm > 0 &&
      daily?.meanCm !== null &&
      daily?.meanCm !== undefined
        ? (100 * (daily.meanCm - referenceCm)) / referenceCm
        : null,
    segment: calibrated?.id ?? "provisional",
    note: `${note} · ${daily ? `${daily.validTrials} valid trial(s) today` : "No CMJ measurement today"}`,
  };
}
