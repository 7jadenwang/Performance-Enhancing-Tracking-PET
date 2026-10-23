import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page.getByLabel("Requested program start").fill("2026-10-12");
  await page.getByRole("button", { name: "Queue selected program" }).click();
  await page.getByRole("button", { name: "Start queued program" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
});
test("logs actual partial work without copying targets into completed totals", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Program start date").fill("2026-10-13");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page
    .getByRole("button", { name: "LP · Phase 1 · W1 D1 · Monday", exact: true })
    .click();
  await page.getByRole("button", { name: "Log this session" }).click();
  await page.getByLabel("Actual training date").fill("2026-10-13");
  await page.getByRole("button", { name: "Load first sets" }).click();
  await page.getByRole("button", { name: "Save workout" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.getByText("0 measured sessions")).toBeVisible();
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page
    .getByRole("button", { name: "LP · Phase 1 · W1 D1 · Monday", exact: true })
    .click();
  await page.getByRole("button", { name: "Log this session" }).click();
  await page.getByLabel("Actual training date").fill("2026-10-13");
  await page.getByLabel("Session status").selectOption("partial");
  await page.getByLabel("Actual duration (minutes)").fill("60");
  await page.getByLabel("Actual session RPE").fill("6");
  await page.getByLabel("Completed set").first().check();
  await page.getByRole("button", { name: "Save workout" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(page.getByText("360 AU", { exact: true }).first()).toBeVisible();
});
test("records a morning CMJ and preserves it on reload", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("CMJ trial 1 (cm)").fill("30");
  await page.getByLabel("CMJ trial 2 (cm)").fill("31");
  await page.getByLabel("CMJ trial 3 (cm)").fill("32");
  await page.getByRole("button", { name: "Save morning" }).click();
  await expect(page.getByText("31.0 cm", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("31.0 cm", { exact: true })).toBeVisible();
});

test("matches measured velocity only after confirming the target metric", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page
    .getByRole("button", { name: "LP · Phase 1 · W1 D1 · Monday", exact: true })
    .click();
  await page.getByRole("button", { name: "Log this session" }).click();
  await page.getByLabel("Actual training date").fill("2026-10-13");
  await page.getByRole("button", { name: "Load first sets" }).click();
  await page
    .getByText("Tempo and measured velocity", { exact: true })
    .first()
    .click();
  await page.getByLabel("Set-average velocity (m/s)").first().fill("1.5");
  await page
    .getByLabel("Source target velocity metric")
    .first()
    .selectOption("mean");
  await expect(
    page.getByText("Target comparison: within", { exact: true }).first(),
  ).toBeVisible();
});

test("imports a reviewed backup and preserves calibration when saving settings", async ({
  page,
}) => {
  const { initialState } = await import("../../src/domain/schema");
  const { makeMorning } = await import("../../src/domain/fixtures");
  const state = initialState();
  state.startDate = "2026-10-13";
  state.mornings = Array.from({ length: 14 }, (_, i) =>
    makeMorning({
      id: String(i),
      localDate: `2026-10-${String(i + 1).padStart(2, "0")}`,
      trials: [30 + (i % 2), 30 + (i % 2), 30 + (i % 2)].map((heightCm) => ({
        heightCm,
        excluded: false,
        reason: "",
      })),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Import backup").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(
    page.getByText("Compatible backup:", { exact: false }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await page.getByRole("button", { name: "Establish baseline" }).click();
  await expect(page.getByText(/Baseline 30.5 cm/)).toBeVisible();
  await page.getByLabel("Rowing machine").selectOption("available");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText(/Baseline 30.5 cm/)).toBeVisible();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.screenshot({ path: "/tmp/pet-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "/tmp/pet-desktop.png", fullPage: true });
});
test("rejects corrupt backup without replacing existing morning records", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("CMJ trial 1 (cm)").fill("30");
  await page.getByRole("button", { name: "Save morning" }).click();
  await expect(page.getByText("30.0 cm", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Import backup").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Existing records are unchanged",
  );
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByText("30.0 cm", { exact: true })).toBeVisible();
});

test("reopens historical workout identity after its session is rescheduled", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Program start date").fill("2026-10-13");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page
    .getByRole("button", { name: "LP · Phase 1 · W1 D1 · Monday", exact: true })
    .click();
  await page.getByRole("button", { name: "Log this session" }).click();
  await page.getByLabel("Actual training date").fill("2026-10-13");
  await page.getByLabel("Actual duration (minutes)").fill("42");
  await page.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByText("Saved on this device").last()).toBeVisible();
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page
    .getByRole("button", { name: "LP · Phase 1 · W1 D1 · Monday", exact: true })
    .click();
  await page.getByLabel("Reschedule date").fill("2026-11-10");
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.getByRole("button", { name: "Open saved workout" }).click();
  await expect(page.getByLabel("Actual duration (minutes)")).toHaveValue("42");
  await expect(page.getByText("TRAINING LOG · 2026-10-13")).toBeVisible();
});

test("retains an unsaved entry and offers export when persistence fails", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page
    .getByRole("button", { name: "LP · Phase 1 · W1 D1 · Monday", exact: true })
    .click();
  await page.getByRole("button", { name: "Log this session" }).click();
  await page.getByLabel("Actual training date").fill("2026-10-13");
  await page.getByLabel("Actual duration (minutes)").fill("42");
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByRole("alert").first()).toContainText("Save failed");
  await expect(page.getByLabel("Actual duration (minutes)")).toHaveValue("42");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export this entry" }).click();
  expect((await download).suggestedFilename()).toBe("pet-unsaved-workout.json");
});

test("autosaves immediately across refresh and adds sets only within their movement", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page
    .getByRole("button", { name: "LP · Phase 1 · W1 D1 · Monday", exact: true })
    .click();
  await page.getByRole("button", { name: "Log this session" }).click();
  const groups = page.locator(".movement-group");
  await expect(groups.first().getByRole("button").first()).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(groups.nth(1).getByRole("button").first()).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.getByLabel("Actual duration (minutes)").fill("47");
  await page.reload();
  await expect(page.getByLabel("Actual duration (minutes)")).toHaveValue("47");
  const first = page.locator(".movement-group").first();
  await expect(first.locator(".setcard")).toHaveCount(1);
  await first.getByLabel("Completed set").check();
  await first.getByRole("button", { name: /Add next set/ }).click();
  await expect(first.locator(".setcard")).toHaveCount(1);
  await expect(first.getByRole("heading", { name: /Set 2$/ })).toBeVisible();
  await expect(first.getByLabel("Completed set")).not.toBeChecked();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.getByLabel("Time step").selectOption("week");
  await expect(
    page.getByRole("img", {
      name: "Session demand trends · exposure AU chart",
    }),
  ).toBeVisible();
  await page.getByLabel("Time step").selectOption("month");
  await expect(page.locator(".legacy-dose")).not.toHaveAttribute("open", "");
  await page.reload();
  await expect(page.getByLabel("Actual duration (minutes)")).toHaveCount(0);
});

