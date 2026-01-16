"use client";

import { useState } from "react";
import type { Endpoint } from "@/lib/rpc-endpoints";

interface RpcMethodCleanProps {
  endpoint: Endpoint;
}

export function RpcMethodClean({ endpoint }: RpcMethodCleanProps) {
  const [showRequest, setShowRequest] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  return (
    <div className="border border-fd-border rounded-lg overflow-hidden mb-6">
      {/* Header */}
      <div className="bg-fd-card px-4 py-3 border-b border-fd-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <code className="text-base font-semibold text-fd-foreground">
              {endpoint.method_name}
            </code>
            {endpoint.status === "implemented" ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                Available
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                Coming Soon
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-fd-muted-foreground mt-2">
          {endpoint.description}
        </p>
      </div>

      {/* Parameters */}
      {endpoint.params.length > 0 && (
        <div className="px-4 py-3 border-b border-fd-border">
          <h4 className="text-sm font-medium text-fd-foreground mb-3">Parameters</h4>
          <div className="space-y-2">
            {endpoint.params.map((param, index) => (
              <div
                key={index}
                className="flex items-start gap-4 text-sm py-2 border-b border-fd-border/50 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-[140px]">
                  <code className="text-fd-foreground font-mono text-xs">
                    {param.isNested ? param.name.split('.').pop() : param.name}
                  </code>
                  {param.required && (
                    <span className="text-[10px] text-red-400">required</span>
                  )}
                </div>
                <code className="text-xs text-cyan-500 min-w-[100px]">
                  {param.type}
                </code>
                <span className="text-fd-muted-foreground text-xs flex-1">
                  {param.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Examples */}
      <div className="px-4 py-3 bg-fd-background">
        <div className="flex gap-2">
          <button
            onClick={() => setShowRequest(!showRequest)}
            className="text-xs px-3 py-1.5 rounded border border-fd-border hover:bg-fd-accent transition-colors"
          >
            {showRequest ? "Hide" : "Show"} Request
          </button>
          <button
            onClick={() => setShowResponse(!showResponse)}
            className="text-xs px-3 py-1.5 rounded border border-fd-border hover:bg-fd-accent transition-colors"
          >
            {showResponse ? "Hide" : "Show"} Response
          </button>
        </div>

        {showRequest && (
          <div className="mt-3">
            <pre className="bg-fd-card border border-fd-border rounded-lg p-3 overflow-x-auto">
              <code className="text-xs text-fd-foreground">{endpoint.example_request}</code>
            </pre>
          </div>
        )}

        {showResponse && (
          <div className="mt-3">
            <pre className="bg-fd-card border border-fd-border rounded-lg p-3 overflow-x-auto">
              <code className="text-xs text-fd-foreground">{endpoint.example_response}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
