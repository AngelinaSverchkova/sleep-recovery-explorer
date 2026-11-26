(function () {
  "use strict";
  const byId = id => document.getElementById(id);
  const editor = byId("review-editor"), toggle = byId("review-open");
  const note = byId("review-note"), output = byId("review-output");
  const labels = {
    hands_on: "Needed physical help", prompting: "Needed a reminder",
    independent: "Dressed without help", unclear: "Support unclear", missing: "No diary entry",
  };
  // Illustrative prose for the six reported mornings in P012's final week.
  const notes = {
    "P012/2026-11-24": "I chose my clothes this morning. My partner had to pull my sleeve over my left arm.",
    "P012/2026-11-25": "Once my daughter reminded me to get dressed, I put everything on myself.",
    "P012/2026-11-26": "Yesterday I was tired. Today I got dressed after Dad reminded me. He didn't need to do anything else.",
    "P012/2026-11-27": "I didn't need reminding this morning. I asked my sister to do up my shirt buttons and she did.",
    "P012/2026-11-28": "I did all my buttons myself, but I only got started after my partner reminded me.",
    "P012/2026-11-29": "My husband pulled my sweater over my head. I managed my socks myself.",
  };
  const examples = [
    "My husband pulled my sweater over my head. I managed my socks myself.",
    "My neighbour reminded me to put on my clothes.",
    "I was dressed before breakfast. My sister visited this morning.",
    "I dressed myself this morning without help or reminders.",
  ];
  let context = "", nextExample = 0;

  function setMorning(patient, date, dateLabel) {
    const key = patient + "/" + date;
    if (key === context) return;
    context = key;
    nextExample = 0;
    byId("review-context").textContent = "Fictional morning note · " + patient + " · " + dateLabel;
    note.value = notes[key] || "";
    byId("review-hint").textContent = note.value
      ? "Illustrative note written for this simulated morning. You can edit it."
      : "No narrative was supplied for this morning. Write a fictional note or try an example.";
    output.replaceChildren();
  }
  toggle.addEventListener("click", () => {
    editor.hidden = !editor.hidden;
    toggle.setAttribute("aria-expanded", String(!editor.hidden));
    if (!editor.hidden) note.focus();
  });
  byId("review-example").addEventListener("click", () => {
    note.value = examples[nextExample++ % examples.length];
    byId("review-hint").textContent = "Practice example. You can edit it.";
    output.replaceChildren();
    note.focus();
  });
  note.addEventListener("input", () => {
    byId("review-hint").textContent = "Your fictional practice note.";
    output.replaceChildren();
  });
  editor.addEventListener("submit", event => {
    event.preventDefault();
    const result = window.DiaryClassifier.analyse(note.value);
    const title = document.createElement("strong");
    title.textContent = "Suggested label · " + labels[result.label];
    output.replaceChildren(title);
    if (result.quote) {
      const quote = document.createElement("blockquote");
      quote.textContent = result.quote;
      output.append(quote);
    }
    if (result.label === "unclear" || result.label === "missing") {
      const hint = document.createElement("p");
      hint.textContent = result.label === "missing" ? "There are no words to analyse."
        : "Review the original wording before assigning a level of help.";
      output.append(hint);
    }
  });
  window.DiaryReview = { setMorning };
})();
