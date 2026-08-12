'use client';

import { DEFAULT_OLLAMA_URL } from '@surfpool/shared';

export type AIProvider = 'claude' | 'gemini' | 'groq' | 'ollama' | 'openai';

export interface AIModel {
  id: string;
  provider: AIProvider;
  model: string;
  name: string;
  description: string;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | (string & {});
}

export interface AIProviderConfig {
  id: AIProvider;
  name: string;
  icon: string;
  models: AIModel[];
  requiresKey: boolean;
}

// Provider configurations with their models (cheapest, balanced, best)
export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: 'groq',
    name: 'Groq',
    icon: '/assets/groq.svg',
    requiresKey: true,
    models: [
      {
        id: 'groq-llama-8b',
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        name: 'Llama 8B',
        description: 'Cheapest',
      },
      {
        id: 'groq-llama-70b',
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        name: 'Llama 70B',
        description: 'Balanced',
      },
      { id: 'groq-mixtral', provider: 'groq', model: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Best' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    icon: '/assets/ollama.svg',
    requiresKey: false,
    models: [], // Populated dynamically via fetchOllamaModels()
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '/assets/openai.svg',
    requiresKey: true,
    models: [
      {
        id: 'openai-gpt5.6-luna',
        provider: 'openai',
        model: 'gpt-5.6-luna',
        name: 'GPT-5.6 Luna',
        description: 'Cheapest',
        reasoningEffort: 'medium',
      },
      {
        id: 'openai-gpt5.6-terra',
        provider: 'openai',
        model: 'gpt-5.6-terra',
        name: 'GPT-5.6 Terra',
        description: 'Balanced',
        reasoningEffort: 'medium',
      },
      {
        id: 'openai-gpt5.6-sol',
        provider: 'openai',
        model: 'gpt-5.6-sol',
        name: 'GPT-5.6 Sol',
        description: 'Best',
        reasoningEffort: 'medium',
      },
    ],
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: '/assets/claude.svg',
    requiresKey: true,
    models: [
      {
        id: 'claude-sonnet',
        provider: 'claude',
        model: 'claude-sonnet-5',
        name: 'Sonnet 5',
        description: 'Cheapest',
      },
      {
        id: 'claude-opus',
        provider: 'claude',
        model: 'claude-opus-5',
        name: 'Opus 5',
        description: 'Balanced',
      },
      { id: 'claude-fable', provider: 'claude', model: 'claude-fable-5', name: 'Fable 5', description: 'Best' },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: '/assets/gemini.svg',
    requiresKey: true,
    models: [
      { id: 'gemini-flash', provider: 'gemini', model: 'gemini-2.5-flash', name: 'Flash', description: 'Cheapest' },
      { id: 'gemini-pro', provider: 'gemini', model: 'gemini-2.5-pro', name: 'Pro', description: 'Balanced' },
    ],
  },
];

export const DEFAULT_MODEL_ID = 'groq-llama-8b';

export function getModelById(id: string): AIModel | undefined {
  for (const provider of AI_PROVIDERS) {
    const model = provider.models.find((m) => m.id === id);
    if (model) return model;
  }
  // Handle dynamic Ollama models (format: ollama-<modelname--tag>)
  if (id.startsWith('ollama-')) {
    const encodedName = id.slice(7); // Remove 'ollama-' prefix
    const modelName = encodedName.replace('--', ':'); // Decode -- back to :
    const displayName = modelName.split(':')[0];
    return {
      id,
      provider: 'ollama',
      model: modelName,
      name: displayName,
      description: 'Local',
    };
  }
  return undefined;
}

export function getProviderById(id: AIProvider): AIProviderConfig | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

// Ollama status and models
export interface OllamaStatus {
  available: boolean;
  models: AIModel[];
}

export async function fetchOllamaStatus(baseUrl = DEFAULT_OLLAMA_URL): Promise<OllamaStatus> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });

    if (!response.ok) {
      return { available: false, models: [] };
    }

    const data = await response.json();
    const models: AIModel[] = (data.models || []).map((m: any) => {
      // Parse model name and size from the response
      const displayName = m.name?.split(':')[0] || m.name;
      const sizeGB = m.size ? (m.size / 1e9).toFixed(1) : '?';
      // Use full model name (with tag) in ID, replacing : with -- for URL safety
      const fullModelName = m.name || displayName;
      return {
        id: `ollama-${fullModelName.replace(':', '--')}`,
        provider: 'ollama' as AIProvider,
        model: fullModelName,
        name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        description: `Local, ${sizeGB}GB`,
      };
    });

    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  }
}

