export type AnalysisAnomaly = {
  reason: string;
  value?: number;
  zScore?: number;
};

export type AnalysisResult = {
  mode?: string;
  model?: string;
  queryType?: string;
  answer: string;
  confidence?: number;
  tools: string[];
  evidence: string[];
  actionPlan: string[];
  anomalies: AnalysisAnomaly[];
  metrics?: { registration: { total: number }; attendance: { total: number }; conversion: number };
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function texts(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter((item): item is string => item !== undefined) : [];
}

export function normalizeAnalysisResult(value: unknown): AnalysisResult {
  const input = record(value);
  const metrics = record(input.metrics);
  const registration = number(record(metrics.registration).total);
  const attendance = number(record(metrics.attendance).total);
  const conversion = number(metrics.conversion);
  const confidence = number(input.confidence);
  const anomalies = Array.isArray(input.anomalies) ? input.anomalies.flatMap((item): AnalysisAnomaly[] => {
    const anomaly = record(item);
    const reason = text(item) ?? text(anomaly.reason) ?? text(anomaly.description) ?? text(anomaly.message) ?? text(anomaly.explanation);
    if (!reason) return [];
    return [{ reason, value: number(anomaly.value), zScore: number(anomaly.zScore) }];
  }) : [];

  return {
    mode: text(input.mode),
    model: text(input.model),
    queryType: text(input.queryType),
    answer: text(input.answer) ?? "",
    confidence: confidence === undefined ? undefined : Math.max(0, Math.min(1, confidence)),
    tools: texts(input.tools),
    evidence: texts(input.evidence),
    actionPlan: texts(input.actionPlan),
    anomalies,
    metrics: registration !== undefined && attendance !== undefined && conversion !== undefined
      ? { registration: { total: registration }, attendance: { total: attendance }, conversion }
      : undefined,
  };
}
