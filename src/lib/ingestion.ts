import Papa from "papaparse";
import * as XLSX from "xlsx";
import { inspectDataset, type DataRow } from "./ai/tools";
import { callAI } from "./ai/provider";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { aiConfig, uploadConfig } from "./system-config";
import { ApiError } from "./errors";

export async function ingestFile(file: File, locale: string = "zh") {
  const limits = await uploadConfig();
  if (!file.size || file.size > limits.maxMb * 1024 * 1024) throw new ApiError(413, "File exceeds the configured " + limits.maxMb + " MB limit");
  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (["csv", "xlsx", "xls"].includes(extension ?? "")) {
    const matrix = extension === "csv"
      ? Papa.parse<unknown[]>(bytes.toString("utf8").replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" }).data
      : (() => { const workbook = XLSX.read(bytes, { type: "buffer" }); return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: null }); })();
    if (matrix.length > limits.maxRows + 1) throw new ApiError(413, "Dataset exceeds the configured row limit: " + limits.maxRows);
    const [headers = [], ...body] = matrix;
    const columns = headers.map((value, index) => String(value ?? "").trim() || "column_" + (index + 1));
    if (!columns.length || columns.length > limits.maxColumns || new Set(columns).size !== columns.length) throw new ApiError(400, "Column headers must be unique, maximum " + limits.maxColumns);
    const seen = new Set<string>();
    let duplicates = 0;
    const rows = body.map((cells) => Object.fromEntries(columns.map((name, index) => {
      const value = cells[index];
      const cleaned = typeof value === "string" ? value.trim() : value;
      return [name, cleaned === undefined || cleaned === "" ? null : typeof cleaned === "number" ? cleaned : String(cleaned)];
    }))).filter((row) => { const key = JSON.stringify(row); if (seen.has(key)) { duplicates++; return false; } seen.add(key); return true; }) as DataRow[];
    const profile = inspectDataset(rows);
    const dictionary = columns.map((field) => ({ field, type: profile.numericColumns.includes(field) ? "number" : "text", meaning: field }));
    let summary = rows.length + " rows, " + columns.length + " columns";
    let mode = "local-profile";
    try {
      const response = await callAI([{ role: "system", content: "Summarize and describe only the given data in " + locale + ". Return JSON: {summary:string,dataDictionary:[{field,meaning,type}]}. Preserve exact field keys." }, { role: "user", content: JSON.stringify({ profile, rows: rows.slice(0, 30) }) }], { json: true });
      const ai = JSON.parse(response.content);
      summary = typeof ai.summary === "string" ? ai.summary : summary;
      if (Array.isArray(ai.dataDictionary)) for (const field of dictionary) { const match = ai.dataDictionary.find((item: { field?: string; meaning?: string }) => item.field === field.field); if (typeof match?.meaning === "string") field.meaning = match.meaning; }
      mode = "live";
    } catch { mode = "local-profile"; }
    return { sourceType: extension === "csv" ? "CSV" as const : "EXCEL" as const, rows, columns, profile, dictionary, summary, duplicates, mode, bytes, contentType: extension === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }
  if (!["png", "jpg", "jpeg", "webp"].includes(extension ?? "")) throw new ApiError(400, "Supported formats: CSV, Excel, PNG, JPEG, WebP");
  if (!limits.imagesEnabled) throw new ApiError(403, "Image imports are disabled by the system administrator");
  const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  let extracted: { text?: string; fields?: Record<string, string>; confidence?: number } = {};
  let method = "vision-model";
  try {
    const response = await callAI([{ role: "system", content: "Read image text exactly; never guess. Return JSON {text:string,fields:object,confidence:number}. Include all readable text and relevant fields." }, { role: "user", content: [{ type: "image_url", image_url: { url: "data:" + contentType + ";base64," + bytes.toString("base64") } }] }], { json: true });
    extracted = JSON.parse(response.content);
    if (!extracted.text?.trim()) throw new Error("No OCR text");
  } catch {
    method = "tesseract-and-ai";
    const directory = await mkdtemp(join(tmpdir(), "campuspulse-ocr-"));
    try {
      const input = directory + "/source-image";
      const output = directory + "/ocr";
      await writeFile(input, bytes);
      await promisify(execFile)(process.env.TESSERACT_PATH ?? "tesseract", [input, output, "-l", "chi_sim+eng"], { timeout: 45000 });
      extracted = { text: (await readFile(output + ".txt", "utf8")).trim(), fields: {} };
      if (!extracted.text) throw new Error("No readable text found in this image");
      const response = await callAI([{ role: "system", content: "Extract structured fields from this OCR text in " + locale + ". Do not invent text. Return JSON {text:string,fields:object}." }, { role: "user", content: extracted.text }], { json: true });
      const structured = JSON.parse(response.content);
      extracted.fields = structured.fields && typeof structured.fields === "object" ? structured.fields : {};
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
  const rows = Object.keys(extracted.fields ?? {}).length ? [extracted.fields as DataRow] : [];
  return { sourceType: "IMAGE" as const, rows, columns: Object.keys(rows[0] ?? {}), profile: inspectDataset(rows), dictionary: Object.keys(rows[0] ?? {}).map((field) => ({ field, meaning: field, type: "text" })), summary: extracted.text ?? "", duplicates: 0, mode: "live", ocr: { ...extracted, method, model: (await aiConfig()).visionModel }, bytes, contentType };
}
