import { test, expect } from "@playwright/test";
test("saves half-point recovery ratings, hides confirmed rest only from load charts, and zooms measured axes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Program start date").fill("2026-10-12");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByLabel("Training date", { exact: true }).fill("2026-10-13");
  for (const name of [
    "Sleep quality (1 poor–10 good)",
    "Fatigue (1 low–10 high)",
    "Soreness (1 low–10 high)",
    "Stress (1 low–10 high)",
  ]) {
    await expect(page.getByLabel(name, { exact: true })).toHaveAttribute(
      "step",
      "0.5",
    );
    await page.getByLabel(name, { exact: true }).fill("6.5");
  }
  await page
    .getByLabel("Body mass (kg, optional)", { exact: true })
    .fill("75.1");
  await page.getByLabel("CMJ trial 1 (cm)").fill("30");
  await page.getByRole("button", { name: "Save morning" }).click();
  await page.reload();
  await page.getByLabel("Training date", { exact: true }).fill("2026-10-13");
  await expect(
    page.getByLabel("Fatigue (1 low–10 high)", { exact: true }),
  ).toHaveValue("6.5");
  await page.getByLabel("Training date", { exact: true }).fill("2026-10-14");
  await page
    .getByLabel("Body mass (kg, optional)", { exact: true })
    .fill("75.3");
  await page.getByLabel("CMJ trial 1 (cm)").fill("30.4");
  await page.getByRole("button", { name: "Save morning" }).click();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page
    .getByText("Correct a rest / training day", { exact: true })
    .click();
  await page.getByLabel("Activity date", { exact: true }).fill("2026-10-13");
  await page.getByLabel("Daily activity annotation").selectOption("rest");
  for (const title of [
    "Session demand trends",
    "Seven-day accumulated demand",
    "Planned versus actual session load",
    "Recorded load trends",
  ]) {
    await page
      .getByRole("button", { name: `${title} data`, exact: true })
      .click();
    await expect(
      page
        .getByRole("table", { name: `${title} data` })
        .locator("tbody tr")
        .filter({ hasText: "2026-10-13" }),
    ).toHaveCount(0);
  }
  for (const title of [
    "CMJ height",
    "Body mass",
    "Sleep quality",
    "Perceived fatigue",
    "Soreness and stress",
  ]) {
    await page
      .getByRole("button", { name: `${title} data`, exact: true })
      .click();
    const rows = page
      .getByRole("table", { name: `${title} data` })
      .locator("tbody tr")
      .filter({ hasText: "2026-10-13" });
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(rows.first().locator("td").nth(2)).not.toHaveText("Unknown");
  }
  await page
    .getByText("Detailed program exposure and prescriptions", { exact: true })
    .click();
  await page
    .getByText("Why do these lines have gaps?", { exact: true })
    .click();
  await expect(
    page.getByText(/Lines stop at program phase boundaries:/),
  ).toContainText("W4–W5, W8–W9");
  for (const title of ["CMJ height", "Body mass"]) {
    const chart = page
      .locator("section.chart")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await expect(chart.getByText(/Zoomed Y-axis/)).toBeVisible();
    expect(
      Number(
        await chart.locator("svg > g").first().locator("text").textContent(),
      ),
    ).toBeGreaterThan(0);
    await chart.screenshot({
      path:
        title === "CMJ height"
          ? "/tmp/pet-cmj-zoom.png"
          : "/tmp/pet-bodymass-zoom.png",
    });
  }
  await page.reload();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page
    .getByText("Correct a rest / training day", { exact: true })
    .click();
  await page.getByLabel("Activity date", { exact: true }).fill("2026-10-13");
  await expect(page.getByLabel("Daily activity annotation")).toHaveValue(
    "rest",
  );
});

test("connects demand trends through an unlogged rest day and subsequent empty days", async ({
  page,
}) => {
  const { initialState } = await import("../../src/domain/schema");
  const { createWorkout, createRow } = await import("../../src/domain/records");
  const state = initialState();
  state.startDate = "2026-10-12";
  state.workouts = ["2026-10-12", "2026-10-14"].map((date, i) =>
    createWorkout({
      id: "recorded-" + i,
      localDate: date,
      status: "completed",
      actualDuration: 60,
      actualRpe: 6,
      rows: [createRow({ kind: "strength", confirmed: true, reps: 5 })],
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Import backup").setInputFiles({
    name: "history.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(
    page.getByText("Compatible backup:", { exact: false }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  const chart = page.locator("section.chart").filter({
    has: page.getByRole("heading", {
      name: "Session demand trends",
      exact: true,
    }),
  });
  await chart
    .getByRole("button", { name: "Session demand trends data", exact: true })
    .click();
  const rows = chart.locator("tbody tr").filter({ hasText: "2026-10-13" });
  await expect(rows).toHaveCount(3);
  for (const row of await rows.all()) {
    await expect(row.locator("td").nth(2)).toHaveText("0.00");
    await expect(row).toContainText("displayed as zero");
  }
  const lines = await chart.locator("svg polyline").evaluateAll((nodes) =>
    nodes.map((n) =>
      n
        .getAttribute("points")!
        .split(" ")
        .map((pair) => pair.split(",").map(Number)),
    ),
  );
  expect(lines).toHaveLength(3);
  for (const points of lines) {
    expect(points[0][1]).toBeLessThan(points[1][1]);
    expect(points[2][1]).toBeLessThan(points[1][1]);
    expect(points[1][1]).toBe(points[3][1]);
  }
  await chart.screenshot({ path: "/tmp/pet-demand-zero-connected.png" });
});

test("shows missing-input reasons rather than zero for a recorded training day", async ({
  page,
}) => {
  const { initialState } = await import("../../src/domain/schema");
  const { createWorkout, createRow } = await import("../../src/domain/records");
  const state = initialState();
  state.startDate = "2026-10-12";
  state.workouts = [
    createWorkout({
      id: "training-oct13",
      localDate: "2026-10-13",
      status: "draft",
      actualDuration: null,
      actualRpe: null,
      rows: [createRow({ kind: "strength", confirmed: true, reps: 5 })],
    }),
  ];
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Import backup").setInputFiles({
    name: "training.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(
    page.getByText("Compatible backup:", { exact: false }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page
    .getByRole("button", { name: "Session demand trends data", exact: true })
    .click();
  const rows = page
    .getByRole("table", { name: "Session demand trends data" })
    .locator("tbody tr")
    .filter({ hasText: "2026-10-13" });
  await expect(rows).toHaveCount(3);
  for (const row of await rows.all()) {
    await expect(row.locator("td").nth(2)).toHaveText("Unknown");
    await expect(row).toContainText("Actual duration is missing");
    await expect(row).toContainText("Whole-session RPE is missing");
  }
});
