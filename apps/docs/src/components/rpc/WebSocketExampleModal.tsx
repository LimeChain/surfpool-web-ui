"use client";

import type { WebSocketEndpoint } from "@/lib/websocket-endpoints";
import { ExampleType } from "./WebSocketMethod";

interface WebSocketExampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  endpoint: WebSocketEndpoint | null;
  exampleType: ExampleType;
}

export function WebSocketExampleModal({
  isOpen,
  onClose,
  endpoint,
  exampleType,
}: WebSocketExampleModalProps) {
  if (!isOpen || !endpoint) return null;

  const getExampleData = () => {
    switch (exampleType) {
      case "subscribe":
        return endpoint.subscribe_example;
      case "unsubscribe":
        return endpoint.unsubscribe_example;
      case "notification":
        return endpoint.notification_example;
      case "subscribe_response":
        return endpoint.subscribe_response_example;
      case "unsubscribe_response":
        return endpoint.unsubscribe_response_example;
      default:
        return "{}";
    }
  };

  const getExampleTitle = () => {
    const methodName = endpoint.method_name;
    switch (exampleType) {
      case "subscribe":
        return `${methodName} - Request`;
      case "unsubscribe":
        return `${methodName.replace("Subscribe", "Unsubscribe")} - Request`;
      case "notification":
        return `${methodName} - Notification`;
      case "subscribe_response":
        return `${methodName} - Response`;
      case "unsubscribe_response":
        return `${methodName.replace("Subscribe", "Unsubscribe")} - Response`;
      default:
        return "Example";
    }
  };

  const getExampleDescription = () => {
    switch (exampleType) {
      case "subscribe":
        return "WebSocket request to establish a subscription";
      case "unsubscribe":
        return "WebSocket request to remove an active subscription";
      case "notification":
        return "Real-time notification sent to subscribers";
      case "subscribe_response":
        return "Confirmation response with subscription ID";
      case "unsubscribe_response":
        return "Confirmation that subscription was removed";
      default:
        return "Example data";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {getExampleTitle()}
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              {getExampleDescription()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
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
        <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
          <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 overflow-auto">
            <code>{getExampleData()}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
