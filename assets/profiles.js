/* Similarity of patient or week profiles using paired watch and diary observations. */
(function (root) {
  "use strict";
  function pairedSummary(days) {
    const matched = days.filter((day) => day.night && day.help);
    if (!matched.length) return null;
    return {
      count: matched.length,
      wakes:
        matched.reduce((n, day) => n + day.night.bouts, 0) / matched.length,
      helped:
        matched.filter((day) => day.help !== "independent").length /
        matched.length,
    };
  }

  function difference(a, b, scale) {
    let sum = 0,
      shared = 0;
    for (let i = 0; i < a.length; i++) {
      if (!a[i] || !b[i]) continue;
      const wakes = (a[i].wakes - b[i].wakes) / scale;
      sum += wakes * wakes + (a[i].helped - b[i].helped) ** 2;
      shared++;
    }
    return shared ? Math.sqrt(sum / (2 * shared)) : null;
  }

  // Average linkage over observed distances. Cache both sum and count so missing
  // pairs never acquire a distance when two clusters merge.
  function hierarchy(profiles, scale) {
    const active = new Map();
    const absent = [];
    const distances = new Map();
    const key = (a, b) => (a < b ? a + "/" + b : b + "/" + a);
    let next = profiles.length;
    profiles.forEach((profile, i) => {
      const seen = profile.filter(Boolean);
      const leaf = { indexes: [i], height: 0 };
      if (!seen.length) {
        absent.push(leaf);
        return;
      }
      leaf.mean =
        seen.reduce((n, v) => n + v.wakes / scale + v.helped, 0) /
        (2 * seen.length);
      for (const j of active.keys()) {
        const d = difference(profile, profiles[j], scale);
        if (d !== null) distances.set(key(i, j), { sum: d, count: 1 });
      }
      active.set(i, leaf);
    });
    while (active.size > 1) {
      const keys = [...active.keys()];
      let best = Infinity,
        pair;
      keys.forEach((a, i) => {
        for (const b of keys.slice(i + 1)) {
          const d = distances.get(key(a, b));
          if (d && d.sum / d.count < best) {
            best = d.sum / d.count;
            pair = [a, b];
          }
        }
      });
      if (!pair) break;
      const [a, b] = pair;
      const children = [active.get(a), active.get(b)].sort(
        (l, r) => l.mean - r.mean,
      );
      active.delete(a);
      active.delete(b);
      for (const j of active.keys()) {
        const x = distances.get(key(a, j)),
          y = distances.get(key(b, j));
        if (x || y)
          distances.set(key(next, j), {
            sum: (x?.sum || 0) + (y?.sum || 0),
            count: (x?.count || 0) + (y?.count || 0),
          });
      }
      const indexes = children.flatMap((child) => child.indexes);
      const mean =
        children.reduce(
          (sum, child) => sum + child.mean * child.indexes.length,
          0,
        ) / indexes.length;
      active.set(next++, { indexes, mean, children, height: best });
    }
    const forest = [...active.values(), ...absent];
    return { forest, order: forest.flatMap((node) => node.indexes) };
  }
  const api = { pairedSummary, hierarchy };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SleepProfiles = api;
})(globalThis);
