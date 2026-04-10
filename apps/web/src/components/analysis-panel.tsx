import { memo, useState } from "react";
import type { DailyAnalysisSnapshot } from "@trade/shared";

interface AnalysisPanelProps {
  history: DailyAnalysisSnapshot[];
  generatedAt: string;
  loginStatus: string;
  model: string;
}

const isSameHistory = (left: DailyAnalysisSnapshot[], right: DailyAnalysisSnapshot[]) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((entry, index) => {
    const nextEntry = right[index];

    if (
      entry.dateKey !== nextEntry?.dateKey ||
      entry.generatedAt !== nextEntry?.generatedAt ||
      entry.sections.length !== nextEntry?.sections.length
    ) {
      return false;
    }

    return entry.sections.every((section, sectionIndex) => {
      const nextSection = nextEntry.sections[sectionIndex];

      if (
        section.title !== nextSection?.title ||
        section.summary !== nextSection?.summary ||
        section.confidence !== nextSection?.confidence ||
        section.bullets.length !== nextSection?.bullets.length
      ) {
        return false;
      }

      return section.bullets.every((bullet, bulletIndex) => bullet === nextSection.bullets[bulletIndex]);
    });
  });
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

const getCollapsedSection = (entry: DailyAnalysisSnapshot) =>
  entry.sections.find((section) => section.title.includes("현재 트렌드") || section.title.includes("트렌드")) ??
  entry.sections[1] ??
  entry.sections[0];

function AnalysisDayBlock({ entry, isLatest }: { entry: DailyAnalysisSnapshot; isLatest: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const collapsedSection = getCollapsedSection(entry);

  return (
    <section className="analysis-day-block">
      <div className="analysis-day-header">
        <div className="analysis-day-copy">
          <strong>{formatDate(entry.generatedAt)}</strong>
          <span>{isLatest ? `최신 분석, ${formatDateTime(entry.generatedAt)} 생성` : `${formatDateTime(entry.generatedAt)} 생성`}</span>
        </div>
        <div className="analysis-day-actions">
          <span className="pill">{entry.dateKey}</span>
          <button
            type="button"
            className="ghost-button analysis-toggle-button"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "접기" : "펼치기"}
          </button>
        </div>
      </div>

      {!expanded ? (
        <div className="analysis-collapsed-summary">
          <strong>{collapsedSection?.title ?? "현재 트렌드"}</strong>
          <p>{collapsedSection?.summary ?? "트렌드 분석이 아직 준비되지 않았습니다."}</p>
          {collapsedSection && collapsedSection.bullets.length > 0 ? (
            <ul>
              {collapsedSection.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="analysis-grid">
          {entry.sections.map((section) => (
            <article key={`${entry.dateKey}-${section.title}`} className="analysis-card">
              <div className="analysis-head">
                <h3>{section.title}</h3>
                <span className={`confidence confidence-${section.confidence}`}>{section.confidence}</span>
              </div>
              <p>{section.summary}</p>
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AnalysisPanelComponent({ history, loginStatus, model }: AnalysisPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Codex Analysis</p>
          <h2>코덱스 일별 분석</h2>
        </div>
        <div className="pill-group">
          <span className="pill">하루 1회 업데이트</span>
          <span className="pill">{model}</span>
          <span className="pill">{loginStatus}</span>
        </div>
      </div>

      {history.length === 0 ? (
        <p className="empty-state">Codex 분석을 불러오는 중입니다.</p>
      ) : (
        <div className="analysis-history">
          {history.map((entry, index) => (
            <AnalysisDayBlock key={entry.dateKey} entry={entry} isLatest={index === 0} />
          ))}
        </div>
      )}
    </section>
  );
}

export const AnalysisPanel = memo(
  AnalysisPanelComponent,
  (previous, next) =>
    previous.generatedAt === next.generatedAt &&
    previous.loginStatus === next.loginStatus &&
    previous.model === next.model &&
    isSameHistory(previous.history, next.history)
);
