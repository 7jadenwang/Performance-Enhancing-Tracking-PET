import { expect, it } from "vitest";
import { createRow, createWorkout } from "../src/domain/records";
import { editSet, nextSet } from "../src/domain/movement-log";
import { initialState, parseState, rowSchema } from "../src/domain/schema";
import { stateToDocuments, documentsToState } from "../src/sync/documents";
const first = "2026-10-30T12:00:00.000Z",
  second = "2026-10-30T12:05:00.000Z";
it("records the latest edit while completed, clears on undo and starts a fresh completion", () => {
  const row = createRow();
  const checked = editSet(row, { confirmed: true }, first);
  expect(checked.completedAt).toBe(first);
  const corrected = editSet(checked, { reps: 4 }, second);
  expect(corrected.completedAt).toBe(second);
  const unchecked = editSet(corrected, { confirmed: false }, second);
  expect(unchecked.completedAt).toBeNull();
  expect(editSet(unchecked, { confirmed: true }, second).completedAt).toBe(
    second,
  );
  expect(nextSet(corrected).completedAt).toBeNull();
  expect(row).not.toHaveProperty("completedAt");
});
it("does not invent timestamps for older sets or uncompleted edits", () => {
  const row = createRow({ confirmed: true });
  expect(rowSchema.parse(row)).toEqual(row);
  expect(rowSchema.parse(row)).not.toHaveProperty("completedAt");
  expect(editSet(createRow(), { reps: 5 }, first)).not.toHaveProperty(
    "completedAt",
  );
});
it("preserves timestamps through validation and cloud document round trips", () => {
  const state = initialState();
  state.workouts = [
    createWorkout({ rows: [editSet(createRow(), { confirmed: true }, first)] }),
  ];
  expect(parseState(state).workouts[0].rows[0].completedAt).toBe(first);
  expect(
    documentsToState(stateToDocuments(state)).workouts[0].rows[0].completedAt,
  ).toBe(first);
  expect(() =>
    rowSchema.parse({ ...createRow(), completedAt: "invalid" }),
  ).toThrow();
});
