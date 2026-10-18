import { chartDomain } from "../../metrics/chart-domain";
import { useState, useId } from "react";
import { aggregatePoints, type Period } from "../../metrics/periods";
export type ChartPoint = {
  label: string;
  value: number | null;
  low?: number;
  high?: number;
  series: string;
  segment?: string;
  note?: string;
};
export default function TimeSeries({
  title,
  unit,
  points: rawPoints,
  period = "day",
  aggregation = "mean",
  warning = false,
  yAxis = "zero",
  minimumSpan = 1,
  yRange,
  caption,
}: {
  title: string;
  unit: string;
  points: ChartPoint[];
  period?: Period;
  aggregation?: "sum" | "mean";
  warning?: boolean;
  yAxis?: "zero" | "data";
  minimumSpan?: number;
  yRange?: [number, number];
  caption?: string;
}) {
  const points = aggregatePoints(rawPoints, period, aggregation);
  const [hover, setHover] = useState<ChartPoint | null>(null),
    [table, setTable] = useState(false),
    [selection, setSelection] = useState<{
      label: string;
      period: Period;
    } | null>(null),
    id = useId();
  const labels = [...new Set(points.map((p) => p.label))],
    series = [...new Set(points.map((p) => p.series))],
    valid = points.filter((p) => p.value !== null),
    width = 660,
    height = 245,
    pad = 44;
  const [min, max] =
      yRange ??
      chartDomain(
        valid.flatMap((p) => [p.low ?? p.value, p.high ?? p.value]),
        yAxis === "zero",
        minimumSpan,
      ),
    span = max - min || 1;
  const x = (label: string) =>
      pad +
      (labels.indexOf(label) / Math.max(1, labels.length - 1)) *
        (width - pad - 18),
    y = (v: number) => height - 36 - ((v - min) / span) * (height - 68);
  const selectedLabel =
    selection?.period === period && labels.includes(selection.label)
      ? selection.label
      : null;
  const selectedPoints = points.filter((p) => p.label === selectedLabel);
  const selectLabel = (label: string) => setSelection({ label, period });
  const displayValue = (p: ChartPoint) =>
    p.value === null
      ? "Unknown"
      : p.low !== undefined && p.high !== undefined
        ? `${p.low.toFixed(2)}–${p.high.toFixed(2)} ${unit}`
        : `${p.value.toFixed(2)} ${unit}`;
  // Sort a copy for the table only; charts continue from oldest to newest.
  const tablePoints = [...points].sort((a, b) =>
    b.label.localeCompare(a.label, undefined, { numeric: true }),
  );
  const color = (name: string) =>
    warning
      ? ["#ff7d8e", "#f6bd60", "#b8a1ff", "#70a9ff"][series.indexOf(name) % 4]
      : ["#6ee7b7", "#70a9ff", "#f6bd60", "#dc9eef"][series.indexOf(name) % 4];
  return (
    <section className="card chart">
      <div className="sectionhead">
        <h3>{title}</h3>
        <span className="unit">{unit}</span>
      </div>
      <div className="legend">
        {series.map((s) => (
          <span key={s}>
            <i style={{ background: color(s) }} />
            {s}
          </span>
        ))}
      </div>
      {yAxis === "data" && (
        <p className="chart-axis-note hint">
          Zoomed Y-axis · {min.toFixed(2)}–{max.toFixed(2)} {unit}
        </p>
      )}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title} · ${unit} chart`}
        aria-describedby={id}
        onClick={(event) => {
          if (!labels.length) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const position =
            ((event.clientX - bounds.left) / bounds.width) * width;
          const index = Math.max(
            0,
            Math.min(
              labels.length - 1,
              Math.round(
                ((position - pad) / (width - pad - 18)) *
                  Math.max(1, labels.length - 1),
              ),
            ),
          );
          selectLabel(labels[index]);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setSelection(null);
            setHover(null);
          }
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={pad}
              x2={width - 18}
              y1={y(min + span * t)}
              y2={y(min + span * t)}
              className="gridline"
            />
            <text x={pad - 7} y={y(min + span * t) + 4} textAnchor="end">
              {Number(
                (min + span * t).toFixed(
                  yAxis === "data" || yRange ? 2 : span < 5 ? 1 : 0,
                ),
              )}
            </text>
          </g>
        ))}
        {selectedLabel && (
          <line
            x1={x(selectedLabel)}
            x2={x(selectedLabel)}
            y1={32}
            y2={height - 36}
            className="chart-selection-line"
            aria-hidden="true"
          />
        )}
        {series.flatMap((s) => {
          const segments: ChartPoint[][] = [];
          let current: ChartPoint[] = [];
          for (const p of points.filter((p) => p.series === s)) {
            if (
              p.value === null ||
              (current.length && p.segment !== current.at(-1)?.segment)
            ) {
              if (current.length) segments.push(current);
              current = [];
            }
            if (p.value !== null) current.push(p);
          }
          if (current.length) segments.push(current);
          return segments.map((seg, i) => (
            <g key={s + i}>
              <polyline
                points={seg
                  .map((p) => `${x(p.label)},${y(p.value!)}`)
                  .join(" ")}
                fill="none"
                stroke={color(s)}
                strokeWidth="2.5"
                strokeDasharray={
                  s === "Actual" || (warning && series.indexOf(s) % 2 === 1)
                    ? "5 3"
                    : undefined
                }
              />
              {seg.map((p, j) => (
                <g key={j}>
                  {p.low !== undefined && p.high !== undefined && (
                    <line
                      x1={x(p.label)}
                      x2={x(p.label)}
                      y1={y(p.low)}
                      y2={y(p.high)}
                      stroke={color(s)}
                      strokeOpacity=".5"
                      strokeWidth="5"
                    />
                  )}
                  <circle
                    cx={x(p.label)}
                    cy={y(p.value!)}
                    r={hover === p || selectedLabel === p.label ? 5 : 3}
                    fill={color(s)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${p.label}, ${p.series}: ${p.value!.toFixed(2)} ${unit}${p.note ? ", " + p.note : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectLabel(p.label);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectLabel(p.label);
                      }
                    }}
                    onFocus={() => setHover(p)}
                    onMouseEnter={() => setHover(p)}
                    onBlur={() => setHover(null)}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              ))}
            </g>
          ));
        })}
        {labels
          .filter(
            (_, i) =>
              i === 0 ||
              i === labels.length - 1 ||
              i % Math.max(1, Math.ceil(labels.length / 7)) === 0,
          )
          .map((label) => (
            <text key={label} x={x(label)} y={height - 10} textAnchor="middle">
              {label.length > 10 ? label.slice(5) : label}
            </text>
          ))}
      </svg>
      {selectedPoints.length > 0 && (
        <div className="chart-selection">
          <div role="status" aria-live="polite" aria-atomic="true">
            <strong>{selectedLabel}</strong>
            <ul>
              {selectedPoints.map((p, i) => (
                <li key={i}>
                  <span style={{ color: color(p.series) }}>{p.series}: </span>
                  {displayValue(p)}
                  {p.note && <small>{p.note}</small>}
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelection(null);
              setHover(null);
            }}
          >
            Clear selection
          </button>
        </div>
      )}
      <p id={id} className="chart-caption">
        {hover
          ? `${hover.label} · ${hover.series}: ${hover.low !== undefined && hover.high !== undefined ? `${hover.low.toFixed(2)}–${hover.high.toFixed(2)}` : hover.value?.toFixed(2)} ${unit}${hover.note ? " · " + hover.note : ""}`
          : valid.length
            ? (caption ??
              "Ranges retain their bounds. Missing values create gaps. Tap the plot or focus a point for exact values.")
            : "No measured values in this range."}
      </p>
      <p className="hint">
        Tap the plot to select a date/week and see its values. Use Enter or
        Space on a focused point; Escape clears the selection.
      </p>
      <button
        type="button"
        aria-expanded={table}
        onClick={() => setTable(!table)}
      >
        {title} data
      </button>
      {table && (
        <div className="tablewrap">
          <table aria-label={`${title} data`}>
            <thead>
              <tr>
                <th>Date/week</th>
                <th>Series</th>
                <th>Value ({unit})</th>
                <th>Context</th>
              </tr>
            </thead>
            <tbody>
              {tablePoints.map((p, i) => (
                <tr key={i}>
                  <td>{p.label}</td>
                  <td>{p.series}</td>
                  <td>
                    {p.value === null
                      ? "Unknown"
                      : p.low !== undefined
                        ? `${p.low.toFixed(2)}–${p.high!.toFixed(2)}`
                        : p.value.toFixed(2)}
                  </td>
                  <td>{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
