export type KnowledgeChunk = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  source: "CampusPulse curated playbook";
  relevance: number;
  matchedTerms: string[];
};

type KnowledgeCard = Omit<KnowledgeChunk, "relevance" | "matchedTerms"> & { tags: string[] };

const knowledgeBase: KnowledgeCard[] = [
  { id: "club-attendance", title: "社团活动到场率分析方法", content: "到场率以实际签到人数除以有效报名人数计算。先明确取消报名、重复记录和现场补录的处理口径，再按活动类型、时间段、场地和提醒触达情况分组比较；异常结论应回到原始签到证据复核。", tags: ["attendance", "check-in", "registration", "registrations", "registered", "signup", "sign-up", "签到", "到场", "出勤", "报名转化", "活动"] , source: "CampusPulse curated playbook" },
  { id: "budget-review", title: "校园活动预算复盘", content: "预算复盘应区分场地、物料、宣传和临时支出，并确认预算与实际支出的统计口径一致。结合有效报名、签到和满意度观察投入产出，不应只凭绝对金额或单场结果判断浪费。", tags: ["budget", "cost", "spend", "预算", "成本", "支出", "投入产出", "复盘"] , source: "CampusPulse curated playbook" },
  { id: "survey-evidence", title: "满意度问卷证据规范", content: "解释满意度时同时展示有效样本量、题目分布和开放文本主题；说明未答比例、样本来源与可能偏差。小样本或自愿填写的结果应作为信号而非总体结论，必要时人工复核原始答卷。", tags: ["survey", "satisfaction", "feedback", "问卷", "满意度", "反馈", "样本", "置信度"] , source: "CampusPulse curated playbook" },
  { id: "data-quality", title: "导入数据质量检查", content: "分析前检查字段含义、单位、时间范围、重复行、缺失值和无效值。保留原始文件与清洗后记录的对应关系；无法确定字段含义时先询问数据提供者，不要把空值自动解释为零。", tags: ["data quality", "import", "cleaning", "数据质量", "导入", "清洗", "缺失值", "重复"] , source: "CampusPulse curated playbook" },
  { id: "anomaly-review", title: "异常候选复核流程", content: "统计异常只是需要复核的候选，不等于错误或原因已经确定。先检查样本量、缺失和录入口径，再对照原始记录及活动背景；在证据不足时标注不确定性，不把相关性表述成因果。", tags: ["anomaly", "outlier", "异常", "离群", "波动", "复核", "原因", "因果"] , source: "CampusPulse curated playbook" },
  { id: "event-recruitment", title: "活动招募与提醒复盘", content: "将报名、提醒触达和签到按活动及时间段对齐后再比较。单看报名人数不能代表参与效果；提醒策略的变化需要结合触达记录和签到结果复核，避免把同期变化直接归因于提醒。", tags: ["recruitment", "reminder", "registration", "registrations", "registered", "signup", "sign-up", "招募", "提醒", "触达", "报名", "转化"] , source: "CampusPulse curated playbook" },
  { id: "privacy-minimization", title: "校园数据最小化与脱敏", content: "分析优先使用汇总或去标识化字段。展示、导出和演示时隐藏不必要的姓名、联系方式与学号；真实个人信息仅在明确授权和业务必要范围内处理。", tags: ["privacy", "security", "personal data", "隐私", "安全", "个人信息", "脱敏", "权限"] , source: "CampusPulse curated playbook" },
  { id: "report-evidence", title: "运营报告的证据表达", content: "报告把原始观察、计算指标、解释假设和建议分开呈现。每项关键数字注明所用数据集、字段、筛选范围与计算方式；模型建议不应伪装成观测事实。", tags: ["report", "evidence", "报告", "证据", "指标", "计算", "来源", "引用"] , source: "CampusPulse curated playbook" },
  { id: "activity-feedback-loop", title: "行动建议的验证闭环", content: "行动建议应写明待验证的问题、负责人可执行的下一步和复查时间。执行后使用同一口径比较结果，并记录未执行或外部影响；没有后续数据时，不宣称建议已经产生效果。", tags: ["action", "follow-up", "outcome", "行动", "建议", "效果", "复查", "闭环"] , source: "CampusPulse curated playbook" },
  { id: "chart-selection", title: "运营图表选择", content: "比较类别时优先使用条形图，连续时间变化使用折线图；只有类别互斥且合计有意义时才使用饼图。图表标题应说明指标和聚合方式，坐标轴及单位保持可读，并确保数据字段确实存在。", tags: ["chart", "visualization", "图表", "可视化", "折线", "柱状", "饼图", "指标"] , source: "CampusPulse curated playbook" },
];

