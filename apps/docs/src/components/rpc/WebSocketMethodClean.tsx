"use client";

import { useState } from "react";
import type { WebSocketEndpoint } from "@/lib/websocket-endpoints";

interface WebSocketMethodCleanProps {
  endpoint: WebSocketEndpoint;
}

export function WebSocketMethodClean({ endpoint }: WebSocketMethodCleanProps) {
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [showUnsubscribe, setShowUnsubscribe] = useState(false);

  const hasUnsubscribe = endpoint.method_name.includes("Subscribe");

  return (
    <div className="border border-fd-border rounded-lg overflow-hidden mb-6">
      {/* Header */}
      <div className="bg-fd-card px-4 py-3 border-b border-fd-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <code className="text-base font-semibold text-fd-foreground">
              {endpoint.method_name}
            </code>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
              Available
            </span>
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
                    {param.name}
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSubscribe(!showSubscribe)}
            className="text-xs px-3 py-1.5 rounded border border-fd-border hover:bg-fd-accent transition-colors"
          >
            {showSubscribe ? "Hide" : "Show"} Subscribe
          </button>
          <button
            onClick={() => setShowResponse(!showResponse)}
            className="text-xs px-3 py-1.5 rounded border border-fd-border hover:bg-fd-accent transition-colors"
          >
            {showResponse ? "Hide" : "Show"} Response
          </button>
          <button
            onClick={() => setShowNotification(!showNotification)}
            className="text-xs px-3 py-1.5 rounded border border-fd-border hover:bg-fd-accent transition-colors"
          >
            {showNotification ? "Hide" : "Show"} Notification
          </button>
          {hasUnsubscribe && (
            <button
              onClick={() => setShowUnsubscribe(!showUnsubscribe)}
              className="text-xs px-3 py-1.5 rounded border border-fd-border hover:bg-fd-accent transition-colors"
            >
              {showUnsubscribe ? "Hide" : "Show"} Unsubscribe
            </button>
          )}
        </div>

        {showSubscribe && (
          <div className="mt-3">
            <div className="text-xs text-fd-muted-foreground mb-1">Subscribe Request</div>
            <pre className="bg-fd-card border border-fd-border rounded-lg p-3 overflow-x-auto">
              <code className="text-xs text-fd-foreground">{endpoint.subscribe_example}</code>
            </pre>
          </div>
        )}

        {showResponse && (
          <div className="mt-3">
            <div className="text-xs text-fd-muted-foreground mb-1">Subscribe Response</div>
            <pre className="bg-fd-card border border-fd-border rounded-lg p-3 overflow-x-auto">
              <code className="text-xs text-fd-foreground">{endpoint.subscribe_response_example}</code>
            </pre>
          </div>
        )}

        {showNotification && (
          <div className="mt-3">
            <div className="text-xs text-fd-muted-foreground mb-1">Notification</div>
            <pre className="bg-fd-card border border-fd-border rounded-lg p-3 overflow-x-auto">
              <code className="text-xs text-fd-foreground">{endpoint.notification_example}</code>
            </pre>
          </div>
        )}

        {showUnsubscribe && hasUnsubscribe && (
          <div className="mt-3">
            <div className="text-xs text-fd-muted-foreground mb-1">Unsubscribe Request</div>
            <pre className="bg-fd-card border border-fd-border rounded-lg p-3 overflow-x-auto">
              <code className="text-xs text-fd-foreground">{endpoint.unsubscribe_example}</code>
            </pre>
            <div className="text-xs text-fd-muted-foreground mb-1 mt-3">Unsubscribe Response</div>
            <pre className="bg-fd-card border border-fd-border rounded-lg p-3 overflow-x-auto">
              <code className="text-xs text-fd-foreground">{endpoint.unsubscribe_response_example}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
