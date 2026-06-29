import { useCallback, useEffect, useRef, useState } from "react";
import { Toolbar } from "./components/Toolbar";
import { Chart } from "./components/Chart";
import { fetchCandles, fetchStatus, sync as syncApi } from "./api";
import type { Candle, Interval } from "./types";
import { INDICATOR_PRESETS } from "./indicators";

const LS_INTERVAL = "cr.interval";
const LS_POLL = "cr.pollSec";
const LS_LINE = "cr.showLine";
const LS_INDICATORS = "cr.indicators";

export function App() {
  const [interval, setInterval_] = useState<Interval>(
    () => (localStorage.getItem(LS_INTERVAL) as Interval) || "1d"
  );
  const [pollSec, setPollSec] = useState<number>(
    () => Number(localStorage.getItem(LS_POLL)) || 0
  );
  const [showLine, setShowLine] = useState<boolean>(
    () => localStorage.getItem(LS_LINE) === "1"
  );
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(LS_INDICATORS) || "[]"));
    } catch {
      return new Set();
    }
  });
  const [candles, setCandles] = useState<Candle[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncUnix, setLastSyncUnix] = useState<number | null>(null);
  const [totalBattles, setTotalBattles] = useState(0);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadCandles = useCallback(async (iv: Interval) => {
    try {
      setCandles(await fetchCandles(iv));
    } catch (e) {
      showToast((e as Error).message, true);
    }
  }, [showToast]);

  const doSync = useCallback(async () => {
    setSyncing(true);
    try {
      const r = await syncApi();
      setLastSyncUnix(r.lastSyncUnix);
      setTotalBattles(r.totalBattles);
      await loadCandles(interval);
      showToast(`取得 ${r.fetched} 件 / 新規 ${r.added} 件 ・ 累計 ${r.totalBattles} 戦`);
    } catch (e) {
      showToast((e as Error).message, true);
    } finally {
      setSyncing(false);
    }
  }, [interval, loadCandles, showToast]);

  // initial load
  useEffect(() => {
    fetchStatus()
      .then((s) => {
        setLastSyncUnix(s.lastSyncUnix);
        setTotalBattles(s.totalBattles);
      })
      .catch(() => {});
    loadCandles(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload candles on interval change + persist
  useEffect(() => {
    localStorage.setItem(LS_INTERVAL, interval);
    loadCandles(interval);
  }, [interval, loadCandles]);

  useEffect(() => {
    localStorage.setItem(LS_POLL, String(pollSec));
  }, [pollSec]);

  useEffect(() => {
    localStorage.setItem(LS_LINE, showLine ? "1" : "0");
  }, [showLine]);

  useEffect(() => {
    localStorage.setItem(LS_INDICATORS, JSON.stringify([...activeIndicators]));
  }, [activeIndicators]);

  const toggleIndicator = useCallback((id: string) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const indicatorDefs = INDICATOR_PRESETS.filter((d) => activeIndicators.has(d.id));

  // auto-poll
  useEffect(() => {
    if (pollSec <= 0) return;
    const id = window.setInterval(() => {
      if (!syncing) doSync();
    }, pollSec * 1000);
    return () => window.clearInterval(id);
  }, [pollSec, syncing, doSync]);

  return (
    <div className="app">
      <Toolbar
        interval={interval}
        onInterval={setInterval_}
        onSync={doSync}
        syncing={syncing}
        pollSec={pollSec}
        onPoll={setPollSec}
        showLine={showLine}
        onToggleLine={setShowLine}
        activeIndicators={activeIndicators}
        onToggleIndicator={toggleIndicator}
        lastSyncUnix={lastSyncUnix}
        totalBattles={totalBattles}
      />
      <Chart candles={candles} showLine={showLine} indicators={indicatorDefs} />
      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{toast.msg}</div>}
    </div>
  );
}
