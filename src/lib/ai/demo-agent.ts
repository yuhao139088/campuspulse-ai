import { aggregateMetrics, createActionPlan, detectAnomalies, inspectDataset, type DataRow } from "./tools";

const demoRows: DataRow[] = [
  { activity: "迎新分享会", month: "2026-06", registered: 96, checkedIn: 82, satisfaction: 4.6, budget: 1800 },
  { activity: "迎新分享会", month: "2026-07", registered: 118, checkedIn: 104, satisfaction: 4.8, budget: 2100 },
  { activity: "技能工作坊", month: "2026-08", registered: 142, checkedIn: 119, satisfaction: 4.5, budget: 2600 },
  { activity: "技能工作坊", month: "2026-09", registered: 158, checkedIn: 121, satisfaction: 4.2, budget: 3000 },
  { activity: "社团开放日", month: "2026-10", registered: 204, checkedIn: 137, satisfaction: 3.7, budget: 4200 },
  { activity: "社团开放日", month: "2026-11", registered: 76, checkedIn: 42, satisfaction: 3.3, budget: 3900 },
];

function localized(locale: "zh" | "en", zh: string, en: string) {
  return locale === "en" ? en : zh;
}

export function runDemoAgent(prompt: string, locale: "zh" | "en") {
  const normalized = prompt.toLowerCase();
  const profile = inspectDataset(demoRows);
  const registration = aggregateMetrics(demoRows, "registered");
  const attendance = aggregateMetrics(demoRows, "checkedIn");
  const anomalies = detectAnomalies(demoRows, "checkedIn");
  const labeledAnomalies = anomalies.map((item) => ({ ...item, reason: `${demoRows[item.rowIndex].activity}（${demoRows[item.rowIndex].month}）签到量 ${item.value}，${item.reason}` }));
  const conversion = Math.round((attendance.total / registration.total) * 100);
  const budgetRows = [...demoRows].sort((left, right) => Number(right.budget ?? 0) / Number(right.checkedIn ?? 1) - Number(left.budget ?? 0) / Number(left.checkedIn ?? 1));
  const averageSatisfaction = (demoRows.reduce((sum, row) => sum + Number(row.satisfaction ?? 0), 0) / demoRows.length).toFixed(1);
  const isBudget = /预算|投入产出|成本|budget|roi|return/.test(normalized);
  const isSatisfaction = /满意|问卷|反馈|satisfaction|survey|feedback/.test(normalized);
  const isAction = /行动|计划|建议|action|plan|recommend/.test(normalized);
  const isAnomaly = /异常|下降|波动|anomal|drop|decline|outlier/.test(normalized);

  let answer: string;
  let tools: string[];
  let evidence: string[];
  let actionPlan: string[];
  let selectedAnomalies = labeledAnomalies;

  if (isBudget) {
    const leastEfficient = budgetRows[0];
    answer = localized(locale,
      `预算效率分析显示，“${leastEfficient.activity}”（${leastEfficient.month}）每位签到成本约 ${Math.round(Number(leastEfficient.budget ?? 0) / Number(leastEfficient.checkedIn ?? 1))} 元，是样本中最高的一组；它的报名到签到转化率为 ${Math.round((Number(leastEfficient.checkedIn ?? 0) / Number(leastEfficient.registered ?? 1)) * 100)}%。建议先复核物料支出与实际触达，再决定是否增加预算。`,
      `The budget view flags “${leastEfficient.activity}” (${leastEfficient.month}) at about ¥${Math.round(Number(leastEfficient.budget ?? 0) / Number(leastEfficient.checkedIn ?? 1))} per check-in, the highest in this sample. Its registration-to-attendance conversion is ${Math.round((Number(leastEfficient.checkedIn ?? 0) / Number(leastEfficient.registered ?? 1)) * 100)}%. Verify material spend and reach before increasing the budget.`);
    tools = ["inspect_dataset", "aggregate_metrics", "query_dataset", "create_action_plan"];
    evidence = [localized(locale, "活动预算记录", "activity budget records"), localized(locale, "签到明细", "attendance details"), localized(locale, "活动投入产出计算", "activity ROI calculation")];
    actionPlan = [localized(locale, "按活动拆分物料、场地和宣传成本", "Break down material, venue and promotion costs by activity"), localized(locale, "将每位签到成本加入月度预算看板", "Add cost per check-in to the monthly budget board"), localized(locale, "对高成本活动进行小规模 A/B 招募测试", "Run a small A/B recruitment test for high-cost activities")];
    selectedAnomalies = [];
  } else if (isSatisfaction) {
    answer = localized(locale,
      `问卷数据的平均满意度为 ${averageSatisfaction}/5，满意度最低的是“社团开放日”（3.3/5），与其 42 次签到和较高预算同时出现。建议将低分反馈按场地、流程和内容三个主题归类后再改版。`,
      `Survey responses average ${averageSatisfaction}/5. “社团开放日” is lowest at 3.3/5, alongside only 42 check-ins and a high budget. Cluster low-score feedback into venue, process and content themes before redesigning the event.`);
    tools = ["inspect_dataset", "profile_columns", "query_dataset", "analyze_image_evidence", "create_action_plan"];
    evidence = [localized(locale, "满意度问卷", "satisfaction survey"), localized(locale, "活动签到记录", "activity attendance records"), localized(locale, "图片证据队列", "image evidence queue")];
    actionPlan = [localized(locale, "先处理 3.0 分以下的高频反馈", "Prioritize recurring feedback below 3.0"), localized(locale, "将场地和签到流程纳入下一次复盘", "Include venue and check-in flow in the next review"), localized(locale, "活动结束后 24 小时内完成问卷回收", "Collect survey responses within 24 hours after the event")];
    selectedAnomalies = [];
  } else if (isAction) {
    answer = localized(locale,
      `基于当前数据，建议执行三步行动：先核验 11 月低签到的原始证据，再把提醒触达和课程冲突作为分组变量，最后将预算向签到转化率高于 75% 的活动倾斜。当前整体转化率为 ${conversion}%。`,
      `Based on the current data, take three actions: verify the raw evidence for November's low attendance, segment by reminder reach and timetable conflicts, then shift budget toward activities above 75% conversion. Overall conversion is ${conversion}%.`);
    tools = ["inspect_dataset", "detect_anomalies", "retrieve_knowledge", "create_action_plan"];
    evidence = [localized(locale, "月度签到序列", "monthly attendance series"), localized(locale, "异常检测结果", "anomaly detection output"), localized(locale, "社团运营知识库", "club operations knowledge base")];
    actionPlan = [localized(locale, "复核 11 月签到证据与活动截图", "Verify November attendance evidence and screenshots"), localized(locale, "按课程冲突和提醒触达率切分报名人群", "Segment registrants by timetable conflicts and reminder reach"), localized(locale, "下周复测高转化活动的提醒策略", "Retest the reminder strategy from high-conversion activities next week")];
  } else if (isAnomaly) {
    answer = localized(locale,
      `异常检测发现 11 月签到量为 ${demoRows[5].checkedIn}，相对同类活动和前一期明显偏低；同时满意度降至 ${demoRows[5].satisfaction}/5。这个信号更像“到场质量与触达同时变差”，而不是单一报名量问题。`,
      `Anomaly detection finds only ${demoRows[5].checkedIn} check-ins in November, materially below comparable activities and the prior period; satisfaction also falls to ${demoRows[5].satisfaction}/5. This points to a combined reach and attendance-quality issue rather than registrations alone.`);
    tools = ["inspect_dataset", "profile_columns", "detect_anomalies", "analyze_image_evidence"];
    evidence = [localized(locale, "签到记录", "attendance records"), localized(locale, "满意度字段", "satisfaction field"), localized(locale, "活动海报与签到截图", "event poster and check-in screenshot")];
    actionPlan = [localized(locale, "核验签到设备和现场截图时间", "Verify check-in device logs and screenshot timestamps"), localized(locale, "对比课程表与提醒发送记录", "Compare timetable conflicts with reminder logs"), localized(locale, "对异常活动进行人工复核后再生成报告", "Manually review the anomalous activity before reporting")];
  } else {
    answer = localized(locale,
      `数据集共包含 ${registration.total} 次报名和 ${attendance.total} 次签到，整体转化率为 ${conversion}%。从趋势看，后期活动的报名规模扩大，但签到与满意度没有同步增长，建议优先关注触达质量和现场流程。`,
      `The dataset contains ${registration.total} registrations and ${attendance.total} check-ins, for an overall conversion of ${conversion}%. Later activities attract more registrations, but attendance and satisfaction do not keep pace; focus on reach quality and on-site flow.`);
    tools = ["inspect_dataset", "profile_columns", "aggregate_metrics", "query_dataset"];
    evidence = [localized(locale, "社团运营演示 CSV", "demo club operations CSV"), localized(locale, "活动签到记录", "activity attendance records"), localized(locale, "满意度与预算字段", "satisfaction and budget fields")];
    actionPlan = [localized(locale, "建立报名、签到、满意度的联合看板", "Build a combined registration, attendance and satisfaction board"), localized(locale, "对低转化活动增加会前提醒", "Add pre-event reminders for low-conversion activities"), localized(locale, "每月复核异常和证据链", "Review anomalies and the evidence chain monthly")];
    selectedAnomalies = [];
  }

  return {
    answer,
    tools,
    evidence,
    profile,
    metrics: { registration, attendance, conversion },
    anomalies: selectedAnomalies,
    actionPlan: isAction ? actionPlan : actionPlan.length ? actionPlan : createActionPlan(anomalies, locale),
    confidence: isBudget || isSatisfaction ? 0.88 : 0.91,
    queryType: isBudget ? "budget" : isSatisfaction ? "satisfaction" : isAction ? "action-plan" : isAnomaly ? "anomaly" : "overview",
  };
}
