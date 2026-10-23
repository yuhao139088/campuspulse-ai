"use client";
import dynamic from "next/dynamic";
import { RoundedSelect } from "@/components/rounded-select";
import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BarChart3, ChartLine, ChartPie, Check, Plus, Sparkles } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { chartData, chartMatchesColumns, chartSignature, chartsForDataset, importChartRecommendations, normalizeCanvasCharts, normalizeChartRecommendations, type CanvasChart, type ChartRecommendation } from "@/lib/charts";
import { Dataset, DatasetSelect, useResource, request, useText, Notice } from "./shared";

const Chart = dynamic(() => import("echarts-for-react"), { ssr: false });
type Config = { components: string[]; chartType: string; datasetId: string; charts?: unknown };
type Advice = { datasetId: string; answer: string; chartRecommendations: ChartRecommendation[] };
const chartIcons = { bar: BarChart3, line: ChartLine, pie: ChartPie };

export default function ProductionCanvas() {
  const { text, locale } = useText();
  const datasets = useResource<{ datasets: Dataset[] }>("/api/datasets");
  const [datasetId, setDatasetId] = useState("");
  const detail = useResource<{ dataset: Dataset }>(datasetId ? "/api/datasets/" + datasetId : "");
  const [charts, setCharts] = useState<CanvasChart[]>([]);
  const [active, setActive] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [metric, setMetric] = useState("");
  const [type, setType] = useState<CanvasChart["type"]>("bar");
  const [aggregation, setAggregation] = useState<CanvasChart["aggregation"]>("sum");
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [notice, setNotice] = useState("");
  const [advice, setAdvice] = useState<Advice | null>(null);
  const currentDataset = useRef("");
  const saveVersion = useRef(0);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const chartRef = useRef<{ getDataURL: (options: Record<string, unknown>) => string } | null>(null);

  useEffect(() => {
    request<{ config: Config | null }>("/api/canvas").then(({ config }) => {
      const fromUrl = new URLSearchParams(window.location.search).get("dataset");
      const initialDataset = fromUrl || config?.datasetId || "";
      const stored = normalizeCanvasCharts(config?.charts, initialDataset);
      const scoped = chartsForDataset(stored, initialDataset);
      currentDataset.current = initialDataset;
      setDatasetId(initialDataset);
      setCharts(stored);
      setActive((scoped.find((chart) => chart.id === config?.chartType) ?? scoped[0])?.id ?? "");
      setLoaded(true);
    }).catch((problem) => setFailure(String(problem)));
  }, []);

  const datasetList = datasets.data?.datasets;
  const detailData = detail.data;
  const datasetDocument = detailData?.dataset.id === datasetId
    ? detailData.dataset.evidence?.find((item) => item.kind === "TABLE" || item.kind === "OCR")?.content
    : undefined;
  const columns = datasetDocument?.columns ?? [];
  const rows = datasetDocument?.rows ?? [];
  const numericColumns = datasetDocument?.profile?.numericColumns ?? columns.filter((column) =>
    rows.length > 0 && rows.filter((row) => {
      const value = row[column];
      return value !== null && value !== undefined && String(value).trim() !== "" && Number.isFinite(Number(value));
    }).length / rows.length >= 0.7
  );
  const scopedCharts = charts.filter((chart) => chart.datasetId === datasetId && (!datasetList?.length || datasetList.some((item) => item.id === chart.datasetId)));
  const visibleCharts = columns.length ? scopedCharts.filter((chart) => chartMatchesColumns(chart, columns)) : scopedCharts;
  const selected = visibleCharts.find((item) => item.id === active) ?? visibleCharts[0];
  const activeId = selected?.id ?? "";

  useEffect(() => {
    if (!loaded) return;
    const version = ++saveVersion.current;
    const timer = window.setTimeout(() => {
      setSaving(true);
      saveQueue.current = saveQueue.current.catch(() => undefined).then(() =>
        request("/api/canvas", "PUT", { components: charts.map((item) => item.id), chartType: activeId, datasetId, charts })
      ).then(() => {
        if (version === saveVersion.current) setNotice(locale === "zh" ? "已保存到云端" : "Saved to database");
      }).catch((problem) => {
        if (version === saveVersion.current) setFailure(String(problem));
      }).finally(() => {
        if (version === saveVersion.current) setSaving(false);
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [charts, activeId, datasetId, loaded, locale]);
  const { labels, values } = selected ? chartData(rows, selected) : { labels: [], values: [] };
  const option = {
    tooltip: { trigger: selected?.type === "pie" ? "item" : "axis", confine: true },
    grid: { left: 50, right: 20, bottom: 70, top: 25 },
    xAxis: selected?.type === "pie" ? undefined : { type: "category", data: labels, axisLabel: { color: "#9ab0c1", rotate: 20 } },
    yAxis: selected?.type === "pie" ? undefined : { type: "value", axisLabel: { color: "#9ab0c1" } },
    series: [{ type: selected?.type ?? "bar", data: selected?.type === "pie" ? labels.map((name, index) => ({ name, value: values[index] })) : values, itemStyle: selected?.type === "pie" ? undefined : { color: "#4de1d4" }, smooth: true }],
    color: ["#4de1d4", "#a995ff", "#6aa3ff", "#f5bd74", "#f483a2"],
    textStyle: { color: "#9ab0c1" },
  };
  const chartLabels = { bar: text("柱状图", "Bar chart"), line: text("折线图", "Line chart"), pie: text("饼图", "Pie chart") };
  const aggregationLabels = { sum: text("求和", "Sum"), average: text("平均值", "Average"), count: text("记录计数", "Row count") };
  const signatures = new Set(visibleCharts.map(chartSignature));
  const suggestions = advice?.datasetId === datasetId ? advice.chartRecommendations : [];
  const remainingSuggestions = suggestions.filter((chart) => !signatures.has(chartSignature(chart)));

  function chooseDataset(value: string) {
    currentDataset.current = value;
    setDatasetId(value);
    setActive("");
    setAdvice(null);
    setCategory("");
    setMetric("");
    setNotice("");
    setFailure("");
  }

  async function recommend() {
    if (recommending || !loaded || !datasetId || !columns.length) return;
    const requestedDataset = datasetId;
    setRecommending(true);
    setFailure("");
    try {
      const result = await request<Advice>("/api/ai/analyze", "POST", {
        datasetId, locale, purpose: "chart_recommendations",
        prompt: text("推荐2到4个适合当前数据集的图表，返回可以直接导入的配置，并以简洁Markdown说明用途与限制。", "Recommend 2 to 4 charts for this dataset with importable configurations and concise Markdown explaining their use and limitations."),
      });
      if (currentDataset.current !== requestedDataset) return;
      if (result.datasetId !== requestedDataset) throw new Error(text("推荐数据集不匹配，请重新生成", "Recommendation dataset does not match; please retry"));
      const valid = normalizeChartRecommendations(result.chartRecommendations, columns, numericColumns);
      if (!valid.length) throw new Error(text("AI未返回可导入的图表，请重试", "AI returned no importable charts; please retry"));
      setAdvice({ ...result, chartRecommendations: valid });
    } catch (problem) {
      if (currentDataset.current === requestedDataset) setFailure(String(problem));
    } finally {
      setRecommending(false);
    }
  }

  function importSuggestions(recommendations: ChartRecommendation[]) {
    if (advice?.datasetId !== currentDataset.current || !loaded) return;
    const valid = normalizeChartRecommendations(recommendations, columns, numericColumns);
    const result = importChartRecommendations(charts, valid, () => crypto.randomUUID(), currentDataset.current);
    if (!result.added.length) return;
    setFailure("");
    setNotice("");
    setSaving(true);
    setCharts(result.charts);
    setActive(result.added[0].id);
  }

  return <WorkspaceShell production active="/canvas" title="" subtitle="">
    <div className="canvas-toolbar">
      <div><h2 className="page-heading">{text("真实数据图表画布", "Your data chart canvas")}</h2><p className="page-muted" role="status">{saving ? text("正在保存…", "Saving…") : notice}</p></div>
      <button className="send-button" onClick={() => setShowAdd(!showAdd)} disabled={!loaded || !columns.length || charts.length >= 30}>{text("添加图表", "Add chart")}</button>
    </div>
    <DatasetSelect datasets={datasets.data?.datasets ?? []} value={datasetId} onChange={chooseDataset} />
    <Notice error={failure || detail.error || datasets.error} />
    {showAdd && <section className="panel panel-pad chart-form">
      <label>{text("标题", "Title")}<input className="auth-input" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label>{text("图表类型", "Chart type")}<RoundedSelect className="auth-input" value={type} onChange={(event) => setType(event.target.value as CanvasChart["type"])}>{Object.entries(chartLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</RoundedSelect></label>
      <label>{text("分类字段", "Category")}<RoundedSelect className="auth-input" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">{text("选择字段", "Select column")}</option>{columns.map((item) => <option key={item}>{item}</option>)}</RoundedSelect></label>
      <label>{text("数值字段", "Metric")}<RoundedSelect className="auth-input" disabled={aggregation === "count"} value={metric} onChange={(event) => setMetric(event.target.value)}><option value="">{text("选择字段", "Select column")}</option>{numericColumns.map((item) => <option key={item}>{item}</option>)}</RoundedSelect></label>
      <label>{text("汇总方式", "Aggregation")}<RoundedSelect className="auth-input" value={aggregation} onChange={(event) => setAggregation(event.target.value as CanvasChart["aggregation"])}>{Object.entries(aggregationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</RoundedSelect></label>
      <button className="send-button" disabled={!columns.includes(category) || (aggregation !== "count" && !numericColumns.includes(metric)) || charts.length >= 30} onClick={() => {
        const id = crypto.randomUUID();
        setCharts((current) => [...current, { id, title: title.trim() || category, type, category, metric: aggregation === "count" ? "" : metric, aggregation, datasetId }]);
        setActive(id); setShowAdd(false); setNotice(""); setFailure(""); setSaving(true);
      }}>{text("创建图表", "Create chart")}</button>
    </section>}
    <div className="canvas-layout production-canvas">
      <aside className="panel panel-pad canvas-sidebar">
        <h3>{text("图表", "Charts")}</h3>
        {!visibleCharts.length && <p className="page-muted">{datasetId ? text("当前数据集还没有图表，可以手动添加或导入AI推荐。", "No charts for this dataset yet. Create one or import an AI recommendation.") : text("先选择数据集，图表按数据集分别保存。", "Select a dataset first; charts are stored per dataset.")}</p>}
        {visibleCharts.map((chart) => <div className="canvas-item-row" key={chart.id}>
          <button className={"canvas-item " + (activeId === chart.id ? "active" : "")} onClick={() => setActive(chart.id)}>{chart.title}</button>
          <button className="canvas-delete" aria-label={text("删除图表 ", "Delete chart ") + chart.title} onClick={() => {
            const next = charts.filter((item) => item.id !== chart.id); setCharts(next);
            if (active === chart.id) setActive("");
            setNotice(""); setSaving(true);
          }}>×</button>
        </div>)}
        <div className="chart-recommendations">
          <div className="chart-recommendations-heading"><Sparkles size={16} /><h4>{text("AI 图表推荐", "AI chart recommendations")}</h4></div>
          <p className="page-muted">{text("根据当前数据推荐，点击即可加入画布。", "Recommendations for your data, ready to add to the canvas.")}</p>
          <button className="language-button" disabled={!loaded || !columns.length || recommending} onClick={() => void recommend()}>{recommending ? text("正在推荐…", "Recommending…") : text("AI 图表建议", "AI chart advice")}</button>
          {recommending && <p className="page-muted" role="status">{text("正在检查字段并生成可导入的配置…", "Checking fields and preparing chart configurations…")}</p>}
          {suggestions.length > 0 && <>
            <button className="send-button chart-import-all" disabled={!remainingSuggestions.length || charts.length >= 30} onClick={() => importSuggestions(remainingSuggestions)}>{remainingSuggestions.length ? text("全部加入画布", "Add all to canvas") : text("已全部加入", "All added")}</button>
            <div className="chart-recommendation-list">{suggestions.map((suggestion) => {
              const imported = signatures.has(chartSignature(suggestion));
              const Icon = chartIcons[suggestion.type];
              return <article className="chart-recommendation-card" key={chartSignature(suggestion)}>
                <span className="chart-type-label"><Icon size={15} />{chartLabels[suggestion.type]}</span>
                <h4>{suggestion.title}</h4>
                <p className="chart-recommendation-reason">{suggestion.reason}</p>
                <dl><dt>{text("分类", "Category")}</dt><dd>{suggestion.category}</dd><dt>{text("指标", "Metric")}</dt><dd>{suggestion.metric || text("记录数", "Records")}</dd><dt>{text("汇总", "Aggregate")}</dt><dd>{aggregationLabels[suggestion.aggregation]}</dd></dl>
                <button className="language-button" disabled={imported || charts.length >= 30} aria-label={(imported ? text("已加入：", "Added: ") : text("加入画布：", "Add to canvas: ")) + suggestion.title} onClick={() => importSuggestions([suggestion])}>{imported ? <Check size={14} /> : <Plus size={14} />}{imported ? text("已加入", "Added") : text("加入画布", "Add to canvas")}</button>
              </article>;
            })}</div>
            <a className="chart-advice-link" href="#chart-advice-details">{text("查看完整推荐说明", "Read recommendation details")} ↓</a>
          </>}
          {charts.length >= 30 && <p className="page-muted">{text("画布最多30个图表，请先删除一个。", "The canvas holds 30 charts. Remove one to add more.")}</p>}
        </div>
      </aside>
      <section className="panel panel-pad canvas-board">
        <div className="board-header"><h3>{selected?.title ?? text("添加图表开始可视化", "Add a chart to visualize data")}</h3>{selected && <button className="language-button" onClick={() => {
          const url = chartRef.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#07111e" });
          if (url) { const anchor = document.createElement("a"); anchor.href = url; anchor.download = selected.title + ".png"; anchor.click(); }
        }}>{text("导出 PNG", "Export PNG")}</button>}</div>
        {selected ? <div className="board-chart"><Chart option={option} onChartReady={(chart) => { chartRef.current = chart; }} style={{ height: "100%", width: "100%" }} notMerge /></div> : <div className="report-empty">{datasetId ? text("当前数据集还没有图表，手动添加图表或导入AI推荐。", "No charts for this dataset yet. Create a chart or import an AI recommendation.") : text("选择数据集，手动添加图表或导入AI推荐。", "Select a dataset, then create a chart or import an AI recommendation.")}</div>}
        <div className="board-footer"><span>{rows.length} {text("源数据行", "source rows")}</span><span>{selected ? `${selected.category} · ${selected.metric || text("记录数", "Records")} · ${aggregationLabels[selected.aggregation]}` : ""}</span></div>
      </section>
    </div>
    {advice?.datasetId === datasetId && <section className="panel panel-pad chart-advice-details" id="chart-advice-details">
      <div className="chart-recommendations-heading"><Sparkles size={18} /><h3>{text("AI 推荐说明", "AI recommendation details")}</h3></div>
      <div className="prose-report chart-advice-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{advice.answer}</ReactMarkdown></div>
    </section>}
  </WorkspaceShell>;
}
