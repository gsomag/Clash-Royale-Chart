import { useEffect, useRef } from "react";
import {
  createChart,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "../types";
import { computeIndicator, type IndicatorDef } from "../indicators";

interface Props {
  candles: Candle[];
  showLine: boolean;
  indicators: IndicatorDef[];
}

interface LegendInfo {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  wins: number;
  losses: number;
}

function fmtDate(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Chart({ candles, showLine, indicators }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const indicatorRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const dataRef = useRef<Map<number, Candle>>(new Map());

  // create chart once
  useEffect(() => {
    const el = containerRef.current!;
    const chart = createChart(el, {
      layout: {
        background: { color: "#0d1117" },
        textColor: "#c9d1d9",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      grid: {
        vertLines: { color: "#1b2027" },
        horzLines: { color: "#1b2027" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#21262d" },
      timeScale: { borderColor: "#21262d", timeVisible: true, secondsVisible: false },
      autoSize: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      priceLineVisible: false,
    });

    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: "#3a4250",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const lineSeries = chart.addLineSeries({
      color: "#9aa4b2",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volRef.current = volSeries;
    lineRef.current = lineSeries;

    chart.subscribeCrosshairMove((param) => {
      const legend = legendRef.current;
      if (!legend) return;
      const t = param.time as number | undefined;
      const c = t != null ? dataRef.current.get(t) : undefined;
      if (!c) {
        legend.style.display = "none";
        return;
      }
      legend.style.display = "block";
      renderLegend(legend, c, indicatorRef.current.size > 0);
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      indicatorRef.current = new Map();
    };
  }, []);

  // update candle / volume / close-line data
  useEffect(() => {
    if (!candleRef.current || !volRef.current || !lineRef.current) return;
    const map = new Map<number, Candle>();
    for (const c of candles) map.set(c.time, c);
    dataRef.current = map;

    candleRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    volRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.wins >= c.losses ? "rgba(38,166,154,0.5)" : "rgba(239,83,80,0.5)",
      }))
    );
    lineRef.current.setData(
      candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close }))
    );
    if (candles.length) chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // toggle close line
  useEffect(() => {
    lineRef.current?.applyOptions({ visible: showLine });
  }, [showLine]);

  // reconcile indicator line series (add / update / remove)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const map = indicatorRef.current;
    const active = new Set(indicators.map((d) => d.id));

    // remove indicators that are no longer active
    for (const [id, series] of map) {
      if (!active.has(id)) {
        chart.removeSeries(series);
        map.delete(id);
      }
    }

    // add / update active indicators
    for (const def of indicators) {
      let series = map.get(def.id);
      if (!series) {
        series = chart.addLineSeries({
          color: def.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        map.set(def.id, series);
      } else {
        series.applyOptions({ color: def.color });
      }
      series.setData(
        computeIndicator(candles, def).map((p) => ({
          time: p.time as UTCTimestamp,
          value: p.value,
        }))
      );
    }
  }, [indicators, candles]);

  return (
    <div className="chart-wrap">
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <div ref={legendRef} className="legend" style={{ display: "none" }} />
      {candles.length === 0 && (
        <div className="empty">
          データがありません。右上の「同期」を押して戦績を取得してください。
          <br />
          （公式APIは直近25戦のみ。同期を重ねるほど履歴が貯まります）
        </div>
      )}
    </div>
  );
}

function renderLegend(el: HTMLDivElement, c: LegendInfo, _hasIndicators: boolean) {
  const sign = c.close >= c.open ? "+" : "";
  const diff = c.close - c.open;
  const total = c.wins + c.losses;
  const wr = total ? Math.round((c.wins / total) * 100) : 0;
  el.innerHTML = `
    <div>${fmtDate(c.time)}</div>
    <div><span class="o">始</span> ${c.open} <span class="o">高</span> ${c.high}
      <span class="o">安</span> ${c.low} <span class="o">終</span> ${c.close}
      <span style="color:${diff >= 0 ? "#26a69a" : "#ef5350"}">(${sign}${diff})</span></div>
    <div><span class="o">戦闘</span> ${c.volume} <span class="o">勝率</span> ${wr}%
      <span style="color:#26a69a">${c.wins}W</span>/<span style="color:#ef5350">${c.losses}L</span></div>
  `;
}
