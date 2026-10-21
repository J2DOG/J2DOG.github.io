const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { recordDate, buildTrend, buildDailyAverage, chartScale, hasPosition } = require("./dashboard.js");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const context = vm.createContext({});
for (const id of ["csv-parser", "history-folder-reader", "csv-editor-model", "history-edit-model"]) {
  vm.runInContext(scripts.find((s) => s[1].includes(`id="${id}"`))[2], context);
}
const header = "测试名称,问题编号,记录UTC,纬度,经度,问题描述,问题等级,已解决";
const csv = header + "\nrun10,1,2026-10-14T21:17:25Z,,,进匝道过快,高,否\nrun10,2,2026-10-14T21:18:20Z,,,方向盘摆动,中,是\n";
test("all inline scripts compile", () => {
  for (const script of scripts) new vm.Script(script[2]);
});
test("German local dates respect summer time, winter time and year boundaries", () => {
  assert.equal(recordDate({ utc: "2026-10-14T20:09:55Z" }), "2026-10-14");
  assert.equal(recordDate({ utc: "2026-10-14T22:09:55Z" }), "2026-10-15");
  assert.equal(recordDate({ utc: "2026-12-31T22:30:00Z" }), "2026-12-31");
  assert.equal(recordDate({ utc: "2026-12-31T23:30:00Z" }), "2027-01-01");
  assert.equal(recordDate({ utc: "invalid" }), null);
});
test("records without GPS count in the dashboard but not the map", () => {
  const parsed = context.parseRadarCSV(csv);
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.issues.length, 0);
  assert(parsed.records.every((issue) => !hasPosition(issue)));
  const trend = buildTrend(parsed.records);
  assert.equal(trend.total, 1);
  assert.equal(trend.high, 1);
  assert.equal(trend.resolved, 1);
  const daily = buildDailyAverage(parsed.records);
  assert.equal(daily[0].date, "2026-10-14");
  assert.equal(daily[0].runs, 1);
  assert.equal(daily[0].average, 1);
});
test("deduplication selects one whole CSV per test run", () => {
  const rows = [
    { name: "run10", file: "old.csv", fileModified: 1 },
    { name: "run10", file: "new.csv", fileModified: 2 },
    { name: "run10", file: "new.csv", fileModified: 2 },
  ];
  const selected = context.selectOneHistoryCSVPerRun(rows);
  assert.equal(selected.length, 2);
  assert(selected.every((row) => row.file === "new.csv"));
});
test("trends fill date gaps and exclude resolved high priority issues", () => {
  const trend = buildTrend([
    { utc: "2026-10-14T10:00:00Z", severity: "高" },
    { utc: "2026-10-16T10:00:00Z", severity: "高", resolved: true },
    { utc: "bad" },
  ]);
  assert.equal(trend.rows.length, 3);
  assert.equal(trend.rows[1].total, 1);
  assert.equal(trend.high, 1);
  assert.equal(trend.excluded, 1);
  const scale = chartScale([{ total: 0, resolved: 100, high: 0 }], [{ key: "total" }, { key: "resolved" }, { key: "high" }]);
  assert(scale.max >= 100);
  assert(chartScale([], [{ key: "total" }]).max > 0);
});
test("daily average keeps fully resolved runs in the denominator", () => {
  const row = buildDailyAverage([
    { utc: "2026-10-14T10:00:00Z", name: "A" },
    { utc: "2026-10-14T10:00:00Z", name: "B", resolved: true },
  ])[0];
  assert.equal(row.runs, 2);
  assert.equal(row.average, 0.5);
});
test("save and merge unlocated issue without inventing GPS; adding GPS makes it mappable", () => {
  const source = { table: context.readEditableRadarCSV(csv), original: csv };
  const draft = { description: "已修改说明", latitude: "", longitude: "", resolved: true };
  const output = context.buildHistoryEditCSV(source, 0, draft);
  const parsed = context.parseRadarCSV(output.text);
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.issues.length, 0);
  assert.equal(parsed.records[0].resolved, true);
  const positioned = context.buildHistoryEditCSV(source, 0, { ...draft, latitude: "52.44", longitude: "10.75" });
  assert.equal(context.parseRadarCSV(positioned.text).issues.length, 1);
  assert.throws(() => context.buildHistoryEditCSV(source, 0, { ...draft, latitude: "52.44" }), /经纬度/);
  assert.throws(() => context.buildHistoryEditCSV(source, 0, { ...draft, latitude: "91", longitude: "10" }), /经纬度/);
  const merged = context.mergeHistoryEdit(source, 0, draft, csv, { ...draft, description: "进匝道过快", resolved: false });
  assert.equal(merged.draft.description, "已修改说明");
});
test("concurrent edits merge unrelated changes and reject conflicting description changes", () => {
  const source = { table: context.readEditableRadarCSV(csv), original: csv };
  const initial = { description: "进匝道过快", latitude: "", longitude: "", resolved: false };
  const draft = { ...initial, resolved: true };
  const external = csv.replace("进匝道过快", "外部修改");
  const merged = context.mergeHistoryEdit(source, 0, draft, external, initial);
  assert.equal(merged.draft.description, "外部修改");
  assert.equal(merged.draft.resolved, true);
  assert.throws(() => context.mergeHistoryEdit(source, 0, { ...draft, description: "我的修改" }, external, initial), /冲突/);
});
