export type KnowledgeChunk = { id: string; title: string; content: string; tags: string[] };

const knowledgeBase: KnowledgeChunk[] = [
  { id: "club-attendance", title: "社团活动到场率分析方法", content: "到场率应使用实际签到人数除以有效报名人数，并按活动类型、时间段、场地和提醒触达情况分组比较。异常结论需要回到原始签到证据。", tags: ["attendance", "签到", "活动"] },
  { id: "budget-review", title: "校园活动预算复盘", content: "预算复盘应区分场地、物料、宣传和临时支出，结合报名转化与满意度评估投入产出，不应只按绝对金额判断浪费。", tags: ["budget", "预算", "复盘"] },
  { id: "survey-evidence", title: "满意度问卷证据规范", content: "低满意度结论至少需要样本量、题目分布和开放文本共同支撑，并在报告中标记样本偏差和置信度。", tags: ["survey", "问卷", "evidence"] },
];

export function retrieveKnowledge(query: string, locale: "zh" | "en") {
  const normalized = query.toLowerCase();
  const matches = knowledgeBase.filter((chunk) => chunk.tags.some((tag) => normalized.includes(tag.toLowerCase())) || normalized.includes(chunk.title.toLowerCase().slice(0, 4))).slice(0, 3);
  const selected = matches.length ? matches : knowledgeBase.slice(0, 2);
  return selected.map((chunk) => ({ ...chunk, content: locale === "en" ? `Knowledge note: ${chunk.content}` : chunk.content }));
}
