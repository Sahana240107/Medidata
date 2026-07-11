"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import InsightCard from "./InsightCard";

// Assistant answers come back as markdown (bold, tables, lists) from the
// LLM. They were previously dumped into a plain whitespace-pre-wrap div,
// so the user saw literal "**text**" and raw "| a | b |" table syntax
// instead of formatted output. This renders it properly, with Tailwind
// classes on each element so tables/lists/headers actually look like
// tables/lists/headers inside the chat bubble.
const markdownComponents = {
  p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
  ul: ({ node, ...props }) => <ul className="mb-2 ml-4 list-disc space-y-0.5 last:mb-0" {...props} />,
  ol: ({ node, ...props }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5 last:mb-0" {...props} />,
  h1: ({ node, ...props }) => <h1 className="mb-1 mt-2 text-base font-semibold text-gray-900 first:mt-0" {...props} />,
  h2: ({ node, ...props }) => <h2 className="mb-1 mt-2 text-sm font-semibold text-gray-900 first:mt-0" {...props} />,
  h3: ({ node, ...props }) => <h3 className="mb-1 mt-2 text-sm font-semibold text-gray-900 first:mt-0" {...props} />,
  table: ({ node, ...props }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead className="bg-gray-50" {...props} />,
  th: ({ node, ...props }) => (
    <th className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-700" {...props} />
  ),
  td: ({ node, ...props }) => <td className="border border-gray-200 px-2 py-1 align-top text-gray-700" {...props} />,
  em: ({ node, ...props }) => <em className="text-gray-500" {...props} />,
  hr: ({ node, ...props }) => <hr className="my-2 border-gray-200" {...props} />,
  a: ({ node, ...props }) => <a className="text-teal-700 underline" target="_blank" rel="noreferrer" {...props} />,
};

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isUser ? "order-2" : "order-1"}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "whitespace-pre-wrap rounded-br-sm bg-teal-600 text-white"
              : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {!isUser && (
          <InsightCard
            caseCount={message.caseCount}
            lowConfidence={message.lowConfidence}
            confidenceScore={message.confidenceScore}
            evidence={message.evidence}
          />
        )}
      </div>
    </div>
  );
}