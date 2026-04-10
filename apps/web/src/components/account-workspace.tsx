import type { TradingStatus } from "@trade/shared";
import { EventsList } from "./events-list.js";
import { HoldingsTable } from "./holdings-table.js";
import { ProfitLedgerPanel } from "./profit-ledger-panel.js";
import { ProfitSummaryPanel } from "./profit-summary-panel.js";

interface AccountWorkspaceProps {
  trading: TradingStatus;
}

export function AccountWorkspace({ trading }: AccountWorkspaceProps) {
  return (
    <section className="tab-panel-stack">
      <ProfitSummaryPanel trading={trading} />
      <ProfitLedgerPanel ledger={trading.profitLedger} />

      <section className="bottom-grid">
        <HoldingsTable holdings={trading.holdings} />
        <EventsList events={trading.recentEvents} />
      </section>
    </section>
  );
}
