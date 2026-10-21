(() => {
  const DAY = 86400000;
  const germanDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
  function recordDate(issue) {
    const time = Date.parse(issue.utc);
    if (!Number.isFinite(time)) return null;
    const parts = Object.fromEntries(germanDate.formatToParts(new Date(time)).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  const hasPosition = (issue) =>
    Number.isFinite(issue.latitude) && Number.isFinite(issue.longitude) && Math.abs(issue.latitude) <= 90 && Math.abs(issue.longitude) <= 180;
  function runKey(issue) {
    return issue.startedUTC ? "start:" + issue.startedUTC : issue.name?.trim() ? "name:" + issue.name.trim() : "file:" + (issue.file || "未命名测试");
  }
  function buildTrend(items) {
    const days = new Map();
    let excluded = 0;
    for (const issue of Array.isArray(items) ? items : []) {
      const date = recordDate(issue);
      if (!date) {
        excluded++;
        continue;
      }
      const count = days.get(date) || { total: 0, resolved: 0, high: 0 };
      if (issue.resolved === true) count.resolved++;
      else {
        count.total++;
        if (issue.severity === "高") count.high++;
      }
      days.set(date, count);
    }
    const dates = [...days.keys()].sort(),
      rows = [];
    let total = 0,
      resolved = 0,
      high = 0;
    if (dates.length) {
      const start = Date.parse(dates[0] + "T00:00:00Z"),
        end = Date.parse(dates.at(-1) + "T00:00:00Z");
      for (let time = start; time <= end; time += DAY) {
        const date = new Date(time).toISOString().slice(0, 10),
          count = days.get(date) || { total: 0, resolved: 0, high: 0 };
        total += count.total;
        resolved += count.resolved;
        high += count.high;
        rows.push({ date, total, resolved, high });
      }
    }
    return { rows, total, resolved, high, excluded };
  }
  function buildDailyAverage(items) {
    const days = new Map();
    for (const issue of Array.isArray(items) ? items : []) {
      const date = recordDate(issue);
      if (!date) continue;
      const day = days.get(date) || { date, problems: 0, runs: new Set() };
      day.runs.add(runKey(issue));
      if (issue.resolved !== true) day.problems++;
      days.set(date, day);
    }
    return [...days.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({ date: day.date, problems: day.problems, runs: day.runs.size, average: day.problems / day.runs.size }));
  }
  function chartScale(rows, series) {
    let max = 0;
    for (const row of rows) for (const item of series) max = Math.max(max, row[item.key]);
    const rough = Math.max(1, max) / 4,
      power = 10 ** Math.floor(Math.log10(rough));
    const step = Math.max(
      series.some((item) => item.key === "average") ? 0 : 1,
      [1, 2, 2.5, 5, 10].map((n) => n * power).find((n) => n >= rough)
    );
    return { step, max: step * 4 };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { recordDate, buildTrend, buildDailyAverage, chartScale, hasPosition };
  if (typeof document === "undefined") return;
  const $ = (id) => document.getElementById(id);
  const trendSeries = [
    { key: "total", label: "剩余问题", color: "#2864b9", dash: "" },
    { key: "resolved", label: "累计已解决", color: "#258368", dash: "6 4" },
    { key: "high", label: "剩余高优问题", color: "#c64545", dash: "2 4" },
  ];
  const averageSeries = [{ key: "average", label: "平均剩余问题 / 趟", color: "#6e6ba7", dash: "" }];
  function node(tag, attrs = {}, text) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function table(id, rows, columns) {
    const body = $(id);
    body.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const tr = document.createElement("tr");
      for (const key of columns) {
        const td = document.createElement("td");
        td.textContent = key === "average" ? row[key].toFixed(2) : String(row[key]);
        tr.append(td);
      }
      fragment.append(tr);
    }
    body.append(fragment);
  }
  function chart(id, rows, series, readoutId, describe, title) {
    const svg = $(id),
      readout = $(readoutId);
    svg.replaceChildren();
    svg.hidden = !rows.length;
    readout.hidden = !rows.length;
    if (!rows.length) {
      readout.textContent = "";
      return;
    }
    const width = Math.max(260, Math.min(1000, svg.parentElement.clientWidth || window.innerWidth - (window.innerWidth <= 680 ? 80 : 160))),
      height = 255,
      left = 53,
      right = 26,
      top = 25,
      bottom = 40;
    const w = width - left - right,
      h = height - top - bottom,
      scale = chartScale(rows, series);
    const first = Date.parse(rows[0].date),
      last = Date.parse(rows.at(-1).date);
    const x = (row) => left + (first === last ? w / 2 : ((Date.parse(row.date) - first) / (last - first)) * w);
    const y = (value) => top + h - (value / scale.max) * h;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.append(node("title", { id: id === "historyTrendChart" ? "historyTrendTitle" : "historyAverageTitle" }, title));
    svg.append(node("desc", {}, "按德国当地日期统计。可使用左右方向键或悬停查看数据，下方提供完整数据表。"));
    const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
    for (let i = 0; i <= 4; i++) {
      const value = scale.step * i;
      svg.append(node("line", { x1: left, x2: width - right, y1: y(value), y2: y(value), stroke: "#e9eeeb", "stroke-dasharray": i ? "3 5" : "" }));
      svg.append(node("text", { x: left - 12, y: y(value) + 4, "text-anchor": "end", fill: "#89978e", "font-size": 12 }, number.format(value)));
    }
    svg.append(
      node("text", { x: left, y: 12, fill: "#89978e", "font-size": 11 }, id === "historyTrendChart" ? "问题数 · 条" : "平均问题数 · 条 / 趟")
    );
    const labelCount = Math.min(width < 500 ? 3 : 7, rows.length);
    const indices = [...new Set(Array.from({ length: labelCount }, (_, i) => Math.round((i * (rows.length - 1)) / Math.max(1, labelCount - 1))))];
    for (const i of indices)
      svg.append(node("text", { x: x(rows[i]), y: height - 14, "text-anchor": "middle", fill: "#89978e", "font-size": 12 }, rows[i].date.slice(5)));
    if (rows.length > 1) {
      const area = `M${x(rows[0])},${y(0)} ` + rows.map((row) => `L${x(row)},${y(row[series[0].key])}`).join(" ") + ` L${x(rows.at(-1))},${y(0)} Z`;
      svg.append(node("path", { d: area, fill: series[0].color, opacity: 0.045 }));
    }
    for (const item of series) {
      svg.append(
        node("path", {
          d: rows.map((row, i) => `${i ? "L" : "M"}${x(row)},${y(row[item.key])}`).join(" "),
          fill: "none",
          stroke: item.color,
          "stroke-width": 2.5,
          "stroke-dasharray": item.dash,
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
        })
      );
      if (rows.length <= 45)
        for (const row of rows)
          svg.append(node("circle", { cx: x(row), cy: y(row[item.key]), r: 3.5, fill: "white", stroke: item.color, "stroke-width": 2 }));
    }
    const guide = node("line", { y1: top, y2: top + h, stroke: "#becdc2", "stroke-dasharray": "3 4" });
    svg.append(guide);
    const dots = series.map((item) => node("circle", { r: 4.5, fill: item.color, stroke: "white", "stroke-width": 2 }));
    dots.forEach((dot) => svg.append(dot));
    let active = rows.length - 1;
    const hits = [];
    function select(index) {
      active = index;
      const row = rows[index];
      guide.setAttribute("x1", x(row));
      guide.setAttribute("x2", x(row));
      series.forEach((item, i) => {
        dots[i].setAttribute("cx", x(row));
        dots[i].setAttribute("cy", y(row[item.key]));
      });
      readout.textContent = describe(row);
      hits.forEach((hit, i) => hit.setAttribute("tabindex", i === index ? 0 : -1));
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i],
        start = i ? (x(rows[i - 1]) + x(row)) / 2 : left,
        end = i < rows.length - 1 ? (x(row) + x(rows[i + 1])) / 2 : width - right;
      const hit = node("rect", {
        x: start,
        y: top,
        width: end - start,
        height: h,
        fill: "transparent",
        class: "dashboard-hit",
        tabindex: i === active ? 0 : -1,
        role: "img",
        "aria-label": describe(row),
      });
      hit.addEventListener("pointerenter", () => select(i));
      hit.addEventListener("focus", () => select(i));
      hit.addEventListener("keydown", (event) => {
        const index =
          event.key === "ArrowLeft"
            ? Math.max(0, active - 1)
            : event.key === "ArrowRight"
              ? Math.min(rows.length - 1, active + 1)
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? rows.length - 1
                  : null;
        if (index !== null) {
          event.preventDefault();
          select(index);
          hits[index].focus();
        }
      });
      hits.push(hit);
      svg.append(hit);
    }
    select(active);
  }
  function renderUnlocated(items) {
    const rows = items.filter((issue) => !hasPosition(issue));
    $("historyUnlocatedCount").textContent = String(rows.length);
    $("sidebarUnlocatedCount").textContent = String(rows.length);
    $("sidebarUnlocatedSummary").textContent = rows.length ? `${rows.length} 条未显示在地图上 · 可编辑和补充位置` : "暂无未定位问题";
    $("historyUnlocatedEmpty").hidden = !!rows.length;
    $("historyUnlocatedPanel").hidden = !rows.length;
    const body = $("historyUnlocatedRows");
    body.replaceChildren();
    for (const issue of rows) {
      const tr = document.createElement("tr");
      if (issue.resolved) tr.className = "unlocated-resolved";
      const time = Date.parse(issue.utc);
      const local = Number.isFinite(time)
        ? new Intl.DateTimeFormat("zh-CN", {
            timeZone: "Europe/Berlin",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          }).format(new Date(time))
        : "时间未填写";
      for (const value of [
        local,
        issue.name || issue.file || "未命名测试",
        issue.description || "未填写描述",
        issue.severity || "未知",
        issue.resolved ? "已解决" : "待解决",
      ]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      const td = document.createElement("td"),
        button = document.createElement("button");
      button.type = "button";
      button.className = "unlocated-edit";
      button.textContent = "编辑 / 补充位置";
      button.addEventListener("click", () => {
        $("historyUnlocatedDialog").close();
        window.radarEditHistory?.(issue, null);
      });
      td.append(button);
      tr.append(td);
      body.append(tr);
    }
  }
  function render() {
    const items = window.radarHistoryItems || [],
      trend = buildTrend(items),
      averages = buildDailyAverage(items);
    for (const key of ["total", "resolved", "high"]) $("trendCount-" + key).textContent = trend[key].toLocaleString("zh-CN");
    const count = trend.total + trend.resolved;
    $("trendResolutionRate").textContent = count ? ((trend.resolved / count) * 100).toFixed(1) + "%" : "—";
    $("trendResolutionCaption").textContent = count ? `${trend.resolved} / ${count} 条有效时间记录` : "等待导入历史数据";
    $("historyDashboardSummary").textContent = `剩余 ${trend.total} · 已解决 ${trend.resolved} · 剩余高优 ${trend.high}`;
    $("historyTrendRange").textContent = trend.rows.length
      ? `${trend.rows[0].date} — ${trend.rows.at(-1).date}　/　${new Set(items.map(runKey)).size} 趟测试 · ${items.length} 条记录`
      : "导入历史数据，查看路测问题与改善进展";
    const unlocated = items.filter((issue) => !hasPosition(issue)).length;
    $("historyTrendQuality").textContent = [
      unlocated ? `${unlocated} 条问题暂无 GPS，已保留在未定位问题列表中，有效时间记录正常计入统计。` : "",
      trend.excluded ? `${trend.excluded} 条问题缺少有效记录时间，未计入图表；请通过 CSV 问题表重编辑补全记录时间。` : "",
    ]
      .filter(Boolean)
      .join(" ");
    $("historyTrendEmpty").hidden = !!trend.rows.length;
    $("historyAveragePanel").hidden = !averages.length;
    $("historyTrendDetails").hidden = !trend.rows.length;
    chart(
      "historyTrendChart",
      trend.rows,
      trendSeries,
      "historyTrendReadout",
      (row) => `${row.date}　·　剩余 ${row.total}　/　已解决 ${row.resolved}　/　剩余高优 ${row.high}`,
      "历史问题累计趋势（德国当地日期）"
    );
    chart(
      "historyAverageChart",
      averages,
      averageSeries,
      "historyAverageReadout",
      (row) => `${row.date}　·　剩余 ${row.problems} 条 ÷ ${row.runs} 趟 = ${row.average.toFixed(2)} 条 / 趟`,
      "每日每趟平均剩余问题"
    );
    table("historyTrendRows", trend.rows, ["date", "total", "resolved", "high"]);
    table("historyAverageRows", averages, ["date", "problems", "runs", "average"]);
    renderUnlocated(items);
  }
  $("openHistoryDashboard").addEventListener("click", () => {
    if (!$("historyDashboardDialog").open) $("historyDashboardDialog").showModal();
    render();
    $("historyDashboardDialog").scrollTop = 0;
  });
  $("closeHistoryDashboard").addEventListener("click", () => $("historyDashboardDialog").close());
  $("openHistoryUnlocated").addEventListener("click", () => {
    renderUnlocated(window.radarHistoryItems || []);
    if (!$("historyUnlocatedDialog").open) $("historyUnlocatedDialog").showModal();
    $("historyUnlocatedDialog").scrollTop = 0;
  });
  $("closeHistoryUnlocated").addEventListener("click", () => $("historyUnlocatedDialog").close());
  window.addEventListener("radar-history-updated", render);
  let resizeFrame;
  window.addEventListener("resize", () => {
    if (!$("historyDashboardDialog").open) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(render);
  });
  render();
})();
