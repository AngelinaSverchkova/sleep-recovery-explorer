const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../assets/model.js");

test("unrecorded sleep and unanswered diaries have separate denominators", () => {
  const days = [
    { night: null, help: "independent" },
    { night: { bouts: 4, sleep: 480 }, help: null },
    { night: { bouts: 0, sleep: 450 }, help: "hands_on" },
  ];
  assert.deepEqual(M.summarize(days), {
    reports: 2,
    independent: 1,
    rate: 50,
    nights: 2,
    bouts: 2,
    sleep: 465,
  });
  assert.deepEqual(M.summarize([]), {
    reports: 0,
    independent: 0,
    rate: null,
    nights: 0,
    bouts: null,
    sleep: null,
  });
});
test("cohort means weight patients equally and exclude unavailable weekly estimates", () => {
  const a = { id: "A", group: "fewer" },
    b = { id: "B", group: "fewer" };
  const weeks = new Map([
    ["A", [{ rate: 100 }, { rate: null }]],
    ["B", [{ rate: 0 }, { rate: 40 }]],
  ]);
  const cohort = M.cohortWeeks([a, b], weeks);
  assert.deepEqual(cohort[0].weeks, [
    { rate: 50, n: 2 },
    { rate: 40, n: 1 },
  ]);
  assert.equal(cohort[1].members, 0);
  assert.deepEqual(cohort[1].weeks, [
    { rate: null, n: 0 },
    { rate: null, n: 0 },
  ]);
});
test("browser input contract accepts missing observations and unclassified patients", () => {
  const data = fixture();
  data.patients[0].group = "unclassified";
  assert.equal(M.validDataset(data), true);
  const night = {
    start: 1760000040,
    sleep: 15,
    awake: 5,
    bouts: 1,
    runs: [
      ["D", 10],
      ["W", 5],
      ["C", 5],
    ],
  };
  data.patients[0].days[1].night = night;
  assert.equal(M.validDataset(data), true);
  night.bouts = 2;
  assert.equal(M.validDataset(data), false);
});
function fixture() {
  return {
    version: 1,
    synthetic: true,
    timezone: "Europe/Oslo",
    weeks: 1,
    patients: [
      {
        id: "P001",
        group: "fewer",
        days: Array.from({ length: 7 }, (_, i) => ({
          date: "2026-10-0" + (i + 1),
          night: null,
          help: null,
        })),
      },
    ],
  };
}
test("malformed bundle, duplicated identifiers, calendar gaps and unknown diary values fail closed", () => {
  for (const value of [undefined, {}, { ...fixture(), patients: null }])
    assert.equal(M.validDataset(value), false);
  for (const mutate of [
    (d) => d.patients.push(d.patients[0]),
    (d) => d.patients[0].days.pop(),
    (d) => (d.patients[0].days[2].date = "2026-10-08"),
    (d) => (d.patients[0].days[1].help = "yes"),
    (d) => (d.patients[0].days[0].night = { runs: [] }),
  ]) {
    const data = fixture();
    mutate(data);
    assert.equal(M.validDataset(data), false);
  }
});
test("time window includes both endpoints and supports a single week", () => {
  assert.deepEqual(M.bounds(6, 1, "from"), [6, 6]);
  assert.deepEqual(M.bounds(6, 1, "to"), [1, 1]);
  assert.deepEqual(M.weekIndices(2, 4), [2, 3, 4]);
  assert.deepEqual(M.weekIndices(1, 1), [1]);
});
test("weeks are grouped by the original timeline, independent of display window", () => {
  const p = {
    days: Array.from({ length: 14 }, (_, i) => ({
      night: null,
      help: i < 7 ? "hands_on" : "independent",
    })),
  };
  assert.deepEqual(
    M.patientWeeks(p).map((w) => w.rate),
    [0, 100],
  );
});
