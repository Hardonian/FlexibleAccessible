"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  GraduationCap,
  Wrench,
  Copy,
  Check,
  RotateCcw,
  Loader2,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface FindingCopilotDrawerProps {
  findingId: string;
  organizationId: string;
  ruleId: string;
  isOpen: boolean;
  onClose: () => void;
}

const SUGGESTIONS = [
  "How do screen reader users experience this issue?",
  "Show me the preferred native HTML remediation.",
  "When is ARIA needed vs native HTML here?",
  "How can I write an automated Playwright test for this?",
];

export function FindingCopilotDrawer({
  findingId,
  organizationId,
  ruleId,
  isOpen,
  onClose,
}: FindingCopilotDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hello! I'm your AROS Accessibility Copilot for rule **${ruleId}**. How can I help you remediate or understand this defect?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"expert" | "teach">("expert");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend ?? input).trim();
    if (!text || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    const assistantPlaceholderId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantPlaceholderId,
      role: "assistant",
      content: "",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/ai-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId,
          organizationId,
          message: text,
          mode,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error ?? `Error ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body received from stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6);
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                accumulatedContent += data.text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantPlaceholderId
                      ? { ...msg, content: accumulatedContent }
                      : msg,
                  ),
                );
              }
            } catch {
              // Non-JSON or SSE heartbeat
            }
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantPlaceholderId
            ? {
                ...msg,
                content: `*Copilot notice:* Unable to complete response (${err.message}). Please ensure your organization plan has AI Copilot features enabled.`,
              }
            : msg,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleReset() {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Hello! I'm your AROS Accessibility Copilot for rule **${ruleId}**. How can I help you remediate or understand this defect?`,
      },
    ]);
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copilot-drawer-title"
    >
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl border-l border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="copilot-drawer-title" className="text-sm font-bold text-slate-900">
                  AROS Finding Copilot
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
                  <Sparkles className="h-2.5 w-2.5" />
                  RAG-Grounded
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">rule: {ruleId}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleReset}
              title="Reset conversation"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              aria-label="Reset conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              aria-label="Close Copilot"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex border-b border-slate-200 bg-white p-2 text-xs">
          <button
            type="button"
            onClick={() => setMode("expert")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition-all ${
              mode === "expert"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            Expert (Code First)
          </button>
          <button
            type="button"
            onClick={() => setMode("teach")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium transition-all ${
              mode === "teach"
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            Teach (Educational)
          </button>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-900"
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">
                  {msg.content || (
                    <span className="inline-flex items-center gap-1 text-slate-400 italic">
                      <Loader2 className="h-3 w-3 animate-spin" /> Thinking...
                    </span>
                  )}
                </div>

                {msg.role === "assistant" && msg.content && (
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.content, msg.id)}
                    className="absolute right-2 top-2 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-600 group-hover:opacity-100"
                    aria-label="Copy message"
                  >
                    {copiedId === msg.id ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>

              {msg.role === "user" && (
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-white">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        <div className="border-t border-slate-100 bg-slate-50/50 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1 mb-1.5">
            Suggested Prompts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={isStreaming}
                onClick={() => handleSend(suggestion)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="border-t border-slate-200 p-3 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask about this finding or request code..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isStreaming}
              className="input flex-1 py-2 text-xs"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="btn-primary min-h-[38px] px-3 disabled:opacity-50"
              aria-label="Send message"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
