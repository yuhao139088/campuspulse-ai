"use client";

import ReactECharts from "echarts-for-react";
import { useAppLocale } from "@/lib/locale";

type ActivityChartProps = {
  chartType?: string;
  onReady?: (chart: unknown) => void;
};

const axis = { axisLine: { lineStyle: { color: "rgba(150,190,220,.12)" } }, axisLabel: { color: "#71899e", fontSize: 10 }, axisTick: { show: false } };
const yAxis = { type: "value", splitNumber: 3, axisLabel: { color: "#71899e", fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(150,190,220,.08)" } }, axisLine: { show: false } };
const tooltip = { trigger: "axis", backgroundColor: "#10263d", borderColor: "rgba(77,225,212,.3)", textStyle: { color: "#dceeff", fontSize: 11 } };

const options: Record<string, Record<string, unknown>> = {
  趋势面积图: { grid: { top: 18, right: 14, bottom: 25, left: 10, containLabel: true }, tooltip, xAxis: { ...axis, type: "category", boundaryGap: false, data: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"] }, yAxis, series: [{ name: "签到人数", type: "line", smooth: true, symbol: "none", data: [420, 516, 492, 648, 721, 684], lineStyle: { width: 3, color: "#4de1d4" }, areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(77,225,212,.24)" }, { offset: 1, color: "rgba(77,225,212,0)" }] } } }] },
  报名与签到: { grid: { top: 18, right: 14, bottom: 25, left: 10, containLabel: true }, tooltip, legend: { top: 0, textStyle: { color: "#9ab0c1", fontSize: 10 } }, xAxis: { ...axis, type: "category", data: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"] }, yAxis, series: [{ name: "报名", type: "bar", barGap: "12%", data: [96, 118, 142, 158, 204, 76], itemStyle: { color: "#a995ff", borderRadius: [5, 5, 0, 0] } }, { name: "签到", type: "bar", data: [82, 104, 119, 121, 137, 42], itemStyle: { color: "#4de1d4", borderRadius: [5, 5, 0, 0] } }] },
  预算效率: { grid: { top: 18, right: 14, bottom: 25, left: 10, containLabel: true }, tooltip, xAxis: { ...axis, type: "category", data: ["迎新分享会", "技能工作坊", "社团开放日"] }, yAxis: { ...yAxis, name: "元/签到", nameTextStyle: { color: "#7890a4", fontSize: 10 } }, series: [{ name: "每位签到成本", type: "bar", data: [22, 25, 31], barWidth: "42%", itemStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#ffbd83" }, { offset: 1, color: "#a995ff" }] }, borderRadius: [7, 7, 0, 0] }, label: { show: true, position: "top", color: "#c7d8e5", fontSize: 10 } }] },
  满意度分布: { grid: { top: 18, right: 14, bottom: 25, left: 10, containLabel: true }, tooltip, xAxis: { ...axis, type: "category", data: ["迎新分享会", "技能工作坊", "社团开放日"] }, yAxis: { ...yAxis, min: 0, max: 5 }, series: [{ name: "满意度", type: "bar", data: [4.7, 4.35, 3.5], barWidth: "42%", itemStyle: { color: "#71dfd0", borderRadius: [7, 7, 0, 0] }, label: { show: true, position: "top", color: "#c7d8e5", fontSize: 10 } }] },
};

export default function ActivityChart({ chartType = "趋势面积图", onReady }: ActivityChartProps) {
  const [locale] = useAppLocale();
  const labels: Record<string, string> = { "签到人数": "Check-ins", "报名": "Registrations", "签到": "Check-ins", "迎新分享会": "Welcome meetup", "技能工作坊": "Skills workshop", "社团开放日": "Club open day", "元/签到": "CNY / check-in", "每位签到成本": "Cost per check-in", "满意度": "Satisfaction" };
  const source = options[chartType] ?? options["趋势面积图"];
  const option = locale === "en" ? JSON.parse(JSON.stringify(source, (_key, value: unknown) => typeof value === "string" ? labels[value] ?? value : value)) : source;
  return <ReactECharts option={option} onChartReady={onReady} style={{ width: "100%", height: "100%" }} opts={{ renderer: "canvas" }} notMerge lazyUpdate />;
}
