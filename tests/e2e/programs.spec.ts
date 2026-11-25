import { test, expect } from "@playwright/test";
test("chooses an enrollment, follows Monday Sunday labels and pauses without erasing progress", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByLabel("Enrollment program").selectOption("up");
  await page.getByLabel("Requested program start").fill("2026-10-13");
  await page.getByRole("button", { name: "Queue selected program" }).click();
  await page.getByRole("button", { name: "Start queued program" }).click();
  await expect(
    page
      .getByText("Concurrent Strength, Power & Sprint Development", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /UP · Phase 1 · W1 D1 · Monday/ }),
  ).toBeVisible();
  await expect(
    page.getByText("2026-10-19", { exact: false }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pause program", exact: true })
    .click();
  await expect(page.getByText("paused", { exact: true }).first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await expect(page.getByText("paused", { exact: true }).first()).toBeVisible();
});
test("shows complete prescribed load profiles before any actual training exists", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page
    .getByText("Detailed program exposure and prescriptions", { exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Planned and actual training dose" }),
  ).toBeVisible();
  await page.getByLabel("Dose comparison program").selectOption("up");
  await expect(
    page.getByRole("img", { name: "Strength repetitions · reps chart" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Strength repetitions data" }).click();
  await expect(
    page.getByRole("table", { name: "Strength repetitions data" }),
  ).toBeVisible();
  await expect(
    page.getByText("No actual sessions logged", { exact: true }),
  ).toBeVisible();
});
test("opens both final UP phases and displays the optional October source", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByLabel("Browse program").selectOption("up");
  await page.getByLabel("Training phase").selectOption("up-3");
  await expect(page.getByRole("heading", { name: /Velocity-Guided Strength/ })).toBeVisible();
  await page.getByRole("button", { name: /UP · Phase 3 · W4 D7 · Sunday/ }).click();
  await expect(page.getByRole("heading", { name: /负重CMJ加测.*optional/ })).toBeVisible();
  await page.getByLabel("Training phase").selectOption("up-4");
  await expect(page.getByRole("heading", { name: /Velocity Baselines/ })).toBeVisible();
  await page.getByRole("button", { name: /UP · Phase 4 · W4 D2 · Tuesday/ }).click();
  await page.getByText("Original plan images (2)").click();
  await expect(page.getByRole("img", { name: "Oct_W4D2_Optional.jpg" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /六角杠硬拉.*optional/ })).toBeVisible();
});
test("lets users configure equipment and movement familiarity", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByText("Gym equipment and movement familiarity", { exact: true })
    .click();
  await page.getByLabel("Equipment: trapBar").selectOption("unavailable");
  await page.getByLabel("Familiar: 后蹲 · Back squat").check();
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByText("Gym equipment and movement familiarity", { exact: true })
    .click();
  await expect(page.getByLabel("Equipment: trapBar")).toHaveValue(
    "unavailable",
  );
  await expect(page.getByLabel("Familiar: 后蹲 · Back squat")).toBeChecked();
});
test("records a replacement-specific reviewed velocity calibration", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Calibration movement").selectOption("front-squat");
  await page.getByLabel("Calibration %1RM minimum").fill("65");
  await page.getByLabel("Calibration %1RM maximum").fill("75");
  await page.getByLabel("Calibration velocity minimum (m/s)").fill("0.6");
  await page.getByLabel("Calibration velocity maximum (m/s)").fill("0.7");
  await page.getByLabel("Calibration range of motion").fill("full");
  await page.getByLabel("Calibration device / method").fill("encoder");
  await page
    .getByRole("button", { name: "Save reviewed velocity calibration" })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByText(/front-squat · 65–75%1RM · 0.6–0.7/),
  ).toBeVisible();
});
