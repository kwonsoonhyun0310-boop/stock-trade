import type { AnalysisSection } from "@trade/shared";

interface AnalysisPanelProps {
  sections: AnalysisSection[];
  loginStatus: string;
  model: string;
}

export function AnalysisPanel({ sections, loginStatus, model }: AnalysisPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Codex Analysis</p>
          <h2>코덱스 분석 요약</h2>
        </div>
        <div className="pill-group">
          <span className="pill">{model}</span>
          <span className="pill">{loginStatus}</span>
        </div>
      </div>

      {sections.length === 0 ? (
        <p className="empty-state">Codex 분석을 불러오는 중입니다.</p>
      ) : (
        <div className="analysis-grid">
          {sections.map((section) => (
            <article key={section.title} className="analysis-card">
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
