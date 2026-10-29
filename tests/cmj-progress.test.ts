import { expect, it } from "vitest";
import { initialState } from "../src/domain/schema";
import { makeMorning } from "../src/domain/fixtures";
import { cmjComparisonForDate } from "../src/metrics/cmj-progress";
const morning = (id: string, date: string, heightCm: number) =>
  makeMorning({
    id,
    localDate: date,
    trials: [{ heightCm, excluded: false, reason: "" }],
  });
it("uses earlier comparable daily means as an explicitly provisional reference without changing data", () => {
  const s = initialState();
  s.mornings = [morning("a", "2026-10-12", 30), morning("b", "2026-10-13", 33)];
  const before = JSON.stringify(s);
  expect(cmjComparisonForDate(s, "default", "2026-10-12")).toMatchObject({
    referenceCm: null,
    percentageChange: null,
  });
  expect(cmjComparisonForDate(s, "default", "2026-10-13")).toMatchObject({
    referenceCm: 30,
    percentageChange: 10,
    source: "provisional",
    referenceDays: 1,
  });
  expect(JSON.stringify(s)).toBe(before);
});
it("ignores future records, different protocols and unsuitable reference days", () => {
  const s = initialState();
  s.mornings = [
    morning("a", "2026-10-12", 30),
    morning("b", "2026-10-13", 33),
    morning("future", "2026-10-14", 99),
    { ...morning("pain", "2026-10-11", 1), pain: true },
    { ...morning("protocol", "2026-10-10", 90), protocolId: "other" },
  ];
  expect(cmjComparisonForDate(s, "default", "2026-10-13").referenceCm).toBe(30);
  expect(cmjComparisonForDate(s, "other", "2026-10-13").referenceCm).toBe(90);
  expect(
    cmjComparisonForDate(s, "missing", "2026-10-13").percentageChange,
  ).toBeNull();
});
it("uses at most 14 distinct prior days and retains real zero deviation", () => {
  const s = initialState();
  s.mornings = Array.from({ length: 17 }, (_, i) =>
    morning(
      String(i),
      `2026-10-${String(i + 1).padStart(2, "0")}`,
      i < 2 ? 100 : 30,
    ),
  );
  s.mornings.push(morning("duplicate", "2026-10-15", 30));
  expect(cmjComparisonForDate(s, "default", "2026-10-17")).toMatchObject({
    referenceCm: 30,
    referenceDays: 14,
    percentageChange: 0,
  });
});
it("prefers a calibrated baseline active on that date without applying future calibration backwards", () => {
  const s = initialState();
  s.mornings = [
    morning("a", "2026-10-12", 30),
    morning("b", "2026-10-13", 33),
    morning("c", "2026-10-14", 36),
  ];
  s.baselines = [
    {
      id: "cal",
      protocolId: "default",
      eligibleRecordIds: ["a"],
      meanCm: 40,
      sampleSdCm: 1,
      createdAt: "2026-10-14T00:00:00Z",
      archivedAt: null,
    },
  ];
  expect(cmjComparisonForDate(s, "default", "2026-10-13").source).toBe(
    "provisional",
  );
  expect(cmjComparisonForDate(s, "default", "2026-10-14")).toMatchObject({
    source: "calibrated",
    referenceCm: 40,
    percentageChange: -10,
    segment: "cal",
  });
});
