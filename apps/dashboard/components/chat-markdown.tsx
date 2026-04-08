"use client";

import { memo, useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "../lib/utils";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button type="button" onClick={copy} className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors" title={copied ? "Copied" : "Copy code"}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

export const ChatMarkdown = memo(function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        p({ children }) {
          return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
        },
        a({ href, children }) {
          const external = href?.startsWith("http");
          return (
            <a
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground/60 transition-colors font-medium"
            >
              {children}
              {external ? <ExternalLink size={10} className="inline ml-0.5 opacity-40 align-middle" aria-hidden /> : null}
            </a>
          );
        },
        strong({ children }) {
          return <strong className="font-semibold text-foreground">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic">{children}</em>;
        },
        ul({ children }) {
          return <ul className="mb-2 last:mb-0 pl-4 list-disc space-y-0.5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="mb-2 last:mb-0 pl-4 list-decimal space-y-0.5">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        blockquote({ children }) {
          return <blockquote className="border-l-2 border-border pl-3 text-muted-foreground italic my-2">{children}</blockquote>;
        },
        h1({ children }) {
          return <h1 className="text-[16px] font-bold mt-4 mb-2 first:mt-0">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-[15px] font-bold mt-3 mb-1.5 first:mt-0">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-[14px] font-semibold mt-2 mb-1 first:mt-0">{children}</h3>;
        },
        hr() {
          return <hr className="border-border my-3" />;
        },
        table({ children }) {
          return (
            <div className="my-3 overflow-x-auto rounded-xl border border-border/80 bg-card shadow-[var(--shadow-sm)]">
              <table className="w-full text-[12px] leading-tight border-collapse">{children}</table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-muted/50 border-b border-border">{children}</thead>;
        },
        th({ children }) {
          return <th className="px-2.5 py-2 text-left font-semibold text-muted-foreground text-[11px] uppercase tracking-wide">{children}</th>;
        },
        td({ children }) {
          return <td className="px-2.5 py-1.5 border-t border-border/80 align-top">{children}</td>;
        },
        code({ className, children, ...rest }) {
          const match = /language-(\w+)/.exec(className || "");
          const isBlock = match || (typeof children === "string" && children.includes("\n"));
          const codeStr = String(children).replace(/\n$/, "");

          if (isBlock) {
            const lang = match?.[1] ?? "";
            return (
              <div className="my-2 rounded-xl border border-border bg-[var(--code-bg,#fafafa)] dark:bg-[var(--code-bg,#0a0a0a)] overflow-hidden group/code">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
                  <span className="text-[11px] font-[family-name:var(--font-geist-mono)] text-muted-foreground">{lang || "code"}</span>
                  <CopyButton text={codeStr} />
                </div>
                <pre className="overflow-x-auto p-3">
                  <code className={cn("text-[13px] font-[family-name:var(--font-geist-mono)] leading-relaxed", className)}>
                    {codeStr}
                  </code>
                </pre>
              </div>
            );
          }

          return (
            <code className="text-[13px] font-[family-name:var(--font-geist-mono)] bg-muted/60 px-1.5 py-0.5 rounded-md">
              {children}
            </code>
          );
        },
        pre({ children }) {
          return <>{children}</>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
});
