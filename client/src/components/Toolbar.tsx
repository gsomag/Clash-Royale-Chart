import type { Interval } from "../types";
import { INDICATOR_PRESETS } from "../indicators";

const INTERVALS: { key: Interval; label: string }[] = [
  { key: "15m", label: "15M" },
  { key: "30m", label: "30M" },
  { key: "1h", label: "1H" },
  { key: "4h", label: "4H" },
  { key: "12h", label: "12H" },
  { key: "1d", label: "1D" },
  { key: "1w", label: "1W" },
];

const POLL_OPTIONS = [
  { key: "0", label: "自動: オフ" },
  { key: "300", label: "自動: 5分" },
  { key: "900", label: "自動: 15分" },
  { key: "1800", label: "自動: 30分" },
];

interface Props {
  interval: Interval;
  onInterval: (i: Interval) => void;
  onSync: () => void;
  syncing: boolean;
  pollSec: number;
  onPoll: (sec: number) => void;
  showLine: boolean;
  onToggleLine: (v: boolean) => void;
  activeIndicators: Set<string>;
  onToggleIndicator: (id: string) => void;
  lastSyncUnix: number | null;
  totalBattles: number;
}

function fmtAgo(unix: number | null): string {
  if (!unix) return "未同期";
  return new Date(unix * 1000).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Toolbar(p: Props) {
  return (
    <div className="toolbar">
      <span className="title">🏆 クラロワ トロフィー</span>

      <div className="seg">
        {INTERVALS.map((i) => (
          <button
            key={i.key}
            className={p.interval === i.key ? "active" : ""}
            onClick={() => p.onInterval(i.key)}
          >
            {i.label}
          </button>
        ))}
      </div>

      <div className="seg indicators">
        {INDICATOR_PRESETS.map((d) => (
          <button
            key={d.id}
            className={p.activeIndicators.has(d.id) ? "active" : ""}
            style={
              p.activeIndicators.has(d.id)
                ? { background: d.color, color: "#0d1117", borderColor: d.color }
                : { color: d.color }
            }
            onClick={() => p.onToggleIndicator(d.id)}
            title={`${d.label} を表示/非表示`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <button
        className="btn ghost"
        onClick={() => p.onToggleLine(!p.showLine)}
        title="終値ライン表示の切替"
      >
        {p.showLine ? "ライン ON" : "ライン OFF"}
      </button>

      <span className="spacer" />

      <span className="meta">
        最終同期 {fmtAgo(p.lastSyncUnix)} ・ 累計 {p.totalBattles} 戦
      </span>

      <select
        className="poll"
        value={String(p.pollSec)}
        onChange={(e) => p.onPoll(Number(e.target.value))}
      >
        {POLL_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>

      <button className="btn" onClick={p.onSync} disabled={p.syncing}>
        {p.syncing ? "同期中…" : "同期"}
      </button>
    </div>
  );
}
