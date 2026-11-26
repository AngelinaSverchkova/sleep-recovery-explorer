/* Nearest-neighbour classifier over word/bigram TF-IDF vectors. No network or storage. */
(function (root) {
  "use strict";
  const training = typeof module === "object" && module.exports
    ? require("../data/diary-training.js") : root.DiaryTraining;
  const examples = Object.entries(training).flatMap(([label, notes]) =>
    notes.map(note => ({ label, terms: features(note) })));
  const documentFrequency = new Map();
  for (const { terms } of examples) {
    for (const term of terms.keys())
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
  }

  function features(text) {
    const words = text.toLowerCase().replace(/[’‘]/g, "'").match(/[a-z]+(?:'[a-z]+)?/g) || [];
    const terms = new Map();
    for (const [index, word] of words.entries()) {
      terms.set(word, 1);
      if (index) terms.set(words[index - 1] + " " + word, 1);
    }
    return terms;
  }

  function vector(terms) {
    const values = new Map();
    let squaredNorm = 0;
    for (const term of terms.keys()) {
      // Count unseen terms in the length so unrelated text cannot get a perfect match.
      const weight = 1 + Math.log((examples.length + 1) / (1 + (documentFrequency.get(term) || 0)));
      values.set(term, weight);
      squaredNorm += weight * weight;
    }
    return { values, norm: Math.sqrt(squaredNorm) };
  }
  const neighbours = examples.map(({ label, terms }) => ({ label, ...vector(terms) }));
  const dressing = /\b(dress(?:ed|ing)?|cloth(?:es|ing)|wear|wore|shirt|jumper|sweater|jacket|coat|blouse|sleeves?|buttons?|trousers|pants|socks?|shoes?|boots?|shoelaces?|zipper|pyjamas)\b/i;

  function predictSentence(quote) {
    const input = vector(features(quote));
    const byLabel = {};
    for (const other of neighbours) {
      let dot = 0;
      for (const [term, weight] of input.values)
        dot += weight * (other.values.get(term) || 0);
      const score = input.norm ? dot / (input.norm * other.norm) : 0;
      (byLabel[other.label] ||= []).push(score);
    }
    const ranked = Object.entries(byLabel).map(([label, scores]) => {
      scores.sort((a, b) => b - a);
      return { label, score: 0.8 * scores[0] + 0.2 * scores[1] };
    }).sort((a, b) => b.score - a.score);
    const [best, next] = ranked;
    let label = best.score >= 0.20 && best.score - next.score >= 0.035 ? best.label : "unclear";
    // A negated action or a hypothetical alone does not establish what happened.
    if (/\b(?:did not|didn['’]t|never)\s+(?:help|remind|prompt|dress)\b|\b(?:if|might|maybe|would)\b/i.test(quote))
      label = "unclear";
    return { label, quote, score: best.score };
  }

  function analyse(text) {
    if (!text.trim()) return { label: "missing", quote: "" };
    // Preserve the original text for evidence, including case and punctuation.
    const sentences = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
    if (!dressing.test(text)) return { label: "unclear", quote: sentences[0] || text.trim() };
    const predictions = [];
    for (const sentence of sentences) {
      if (!dressing.test(sentence) && /\b(breakfast|lunch|dinner|medication|medicine|meal|shower|walk)\b/i.test(sentence)) continue;
      const clauses = sentence.split(/(?<=[,;])\s+|\s+(?=but\s|and\s+(?:my|she|he)\s)/i);
      for (const clause of clauses) {
        if (/\b(yesterday|last week|tomorrow)\b/i.test(clause)) continue;
        const result = predictSentence(clause);
        predictions.push({ ...result, quote: sentence });
      }
    }
    // Any explicitly reported physical help takes precedence over doing another step alone.
    for (const label of ["hands_on", "prompting", "independent"]) {
      const best = predictions.filter(p => p.label === label).sort((a, b) => b.score - a.score)[0];
      if (best) return { label, quote: best.quote };
    }
    return { label: "unclear", quote: predictions[0]?.quote || sentences[0] || text.trim() };
  }
  if (typeof module === "object" && module.exports) module.exports = { analyse };
  else root.DiaryClassifier = { analyse };
})(globalThis);