export interface AIConfig {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

// Storage keys
const STORAGE_KEYS: Record<string, string> = {
  groq: 'surfpool_groq_api_key',
  anthropic: 'surfpool_anthropic_api_key',
  openai: 'surfpool_openai_api_key',
  google: 'surfpool_google_api_key',
  ollama_url: 'surfpool_ollama_url',
};

// Get/Set API keys from localStorage
export function getApiKey(provider: AIProvider): string | null {
  if (typeof window === 'undefined') return null;
  const keyMap: Record<AIProvider, string> = {
    groq: STORAGE_KEYS.groq,
    claude: STORAGE_KEYS.anthropic,
    openai: STORAGE_KEYS.openai,
    gemini: STORAGE_KEYS.google,
    ollama: STORAGE_KEYS.ollama_url,
  };
  // Ollama doesn't need a key, return default URL if not set
  if (provider === 'ollama') {
    return localStorage.getItem(keyMap[provider]) || DEFAULT_OLLAMA_URL;
  }
  return localStorage.getItem(keyMap[provider]);
}

export function setApiKey(provider: AIProvider, apiKey: string): void {
  if (typeof window === 'undefined') return;
  const keyMap: Record<AIProvider, string> = {
    groq: STORAGE_KEYS.groq,
    claude: STORAGE_KEYS.anthropic,
    openai: STORAGE_KEYS.openai,
    gemini: STORAGE_KEYS.google,
    ollama: STORAGE_KEYS.ollama_url,
  };
  localStorage.setItem(keyMap[provider], apiKey);
}

export function clearApiKey(provider: AIProvider): void {
  if (typeof window === 'undefined') return;
  const keyMap: Record<AIProvider, string> = {
    groq: STORAGE_KEYS.groq,
    claude: STORAGE_KEYS.anthropic,
    openai: STORAGE_KEYS.openai,
    gemini: STORAGE_KEYS.google,
    ollama: STORAGE_KEYS.ollama_url,
  };
  localStorage.removeItem(keyMap[provider]);
}

// Common headers for MCP requests
const MCP_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

// Parse SSE response from MCP (returns `data: {...}` format)
async function parseMCPResponse(response: Response): Promise<any> {
  const text = await response.text();
  // Handle SSE format: "data: {...}\n\n"
  const lines = text.split('\n').filter((line) => line.startsWith('data: '));
  if (lines.length > 0) {
    const jsonStr = lines[lines.length - 1].slice(6); // Remove "data: " prefix
    return JSON.parse(jsonStr);
  }
  // Fallback to direct JSON parse
  return JSON.parse(text);
}

// Fetch available MCP tools
export async function fetchMCPTools(mcpUrl: string): Promise<{ tools: MCPTool[]; sessionId: string | null }> {
  // Ensure mcpUrl ends with /mcp
  const endpoint = mcpUrl.endsWith('/mcp') ? mcpUrl : `${mcpUrl}/mcp`;

  // Initialize MCP session
  const initResponse = await fetch(endpoint, {
    method: 'POST',
    headers: MCP_HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'surfpool-studio', version: '1.0.0' },
      },
    }),
  });

  if (!initResponse.ok) {
    const text = await initResponse.text();
    throw new Error(`MCP initialize failed: ${text}`);
  }

  const sessionId = initResponse.headers.get('Mcp-Session-Id') || initResponse.headers.get('mcp-session-id');

  // Send initialized notification
  await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...MCP_HEADERS,
      ...(sessionId && { 'Mcp-Session-Id': sessionId }),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }),
  });

  // List tools
  const toolsResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...MCP_HEADERS,
      ...(sessionId && { 'Mcp-Session-Id': sessionId }),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    }),
  });

  if (!toolsResponse.ok) {
    const text = await toolsResponse.text();
    throw new Error(`MCP tools/list failed: ${text}`);
  }

  const toolsData = await parseMCPResponse(toolsResponse);
  return { tools: toolsData.result?.tools || [], sessionId };
}

