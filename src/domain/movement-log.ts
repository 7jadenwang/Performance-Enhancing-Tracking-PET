import type { ActualRow, Prescription } from "./schema";
import { createRow } from "./records";
export const movementKey = (r: ActualRow) =>
  r.prescriptionId ?? r.movementId ?? r.exerciseId;
export function prescribedSet(p: Prescription): ActualRow {
  return createRow({
    prescriptionId: p.id,
    movementId: p.movementId,
    exerciseId: p.name,
    name: p.name,
    kind: p.kind,
    perSide: p.perSide,
    reps: p.reps?.[0] ?? null,
    tempo: p.tempo ?? "",
    holdSeconds: p.holdSeconds?.[0] ?? null,
    distanceMetres: p.distanceMetres?.[0] ?? null,
    restSeconds: p.restSeconds?.[0] ?? null,
    workSeconds: p.workSeconds?.[0] ?? null,
    rounds: p.rounds?.[0] ?? null,
  });
}
export function startMovements(
  rows: ActualRow[],
  prescriptions: Prescription[],
) {
  return [
    ...rows,
    ...prescriptions
      .filter(
        (p) =>
          p.sets &&
          p.kind !== "other" &&
          !p.optional &&
          !p.conditionalGroup &&
          !rows.some((r) => matchesPrescription(r, p)),
      )
      .map(prescribedSet),
  ];
}
// The latest edit made while completed; legacy rows remain undated until edited.
export function editSet(
  row: ActualRow,
  changes: Partial<ActualRow>,
  at = new Date().toISOString(),
): ActualRow {
  const next = { ...row, ...changes };
  if (next.confirmed) next.completedAt = at;
  else if (row.completedAt !== undefined || changes.confirmed === false)
    next.completedAt = null;
  return next;
}
export function nextSet(first: ActualRow): ActualRow {
  return {
    ...first,
    id: crypto.randomUUID(),
    confirmed: false,
    completedAt: null,
    setRpe: null,
    rir: null,
    timeSeconds: null,
    tempoFollowed: null,
    notes: "",
    velocity: first.velocity
      ? {
          ...first.velocity,
          setAverage: null,
          repVelocities: [],
          completeSeries: false,
        }
      : null,
  };
}
function matchesPrescription(row: ActualRow, p: Prescription) {
  return row.prescriptionId
    ? row.prescriptionId === p.id
    : row.name === p.name || row.exerciseId === p.name;
}
export function movementGroups(
  rows: ActualRow[],
  prescriptions: Prescription[],
) {
  const keyFor = (row: ActualRow) =>
    prescriptions.find((p) => matchesPrescription(row, p))?.id ??
    movementKey(row);
  const groups = prescriptions
    .filter((p) => p.kind !== "other" && !p.conditionalGroup)
    .map((p) => ({
      key: p.id,
      name: p.name,
      prescription: p as Prescription | undefined,
      rows: rows.filter((r) => keyFor(r) === p.id),
    }));
  for (const row of rows) {
    const key = keyFor(row);
    if (!groups.some((g) => g.key === key))
      groups.push({
        key,
        name: row.name,
        prescription: undefined,
        rows: rows.filter((r) => keyFor(r) === key),
      });
  }
  return groups;
}
