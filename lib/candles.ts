import { getTrophyBattles } from "./db.js";

export const INTERVALS: Record<string, number> = {
  "15m": 15 * 60,
  "30m": 30 * 60,
  "1h": 3600,
  "4h": 4 * 3600,
  "12h": 12 * 3600,
  "1d": 24 * 3600,
  "1w": 7 * 24 * 3600,
};

export interface Candle {
  time: number; // unix seconds, bucket start (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // battle count in bucket
  wins: number;
  losses: number;
}

/**
 * Aggregate the trophy time-series into OHLC candles by fixed time buckets.
 * "Price" = trophy level; open = first battle's starting trophies in the bucket
 * (which equals the previous candle's close -> continuous candles).
 */
export async function buildCandles(interval: string): Promise<Candle[]> {
  const sec = INTERVALS[interval] ?? INTERVALS["1d"];
  const battles = await getTrophyBattles();

  const buckets = new Map<number, Candle>();
  for (const b of battles) {
    if (!Number.isFinite(b.unix)) continue;
    const bucketStart = Math.floor(b.unix / sec) * sec;
    let c = buckets.get(bucketStart);
    if (!c) {
      c = {
        time: bucketStart,
        open: b.starting,
        high: b.starting,
        low: b.starting,
        close: b.ending,
        volume: 0,
        wins: 0,
        losses: 0,
      };
      buckets.set(bucketStart, c);
    }
    c.high = Math.max(c.high, b.starting, b.ending);
    c.low = Math.min(c.low, b.starting, b.ending);
    c.close = b.ending;
    c.volume += 1;
    if (b.result === "win") c.wins += 1;
    else if (b.result === "loss") c.losses += 1;
  }

  return [...buckets.values()].sort((a, b) => a.time - b.time);
}
