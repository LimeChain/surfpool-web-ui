"use client";

import type { Endpoint } from "@/lib/rpc-endpoints";

interface RpcMethodProps {
  endpoint: Endpoint;
  handleShowResponse: (methodName: string) => void;
}

export function RpcMethod({ endpoint, handleShowResponse }: RpcMethodProps) {
  return (
    <div className="mt-10 mb-40">
      <div className="flex items-center gap-4 mb-10">
        <div className="text-xl font-bold">{endpoint.method_name}</div>
        {endpoint.status === "coming_soon" && (
          <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded text-sm">
            Coming Soon
          </span>
        )}
        {endpoint.status === "implemented" && (
          <span className="bg-green-500/20 text-green-300 px-2 py-1 rounded text-sm">
            Available
          </span>
        )}

        {/* Response Button */}
        {endpoint.status === "implemented" && (
          <button
            onClick={() => handleShowResponse(endpoint.method_name)}
            className="group relative flex items-center gap-2 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 transition-all duration-200 hover:scale-105"
          >
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse"></div>
              <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse animation-delay-100"></div>
              <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse animation-delay-200"></div>
            </div>
            <span className="text-xs font-mono text-purple-300 group-hover:text-purple-200">
              response
            </span>
            <svg
              className="w-3 h-3 text-purple-400 group-hover:text-purple-300 transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </button>
        )}
      </div>
      <div className="mb-10">{endpoint.description}</div>

      {endpoint.status === "coming_soon" ? (
        <div className="max-w-4xl rounded-xl bg-gradient-to-br from-zinc-900/90 to-zinc-800/90 border border-zinc-700/50 backdrop-blur-sm mt-6">
          <div className="flex flex-col p-6">
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                <div className="text-zinc-400 font-mono text-sm">
                  Method implementation in progress
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl rounded-xl bg-gradient-to-br from-zinc-900/90 to-zinc-800/90 border border-zinc-700/50 backdrop-blur-sm mt-6">
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
              {endpoint.params.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <div className="text-zinc-400 font-mono text-sm">
                      No parameters required
                    </div>
                  </div>
                </div>
              ) : (
                (() => {
                  const groupedParams: any[] = [];
                  let currentGroup: any[] = [];
                  let isInObject = false;

                  endpoint.params.forEach((param, index) => {
                    if (param.isObjectHeader) {
                      if (currentGroup.length > 0) {
                        groupedParams.push({
                          type: "group",
                          params: currentGroup,
                        });
                        currentGroup = [];
                      }
                      groupedParams.push({ type: "objectHeader", param, index });
                      isInObject = true;
                    } else if (param.isNested && isInObject) {
                      currentGroup.push({ ...param, index });
                    } else {
                      if (currentGroup.length > 0) {
                        groupedParams.push({
                          type: "group",
                          params: currentGroup,
                        });
                        currentGroup = [];
                      }
                      groupedParams.push({ type: "single", param, index });
                      isInObject = false;
                    }
                  });

                  if (currentGroup.length > 0) {
                    groupedParams.push({ type: "group", params: currentGroup });
                  }

                  return groupedParams.map((item, groupIndex) => {
                    if (item.type === "objectHeader") {
                      return (
                        <div
                          key={`header-${item.index}`}
                          className="flex flex-col w-full mt-6"
                        >
                          <div className="rounded-t-xl bg-gradient-to-r from-slate-800/80 to-slate-700/80 border border-slate-600/40 p-4 backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-3">
                              <div
                                className={`w-1 h-1 rounded-full ${
                                  item.param.required ? "bg-red-400" : "bg-cyan-400"
                                }`}
                              ></div>
                              <div className="text-slate-200 font-mono text-sm font-semibold">
                                {item.param.name}
                              </div>
                              {item.param.required && (
                                <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                                  required
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-sm font-mono leading-relaxed pl-5 border-l-2 border-blue-500/30">
                              {item.param.description}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (item.type === "group") {
                      return (
                        <div
                          key={`group-${groupIndex}`}
                          className="flex flex-col w-full"
                        >
                          <div className="border-l border-r border-b border-slate-600/40 rounded-b-xl bg-gradient-to-br from-slate-900/50 to-slate-800/50 p-3 backdrop-blur-sm">
                            {item.params.map(
                              (param: any, paramIndex: number) => (
                                <div
                                  key={`nested-${param.index}`}
                                  className="mb-3 last:mb-0"
                                >
                                  <div className="rounded-lg bg-gradient-to-r from-zinc-900/80 to-zinc-800/80 p-4 border border-zinc-700/50 hover:border-cyan-500/30 transition-all duration-200">
                                    <div className="flex justify-between items-start w-full mb-3">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`w-1 h-1 rounded-full ${
                                            param.required
                                              ? "bg-red-400"
                                              : "bg-cyan-400"
                                          }`}
                                        ></div>
                                        <div className="text-zinc-200 font-mono text-sm font-medium">
                                          {param.name.split(".").pop()}
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
                              ),
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`single-${item.index}`}
                        className="flex flex-col w-full"
                      >
                        <div className="rounded-lg bg-gradient-to-r from-zinc-900/80 to-zinc-800/80 p-4 border border-zinc-700/50 hover:border-cyan-500/30 transition-all duration-200">
                          <div className="flex justify-between items-start w-full mb-3">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-1 h-1 rounded-full ${
                                  item.param.required
                                    ? "bg-red-400"
                                    : "bg-cyan-400"
                                }`}
                              ></div>
                              <div className="text-zinc-200 font-mono text-sm font-medium">
                                {item.param.name}
                              </div>
                              {item.param.required && (
                                <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                                  required
                                </span>
                              )}
                            </div>
                            <div className="text-xs bg-zinc-700/80 text-cyan-300 px-3 py-1 rounded-full border border-zinc-600/50 font-mono">
                              {item.param.type}
                            </div>
                          </div>
                          <div className="text-zinc-400 text-sm font-mono leading-relaxed pl-3 border-l-2 border-cyan-500/20">
                            {item.param.description}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
