const test = require("node:test");
const assert = require("node:assert/strict");
const { pairedSummary, hierarchy } = require("../assets/profiles.js");

test("missing watch or diary records do not enter the heatmap shading", () => {
  const days = [
    { night: null, help: "independent" },
    { night: { bouts: 3 }, help: null },
    { night: { bouts: 0 }, help: "independent" },
    { night: { bouts: 4 }, help: "prompting" },
  ];
  assert.deepEqual(pairedSummary(days), { count: 2, wakes: 2, helped: 0.5 });
  assert.equal(pairedSummary(days.slice(0, 2)), null);
});
test("clustering preserves the leaves and separates records without a comparable week", () => {
  const a = { wakes: 0, helped: 0 },
    b = { wakes: 4, helped: 1 };
  const tree = hierarchy(
    [
      [a, null],
      [b, null],
      [a, null],
      [null, b],
      [null, null],
    ],
    4,
  );
  assert.deepEqual(tree.order, [3, 0, 2, 1, 4]);
  assert.equal(tree.forest.length, 3);
  assert.equal(tree.forest[1].children[0].height, 0);
  assert.equal(tree.forest[1].height, 1);
});