// Call MCP tool
export async function callMCPTool(
  mcpUrl: string,
  toolName: string,
  args: Record<string, any>,
  sessionId?: string | null
): Promise<any> {
  // Ensure mcpUrl ends with /mcp
  const endpoint = mcpUrl.endsWith('/mcp') ? mcpUrl : `${mcpUrl}/mcp`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...MCP_HEADERS,
      ...(sessionId && { 'Mcp-Session-Id': sessionId }),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  });

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream')) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let result: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.result) result = parsed.result;
            if (parsed.error) throw new Error(parsed.error.message);
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }
    }
    return result;
  } else {
    const data = await parseMCPResponse(response);
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }
}

// Convert MCP tools to OpenAI function format
function mcpToolsToOpenAIFunctions(tools: MCPTool[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description || `Execute ${tool.name}`,
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    },
  }));
}

function mcpToolsToResponsesTools(tools: MCPTool[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    name: tool.name,
    description: tool.description || `Execute ${tool.name}`,
    parameters: tool.inputSchema || { type: 'object', properties: {} },
    strict: false,
  }));
}

// Convert MCP tools to Anthropic tool format
function mcpToolsToAnthropicTools(tools: MCPTool[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description || `Execute ${tool.name}`,
    input_schema: tool.inputSchema || { type: 'object', properties: {} },
  }));
}

// System prompt
const SYSTEM_PROMPT = `You are a Solana simulation expert helping developers create realistic onchain scenarios using Surfpool.

## Context
Surfpool is a local Solana simulation environment. The MCP (Model Context Protocol) server exposes tools to configure scenarios like price movements, liquidity changes, oracle updates, and protocol interactions.

IMPORTANT: A surfnet (simulation network) is ALREADY RUNNING. You do NOT need to call create_surfnet or start any network. The simulation environment is ready to use.

## Your Role
- Translate the developer's scenario description into concrete MCP tool calls
- Focus on creating SCENARIOS (account overrides, price changes, etc.) - NOT infrastructure setup
- Ask clarifying questions if the scenario is ambiguous (e.g., specific token addresses, price ranges, timing)

## Tools You Should Use
- get_override_templates: Get available override templates for protocols (Pyth, Raydium, etc.). Constants are summarized with an optionsCount only
- search_constant_options: Resolve a constant_ref value (price feed, market, token mint) by searching a template's constant options, e.g. query "SOL/USD"
- create_scenario: Create a new scenario with account overrides

## Tools You Should NOT Use
- create_surfnet: The network is already running

## Guidelines
- Be concise and action-oriented
- Use realistic values based on current Solana ecosystem norms
- When prices aren't specified, use reasonable defaults and state your assumptions
- For Pyth price feeds, prices use 8 decimal precision (e.g., $150.00 = 15000000000)

## Response Format
1. Briefly confirm your understanding of the scenario
2. List the tools you'll call and why
3. Execute the tools
4. Summarize what was created`;

/**
 * Keep a single cache breakpoint on the newest content block, so each round
 * reads the whole conversation processed so far instead of re-reading it. The
 * marker moves rather than accumulating: a request takes at most four, and only
 * the newest one earns reads.
 */
function moveCacheBreakpointToLastBlock(messages: any[]) {
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (block?.cache_control) delete block.cache_control;
    }
  }

  const lastContent = messages[messages.length - 1]?.content;
  const lastBlock = Array.isArray(lastContent) ? lastContent[lastContent.length - 1] : null;
  if (lastBlock) {
    lastBlock.cache_control = { type: 'ephemeral' };
  }
}

