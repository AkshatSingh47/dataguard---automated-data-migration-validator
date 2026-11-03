import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  User,
  Send,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  X,
  Minimize2,
  Maximize2,
  ChevronDown,
  Terminal,
  ShieldAlert,
} from 'lucide-react';
import { ChatMessage, ValidationRunDetail } from '../types';
import { api } from '../services/api';

interface GeminiChatbotProps {
  currentRun?: ValidationRunDetail | null;
  isOpen?: boolean;
  onClose?: () => void;
  isFloating?: boolean;
  prefilledPrompt?: string | null;
  onClearPrefill?: () => void;
}

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({
  currentRun,
  isOpen = true,
  onClose,
  isFloating = false,
  prefilledPrompt,
  onClearPrefill,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: `👋 Hello! I am **DataGuard Copilot**, your Gemini-powered database migration integrity specialist.

I am connected to your active validation telemetry:
${
  currentRun
    ? `- **Run:** \`${currentRun.id}\`
- **Health Score:** **${currentRun.healthScore.toFixed(1)}% (${currentRun.healthRating})**
- **Discrepancies:** ${currentRun.issues.length} detected across ${currentRun.tablesChecked} tables`
    : '- Ready to analyze schema drifts, record discrepancies, or generate SQL fixes.'
}

How can I assist your migration audit today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'gemini',
      },
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle pre-filled prompt passed from dashboard clicks
  useEffect(() => {
    if (prefilledPrompt) {
      setInput(prefilledPrompt);
      if (onClearPrefill) onClearPrefill();
      inputRef.current?.focus();
    }
  }, [prefilledPrompt, onClearPrefill]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    setIsLoading(true);

    try {
      // Build lightweight context from currentRun
      const context = currentRun
        ? {
            runId: currentRun.id,
            sourceDbName: currentRun.sourceDbName,
            targetDbName: currentRun.targetDbName,
            healthScore: currentRun.healthScore,
            healthRating: currentRun.healthRating,
            totalIssues: currentRun.issues.length,
            tablesEvaluated: currentRun.tablesChecked,
            recordsCompared: currentRun.recordsChecked,
            topIssues: currentRun.issues.slice(0, 8).map((iss) => ({
              table: iss.table,
              check_type: iss.check_type,
              message: iss.message,
              severity: iss.severity,
              source_value: iss.source_value,
              target_value: iss.target_value,
              primary_key: iss.primary_key,
            })),
          }
        : undefined;

      // Call server-side Gemini multi-turn endpoint
      const res = await api.sendChatMessage(
        newHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        context,
        selectedModel
      );

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: res.provider,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Failed to get AI response: ${err.message || 'Network error'}. Please try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'context-engine',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Chat cleared. Current validation telemetry is active for Run \`${currentRun?.id || 'Latest'}\`. What would you like to investigate?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: 'gemini',
      },
    ]);
  };

  // Quick suggestion prompts
  const suggestionChips = [
    { label: 'Explain balance mismatch', query: 'Why did the accounts table balance mismatch occur on customer 101?' },
    { label: 'SQL fix for orphan records', query: 'Generate an atomic SQL remediation script for the orphan foreign keys in transactions.' },
    { label: 'Missing audit_log DDL', query: 'Provide the PostgreSQL CREATE TABLE DDL for the missing audit_log table.' },
    { label: 'Go/No-Go Cutover checklist', query: 'Based on this validation run, provide a strict Go/No-Go cutover recommendation.' },
  ];

  if (!isOpen) return null;

  // Render formatted markdown helper
  const renderMessageContent = (content: string, msgId: string) => {
    // Check for code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const language = lines[0]?.trim() || 'sql';
        const code = lines.slice(1).join('\n') || lines.join('\n');

        return (
          <div key={index} className="my-2 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                {language.toUpperCase()} Snippet
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(code, `${msgId}-${index}`)}
                className="flex items-center gap-1 hover:text-slate-200 transition-colors text-[10px] px-1.5 py-0.5 rounded bg-slate-800"
              >
                {copiedId === `${msgId}-${index}` ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-400" /> Copy SQL
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 text-slate-200 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap">
              {code}
            </pre>
          </div>
        );
      }

      // Plain paragraphs with bold parsing
      return (
        <div key={index} className="space-y-2 whitespace-pre-wrap leading-relaxed text-xs">
          {part.split('\n\n').map((paragraph, pIdx) => {
            if (paragraph.startsWith('### ')) {
              return (
                <h4 key={pIdx} className="font-bold text-slate-100 text-sm mt-3 mb-1 border-b border-slate-800/80 pb-1">
                  {paragraph.replace('### ', '')}
                </h4>
              );
            }
            if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
              return (
                <p key={pIdx} className="font-semibold text-slate-200">
                  {paragraph.replace(/\*\*/g, '')}
                </p>
              );
            }
            return <p key={pIdx}>{paragraph}</p>;
          })}
        </div>
      );
    });
  };

  const containerClasses = isFloating
    ? 'fixed bottom-4 right-4 z-50 w-96 sm:w-[440px] max-h-[640px] h-[580px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-md'
    : 'w-full h-full min-h-[580px] bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden';

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/90 text-white flex items-center justify-center shadow-sm">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-100 text-xs tracking-tight">DataGuard AI Copilot</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-900">
                Gemini
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Database Migration Specialist</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Model selection dropdown */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="text-[10px] bg-slate-900 text-slate-300 border border-slate-800 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 font-mono"
            title="Select Gemini Model"
          >
            <option value="gemini-3.8-flash">gemini-3.8-flash (Default)</option>
            <option value="gemini-3.5-flash">gemini-3.5-flash (General)</option>
            <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex)</option>
            <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast)</option>
          </select>

          <button
            type="button"
            onClick={clearChat}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Clear conversation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {isFloating && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="px-3 py-2 bg-slate-950/40 border-b border-slate-800/60 overflow-x-auto flex items-center gap-1.5 no-scrollbar shrink-0">
        <span className="text-[10px] text-slate-500 shrink-0 font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" /> Prompts:
        </span>
        {suggestionChips.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(chip.query)}
            disabled={isLoading}
            className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-indigo-950 hover:text-indigo-300 text-slate-300 border border-slate-700/60 whitespace-nowrap transition-colors disabled:opacity-50"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Messages Thread (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="w-6 h-6 rounded-md bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-xs'
                    : 'bg-slate-950 text-slate-200 border border-slate-800/80 rounded-bl-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[10px] mb-1 opacity-75 font-mono">
                  <span>{isUser ? 'You' : 'DataGuard Copilot'}</span>
                  <span>{msg.timestamp}</span>
                </div>

                {isUser ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : (
                  renderMessageContent(msg.content, msg.id)
                )}
              </div>

              {isUser && (
                <div className="w-6 h-6 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-2.5 items-start">
            <div className="w-6 h-6 rounded-md bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-slate-950 text-slate-400 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span className="font-mono text-[11px]">Analyzing with Gemini ({selectedModel})...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Copilot about discrepancies, SQL fixes, or ETL..."
          disabled={isLoading}
          className="flex-1 bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-colors shadow-md shadow-indigo-950/40 shrink-0"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
