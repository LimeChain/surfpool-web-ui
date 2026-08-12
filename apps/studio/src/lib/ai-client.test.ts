import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MCPTool } from './ai-client';
import {
  AI_PROVIDERS,
  clearApiKey,
  DEFAULT_MODEL_ID,
  fetchOllamaStatus,
  getApiKey,
  getModelById,
  getProviderById,
  setApiKey,
  streamClaudeResponse,
} from './ai-client';

describe('AI_PROVIDERS', () => {
  it('contains all expected providers', () => {
    const ids = AI_PROVIDERS.map((p) => p.id);
    expect(ids).toContain('groq');
    expect(ids).toContain('ollama');
    expect(ids).toContain('openai');
    expect(ids).toContain('claude');
    expect(ids).toContain('gemini');
  });

  it('each provider has required fields', () => {
    for (const provider of AI_PROVIDERS) {
      expect(provider.id).toBeTruthy();
      expect(provider.name).toBeTruthy();
      expect(provider.icon).toBeTruthy();
      expect(typeof provider.requiresKey).toBe('boolean');
    }
  });

  it('ollama does not require a key', () => {
    const ollama = AI_PROVIDERS.find((p) => p.id === 'ollama');
    expect(ollama?.requiresKey).toBe(false);
  });

  it('all non-ollama providers require a key', () => {
    const nonOllama = AI_PROVIDERS.filter((p) => p.id !== 'ollama');
    for (const provider of nonOllama) {
      expect(provider.requiresKey).toBe(true);
    }
  });
});

describe('DEFAULT_MODEL_ID', () => {
  it('is a valid model', () => {
    expect(getModelById(DEFAULT_MODEL_ID)).toBeDefined();
  });
});

describe('getModelById', () => {
  it('finds a known static model', () => {
    const model = getModelById('groq-llama-8b');
    expect(model).toBeDefined();
    expect(model?.provider).toBe('groq');
    expect(model?.model).toBe('llama-3.1-8b-instant');
  });

  it('finds claude models', () => {
    const model = getModelById('claude-haiku');
    expect(model).toBeDefined();
    expect(model?.provider).toBe('claude');
  });

  it('returns undefined for unknown model', () => {
    expect(getModelById('nonexistent-model')).toBeUndefined();
  });

  it('handles dynamic ollama models', () => {
    const model = getModelById('ollama-llama3--latest');
    expect(model).toBeDefined();
    expect(model?.provider).toBe('ollama');
    expect(model?.model).toBe('llama3:latest');
    expect(model?.name).toBe('llama3');
    expect(model?.description).toBe('Local');
  });

  it('handles ollama model without tag', () => {
    const model = getModelById('ollama-mistral');
    expect(model).toBeDefined();
    expect(model?.model).toBe('mistral');
  });
});

describe('getProviderById', () => {
  it('finds a known provider', () => {
    const provider = getProviderById('claude');
    expect(provider).toBeDefined();
    expect(provider?.name).toBe('Claude');
  });

  it('returns undefined for unknown provider', () => {
    expect(getProviderById('unknown' as any)).toBeUndefined();
  });
});

describe('API key storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves API keys', () => {
    setApiKey('groq', 'test-key-123');
    expect(getApiKey('groq')).toBe('test-key-123');
  });

  it('returns null for unset keys', () => {
    expect(getApiKey('openai')).toBeNull();
  });

  it('ollama returns default URL when not set', () => {
    expect(getApiKey('ollama')).toBe('http://localhost:11434');
  });

  it('ollama returns custom URL when set', () => {
    setApiKey('ollama', 'http://custom:1234');
    expect(getApiKey('ollama')).toBe('http://custom:1234');
  });

  it('clears API keys', () => {
    setApiKey('claude', 'sk-test');
    clearApiKey('claude');
    expect(getApiKey('claude')).toBeNull();
  });
});

describe('fetchOllamaStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns available models on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          models: [
            { name: 'llama3:latest', size: 4700000000 },
            { name: 'mistral:7b', size: 7000000000 },
          ],
        }),
    });

    const status = await fetchOllamaStatus('http://localhost:11434');
    expect(status.available).toBe(true);
    expect(status.models).toHaveLength(2);
    expect(status.models[0].id).toBe('ollama-llama3--latest');
    expect(status.models[0].provider).toBe('ollama');
    expect(status.models[0].name).toBe('Llama3');
    expect(status.models[0].description).toContain('Local');
  });

  it('returns unavailable on fetch error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connection refused'));
    const status = await fetchOllamaStatus();
    expect(status.available).toBe(false);
    expect(status.models).toHaveLength(0);
  });

  it('returns unavailable on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const status = await fetchOllamaStatus();
    expect(status.available).toBe(false);
    expect(status.models).toHaveLength(0);
  });
});

type SSEEvent = Record<string, unknown>;

const TOOLS: MCPTool[] = [
  { name: 'create_scenario', description: 'Create a scenario', inputSchema: { type: 'object', properties: {} } },
];

const sseBody = (events: SSEEvent[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });

const mcpToolResult = () => ({
  ok: true,
  headers: { get: () => 'application/json' },
  text: async () => JSON.stringify({ result: { content: [{ type: 'text', text: 'created' }] } }),
});

const mockAnthropicRounds = (rounds: SSEEvent[][]) => {
  const requests: any[] = [];

  const fetchMock = vi.fn(async (url: unknown, init: any) => {
    if (String(url).includes('api.anthropic.com')) {
      requests.push(JSON.parse(init.body));
      return { ok: true, body: sseBody(rounds[requests.length - 1] ?? []) };
    }
    return mcpToolResult();
  });

  vi.stubGlobal('fetch', fetchMock);
  return requests;
};