// Stream response from Claude
export async function* streamClaudeResponse(
  prompt: string,
  tools: MCPTool[],
  apiKey: string,
  mcpUrl: string,
  sessionId: string | null,
  model: string,
  thinkingEnabled: boolean = true,
  signal?: AbortSignal
): AsyncGenerator<{ type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error'; content: any }> {
  const anthropicTools = mcpToolsToAnthropicTools(tools);
  const disableThinking = model !== 'claude-fable-5' && !thinkingEnabled;

  let messages: any[] = [{ role: 'user', content: prompt }];
  // Room for the 4-round drill-down plus a retriable tool error, without allowing a real runaway.
  const MAX_ITERATIONS = 8;
  let iterations = 0;
  let finished = false;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        // Claude 5 models think by default and max_tokens caps thinking plus
        // response text together.
        max_tokens: 32000,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: anthropicTools,
        messages,
        stream: true,
        ...(disableThinking ? { thinking: { type: 'disabled' } } : {}),
      }),
      signal,
    });

    if (!response.ok) {
      const error = await response.text();
      yield { type: 'error', content: `Claude API error: ${error}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', content: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let currentToolUse: { id: string; name: string; input: string } | null = null;
    let currentThinking: { type: 'thinking'; thinking: string; signature: string } | null = null;
    let stopReason: string | null = null;
    const assistantContent: any[] = [];
    const toolUses: { id: string; name: string; input: any }[] = [];
    const toolResults: any[] = [];
    let currentTextBlock = '';

    const flushTextBlock = () => {
      if (currentTextBlock) {
        assistantContent.push({ type: 'text', text: currentTextBlock });
        currentTextBlock = '';
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);

            if (event.type === 'content_block_start') {
              if (event.content_block?.type === 'tool_use') {
                // Save any accumulated text first
                flushTextBlock();
                currentToolUse = {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  input: '',
                };
              } else if (event.content_block?.type === 'thinking') {
                flushTextBlock();
                currentThinking = { type: 'thinking', thinking: '', signature: '' };
              } else if (event.content_block?.type === 'redacted_thinking') {
                flushTextBlock();
                assistantContent.push(event.content_block);
              }
            } else if (event.type === 'content_block_delta') {
              if (event.delta?.type === 'text_delta') {
                yield { type: 'text', content: event.delta.text };
                currentTextBlock += event.delta.text;
              } else if (event.delta?.type === 'input_json_delta' && currentToolUse) {
                currentToolUse.input += event.delta.partial_json;
              } else if (event.delta?.type === 'thinking_delta' && currentThinking) {
                currentThinking.thinking += event.delta.thinking;
              } else if (event.delta?.type === 'signature_delta' && currentThinking) {
                currentThinking.signature = event.delta.signature;
              }
            } else if (event.type === 'content_block_stop') {
              if (currentThinking) {
                assistantContent.push(currentThinking);
                currentThinking = null;
              } else if (currentToolUse) {
                const toolInput = currentToolUse.input ? JSON.parse(currentToolUse.input) : {};
                yield { type: 'tool_use', content: { name: currentToolUse.name, input: toolInput } };

                // Track the tool use for the assistant message
                toolUses.push({ id: currentToolUse.id, name: currentToolUse.name, input: toolInput });
                assistantContent.push({
                  type: 'tool_use',
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  input: toolInput,
                });

                // Execute the tool via MCP
                try {
                  const result = await callMCPTool(mcpUrl, currentToolUse.name, toolInput, sessionId);
                  yield { type: 'tool_result', content: { name: currentToolUse.name, result } };
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: currentToolUse.id,
                    content: JSON.stringify(result),
                  });
                } catch (error: any) {
                  yield { type: 'tool_result', content: { name: currentToolUse.name, error: error.message } };
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: currentToolUse.id,
                    content: JSON.stringify({ error: error.message }),
                    is_error: true,
                  });
                }
                currentToolUse = null;
              }
            } else if (event.type === 'message_delta') {
              stopReason = event.delta?.stop_reason;
            }
          } catch (e) {
            // Ignore JSON parse errors for incomplete chunks
          }
        }
      }
    }

    // Save any remaining text
    flushTextBlock();

    // If we had tool calls and Claude wants to continue, add messages and loop
    if (toolResults.length > 0 && stopReason === 'tool_use') {
      messages.push({ role: 'assistant', content: assistantContent });
      messages.push({ role: 'user', content: toolResults });
      moveCacheBreakpointToLastBlock(messages);
    } else {
      if (stopReason === 'max_tokens') {
        yield {
          type: 'error',
          content: 'The model ran out of output budget before finishing. Try again, or narrow the request.',
        };
      } else if (stopReason === 'refusal') {
        yield { type: 'error', content: 'The model declined to answer this request.' };
      } else if (stopReason === 'model_context_window_exceeded') {
        yield {
          type: 'error',
          content: 'The conversation is too long for the model context window. Start a new generation.',
        };
      }
      finished = true;
      break;
    }
  }

  if (!finished) {
    yield {
      type: 'error',
      content: `Stopped after ${MAX_ITERATIONS} tool rounds without a final answer. Try a more specific request.`,
    };
  }

  yield { type: 'done', content: null };
}

// Stream response from OpenAI
export async function* streamOpenAIResponse(
  prompt: string,
  tools: MCPTool[],
  apiKey: string,
  mcpUrl: string,
  sessionId: string | null,
  model: string,
  thinkingEnabled: boolean = true,
  signal?: AbortSignal
): AsyncGenerator<{ type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error'; content: any }> {
  const responsesTools = mcpToolsToResponsesTools(tools);
  const reasoningEffort =
    AI_PROVIDERS.find((p) => p.id === 'openai')?.models.find((m) => m.model === model)?.reasoningEffort ?? 'medium';
  // GPT-5.6 defaults to medium when reasoning is omitted, so OFF must send an explicit 'none'.
  const effort = thinkingEnabled ? reasoningEffort : 'none';

  const MAX_ITERATIONS = 8;
  let previousResponseId: string | null = null;
  // First round sends the prompt; later rounds carry only the tool outputs via previous_response_id.
  let input: any[] = [{ role: 'user', content: prompt }];

  for (let iterations = 0; iterations < MAX_ITERATIONS; iterations++) {
    // instructions and tools are not inherited through previous_response_id, so they go every round.
    const body: any = {
      model,
      instructions: SYSTEM_PROMPT,
      input,
      tools: responsesTools,
      stream: true,
      store: true,
      reasoning: { effort },
    };
    if (previousResponseId) body.previous_response_id = previousResponseId;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const error = await response.text();
      yield { type: 'error', content: `OpenAI API error: ${error}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', content: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let responseId: string | null = null;
    const toolCalls: { call_id: string; name: string; arguments: string }[] = [];
    let streamError: string | null = null;
    let completed = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);
          switch (event.type) {
            case 'response.output_text.delta':
              if (event.delta) yield { type: 'text', content: event.delta };
              break;
            case 'response.output_item.done':
              if (event.item?.type === 'function_call') {
                toolCalls.push({
                  call_id: event.item.call_id,
                  name: event.item.name,
                  arguments: event.item.arguments || '',
                });
              }
              break;
            case 'response.completed':
              completed = true;
              responseId = event.response?.id ?? responseId;
              break;
            case 'response.incomplete':
              streamError =
                event.response?.incomplete_details?.reason === 'max_output_tokens'
                  ? 'The model ran out of output budget before finishing. Try again, or narrow the request.'
                  : `OpenAI response incomplete: ${event.response?.incomplete_details?.reason ?? 'unknown'}`;
              break;
            case 'response.failed':
              streamError = `OpenAI API error: ${event.response?.error?.message ?? 'response failed'}`;
              break;
            case 'error':
              streamError = `OpenAI API error: ${event.message ?? 'stream error'}`;
              break;
          }
        } catch (e) {
          // Ignore parse errors for partial chunks
        }
      }
    }

    if (streamError) {
      yield { type: 'error', content: streamError };
      return;
    }

    if (!completed) {
      yield { type: 'error', content: 'OpenAI stream ended before completing. Try again.' };
      return;
    }

    if (toolCalls.length === 0) {
      yield { type: 'done', content: null };
      return;
    }

    if (!responseId) {
      yield { type: 'error', content: 'OpenAI response completed without an id; cannot continue the tool calls.' };
      return;
    }

    const outputs: any[] = [];
    for (const tc of toolCalls) {
      const args = tc.arguments ? JSON.parse(tc.arguments) : {};
      yield { type: 'tool_use', content: { name: tc.name, input: args } };
      try {
        const result = await callMCPTool(mcpUrl, tc.name, args, sessionId);
        yield { type: 'tool_result', content: { name: tc.name, result } };
        outputs.push({ type: 'function_call_output', call_id: tc.call_id, output: JSON.stringify(result) });
      } catch (error: any) {
        yield { type: 'tool_result', content: { name: tc.name, error: error.message } };
        outputs.push({
          type: 'function_call_output',
          call_id: tc.call_id,
          output: JSON.stringify({ error: error.message }),
        });
      }
    }

    previousResponseId = responseId;
    input = outputs;
  }

  yield {
    type: 'error',
    content: `Stopped after ${MAX_ITERATIONS} tool rounds without a final answer. Try a more specific request.`,
  };
  yield { type: 'done', content: null };
}

