(function () {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const methods = byId("methods");
  // Pages renders the Markdown as HTML. Downloaded copies include the Markdown source.
  if (location.hostname.endsWith(".github.io")) {
    for (const link of document.querySelectorAll("a[data-pages-href]")) {
      link.href = link.dataset.pagesHref;
    }
  }
  byId("methods-open").addEventListener("click", () => methods.showModal());
  byId("methods-close").addEventListener("click", () => methods.close());

  const data = window.SLEEP_RECOVERY_DATA;
  const model = window.RecoveryModel;
  const charts = window.RecoveryCharts;
  if (!model?.validDataset(data) || !charts) {
    const warning = byId("load-error");
    warning.hidden = false;
    warning.textContent =
      "The dashboard could not read the local dataset. Keep index.html, assets and data together, or regenerate the data using the README.";
    return;
  }
  const patients = data.patients;
  const weekly = new Map(patients.map((p) => [p.id, model.patientWeeks(p)]));
  const groups = model.cohortWeeks(patients, weekly);
  const initialDay = patients[0].days.findIndex(
    (d, i) => i >= (data.weeks - 1) * 7 && d.night && d.help,
  );
  const state = {
    person: patients[0].id,
    first: 0,
    last: data.weeks - 1,
    day: Math.max(0, initialDay),
    group: null,
  };
  const calendar = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const percent = (n) => (n == null ? "no reports" : Math.round(n) + "%");
  const helpLabels = {
    independent: "dressed without help",
    prompting: "needed a reminder to get dressed",
    hands_on: "needed physical help getting dressed",
  };
  const series = groups.map((g) => ({
    ...g,
    values: g.weeks.map((w) => w.rate),
  }));
  let previousMorningOptions = "";
  function option(value, label) {
    const element = document.createElement("option");
    element.value = value;
    element.textContent = label;
    return element;
  }
  function updatePatients() {
    const eligible = patients.filter(
      (p) => !state.group || p.group === state.group,
    );
    if (!eligible.some((p) => p.id === state.person))
      state.person = eligible[0].id;
    byId("patient").replaceChildren(...eligible.map((p) => option(p.id, p.id)));
    byId("patient").value = state.person;
  }
  function selectGroup(id) {
    state.group = id;
    updatePatients();
    render();
  }
  function chooseWeek(week) {
    state.day = week * 7 + (state.day % 7);
    render();
  }
  function setupControls() {
    for (const g of groups) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.group = g.id;
      button.disabled = !g.members;
      button.setAttribute(
        "aria-label",
        g.name +
          ", " +
          g.range +
          " on average in week 1, " +
          g.members +
          " patients",
      );
      const key = document.createElement("i");
      key.className = "legend-line " + g.id;
      key.style.setProperty("--color", g.color);
      key.setAttribute("aria-hidden", "true");
      const title = document.createElement("strong");
      title.textContent = g.name.split(" ")[0];
      const range = document.createElement("span");
      range.className = "group-range";
      range.textContent = g.range;
      button.append(key, title, range);
      button.addEventListener("click", () =>
        selectGroup(state.group === g.id ? null : g.id),
      );
      byId("groups").append(button);
    }
    const balanced =
      groups.every((g) => g.members === groups[0].members) &&
      groups.reduce((n, g) => n + g.members, 0) === patients.length;
    byId("group-explainer").textContent = balanced
      ? "Select a group by average awakenings per recorded night in week 1. We created three equal groups of " +
        groups[0].members +
        " patients for comparison."
      : groups.map((g) => g.name + ": " + g.members + " patients").join(" · ") +
        ". Groups use average awakenings per recorded night in week 1.";
    byId("clear-group").addEventListener("click", () => {
      const old = state.group;
      selectGroup(null);
      byId("groups")
        .querySelector('[data-group="' + old + '"]')
        ?.focus();
    });
    for (const id of ["from", "to"]) {
      byId(id).replaceChildren(
        ...model
          .weekIndices(0, data.weeks - 1)
          .map((w) => option(w, "Week " + (w + 1))),
      );
      byId(id).addEventListener("change", () => {
        [state.first, state.last] = model.bounds(
          Number(byId("from").value),
          Number(byId("to").value),
          id,
        );
        state.day = Math.min(
          7 * state.last + 6,
          Math.max(7 * state.first, state.day),
        );
        render();
      });
    }
    byId("patient").addEventListener("change", () => {
      state.person = byId("patient").value;
      render();
    });
    byId("morning").addEventListener("change", () => {
      state.day = Number(byId("morning").value);
      render();
    });
    for (const host of [byId("patient-plot"), byId("cohort-plot")]) {
      host.tabIndex = 0;
      host.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight Home End");
      host.setAttribute("aria-describedby", "week-help");
      host.addEventListener("keydown", (e) => {
        const week = Math.floor(state.day / 7);
        const next = {
          ArrowLeft: Math.max(state.first, week - 1),
          ArrowRight: Math.min(state.last, week + 1),
          Home: state.first,
          End: state.last,
        }[e.key];
        if (next !== undefined) {
          e.preventDefault();
          chooseWeek(next);
        }
      });
    }
  }
  function renderControls(p) {
    byId("from").value = state.first;
    byId("to").value = state.last;
    const key = [p.id, state.first, state.last].join("/");
    if (key !== previousMorningOptions) {
      previousMorningOptions = key;
      const start = state.first * 7;
      const options = p.days.slice(start, (state.last + 1) * 7).map((d, i) => {
        const date = calendar.format(new Date(d.date + "T12:00:00Z"));
        return option(
          start + i,
          date + " · Week " + (Math.floor((start + i) / 7) + 1),
        );
      });
      byId("morning").replaceChildren(...options);
    }
    byId("morning").value = state.day;
    const count = state.last - state.first + 1;
    byId("cohort-meta").textContent =
      patients.length +
      " simulated patients · " +
      count +
      (count === 1 ? " week" : " weeks") +
      " in view";
    byId("clear-group").hidden = !state.group;
    for (const btn of byId("groups").children)
      btn.setAttribute(
        "aria-pressed",
        String(btn.dataset.group === state.group),
      );
  }
  function renderPatient(p, weeks, week) {
    const values = weekly.get(p.id),
      current = values[week],
      group = groups.find((g) => g.id === p.group);
    byId("patient-title").textContent = "Patient " + p.id;
    byId("patient-group").textContent = group
      ? group.name + " in week 1"
      : "Insufficient week 1 sleep data";
    charts.trends(byId("patient-plot"), {
      weeks,
      selectedWeek: week,
      showWeeks: false,
      onWeek: chooseWeek,
      label:
        "Mornings dressed without help (%), by week of follow-up. " +
        weeks
          .map((i) => "Week " + (i + 1) + ": " + percent(values[i].rate))
          .join("; "),
      series: [
        {
          id: "individual",
          name: p.id,
          color: "#55dfde",
          values: values.map((v) => v.rate),
        },
      ],
    });
    charts.bars(
      byId("sleep-plot"),
      weeks,
      values.map((v) => v.bouts),
      week,
      chooseWeek,
    );
    const diary = current.reports
      ? "Dressed without help on " +
        current.independent +
        " of " +
        current.reports +
        " reported mornings (" +
        percent(current.rate) +
        ")."
      : "No morning reports.";
    const sleep = current.nights
      ? "Averaged " +
        current.bouts.toFixed(1) +
        " awakenings across " +
        current.nights +
        " recorded nights."
      : "No recorded nights.";
    byId("patient-readout").textContent =
      "Week " + (week + 1) + " · " + diary + " " + sleep;
  }
  function renderGroups(weeks, week) {
    const label = groups
      .map(
        (g) =>
          g.name +
          ": " +
          weeks
            .map((i) => "week " + (i + 1) + " " + percent(g.weeks[i].rate))
            .join(", "),
      )
      .join("; ");
    charts.trends(byId("cohort-plot"), {
      weeks,
      selectedWeek: week,
      focusGroup: state.group,
      series,
      onWeek: chooseWeek,
      label:
        "Group mean of weekly percentages of reported mornings dressed without help, by week of follow-up. " +
        label,
    });
    const active = groups.find((g) => g.id === state.group);
    let message;
    if (active) {
      const summary = active.weeks[week];
      message =
        active.name +
        " · " +
        (summary.n
          ? percent(summary.rate) +
            " of mornings without help, averaged across " +
            summary.n +
            " reporting patients."
          : "No morning reports for this group.");
    } else {
      const few = groups.find((g) => g.id === "fewer").weeks[week],
        frequent = groups.find((g) => g.id === "frequent").weeks[week];
      message =
        few.n && frequent.n
          ? "Dressed without help on " +
            percent(few.rate) +
            " of mornings in the few-awakenings group and " +
            percent(frequent.rate) +
            " in the frequent-awakenings group."
          : groups
              .map((g) => g.name + ": " + percent(g.weeks[week].rate))
              .join(" · ") + ".";
    }
    byId("cohort-readout").textContent = "Week " + (week + 1) + " · " + message;
  }
  function renderNight(p) {
    const day = p.days[state.day],
      n = day.night;
    byId("raw-file").href = "data/apple_health/" + p.id + ".zip";
    charts.night(byId("night-plot"), n);
    byId("night-number").textContent = n
      ? Math.floor(n.sleep / 60) +
        " h " +
        String(n.sleep % 60).padStart(2, "0") +
        " min asleep"
      : "Sleep recording missing";
    byId("night-stats").textContent = n
      ? n.bouts +
        " recorded awakening" +
        (n.bouts === 1 ? "" : "s") +
        " · " +
        n.awake +
        " min awake"
      : "Morning report is shown when available.";
    byId("night-help").textContent = day.help
      ? "That morning: " + helpLabels[day.help] + "."
      : "Morning dressing report missing.";
  }
  function render() {
    const p = patients.find((p) => p.id === state.person),
      weeks = model.weekIndices(state.first, state.last),
      week = Math.floor(state.day / 7);
    renderControls(p);
    renderPatient(p, weeks, week);
    renderGroups(weeks, week);
    renderNight(p);
  }
  setupControls();
  updatePatients();
  byId("explorer").hidden = false;
  render();
  // Chart dimensions can change independently of the viewport, including on zoom.
  let frame = 0;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(render);
  });
  for (const id of ["patient-plot", "sleep-plot", "cohort-plot", "night-plot"])
    observer.observe(byId(id));
})();
