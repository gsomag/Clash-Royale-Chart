export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  wins: number;
  losses: number;
}

export interface Status {
  lastSyncUnix: number | null;
  totalBattles: number;
}

export interface SyncResult {
  fetched: number;
  added: number;
  totalBattles: number;
  lastSyncUnix: number | null;
}

export type Interval = "15m" | "30m" | "1h" | "4h" | "12h" | "1d" | "1w";
