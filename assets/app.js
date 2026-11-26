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
  if (
    !model?.validDataset(data) ||
    !charts ||
    !window.SleepProfiles ||
    !window.RecoveryMatrix
  ) {
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
    selection: [],
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
  const paired = new Map(
    patients.map((p) => [
      p.id,
      weekly
        .get(p.id)
        .map((_, week) =>
          SleepProfiles.pairedSummary(p.days.slice(week * 7, week * 7 + 7)),
        ),
    ]),
  );
  let scale = 1;
  for (const p of patients)
    for (const day of p.days) {
      if (day.help && day.night) scale = Math.max(scale, day.night.bouts);
    }
  const patientView = () => location.hash === "#patients";
  const formatDay = (day) => calendar.format(new Date(day.date + "T12:00:00Z"));
  const eligible = () =>
    !state.selection.length || state.selection.includes("all")
      ? patients
      : patients.filter((p) => state.selection.includes(p.group));
  let matrixKey = "";
  const matrix = RecoveryMatrix.attach(
    byId("patient-matrix"),
    document.querySelector(".ramp"),
    (id, week) => {
      state.person = id;
      state.day = week * 7;
      location.hash = "patients";
    },
  );
  function option(value, label) {
    const element = document.createElement("option");
    element.value = value;
    element.textContent = label;
    return element;
  }
  function updatePatients() {
    const members = eligible();
    if (!members.some((p) => p.id === state.person))
      state.person = members[0].id;
    byId("patient").replaceChildren(...members.map((p) => option(p.id, p.id)));
    byId("patient").value = state.person;
  }
  function selectGroups(ids, week) {
    state.selection = ids.includes("all") ? ["all"] : ids;
    if (week !== undefined) state.day = week * 7;
    updatePatients();
    render(true);
  }
  function chooseWeek(week) {
    state.day = week * 7 + (state.day % 7);
    render(true);
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
      title.textContent =
        (g.id === "all" ? "All patients" : g.name.split(" ")[0]) +
        " · " +
        g.members +
        (g.id === "all" ? "" : " patients");
      const range = document.createElement("span");
      range.className = "group-range";
      range.textContent = g.range;
      button.append(key, title, range);
      button.addEventListener("click", () =>
        selectGroups(
          state.selection.length === 1 && state.selection[0] === g.id
            ? []
            : [g.id],
        ),
      );
      byId("groups").append(button);
    }
    byId("clear-group").addEventListener("click", () => {
      const prior = state.selection[0];
      selectGroups([]);
      if (patientView()) byId("patient").focus();
      else
        byId("groups")
          .querySelector('[data-group="' + prior + '"]')
          ?.focus();
    });
    byId("matrix-order").addEventListener("change", () => render());
    byId("previous-week").addEventListener("click", () =>
      chooseWeek(Math.floor(state.day / 7) - 1),
    );
    byId("next-week").addEventListener("click", () =>
      chooseWeek(Math.floor(state.day / 7) + 1),
    );
    byId("mornings").addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-day]");
      if (!row) return;
      state.day = Number(row.dataset.day);
      render();
      byId("night-title").focus();
    });
    window.addEventListener("hashchange", () => {
      render();
      const heading = byId(patientView() ? "patient-title" : "cohort-title");
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    });
    document.addEventListener("click", (e) => {
      document.querySelectorAll("details.tip[open]").forEach((tip) => {
        if (!tip.contains(e.target)) tip.open = false;
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll("details.tip[open]").forEach((tip) => {
        tip.open = false;
        tip.querySelector("summary").focus();
      });
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
    for (const host of [byId("patient-plot"), byId("cohort-plot")]) {
      host.tabIndex = 0;
      host.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight Home End");
      host.setAttribute(
        "aria-describedby",
        host.id === "cohort-plot" ? "cohort-hint" : "week-help",
      );
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
  function renderControls() {
    byId("patient").value = state.person;
    byId("from").value = state.first;
    byId("to").value = state.last;
    const members = eligible();
    byId("cohort-meta").textContent =
      members.length === patients.length
        ? patients.length + " simulated patients"
        : members.length + " of " + patients.length + " patients";
    byId("clear-group").hidden = !state.selection.length;
    for (const btn of byId("groups").children)
      btn.setAttribute(
        "aria-pressed",
        String(state.selection.includes(btn.dataset.group)),
      );
  }
  function renderDiary(p, week) {
    const day = p.days[state.day];
    window.DiaryReview.setMorning(p.id, day.date, formatDay(day));
    byId("diary-title").textContent = "Week " + (week + 1) + " · Morning diary";
    byId("previous-week").disabled = week === state.first;
    byId("next-week").disabled = week === state.last;
    const entries = p.days.slice(7 * week, 7 * week + 7).map((day, i) => {
      const row = document.createElement("tr");
      const index = 7 * week + i;
      row.dataset.day = index;
      const first = document.createElement("th");
      first.scope = "row";
      const date = document.createElement("button");
      date.textContent = formatDay(day);
      date.setAttribute("aria-pressed", String(index === state.day));
      first.append(date);
      row.append(first);
      row.insertCell().textContent = day.night
        ? day.night.bouts
        : "No recording";
      const labels = {
        independent: "Independent",
        prompting: "Prompting",
        hands_on: "Hands-on help",
      };
      row.insertCell().textContent = labels[day.help] || "No report";
      return row;
    });
    byId("mornings").replaceChildren(...entries);
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
      focusGroup: state.selection.length === 1 ? state.selection[0] : null,
      onSeries: selectGroups,
      series,
      onWeek: chooseWeek,
      label:
        "Group mean of weekly percentages of reported mornings dressed without help, by week of follow-up. " +
        label,
    });
    const selected = groups.filter(
      (g) => !state.selection.length || state.selection.includes(g.id),
    );
    const message = selected
      .map((g) => g.name + " " + percent(g.weeks[week].rate))
      .join(" · ");
    byId("cohort-readout").textContent = "Week " + (week + 1) + " · " + message;
  }
  function renderNight(p) {
    const day = p.days[state.day],
      n = day.night;
    byId("raw-file").href = "data/apple_health/" + p.id + ".zip";
    byId("night-title").textContent =
      "Night ending " + formatDay(day) + " · " + p.id;
    byId("recording-time").textContent = n
      ? "Recording " +
        charts.formatTime(n.start) +
        "–" +
        charts.formatTime(n.start + 60 * (n.sleep + n.awake)) +
        " CET"
      : "";
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
  function draw() {
    const week = Math.floor(state.day / 7);
    const weeks = model.weekIndices(state.first, state.last);
    if (patientView()) {
      const person = patients.find((p) => p.id === state.person);
      renderPatient(person, weeks, week);
      renderNight(person);
    } else renderGroups(weeks, week);
  }
  function render(reveal = false) {
    const detail = patientView();
    byId("compare-view").hidden = detail;
    byId("patients-view").hidden = !detail;
    byId("picker").hidden = !detail;
    document.querySelectorAll(".views a").forEach((link) => {
      if (link.hash === (detail ? "#patients" : "#compare"))
        link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    const slot = byId(detail ? "patient-window" : "cohort-window");
    if (byId("period").parentElement !== slot) slot.append(byId("period"));
    renderControls();
    const week = Math.floor(state.day / 7);
    if (detail)
      renderDiary(
        patients.find((p) => p.id === state.person),
        week,
      );
    else {
      const mode = byId("matrix-order").value,
        members = eligible();
      const key = [state.first, state.last, ...state.selection, mode].join("/");
      if (key !== matrixKey) {
        const label = groups
          .filter((g) => state.selection.includes(g.id))
          .map((g) => g.name)
          .join(" / ");
        byId("matrix-title").textContent =
          "Patient heatmap · " +
          (label && label !== "All patients"
            ? label + " · " + members.length + " patients"
            : "All " + members.length + " patients");
        matrix.render({
          patients: members,
          weeks: model.weekIndices(state.first, state.last),
          weekly,
          paired,
          scale,
          mode,
        });
        matrixKey = key;
      }
      matrix.highlight(week, reveal);
    }
    draw();
  }
  setupControls();
  updatePatients();
  byId("explorer").hidden = false;
  render();
  let frame;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  });
  ["patient-plot", "sleep-plot", "cohort-plot", "night-plot"].forEach((id) =>
    observer.observe(byId(id)),
  );
})();
