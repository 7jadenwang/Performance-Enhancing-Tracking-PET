import { test, expect } from "@playwright/test";
test.use({ hasTouch: true });
test("provides keyboard chart values, raw tables and dark layouts without overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page
    .getByText("Detailed program exposure and prescriptions", { exact: true })
    .click();
  const chart = page.getByRole("img", {
    name: "Strength repetitions · reps chart",
  });
  await chart.getByRole("button").first().focus();
  await chart.getByRole("button").first().press("Enter");
  const details = chart.locator("..").getByRole("status");
  await expect(details).toContainText("W1");
  await expect(details).toContainText("Planned:");
  await expect(details).toContainText("Actual: Unknown");
  await chart.getByRole("button").first().press("Escape");
  await expect(details).toHaveCount(0);
  const bounds = await chart.boundingBox();
  await page.touchscreen.tap(
    bounds!.x + bounds!.width * 0.97,
    bounds!.y + bounds!.height * 0.5,
  );
  await expect(details).toContainText("W12");
  await expect(details).toContainText("Unknown");
  // Moving away does not dismiss a tapped selection.
  await page.mouse.move(0, 0);
  await expect(details).toContainText("W12");
  await expect(
    page.getByRole("table", { name: "Strength repetitions data" }),
  ).toHaveCount(0);
  await chart
    .locator("..")
    .getByRole("button", { name: "Clear selection" })
    .click();
  await expect(details).toHaveCount(0);
  await chart.getByRole("button").first().focus();
  await expect(chart.locator("..").locator(".chart-caption")).toContainText(
    "reps",
  );
  await page
    .getByRole("button", { name: "Strength repetitions data", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "Strength repetitions data" }),
  ).toContainText("Unknown");
  const doseRows = page
    .getByRole("table", { name: "Strength repetitions data" })
    .locator("tbody tr");
  await expect(doseRows.first().locator("td").first()).toHaveText("W12");
  await expect(doseRows.last().locator("td").first()).toHaveText("W1");
  await expect(
    page
      .getByRole("table", { name: "Program dose prescriptions" })
      .locator("tbody tr")
      .first()
      .locator("td")
      .first(),
  ).toHaveText("W12");
  await page.getByLabel("Recovery chart range").selectOption("84");
  await page
    .getByRole("button", { name: "CMJ height data", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "CMJ height data" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/pet-progress-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "/tmp/pet-progress-desktop.png",
    fullPage: true,
  });
});

test("starts progress at the active program onset and distinguishes soreness from stress", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByLabel("Requested program start").fill("2026-10-12");
  await page.getByRole("button", { name: "Queue selected program" }).click();
  await page.getByRole("button", { name: "Start queued program" }).click();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.getByLabel("Recovery chart range")).toHaveValue("program");
  await page
    .getByRole("button", { name: "Session demand trends data", exact: true })
    .click();
  const table = page.getByRole("table", { name: "Session demand trends data" });
  await expect(
    table.locator("tbody tr").last().locator("td").first(),
  ).toHaveText("2026-10-12");
  await page.getByLabel("Time step").selectOption("month");
  await expect(
    table.locator("tbody tr").last().locator("td").first(),
  ).toHaveText("2026-10-12");
  const chart = page.locator("section.chart").filter({
    has: page.getByRole("heading", {
      name: "Soreness and stress",
      exact: true,
    }),
  });
  const colors = await chart
    .locator(".legend i")
    .evaluateAll((nodes) =>
      nodes.map((n) => getComputedStyle(n).backgroundColor),
    );
  expect(colors).toHaveLength(2);
  expect(colors[0]).not.toBe(colors[1]);
});