// Stream response from Groq (OpenAI-compatible API)
export async function* streamGroqResponse(
  prompt: string,
  tools: MCPTool[],
  apiKey: string,
  mcpUrl: string,
  sessionId: string | null,
  model: string,
  signal?: AbortSignal
): AsyncGenerator<{ type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error'; content: any }> {
  const openaiTools = mcpToolsToOpenAIFunctions(tools);

  let messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];
  const MAX_ITERATIONS = 5;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const error = await response.text();
      yield { type: 'error', content: `Groq API error: ${error}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', content: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
    let finishReason: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            const delta = event.choices?.[0]?.delta;
            finishReason = event.choices?.[0]?.finish_reason || finishReason;

            if (delta?.content) {
              yield { type: 'text', content: delta.content };
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const existing = toolCalls.get(tc.index) || { id: '', name: '', arguments: '' };
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                toolCalls.set(tc.index, existing);
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    // Process tool calls
    if (toolCalls.size > 0 && finishReason === 'tool_calls') {
      const toolResults: any[] = [];
      const assistantToolCalls: any[] = [];

      for (const [_, tc] of toolCalls) {
        const input = tc.arguments ? JSON.parse(tc.arguments) : {};
        yield { type: 'tool_use', content: { name: tc.name, input } };

        assistantToolCalls.push({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        });

        try {
          const result = await callMCPTool(mcpUrl, tc.name, input, sessionId);
          yield { type: 'tool_result', content: { name: tc.name, result } };
          toolResults.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        } catch (error: any) {
          yield { type: 'tool_result', content: { name: tc.name, error: error.message } };
          toolResults.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ error: error.message }),
          });
        }
      }

      messages.push({ role: 'assistant', tool_calls: assistantToolCalls });
      messages.push(...toolResults);
    } else {
      // No more tool calls - exit loop
      break;
    }
  }

  yield { type: 'done', content: null };
}

// Stream response from Gemini
export async function* streamGeminiResponse(
  prompt: string,
  tools: MCPTool[],
  apiKey: string,
  mcpUrl: string,
  sessionId: string | null,
  model: string,
  signal?: AbortSignal
): AsyncGenerator<{ type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error'; content: any }> {
  // Gemini uses a different format
  const geminiTools = [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description || `Execute ${tool.name}`,
        parameters: tool.inputSchema || { type: 'object', properties: {} },
      })),
    },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + prompt }] }],
        tools: geminiTools,
      }),
      signal,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    yield { type: 'error', content: `Gemini API error: ${error}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', content: 'No response body' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Gemini streams JSON array chunks
    try {
      // Try to parse complete JSON objects
      const jsonMatch = buffer.match(/\{[\s\S]*?\}(?=\s*,|\s*\]|$)/);
      if (jsonMatch) {
        const chunk = JSON.parse(jsonMatch[0]);
        buffer = buffer.slice(jsonMatch.index! + jsonMatch[0].length);

        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.text) {
            yield { type: 'text', content: part.text };
          }
          if (part.functionCall) {
            yield { type: 'tool_use', content: { name: part.functionCall.name, input: part.functionCall.args } };

            try {
              const result = await callMCPTool(mcpUrl, part.functionCall.name, part.functionCall.args || {}, sessionId);
              yield { type: 'tool_result', content: { name: part.functionCall.name, result } };
            } catch (error: any) {
              yield { type: 'tool_result', content: { name: part.functionCall.name, error: error.message } };
            }
          }
        }
      }
    } catch (e) {
      // Continue accumulating buffer
    }
  }

  yield { type: 'done', content: null };
}

