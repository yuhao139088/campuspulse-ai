export type DemoDataset = {
  id: string;
  name: string;
  description: string;
  sourceType: string;
  status: string;
  rowCount: number;
  columnCount: number;
  healthScore: number;
  updatedAt: string;
};

export const demoDatasets: DemoDataset[] = [
  { id: "club-operations", name: "社团运营数据", description: "报名、签到、满意度与预算的月度运营数据。", sourceType: "DEMO", status: "READY", rowCount: 6, columnCount: 7, healthScore: 94, updatedAt: "2026-10-11T08:00:00.000Z" },
  { id: "recruitment-checkin", name: "十月招新签到", description: "招新活动报名和现场签到记录。", sourceType: "CSV", status: "READY", rowCount: 204, columnCount: 8, healthScore: 91, updatedAt: "2026-10-10T07:30:00.000Z" },
  { id: "satisfaction-survey", name: "活动满意度问卷", description: "活动结束后收集的评分与开放文本反馈。", sourceType: "XLSX", status: "READY", rowCount: 386, columnCount: 12, healthScore: 87, updatedAt: "2026-10-08T12:20:00.000Z" },
  { id: "poster-evidence", name: "活动海报与截图证据", description: "待 OCR 和视觉证据解析的图片资料。", sourceType: "IMAGE", status: "PROCESSING", rowCount: 0, columnCount: 0, healthScore: 76, updatedAt: "2026-10-11T09:15:00.000Z" },
];
