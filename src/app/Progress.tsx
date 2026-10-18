import { useState } from "react";
import { localToday, type AthleteState, type Workout } from "../domain/schema";
import {
  program,
  programDefinitions,
  getSession,
  sessionLabel,
} from "../program/catalog";
import {
  programDoseSeries,
  type DoseProfile,
  type ExposureDimension,
} from "../metrics/exposure";
import { trainingLoadState } from "../metrics/load-visibility";
import { sessionLoad } from "../metrics/load";
import { addDays } from "../program/schedule";
import { movementFor } from "../program/movements";
import TimeSeries from "./charts/TimeSeries";
import DemandCharts from "./charts/DemandCharts";
import type { Period } from "../metrics/periods";
import RecoveryCharts from "./charts/RecoveryCharts";
import { Card, Select } from "./fields";
const metrics: [keyof DoseProfile, string, string][] = [
  ["strengthReps", "Strength repetitions", "reps"],
  ["sets", "Sets and blocks", "sets"],
  ["relativeIntensity", "Prescribed relative intensity", "%1RM"],
  ["kgReps", "Known external weight volume", "kg·reps"],
  ["restSeconds", "Mean prescribed rest", "seconds"],
  ["clusterRestSeconds", "Intra-cluster rest", "seconds"],
  ["jumpContacts", "Jump contact exposure", "contacts"],
  ["sprintMetres", "Sprint distance exposure", "metres"],
  ["conditioningWorkSeconds", "Conditioning work", "seconds"],
  ["workRestRatio", "Interval work / recovery", "ratio"],
  ["velocity", "Compatible prescribed velocity", "m/s"],
];
export default function Progress({
  state,
  onOpen,
  onActivity,
}: {
  state: AthleteState;
  onOpen: (w: Workout) => void;
  onActivity?: (a: AthleteState["activities"][number]) => Promise<boolean>;
}) {
  const [track, setTrack] = useState<"lp" | "up">("lp"),
    [enrollment, setEnrollment] = useState(""),
    [movement, setMovement] = useState(""),
    [range, setRange] = useState("program"),
    [period, setPeriod] = useState<Period>("day"),
    [activityDate, setActivityDate] = useState(localToday());
  const dose = programDoseSeries(
      track,
      state,
      program,
      enrollment || undefined,
      movement || undefined,
    ),
    today = localToday(),
    dates = [
      ...state.workouts.map((w) => w.localDate),
      ...state.mornings.map((m) => m.localDate),
    ],
    onset =
      state.enrollments.find((e) => e.status === "active")?.startDate ??
      state.startDate,
    start =
      range === "program"
        ? onset
        : range === "all"
          ? (dates.sort()[0] ?? addDays(today, -83))
          : addDays(today, 1 - Number(range));
  const movements = [
    ...new Set(
      program.sessions
        .filter((s) => s.programId === track)
        .flatMap((s) =>
          s.exercises
            .filter((p) => p.kind !== "other")
            .map((p) => movementFor(p)?.id ?? p.name),
        ),
    ),
  ];
  const logged = trainingLoadState(state).workouts.filter(
      (w) => w.localDate >= start && w.localDate <= today,
    ),
    measured = logged.filter(
      (w) =>
        ["completed", "partial"].includes(w.status) &&
        sessionLoad(w.actualDuration, w.actualRpe) !== null,
    ),
    load = measured.reduce(
      (a, w) => a + sessionLoad(w.actualDuration, w.actualRpe)!,
      0,
    );
  return (
    <>
      <div className="pagehead">
        <p className="eyebrow">LOAD, PERFORMANCE & RECOVERY</p>
        <h1>Progress in context.</h1>
        <p>Follow your training demand and recovery, one day at a time.</p>
      </div>
      <h2>Daily recovery and recorded load</h2>
      <div className="progress-controls">
        <Select
          label="Time step"
          value={period}
          options={[
            ["day", "Day"],
            ["week", "Week"],
            ["month", "Month"],
          ]}
          onChange={(v) => setPeriod(v as Period)}
        />
        <Select
          label="Recovery chart range"
          value={range}
          options={[
            ["program", "Current program"],
            ["7", "7 days"],
            ["28", "28 days"],
            ["84", "84 days"],
            ["all", "All history"],
          ]}
          onChange={setRange}
        />
      </div>
      {onActivity && (
        <details className="metric-details">
          <summary>Correct a rest / training day</summary>
          <div className="progress-controls">
            <label className="field">
              Activity date
              <input
                type="date"
                value={activityDate}
                onChange={(e) => {
                  if (e.target.value) setActivityDate(e.target.value);
                }}
              />
            </label>
            <Select
              label="Daily activity annotation"
              value={
                state.activities.find((a) => a.localDate === activityDate)
                  ?.status ?? "unknown"
              }
              options={[
                ["unknown", "Unlogged / unknown"],
                ["rest", "Confirmed rest day"],
                ["training", "Training day"],
              ]}
              onChange={(v) =>
                void onActivity({
                  localDate: activityDate,
                  status: v as "rest" | "training" | "unknown",
                  notes:
                    state.activities.find((a) => a.localDate === activityDate)
                      ?.notes ?? "",
                })
              }
            />
          </div>
          <p className="hint">
            Confirmed rest days are hidden from load charts and totals; their
            morning measurements stay visible. Missing training measurements
            remain unknown. Existing completed workouts are preserved;
            conflicting training must be reviewed in the log.
          </p>
        </details>
      )}
      <DemandCharts state={state} start={start} end={today} period={period} />
      <RecoveryCharts state={state} start={start} end={today} period={period} />
      <div className="stats">
        <Card>
          <p>Recorded actual load</p>
          <strong>{measured.length ? `${load} AU` : "No measured load"}</strong>
          <small>{measured.length} measured sessions</small>
          <small>
            Duration × whole-session RPE; missing components remain unknown.
          </small>
        </Card>
        <Card>
          <p>Confirmed training dates</p>
          <strong>
            {
              new Set(
                logged
                  .filter(
                    (w) =>
                      ["completed", "partial"].includes(w.status) &&
                      (w.rows.some((r) => r.confirmed) ||
                        sessionLoad(w.actualDuration, w.actualRpe) !== null),
                  )
                  .map((w) => w.localDate),
              ).size
            }
          </strong>
          <small>All programs and custom physical training</small>
        </Card>
        <Card>
          <p>Morning measurements</p>
          <strong>
            {
              state.mornings.filter(
                (m) => m.localDate >= start && m.localDate <= today,
              ).length
            }
          </strong>
          <small>Use consistent measurement protocols</small>
        </Card>
      </div>
      <details className="metric-details legacy-dose">
        <summary>Detailed program exposure and prescriptions</summary>
        <h2>Planned and actual training dose</h2>
        <div className="threecols">
          <Select
            label="Dose comparison program"
            value={track}
            options={programDefinitions.map((p) => [p.id, p.name])}
            onChange={(v) => {
              setTrack(v as typeof track);
              setEnrollment("");
              setMovement("");
            }}
          />
          <Select
            label="Dose comparison enrollment"
            value={enrollment}
            options={[
              ["", "Original source plan / actuals across runs"],
              ...state.enrollments
                .filter((e) => e.programId === track)
                .map(
                  (e) =>
                    [e.id, `${e.startDate} · ${e.status}`] as [string, string],
                ),
            ]}
            onChange={setEnrollment}
          />
          <Select
            label="Dose comparison movement"
            value={movement}
            options={[
              ["", "All movements — dimensions remain separate"],
              ...movements.map((m) => [m, m] as [string, string]),
            ]}
            onChange={setMovement}
          />
        </div>
        <p className="hint">
          All source weeks are shown before logging. Lines use prescribed range
          midpoints; bars retain the bounds. Volume totals cover readable known
          quantities. %1RM/rest summaries describe the selected prescriptions,
          not universal stress. Conditional choices and unmapped work are
          disclosed below. Compare individual movements to interpret velocity.
        </p>
        <details className="metric-details">
          <summary>Why do these lines have gaps?</summary>
          <p>
            Lines stop at program phase boundaries:{" "}
            {dose
              .flatMap((w, i) =>
                i > 0 && w.phaseId !== dose[i - 1].phaseId
                  ? [`W${dose[i - 1].week}–W${w.week}`]
                  : [],
              )
              .join(", ")}
            . Each phase is drawn separately, even when both weeks have values.
          </p>
          <p>
            Other gaps mean that this metric has no usable value for that week.
            Actual dose needs completed or partial sessions with confirmed work.
            Planned metrics can be absent or conditional; external weight volume
            needs a usable load or matching 1RM, and velocity needs comparable
            movement and measurement definitions. Some prescribed metrics, such
            as intra-cluster rest, have no matching actual-dose measurement.
            Unknown values are left blank rather than shown as zero. Confirmed
            rest dates are excluded from actual dose; saved records stay intact.
          </p>
        </details>
        {dose.every((w) => w.actual === null) && (
          <p>No actual sessions logged</p>
        )}
        <div className="chartgrid">
          {metrics.map(([key, title, unit]) => (
            <TimeSeries
              key={key}
              title={title}
              unit={unit}
              points={dose.flatMap((w) => {
                const v = w.planned[key],
                  planned =
                    Array.isArray(v) &&
                    v.length === 2 &&
                    typeof v[0] === "number"
                      ? (v as [number, number])
                      : null;
                let actual: number | null = null;
                if (w.actual) {
                  if (
                    key === "strengthReps" ||
                    key === "kgReps" ||
                    key === "sprintMetres" ||
                    key === "conditioningWorkSeconds" ||
                    key === "restSeconds" ||
                    key === "sets" ||
                    key === "relativeIntensity" ||
                    key === "workRestRatio" ||
                    key === "velocity"
                  )
                    actual = w.actual[key];
                  if (key === "jumpContacts")
                    actual = w.actual.jumpContactTotal;
                }
                return [
                  {
                    label: `W${w.week}`,
                    value: planned ? (planned[0] + planned[1]) / 2 : null,
                    low: planned?.[0],
                    high: planned?.[1],
                    series: "Planned",
                    segment: w.phaseId,
                    note: `${w.phaseId} · ${w.planned.unknown} incomplete/conditional fields${planned ? "" : " · no usable prescription for this metric"}`,
                  },
                  {
                    label: `W${w.week}`,
                    value: actual,
                    series: "Actual",
                    segment: w.phaseId,
                    note: w.actual
                      ? (() => {
                          const c =
                            w.actual.coverage[
                              (key === "jumpContacts"
                                ? "jumpContactTotal"
                                : key) as ExposureDimension
                            ];
                          return c
                            ? `${c.measured}/${c.expected} measured rows${c.measured < c.expected ? " · partial known total" : ""}`
                            : `${w.actual.unknown} incomplete fields`;
                        })()
                      : `${w.phaseId} · no completed/partial session with confirmed work`,
                  },
                ];
              })}
            />
          ))}
        </div>
        <Card>
          <h3>Source dose details and completeness</h3>
          <div className="tablewrap">
            <table aria-label="Program dose prescriptions">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Phase</th>
                  <th>Coverage</th>
                  <th>Tempo / velocity / energy instructions</th>
                </tr>
              </thead>
              <tbody>
                {dose
                  .slice()
                  .reverse()
                  .map((w) => (
                    <tr key={w.week}>
                      <td>W{w.week}</td>
                      <td>{w.phaseId}</td>
                      <td>
                        {w.planned.count} prescription blocks ·{" "}
                        {w.planned.unknown} incomplete/conditional fields
                      </td>
                      <td>
                        {w.planned.tempoInstructions.join("; ")}
                        <details>
                          <summary>See original dose requirements</summary>
                          {program.sessions
                            .filter((s) => w.sessions.includes(s.id))
                            .flatMap((s) =>
                              s.exercises.filter(
                                (p) =>
                                  !movement ||
                                  (movementFor(p)?.id ?? p.name) === movement,
                              ),
                            )
                            .map((p) => (
                              <p key={p.id}>
                                {p.sourceText}
                                {p.velocityVariants.length > 0 && (
                                  <span>
                                    {" "}
                                    ·{" "}
                                    {p.velocityVariants
                                      .map(
                                        (v) =>
                                          `${v.loadPercent[0]}%: ${v.target.join("–")} ${v.metric} m/s, floor ${v.floor}`,
                                      )
                                      .join("; ")}
                                  </span>
                                )}
                              </p>
                            ))}
                        </details>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </details>
      <Card>
        <h2>Saved training history</h2>
        <p>
          Historical dates stay fixed after scheduling changes. Global recovery
          includes paused, cancelled and completed runs.
        </p>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Session / date</th>
                <th>Status</th>
                <th>Planned load</th>
                <th>Actual load</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {state.workouts
                .slice()
                .sort((a, b) => b.localDate.localeCompare(a.localDate))
                .map((w) => (
                  <tr key={w.id}>
                    <td>
                      {getSession(w.sessionId ?? "")
                        ? sessionLabel(getSession(w.sessionId!)!)
                        : w.sessionId?.startsWith("bridge-")
                          ? "Familiarization bridge"
                          : "Custom saved session"}
                      <small>{w.localDate}</small>
                    </td>
                    <td>{w.status}</td>
                    <td>
                      {sessionLoad(w.plannedDuration, w.plannedRpe) ??
                        "Unknown"}{" "}
                      AU
                    </td>
                    <td>
                      {["completed", "partial"].includes(w.status)
                        ? (sessionLoad(w.actualDuration, w.actualRpe) ??
                          "Unknown")
                        : "Unperformed"}{" "}
                      AU
                    </td>
                    <td>
                      <button type="button" onClick={() => onOpen(w)}>
                        Open saved workout
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
