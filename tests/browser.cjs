/* Optional real-browser regression suite. CHROME_BIN may select an installed Chromium. */
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function checkHostedDiary(browser) {
  const page = await browser.newPage();
  const dashboard = "https://preview.example", api = "https://diary.example/api/diary/analyse";
  const types = { ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".ttf": "font/ttf" };
  const requests = [];
  let reply = { label: "hands_on", quote: "helped with my socks" };
  await page.route(dashboard + "/**", async route => {
    const pathname = new URL(route.request().url()).pathname;
    const file = path.join(__dirname, "..", pathname === "/" ? "index.html" : pathname);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
    let body = fs.readFileSync(file);
    if (pathname === "/")
      body = body.toString().replace('name="diary-api-url" content=""', 'name="diary-api-url" content="' + api + '"');
    await route.fulfill({ body, contentType: types[path.extname(file)] });
  });
  await page.route(api, async route => {
    const headers = { "Access-Control-Allow-Origin": dashboard, "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: reply, headers });
  });
  try {
    await page.goto(dashboard + "/#patients");
    await page.locator("#review-open").click();
    await page.locator("#review-method").selectOption("hosted");
    const note = "My partner helped with my socks.";
    await page.locator("#review-note").fill(note);
    assert.deepEqual(requests, []);
    await page.locator("#review-analyse").click();
    await page.getByText("Suggested label · Needed physical help", { exact: true }).waitFor();
    assert.deepEqual(requests, [{ note }]);
    assert.equal(await page.locator("#review-output blockquote").innerText(), reply.quote);
    reply = { label: "hands_on", quote: "invented quote" };
    await page.locator("#review-analyse").click();
    await page.getByText(/did not return a valid label/).waitFor();
    assert.equal(await page.locator("#review-output blockquote").count(), 0);
  } finally {
    await page.close();
  }
}

async function main() {
  const opts = { headless: true };
  if (process.env.CHROME_BIN) opts.executablePath = process.env.CHROME_BIN;
  const browser = await chromium.launch(opts);
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const issues = [],
      external = [];
    page.on("pageerror", (e) => issues.push(e.message));
    page.on("request", (r) => {
      if (/^https?:/.test(r.url())) external.push(r.url());
    });
    await page.goto(
      pathToFileURL(path.resolve(__dirname, "../index.html")).href,
    );
    await page.locator("#cohort-plot svg").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const compare = page.getByRole("link", {
      name: "Compare sleep groups",
      exact: true,
    });
    const individual = page.getByRole("link", {
      name: "Patients",
      exact: true,
    });
    async function openView(view) {
      await (view === "compare" ? compare : individual).click();
      await page.locator("#" + view + "-view").waitFor();
    }
    const rows = page.locator("#patient-matrix tbody tr");
    const weeks = page.locator("#patient-matrix thead th[data-week]");
    const calendar = Array.from({ length: 8 }, (_, i) => "Week " + (i + 1));
    assert.equal(await page.locator("#patient option").count(), 48);
    assert.equal(await page.locator("#cohort-plot g").count(), 4);
    assert.equal(await rows.count(), 48);
    assert.deepEqual(await weeks.allTextContents(), calendar);
    assert.equal(await page.locator(".row-branches svg").count(), 1);
    assert.equal(await page.locator(".col-branches svg").count(), 0);
    await page.selectOption("#matrix-order", "both");
    assert.equal(await page.locator(".col-branches svg").count(), 1);
    assert.deepEqual((await weeks.allTextContents()).sort(), calendar);
    await page.selectOption("#matrix-order", "id");
    assert.deepEqual(await weeks.allTextContents(), calendar);
    assert.equal(await rows.first().locator("th").innerText(), "P001");
    const firstPatient = rows.first().getByRole("button").first();
    await firstPatient.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    assert.deepEqual(
      await page
        .locator("#patient-matrix button:focus")
        .evaluate((el) => [
          el.parentElement.dataset.person,
          el.parentElement.dataset.week,
        ]),
      ["P002", "0"],
    );
    await page.selectOption("#matrix-order", "time");
    const marked = page.locator("#cohort-plot g").nth(2).locator("path").last();
    await marked.scrollIntoViewIfNeeded();
    const box = await marked.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(await rows.count(), 16);
    const p12 = page.locator(
      '#patient-matrix td[data-person="P012"][data-week="7"]',
    );
    assert.equal(await p12.innerText(), "0%");
    await p12.click({ position: { x: 1, y: 1 } });
    await page.locator("#patients-view").waitFor();
    assert.equal(await page.locator("#patient").inputValue(), "P012");
    assert.match(
      await page.locator("#patient-readout").innerText(),
      /Week 8.*0 of 6/,
    );
    assert.equal(await page.locator("#mornings tr").count(), 7);
    assert.equal(
      await page
        .locator("#mornings tr")
        .filter({ hasText: "No report" })
        .count(),
      1,
    );
    // Try the complete AI flow from a heatmap cell, including a truly absent note.
    const review = page.getByRole("button", { name: "Review diary with AI" });
    const analyse = page.getByRole("button", { name: "Analyse note" });
    const note = page.locator("#review-note"), result = page.locator("#review-output");
    await review.click();
    assert.equal(await note.inputValue(), "");
    await analyse.click();
    assert.match(await result.innerText(), /No diary entry/);
    await page.locator("#mornings tr").last().getByRole("button").click();
    assert.match(await note.inputValue(), /sweater/);
    assert.equal(await result.innerText(), "");
    await analyse.click();
    assert.match(await result.innerText(), /Needed physical help/);
    assert.ok((await note.inputValue()).includes(await result.locator("blockquote").innerText()));
    await note.fill("My niece reminded me to put on my shirt.");
    assert.equal(await result.innerText(), "");
    await analyse.click();
    assert.match(await result.innerText(), /Needed a reminder/);
    await page.getByRole("button", { name: "Try an example" }).click();
    assert.equal(await result.innerText(), "");
    await review.click();
    assert.equal(await note.isVisible(), false);
    await page.locator("#previous-week").click();
    assert.match(await page.locator("#diary-title").innerText(), /Week 7/);
    await page.locator("#next-week").click();
    assert.ok(await page.locator("#next-week").isDisabled());
    await openView("compare");
    await page.locator("#clear-group").click();
    await openView("patients");
    await page.locator("#patient-plot svg").waitFor();
    // Labels are visible and programmatically linked to the exact chart they describe.
    for (const [id, y, x] of [
      [
        "patient-plot",
        "Mornings dressed without help (% of reported mornings)",
        "Week of follow-up",
      ],
      [
        "sleep-plot",
        "Recorded awakenings per night (weekly average)",
        "Week of follow-up",
      ],
      [
        "cohort-plot",
        "Mornings dressed without help (group average, %)",
        "Week of follow-up",
      ],
      ["night-plot", "Estimated sleep stage", "Time of night (CET)"],
    ]) {
      await openView(id === "cohort-plot" ? "compare" : "patients");
      if (id === "night-plot") {
        const recorded = page
          .locator("#mornings tr")
          .filter({ hasNotText: "No recording" })
          .first();
        await recorded.locator("button").click();
      }
      const labels = (
        await page.locator("#" + id).getAttribute("aria-labelledby")
      ).split(" ");
      for (const [i, expected] of [y, x].entries()) {
        assert.equal(
          await page.locator("#" + labels[i]).isVisible(),
          true,
          labels[i],
        );
        assert.equal(
          (await page.locator("#" + labels[i]).innerText())
            .replace(/\s+/g, " ")
            .trim(),
          expected,
        );
      }
    }
    assert.equal(await page.locator("#patient-plot .week-tick").count(), 0);
    assert.deepEqual(
      await page.locator("#sleep-plot .week-tick").allTextContents(),
      ["1", "2", "3", "4", "5", "6", "7", "8"],
    );
    await page.locator("#patient-plot").focus();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    assert.match(await page.locator("#patient-readout").innerText(), /Week 2/);
    await page.keyboard.press("End");
    await page.locator("#patient-plot").blur();
    const screenshot = async (name) => {
      if (!process.env.QA_DIR) return;
      fs.mkdirSync(process.env.QA_DIR, { recursive: true });
      await page.screenshot({
        path: path.join(process.env.QA_DIR, name + ".png"),
        fullPage: true,
      });
    };
    await screenshot("desktop-patient");
    await openView("compare");
    await screenshot("desktop");
    await page.locator("#groups button").nth(2).click();
    assert.equal(await page.locator("#patient option").count(), 16);
    await page.locator("#clear-group").click();
    assert.equal(await page.locator("#patient option").count(), 48);
    await openView("patients");
    await page.selectOption("#patient", "P017");
    assert.match(
      await page.locator("#raw-file").getAttribute("href"),
      /P017.zip$/,
    );
    await page.selectOption("#from", "3");
    await page.selectOption("#to", "3");
    assert.equal(await page.locator("#mornings tr").count(), 7);
    assert.match(await page.locator("#patient-readout").innerText(), /Week 4/);
    await page.selectOption("#from", "6");
    assert.equal(await page.locator("#to").inputValue(), "6");
    await page.selectOption("#to", "0");
    assert.equal(await page.locator("#from").inputValue(), "0");
    await page.selectOption("#to", "7");
    await page.locator("#patient-plot .interactive").nth(2).click();
    assert.match(await page.locator("#patient-readout").innerText(), /Week 3/);
    // Chart and cohort share selection, and both patient plots align at the same x coordinates.
    const alignment = await page.evaluate(() => {
      const dots = [...document.querySelectorAll("#patient-plot circle")].map(
        (n) => n.cx.baseVal.value,
      );
      const bars = [
        ...document.querySelectorAll("#sleep-plot rect.interactive"),
      ].map((n) => n.x.baseVal.value + n.width.baseVal.value / 2);
      const labels = [
        ...document.querySelectorAll("#sleep-plot text:not(.week-tick)"),
      ].map((n) => n.getBBox());
      const first = document
        .querySelector("#sleep-plot rect.interactive")
        .getBBox();
      return {
        dots,
        bars,
        clear: labels.every((r) => r.x + r.width < first.x),
      };
    });
    assert.equal(alignment.clear, true);
    assert.equal(alignment.dots.length, alignment.bars.length);
    alignment.dots.forEach((v, i) =>
      assert.ok(Math.abs(v - alignment.bars[i]) < 0.1),
    );
    const allDays = await page.evaluate(
      () =>
        window.SLEEP_RECOVERY_DATA.patients.find((p) => p.id === "P017").days,
    );
    const missing = allDays.findIndex((d) => !d.night);
    assert.ok(missing >= 0);
    async function openDay(i) {
      await page
        .locator("#patient-plot .interactive")
        .nth(Math.floor(i / 7))
        .click();
      await page
        .locator("#mornings button")
        .nth(i % 7)
        .click();
    }
    await openDay(missing);
    assert.match(
      await page.locator("#night-plot").innerText(),
      /No watch recording/,
    );
    await openDay(allDays.findIndex((d) => d.night));
    assert.equal(await page.locator("#night-plot svg").count(), 1);
    const clockLabels = (
      await page.locator("#night-plot svg text").allTextContents()
    ).filter((label) => /^\d{2}:\d{2}$/.test(label));
    assert.ok(clockLabels.length >= 2);
    const minutes = clockLabels.map(
      (label) => Number(label.slice(0, 2)) * 60 + Number(label.slice(3)),
    );
    const spacings = minutes
      .slice(1)
      .map((n, i) => (1440 + n - minutes[i]) % 1440);
    assert.ok(spacings[0] > 0 && spacings.every((gap) => gap === spacings[0]));
    assert.deepEqual(
      await page.evaluate(() =>
        ["2026-10-24T23:00:00Z", "2026-10-25T23:00:00Z"].map((iso) =>
          RecoveryCharts.formatTime(Date.parse(iso) / 1000),
        ),
      ),
      ["00:00", "00:00"],
    );
    await page.locator("#methods-open").click();
    assert.equal(await page.locator("dialog").isVisible(), true);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog").isVisible(), false);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForFunction(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      assert.ok(await page.locator("#patient-plot svg").isVisible());
      await screenshot("mobile-" + width);
      await openView("compare");
      assert.ok(await page.locator("#cohort-hint").isVisible());
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await openView("patients");
    }
    assert.deepEqual(issues, []);
    assert.deepEqual(external, []);
    // Exercise alternative valid datasets through the real file:// entry point.
    // Transform the generated bundle at load time without modifying any project files.
    for (const mode of ["sparse", "invalid"]) {
      const variant = await browser.newPage();
      variant.on("pageerror", (e) => issues.push(e.message));
      await variant.addInitScript((mode) => {
        Object.defineProperty(window, "SLEEP_RECOVERY_DATA", {
          set(payload) {
            const patient = payload.patients[0];
            const days = patient.days
              .slice(0, 7)
              .map((d) => ({ ...d, night: null, help: null }));
            Object.defineProperty(window, "SLEEP_RECOVERY_DATA", {
              value:
                mode === "invalid"
                  ? { version: 1, synthetic: true }
                  : {
                      ...payload,
                      weeks: 1,
                      patients: [{ ...patient, group: "unclassified", days }],
                    },
              configurable: true,
            });
          },
          configurable: true,
        });
      }, mode);
      await variant.goto(page.url().split("#")[0]);
      if (mode === "invalid") {
        assert.equal(await variant.locator("#load-error").isVisible(), true);
        assert.equal(await variant.locator("#explorer").isVisible(), false);
      } else {
        assert.equal(
          await variant.locator("#patient-matrix tbody tr").count(),
          1,
        );
        assert.match(
          await variant.locator("#cohort-readout").innerText(),
          /no reports/,
        );
        await variant
          .getByRole("link", { name: "Patients", exact: true })
          .click();
        await variant.locator("#patients-view").waitFor();
        assert.match(
          await variant.locator("#patient-group").innerText(),
          /Insufficient/,
        );
        assert.match(
          await variant.locator("#patient-readout").innerText(),
          /No morning reports/,
        );
        assert.equal(
          await variant.locator("#groups button:disabled").count(),
          3,
        );
        assert.equal(await variant.locator("#mornings tr").count(), 7);
        assert.equal(
          await variant.locator("#sleep-plot rect.interactive").count(),
          0,
        );
      }
      await variant.close();
    }
    assert.deepEqual(issues, []);
    await checkHostedDiary(browser);
    console.log(
      "Browser checks passed: local file, offline assets, group filtering, week windows, night selection, missing data, dialog, desktop and mobile layouts.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
