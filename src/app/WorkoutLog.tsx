import { useState, useEffect, useRef } from "react";
import { useWorkoutDraft } from "./useWorkoutDraft";
import {
  movementGroups,
  movementKey,
  prescribedSet,
  startMovements,
  nextSet,
} from "../domain/movement-log";
import type {
  AthleteState,
  Workout,
  Session,
  ActualRow,
  VelocityRecord,
  Prescription,
} from "../domain/schema";
import { createRow, createVelocity, createWorkout } from "../domain/records";
import { sessionLoad } from "../metrics/load";
import { velocityLoss, compareVelocityTarget } from "../metrics/velocity";
import { suggestAlternatives } from "../program/alternatives";
import { Card, Num, Select, fmt, download } from "./fields";
import SubstitutionPreview from "./SubstitutionPreview";
import { acceptSubstitution } from "../program/substitutions";
import VelocityGuidance from "./VelocityGuidance";
import { selectConditionalTarget } from "../program/conditional-targets";
import { sessionLabel } from "../program/catalog";
import { weekdays } from "../program/schedule";
import { Sources } from "./Program";
export default function WorkoutLog({
  session,
  date,
  state,
  onSave,
  onBack,
  workoutId,
  enrollmentId,
}: {
  workoutId?: string;
  enrollmentId: string | null;
  session: Session;
  date: string;
  state: AthleteState;
  onSave: (w: Workout, expected: string) => Promise<boolean>;
  onBack: () => void;
}) {
  const identity = useRef(workoutId);
  const existing = state.workouts.find((w) =>
    identity.current
      ? w.id === identity.current
      : w.enrollmentId === enrollmentId &&
        w.sessionId === session.id &&
        (enrollmentId !== null || w.localDate === date),
  );
  const { w, update, save, message, error, remoteChanged, acceptIncomingBase } =
    useWorkoutDraft(
      session.id +
        ":" +
        (enrollmentId ?? date) +
        (session.id === "custom" ? ":" + workoutId : ""),
      existing,
      () =>
        createWorkout({
          id: crypto.randomUUID(),
          sessionId: session.id,
          enrollmentId,
          targetSnapshot: session.exercises,
          rows: startMovements([], session.exercises),
          localDate: date,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      onSave,
    );
  identity.current = w.id;
  const prescriptions =
    w.targetRevisions.at(-1)?.prescriptions ??
    (w.targetSnapshot.length ? w.targetSnapshot : session.exercises);
  const groups = movementGroups(w.rows, prescriptions);
  const ongoing =
    groups.find(
      (g) =>
        g.rows.length > 0 &&
        (g.rows.some((r) => !r.confirmed) ||
          (g.prescription?.sets &&
            g.rows.filter((r) => r.confirmed).length < g.prescription.sets[0])),
    )?.key ?? null;
  const [expanded, setExpanded] = useState<string[]>(ongoing ? [ongoing] : []);
  useEffect(() => {
    setExpanded(ongoing ? [ongoing] : []);
  }, [ongoing]);
  const [selectedSets, setSelectedSets] = useState<Record<string, string>>({});
  function selectSet(key: string, id: string) {
    setSelectedSets((current) => ({ ...current, [key]: id }));
  }
  function updateRow(id: string, v: Partial<ActualRow>) {
    update((current) => ({
      ...current,
      rows: current.rows.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...v };
        if (next.velocity)
          next.velocity = {
            ...next.velocity,
            loadKg: next.loadKg,
            loadConvention: next.loadConvention,
            loadedHands: next.loadedHands,
            exerciseId: next.exerciseId,
          };
        return next;
      }),
    }));
  }
  function add(p?: Prescription, key?: string) {
    const groupRows = groups.find((g) => g.key === (key ?? p?.id))?.rows ?? [];
    const prior = groupRows.find((r) => r.confirmed);
    const first = groupRows[0];
    const row = prior
      ? nextSet(prior)
      : p
        ? prescribedSet(p)
        : createRow({
            exerciseId: first?.exerciseId ?? "custom-" + crypto.randomUUID(),
            movementId: first?.movementId ?? null,
            prescriptionId:
              first?.prescriptionId ??
              (first ? null : "custom-" + crypto.randomUUID()),
            kind: first?.kind ?? "strength",
            name: first?.name ?? "Custom exercise",
          });
    if (p && !row.prescriptionId) row.prescriptionId = p.id;
    update({ rows: [...w.rows, row] });
    const groupKey = key ?? p?.id ?? movementKey(row);
    selectSet(groupKey, row.id);
    setExpanded([groupKey]);
  }
  function copy() {
    update({ rows: startMovements(w.rows, prescriptions) });
  }
  function velocity(r: ActualRow, v: Partial<VelocityRecord>) {
    updateRow(r.id, {
      velocity: {
        ...(r.velocity ??
          createVelocity({
            exerciseId: r.exerciseId,
            loadKg: r.loadKg,
            method: "",
            rangeOfMotion: "",
          })),
        ...v,
      },
    });
  }
  return (
    <>
      <button className="back" onClick={onBack}>
        ← Back to program
      </button>
      <div className="pagehead">
        <p className="eyebrow">TRAINING LOG · {w.localDate}</p>
        <h1>
          {sessionLabel(session)} · {weekdays[session.day - 1]}
        </h1>
        <p>Keep the prescription. Record the work you actually did.</p>
      </div>
      <Card>
        <details>
          <summary>Session plan and substitutions</summary>
          <Sources session={session} />
          {[
            ...new Set(
              prescriptions.flatMap((p) =>
                p.conditionalGroup ? [p.conditionalGroup] : [],
              ),
            ),
          ].map((group) => (
            <div className="notice" key={group}>
              <h3>Choose one source alternative</h3>
              <p>
                {group} · These alternatives are excluded from automatic set
                copying until selected.
              </p>
              {prescriptions
                .filter((p) => p.conditionalGroup === group)
                .map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() =>
                      update({
                        targetRevisions: [
                          ...w.targetRevisions,
                          {
                            id: crypto.randomUUID(),
                            sessionId: session.id,
                            prescriptions: selectConditionalTarget(
                              prescriptions,
                              group,
                              p.id,
                            ),
                            reason: "Explicit source choice: " + p.name,
                            createdAt: new Date().toISOString(),
                            kind: "alternative",
                          },
                        ],
                      })
                    }
                  >
                    Choose {p.name}
                  </button>
                ))}
            </div>
          ))}
          {prescriptions.map((p) => (
            <SubstitutionPreview
              key={p.id}
              prescription={p}
              state={state}
              date={date}
              onAccept={(preview) => update(acceptSubstitution(w, preview))}
            />
          ))}
          {w.targetRevisions.length > 0 && (
            <button
              type="button"
              onClick={() =>
                update({ targetRevisions: w.targetRevisions.slice(0, -1) })
              }
            >
              Undo last target change
            </button>
          )}
          <details>
            <summary>All original prescriptions</summary>
            <p className="sourceText">{session.sourceText}</p>
          </details>
        </details>
      </Card>
      {remoteChanged && (
        <div className="notice">
          <p>This workout changed on another device. Your draft is retained.</p>
          <details>
            <summary>Review saved incoming workout</summary>
            <pre>{JSON.stringify(existing, null, 2)}</pre>
          </details>
          <button
            type="button"
            onClick={() => {
              acceptIncomingBase();
            }}
          >
            Keep workout draft after reviewing
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Card>
          <div className="sectionhead">
            <h2>Session overview</h2>
            <label className="field">
              Actual training date
              <input
                type="date"
                value={w.localDate}
                onChange={(e) => update({ localDate: e.target.value })}
              />
            </label>
            <Select
              label="Session status"
              value={w.status}
              onChange={(v) => update({ status: v as Workout["status"] })}
              options={["draft", "partial", "completed", "skipped"]}
            />
          </div>
          <div className="twocol">
            <div>
              <p className="eyebrow">PLANNED · ESTIMATE</p>
              <Num
                label="Planned duration (minutes)"
                value={w.plannedDuration}
                onChange={(v) => update({ plannedDuration: v })}
              />
              <Num
                label="Target session RPE"
                value={w.plannedRpe}
                max={10}
                onChange={(v) => update({ plannedRpe: v })}
              />
              <p>
                {w.plannedDuration === null || w.plannedRpe === null
                  ? "Not estimated"
                  : fmt(sessionLoad(w.plannedDuration, w.plannedRpe)) + " AU"}
              </p>
            </div>
            <div>
              <p className="eyebrow">ACTUAL · YOUR EXPERIENCE</p>
              <Num
                label="Actual duration (minutes)"
                value={w.actualDuration}
                onChange={(v) => update({ actualDuration: v })}
              />
              <Num
                label="Actual session RPE"
                value={w.actualRpe}
                max={10}
                onChange={(v) => update({ actualRpe: v })}
              />
              <p>
                {w.status === "draft" || w.status === "skipped"
                  ? "Not counted as completed load"
                  : fmt(sessionLoad(w.actualDuration, w.actualRpe)) + " AU"}
              </p>
            </div>
          </div>
          <p className="hint">
            Whole-session RPE is separate from set RPE. Duration includes
            warm-up and prescribed rest; exclude unrelated interruptions.
          </p>
        </Card>
        <Card>
          <div className="sectionhead">
            <h2>Actual sets</h2>
            <button type="button" onClick={copy}>
              Load first sets
            </button>
          </div>
          <p className="hint">
            One set to start each movement. Add the next set when ready; it
            copies inputs from your first completed set. Use the set buttons or
            Previous/Next to edit one set at a time. Confirm sets and choose
            partial/completed status to count them.
          </p>
          <p role="status" className="autosave-status">
            {message || "Edits save automatically on this device"}
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button type="button" onClick={() => add()}>
            + Custom exercise
          </button>
        </Card>
        {groups.map((group) => {
          const complete = group.rows.filter((r) => r.confirmed).length;
          const target = group.prescription?.sets;
          const targetLabel = target
            ? target[0] === target[1]
              ? String(target[0])
              : target.join("–")
            : "open";
          const isOpen = expanded.includes(group.key);
          const selected =
            group.rows.find((r) => r.id === selectedSets[group.key]) ??
            group.rows.find((r) => !r.confirmed) ??
            group.rows.at(-1);
          const visibleRows = selected ? [selected] : [];
          const selectedIndex = group.rows.findIndex(
            (r) => r.id === selected?.id,
          );
          return (
            <section key={group.key} className="movement-group">
              <button
                type="button"
                className="movement-toggle"
                aria-expanded={isOpen}
                aria-controls={"movement-" + group.key}
                onClick={() =>
                  setExpanded((current) =>
                    current.includes(group.key)
                      ? current.filter((k) => k !== group.key)
                      : [...current, group.key],
                  )
                }
              >
                <span>
                  <strong>{group.name}</strong>
                  <small>
                    {group.rows.some((r) => !r.confirmed)
                      ? "In progress"
                      : complete
                        ? target && complete < target[0]
                          ? "Ready for next set"
                          : "Sets completed"
                        : "Not started"}
                  </small>
                </span>
                <span className="movement-count">
                  {complete}/{targetLabel} sets{" "}
                  <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                </span>
              </button>
              <div id={"movement-" + group.key} hidden={!isOpen}>
                <button
                  type="button"
                  className="add-next-set"
                  onClick={() => add(group.prescription, group.key)}
                >
                  {group.rows.length ? "Add next set" : "Start movement"} ·{" "}
                  {group.name}
                </button>
                {group.prescription && (
                  <p className="movement-target">
                    {group.prescription.sourceText}
                  </p>
                )}
                {group.rows.length > 0 && (
                  <nav
                    className="set-navigation"
                    aria-label={`Sets for ${group.name}`}
                  >
                    <div className="set-buttons" aria-label="Choose a set">
                      {group.rows.map((row, index) => (
                        <button
                          key={row.id}
                          type="button"
                          aria-pressed={row.id === selected?.id}
                          aria-label={`Set ${index + 1}, ${row.confirmed ? "completed" : "unfinished"}`}
                          onClick={() => selectSet(group.key, row.id)}
                        >
                          Set {index + 1}
                          {row.confirmed ? " ✓" : ""}
                        </button>
                      ))}
                    </div>
                    <div className="set-pager">
                      <button
                        type="button"
                        disabled={selectedIndex <= 0}
                        onClick={() =>
                          selectSet(group.key, group.rows[selectedIndex - 1].id)
                        }
                      >
                        Previous set
                      </button>
                      <span aria-live="polite">
                        Set {selectedIndex + 1} of {group.rows.length}
                        {target && <small>Target {targetLabel} sets</small>}
                      </span>
                      <button
                        type="button"
                        disabled={selectedIndex >= group.rows.length - 1}
                        onClick={() =>
                          selectSet(group.key, group.rows[selectedIndex + 1].id)
                        }
                      >
                        Next set
                      </button>
                    </div>
                  </nav>
                )}
                {visibleRows.map((r) => (
                  <Card key={r.id} className="setcard">
                    <div className="sectionhead">
                      <h3>
                        {r.name} · Set {selectedIndex + 1}
                      </h3>
                      <button
                        type="button"
                        className="subtle"
                        onClick={() => {
                          if (confirm("Remove this set?")) {
                            const adjacent =
                              group.rows[selectedIndex - 1] ??
                              group.rows[selectedIndex + 1];
                            if (adjacent) selectSet(group.key, adjacent.id);
                            update({
                              rows: w.rows.filter((x) => x.id !== r.id),
                            });
                          }
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="threecols">
                      <label className="field">
                        Exercise name
                        <input
                          value={r.name}
                          onChange={(e) =>
                            updateRow(r.id, {
                              name: e.target.value,
                              exerciseId: e.target.value,
                              velocity: r.velocity
                                ? {
                                    ...r.velocity,
                                    exerciseId: e.target.value,
                                  }
                                : null,
                            })
                          }
                        />
                      </label>
                      <Select
                        label="Work type"
                        value={r.kind}
                        options={[
                          "strength",
                          "jump",
                          "throw",
                          "hold",
                          "sprint",
                          "conditioning",
                          "other",
                        ]}
                        onChange={(v) =>
                          updateRow(r.id, { kind: v as ActualRow["kind"] })
                        }
                      />
                      <label className="check">
                        <input
                          type="checkbox"
                          aria-label="Completed set"
                          checked={r.confirmed}
                          onChange={(e) => {
                            selectSet(group.key, r.id);
                            updateRow(r.id, { confirmed: e.target.checked });
                          }}
                        />
                        Completed set
                      </label>
                    </div>
                    <div className="threecols">
                      {[
                        "strength",
                        "jump",
                        "throw",
                        "other",
                        "sprint",
                      ].includes(r.kind) && (
                        <Num
                          label={
                            r.kind === "sprint"
                              ? "Efforts completed"
                              : "Repetitions"
                          }
                          value={r.reps}
                          onChange={(v) => updateRow(r.id, { reps: v })}
                        />
                      )}
                      <Num
                        label="External load (kg)"
                        value={r.loadKg}
                        onChange={(v) =>
                          updateRow(r.id, {
                            loadKg: v,
                            velocity: r.velocity
                              ? { ...r.velocity, loadKg: v }
                              : null,
                          })
                        }
                      />
                      <Select
                        label="Load convention"
                        value={r.loadConvention}
                        options={[
                          "totalExternal",
                          "perHand",
                          "bodyweight",
                          "unknown",
                        ]}
                        onChange={(v) =>
                          updateRow(r.id, {
                            loadConvention: v as ActualRow["loadConvention"],
                          })
                        }
                      />
                      {r.loadConvention === "perHand" && (
                        <Select
                          label="Loaded hands per repetition"
                          value={
                            r.loadedHands === null
                              ? "unknown"
                              : String(r.loadedHands)
                          }
                          options={[
                            ["unknown", "Unconfirmed"],
                            ["1", "One loaded hand"],
                            ["2", "Two loaded hands"],
                          ]}
                          onChange={(v) =>
                            updateRow(r.id, {
                              loadedHands: v === "unknown" ? null : Number(v),
                            })
                          }
                        />
                      )}
                      {r.kind === "hold" && (
                        <Num
                          label="Hold duration (seconds)"
                          value={r.holdSeconds}
                          onChange={(v) => updateRow(r.id, { holdSeconds: v })}
                        />
                      )}
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={r.perSide}
                          onChange={(e) =>
                            updateRow(r.id, { perSide: e.target.checked })
                          }
                        />
                        Entered per side (both sides done)
                      </label>
                      {r.kind === "sprint" && (
                        <>
                          <Num
                            label="Distance per effort (metres)"
                            value={r.distanceMetres}
                            onChange={(v) =>
                              updateRow(r.id, { distanceMetres: v })
                            }
                          />
                          <Num
                            label="Time per effort (seconds)"
                            value={r.timeSeconds}
                            onChange={(v) =>
                              updateRow(r.id, { timeSeconds: v })
                            }
                          />
                        </>
                      )}
                      {r.kind === "conditioning" && (
                        <>
                          <Num
                            label="Rounds completed"
                            value={r.rounds}
                            onChange={(v) => updateRow(r.id, { rounds: v })}
                          />
                          <Num
                            label="Work duration (seconds)"
                            value={r.workSeconds}
                            onChange={(v) =>
                              updateRow(r.id, { workSeconds: v })
                            }
                          />
                        </>
                      )}
                      <Num
                        label="Rest duration (seconds)"
                        value={r.restSeconds}
                        onChange={(v) => updateRow(r.id, { restSeconds: v })}
                      />
                      <Num
                        label="Set RPE"
                        value={r.setRpe}
                        max={10}
                        onChange={(v) => updateRow(r.id, { setRpe: v })}
                      />
                      <Num
                        label="Reps in reserve"
                        value={r.rir}
                        onChange={(v) => updateRow(r.id, { rir: v })}
                      />
                    </div>
                    <details>
                      <summary>Tempo and measured velocity</summary>
                      <p className="sourceText">
                        {
                          prescriptions.find((p) => p.name === r.exerciseId)
                            ?.sourceText
                        }
                      </p>
                      <Select
                        label="Source target velocity metric"
                        value={r.sourceVelocityMetric ?? "unknown"}
                        options={[
                          ["unknown", "Unconfirmed"],
                          "mean",
                          "meanConcentric",
                          "meanPropulsive",
                          "peak",
                        ]}
                        onChange={(v) =>
                          updateRow(r.id, {
                            sourceVelocityMetric:
                              v === "unknown"
                                ? null
                                : (v as VelocityRecord["metric"]),
                          })
                        }
                      />
                      {r.velocity && (
                        <p>
                          Target comparison:{" "}
                          {(() => {
                            const p = prescriptions.find(
                              (p) => p.name === r.exerciseId,
                            );
                            return p
                              ? compareVelocityTarget(
                                  {
                                    ...p,
                                    velocityMetric: r.sourceVelocityMetric,
                                  },
                                  r.velocity!,
                                )
                              : "unknown";
                          })()}
                        </p>
                      )}
                      <VelocityGuidance
                        prescription={prescriptions.find(
                          (p) =>
                            p.id === r.prescriptionId ||
                            p.name === r.exerciseId,
                        )}
                        row={r}
                        state={state}
                        enabled={session.autoregulation !== "none"}
                        onAccept={(p, reason) => {
                          const targets = prescriptions.map((x) =>
                            x.id === p.id ? p : x,
                          );
                          update({
                            targetRevisions: [
                              ...w.targetRevisions,
                              {
                                id: crypto.randomUUID(),
                                sessionId: session.id,
                                prescriptions: targets,
                                reason,
                                createdAt: new Date().toISOString(),
                                kind: "velocity",
                              },
                            ],
                          });
                        }}
                      />
                      {(prescriptions.find(
                        (p) =>
                          p.id === r.prescriptionId || p.name === r.exerciseId,
                      )?.components.length ?? 0) > 0 && (
                        <Select
                          label="Velocity component"
                          value={r.velocity?.componentId ?? "unknown"}
                          options={[
                            ["unknown", "Choose component"],
                            ...(
                              prescriptions.find(
                                (p) =>
                                  p.id === r.prescriptionId ||
                                  p.name === r.exerciseId,
                              )?.components ?? []
                            ).map((c) => [c.id, c.name] as [string, string]),
                          ]}
                          onChange={(v) =>
                            velocity(r, {
                              componentId: v === "unknown" ? null : v,
                            })
                          }
                        />
                      )}
                      <div className="threecols">
                        <label className="field">
                          Tempo instruction
                          <input
                            value={r.tempo}
                            onChange={(e) =>
                              updateRow(r.id, { tempo: e.target.value })
                            }
                          />
                        </label>
                        <Select
                          label="Followed prescribed tempo"
                          value={
                            r.tempoFollowed === null
                              ? "unknown"
                              : r.tempoFollowed
                                ? "yes"
                                : "no"
                          }
                          options={["unknown", "yes", "no"]}
                          onChange={(v) =>
                            updateRow(r.id, {
                              tempoFollowed:
                                v === "unknown" ? null : v === "yes",
                            })
                          }
                        />
                        <Select
                          label="Velocity metric"
                          value={r.velocity?.metric ?? "mean"}
                          options={[
                            "mean",
                            "meanConcentric",
                            "meanPropulsive",
                            "peak",
                          ]}
                          onChange={(v) =>
                            velocity(r, {
                              metric: v as VelocityRecord["metric"],
                            })
                          }
                        />
                        <label className="field">
                          Velocity device / method
                          <input
                            value={r.velocity?.method ?? ""}
                            onChange={(e) =>
                              velocity(r, { method: e.target.value })
                            }
                          />
                        </label>
                        <label className="field">
                          Range of motion
                          <input
                            value={r.velocity?.rangeOfMotion ?? ""}
                            onChange={(e) =>
                              velocity(r, { rangeOfMotion: e.target.value })
                            }
                          />
                        </label>
                        <Num
                          label="Set-average velocity (m/s)"
                          value={r.velocity?.setAverage ?? null}
                          onChange={(v) => velocity(r, { setAverage: v })}
                        />
                      </div>
                      <VelocityInput
                        key={r.id}
                        values={r.velocity?.repVelocities ?? []}
                        onChange={(values) =>
                          velocity(r, { repVelocities: values })
                        }
                      />
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={r.velocity?.completeSeries ?? false}
                          onChange={(e) =>
                            velocity(r, { completeSeries: e.target.checked })
                          }
                        />
                        Complete series for this set
                      </label>
                      {r.velocity && (
                        <p>
                          End-of-set velocity loss:{" "}
                          {fmt(velocityLoss(r.velocity), 1)}
                          {velocityLoss(r.velocity) !== null ? "%" : ""}.
                          Fastest rep compared with final rep. A set average
                          cannot produce this value.
                        </p>
                      )}
                      <p className="hint">
                        MV in the source is not automatically assumed to match
                        your device's metric. Match measurement definitions
                        before comparing targets.
                      </p>
                    </details>
                    <label className="field">
                      Set notes
                      <input
                        value={r.notes}
                        onChange={(e) =>
                          updateRow(r.id, { notes: e.target.value })
                        }
                      />
                    </label>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
        <Card>
          <h2>Equipment alternatives</h2>
          {session.exercises
            .filter((p) => p.kind === "conditioning")
            .map((p) => (
              <div key={p.id} className="prescription">
                <h3>{p.name}</h3>
                <p>{p.sourceText}</p>
                {suggestAlternatives(p, state.equipment).map((a) => (
                  <div key={a.modality}>
                    <p>
                      {a.reason} {a.changes}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        update({
                          substitutions: [
                            ...w.substitutions.filter(
                              (x) => x.exerciseId !== p.id,
                            ),
                            {
                              exerciseId: p.id,
                              original: p.name,
                              actual: a.modality,
                              reason: a.reason,
                            },
                          ],
                        })
                      }
                    >
                      Record running substitution
                    </button>
                  </div>
                ))}
              </div>
            ))}
          {w.substitutions.map((s) => (
            <p key={s.exerciseId}>
              {s.original} → {s.actual}{" "}
              <button
                type="button"
                onClick={() =>
                  update({
                    substitutions: w.substitutions.filter(
                      (x) => x.exerciseId !== s.exerciseId,
                    ),
                  })
                }
              >
                Undo
              </button>
            </p>
          ))}
          <label className="field">
            Session notes
            <textarea
              value={w.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </label>
          <div className="sectionhead">
            <button className="primary" type="submit" disabled={remoteChanged}>
              Save workout
            </button>
            <button
              type="button"
              onClick={() =>
                download(JSON.stringify(w, null, 2), "pet-unsaved-workout.json")
              }
            >
              Export this entry
            </button>
          </div>
        </Card>
      </form>
    </>
  );
}

function VelocityInput({
  values,
  onChange,
}: {
  values: number[];
  onChange: (values: number[]) => void;
}) {
  const [text, setText] = useState(values.join(", "));
  const [invalid, setInvalid] = useState(false);
  return (
    <label className="field">
      Per-repetition velocity (comma separated m/s)
      <input
        value={text}
        aria-invalid={invalid}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const pieces = raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const numbers = pieces.map(Number);
          const valid = numbers.every((n) => Number.isFinite(n) && n >= 0);
          setInvalid(!valid);
          if (valid) onChange(numbers);
        }}
      />
      {invalid && (
        <small role="alert">
          Enter non-negative numbers separated by commas. Invalid text is not
          saved.
        </small>
      )}
    </label>
  );
}
