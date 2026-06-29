import { fetchBattleLog, ClashApiError } from "./clashApi.js";
import { insertBattles, recordSync, getStatus, ensureSchema } from "./db.js";
import { buildCandles, INTERVALS } from "./candles.js";

// Minimal request/response shapes shared by Vercel functions and Express.
export interface ApiReq {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
}
export interface ApiRes {
  status(code: number): ApiRes;
  json(body: unknown): void;
}

/** Pull latest battles, dedupe-insert, report counts. Used by manual button + daily cron. */
export async function syncHandler(req: ApiReq, res: ApiRes): Promise<void> {
  // If a CRON_SECRET is configured, cron invocations carry it; reject other GETs.
  const secret = process.env.CRON_SECRET;
  if (secret && req.method === "GET") {
    const auth = req.headers["authorization"];
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }
  }
  try {
    await ensureSchema();
    const rows = await fetchBattleLog();
    const added = await insertBattles(rows);
    const nowUnix = Math.floor(Date.now() / 1000);
    await recordSync(nowUnix);
    const status = await getStatus();
    res.status(200).json({
      ok: true,
      fetched: rows.length,
      added,
      totalBattles: status.totalBattles,
      lastSyncUnix: status.lastSyncUnix,
    });
  } catch (e) {
    const code = e instanceof ClashApiError ? e.status : 500;
    res.status(code).json({ ok: false, error: (e as Error).message });
  }
}

export async function candlesHandler(req: ApiReq, res: ApiRes): Promise<void> {
  const raw = req.query.interval;
  const interval = Array.isArray(raw) ? raw[0] : raw ?? "1d";
  if (!(interval in INTERVALS)) {
    res.status(400).json({ ok: false, error: `未対応の interval: ${interval}` });
    return;
  }
  try {
    const candles = await buildCandles(interval);
    res.status(200).json({ ok: true, interval, candles });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
}

export async function statusHandler(_req: ApiReq, res: ApiRes): Promise<void> {
  try {
    const status = await getStatus();
    res.status(200).json({ ok: true, ...status });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
}
