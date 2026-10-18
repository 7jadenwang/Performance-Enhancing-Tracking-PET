import { it, expect } from "vitest";
import { initialState } from "../src/domain/schema";
import { createWorkout, createMorning } from "../src/domain/records";
import {
  trainingLoadState,
  withoutRestDates,
} from "../src/metrics/load-visibility";
import { buildTimeline, rollingLoad } from "../src/metrics/timeline";
it("excludes only confirmed rest from load records and leaves morning and source data untouched", () => {
  const s = initialState();
  s.activities = [{ localDate: "2026-10-13", status: "rest", notes: "" }];
  s.workouts = [
    createWorkout({ id: "rest-log", localDate: "2026-10-13" }),
    createWorkout({ id: "training", localDate: "2026-10-14" }),
  ];
  s.mornings = [createMorning({ localDate: "2026-10-13" })];
  const before = JSON.stringify(s);
  const load = trainingLoadState(s);
  expect(load.workouts.map((w) => w.id)).toEqual(["training"]);
  expect(load.mornings).toEqual(s.mornings);
  expect(
    withoutRestDates(
      [{ date: "2026-10-13" }, { date: "2026-10-14" }, { date: "2026-10-15" }],
      s,
    ),
  ).toEqual([{ date: "2026-10-14" }, { date: "2026-10-15" }]);
  expect(JSON.stringify(s)).toBe(before);
});
it("keeps rolling windows on calendar days before hiding rest-day points", () => {
  const s = initialState();
  s.activities = Array.from({ length: 7 }, (_, i) => ({
    localDate: `2026-10-${12 + i}`,
    status: i === 6 ? ("training" as const) : ("rest" as const),
    notes: "",
  }));
  s.workouts = [
    createWorkout({
      localDate: "2026-10-18",
      status: "completed",
      actualDuration: 70,
      actualRpe: 10,
    }),
  ];
  const timeline = buildTimeline(trainingLoadState(s), {
    start: "2026-10-12",
    end: "2026-10-18",
  });
  const visible = withoutRestDates(rollingLoad(timeline, 7), s);
  expect(visible).toHaveLength(1);
  expect(visible[0]).toMatchObject({
    date: "2026-10-18",
    meanAu: 100,
    knownDays: 7,
  });
});
