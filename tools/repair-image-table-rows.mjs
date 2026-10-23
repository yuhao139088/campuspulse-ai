import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const apply = process.argv.includes("--apply");

const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

const scalarCell = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") { const trimmed = value.trim(); return trimmed === "" ? null : trimmed; }
  if (typeof value === "boolean") return value ? "true" : "false";
  const json = JSON.stringify(value);
  return json && json.length <= 500 ? json : null;
};

const unionColumns = (rows) => {
  const columns = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  return columns;
};

const flattenRow = (source, columns) => Object.fromEntries(columns.map((column) => [column, scalarCell(source[column])]));

const numericValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
};

const inspect = (rows) => {
  const columns = unionColumns(rows);
  const missingCells = rows.reduce((total, row) => total + columns.filter((column) => row[column] === null || row[column] === undefined || row[column] === "").length, 0);
  const numericColumns = columns.filter((column) => rows.length > 0 && rows.filter((row) => numericValue(row[column]) !== null).length / rows.length >= 0.7);
  const qualityScore = Math.round((1 - missingCells / Math.max(rows.length * columns.length, 1)) * 100);
  return { rowCount: rows.length, columns, missingCells, numericColumns, qualityScore };
};

const longestTable = (source) => Object.values(source)
  .filter((value) => Array.isArray(value) && value.length > 0 && value.every(isPlainObject))
  .sort((left, right) => right.length - left.length)[0] ?? null;

try {
  const datasets = await client.dataset.findMany({ where: { sourceType: { in: ["IMAGE", "SCREENSHOT"] } }, include: { evidence: true } });
  console.log("image datasets scanned: " + datasets.length + " (" + (apply ? "apply" : "dry-run") + ")");
  for (const dataset of datasets) {
    for (const evidence of dataset.evidence) {
      const content = evidence.content;
      if (!isPlainObject(content) || !Array.isArray(content.rows) || content.rows.length !== 1 || !isPlainObject(content.rows[0])) continue;
      const table = longestTable(content.rows[0]);
      if (!table) continue;
      const columns = unionColumns(table);
      const rows = table.map((item) => flattenRow(item, columns));
      const profile = inspect(rows);
      const dictionary = columns.map((field) => ({ field, meaning: field, type: profile.numericColumns.includes(field) ? "number" : "text" }));
      console.log("repair " + dataset.id + " | " + dataset.name + " | rows 1 -> " + rows.length + " | columns " + JSON.stringify(columns));
      if (!apply) continue;
      await client.evidence.update({ where: { id: evidence.id }, data: { content: { ...content, rows, columns, profile, dictionary } } });
      await client.dataset.update({ where: { id: dataset.id }, data: { rowCount: rows.length, columnCount: columns.length, healthScore: profile.qualityScore } });
    }
  }
  const canvases = await client.canvas.findMany();
  for (const canvas of canvases) {
    const config = canvas.config;
    if (!isPlainObject(config) || typeof config.datasetId !== "string" || !Array.isArray(config.charts)) continue;
    const dataset = datasets.find((item) => item.id === config.datasetId);
    if (!dataset) continue;
    const evidence = dataset.evidence.find((item) => isPlainObject(item.content) && Array.isArray(item.content.rows));
    const available = evidence && Array.isArray(evidence.content.columns) ? evidence.content.columns : [];
    const stale = config.charts.filter((chart) => (chart.category && !available.includes(chart.category)) || (chart.metric && !available.includes(chart.metric)));
    if (stale.length) console.log("canvas " + canvas.id + " user " + canvas.userId + " has stale charts: " + stale.map((chart) => chart.title + "[" + chart.category + "/" + (chart.metric || "count") + "]").join(", "));
  }
  console.log(apply ? "repair complete" : "dry-run complete; rerun with --apply to write changes");
} finally { await client.$disconnect(); }
