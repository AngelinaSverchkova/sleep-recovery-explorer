/* Responsive SVG figures. Values throughout retain their original units. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg",
    grid = "#314151";
  function svgNode(type, attrs = {}, value) {
    const node = document.createElementNS(NS, type);
    for (const [key, val] of Object.entries(attrs))
      node.setAttribute(key, String(val));
    if (value !== undefined) node.textContent = value;
    return node;
  }
  function canvas(host, label) {
    const w = Math.max(180, Math.floor(host.getBoundingClientRect().width));
    const h = Math.max(44, Math.floor(host.getBoundingClientRect().height));
    const svg = svgNode("svg", {
      viewBox: "0 0 " + w + " " + h,
      role: "img",
      "aria-label": label,
    });
    svg.append(svgNode("title", {}, label));
    host.replaceChildren(svg);
    return { svg, w, h };
  }
  const line = (svg, x1, y1, x2, y2, color = grid, extra = {}) =>
    svg.append(svgNode("line", { x1, y1, x2, y2, stroke: color, ...extra }));
  const text = (svg, x, y, v, anchor = "middle") =>
    svg.append(svgNode("text", { x, y, "text-anchor": anchor }, v));
  function point(svg, shape, x, y, color) {
    if (shape === "intermediate")
      svg.append(
        svgNode("rect", {
          x: x - 3,
          y: y - 3,
          width: 6,
          height: 6,
          fill: color,
        }),
      );
    else if (shape === "frequent")
      svg.append(
        svgNode("path", {
          d: "M " + x + " " + (y - 4) + " l 4 4 -4 4 -4 -4 Z",
          fill: color,
        }),
      );
    else svg.append(svgNode("circle", { cx: x, cy: y, r: 3.1, fill: color }));
  }
  // Both patient plots must place a given week at exactly the same x position.
  // The inset also keeps the first and last bars clear of the y labels.
  function weekLayout(width, weeks) {
    const left = 43,
      right = width - 8;
    const first = left + 13,
      last = right - 13;
    const x = (i) =>
      weeks.length === 1
        ? (first + last) / 2
        : first + (i * (last - first)) / (weeks.length - 1);
    return { left, right, x };
  }
  function showWeekTicks(svg, weeks, x, baseline) {
    weeks.forEach((week, i) => {
      const label = svgNode(
        "text",
        { x: x(i), y: baseline, "text-anchor": "middle", class: "week-tick" },
        week + 1,
      );
      svg.append(label);
    });
  }
  function trends(
    host,
    {
      weeks,
      series,
      selectedWeek,
      focusGroup,
      onWeek,
      label,
      showWeeks = true,
    },
  ) {
    const { svg, w, h } = canvas(host, label);
    const { left, right, x } = weekLayout(w, weeks);
    const top = 10,
      bottom = h - (showWeeks ? 23 : 8);
    const y = (n) => bottom - (n * (bottom - top)) / 100;
    [0, 50, 100].forEach((v) => {
      line(svg, left, y(v), right, y(v));
      text(svg, left - 5, y(v) + 4, v + "%", "end");
    });
    const selected = weeks.indexOf(selectedWeek);
    if (selected >= 0)
      line(svg, x(selected), top, x(selected), bottom, "#698395", {
        "stroke-dasharray": "2 4",
      });
    if (showWeeks) showWeekTicks(svg, weeks, x, h - 5);
    const ordered = [...series].sort(
      (a, b) => Number(a.id === focusGroup) - Number(b.id === focusGroup),
    );
    for (const s of ordered) {
      const group = svgNode("g", {
        opacity: !focusGroup || s.id === focusGroup ? 1 : 0.36,
      });
      let path = "",
        penDown = false;
      for (const [i, wk] of weeks.entries()) {
        const v = s.values[wk];
        if (v == null) {
          penDown = false;
          continue;
        }
        path += (penDown ? " L " : " M ") + x(i) + " " + y(v);
        penDown = true;
      }
      group.append(
        svgNode("path", {
          d: path,
          fill: "none",
          stroke: s.color,
          "stroke-width": 2.6,
          "stroke-dasharray": s.dash || "none",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        }),
      );
      weeks.forEach((wk, i) => {
        if (s.values[wk] != null)
          point(group, s.id, x(i), y(s.values[wk]), s.color);
      });
      svg.append(group);
    }
    weeks.forEach((wk, i) => {
      const a = i === 0 ? left - 7 : (x(i - 1) + x(i)) / 2;
      const b = i === weeks.length - 1 ? right + 7 : (x(i) + x(i + 1)) / 2;
      const hit = svgNode("rect", {
        x: a,
        y: 0,
        width: b - a,
        height: h,
        fill: "transparent",
        class: "interactive",
      });
      hit.append(
        svgNode(
          "title",
          {},
          "Week " +
            (wk + 1) +
            " · " +
            series
              .map(
                (s) =>
                  s.name +
                  " " +
                  (s.values[wk] == null
                    ? "no reports"
                    : Math.round(s.values[wk]) + "%"),
              )
              .join(" · "),
        ),
      );
      hit.addEventListener("click", () => onWeek(wk));
      svg.append(hit);
    });
  }
  function bars(host, weeks, values, selectedWeek, onWeek) {
    const { svg, w, h } = canvas(
      host,
      "Weekly mean number of overnight interruptions. " +
        weeks
          .map(
            (wk) =>
              "Week " +
              (wk + 1) +
              ": " +
              (values[wk] == null ? "no data" : values[wk].toFixed(1)),
          )
          .join("; "),
    );
    const { left, right, x } = weekLayout(w, weeks);
    const bottom = h - 20,
      top = 9,
      max = 2 * Math.ceil(Math.max(8, ...values.filter((v) => v != null)) / 2);
    const width = Math.min(22, ((right - left) / weeks.length) * 0.48);
    for (const tick of [0, max / 2, max]) {
      const py = bottom - (tick / max) * (bottom - top);
      line(svg, left, py, right, py);
      text(svg, left - 7, py + 4, tick, "end");
    }
    const selected = weeks.indexOf(selectedWeek);
    if (selected >= 0)
      line(svg, x(selected), top, x(selected), bottom, "#698395", {
        "stroke-dasharray": "2 4",
      });
    showWeekTicks(svg, weeks, x, h - 4);
    weeks.forEach((wk, i) => {
      const value = values[wk],
        height = value == null ? 0 : (value * (bottom - top)) / max;
      if (value === null) {
        text(svg, x(i), bottom - 4, "—");
        return;
      }
      const bar =
        value === 0
          ? svgNode("circle", {
              cx: x(i),
              cy: bottom,
              r: 3,
              fill: "#111e2b",
              stroke: "#9acdd6",
              class: "interactive",
            })
          : svgNode("rect", {
              x: x(i) - width / 2,
              y: bottom - Math.max(2, height),
              width,
              height: Math.max(2, height),
              rx: 2,
              fill: wk === selectedWeek ? "#9acdd6" : "#668f9e",
              class: "interactive",
            });
      bar.append(
        svgNode(
          "title",
          {},
          "Week " +
            (wk + 1) +
            ": " +
            (value == null
              ? "no readings"
              : value.toFixed(1) + " interruptions per night"),
        ),
      );
      bar.addEventListener("click", () => onWeek(wk));
      svg.append(bar);
    });
  }
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  function night(host, obs) {
    if (!obs) {
      const msg = document.createElement("p");
      msg.className = "no-data";
      msg.textContent = "No watch recording for this night.";
      host.replaceChildren(msg);
      return;
    }
    const names = {
      W: "Awake",
      R: "REM",
      C: "Core",
      D: "Deep",
      U: "Unspecified",
    };
    const colors = {
      W: "#fac27a",
      R: "#b8a7f3",
      C: "#55cfdd",
      D: "#6f9de0",
      U: "#9daab5",
    };
    const order = obs.runs.some(([s]) => s === "U")
      ? ["W", "R", "C", "D", "U"]
      : ["W", "R", "C", "D"];
    const { svg, w, h } = canvas(
      host,
      "Estimated sleep stages over one night. " +
        obs.sleep +
        " minutes asleep and " +
        obs.awake +
        " minutes awake.",
    );
    const left = order.includes("U") ? 85 : 48,
      right = w - 25,
      top = 10,
      bottom = h - 24;
    const total = obs.sleep + obs.awake;
    const x = (m) => left + ((right - left) * m) / total,
      y = (s) => top + (order.indexOf(s) * (bottom - top)) / (order.length - 1);
    order.forEach((s) => {
      text(svg, left - 6, y(s) + 3, names[s], "end");
      line(svg, left, y(s), right, y(s));
    });
    const ticks = w < 420 ? 3 : 5;
    for (let i = 0; i < ticks; i++) {
      const m = (total * i) / (ticks - 1);
      text(
        svg,
        x(m),
        h - 3,
        clock.format(new Date((obs.start + 60 * m) * 1000)),
      );
    }
    let pos = 0,
      previous = null;
    obs.runs.forEach(([stage, duration]) => {
      if (previous)
        line(svg, x(pos), y(previous), x(pos), y(stage), "#748699", {
          "stroke-width": 1.2,
        });
      const segment = svgNode("line", {
        x1: x(pos),
        y1: y(stage),
        x2: x(pos + duration),
        y2: y(stage),
        stroke: colors[stage],
        "stroke-width": 5,
        "stroke-linecap": "butt",
      });
      segment.append(
        svgNode(
          "title",
          {},
          names[stage] +
            " · " +
            duration +
            " min · " +
            clock.format(new Date((obs.start + 60 * pos) * 1000)),
        ),
      );
      svg.append(segment);
      pos += duration;
      previous = stage;
    });
  }
  window.RecoveryCharts = { trends, bars, night };
})();
