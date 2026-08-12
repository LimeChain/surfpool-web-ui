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
  streamOpenAIResponse,
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
    const model = getModelById('claude-sonnet');
    expect(model).toBeDefined();
    expect(model?.provider).toBe('claude');
  });

  it('drops Haiku 4.5 and offers Fable 5', () => {
    expect(getModelById('claude-haiku')).toBeUndefined();
    expect(getModelById('claude-fable')?.model).toBe('claude-fable-5');
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

const OA_TOOLCALL = (callId: string, args: string, respId: string): SSEEvent[] => [
  {
    type: 'response.output_item.done',
    item: { type: 'function_call', call_id: callId, name: 'create_scenario', arguments: args },
  },
  { type: 'response.completed', response: { id: respId } },
];

const OA_FINAL: SSEEvent[] = [
  { type: 'response.output_text.delta', delta: 'Scenario created.' },
  { type: 'response.completed', response: { id: 'resp_final' } },
];

const mockOpenAIRounds = (rounds: SSEEvent[][]) => {
  const requests: any[] = [];
  const urls: string[] = [];
  const fetchMock = vi.fn(async (url: unknown, init: any) => {
    if (String(url).includes('api.openai.com')) {
      urls.push(String(url));
      requests.push(JSON.parse(init.body));
      return { ok: true, body: sseBody(rounds[requests.length - 1] ?? []) };
    }
    return mcpToolResult();
  });
  vi.stubGlobal('fetch', fetchMock);
  return { requests, urls };
};

const runOpenAITurn = async (opts: { thinkingEnabled?: boolean; model?: string } = {}) => {
  const events: { type: string; content: any }[] = [];
  const gen = streamOpenAIResponse(
    'crash SOL',
    TOOLS,
    'key',
    'http://mcp',
    null,
    opts.model ?? 'gpt-5.6-terra',
    opts.thinkingEnabled ?? true
  );
  for await (const event of gen) events.push(event);
  return events;
};

describe('streamOpenAIResponse (Responses API)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to /v1/responses with flat tools, instructions, input and store:true', async () => {
    const { requests, urls } = mockOpenAIRounds([OA_FINAL]);
    await runOpenAITurn();
    expect(urls[0]).toBe('https://api.openai.com/v1/responses');
    expect(requests[0].tools[0]).toEqual({
      type: 'function',
      name: 'create_scenario',
      description: 'Create a scenario',
      parameters: { type: 'object', properties: {} },
      strict: false,
    });
    expect(requests[0].store).toBe(true);
    expect(typeof requests[0].instructions).toBe('string');
    expect(requests[0].input).toEqual([{ role: 'user', content: 'crash SOL' }]);
  });

  it('sends reasoning effort medium when thinking is on', async () => {
    const { requests } = mockOpenAIRounds([OA_FINAL]);
    await runOpenAITurn({ thinkingEnabled: true });
    expect(requests[0].reasoning).toEqual({ effort: 'medium' });
  });

  it('sends reasoning effort none when thinking is off', async () => {
    const { requests } = mockOpenAIRounds([OA_FINAL]);
    await runOpenAITurn({ thinkingEnabled: false });
    expect(requests[0].reasoning).toEqual({ effort: 'none' });
  });

  it('reads several function calls from response.output_item.done events', async () => {
    const round: SSEEvent[] = [
      {
        type: 'response.output_item.done',
        item: { type: 'function_call', call_id: 'c1', name: 'create_scenario', arguments: '{"id":"a"}' },
      },
      {
        type: 'response.output_item.done',
        item: { type: 'function_call', call_id: 'c2', name: 'create_scenario', arguments: '{"id":"b"}' },
      },
      { type: 'response.completed', response: { id: 'resp_1' } },
    ];
    const { requests } = mockOpenAIRounds([round, OA_FINAL]);
    const events = await runOpenAITurn();
    expect(events.filter((e) => e.type === 'tool_use')).toHaveLength(2);
    const outputs = requests[1].input;
    expect(outputs.map((o: any) => o.call_id)).toEqual(['c1', 'c2']);
    expect(outputs.every((o: any) => o.type === 'function_call_output')).toBe(true);
  });

  it('continues with previous_response_id, instructions, tools and only the new tool outputs', async () => {
    const { requests } = mockOpenAIRounds([OA_TOOLCALL('call_1', '{"id":"s1"}', 'resp_1'), OA_FINAL]);
    await runOpenAITurn();
    expect(requests).toHaveLength(2);
    expect(requests[1].previous_response_id).toBe('resp_1');
    expect(typeof requests[1].instructions).toBe('string');
    expect(requests[1].tools).toHaveLength(1);
    expect(requests[1].input).toEqual([
      {
        type: 'function_call_output',
        call_id: 'call_1',
        output: JSON.stringify({ content: [{ type: 'text', text: 'created' }] }),
      },
    ]);
  });

  it('surfaces response.failed as an error', async () => {
    mockOpenAIRounds([[{ type: 'response.failed', response: { error: { message: 'boom' } } }]]);
    const events = await runOpenAITurn();
    expect(events.find((e) => e.type === 'error')?.content).toContain('boom');
  });

  it('surfaces response.incomplete as an error', async () => {
    mockOpenAIRounds([[{ type: 'response.incomplete', response: { incomplete_details: { reason: 'max_output_tokens' } } }]]);
    const events = await runOpenAITurn();
    expect(events.some((e) => e.type === 'error')).toBe(true);
  });

  it('treats a stream that never completes as an error, not a silent done', async () => {
    mockOpenAIRounds([[{ type: 'response.output_text.delta', delta: 'partial' }]]);
    const events = await runOpenAITurn();
    expect(events.some((e) => e.type === 'done')).toBe(false);
    expect(events.find((e) => e.type === 'error')?.content).toContain('ended before completing');
  });

  it('does not continue a tool round when the response completed without an id', async () => {
    const round: SSEEvent[] = [
      {
        type: 'response.output_item.done',
        item: { type: 'function_call', call_id: 'c1', name: 'create_scenario', arguments: '{}' },
      },
      { type: 'response.completed', response: {} },
    ];
    const { requests } = mockOpenAIRounds([round, OA_FINAL]);
    const events = await runOpenAITurn();
    expect(requests).toHaveLength(1);
    expect(events.find((e) => e.type === 'error')?.content).toContain('cannot continue');
  });

  it('stops after MAX_ITERATIONS tool rounds without a final answer', async () => {
    const toolRound = OA_TOOLCALL('call_x', '{}', 'resp_x');
    const { requests } = mockOpenAIRounds(Array.from({ length: 9 }, () => toolRound));
    const events = await runOpenAITurn();
    expect(requests).toHaveLength(8);
    expect(events.find((e) => e.type === 'error')?.content).toContain('Stopped after 8 tool rounds');
  });
});

