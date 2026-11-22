/* Pure aggregations shared by the browser and the Node test suite. */
(function (root) {
  "use strict";
  const groups = [
    {
      id: "fewer",
      name: "Few awakenings",
      range: "2 or fewer awakenings per night",
      color: "#55dfde",
      dash: "",
    },
    {
      id: "intermediate",
      name: "Moderate awakenings",
      range: "More than 2, fewer than 5 awakenings per night",
      color: "#baa9f3",
      dash: "7 4",
    },
    {
      id: "frequent",
      name: "Frequent awakenings",
      range: "5 or more awakenings per night",
      color: "#fac27a",
      dash: "2 4",
    },
  ];
  const mean = (values) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const diaryValues = new Set([null, "independent", "prompting", "hands_on"]);
  function validNight(night) {
    if (night === null) return true;
    if (
      !night ||
      !Number.isSafeInteger(night.start) ||
      !Array.isArray(night.runs) ||
      !night.runs.length
    )
      return false;
    let asleep = 0,
      awake = 0,
      bouts = 0,
      previous = null;
    for (const run of night.runs) {
      if (!Array.isArray(run) || run.length !== 2) return false;
      const [stage, minutes] = run;
      if (
        !["W", "C", "D", "R", "U"].includes(stage) ||
        !Number.isSafeInteger(minutes) ||
        minutes <= 0 ||
        stage === previous
      )
        return false;
      if (stage === "W") {
        awake += minutes;
        bouts++;
      } else {
        asleep += minutes;
      }
      previous = stage;
    }
    return (
      night.runs[0][0] !== "W" &&
      previous !== "W" &&
      asleep === night.sleep &&
      awake === night.awake &&
      bouts === night.bouts
    );
  }
  function validDataset(data) {
    if (
      data?.version !== 1 ||
      data.synthetic !== true ||
      data.timezone !== "Europe/Oslo" ||
      !Number.isSafeInteger(data.weeks) ||
      data.weeks < 1 ||
      !Array.isArray(data.patients) ||
      !data.patients.length
    )
      return false;
    const ids = new Set();
    const firstDate = data.patients[0]?.days?.[0]?.date;
    const start = Date.parse(firstDate + "T00:00:00Z");
    if (!Number.isFinite(start)) return false;
    const groupIds = new Set([...groups.map((g) => g.id), "unclassified"]);
    return data.patients.every((p) => {
      if (
        !p ||
        !/^P[0-9]+$/.test(p.id) ||
        ids.has(p.id) ||
        !groupIds.has(p.group) ||
        !Array.isArray(p.days) ||
        p.days.length !== data.weeks * 7
      )
        return false;
      ids.add(p.id);
      return p.days.every(
        (d, i) =>
          d &&
          d.date ===
            new Date(start + i * 86400000).toISOString().slice(0, 10) &&
          diaryValues.has(d.help) &&
          validNight(d.night),
      );
    });
  }
  function summarize(days) {
    const nights = days.map((d) => d.night).filter(Boolean);
    const reports = days.filter((d) => d.help != null);
    const independent = reports.filter((d) => d.help === "independent").length;
    return {
      reports: reports.length,
      independent,
      rate: reports.length ? (100 * independent) / reports.length : null,
      nights: nights.length,
      bouts: mean(nights.map((n) => n.bouts)),
      sleep: mean(nights.map((n) => n.sleep)),
    };
  }
  function patientWeeks(patient) {
    const result = [];
    for (let i = 0; i < patient.days.length; i += 7)
      result.push(summarize(patient.days.slice(i, i + 7)));
    return result;
  }
  function cohortWeeks(patients, weekly) {
    return groups.map((group) => {
      const members = patients.filter((p) => p.group === group.id);
      const weeks = patients.length
        ? weekly.get(patients[0].id).map((_, i) => {
            const rates = members
              .map((p) => weekly.get(p.id)[i].rate)
              .filter((v) => v !== null);
            return { rate: mean(rates), n: rates.length };
          })
        : [];
      return { ...group, members: members.length, weeks };
    });
  }
  function bounds(from, to, changed) {
    if (from > to) return changed === "from" ? [from, from] : [to, to];
    return [from, to];
  }
  function weekIndices(first, last) {
    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }
  const api = {
    groups,
    validDataset,
    mean,
    summarize,
    patientWeeks,
    cohortWeeks,
    bounds,
    weekIndices,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RecoveryModel = api;
})(globalThis);
