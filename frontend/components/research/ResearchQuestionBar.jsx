'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './research.module.css';
import { RESEARCH_QUESTION, TEMPLATES } from '@/lib/researchMockData';

export default function ResearchQuestionBar({ showTemplates = true }) {
  const [question, setQuestion] = useState(RESEARCH_QUESTION);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const router = useRouter();

  const handleGenerate = () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    // No backend call — this is a fixture-driven transition to the
    // generated-hypothesis view.
    setTimeout(() => {
      router.push('/research/hypothesis');
    }, 550);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className={styles.qBar}>
      <div className={styles.qHead}>
        <span className={styles.panelLabel}>Research Question</span>
        <span className={styles.qHint}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <kbd className={styles.kbd}>↵</kbd> to generate
        </span>
      </div>

      <div className={`${styles.qInputWrap} ${focused ? styles.qInputWrapFocus : ''}`}>
        <svg className={styles.qSearchIcon} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <textarea
          className={styles.qTextarea}
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a research question across your selected datasets…"
        />
        {question && (
          <button className={styles.qClearIcon} onClick={() => setQuestion('')} aria-label="Clear question">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className={styles.qTagsRow}>
        <span className={styles.qTag}>3 datasets</span>
        <span className={styles.qTag}>Federated</span>
        <span className={styles.qTag}>Evidence citations on</span>
      </div>

      <div className={styles.qFooter}>
        <div className={styles.qFooterLeft}>
          <button className={styles.linkBtn} onClick={() => setQuestion('')}>Clear</button>
          <button className={styles.linkBtn} onClick={() => setQuestion(RESEARCH_QUESTION)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l4 4v3" /><path d="M12.5 12.5 20 20l-4 1 1-4Z" />
            </svg>
            Suggested questions
          </button>
        </div>
        <button className={styles.btnGenerate} onClick={handleGenerate} disabled={loading}>
          {loading ? (
            <>
              <span className={styles.spinner} /> Generating…
            </>
          ) : (
            <>
              Generate hypothesis
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>

      {showTemplates && (
        <div className={styles.templatesRow}>
          <div className={styles.templatesLabel}>Templates</div>
          <div className={styles.templateChips}>
            {TEMPLATES.map((t) => (
              <button key={t} className={styles.templateChip} onClick={() => setQuestion(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