const runTurn = async () => {
  const events: { type: string; content: any }[] = [];
  for await (const event of streamClaudeResponse('crash SOL', TOOLS, 'test-key', 'http://mcp', null, 'claude-opus-5')) {
    events.push(event);
  }
  return events;
};

const THINKING_BLOCK: SSEEvent[] = [
  { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Pick the SOL/USD feed.' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'SIG-ABC' } },
  { type: 'content_block_stop', index: 0 },
];

const TOOL_CALL: SSEEvent[] = [
  {
    type: 'content_block_start',
    index: 1,
    content_block: { type: 'tool_use', id: 'toolu_1', name: 'create_scenario' },
  },
  { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"id":"s1"}' } },
  { type: 'content_block_stop', index: 1 },
  { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
];

const FINAL_ROUND: SSEEvent[] = [
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Scenario created.' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
];

const assistantContentOf = (request: any) => request.messages.find((m: any) => m.role === 'assistant').content;

describe('streamClaudeResponse thinking round-trip', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the thinking block with the tool results, unchanged and before the tool call', async () => {
    const requests = mockAnthropicRounds([[...THINKING_BLOCK, ...TOOL_CALL], FINAL_ROUND]);

    await runTurn();

    expect(requests).toHaveLength(2);
    expect(assistantContentOf(requests[1])).toEqual([
      { type: 'thinking', thinking: 'Pick the SOL/USD feed.', signature: 'SIG-ABC' },
      { type: 'tool_use', id: 'toolu_1', name: 'create_scenario', input: { id: 's1' } },
    ]);
    expect(requests[1].messages.at(-1).role).toBe('user');
    expect(requests[1].messages.at(-1).content).toEqual([
      expect.objectContaining({
        type: 'tool_result',
        tool_use_id: 'toolu_1',
        content: JSON.stringify({ content: [{ type: 'text', text: 'created' }] }),
      }),
    ]);
  });

  it('keeps a thinking block whose text was omitted, carrying only the signature', async () => {
    const omittedThinking: SSEEvent[] = [
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'SIG-OMITTED' } },
      { type: 'content_block_stop', index: 0 },
    ];
    const requests = mockAnthropicRounds([[...omittedThinking, ...TOOL_CALL], FINAL_ROUND]);

    await runTurn();

    expect(assistantContentOf(requests[1])[0]).toEqual({ type: 'thinking', thinking: '', signature: 'SIG-OMITTED' });
  });

  it('preserves the order when text arrives between the thinking block and the tool call', async () => {
    const textBlock: SSEEvent[] = [
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Setting the feed.' } },
      { type: 'content_block_stop', index: 1 },
    ];
    const requests = mockAnthropicRounds([[...THINKING_BLOCK, ...textBlock, ...TOOL_CALL], FINAL_ROUND]);

    await runTurn();

    expect(assistantContentOf(requests[1]).map((block: any) => block.type)).toEqual(['thinking', 'text', 'tool_use']);
  });

  it('passes a redacted_thinking block through unchanged', async () => {
    const redactedThinking: SSEEvent[] = [
      { type: 'content_block_start', index: 0, content_block: { type: 'redacted_thinking', data: 'EncRypTedBloB' } },
      { type: 'content_block_stop', index: 0 },
    ];
    const requests = mockAnthropicRounds([[...redactedThinking, ...TOOL_CALL], FINAL_ROUND]);

    await runTurn();

    expect(assistantContentOf(requests[1])[0]).toEqual({ type: 'redacted_thinking', data: 'EncRypTedBloB' });
  });

  it('sends only the tool call when the model did not think', async () => {
    const requests = mockAnthropicRounds([TOOL_CALL, FINAL_ROUND]);

    await runTurn();

    expect(assistantContentOf(requests[1])).toEqual([
      { type: 'tool_use', id: 'toolu_1', name: 'create_scenario', input: { id: 's1' } },
    ]);
  });

  it('still streams the text, the tool call and its result to the caller', async () => {
    mockAnthropicRounds([[...THINKING_BLOCK, ...TOOL_CALL], FINAL_ROUND]);

    const events = await runTurn();

    expect(events.filter((e) => e.type === 'tool_use')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'tool_result')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'text').map((e) => e.content)).toEqual(['Scenario created.']);
    expect(events.some((e) => e.type === 'error')).toBe(false);
  });

  it('caches the system prompt and moves the breakpoint to the newest block', async () => {
    const requests = mockAnthropicRounds([[...THINKING_BLOCK, ...TOOL_CALL], FINAL_ROUND]);

    await runTurn();

    expect(requests[0].system).toEqual([
      { type: 'text', text: expect.any(String), cache_control: { type: 'ephemeral' } },
    ]);

    const followUp = requests[1].messages;
    const toolResults = followUp.at(-1).content;
    expect(toolResults.at(-1).cache_control).toEqual({ type: 'ephemeral' });

    const marked = followUp
      .flatMap((message: any) => (Array.isArray(message.content) ? message.content : []))
      .filter((block: any) => block.cache_control);
    expect(marked).toHaveLength(1);
  });

  it('reports a generation cut short by the output budget', async () => {
    mockAnthropicRounds([
      [
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'I will crea' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'max_tokens' } },
      ],
    ]);

    const events = await runTurn();

    expect(events.filter((e) => e.type === 'error').map((e) => e.content)).toEqual([
      'The model ran out of output budget before finishing. Try again, or narrow the request.',
    ]);
  });
});
