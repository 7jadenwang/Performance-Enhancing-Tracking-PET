import type { ActualRow, AthleteState, Workout } from "../domain/schema";
import { movementFor } from "../program/movements";
import { sessionLoad } from "./load";
import { addDays } from "../program/schedule";
export const demandAxes = ["force", "power", "metabolic"] as const;
export type DemandAxis = (typeof demandAxes)[number];
export type Demand = {
  total: number | null;
  force: number | null;
  power: number | null;
  metabolic: number | null;
  classified: number;
  confirmed: number;
  measuredIntensity: number;
  measuredVelocity: number;
  practiceSets: number;
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
// Model v1: overlapping emphasis coefficients, NOT independently validated loads.
// Each confirmed set/block has equal influence on the session's emphasis.
export function trainingDemand(w: Workout, state: AthleteState): Demand {
  const result: Demand = {
    total: null,
    force: null,
    power: null,
    metabolic: null,
    classified: 0,
    confirmed: 0,
    measuredIntensity: 0,
    measuredVelocity: 0,
    practiceSets: 0,
  };
  if (!["completed", "partial"].includes(w.status)) return result;
  result.total = sessionLoad(w.actualDuration, w.actualRpe);
  if (result.total === 0) {
    result.force = 0;
    result.power = 0;
    result.metabolic = 0;
  }
  const rows = w.rows.filter((r) => r.confirmed);
  result.confirmed = rows.length;
  const sums = { force: 0, power: 0, metabolic: 0 };
  for (const r of rows) {
    const movement = movementFor(r);
    if (movement?.skill === "technical" || movement?.intent === "control")
      result.practiceSets++;
    let weights: Record<DemandAxis, number>;
    if (r.kind === "conditioning")
      weights = { force: 0.1, power: 0.1, metabolic: 1 };
    else if (r.kind === "sprint")
      weights = { force: 0.4, power: 1, metabolic: 0.5 };
    else if (
      r.kind === "jump" ||
      r.kind === "throw" ||
      (r.kind === "strength" &&
        ["power", "reactive"].includes(movement?.intent ?? ""))
    )
      weights = { force: 0.5, power: 1, metabolic: 0.2 };
    else if (r.kind === "hold")
      weights = { force: 0.8, power: 0, metabolic: 0.2 };
    else if (r.kind === "strength")
      weights = { force: 0.8, power: 0.3, metabolic: 0.3 };
    else continue;
    const p = (
      w.targetRevisions.at(-1)?.prescriptions ?? w.targetSnapshot
    ).find((p) => p.id === r.prescriptionId && p.name === r.name);
    const reference = p?.referenceExerciseId
      ? state.reference1RMs
          .filter(
            (x) =>
              x.exerciseId === p.referenceExerciseId && x.date <= w.localDate,
          )
          .sort((a, b) => b.date.localeCompare(a.date))[0]
      : undefined;
    if (
      r.kind === "strength" &&
      reference &&
      reference.kg > 0 &&
      r.loadKg !== null &&
      r.loadConvention === "totalExternal"
    ) {
      const relative = clamp(r.loadKg / reference.kg, 0, 1);
      weights.force = 0.3 + 0.7 * relative;
      result.measuredIntensity++;
      // Relative load modifies emphasis, never substitutes for measured velocity.
      if (movement?.intent !== "power" && movement?.intent !== "reactive")
        weights.power = 0.15 + 0.35 * (1 - relative);
    }
    const v = r.velocity;
    const component = v?.componentId
      ? p?.components.find((c) => c.id === v.componentId)
      : undefined;
    const target =
      component?.velocityTarget ?? (!v?.componentId ? p?.velocityTarget : null);
    const metric =
      component?.velocityMetric ??
      (!v?.componentId ? (p?.velocityMetric ?? r.sourceVelocityMetric) : null);
    if (
      v &&
      p &&
      target &&
      metric === v.metric &&
      v.method &&
      v.rangeOfMotion &&
      v.exerciseId === r.exerciseId &&
      v.loadKg === r.loadKg &&
      v.loadConvention === r.loadConvention &&
      r.loadConvention !== "unknown" &&
      (r.loadConvention !== "perHand" ||
        (r.loadedHands !== null && r.loadedHands === v.loadedHands))
    ) {
      const speed =
        v.setAverage ??
        (v.repVelocities.length
          ? v.repVelocities.reduce((a, b) => a + b, 0) / v.repVelocities.length
          : null);
      const midpoint = (target[0] + target[1]) / 2;
      if (speed !== null && midpoint > 0) {
        weights.power = clamp(
          weights.power * clamp(speed / midpoint, 0.5, 1.5),
          0,
          1,
        );
        result.measuredVelocity++;
      }
    }
    for (const axis of demandAxes) sums[axis] += weights[axis];
    result.classified++;
  }
  // Unclassified blocks leave scores unknown instead of silently reducing demand.
  if (
    result.total !== null &&
    result.classified > 0 &&
    result.classified === result.confirmed
  )
    for (const axis of demandAxes)
      result[axis] = Math.round(
        (result.total * sums[axis]) / result.classified,
      );
  return result;
}
export function demandTimeline(
  state: AthleteState,
  start: string,
  end: string,
) {
  const points: Array<Demand & { date: string }> = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const sessions = state.workouts
      .filter(
        (w) =>
          w.localDate === date && ["completed", "partial"].includes(w.status),
      )
      .map((w) => trainingDemand(w, state));
    const rest =
      !sessions.length &&
      state.activities.some((a) => a.localDate === date && a.status === "rest");
    const point: Demand & { date: string } = {
      date,
      total: rest ? 0 : null,
      force: rest ? 0 : null,
      power: rest ? 0 : null,
      metabolic: rest ? 0 : null,
      classified: 0,
      confirmed: 0,
      measuredIntensity: 0,
      measuredVelocity: 0,
      practiceSets: 0,
    };
    if (sessions.length) {
      for (const axis of ["total", ...demandAxes] as const)
        point[axis] = sessions.every((s) => s[axis] !== null)
          ? sessions.reduce((sum, s) => sum + s[axis]!, 0)
          : null;
      for (const count of [
        "classified",
        "confirmed",
        "measuredIntensity",
        "measuredVelocity",
        "practiceSets",
      ] as const)
        point[count] = sessions.reduce((sum, s) => sum + s[count], 0);
    }
    points.push(point);
  }
  return points;
}

