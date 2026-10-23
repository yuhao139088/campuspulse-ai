export type NormalizedExtract = {
  rows: Record<string, string | number | null>[];
  columns: string[];
  expanded: boolean;
};

type Cell = string | number | null;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scalarCell(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  const json = JSON.stringify(value);
  return json && json.length <= 500 ? json : null;
}

function flattenRow(source: Record<string, unknown>, columns: string[]): Record<string, Cell> {
  const row: Record<string, Cell> = {};
  for (const column of columns) row[column] = scalarCell(source[column]);
  return row;
}

function rowColumns(rows: Record<string, unknown>[]): string[] {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  }
  return columns;
}

export function normalizeExtractedFields(fields: unknown): NormalizedExtract {
  if (!isPlainObject(fields)) return { rows: [], columns: [], expanded: false };
  const entries = Object.entries(fields);
  let table: Record<string, unknown>[] | null = null;
  for (const [, value] of entries) {
    if (Array.isArray(value) && value.length > 0 && value.every(isPlainObject)) {
      if (!table || value.length > table.length) table = value as Record<string, unknown>[];
    }
  }
  if (table) {
    const columns = rowColumns(table);
    return { rows: table.map((item) => flattenRow(item, columns)), columns, expanded: true };
  }
  const columns = entries.map(([key]) => key);
  const row = flattenRow(fields, columns);
  return { rows: columns.length ? [row] : [], columns, expanded: false };
}
