import type { Candle, Status, SyncResult, Interval } from "./types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok || (body as { ok?: boolean }).ok === false) {
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchCandles(interval: Interval): Promise<Candle[]> {
  const res = await fetch(`/api/candles?interval=${interval}`);
  const body = await jsonOrThrow<{ candles: Candle[] }>(res);
  return body.candles;
}

export async function fetchStatus(): Promise<Status> {
  const res = await fetch(`/api/status`);
  return jsonOrThrow<Status>(res);
}

export async function sync(): Promise<SyncResult> {
  const res = await fetch(`/api/sync`, { method: "POST" });
  return jsonOrThrow<SyncResult>(res);
}