const englishCopy: Record<string, { title: string; content: string }> = {
  "club-attendance": { title: "Club event attendance analysis", content: "Calculate attendance as checked-in participants divided by valid registrations. Define how cancellations, duplicate entries and on-site additions are handled, then compare by event type, time, venue and reminder reach. Verify anomaly findings against original check-in evidence." },
  "budget-review": { title: "Campus event budget review", content: "Separate venue, materials, promotion and incidental expenses, and confirm that budget and actual-spend definitions match. Review spend alongside valid registrations, attendance and satisfaction; do not infer waste from absolute cost or a single event." },
  "survey-evidence": { title: "Evidence standards for satisfaction surveys", content: "When interpreting satisfaction, show valid sample size, response distribution and open-text themes. Disclose nonresponse, sampling source and potential bias. Treat small or voluntary samples as signals rather than population conclusions, and review original responses when needed." },
  "data-quality": { title: "Imported data quality checks", content: "Before analysis, check field meaning, units, time range, duplicate rows, missing values and invalid values. Preserve the relationship between original files and cleaned records; ask the data owner when a field is ambiguous, and do not silently treat missing values as zero." },
  "anomaly-review": { title: "Reviewing anomaly candidates", content: "A statistical outlier is a candidate for review, not proof of an error or its cause. Check sample size, missingness and recording rules, then compare with source records and event context. State uncertainty and do not describe correlation as causation when evidence is insufficient." },
  "event-recruitment": { title: "Reviewing event recruitment and reminders", content: "Align registrations, reminder reach and check-ins by event and time before comparing. Registration totals alone do not represent participation outcomes. Verify changes in reminder strategy against delivery records and attendance; do not attribute concurrent changes to reminders without evidence." },
  "privacy-minimization": { title: "Campus data minimization and de-identification", content: "Prefer aggregated or de-identified fields for analysis. Hide unnecessary names, contact details and student IDs in displays, exports and demos. Process personal information only when explicitly authorized and within the necessary business scope." },
  "report-evidence": { title: "Evidence presentation in operations reports", content: "Present observations, calculated metrics, explanatory hypotheses and recommendations separately. For each key figure, identify the dataset, fields, filters and calculation. Do not present model-generated recommendations as observed facts." },
  "activity-feedback-loop": { title: "Closing the loop on action recommendations", content: "State the question to validate, an actionable next step and a review date. After execution, compare results using the same definitions and record non-execution or external factors. Do not claim an effect when follow-up data is unavailable." },
  "chart-selection": { title: "Choosing operations charts", content: "Use bars to compare categories and lines for continuous time trends. Use a pie chart only when categories are mutually exclusive and their total is meaningful. Make the metric and aggregation clear in the title, keep axes and units readable, and verify that referenced fields exist." },
};

function scoreCard(query: string, card: KnowledgeCard) {
  const normalizedQuery = query.toLocaleLowerCase();
  const matchedTerms = card.tags.filter((tag) => normalizedQuery.includes(tag.toLocaleLowerCase()));
  const titleMatch = normalizedQuery.includes(card.title.toLocaleLowerCase());
  const contentMatch = card.content.toLocaleLowerCase().split(/[，。；、\s]+/).filter((term) => term.length >= 2 && normalizedQuery.includes(term));
  const score = matchedTerms.length * 2 + (titleMatch ? 4 : 0) + new Set(contentMatch).size;
  return { score, matchedTerms: [...matchedTerms, ...contentMatch.filter((term) => !matchedTerms.includes(term))] };
}

export function retrieveKnowledge(query: string, locale: "zh" | "en") {
  if (!query.trim()) return [];

  return knowledgeBase
    .map((card) => ({ card, ...scoreCard(query, card) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.card.id.localeCompare(right.card.id))
    .slice(0, 3)
    .map(({ card, score, matchedTerms }) => ({
      id: card.id,
      title: locale === "en" ? englishCopy[card.id].title : card.title,
      content: locale === "en" ? englishCopy[card.id].content : card.content,
      tags: card.tags,
      source: card.source,
      relevance: score,
      matchedTerms,
      locale,
    }));
}