// Stream response from Ollama (OpenAI-compatible API)
export async function* streamOllamaResponse(
  prompt: string,
  tools: MCPTool[],
  ollamaUrl: string,
  mcpUrl: string,
  sessionId: string | null,
  model: string,
  signal?: AbortSignal
): AsyncGenerator<{ type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error' | 'info'; content: any }> {
  const openaiTools = mcpToolsToOpenAIFunctions(tools);

  let messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];
  const MAX_ITERATIONS = 5;
  let iterations = 0;
  let useTools = openaiTools.length > 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await fetch(`${ollamaUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        tools: useTools ? openaiTools : undefined,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Check if the model doesn't support tools - retry without tools
      if (useTools && errorText.includes('does not support tools')) {
        useTools = false;
        yield { type: 'info', content: 'Model does not support tools, using text-only mode' };
        continue; // Retry without tools
      }
      yield { type: 'error', content: `Ollama API error: ${errorText}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', content: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
    let finishReason: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            const delta = event.choices?.[0]?.delta;
            finishReason = event.choices?.[0]?.finish_reason || finishReason;

            if (delta?.content) {
              yield { type: 'text', content: delta.content };
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const existing = toolCalls.get(tc.index) || { id: '', name: '', arguments: '' };
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                toolCalls.set(tc.index, existing);
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    // Process tool calls
    if (toolCalls.size > 0 && finishReason === 'tool_calls') {
      const toolResults: any[] = [];
      const assistantToolCalls: any[] = [];

      for (const [_, tc] of toolCalls) {
        const input = tc.arguments ? JSON.parse(tc.arguments) : {};
        yield { type: 'tool_use', content: { name: tc.name, input } };

        assistantToolCalls.push({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        });

        try {
          const result = await callMCPTool(mcpUrl, tc.name, input, sessionId);
          yield { type: 'tool_result', content: { name: tc.name, result } };
          toolResults.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        } catch (error: any) {
          yield { type: 'tool_result', content: { name: tc.name, error: error.message } };
          toolResults.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ error: error.message }),
          });
        }
      }

      messages.push({ role: 'assistant', tool_calls: assistantToolCalls });
      messages.push(...toolResults);
    } else {
      // No more tool calls - exit loop
      break;
    }
  }

  yield { type: 'done', content: null };
}

