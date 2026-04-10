export type DashboardTabKey = "trade" | "account" | "market";

export interface DashboardTabItem {
  key: DashboardTabKey;
  label: string;
  description: string;
}

interface DashboardTabsProps {
  activeTab: DashboardTabKey;
  tabs: DashboardTabItem[];
  onChange: (tab: DashboardTabKey) => void;
}

export function DashboardTabs({ activeTab, tabs, onChange }: DashboardTabsProps) {
  return (
    <nav className="dashboard-tab-bar" aria-label="대시보드 구분">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={
            tab.key === activeTab ? `dashboard-tab tab-${tab.key} active` : `dashboard-tab tab-${tab.key}`
          }
          onClick={() => onChange(tab.key)}
        >
          <strong>{tab.label}</strong>
          <span>{tab.description}</span>
        </button>
      ))}
    </nav>
  );
}