test("keeps all existing saved fields unchanged when viewing the new progress and log", async ({
  page,
}) => {
  const { initialState, parseProgram } =
    await import("../../src/domain/schema");
  const { createWorkout, createRow, createVelocity, createMorning } =
    await import("../../src/domain/records");
  const { readFile } = await import("node:fs/promises");
  const program = parseProgram(
    JSON.parse(
      await readFile(
        new URL("../../src/program/catalog.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const state = initialState(),
    session = program.sessions[0],
    p = session.exercises.find((p) => p.sets)!;
  const oldWorkout = createWorkout({
    id: "historical-workout",
    sessionId: session.id,
    targetSnapshot: session.exercises,
    status: "completed",
    actualDuration: 51,
    actualRpe: 7,
    notes: "Original historical notes",
    rows: Array.from({ length: 20 }, (_, i) =>
      createRow({
        id: "historical-set-" + i,
        prescriptionId: p.id,
        movementId: p.movementId,
        exerciseId: p.name,
        name: p.name,
        confirmed: true,
        loadKg: 50 + i,
        reps: 3 + (i % 3),
        setRpe: 6,
        velocity: createVelocity({
          exerciseId: p.name,
          setAverage: 0.8 + i / 100,
        }),
        notes: "Original set " + i,
      }),
    ),
  });
  state.workouts = [oldWorkout];
  state.mornings = [
    createMorning({
      id: "historical-morning",
      localDate: "2026-10-13",
      fatigue: 4,
      soreness: 3,
      sleepQuality: 2,
      stress: 5,
    }),
  ];
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Import backup").setInputFiles({
    name: "history.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await expect(
    page.getByText("Compatible backup:", { exact: false }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  const stored = () =>
    page.evaluate(
      () =>
        new Promise<string>((resolve, reject) => {
          const req = indexedDB.open("pet-training-companion");
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result,
              read = db
                .transaction("state", "readonly")
                .objectStore("state")
                .get("athlete");
            read.onsuccess = () => {
              resolve(JSON.stringify(read.result.value));
              db.close();
            };
            read.onerror = () => reject(read.error);
          };
        }),
    );
  const before = await stored();
  await page.clock.install();
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.getByLabel("Time step").selectOption("week");
  await page.getByLabel("Time step").selectOption("month");
  await page.getByRole("button", { name: "Open saved workout" }).click();
  await expect(page.locator(".setcard")).toHaveCount(1);
  const historical = page
    .locator(".movement-group")
    .filter({ has: page.locator(".setcard") });
  await historical.locator(".movement-toggle").click();
  for (let i = 1; i <= 20; i++) {
    await historical
      .getByRole("button", { name: `Set ${i}, completed`, exact: true })
      .click();
    await expect(historical.getByLabel("External load (kg)")).toHaveValue(
      String(49 + i),
    );
    await expect(
      historical.getByLabel("Set notes", { exact: true }),
    ).toHaveValue("Original set " + (i - 1));
  }
  await page.clock.fastForward(2000);
  expect(await stored()).toBe(before);
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.clock.fastForward(2000);
  expect(await stored()).toBe(before);
});

test("keeps added custom sets together even before the first set is confirmed", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page
    .getByRole("button", { name: "LP · Phase 1 · W1 D1 · Monday", exact: true })
    .click();
  await page.getByRole("button", { name: "Log this session" }).click();
  await page
    .getByRole("button", { name: "+ Custom exercise", exact: true })
    .click();
  const custom = page.locator(".movement-group").last();
  await custom.getByRole("button", { name: /Add next set/ }).click();
  await expect(custom.locator(".setcard")).toHaveCount(1);
  await expect(custom.getByRole("heading", { name: /Set 2$/ })).toBeVisible();
  await custom
    .getByRole("button", { name: "Previous set", exact: true })
    .click();
  await expect(custom.getByRole("heading", { name: /Set 1$/ })).toBeVisible();
});

test("flips one set at a time, edits previous sets, and preserves values on reload and removal", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Program", exact: true }).click();
  await page
    .getByRole("button", { name: "LP · Phase 1 · W1 D1 · Monday", exact: true })
    .click();
  await page.getByRole("button", { name: "Log this session" }).click();
  const group = page.locator(".movement-group").first();
  await group.getByLabel("External load (kg)").fill("75");
  await group.getByLabel("Set notes", { exact: true }).fill("first original");
  await group.getByLabel("Completed set").check();
  await group.getByRole("button", { name: /Add next set/ }).click();
  await expect(group.locator(".setcard")).toHaveCount(1);
  await expect(group.getByLabel("External load (kg)")).toHaveValue("75");
  await group.getByLabel("External load (kg)").fill("80");
  await group.getByLabel("Set notes", { exact: true }).fill("second original");
  await group
    .getByRole("button", { name: "Previous set", exact: true })
    .click();
  await expect(group.getByLabel("Set notes", { exact: true })).toHaveValue(
    "first original",
  );
  await expect(
    group.getByRole("button", { name: "Previous set", exact: true }),
  ).toBeDisabled();
  await group.getByLabel("External load (kg)").fill("77.5");
  await group.getByRole("button", { name: "Next set", exact: true }).click();
  await expect(group.getByLabel("External load (kg)")).toHaveValue("80");
  await expect(
    group.getByRole("button", { name: "Next set", exact: true }),
  ).toBeDisabled();
  await group.getByRole("button", { name: /Add next set/ }).click();
  await expect(group.getByRole("heading", { name: /Set 3$/ })).toBeVisible();
  await expect(group.getByLabel("External load (kg)")).toHaveValue("77.5");
  await group
    .getByRole("button", { name: "Set 1, completed", exact: true })
    .click();
  await expect(group.getByLabel("External load (kg)")).toHaveValue("77.5");
  await group.locator(".movement-toggle").click();
  await group.locator(".movement-toggle").click();
  await expect(group.getByRole("heading", { name: /Set 1$/ })).toBeVisible();
  await page.reload();
  await group
    .getByRole("button", { name: "Set 2, unfinished", exact: true })
    .click();
  await expect(group.getByLabel("External load (kg)")).toHaveValue("80");
  await expect(group.getByLabel("Set notes", { exact: true })).toHaveValue(
    "second original",
  );
  await group
    .getByRole("button", { name: "Set 3, unfinished", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await group.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(group.getByRole("heading", { name: /Set 2$/ })).toBeVisible();
  await expect(group.locator(".setcard")).toHaveCount(1);
  await expect(
    group.getByRole("button", { name: "Set 3, unfinished", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