// Main streaming function
export async function* streamAIResponse(
  modelId: string,
  prompt: string,
  mcpUrl: string,
  signal?: AbortSignal,
  thinkingEnabled: boolean = true
): AsyncGenerator<{ type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error' | 'info'; content: any }> {
  // Get model config
  const modelConfig = getModelById(modelId);
  if (!modelConfig) {
    yield { type: 'error', content: `Unknown model: ${modelId}` };
    return;
  }

  const { provider, model } = modelConfig;

  // Get API key
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    yield { type: 'error', content: `No API key configured for ${provider}. Click the settings icon to add one.` };
    return;
  }

  // Fetch MCP tools
  yield { type: 'info', content: 'Connecting to MCP server...' };

  let tools: MCPTool[] = [];
  let sessionId: string | null = null;

  try {
    const mcpResult = await fetchMCPTools(mcpUrl);
    tools = mcpResult.tools;
    sessionId = mcpResult.sessionId;
    yield { type: 'info', content: `Found ${tools.length} available tools` };
  } catch (error: any) {
    yield { type: 'error', content: `Failed to connect to MCP: ${error.message}` };
    return;
  }

  // Stream based on provider
  yield { type: 'info', content: `Using ${modelConfig.name}...` };

  switch (provider) {
    case 'groq':
      yield* streamGroqResponse(prompt, tools, apiKey, mcpUrl, sessionId, model, signal);
      break;
    case 'claude':
      yield* streamClaudeResponse(prompt, tools, apiKey, mcpUrl, sessionId, model, thinkingEnabled, signal);
      break;
    case 'openai':
      yield* streamOpenAIResponse(prompt, tools, apiKey, mcpUrl, sessionId, model, thinkingEnabled, signal);
      break;
    case 'gemini':
      yield* streamGeminiResponse(prompt, tools, apiKey, mcpUrl, sessionId, model, signal);
      break;
    case 'ollama':
      // apiKey is actually the Ollama URL for this provider
      yield* streamOllamaResponse(prompt, tools, apiKey, mcpUrl, sessionId, model, signal);
      break;
  }
}