// Display-only zero filling: never persist inferred rest or modify recorded work.
export function demandChartTimeline(
  state: AthleteState,
  start: string,
  end: string,
) {
  const recordedDates = new Set(
    state.workouts
      .filter((w) => w.status !== "skipped")
      .map((w) => w.localDate),
  );
  for (const activity of state.activities)
    if (activity.status === "training") recordedDates.add(activity.localDate);
  return demandTimeline(state, start, end).map((p) => {
    const missing = new Set<string>();
    const logs = state.workouts.filter(
      (w) => w.localDate === p.date && w.status !== "skipped",
    );
    const conflictingRest =
      state.activities.some(
        (a) => a.localDate === p.date && a.status === "rest",
      ) &&
      logs.some(
        (w) =>
          w.status === "draft" &&
          (w.rows.some((r) => r.confirmed) ||
            (w.actualDuration ?? 0) > 0 ||
            (w.actualRpe ?? 0) > 0),
      );
    const point = conflictingRest
      ? { ...p, total: null, force: null, power: null, metabolic: null }
      : p;
    if (conflictingRest)
      missing.add("Rest annotation conflicts with recorded draft training");
    const assumedZero = point.total === null && !recordedDates.has(p.date);
    for (const w of logs) {
      if (w.status === "draft")
        missing.add(
          "Session is still draft; choose partial/completed after training",
        );
      if (w.actualDuration === null) missing.add("Actual duration is missing");
      if (w.actualRpe === null) missing.add("Whole-session RPE is missing");
      if (!w.rows.some((r) => r.confirmed))
        missing.add("No completed sets confirmed");
      if (w.rows.some((r) => r.confirmed && r.kind === "other"))
        missing.add("Confirmed work needs a classified work type");
    }
    if (!logs.length && recordedDates.has(p.date))
      missing.add("Training day has no saved session");
    return assumedZero
      ? {
          ...point,
          total: 0,
          force: 0,
          power: 0,
          metabolic: 0,
          assumedZero: true,
          missingInputs: [] as string[],
        }
      : { ...point, assumedZero: false, missingInputs: [...missing] };
  });
}
