/* Optional real-browser regression suite. CHROME_BIN may select an installed Chromium. */
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

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
    await page.locator("#patient-plot svg").waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator("#patient option").count(), 48);
    assert.equal(await page.locator("#morning option").count(), 56);
    assert.equal(await page.locator("#cohort-plot g").count(), 3);
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
      [
        "night-plot",
        "Estimated sleep stage",
        "Time of night (Oslo local time)",
      ],
    ]) {
      const labels = (
        await page.locator("#" + id).getAttribute("aria-labelledby")
      ).split(" ");
      for (const [i, expected] of [y, x].entries()) {
        assert.equal(await page.locator("#" + labels[i]).isVisible(), true);
        assert.equal(
          (await page.locator("#" + labels[i]).innerText()).trim(),
          expected,
        );
      }
    }
    assert.equal(await page.locator("#patient-plot .week-tick").count(), 0);
    assert.deepEqual(
      await page.locator("#sleep-plot .week-tick").allTextContents(),
      ["1", "2", "3", "4", "5", "6", "7", "8"],
    );
    assert.match(
      await page.locator("#group-explainer").innerText(),
      /three equal groups of 16 patients/,
    );
    assert.match(
      await page.locator("#groups button").first().innerText(),
      /2 or fewer awakenings per night/,
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
    await screenshot("desktop");
    for (const size of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(size);
      assert.ok(
        (await page
          .locator("#night-x")
          .evaluate((n) => n.getBoundingClientRect().bottom)) <= size.height,
        "All figures fit the desktop screen",
      );
    }
    await page.locator("#groups button").nth(2).click();
    assert.equal(await page.locator("#patient option").count(), 16);
    assert.match(await page.locator("#patient-group").innerText(), /Frequent/);
    assert.equal(await page.locator("#clear-group").isVisible(), true);
    await page.locator("#clear-group").click();
    assert.equal(await page.locator("#patient option").count(), 48);
    await page.selectOption("#patient", "P017");
    assert.match(
      await page.locator("#raw-file").getAttribute("href"),
      /P017.zip$/,
    );
    await page.selectOption("#from", "3");
    await page.selectOption("#to", "3");
    assert.equal(await page.locator("#morning option").count(), 7);
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
    await page.selectOption("#morning", String(missing));
    assert.match(
      await page.locator("#night-plot").innerText(),
      /No watch recording/,
    );
    await page.selectOption(
      "#morning",
      String(allDays.findIndex((d) => d.night)),
    );
    assert.equal(await page.locator("#night-plot svg").count(), 1);
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
      await variant.goto(page.url());
      if (mode === "invalid") {
        assert.equal(await variant.locator("#load-error").isVisible(), true);
        assert.equal(await variant.locator("#explorer").isVisible(), false);
      } else {
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
        assert.match(
          await variant.locator("#cohort-readout").innerText(),
          /no reports/,
        );
        assert.equal(await variant.locator("#morning option").count(), 7);
        assert.equal(
          await variant.locator("#sleep-plot rect.interactive").count(),
          0,
        );
      }
      await variant.close();
    }
    assert.deepEqual(issues, []);
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
