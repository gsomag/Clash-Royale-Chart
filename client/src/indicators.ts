import type { Candle } from "./types";

export type IndicatorType = "sma" | "ema";

export interface IndicatorDef {
  id: string; // stable key, e.g. "sma-7"
  type: IndicatorType;
  period: number;
  label: string; // e.g. "MA7"
  color: string;
}

/**
 * Toggleable indicator presets. Add more entries here to expose new lines
 * in the toolbar — the chart renders any active preset automatically.
 */
export const INDICATOR_PRESETS: IndicatorDef[] = [
  { id: "sma-7", type: "sma", period: 7, label: "MA7", color: "#f0b90b" },
  { id: "sma-25", type: "sma", period: 25, label: "MA25", color: "#e040fb" },
  { id: "sma-99", type: "sma", period: 99, label: "MA99", color: "#29b6f6" },
  { id: "ema-12", type: "ema", period: 12, label: "EMA12", color: "#26a69a" },
];

export interface LinePoint {
  time: number;
  value: number;
}

/** Compute an indicator line over candle closes. Returns points aligned to candle time. */
export function computeIndicator(candles: Candle[], def: IndicatorDef): LinePoint[] {
  const closes = candles.map((c) => c.close);
  const n = closes.length;
  const p = def.period;
  if (n < p) return [];
  const out: LinePoint[] = [];

  if (def.type === "sma") {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += closes[i];
      if (i >= p) sum -= closes[i - p];
      if (i >= p - 1) out.push({ time: candles[i].time, value: sum / p });
    }
  } else {
    // EMA seeded with the SMA of the first `p` closes
    const k = 2 / (p + 1);
    let ema = 0;
    for (let i = 0; i < p; i++) ema += closes[i];
    ema /= p;
    out.push({ time: candles[p - 1].time, value: ema });
    for (let i = p; i < n; i++) {
      ema = closes[i] * k + ema * (1 - k);
      out.push({ time: candles[i].time, value: ema });
    }
  }
  return out;
}
