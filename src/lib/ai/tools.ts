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

export function detectAnomalies(rows: DataRow[], metricColumn: string): Anomaly[] {
  const values = rows.map((row) => numericValue(row[metricColumn]));
  const validValues = values.filter((value): value is number => value !== null);
  if (validValues.length < 3) return [];
  const mean = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
  const standardDeviation = Math.sqrt(validValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / validValues.length) || 1;
  return values.flatMap((value, rowIndex) => {
    if (value === null) return [];
    const zScore = (value - mean) / standardDeviation;
    return Math.abs(zScore) >= 1.5 ? [{ rowIndex, value, zScore: Math.round(zScore * 100) / 100, reason: zScore > 0 ? "明显高于整体均值" : "明显低于整体均值" }] : [];
  });
}

export function createActionPlan(anomalies: Anomaly[], locale: "zh" | "en") {
  if (locale === "en") return anomalies.length ? ["Review the outlier records and verify the source evidence.", "Compare attendance conversion by activity type.", "Run a follow-up survey before changing the budget allocation."] : ["复核异常记录并核对对应的原始证据。", "按活动类型对比报名到签到的转化率。", "在调整预算前发起一次小样本跟进问卷。"];
  return anomalies.length ? ["复核异常记录并核对对应的原始证据。", "按活动类型对比报名到签到的转化率。", "在调整预算前发起一次小样本跟进问卷。"] : ["继续积累活动数据，建立稳定的月度基线。", "为下一次活动补充签到和满意度字段。"];
}
