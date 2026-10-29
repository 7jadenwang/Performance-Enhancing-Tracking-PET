import {
  trainingLoadState,
  withoutRestDates,
} from "../../metrics/load-visibility";
import { ratingOnTen } from "../../metrics/recovery-ratings";
import type { Period } from "../../metrics/periods";
import type { AthleteState } from "../../domain/schema";
import { buildTimeline, rollingLoad } from "../../metrics/timeline";
import { cmjComparisonForDate } from "../../metrics/cmj-progress";
import { dailyCmj } from "../../metrics/recovery";
import { velocityHistory, compatibleVelocity } from "../../metrics/velocity";
import TimeSeries, { type ChartPoint } from "./TimeSeries";
export default function RecoveryCharts({
  state,
  start,
  end,
  period = "day",
}: {
  state: AthleteState;
  start: string;
  end: string;
  period?: Period;
}) {
  const timeline = buildTimeline(state, { start, end }),
    loadTimeline = buildTimeline(trainingLoadState(state), { start, end }),
    loadDays = withoutRestDates(loadTimeline, state),
    mornings = timeline.flatMap((p) => p.mornings),
    protocols = [...new Set(mornings.map((m) => m.protocolId))];
  const sleep = timeline.map((p) => ({
    label: p.date,
    value: p.mornings.at(-1)?.sleepHours ?? null,
    series: "Sleep",
  }));
  const cmj: ChartPoint[] = protocols.flatMap((protocol) =>
    timeline.map((p) => {
      const m = p.mornings.find((m) => m.protocolId === protocol);
      return {
        label: p.date,
        value: m ? dailyCmj(m).meanCm : null,
        series:
          state.protocols.find((x) => x.id === protocol)?.name ?? protocol,
        segment: protocol,
      };
    }),
  );
  const references: ChartPoint[] = protocols.flatMap((protocol) =>
    timeline.map((p) => {
      const comparison = cmjComparisonForDate(state, protocol, p.date);
      return {
        label: p.date,
        value: comparison.referenceCm,
        series: `${state.protocols.find((x) => x.id === protocol)?.name ?? protocol} · reference`,
        segment: protocol + "|" + comparison.segment,
        note: comparison.note,
      };
    }),
  );
  const deviations: ChartPoint[] = protocols.flatMap((protocol) =>
    timeline.map((p) => {
      const comparison = cmjComparisonForDate(state, protocol, p.date);
      return {
        label: p.date,
        value: comparison.percentageChange,
        series:
          state.protocols.find((x) => x.id === protocol)?.name ?? protocol,
        segment: protocol + "|" + comparison.segment,
        note: comparison.note,
      };
    }),
  );
  const referenceStyles = Object.fromEntries(
    references.map((p) => [p.series, { color: "#ff7d8e", dash: "6 4" }]),
  );
  const ratings = (key: "sleepQuality" | "fatigue" | "soreness" | "stress") =>
    timeline.map((p) => ({
      label: p.date,
      value: p.mornings.at(-1) ? ratingOnTen(p.mornings.at(-1)!, key) : null,
      series: key,
      note: p.mornings.at(-1)?.pain
        ? "Pain reported"
        : p.mornings.at(-1)?.illness
          ? "Illness reported"
          : "",
    }));
  const bodily = (key: "bodyMassKg" | "restingHeartRate") =>
    timeline.map((p) => ({
      label: p.date,
      value: p.mornings.at(-1)?.[key] ?? null,
      series: key,
    }));
  const hrvKeys = [
    ...new Set(
      mornings.flatMap((m) =>
        m.hrv
          ? [`${m.hrv.metric}|${m.hrv.method}|${m.hrv.protocol}|${m.hrv.unit}`]
          : [],
      ),
    ),
  ];
  const velocities = velocityHistory(
    state.workouts.filter((w) => w.localDate >= start && w.localDate <= end),
  );
  const cohorts: (typeof velocities)[] = [];
  for (const v of velocities) {
    const group = cohorts.find((g) =>
      compatibleVelocity(g[0].velocity, v.velocity),
    );
    if (group) group.push(v);
    else cohorts.push([v]);
  }
  return (
    <>
      <div className="chartgrid">
        <TimeSeries
          period={period}
          aggregation="sum"
          title="Planned versus actual session load"
          unit="AU"
          points={loadDays.flatMap((p) => [
            { label: p.date, value: p.plannedAu, series: "Planned" },
            {
              label: p.date,
              value: p.actualAu,
              series: "Actual",
              note: p.conflict ? "Rest/training annotation conflict" : "",
            },
          ])}
        />
        <TimeSeries
          period={period}
          title="Recorded load trends"
          unit="AU/day"
          points={[
            ...withoutRestDates(rollingLoad(loadTimeline, 7), state).map(
              (p) => ({
                label: p.date,
                value: p.meanAu,
                series: "7-day mean",
              }),
            ),
            ...withoutRestDates(rollingLoad(loadTimeline, 28), state).map(
              (p) => ({
                label: p.date,
                value: p.meanAu,
                series: "28-day mean",
              }),
            ),
          ]}
        />
        <TimeSeries
          period={period}
          title="CMJ height"
          yAxis="data"
          minimumSpan={1}
          unit="cm"
          seriesStyles={referenceStyles}
          caption="CMJ height and the red dashed reference are both in cm. Reference uses your calibrated baseline when available; otherwise it is a provisional mean of up to 14 earlier suitable recorded days for the same protocol, using available valid trials. This does not establish a calibrated baseline."
          points={
            cmj.length
              ? [...cmj, ...references]
              : timeline.map((p) => ({
                  label: p.date,
                  value: null,
                  series: "CMJ",
                }))
          }
        />
        <TimeSeries
          period={period}
          title="CMJ deviation from reference"
          unit="%"
          points={deviations}
          caption="Percentage change = 100 × (daily mean CMJ − reference) ÷ reference. Positive means above reference; negative means below. Without an active calibrated baseline, Progress uses a labelled provisional reference from earlier suitable records. No comparison is possible on the first day of a protocol or without a CMJ measurement; tap the chart for the reason. Calibration in Settings still requires 14 eligible days with three valid trials each."
          warning
        />
        <TimeSeries
          period={period}
          title="Sleep duration"
          unit="hours"
          points={sleep}
        />
        <TimeSeries
          period={period}
          title="Sleep quality"
          unit="1 poor – 10 good"
          yRange={[1, 10]}
          points={ratings("sleepQuality")}
        />
        <TimeSeries
          period={period}
          title="Perceived fatigue"
          unit="1 low – 10 high"
          yRange={[1, 10]}
          points={ratings("fatigue")}
          warning
        />
        <TimeSeries
          period={period}
          title="Soreness and stress"
          unit="1 low – 10 high"
          yRange={[1, 10]}
          points={[...ratings("soreness"), ...ratings("stress")]}
          warning
        />
        {mornings.some((m) => m.bodyMassKg !== null) && (
          <TimeSeries
            period={period}
            title="Body mass"
            yAxis="data"
            minimumSpan={0.5}
            unit="kg"
            points={bodily("bodyMassKg")}
          />
        )}
        {mornings.some((m) => m.restingHeartRate !== null) && (
          <TimeSeries
            period={period}
            title="Resting heart rate"
            unit="bpm"
            points={bodily("restingHeartRate")}
          />
        )}
        {hrvKeys.map((key) => (
          <TimeSeries
            period={period}
            key={key}
            title={`HRV · ${key.split("|").slice(0, 3).join(" · ")}`}
            unit={key.split("|")[3]}
            points={timeline.map((p) => {
              const measurement = p.mornings.find(
                (m) =>
                  m.hrv &&
                  `${m.hrv.metric}|${m.hrv.method}|${m.hrv.protocol}|${m.hrv.unit}` ===
                    key,
              )?.hrv;
              return {
                label: p.date,
                value: measurement?.value ?? null,
                series: key,
                segment: key,
              };
            })}
          />
        ))}
        {cohorts.map((group, i) => (
          <TimeSeries
            period={period}
            key={i}
            title={`Measured velocity · ${group[0].row.name} · ${group[0].velocity.loadKg}kg · ${group[0].velocity.metric}`}
            unit="m/s"
            points={group.map((v) => ({
              label: v.date,
              value:
                v.velocity.setAverage ??
                (v.velocity.repVelocities.length
                  ? v.velocity.repVelocities.reduce((a, b) => a + b, 0) /
                    v.velocity.repVelocities.length
                  : null),
              series: "Compatible measurements",
              segment:
                group[0].velocity.method +
                "|" +
                group[0].velocity.rangeOfMotion,
              note: v.velocity.componentId ?? "",
            }))}
          />
        ))}
      </div>
      <div className="card">
        <h3>Timeline annotations</h3>
        {timeline
          .filter(
            (p) =>
              p.markers.length ||
              p.conflict ||
              p.mornings.some((m) => m.pain || m.illness),
          )
          .map((p) => (
            <p key={p.date}>
              {p.date} ·{" "}
              {[
                ...p.markers,
                ...(p.conflict ? ["Rest/training conflict"] : []),
                ...p.mornings.flatMap((m) => [
                  ...(m.pain
                    ? ["Pain: " + (m.painLocation || "location unspecified")]
                    : []),
                  ...(m.illness ? ["Illness reported"] : []),
                ]),
              ].join(" · ")}
            </p>
          ))}
        <p>
          Load trends are descriptive exposure estimates. CMJ deviation is
          percentage performance change. The red dashed CMJ reference is in cm;
          provisional references use earlier daily means and do not change saved
          calibration or readiness signals. Perceived fatigue is your own
          check-in. Earlier 1–5 ratings are displayed ×2 on the 10-point scale;
          saved values remain unchanged.
        </p>
      </div>
    </>
  );
}
