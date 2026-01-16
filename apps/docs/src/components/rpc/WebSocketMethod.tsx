"use client";

import type { WebSocketEndpoint } from "@/lib/websocket-endpoints";


export type ExampleType =
  | "subscribe"
  | "unsubscribe"
  | "notification"
  | "subscribe_response"
  | "unsubscribe_response";

interface WebSocketMethodProps {
  endpoint: WebSocketEndpoint;
  handleShowExample: (endpoint: WebSocketEndpoint, type: ExampleType) => void;
}

export function WebSocketMethod({
  endpoint,
  handleShowExample,
}: WebSocketMethodProps) {
  return (
    <div className="mt-10 mb-20">
      <div className="flex items-center gap-4 mb-6">
        <div className="text-xl font-bold text-white">{endpoint.method_name}</div>
        <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full text-sm font-medium">
          Available
        </span>
      </div>

      <div className="mb-8">
        <p className="text-zinc-300 leading-relaxed">{endpoint.description}</p>
      </div>

      {/* Example Buttons */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => handleShowExample(endpoint, "subscribe")}
          className="group relative flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 transition-all duration-200 hover:scale-105"
        >
          <span className="text-sm font-mono text-blue-300 group-hover:text-blue-200">
            Subscribe Request
          </span>
        </button>
        <button
          onClick={() => handleShowExample(endpoint, "subscribe_response")}
          className="group relative flex items-center gap-2 px-4 py-2 rounded-lg border border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10 hover:from-green-500/20 hover:to-emerald-500/20 transition-all duration-200 hover:scale-105"
        >
          <span className="text-sm font-mono text-green-300 group-hover:text-green-200">
            Subscribe Response
          </span>
        </button>
        <button
          onClick={() => handleShowExample(endpoint, "notification")}
          className="group relative flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 transition-all duration-200 hover:scale-105"
        >
          <span className="text-sm font-mono text-purple-300 group-hover:text-purple-200">
            Notification
          </span>
        </button>
        {endpoint.method_name.includes("Subscribe") && (
          <>
            <button
              onClick={() => handleShowExample(endpoint, "unsubscribe")}
              className="group relative flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-red-500/10 hover:from-orange-500/20 hover:to-red-500/20 transition-all duration-200 hover:scale-105"
            >
              <span className="text-sm font-mono text-orange-300 group-hover:text-orange-200">
                Unsubscribe Request
              </span>
            </button>
            <button
              onClick={() => handleShowExample(endpoint, "unsubscribe_response")}
              className="group relative flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-500/30 bg-gradient-to-r from-zinc-500/10 to-slate-500/10 hover:from-zinc-500/20 hover:to-slate-500/20 transition-all duration-200 hover:scale-105"
            >
              <span className="text-sm font-mono text-zinc-300 group-hover:text-zinc-200">
                Unsubscribe Response
              </span>
            </button>
          </>
        )}
      </div>

      {/* Parameters Section */}
      {endpoint.params.length > 0 && (
        <div className="max-w-4xl rounded-xl bg-gradient-to-br from-zinc-900/90 to-zinc-800/90 border border-zinc-700/50 backdrop-blur-sm">
          <div className="flex flex-col w-full">
            <div className="px-6 py-4 border-b border-zinc-700/30">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                <div className="text-sm font-mono text-cyan-300 uppercase tracking-wider">
                  Parameters
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/20 to-transparent"></div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {endpoint.params.map((param, paramIndex) => (
                <div key={paramIndex} className="flex flex-col w-full">
                  <div className="rounded-lg bg-gradient-to-r from-zinc-900/80 to-zinc-800/80 p-4 border border-zinc-700/50 hover:border-cyan-500/30 transition-all duration-200">
                    <div className="flex justify-between items-start w-full mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-1 h-1 rounded-full ${
                            param.required ? "bg-red-400" : "bg-cyan-400"
                          }`}
                        ></div>
                        <div className="text-zinc-200 font-mono text-sm font-medium">
                          {param.name}
                        </div>
                        {param.required && (
                          <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                            required
                          </span>
                        )}
                      </div>
                      <div className="text-xs bg-zinc-700/80 text-cyan-300 px-3 py-1 rounded-full border border-zinc-600/50 font-mono">
                        {param.type}
                      </div>
                    </div>
                    <div className="text-zinc-400 text-sm font-mono leading-relaxed pl-3 border-l-2 border-cyan-500/20">
                      {param.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
