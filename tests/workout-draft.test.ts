import { expect, it } from "vitest";
import { createWorkout, createRow } from "../src/domain/records";
import { editSet, nextSet } from "../src/domain/movement-log";
import { workoutSchema } from "../src/domain/schema";
import {
  readDraft,
  writeDraft,
  clearDraft,
  advanceDraftBase,
} from "../src/storage/workout-draft";
it("clears completed and copied drafts after schema normalization and retains newer edits", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  const completed = editSet(createRow(), { confirmed: true });
  const w = createWorkout({ rows: [completed, nextSet(completed)] });
  writeDraft(storage, "session", w, "null");
  expect(
    advanceDraftBase(
      storage,
      "session",
      w,
      "null",
      JSON.stringify(workoutSchema.parse(w)),
    ),
  ).toBe(true);
  clearDraft(storage, "session", { ...w, notes: "older version" });
  expect(readDraft(storage, "session")).not.toBeNull();
  clearDraft(storage, "session", w);
  expect(readDraft(storage, "session")).toBeNull();
});

it("normalizes legacy draft baselines so their own saved workout is not an incoming edit", () => {
  const w = createWorkout({
    rows: [editSet(createRow(), { confirmed: true })],
  });
  const raw = JSON.stringify({ workout: w, base: JSON.stringify(w) });
  const restored = readDraft(
    { getItem: () => raw, setItem: () => {}, removeItem: () => {} },
    "session",
  );
  expect(restored?.base).toBe(JSON.stringify(workoutSchema.parse(w)));
});
it("restores every edit and its original conflict baseline after reload", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  const w = createWorkout({ notes: "ongoing session" });
  writeDraft(storage, "guest:session", w, "null");
  expect(readDraft(storage, "guest:session")?.workout.notes).toBe(
    "ongoing session",
  );
  expect(readDraft(storage, "account:session")).toBeNull();
  expect(readDraft(storage, "guest:session")?.base).toBe("null");
  clearDraft(storage, "guest:session", createWorkout());
  expect(readDraft(storage, "guest:session")).not.toBeNull();
  clearDraft(storage, "guest:session", w);
  expect(readDraft(storage, "guest:session")).toBeNull();
});

it("does not overwrite newer edits when an older editor advances its save baseline", async () => {
  const { advanceDraftBase } = await import("../src/storage/workout-draft");
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  const older = createWorkout({ notes: "B" }),
    newer = { ...older, notes: "C" };
  const savedBase = JSON.stringify(createWorkout({ notes: "A" }));
  writeDraft(storage, "session", newer, "null");
  expect(advanceDraftBase(storage, "session", older, "null", savedBase)).toBe(
    false,
  );
  expect(readDraft(storage, "session")?.workout.notes).toBe("C");
  expect(advanceDraftBase(storage, "session", newer, "null", savedBase)).toBe(
    true,
  );
  expect(readDraft(storage, "session")?.base).toBe(savedBase);
});