const runClaudeTurn = async (model: string, thinkingEnabled: boolean) => {
  const events: { type: string; content: any }[] = [];
  for await (const event of streamClaudeResponse('crash SOL', TOOLS, 'key', 'http://mcp', null, model, thinkingEnabled)) {
    events.push(event);
  }
  return events;
};

describe('streamClaudeResponse thinking toggle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('disables thinking for Sonnet/Opus when the toggle is off', async () => {
    const requests = mockAnthropicRounds([FINAL_ROUND]);
    await runClaudeTurn('claude-sonnet-5', false);
    expect(requests[0].thinking).toEqual({ type: 'disabled' });
  });

  it('omits the thinking field when thinking is on', async () => {
    const requests = mockAnthropicRounds([FINAL_ROUND]);
    await runClaudeTurn('claude-opus-5', true);
    expect(requests[0].thinking).toBeUndefined();
  });

  it('never disables thinking for Fable 5, even when the toggle is off', async () => {
    const requests = mockAnthropicRounds([FINAL_ROUND]);
    await runClaudeTurn('claude-fable-5', false);
    expect(requests[0].thinking).toBeUndefined();
  });

  it('reports a generation stopped by the model context window', async () => {
    mockAnthropicRounds([
      [
        { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'partial' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'model_context_window_exceeded' } },
      ],
    ]);
    const events = await runClaudeTurn('claude-opus-5', true);
    expect(events.find((e) => e.type === 'error')?.content).toContain('context window');
  });
});
