import { describe, expect, it } from "vitest";
import { normalizeExtractedFields } from "../extract-normalize";

describe("normalizeExtractedFields", () => {
  it("expands table arrays into rows and drops document-level scalars", () => {
    const result = normalizeExtractedFields({ title: "信息工程学院公假单", table: [{ 姓名: "李欣悦", 班级: "人工智能25-02班", 人数: 1 }, { 姓名: "王艾伽宁", 班级: "数据技术25-03班" }], note: "注" });
    expect(result.expanded).toBe(true);
    expect(result.rows).toHaveLength(2);
    expect(result.columns).toEqual(["姓名", "班级", "人数"]);
    expect(result.rows[0]).toEqual({ 姓名: "李欣悦", 班级: "人工智能25-02班", 人数: 1 });
    expect(result.rows[1].人数).toBeNull();
  });
  it("keeps flat fields as one row and stringifies nested values", () => {
    const result = normalizeExtractedFields({ title: "公假单", stamp: { a: 1 } });
    expect(result.expanded).toBe(false);
    expect(result.rows).toEqual([{ title: "公假单", stamp: '{"a":1}' }]);
  });
  it("returns empty rows for missing or invalid fields", () => {
    expect(normalizeExtractedFields(undefined).rows).toEqual([]);
    expect(normalizeExtractedFields([]).rows).toEqual([]);
  });
});
