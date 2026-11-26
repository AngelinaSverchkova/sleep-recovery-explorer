const test = require("node:test");
const assert = require("node:assert/strict");
const browser = require("../assets/diary-api.js");
const origin = "https://preview.example";
const endpoint = "https://service.example/api/diary/analyse";
const note = "I buttoned my shirt without help.";
const answer = { label: "independent", quote: "without help" };

async function call(body, overrides = {}, settings = {}) {
  const worker = (await import("../worker/index.mjs")).default;
  const request = new Request(endpoint, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body), ...settings,
  });
  const env = {
    ALLOWED_ORIGINS: origin,
    DIARY_LIMIT: { limit: async () => ({ success: true }) },
    AI: { run: async () => ({ response: answer }) }, ...overrides,
  };
  return worker.fetch(request, env);
}
test("worker and browser agree on the quoted result", async () => {
  const response = await call({ note });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.deepEqual(browser.validate(await response.json(), note), answer);
});
test("empty notes skip inference in both layers", async () => {
  const empty = { label: "missing", quote: "" };
  const forbidden = { run: () => assert.fail("called model") };
  assert.deepEqual(await (await call({ note: " " }, { AI: forbidden })).json(), empty);
  assert.deepEqual(await browser.analyse("invalid", " "), empty);
});
test("declines mismatched quotes, unexpected categories and malformed model replies", async () => {
  for (const value of [{ ...answer, quote: "invented" }, { ...answer, label: "other" }, "bad JSON", null]) {
    assert.equal((await call({ note }, { AI: { run: async () => ({ response: value }) } })).status, 422);
    assert.throws(() => browser.validate(value, note));
  }
});
test("handles CORS preflight, unexpected origins, quota and input limits", async () => {
  const blocked = { run: () => assert.fail("called model") };
  const preflight = await call(null, {}, { method: "OPTIONS", body: undefined });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-headers"), "Content-Type");
  assert.equal((await call({ note }, { AI: blocked }, { headers: { Origin: "https://unknown.example" } })).status, 403);
  assert.equal((await call({ note }, { AI: blocked, DIARY_LIMIT: { limit: async () => ({ success: false }) } })).status, 429);
  assert.equal((await call({ note: "x".repeat(1201) }, { AI: blocked })).status, 413);
  assert.equal((await call({ note, patient: "P012" }, { AI: blocked })).status, 400);
});
