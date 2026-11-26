const test = require("node:test");
const assert = require("node:assert/strict");
const { analyse } = require("../assets/diary-classifier.js");
const training = Object.values(require("../data/diary-training.js")).flat();

for (const [expected, note] of [
  ["independent", "This morning I got dressed on my own."],
  ["hands_on", "My mum put my boots on for me."],
  ["prompting", "My neighbour reminded me to put on my clothes."],
  ["unclear", "I was dressed before breakfast. My sister visited this morning."],
  ["unclear", "I ate my breakfast all on my own."],
  ["unclear", "My sister did not help me get dressed."],
  ["unclear", "Yesterday my father helped me put on my socks."],
  ["independent", "Yesterday he did my buttons. Today I dressed myself without help."],
  ["hands_on", "My husband pulled my sweater over my head. I managed my socks myself."],
  ["prompting", "Once my daughter reminded me to get dressed, I put everything on myself."],
]) {
  test(expected + " — " + note, () => {
    assert.ok(!training.includes(note));
    const result = analyse(note);
    assert.equal(result.label, expected);
    assert.ok(result.quote.length > 0 && note.includes(result.quote));
  });
}
test("a blank or whitespace-only note has no evidence", () => {
  assert.deepEqual(analyse("   \n "), { label: "missing", quote: "" });
});
