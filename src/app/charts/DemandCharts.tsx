import type { AthleteState } from "../../domain/schema";
import { demandAxes, demandChartTimeline } from "../../metrics/training-demand";
import {
  confirmedRestDates,
  trainingLoadState,
  withoutRestDates,
} from "../../metrics/load-visibility";
import { addDays } from "../../program/schedule";
import type { Period } from "../../metrics/periods";
import TimeSeries from "./TimeSeries";
const names = {
  force: "Force",
  power: "Explosive / power",
  metabolic: "Metabolic",
};
export default function DemandCharts({
  state,
  start,
  end,
  period,
}: {
  state: AthleteState;
  start: string;
  end: string;
  period: Period;
}) {
  const rest = confirmedRestDates(state),
    history = demandChartTimeline(
      trainingLoadState(state),
      addDays(start, -6),
      end,
    ),
    days = withoutRestDates(
      history.filter((p) => p.date >= start),
      state,
    );
  return (
    <section className="demand-panel">
      <div className="sectionhead">
        <div>
          <h2>Training demand</h2>
          <p className="hint">
            Every session can contribute to all three trends.
          </p>
        </div>
        <span className="model-label">Estimated exposure · model v1</span>
      </div>
      <div className="chartgrid">
        <TimeSeries
          title="Session demand trends"
          unit="exposure AU"
          period={period}
          aggregation="sum"
          caption="Confirmed rest days are hidden. Days without recorded training are shown as zero and connected. Recorded sessions, unfinished logs and annotated training days with missing load measurements remain gaps."
          points={days.flatMap((p) =>
            demandAxes.map((axis) => ({
              label: p.date,
              value: p[axis],
              series: names[axis],
              note: p.assumedZero
                ? "No recorded training · displayed as zero"
                : p[axis] === null && p.missingInputs.length
                  ? p.missingInputs.join(" · ")
                  : `${p.classified}/${p.confirmed} blocks classified · ${p.measuredIntensity} with measured relative load · ${p.measuredVelocity} with compatible velocity`,
            })),
          )}
        />
        <TimeSeries
          title="Seven-day accumulated demand"
          unit="exposure AU"
          period={period}
          points={history.flatMap((p, i) => {
            if (p.date < start || rest.has(p.date)) return [];
            const window = history.slice(Math.max(0, i - 6), i + 1);
            return demandAxes.map((axis) => {
              const known = window.filter((d) => d[axis] !== null),
                recorded = known.filter((d) => !d.assumedZero),
                assumed = known.filter((d) => d.assumedZero);
              return {
                label: p.date,
                value: known.length
                  ? known.reduce((s, d) => s + d[axis]!, 0)
                  : null,
                series: names[axis],
                note: `${recorded.length}/7 recorded or confirmed-rest days · ${assumed.length} unlogged days displayed as zero${period !== "day" ? " · period mean of seven-day totals" : ""}`,
              };
            });
          })}
        />
      </div>
      <details className="metric-details">
        <summary>How scores work and what is covered</summary>
        <p>
          Overall session load is duration × whole-session RPE. The three
          overlapping demand scores multiply that load by the mean emphasis of
          confirmed sets/blocks. They are descriptive estimates, not measured
          force, power, energy expenditure, or validated physiological stress.
          Do not add the three scores together.
        </p>
        <p>
          Force covers resistance and isometric work. Explosive / power covers
          force–velocity work, jumps, throws, sprints and reactive/RFD-oriented
          work; it does not measure RFD directly. Metabolic covers conditioning
          and the endurance contribution of other work. Technical movements also
          retain a practice-set count below.
        </p>
        <p>
          Model v1 coefficients (Force / Power / Metabolic): resistance 0.8 /
          0.3 / 0.3; holds 0.8 / 0 / 0.2; jumps, throws and power lifts 0.5 / 1
          / 0.2; sprints 0.4 / 1 / 0.5; conditioning 0.1 / 0.1 / 1. Each
          set/block has equal influence; this is a coarse session-emphasis
          model, not an estimate of time spent in each system.
        </p>
        <p>
          When a dated matching 1RM and total external load are recorded, force
          emphasis becomes 0.3 + 0.7 × relative load (capped at 100%); ordinary
          resistance power emphasis becomes 0.15 + 0.35 × (1 − relative load).
          Compatible measured velocity adjusts power emphasis relative to that
          movement’s target, capped between 0 and 1. Missing measurements use
          the disclosed work-type estimate; prescribed loads are never presented
          as measured.
        </p>
        <p>
          Confirmed rest days are excluded from load plots and totals; morning
          monitoring keeps those dates. Seven-day windows still use calendar
          days, including rest days with zero load. Days with no training log or
          training annotation are displayed as zero and connected, including
          unlogged days. This is a chart assumption; it does not mark the day as
          confirmed rest or change saved records. Unclassified work and recorded
          sessions with missing RPE/duration remain unknown. Weekly/monthly load
          shows recorded totals plus displayed zeroes; recovery shows means.
          Point details distinguish confirmed records from assumed zeroes.
        </p>
        <p>
          Technique/skill practice:{" "}
          {days.reduce((sum, p) => sum + p.practiceSets, 0)} confirmed sets in
          mapped technical/control movements. Unmapped practice remains in the
          log; this count does not measure learning quality.
        </p>
      </details>
    </section>
  );
}
