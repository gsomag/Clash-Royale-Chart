import { createClient, type Client, type InValue } from "@libsql/client";
import { mkdirSync } from "node:fs";

// Local dev defaults to an on-disk SQLite file; production uses Turso via env.
const url = process.env.TURSO_DATABASE_URL || "file:data/battles.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

if (url.startsWith("file:")) {
  const path = url.slice("file:".length);
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore */
  }
}

export const db: Client = createClient(authToken ? { url, authToken } : { url });

let schemaReady: Promise<void> | null = null;

/** Create tables once per process (idempotent). */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.batch(
        [
          `CREATE TABLE IF NOT EXISTS battles (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            battle_time_raw   TEXT NOT NULL,
            battle_time_unix  INTEGER NOT NULL,
            type              TEXT,
            game_mode         TEXT,
            starting_trophies INTEGER,
            trophy_change     INTEGER,
            ending_trophies   INTEGER,
            crowns            INTEGER,
            opponent_crowns   INTEGER,
            result            TEXT,
            opponent_tag      TEXT,
            opponent_name     TEXT,
            UNIQUE(battle_time_raw, opponent_tag)
          )`,
          `CREATE INDEX IF NOT EXISTS idx_battles_unix ON battles(battle_time_unix)`,
          `CREATE TABLE IF NOT EXISTS sync_meta (
            id              INTEGER PRIMARY KEY CHECK (id = 1),
            last_sync_unix  INTEGER,
            total_battles   INTEGER DEFAULT 0
          )`,
          `INSERT OR IGNORE INTO sync_meta (id, last_sync_unix, total_battles) VALUES (1, NULL, 0)`,
        ],
        "write"
      );
    })();
  }
  return schemaReady;
}

export interface BattleRow {
  battle_time_raw: string;
  battle_time_unix: number;
  type: string | null;
  game_mode: string | null;
  starting_trophies: number | null;
  trophy_change: number | null;
  ending_trophies: number | null;
  crowns: number | null;
  opponent_crowns: number | null;
  result: string | null;
  opponent_tag: string | null;
  opponent_name: string | null;
}

/** Insert a batch of battles, returning the number of newly added rows. */
export async function insertBattles(rows: BattleRow[]): Promise<number> {
  await ensureSchema();
  if (!rows.length) return 0;
  const stmts = rows.map((r) => ({
    sql: `INSERT OR IGNORE INTO battles (
      battle_time_raw, battle_time_unix, type, game_mode,
      starting_trophies, trophy_change, ending_trophies,
      crowns, opponent_crowns, result, opponent_tag, opponent_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      r.battle_time_raw,
      r.battle_time_unix,
      r.type,
      r.game_mode,
      r.starting_trophies,
      r.trophy_change,
      r.ending_trophies,
      r.crowns,
      r.opponent_crowns,
      r.result,
      r.opponent_tag,
      r.opponent_name,
    ] as InValue[],
  }));
  const results = await db.batch(stmts, "write");
  return results.reduce((sum, r) => sum + (r.rowsAffected || 0), 0);
}

async function countBattles(): Promise<number> {
  const r = await db.execute(`SELECT COUNT(*) AS c FROM battles`);
  return Number(r.rows[0].c);
}

export async function recordSync(unix: number): Promise<void> {
  const total = await countBattles();
  await db.execute({
    sql: `UPDATE sync_meta SET last_sync_unix = ?, total_battles = ? WHERE id = 1`,
    args: [unix, total],
  });
}

export async function getStatus(): Promise<{
  lastSyncUnix: number | null;
  totalBattles: number;
}> {
  await ensureSchema();
  const r = await db.execute(`SELECT last_sync_unix, total_battles FROM sync_meta WHERE id = 1`);
  const row = r.rows[0];
  return {
    lastSyncUnix: row?.last_sync_unix == null ? null : Number(row.last_sync_unix),
    totalBattles: row ? Number(row.total_battles) : 0,
  };
}

/** Battles bearing trophy data (ladder / Trophy Road), ascending by time. */
export async function getTrophyBattles(): Promise<
  Array<{ unix: number; starting: number; ending: number; result: string | null }>
> {
  await ensureSchema();
  const r = await db.execute(
    `SELECT battle_time_unix AS unix, starting_trophies AS starting,
            ending_trophies AS ending, result
     FROM battles
     WHERE type = 'PvP' AND ending_trophies IS NOT NULL AND starting_trophies IS NOT NULL
     ORDER BY battle_time_unix ASC`
  );
  return r.rows.map((row) => ({
    unix: Number(row.unix),
    starting: Number(row.starting),
    ending: Number(row.ending),
    result: (row.result as string | null) ?? null,
  }));
}
