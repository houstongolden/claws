"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Generation {
  prompt: string;
  timestamp: number;
  filesGenerated: string[];
}

interface VibeCoderProps {
  onFilesGenerated: (files: { path: string; content: string }[]) => void;
  currentFiles?: { path: string; content: string }[];
  generations: Generation[];
  onGenerationComplete: (gen: Generation) => void;
  autoPrompt?: string;
}

export function VibeCoder({
  onFilesGenerated,
  currentFiles,
  generations,
  onGenerationComplete,
  autoPrompt,
}: VibeCoderProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const autoTriggered = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [generations, streamText, error]);

  const runGeneration = useCallback(async (promptText: string, mode: "generate" | "refine" = "generate") => {
    if (!promptText.trim() || promptText.trim().length < 3 || generating) return;

    setGenerating(true);
    setError(null);
    setStreamText("");
    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText.trim(),
          currentFiles: mode === "refine" ? currentFiles : undefined,
          mode,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Generation failed");
        setGenerating(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "delta") setStreamText((prev) => prev + data.text);
            if (data.type === "complete") {
              onFilesGenerated(data.files);
              onGenerationComplete({
                prompt: promptText.trim(),
                timestamp: Date.now(),
                filesGenerated: data.files.map((f: { path: string }) => f.path),
              });
              setPrompt("");
            }
            if (data.type === "error") setError(data.error);
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError("Generation failed. Try again.");
      }
    } finally {
      setGenerating(false);
      setStreamText("");
      abortRef.current = null;
    }
  }, [generating, currentFiles, onFilesGenerated, onGenerationComplete]);

  useEffect(() => {
    if (autoPrompt && !autoTriggered.current && !generating && generations.length === 0) {
      autoTriggered.current = true;
      setPrompt(autoPrompt);
      runGeneration(autoPrompt, "generate");
    }
  }, [autoPrompt, generating, generations.length, runGeneration]);

  const handleSubmit = useCallback(() => {
    const isRefine = currentFiles && currentFiles.length > 0;
    runGeneration(prompt, isRefine ? "refine" : "generate");
  }, [prompt, currentFiles, runGeneration]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {generations.length === 0 && !generating && !error && (
          <div className="text-[11px] text-text-secondary text-center py-6 leading-relaxed">
            Describe the workspace you want to build.
            <br />
            <span className="text-text-secondary/60">e.g. "a research lab with memory, analytics, and daily digests"</span>
          </div>
        )}

        {generations.map((gen, i) => (
          <div key={i} className="space-y-2">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] px-3 py-1.5 rounded rounded-br-md bg-accent/15 text-xs text-text">
                {gen.prompt}
              </div>
            </div>
            {/* AI response */}
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3 py-1.5 rounded rounded-bl-md bg-surface-muted text-[11px] text-text-secondary">
                Updated template ({gen.filesGenerated.length} files)
              </div>
            </div>
          </div>
        ))}

        {generating && (
          <div className="flex justify-start">
            <div className="px-3 py-1.5 rounded rounded-bl-md bg-surface-muted text-[11px] text-text-secondary">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">Generating</span>
                <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "0.3s" }}>.</span>
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="px-3 py-1.5 rounded bg-red-500/10 text-[11px] text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Input — Cursor-style with up arrow */}
      <div className="px-3 pb-3">
        <div className="relative flex items-end bg-surface-muted rounded border border-border focus-within:border-accent transition-colors">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Describe your workspace..."
            disabled={generating}
            rows={1}
            className="flex-1 bg-transparent text-xs text-text px-3 py-2.5 outline-none resize-none placeholder:text-text-secondary disabled:opacity-50 max-h-[100px]"
            style={{ minHeight: 36 }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "36px";
              target.style.height = Math.min(target.scrollHeight, 100) + "px";
            }}
          />
          {generating ? (
            <button
              onClick={() => abortRef.current?.abort()}
              className="m-1.5 w-7 h-7 flex items-center justify-center rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors shrink-0"
              title="Stop"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect width="10" height="10" rx="1" /></svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || prompt.trim().length < 3}
              className="m-1.5 w-7 h-7 flex items-center justify-center rounded transition-all disabled:opacity-20 shrink-0"
              style={{
                background: prompt.trim().length >= 3 ? "#D4A574" : "transparent",
                color: prompt.trim().length >= 3 ? "#0A0908" : "currentColor",
              }}
              title="Send"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 10V2M2 6l4-4 4 4" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
