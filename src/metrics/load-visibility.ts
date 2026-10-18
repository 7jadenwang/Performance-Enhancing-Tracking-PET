import type { AthleteState } from "../domain/schema";

export function confirmedRestDates(state: AthleteState): Set<string> {
  return new Set(
    state.activities.filter((a) => a.status === "rest").map((a) => a.localDate),
  );
}

// Derived chart input only: never alter persisted workouts or morning records.
export function trainingLoadState(state: AthleteState): AthleteState {
  const rest = confirmedRestDates(state);
  return {
    ...state,
    workouts: state.workouts.filter((w) => !rest.has(w.localDate)),
  };
}

export function withoutRestDates<T extends { date: string }>(
  points: T[],
  state: AthleteState,
): T[] {
  const rest = confirmedRestDates(state);
  return points.filter((p) => !rest.has(p.date));
}
