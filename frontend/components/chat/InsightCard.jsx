"use client";

import { useState } from "react";

/**
 * Collapsible "based on N cases" evidence panel shown under an assistant
 * message. Surfaces the raw tool results so a clinician can sanity-check
 * the answer instead of just trusting the prose.
 */
export default function InsightCard({ caseCount, lowConfidence, confidenceScore, evidence = [] }) {
  const [open, setOpen] = useState(false);

  if (caseCount == null && evidence.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 font-medium text-gray-700">
          {caseCount != null && <>Based on {caseCount} case{caseCount === 1 ? "" : "s"}</>}
          {lowConfidence && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              low confidence
            </span>
          )}
        </span>
        <span className="text-gray-400">{open ? "Hide details \u2212" : "Show evidence +"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-gray-200 px-3 py-3">
          {typeof confidenceScore === "number" && (
            <div className="text-xs text-gray-500">Confidence score: {confidenceScore.toFixed(0)}/100</div>
          )}
          {evidence.map((e, i) => (
            <div key={i} className="rounded border border-gray-200 bg-white p-2">
              <div className="mb-1 font-mono text-xs text-teal-700">{e.tool_name}({formatArgs(e.tool_input)})</div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-600">
                {JSON.stringify(e.result, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatArgs(input) {
  if (!input) return "";
  return Object.entries(input)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
}
