import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const apply = process.argv.includes("--apply");
const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

try {
  const canvases = await client.canvas.findMany();
  const datasets = await client.dataset.findMany({ include: { evidence: true } });
  const info = new Map();
  for (const dataset of datasets) {
    const evidence = dataset.evidence.find((item) => isPlainObject(item.content) && Array.isArray(item.content.columns));
    info.set(dataset.id, { name: dataset.name, spaceId: dataset.spaceId, columns: evidence ? evidence.content.columns : [] });
  }
  console.log("canvases: " + canvases.length + ", datasets: " + datasets.length + " (" + (apply ? "apply" : "dry-run") + ")");
  for (const canvas of canvases) {
    const config = canvas.config;
    if (!isPlainObject(config) || !Array.isArray(config.charts)) continue;
    const spaceDatasets = [...info.entries()].filter(([, value]) => value.spaceId === canvas.spaceId);
    const allKnown = spaceDatasets.length > 0 && spaceDatasets.every(([, value]) => value.columns.length > 0);
    const matches = (datasetId, chart) => {
      const value = info.get(datasetId);
      if (!value || value.spaceId !== canvas.spaceId || !value.columns.length) return false;
      if (!value.columns.includes(chart.category)) return false;
      return chart.aggregation === "count" || !chart.metric || value.columns.includes(chart.metric);
    };
    const preferred = typeof config.datasetId === "string" && config.datasetId ? config.datasetId : "";
    const candidates = [preferred, ...spaceDatasets.map(([id]) => id)].filter(Boolean);
    const next = [];
    const changes = [];
    for (const chart of config.charts) {
      if (!isPlainObject(chart) || typeof chart.id !== "string" || !chart.id) continue;
      const label = (typeof chart.title === "string" && chart.title ? chart.title : chart.id) + "[" + chart.category + "/" + (chart.metric || "count") + "]";
      const current = typeof chart.datasetId === "string" && chart.datasetId ? chart.datasetId : "";
      if (current && matches(current, chart)) { next.push({ ...chart, datasetId: current }); continue; }
      const target = candidates.find((id) => matches(id, chart));
      if (target) {
        changes.push(label + ": " + (current || "legacy/no-dataset") + " -> " + target + " (" + info.get(target).name + ")");
        next.push({ ...chart, datasetId: target });
        continue;
      }
      if (allKnown) {
        changes.push(label + ": dropped, no dataset in this space has column " + chart.category);
        continue;
      }
      changes.push(label + ": kept on " + (current || preferred || "canvas dataset") + " (dataset columns unknown)");
      next.push({ ...chart, datasetId: current || preferred });
    }
    const scoped = next.filter((item) => item.datasetId === preferred);
    const datasetId = scoped.length || !next.length ? preferred : next[0].datasetId;
    if (datasetId !== preferred) changes.push("canvas dataset " + (preferred || "-") + " -> " + datasetId + " (" + info.get(datasetId).name + "), no chart belonged to the stored dataset");
    const chartType = next.filter((item) => item.datasetId === datasetId).find((item) => item.id === config.chartType)?.id ?? next.filter((item) => item.datasetId === datasetId)[0]?.id ?? "";
    if (!changes.length && chartType === config.chartType && datasetId === preferred) continue;
    console.log("canvas " + canvas.id + " | user " + canvas.userId + " | space " + canvas.spaceId + " | dataset " + (preferred || "-") + " -> " + (datasetId || "-") + " | charts " + config.charts.length + " -> " + next.length + " | active " + (chartType || "-"));
    for (const line of changes) console.log("  " + line);
    if (!apply) continue;
    await client.canvas.update({ where: { id: canvas.id }, data: { config: { ...config, charts: next, chartType, datasetId, components: next.map((item) => item.id) } } });
  }
  console.log(apply ? "canvas chart scoping complete" : "dry-run complete; rerun with --apply to write changes");
} finally { await client.$disconnect(); }