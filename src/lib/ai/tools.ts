export type DataRow = Record<string, string | number | null | undefined>;

export type DatasetProfile = {
  rowCount: number;
  columns: string[];
  missingCells: number;
  numericColumns: string[];
  qualityScore: number;
};

export type Anomaly = {
  rowIndex: number;
  value: number;
  zScore: number;
  reason: string;
};

const numericValue = (value: DataRow[string]) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
};

export function inspectDataset(rows: DataRow[]): DatasetProfile {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const missingCells = rows.reduce((total, row) => total + columns.filter((column) => row[column] === null || row[column] === undefined || row[column] === "").length, 0);
  const numericColumns = columns.filter((column) => rows.length > 0 && rows.filter((row) => numericValue(row[column]) !== null).length / rows.length >= 0.7);
  const totalCells = Math.max(rows.length * columns.length, 1);
  const qualityScore = Math.round((1 - missingCells / totalCells) * 100);
  return { rowCount: rows.length, columns, missingCells, numericColumns, qualityScore };
}

export function aggregateMetrics(rows: DataRow[], metricColumn: string) {
  const values = rows.map((row) => numericValue(row[metricColumn])).filter((value): value is number => value !== null);
  const total = values.reduce((sum, value) => sum + value, 0);
  return { metricColumn, count: values.length, total: Math.round(total * 100) / 100, average: values.length ? Math.round((total / values.length) * 100) / 100 : 0, min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0 };
}

export function calculateRatio(rows: DataRow[], numeratorColumn: string, denominatorColumn: string, groupBy?: string) {
  const groups = new Map<string, { value: DataRow[string]; numerator: number; denominator: number; validRows: number; excludedRows: number }>();
  for (const row of rows) {
    const numerator = numericValue(row[numeratorColumn]);
    const denominator = numericValue(row[denominatorColumn]);
    const value = groupBy ? row[groupBy] : "all";
    const missing = value === null || value === undefined || value === "";
    const key = groupBy ? (missing ? "missing:" : `${typeof value}:`) + String(value) : "all";
    const totals = groups.get(key) ?? { value, numerator: 0, denominator: 0, validRows: 0, excludedRows: 0 };
    if (numerator === null || denominator === null || denominator === 0) {
      totals.excludedRows += 1;
    } else {
      totals.numerator += numerator;
      totals.denominator += denominator;
      totals.validRows += 1;
    }
    groups.set(key, totals);
  }
  const entries = [...groups.entries()];
  const labels = entries.map(([, values]) => values.value === null || values.value === undefined || values.value === "" ? "(missing)" : String(values.value));
  const labelCounts = new Map<string, number>();
  for (const label of labels) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  const results = entries.map(([, values], index) => ({
    group: (labelCounts.get(labels[index]) ?? 0) > 1
      ? `${labels[index]} [${values.value === null || values.value === undefined || values.value === "" ? "missing" : typeof values.value}]`
      : labels[index],
    numerator: Math.round(values.numerator * 100) / 100,
    denominator: Math.round(values.denominator * 100) / 100,
    ratioPercent: values.denominator ? Math.round((values.numerator / values.denominator) * 10000) / 100 : null,
    validRows: values.validRows,
    excludedRows: values.excludedRows,
  }));
  return { numeratorColumn, denominatorColumn, groupBy: groupBy ?? null, results };
}

export function detectAnomalies(rows: DataRow[], metricColumn: string): Anomaly[] {
  const values = rows.map((row) => numericValue(row[metricColumn]));
  const validValues = values.filter((value): value is number => value !== null);
  if (validValues.length < 5) return [];
  const sortedValues = [...validValues].sort((left, right) => left - right);
  const median = (values: number[]) => {
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  };
  const center = median(sortedValues);
  const deviations = sortedValues.map((value) => Math.abs(value - center)).sort((left, right) => left - right);
  const medianDeviation = median(deviations);
  return values.flatMap((value, rowIndex) => {
    if (value === null) return [];
    const scale = medianDeviation || Math.max(Math.abs(center) * 0.01, 1);
    const zScore = 0.6745 * (value - center) / scale;
    return Math.abs(zScore) >= 3.5 ? [{ rowIndex, value, zScore: Math.round(zScore * 100) / 100, reason: zScore > 0 ? "明显高于整体中位数" : "明显低于整体中位数" }] : [];
  });
}

export function createActionPlan(anomalies: Anomaly[], locale: "zh" | "en", metricColumn: string, observationCount: number) {
  if (observationCount < 5) {
    return locale === "en"
      ? [`Only ${observationCount} numeric observation(s) are available for “${metricColumn}”; at least 5 are required for this outlier screen.`, "Verify that the selected field and its units match the source file."]
      : [`当前仅有 ${observationCount} 个“${metricColumn}”有效数值，本异常筛查至少需要 5 个观察值。`, "请核对所选字段及单位是否与原始文件一致。"];
  }

  if (anomalies.length) {
    const rows = anomalies.slice(0, 5).map((item) => `${item.rowIndex + 1} (${item.value}, z=${item.zScore})`).join(", ");
    return locale === "en"
      ? [`Review source records for ${anomalies.length} “${metricColumn}” outlier candidate(s), including row(s) ${rows}.`, "Check missing values, units and recording rules before interpreting the candidates.", "Compare relevant activity groups and document context before changing operations."]
      : [`复核“${metricColumn}”的 ${anomalies.length} 个异常候选（数据行：${rows}），先对照原始记录。`, "检查缺失值、单位和录入规则，再解释这些候选。", "结合活动分组与实际背景复核后，再决定是否调整运营。"];
  }

  return locale === "en"
      ? [`No “${metricColumn}” values crossed the current z-score threshold in ${observationCount} observations; this does not establish that every record is valid.`, "Continue monitoring with the same field definition and review source records when context changes."]
    : [`在 ${observationCount} 个“${metricColumn}”有效数值中，没有数值超过当前 z-score 阈值；这不代表所有记录均无问题。`, "建议保持字段口径一致并持续观察，出现背景变化时复核原始记录。"];
}
