/* Render the table from precomputed weekly observations, keeping one keyboard entry point. */
(function () {
  "use strict";
  const shades = [
    "#dfedf7",
    "#bedff1",
    "#97cbe4",
    "#68afd3",
    "#3884ac",
    "#235f87",
    "#173e60",
  ];
  function element(tag, value) {
    const node = document.createElement(tag);
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function treeDiagram(tree, across) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    const slots = new Map(tree.order.map((id, i) => [id, i + 0.5]));
    const extent = Math.max(0.00001, ...tree.forest.map((node) => node.height));
    const size = tree.order.length;
    svg.setAttribute(
      "viewBox",
      across ? "0 0 " + size + " 1" : "0 0 1 " + size,
    );
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const segments = [];
    const point = (position, depth) =>
      across ? [position, depth] : [depth, position];
    function trace(node) {
      if (!node.children) return { at: slots.get(node.indexes[0]), depth: 1 };
      const [left, right] = node.children.map(trace);
      const depth = 0.94 - (0.89 * node.height) / extent;
      segments.push(
        "M" +
          point(left.at, left.depth) +
          "L" +
          point(left.at, depth) +
          "L" +
          point(right.at, depth) +
          "L" +
          point(right.at, right.depth),
      );
      return { at: (left.at + right.at) / 2, depth };
    }
    tree.forest.forEach(trace);
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", segments.join(" "));
    path.setAttribute("vector-effect", "non-scaling-stroke");
    svg.append(path);
    return svg;
  }

  function attach(table, swatches, open) {
    let activeWeek = 0;
    for (const fill of shades) {
      const swatch = element("i");
      swatch.style.background = fill;
      swatches.append(swatch);
    }
    table.addEventListener("click", (event) => {
      const cell = event.target.closest("[data-person]");
      if (cell)
        open(cell.dataset.person, Number(cell.dataset.week ?? activeWeek));
    });
    table.addEventListener("focusin", (event) => {
      if (!event.target.matches("button")) return;
      const prior = table.querySelector('button[tabindex="0"]');
      if (prior) prior.tabIndex = -1;
      event.target.tabIndex = 0;
    });
    table.addEventListener("keydown", (event) => {
      if (!event.target.matches("button")) return;
      const row = event.target.closest("tr");
      const buttons = [...row.querySelectorAll("button")];
      const col = buttons.indexOf(event.target);
      const keys = {
        ArrowLeft: buttons[Math.max(0, col - 1)],
        ArrowRight: buttons[Math.min(buttons.length - 1, col + 1)],
        Home: buttons[0],
        End: buttons.at(-1),
        ArrowUp: row.previousElementSibling?.querySelectorAll("button")[col],
        ArrowDown: row.nextElementSibling?.querySelectorAll("button")[col],
      };
      if (Object.hasOwn(keys, event.key)) {
        event.preventDefault();
        keys[event.key]?.focus();
      }
    });

    function render({ patients, weeks, weekly, paired, scale, mode }) {
      const rows = [...patients].sort((a, b) =>
        a.id.localeCompare(b.id, "en", { numeric: true }),
      );
      const vectors = rows.map((p) => weeks.map((w) => paired.get(p.id)[w]));
      const rowTree =
        mode === "id" ? null : SleepProfiles.hierarchy(vectors, scale);
      const colTree =
        mode === "both"
          ? SleepProfiles.hierarchy(
              weeks.map((_, i) => vectors.map((v) => v[i])),
              scale,
            )
          : null;
      const columns = colTree ? colTree.order.map((i) => weeks[i]) : weeks;
      const rowOrder = rowTree ? rowTree.order.map((i) => rows[i]) : rows;
      table.style.minWidth = 86 + columns.length * 58 + "px";
      const cols = element("colgroup");
      if (rowTree) {
        const c = element("col");
        c.style.width = "28px";
        cols.append(c);
      }
      const idCol = element("col");
      idCol.style.width = "58px";
      cols.append(idCol);
      columns.forEach(() => cols.append(element("col")));
      const head = element("thead");
      if (colTree) {
        const trees = head.insertRow();
        trees.setAttribute("aria-hidden", "true");
        trees.insertCell().colSpan = rowTree ? 2 : 1;
        const branches = trees.insertCell();
        branches.colSpan = columns.length;
        branches.className = "col-branches";
        branches.append(treeDiagram(colTree, true));
      }
      const headers = head.insertRow();
      const patient = element("th", "Patient");
      patient.scope = "col";
      patient.colSpan = rowTree ? 2 : 1;
      headers.append(patient);
      for (const w of columns) {
        const th = element("th", "Week " + (w + 1));
        th.scope = "col";
        th.dataset.week = w;
        headers.append(th);
      }
      const body = element("tbody");
      rowOrder.forEach((p, i) => {
        const row = body.insertRow();
        if (rowTree && i === 0) {
          const branch = row.insertCell();
          branch.rowSpan = rows.length;
          branch.className = "row-branches";
          branch.setAttribute("aria-hidden", "true");
          branch.append(treeDiagram(rowTree, false));
        }
        const key = element("th");
        key.scope = "row";
        key.dataset.person = p.id;
        const id = element("button", p.id);
        id.tabIndex = i === 0 ? 0 : -1;
        const group = RecoveryModel.groups.find((g) => g.id === p.group);
        id.style.color = group?.color || "var(--sub)";
        id.title = group?.name || "Insufficient week 1 data";
        key.append(id);
        row.append(key);
        for (const w of columns) {
          const report = weekly.get(p.id)[w],
            match = paired.get(p.id)[w];
          const cell = row.insertCell();
          cell.dataset.person = p.id;
          cell.dataset.week = w;
          const display = report.reports ? Math.round(report.rate) + "%" : "—";
          const button = element("button", display);
          button.tabIndex = -1;
          let label =
            p.id +
            ", week " +
            (w + 1) +
            ". " +
            (report.reports
              ? report.independent +
                " of " +
                report.reports +
                " reported mornings dressed without help."
              : "No dressing reports.");
          if (match) {
            const level = Math.min(
              6,
              Math.floor((7 * (match.wakes / scale + match.helped)) / 2),
            );
            button.style.backgroundColor = shades[level];
            button.style.color = level < 5 ? "#08090c" : "#fff";
            label +=
              " " +
              match.wakes.toFixed(1) +
              " awakenings per paired night; help on " +
              Math.round(match.helped * match.count) +
              " of " +
              match.count +
              " paired mornings.";
          } else label += " No paired observations.";
          button.setAttribute("aria-label", display + ". " + label);
          button.title = label;
          cell.append(button);
        }
      });
      table.replaceChildren(cols, head, body);
    }
    function highlight(week, reveal) {
      activeWeek = week;
      const active = table.querySelector('thead [data-week="' + week + '"]');
      for (const th of table.querySelectorAll("thead [data-week]"))
        th.classList.toggle("current", th === active);
      if (!active || !reveal) return;
      const viewport = table.parentElement;
      const frame = viewport.getBoundingClientRect(),
        cell = active.getBoundingClientRect();
      if (cell.right > frame.right)
        viewport.scrollLeft += cell.right - frame.right;
      else if (cell.left < frame.left + 88)
        viewport.scrollLeft += cell.left - frame.left - 88;
    }
    return { render, highlight };
  }
  window.RecoveryMatrix = { attach };
})();
