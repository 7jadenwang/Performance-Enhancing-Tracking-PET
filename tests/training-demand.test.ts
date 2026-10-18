import { expect, it } from "vitest";
import { initialState } from "../src/domain/schema";
import { createRow, createWorkout } from "../src/domain/records";
import {
  trainingDemand,
  demandTimeline,
  demandChartTimeline,
} from "../src/metrics/training-demand";
it("keeps mixed-session demand on shared axes while distinguishing emphasis", () => {
  const w = (kind: "strength" | "jump" | "conditioning") =>
    createWorkout({
      status: "completed",
      actualDuration: 60,
      actualRpe: 6,
      rows: [createRow({ kind, confirmed: true, reps: 5 })],
    });
  const strength = trainingDemand(w("strength"), initialState()),
    jump = trainingDemand(w("jump"), initialState()),
    conditioning = trainingDemand(w("conditioning"), initialState());
  expect(strength.force!).toBeGreaterThan(jump.force!);
  expect(jump.power!).toBeGreaterThan(strength.power!);
  expect(conditioning.metabolic!).toBeGreaterThan(strength.metabolic!);
  expect(strength.power!).toBeGreaterThan(0);
  expect(strength.total).toBe(360);
});
it("does not invent scores for drafts, missing load or unclassified work", () => {
  expect(trainingDemand(createWorkout(), initialState()).force).toBeNull();
  const w = createWorkout({
    status: "completed",
    actualDuration: 30,
    actualRpe: 5,
    rows: [createRow({ kind: "other", confirmed: true })],
  });
  expect(trainingDemand(w, initialState()).force).toBeNull();
});
it("distinguishes explicit rest from unknown days", () => {
  const s = initialState();
  s.activities = [{ localDate: "2026-10-13", status: "rest", notes: "" }];
  const days = demandTimeline(s, "2026-10-13", "2026-10-14");
  expect(days[0].force).toBe(0);
  expect(days[1].force).toBeNull();
});

it("uses dated matching relative load and ignores future 1RMs without mutating history", async () => {
  const { program } = await import("../src/program/catalog");
  const p = program.sessions
    .flatMap((s) => s.exercises)
    .find((p) => p.kind === "strength" && p.referenceExerciseId)!;
  const state = initialState();
  state.reference1RMs = [
    { exerciseId: p.referenceExerciseId!, date: "2026-10-12", kg: 100 },
    { exerciseId: p.referenceExerciseId!, date: "2026-10-20", kg: 200 },
  ];
  const w = createWorkout({
    status: "completed",
    actualDuration: 60,
    actualRpe: 6,
    localDate: "2026-10-13",
    targetSnapshot: [p],
    rows: [
      createRow({
        name: p.name,
        exerciseId: p.name,
        prescriptionId: p.id,
        kind: "strength",
        confirmed: true,
        loadKg: 80,
        loadConvention: "totalExternal",
      }),
    ],
  });
  state.workouts = [w];
  const before = JSON.stringify(state);
  const result = trainingDemand(w, state);
  expect(result.measuredIntensity).toBe(1);
  expect(result.force).toBe(310);
  expect(JSON.stringify(state)).toBe(before);
});

it("keeps explicitly zero-load completed sessions at zero without inventing missing load", () => {
  const w = createWorkout({
    status: "completed",
    actualDuration: 0,
    actualRpe: 0,
    rows: [],
  });
  expect(trainingDemand(w, initialState())).toMatchObject({
    total: 0,
    force: 0,
    power: 0,
    metabolic: 0,
  });
  expect(
    trainingDemand({ ...w, actualRpe: null }, initialState()).force,
  ).toBeNull();
});

it("fills empty demand-chart days with zero without changing records or treating incomplete training as rest", async () => {
  const { demandChartTimeline } =
    await import("../src/metrics/training-demand");
  const state = initialState();
  state.workouts = [
    createWorkout({
      localDate: "2026-10-12",
      status: "completed",
      actualDuration: 60,
      actualRpe: 6,
      rows: [createRow({ confirmed: true, kind: "strength" })],
    }),
    createWorkout({
      id: "incomplete",
      localDate: "2026-10-15",
      status: "partial",
      actualDuration: null,
      actualRpe: 6,
      rows: [createRow({ confirmed: true })],
    }),
  ];
  const before = JSON.stringify(state);
  const days = demandChartTimeline(state, "2026-10-12", "2026-10-16");
  expect(days[0].force).toBeGreaterThan(0);
  expect(days[1]).toMatchObject({
    date: "2026-10-13",
    force: 0,
    power: 0,
    metabolic: 0,
    assumedZero: true,
  });
  expect(days[2]).toMatchObject({ force: 0, assumedZero: true });
  expect(days[3]).toMatchObject({ force: null, assumedZero: false });
  expect(days[4]).toMatchObject({ force: 0, assumedZero: true });
  expect(JSON.stringify(state)).toBe(before);
  expect(demandTimeline(state, "2026-10-13", "2026-10-13")[0].force).toBeNull();
});

it("never zero-fills unfinished training logs or explicitly annotated training days", () => {
  const s = initialState();
  s.workouts = [
    createWorkout({
      localDate: "2026-10-13",
      status: "draft",
      rows: [createRow({ confirmed: true, reps: 5 })],
    }),
  ];
  s.activities = [{ localDate: "2026-10-14", status: "training", notes: "" }];
  const points = demandChartTimeline(s, "2026-10-13", "2026-10-15");
  expect(points[0]).toMatchObject({ force: null, assumedZero: false });
  expect(points[0].missingInputs).toContain("Actual duration is missing");
  expect(points[0].missingInputs).toContain("Whole-session RPE is missing");
  expect(points[1]).toMatchObject({ force: null, assumedZero: false });
  expect(points[2]).toMatchObject({ force: 0, assumedZero: true });
});

it("does not hide confirmed draft training behind an older rest annotation", () => {
  const s = initialState();
  s.workouts = [
    createWorkout({
      localDate: "2026-10-13",
      status: "draft",
      rows: [createRow({ confirmed: true, reps: 5 })],
    }),
  ];
  s.activities = [{ localDate: "2026-10-13", status: "rest", notes: "" }];
  expect(demandChartTimeline(s, "2026-10-13", "2026-10-13")[0]).toMatchObject({
    force: null,
    assumedZero: false,
  });
});
