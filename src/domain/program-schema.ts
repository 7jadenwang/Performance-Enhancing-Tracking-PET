import { z } from "zod";
const n = z.number().finite().nonnegative();
const range = z.tuple([n,n]).refine(([a,b])=>a<=b);
export const velocityMetricSchema = z.enum(["mean", "meanConcentric", "meanPropulsive", "peak"]);
export const velocityRuleSchema = z.object({
  sourceText: z.string(),
  metric: velocityMetricSchema.nullable(),
  componentId: z.string().nullable().default(null),
  applicability: z.enum(["all", "experienced", "optional"]).default("all"),
  lossReference: z.enum(["fastestAny", "fastestFinal", "unspecified"]).default("unspecified"),
  floor: range.nullable().default(null),
  bands: z.array(z.object({
    loss: range,
    action: z.enum(["continue", "reduce", "stopSet", "stopExercise"]),
    reduceKg: n.nullable().default(null),
    reduceReps: n.nullable().default(null),
    extraRestSeconds: n.nullable().default(null),
    lowerInclusive: z.boolean().default(true),
    upperInclusive: z.boolean().default(true),
  })).default([]),
});
export type VelocityRule = z.infer<typeof velocityRuleSchema>;
export const prescriptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceText: z.string(),
  kind: z.enum([
    "strength",
    "jump",
    "throw",
    "hold",
    "sprint",
    "conditioning",
    "other",
  ]),
  sets: range.nullable(),
  reps: range.nullable(),
  perSide: z.boolean(),
  loadPercent: range.nullable(),
  loadKg: range.nullable().default(null),
  loadConvention: z.enum(["totalExternal", "perHand", "bodyweight", "unknown"]).default("unknown"),
  rir: range.nullable().default(null),
  referenceExerciseId: z.string().nullable(),
  tempo: z.string().nullable(),
  velocityTarget: range.nullable(),
  velocityComparison: z.enum(["min", "range"]).default("range"),
  velocityMetric: velocityMetricSchema.nullable(),
  velocityRules: z.array(velocityRuleSchema).default([]),
  velocityVariants: z.array(z.object({loadPercent:range, target:range, floor:n, metric:velocityMetricSchema})).default([]),
  components: z.array(z.object({id:z.string(), name:z.string(), velocityTarget:range.nullable(), velocityMetric:velocityMetricSchema.nullable(), variants:z.array(z.object({loadPercent:range,target:range,floor:n,metric:velocityMetricSchema})).default([]), rules:z.array(velocityRuleSchema).default([])})).default([]),
  cluster: z.object({reps:z.array(n), intraRestSeconds:n}).nullable().default(null),
  movementId: z.string().nullable().default(null),
  conditionalGroup: z.string().nullable().default(null),
  experience: z.enum(["all","experienced"]).default("all"),
  restSeconds: range.nullable(),
  holdSeconds: range.nullable(),
  distanceMetres: range.nullable(),
  workSeconds: range.nullable(),
  rounds: range.nullable(),
  optional: z.boolean(),
  groupId: z.string().nullable(),
  ambiguity: z.string().nullable(),
  purpose: z.enum(["generalAerobic", "conditioning", "technique", "other"]),
});
export type Prescription = z.infer<typeof prescriptionSchema>;
export const sessionSchema = z.object({
  id: z.string(),
  programId: z.enum(["lp","up"]),
  phaseId: z.string(),
  focus: z.string().default("Mixed athletic development"),
  sourceConflict: z.string().nullable().default(null),
  conditionalSources: z.array(z.string()).default([]),
  alternativePlans: z.array(z.object({id:z.string(), name:z.string(), sources:z.array(z.string()), exercises:z.array(prescriptionSchema)})).default([]),
  autoregulation: z.enum(["source", "none"]).default("source"),
  month: z.string(),
  blockIndex: z.number().int().nonnegative(),
  week: z.number().int().min(1).max(4),
  day: z.number().int().min(1).max(7),
  optional: z.boolean(),
  sourceText: z.string(),
  sources: z.array(z.string()),
  exercises: z.array(prescriptionSchema),
});
export type Session = z.infer<typeof sessionSchema>;
export const phaseSchema = z.object({id:z.string(), number:z.number().int().positive(), purpose:z.string(), sourceFolder:z.string(), entrySessionIds:z.array(z.string()), weeklyFocus:z.array(z.string()).length(4)});
export const definitionSchema = z.object({id:z.enum(["lp","up"]), name:z.string(), phases:z.array(phaseSchema)});
export type PhaseDefinition = z.infer<typeof phaseSchema>;
export type ProgramDefinition = z.infer<typeof definitionSchema>;
export const programSchema = z.object({
  version: z.string(),
  sourceCommit: z.string(),
  sources: z.array(z.string()),
  sessions: z.array(sessionSchema),
  definitions: z.array(definitionSchema),
});
export type Program = z.infer<typeof programSchema>;
export const parseProgram = (x: unknown): Program => programSchema.parse(x);
