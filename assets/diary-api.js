/* Optional HTTPS diary service. A deployed URL is public; credentials belong on the service. */
(function (root) {
  "use strict";
  const labels = new Set(["independent", "prompting", "hands_on", "unclear"]);

  function validate(result, note) {
    if (!result || !labels.has(result.label) || typeof result.quote !== "string" ||
        !result.quote.trim() || !note.includes(result.quote))
      throw new Error("The model did not return a valid label with an exact quote. Review the note manually.");
    return { label: result.label, quote: result.quote };
  }

  async function analyse(endpoint, note, signal) {
    if (!note.trim()) return { label: "missing", quote: "" };
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }), signal, credentials: "omit", redirect: "error",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) {
      if (response.status === 429) throw new Error("The model’s usage limit has been reached. Try later.");
      if (response.status === 422) throw new Error("The model could not support a label with an exact quote.");
      throw new Error("The language-model service is unavailable. You can still use the browser classifier.");
    }
    return validate(await response.json(), note);
  }
  if (typeof module === "object" && module.exports) module.exports = { analyse, validate };
  else root.DiaryAPI = { analyse, validate };
})(globalThis);
