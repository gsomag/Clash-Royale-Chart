import type { BattleRow } from "./db.js";

/**
 * Parse Clash Royale's battleTime format `YYYYMMDDThhmmss.SSSZ`
 * (e.g. `20240628T153045.000Z`) into unix seconds (UTC).
 */
export function parseBattleTime(raw: string): number {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, s] = m;
  return Math.floor(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) / 1000);
}

interface ApiPlayer {
  tag?: string;
  name?: string;
  startingTrophies?: number;
  trophyChange?: number;
  crowns?: number;
}

interface ApiBattle {
  type?: string;
  battleTime?: string;
  gameMode?: { name?: string };
  team?: ApiPlayer[];
  opponent?: ApiPlayer[];
}

function resultOf(crowns: number | null, oppCrowns: number | null): string | null {
  if (crowns == null || oppCrowns == null) return null;
  if (crowns > oppCrowns) return "win";
  if (crowns < oppCrowns) return "loss";
  return "draw";
}

/** Map a raw API battle into a DB row (or null if it lacks a timestamp). */
function mapBattle(b: ApiBattle): BattleRow | null {
  if (!b.battleTime) return null;
  const me = b.team?.[0];
  const opp = b.opponent?.[0];
  const starting = me?.startingTrophies ?? null;
  const change = me?.trophyChange ?? null;
  const ending = starting != null && change != null ? starting + change : null;
  const crowns = me?.crowns ?? null;
  const oppCrowns = opp?.crowns ?? null;

  return {
    battle_time_raw: b.battleTime,
    battle_time_unix: parseBattleTime(b.battleTime),
    type: b.type ?? null,
    game_mode: b.gameMode?.name ?? null,
    starting_trophies: starting,
    trophy_change: change,
    ending_trophies: ending,
    crowns,
    opponent_crowns: oppCrowns,
    result: resultOf(crowns, oppCrowns),
    opponent_tag: opp?.tag ?? null,
    opponent_name: opp?.name ?? null,
  };
}

export class ClashApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Fetch the latest (~25) battles for the configured player. */
export async function fetchBattleLog(): Promise<BattleRow[]> {
  const token = process.env.CR_API_TOKEN;
  const tag = process.env.PLAYER_TAG;
  const base = process.env.CR_API_BASE || "https://proxy.royaleapi.dev/v1";

  if (!token) {
    throw new ClashApiError(500, "CR_API_TOKEN が未設定です。環境変数を確認してください。");
  }
  if (!tag) {
    throw new ClashApiError(500, "PLAYER_TAG が未設定です。環境変数を確認してください。");
  }

  const url = `${base}/players/${encodeURIComponent(tag)}/battlelog`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    throw new ClashApiError(502, `API への接続に失敗しました: ${(e as Error).message}`);
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { reason?: string; message?: string };
      detail = body.message || body.reason || "";
    } catch {
      /* ignore */
    }
    if (res.status === 403) {
      detail ||=
        "トークンが無効、またはIP制限に一致しません。RoyaleAPI プロキシ(45.79.218.79)に紐づくトークンか確認してください。";
    }
    throw new ClashApiError(res.status, `API エラー (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as ApiBattle[];
  return data.map(mapBattle).filter((b): b is BattleRow => b !== null);
}
