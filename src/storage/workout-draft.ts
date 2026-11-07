import { workoutSchema, type Workout } from "../domain/schema";
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = (id: string) => "pet-workout-draft-v1:" + id;
export function readDraft(
  storage: DraftStorage,
  id: string,
): { workout: Workout; base: string } | null {
  const raw = storage.getItem(key(id));
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  const workout = workoutSchema.parse(parsed.workout);
  if (typeof parsed.base !== "string") throw Error("Invalid draft baseline");
  const base = JSON.stringify(
    workoutSchema.nullable().parse(JSON.parse(parsed.base)),
  );
  return { workout, base };
}
export function writeDraft(
  storage: DraftStorage,
  id: string,
  workout: Workout,
  base: string,
) {
  storage.setItem(key(id), JSON.stringify({ workout, base }));
}
export function clearDraft(
  storage: DraftStorage,
  id: string,
  workout: Workout,
) {
  const current = readDraft(storage, id);
  if (
    current &&
    JSON.stringify(current.workout) ===
      JSON.stringify(workoutSchema.parse(workout))
  )
    storage.removeItem(key(id));
}

// A save from an older editor must never replace a newer editor's draft.
export function advanceDraftBase(
  storage: DraftStorage,
  id: string,
  workout: Workout,
  previous: string,
  next: string,
): boolean {
  const current = readDraft(storage, id);
  if (
    !current ||
    current.base !== previous ||
    JSON.stringify(current.workout) !==
      JSON.stringify(workoutSchema.parse(workout))
  )
    return false;
  writeDraft(storage, id, current.workout, next);
  return true;
}
