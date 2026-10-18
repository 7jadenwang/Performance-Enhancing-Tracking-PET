import { it, expect } from "vitest";
import { program } from "../src/program/catalog";
import { initialState } from "../src/domain/schema";
import { createWorkout, createRow } from "../src/domain/records";
import {
  plannedDose,
  programDoseSeries,
  summarizeExposure,
} from "../src/metrics/exposure";
it("visualizes all source weeks before logging without inventing session RPE", () => {
  const weeks = programDoseSeries("lp", initialState(), program);
  expect(weeks).toHaveLength(12);
  expect(weeks[0].planned.strengthReps![0]).toBeGreaterThan(0);
  expect(weeks[0].actual).toBeNull();
  expect(programDoseSeries("up", initialState(), program)).toHaveLength(8);
});
it("retains weight sets rest cluster velocity and energy work as separate dose dimensions", () => {
  const cluster = program.sessions.find((s) => s.id === "July-W2D2")!
    .exercises[3];
  const d = plannedDose([cluster], initialState(), "2026-10-13");
  expect(d.strengthReps).toEqual([30, 30]);
  expect(d.relativeIntensity).toEqual([82, 85]);
  expect(d.restSeconds).toEqual([180, 180]);
  expect(d.clusterRestSeconds).toEqual([20, 20]);
  expect(d.kgReps).toBeNull();
  const cardio = program.sessions
    .find((s) => s.id === "July-W1D2")!
    .exercises.find((p) => p.kind === "conditioning")!;
  const conditioning = plannedDose([cardio], initialState(), "2026-10-13");
  expect(conditioning.conditioningWorkSeconds).toEqual([200, 240]);
  expect(conditioning.workRestRatio).toEqual([0.5, 0.5]);
});
it("excludes drafts and keeps jump demand and lift load distinct", () => {
  const work = createWorkout({
    status: "completed",
    rows: [
      createRow({
        exerciseId: "Pogo Jump",
        name: "Pogo Jump",
        kind: "jump",
        reps: 10,
        confirmed: true,
      }),
      createRow({
        exerciseId: "后蹲",
        name: "后蹲",
        kind: "strength",
        reps: 5,
        loadKg: 100,
        confirmed: true,
      }),
    ],
  });
  const e = summarizeExposure([
    work,
    createWorkout({ rows: [createRow({ confirmed: true, reps: 999 })] }),
  ]);
  expect(e.jumpContacts.low).toBe(10);
  expect(e.kgReps).toBe(500);
  expect(e.strengthReps).toBe(5);
});
it("filters actual movement overlays and uses each scheduled reference date", () => {
  const s = initialState();
  s.startDate = "2026-10-12";
  const session = program.sessions.find((x) => x.id === "July-W2D2")!;
  const p = {
    ...session.exercises[3],
    movementId: "back-squat",
    referenceExerciseId: "test-squat",
  };
  const catalog = {
    ...program,
    sessions: program.sessions.map((x) =>
      x.id === session.id ? { ...x, exercises: [p] } : x,
    ),
  };
  s.reference1RMs = [
    { exerciseId: p.referenceExerciseId!, kg: 100, date: "2026-10-12" },
    { exerciseId: p.referenceExerciseId!, kg: 200, date: "2026-10-19" },
  ];
  s.workouts = [
    createWorkout({
      sessionId: session.id,
      status: "completed",
      rows: [
        createRow({
          name: p.name,
          exerciseId: p.name,
          movementId: "back-squat",
          kind: "strength",
          reps: 5,
          confirmed: true,
        }),
        createRow({
          name: "Custom",
          kind: "strength",
          reps: 999,
          confirmed: true,
        }),
      ],
    }),
  ];
  const weeks = programDoseSeries("up", s, catalog, undefined, "back-squat");
  expect(weeks[1].actual?.strengthReps).toBe(5);
  expect(weeks[1].planned.kgReps![0]).toBeGreaterThan(3000);
});
it("shows measured set count density and velocity only within one compatible movement", () => {
  const w = createWorkout({
    status: "partial",
    rows: [
      createRow({
        exerciseId: "后蹲",
        name: "后蹲",
        reps: 5,
        loadKg: 100,
        confirmed: true,
        restSeconds: 120,
        velocity: {
          exerciseId: "后蹲",
          componentId: null,
          loadKg: 100,
          loadConvention: "totalExternal",
          loadedHands: null,
          rangeOfMotion: "full",
          method: "encoder",
          metric: "meanConcentric",
          setAverage: 0.5,
          repVelocities: [],
          completeSeries: false,
        },
      }),
    ],
  });
  const e = summarizeExposure([w]);
  expect(e.sets).toBe(1);
  expect(e.velocity).toBe(0.5);
  expect(e.restSeconds).toBe(120);
});
it("keeps entirely missing actual dimensions null and labels partial known totals", () => {
  const unknown = summarizeExposure([
    createWorkout({
      status: "completed",
      rows: [
        createRow({
          confirmed: true,
          kind: "strength",
          reps: null,
          loadKg: null,
        }),
        createRow({
          confirmed: true,
          kind: "sprint",
          distanceMetres: null,
          reps: 2,
        }),
        createRow({ confirmed: true, kind: "jump", reps: null }),
        createRow({
          confirmed: true,
          kind: "conditioning",
          rounds: null,
          workSeconds: null,
        }),
      ],
    }),
  ]);
  expect(unknown.strengthReps).toBeNull();
  expect(unknown.kgReps).toBeNull();
  expect(unknown.sprintMetres).toBeNull();
  expect(unknown.jumpContactTotal).toBeNull();
  expect(unknown.conditioningWorkSeconds).toBeNull();
  const partial = summarizeExposure([
    createWorkout({
      status: "completed",
      rows: [
        createRow({ confirmed: true, kind: "strength", reps: 5, loadKg: 100 }),
        createRow({
          confirmed: true,
          kind: "strength",
          reps: null,
          loadKg: null,
        }),
      ],
    }),
  ]);
  expect(partial.strengthReps).toBe(5);
  expect(partial.coverage.strengthReps).toEqual({ measured: 1, expected: 2 });
});
it("hides confirmed rest actual dose without changing prescriptions or saved workouts", () => {
  const s = initialState();
  const session = program.sessions.find((x) => x.programId === "lp")!;
  s.workouts = [
    createWorkout({
      sessionId: session.id,
      localDate: "2026-10-13",
      status: "completed",
      rows: [createRow({ kind: "strength", reps: 5, confirmed: true })],
    }),
  ];
  const before = programDoseSeries("lp", s, program);
  s.activities = [{ localDate: "2026-10-13", status: "rest", notes: "" }];
  const saved = JSON.stringify(s);
  const after = programDoseSeries("lp", s, program);
  expect(before[0].actual?.strengthReps).toBe(5);
  expect(after[0].actual).toBeNull();
  expect(after.map((w) => w.planned)).toEqual(before.map((w) => w.planned));
  expect(JSON.stringify(s)).toBe(saved);
});
