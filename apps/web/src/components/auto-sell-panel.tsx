import { useEffect, useState } from "react";
import type { AutoSellSettings, TradingStatus } from "@trade/shared";

interface AutoSellPanelProps {
  trading: TradingStatus;
  onSave: (settings: Partial<AutoSellSettings>) => Promise<void>;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
}

export function AutoSellPanel({
  trading,
  onSave,
  onRefresh,
  refreshing
}: AutoSellPanelProps) {
  const [enabled, setEnabled] = useState(trading.settings.enabled);
  const [targetProfitPercent, setTargetProfitPercent] = useState(trading.settings.targetProfitPercent);
  const [pollIntervalSeconds, setPollIntervalSeconds] = useState(
    Math.round(trading.settings.pollIntervalMs / 1000)
  );
  const [watchSymbols, setWatchSymbols] = useState(trading.settings.watchSymbols.join(", "));

  useEffect(() => {
    setEnabled(trading.settings.enabled);
    setTargetProfitPercent(trading.settings.targetProfitPercent);
    setPollIntervalSeconds(Math.round(trading.settings.pollIntervalMs / 1000));
    setWatchSymbols(trading.settings.watchSymbols.join(", "));
  }, [trading.settings]);

  return (
    <section className="panel action-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Auto Exit Engine</p>
          <h2>5% 자동매도 설정</h2>
        </div>
        <button className="ghost-button" onClick={() => void onRefresh()}>
          {refreshing ? "갱신 중" : "즉시 점검"}
        </button>
      </div>

      <div className="form-grid">
        <label className="toggle-row">
          <span>자동매도 활성화</span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
        </label>

        <label>
          <span>목표 수익률(%)</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={targetProfitPercent}
            onChange={(event) => setTargetProfitPercent(Number(event.target.value))}
          />
        </label>

        <label>
          <span>점검 주기(초)</span>
          <input
            type="number"
            min={5}
            step={5}
            value={pollIntervalSeconds}
            onChange={(event) => setPollIntervalSeconds(Number(event.target.value))}
          />
        </label>

        <label>
          <span>감시 종목(쉼표 구분, 비우면 전체)</span>
          <input
            type="text"
            value={watchSymbols}
            onChange={(event) => setWatchSymbols(event.target.value)}
            placeholder="AAPL, MSFT, NVDA"
          />
        </label>
      </div>

      <div className="panel-footer">
        <div className="status-block">
          <strong>{trading.monitorRunning ? "실행 중" : "대기 중"}</strong>
          <span>{trading.lastCheckedAt ? new Date(trading.lastCheckedAt).toLocaleString() : "아직 점검 없음"}</span>
        </div>
        <button
          className="primary-button"
          onClick={() =>
            void onSave({
              enabled,
              targetProfitPercent,
              pollIntervalMs: pollIntervalSeconds * 1000,
              watchSymbols: watchSymbols
                .split(",")
                .map((symbol) => symbol.trim())
                .filter(Boolean)
            })
          }
        >
          설정 저장
        </button>
      </div>

      {trading.lastError ? <p className="error-text">{trading.lastError}</p> : null}
    </section>
  );
}
