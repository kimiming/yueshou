"use client";

import { useEffect, useMemo, useRef } from "react";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { init, use, type EChartsCoreOption } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { BarChartOutlined, CalendarOutlined, ChromeOutlined, ClockCircleOutlined, DesktopOutlined, EyeOutlined, GlobalOutlined, MobileOutlined } from "@ant-design/icons";

import type { TrafficDashboardData } from "@/features/analytics/dashboard";

use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

function Chart({ option, label }: { option: EChartsCoreOption; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = init(ref.current, undefined, { renderer: "svg" });
    chart.setOption(option);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [option]);
  return <div ref={ref} className="traffic-chart" role="img" aria-label={label} />;
}

const colors = ["#1677ff", "#13c2c2", "#52c41a", "#faad14", "#722ed1", "#eb2f96"];

export function TrafficDashboard({ data }: { data: TrafficDashboardData }) {
  const displayNames = useMemo(() => new Intl.DisplayNames(["zh-CN"], { type: "region" }), []);
  const countries = data.countries.map((item) => ({ ...item, name: /^[A-Z]{2}$/.test(item.name) ? displayNames.of(item.name) ?? item.name : "未知地区" }));
  const baseText = { color: "#526277", fontFamily: "inherit" };
  const trendOption: EChartsCoreOption = { color: colors, tooltip: { trigger: "axis" }, grid: { left: 42, right: 18, top: 28, bottom: 34 }, xAxis: { type: "category", boundaryGap: false, data: data.trend.map((item) => item.date.slice(5)), axisLabel: baseText }, yAxis: { type: "value", minInterval: 1, axisLabel: baseText, splitLine: { lineStyle: { color: "#edf1f6" } } }, series: [{ name: "浏览量", type: "line", smooth: true, symbol: "none", areaStyle: { opacity: 0.12 }, data: data.trend.map((item) => item.views) }] };
  const countryOption: EChartsCoreOption = { color: colors, tooltip: { trigger: "axis" }, grid: { left: 90, right: 24, top: 16, bottom: 28 }, xAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { color: "#edf1f6" } } }, yAxis: { type: "category", inverse: true, data: countries.map((item) => item.name), axisLabel: baseText }, series: [{ type: "bar", data: countries.map((item) => item.value), barMaxWidth: 18, itemStyle: { borderRadius: [0, 6, 6, 0] } }] };
  const pie = (items: Array<{ name: string; value: number }>): EChartsCoreOption => ({ color: colors, tooltip: { trigger: "item" }, legend: { bottom: 0, textStyle: baseText }, series: [{ type: "pie", radius: ["48%", "72%"], center: ["50%", "43%"], label: { formatter: "{b}\n{d}%" }, data: items }] });
  const cards = [
    { label: "今日浏览", value: data.stats.today, icon: <EyeOutlined />, tone: "blue" },
    { label: "近 7 天", value: data.stats.week, icon: <CalendarOutlined />, tone: "cyan" },
    { label: "近 30 天", value: data.stats.month, icon: <BarChartOutlined />, tone: "violet" },
    { label: "累计浏览", value: data.stats.total, icon: <GlobalOutlined />, tone: "green" },
  ];
  return <div className="traffic-dashboard">
    <div className="traffic-dashboard__heading"><div><p>TRAFFIC OVERVIEW</p><h1>网站流量仪表盘</h1><span>匿名统计已获分析同意的页面浏览，不保存访客 IP。</span></div><div className="traffic-dashboard__live"><i />实时监控中</div></div>
    <section className="traffic-stats" aria-label="浏览量概览">{cards.map((card) => <article className={`traffic-stat traffic-stat--${card.tone}`} key={card.label}><div className="traffic-stat__icon">{card.icon}</div><div><span>{card.label}</span><strong>{card.value.toLocaleString()}</strong></div></article>)}</section>
    <section className="traffic-grid traffic-grid--wide"><article className="traffic-panel traffic-panel--trend"><header><div><BarChartOutlined /><span>30 天浏览趋势</span></div><small>按 UTC 日期统计</small></header><Chart option={trendOption} label="最近 30 天浏览量折线图" /></article><article className="traffic-panel"><header><div><GlobalOutlined /><span>国家与地区 Top 10</span></div></header><Chart option={countryOption} label="国家和地区浏览量条形图" /></article></section>
    <section className="traffic-grid"><article className="traffic-panel"><header><div><DesktopOutlined /><span>设备类型</span></div></header><Chart option={pie(data.devices)} label="设备类型浏览占比" /></article><article className="traffic-panel"><header><div><ChromeOutlined /><span>浏览器</span></div></header><Chart option={pie(data.browsers)} label="浏览器浏览占比" /></article><article className="traffic-panel traffic-panel--recent"><header><div><ClockCircleOutlined /><span>最近访问</span></div></header><div className="traffic-recent">{data.recent.length ? data.recent.map((item) => <div key={item.id}><span className="traffic-recent__device">{item.deviceType === "Mobile" ? <MobileOutlined /> : <DesktopOutlined />}</span><div><strong>{item.path}</strong><small>{item.countryCode ?? "未知地区"} · {item.browser} · {item.deviceType}</small></div><time>{new Date(item.viewedAt).toLocaleString("zh-CN", { hour12: false })}</time></div>) : <p className="traffic-empty">暂无已获同意的浏览数据</p>}</div></article></section>
  </div>;
}
