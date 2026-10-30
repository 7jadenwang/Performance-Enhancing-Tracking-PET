import { z } from "zod";
const n = z.number().finite().nonnegative();
const nullable = n.nullable();
const rpe = z.number().min(0).max(10).nullable();
import { dateSchema, type LocalDate } from "./values";
export { dateSchema, type LocalDate } from "./values";
import { enrollmentSchema, targetRevisionSchema } from "./enrollment-schema";
export * from "./enrollment-schema";
import { prescriptionSchema, velocityMetricSchema } from "./program-schema";
export * from "./program-schema";
export const velocitySchema = z.object({
  exerciseId: z.string(),
  loadKg: nullable,
  loadConvention: z
    .enum(["totalExternal", "perHand", "bodyweight", "unknown"])
    .default("unknown"),
  loadedHands: z.number().int().min(1).max(2).nullable().default(null),
  rangeOfMotion: z.string(),
  metric: velocityMetricSchema,
  componentId: z.string().nullable().default(null),
  method: z.string(),
  setAverage: nullable,
  repVelocities: z.array(n),
  completeSeries: z.boolean(),
});
export type VelocityRecord = z.infer<typeof velocitySchema>;
export const rowSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  name: z.string(),
  confirmed: z.boolean(),
  completedAt: z.string().datetime().nullable().optional(),
  prescriptionId: z.string().nullable().default(null),
  movementId: z.string().nullable().default(null),
  reps: nullable,
  loadKg: nullable,
  loadConvention: z.enum(["totalExternal", "perHand", "bodyweight", "unknown"]),
  loadedHands: z.number().int().min(1).max(2).nullable().default(null),
  perSide: z.boolean(),
  holdSeconds: nullable,
  distanceMetres: nullable,
  timeSeconds: nullable,
  rounds: nullable,
  workSeconds: nullable,
  restSeconds: nullable,
  setRpe: rpe,
  rir: nullable,
  tempo: z.string(),
  tempoFollowed: z.boolean().nullable(),
  kind: prescriptionSchema.shape.kind,
  sourceVelocityMetric: z
    .enum(["mean", "meanConcentric", "meanPropulsive", "peak"])
    .nullable()
    .default(null),
  velocity: velocitySchema.nullable(),
  notes: z.string(),
});
export type ActualRow = z.infer<typeof rowSchema>;
export const workoutSchema = z.object({
  id: z.string(),
  sessionId: z.string().nullable(),
  enrollmentId: z.string().nullable().default(null),
  targetSnapshot: z.array(prescriptionSchema).default([]),
  targetRevisions: z.array(targetRevisionSchema).default([]),
  localDate: dateSchema,
  status: z.enum(["draft", "partial", "completed", "skipped"]),
  plannedDuration: nullable,
  plannedRpe: rpe,
  actualDuration: nullable,
  actualRpe: rpe,
  rows: z.array(rowSchema),
  substitutions: z.array(
    z.object({
      exerciseId: z.string(),
      original: z.string(),
      actual: z.string(),
      reason: z.string(),
    }),
  ),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Workout = z.infer<typeof workoutSchema>;
const rating = z.number().min(1).max(10).multipleOf(0.5).nullable();
export const morningSchema = z
  .object({
    ratingScale: z.literal(10).optional(),
    id: z.string(),
    localDate: dateSchema,
    protocolId: z.string(),
    trials: z.array(
      z.object({
        heightCm: z.number().finite().positive(),
        excluded: z.boolean(),
        reason: z.string(),
      }),
    ),
    bodyMassKg: z.number().finite().positive().nullable().default(null),
    restingHeartRate: z.number().finite().positive().nullable().default(null),
    illness: z.boolean().nullable().default(null),
    illnessNotes: z.string().default(""),
    hrv: z
      .object({
        value: z.number().finite().positive(),
        metric: z.enum(["rMSSD", "SDNN", "lnRMSSD"]),
        unit: z.enum(["ms", "ln(ms)"]),
        method: z.string().min(1),
        protocol: z.string().min(1),
      })
      .nullable()
      .default(null),
    sleepHours: z.number().min(0).max(24).nullable(),
    sleepQuality: rating,
    fatigue: rating,
    soreness: rating,
    stress: rating,
    pain: z.boolean().nullable(),
    painLocation: z.string(),
    baselineEligible: z.boolean(),
    exclusionReason: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .superRefine((record, context) => {
    if (record.ratingScale !== 10)
      for (const key of [
        "sleepQuality",
        "fatigue",
        "soreness",
        "stress",
      ] as const) {
        const value = record[key];
        if (value !== null && (!Number.isInteger(value) || value > 5))
          context.addIssue({
            code: "custom",
            path: [key],
            message:
              "Legacy ratings must be integers from 1 to 5; use ratingScale 10 for new ratings",
          });
      }
  });
export type MorningRecord = z.infer<typeof morningSchema>;
export const baselineSchema = z.object({
  id: z.string(),
  protocolId: z.string(),
  eligibleRecordIds: z.array(z.string()).length(14),
  meanCm: n,
  sampleSdCm: n,
  createdAt: z.string(),
  archivedAt: z.string().nullable(),
});
export type Baseline = z.infer<typeof baselineSchema>;
const equipmentSchema = z.object({
  running: z.literal(true),
  extra: z
    .record(z.string(), z.enum(["available", "unavailable", "unconfirmed"]))
    .default({}),
  rowing: z.enum(["available", "unavailable", "unconfirmed"]),
  skiErg: z.enum(["available", "unavailable", "unconfirmed"]),
  airBike: z.enum(["available", "unavailable", "unconfirmed"]),
});
export type EquipmentProfile = z.infer<typeof equipmentSchema>;
export const stateSchema = z
  .object({
    schemaVersion: z.literal(2),
    programVersion: z.literal("lp-up-v2"),
    startDate: dateSchema,
    enrollments: z.array(enrollmentSchema).default([]),
    activities: z
      .array(
        z.object({
          localDate: dateSchema,
          status: z.enum(["rest", "training", "unknown"]),
          notes: z.string().default(""),
        }),
      )
      .default([]),
    velocityExperience: z
      .enum(["unconfirmed", "beginner", "experienced"])
      .default("unconfirmed"),
    familiarity: z.array(z.string()).default([]),
    velocityProfiles: z
      .array(
        z.object({
          exerciseId: z.string(),
          date: dateSchema,
          rangeOfMotion: z.string(),
          metric: z.enum(["mean", "meanConcentric", "meanPropulsive", "peak"]),
          method: z.string(),
          loadPercent: z.tuple([n, n]),
          target: z.tuple([n, n]),
        }),
      )
      .default([]),
    reschedules: z.record(z.string(), dateSchema),
    equipment: equipmentSchema,
    reference1RMs: z.array(
      z.object({
        exerciseId: z.string(),
        date: dateSchema,
        kg: z.number().finite().positive(),
      }),
    ),
    protocols: z.array(z.object({ id: z.string(), name: z.string() })),
    baselines: z.array(baselineSchema),
    workouts: z.array(workoutSchema),
    mornings: z.array(morningSchema),
  })
  .superRefine((s, ctx) => {
    for (const key of [
      "enrollments",
      "workouts",
      "mornings",
      "baselines",
      "protocols",
    ] as const) {
      const ids = s[key].map((x) => x.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: "custom",
          message: "Duplicate record IDs",
          path: [key],
        });
    }
    for (const status of ["active", "queued"])
      if (s.enrollments.filter((e) => e.status === status).length > 1)
        ctx.addIssue({
          code: "custom",
          message: "Only one " + status + " enrollment allowed",
        });
    for (const w of s.workouts)
      if (w.enrollmentId && !s.enrollments.some((e) => e.id === w.enrollmentId))
        ctx.addIssue({ code: "custom", message: "Unknown workout enrollment" });
    for (const r of s.mornings)
      if (!s.protocols.some((p) => p.id === r.protocolId))
        ctx.addIssue({ code: "custom", message: "Unknown morning protocol" });
    for (const b of s.baselines)
      if (
        !s.protocols.some((p) => p.id === b.protocolId) ||
        b.eligibleRecordIds.some(
          (id) =>
            !s.mornings.some(
              (m) => m.id === id && m.protocolId === b.protocolId,
            ),
        )
      )
        ctx.addIssue({
          code: "custom",
          message: "Unknown baseline measurement references",
        });
    if (
      new Set(s.activities.map((a) => a.localDate)).size !== s.activities.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate activity date" });
    const dates = s.mornings.map((x) => x.localDate + "|" + x.protocolId);
    if (new Set(dates).size !== dates.length)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate morning date/protocol",
      });
  });
export type AthleteState = z.infer<typeof stateSchema>;
export const parseState = (x: unknown): AthleteState => stateSchema.parse(x);
export function localToday(): LocalDate {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function initialState(): AthleteState {
  return {
    schemaVersion: 2,
    velocityExperience: "unconfirmed",
    enrollments: [],
    activities: [],
    familiarity: [],
    velocityProfiles: [],
    programVersion: "lp-up-v2",
    startDate: localToday(),
    reschedules: {},
    equipment: {
      running: true,
      extra: {},
      rowing: "unconfirmed",
      skiErg: "unconfirmed",
      airBike: "unconfirmed",
    },
    reference1RMs: [],
    protocols: [
      {
        id: "default",
        name: "Jump app · morning · hands on hips · same warm-up/surface",
      },
    ],
    baselines: [],
    workouts: [],
    mornings: [],
  };
}

export type DailyActivity = AthleteState["activities"][number];
