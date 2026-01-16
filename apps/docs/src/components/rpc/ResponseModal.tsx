"use client";

import { useState, useEffect } from "react";

interface ResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  methodName: string;
  responseSchema: string;
}

export function ResponseModal({
  isOpen,
  onClose,
  methodName,
  responseSchema,
}: ResponseModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(responseSchema);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative w-full max-w-4xl transform transition-all duration-300 ${
            isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <div className="rounded-2xl bg-gradient-to-br from-zinc-900/95 to-zinc-800/95 border border-cyan-500/20 backdrop-blur-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse animation-delay-100"></div>
                  <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse animation-delay-200"></div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white font-mono">
                    Response Schema
                  </h2>
                  <p className="text-sm text-cyan-300 font-mono">
                    {methodName}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="group relative p-2 rounded-lg border border-zinc-600/50 bg-zinc-800/50 hover:border-red-500/50 hover:bg-red-500/10 transition-all duration-200"
              >
                <svg
                  className="w-5 h-5 text-zinc-400 group-hover:text-red-400 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                  <div className="text-sm font-mono text-green-300 uppercase tracking-wider">
                    JSON Response Structure
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-green-500/20 to-transparent"></div>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  <div className="rounded-xl bg-gradient-to-br from-black/40 to-zinc-900/40 border border-zinc-700/50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 border-b border-zinc-700/50">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="text-xs text-zinc-400 font-mono">
                        response.json
                      </div>
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        {copied ? (
                          <>
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>

                    <div className="relative">
                      <pre className="overflow-x-auto p-4 text-xs text-white font-mono bg-zinc-900/50 leading-relaxed">
                        <code>{responseSchema}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer info */}
              <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
                <span>Press ESC to close</span>
                <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
                <span>Auto-generated from schema</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
