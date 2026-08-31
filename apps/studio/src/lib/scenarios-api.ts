import type { ScenarioBentoItem } from '@/components/svm/scenarios-bento.types';
import { stringify } from 'lossless-json';
import { callMCPTool, fetchMCPTools } from './ai-client';
import { PROTOCOLS } from './protocol-icons';
import type { Scenario } from './scenarios-data';

export type PumpGraduationScenarioResult = {
  id: string;
  tokenMint: string;
  completingBuyAmount: number;
  migrationReserve: number;
  addresses: {
    bondingCurve: string;
    curveVault: string;
    canonicalPool: string;
  };
};

export async function createPumpGraduationScenario(
  studioUrl: string,
  tokenMint: string
): Promise<PumpGraduationScenarioResult> {
  const response = await fetch(`${studioUrl}/v1/scenarios/pump-graduation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenMint: tokenMint.trim() }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Pump graduation validation failed (${response.status})`);
  }

  return response.json();
}

export type PumpSwapPriceShockScenarioResult = {
  id: string;
  tokenMint: string;
  canonicalPool: string;
  virtualQuoteReserves: string;
};

export async function createPumpSwapPriceShockScenario(
  studioUrl: string,
  tokenMint: string,
  virtualQuoteReserves: string
): Promise<PumpSwapPriceShockScenarioResult> {
  const response = await fetch(`${studioUrl}/v1/scenarios/pump-swap-price-shock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tokenMint: tokenMint.trim(),
      virtualQuoteReserves: virtualQuoteReserves.trim(),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `PumpSwap price shock validation failed (${response.status})`);
  }

  return response.json();
}

export type ScenarioCreationResult = {
  id: string;
};

export async function createPhoenixCollateralScenario(
  studioUrl: string,
  trader: string,
  targetQuoteLots: string
): Promise<ScenarioCreationResult> {
  return createScenarioWithMcpTool(studioUrl, 'create_phoenix_collateral_scenario', {
    trader: trader.trim(),
    targetQuoteLots: targetQuoteLots.trim(),
  });
}

type ScenarioTemplateConstantOption = {
  id: string;
  label: string;
  value: string;
};

type ScenarioTemplateConstant = {
  label: string;
  description: string;
  options: ScenarioTemplateConstantOption[];
};

type ScenarioTemplate = {
  id: string;
  address: unknown;
  constants?: Record<string, ScenarioTemplateConstant>;
};

async function scenarioTemplate(studioUrl: string, templateId: string): Promise<ScenarioTemplate> {
  const response = await fetch(`${studioUrl}/v1/scenarios/templates`);
  if (!response.ok) {
    throw new Error(`Failed to load scenario templates: ${response.status}`);
  }

  const templates = (await response.json()) as ScenarioTemplate[];
  const template = templates.find((candidate) => candidate.id === templateId);
  if (!template) throw new Error(`Scenario template ${templateId} is unavailable`);

  return template;
}

/**
 * Phoenix market symbols come from the direct-mark template's constant catalog. Returns []
 * on any failure so callers can fall back to free-text input.
 */
export async function fetchPhoenixMarketSymbols(studioUrl: string): Promise<string[]> {
  try {
    const template = await scenarioTemplate(studioUrl, 'phoenix-direct-mark-risk-shock');
    const options = template.constants?.market_symbol?.options ?? [];
    return options.map((option) => option.value);
  } catch {
    return [];
  }
}

export type TesseraMarketOption = {
  label: string;
  value: string;
};

/**
 * Tessera's live markets come from the fair-value template's constant catalog. Returns [] on any
 * failure so the dialog falls back to a free-text pubkey.
 */
export async function fetchTesseraMarkets(studioUrl: string): Promise<TesseraMarketOption[]> {
  try {
    const template = await scenarioTemplate(studioUrl, 'tessera-fair-value');
    const options = template.constants?.market?.options ?? [];
    return options.map((option) => ({ label: option.label, value: option.value }));
  } catch {
    return [];
  }
}

/**
 * The market is optional: omitting it lets the backend use its default market, which is the same
 * address the template carries. The price is a human decimal string; every atomic ratio is derived
 * backend-side from the two mints' decimals.
 */
export async function createTesseraFairValueScenario(
  studioUrl: string,
  market: string,
  price: string
): Promise<ScenarioCreationResult> {
  const trimmedMarket = market.trim();
  return createScenarioWithMcpTool(studioUrl, 'create_tessera_fair_value_scenario', {
    ...(trimmedMarket ? { market: trimmedMarket } : {}),
    price: price.trim(),
  });
}

/**
 * The market templates carry the perp asset map address, so these scenarios are built here and
 * posted to the generic API; only collateral stress needs a tool, for its vault-backing check.
 */
async function createPhoenixMarketScenario(
  studioUrl: string,
  templateId: string,
  name: string,
  description: string,
  label: string,
  tags: string[],
  values: Record<string, string>
): Promise<ScenarioCreationResult> {
  const template = await scenarioTemplate(studioUrl, templateId);
  const scenario = {
    id: crypto.randomUUID(),
    name,
    description,
    overrides: [
      {
        id: crypto.randomUUID(),
        // The Phoenix writers take tick values as decimal strings, exactly as typed.
        templateId: template.id,
        values,
        scenarioRelativeSlot: 0,
        label,
        enabled: true,
        fetchBeforeUse: false,
        account: template.address,
      },
    ],
    tags,
  };
  const body = stringify(scenario);
  if (!body) throw new Error('Failed to serialize Phoenix scenario');

  const response = await fetch(`${studioUrl}/v1/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to create Phoenix scenario: ${response.status}`);
  }

  const result = (await response.json()) as { id?: string };
  if (!result.id) throw new Error('Surfpool returned no scenario id');

  return { id: result.id };
}

export async function createPhoenixDirectMarkScenario(
  studioUrl: string,
  symbol: string,
  targetTicks: string
): Promise<ScenarioCreationResult> {
  return createPhoenixMarketScenario(
    studioUrl,
    'phoenix-direct-mark-risk-shock',
    `Phoenix ${symbol.trim()} Direct Mark Risk Shock`,
    'Set exact mark-price ticks in validated Phoenix Eternal risk state.',
    `Phoenix ${symbol.trim()} direct mark risk shock`,
    ['phoenix-eternal', 'direct-mark', 'risk'],
    { symbol: symbol.trim(), target_ticks: targetTicks.trim() }
  );
}

export async function createPhoenixReferencePriceScenario(
  studioUrl: string,
  symbol: string,
  spotTicks: string,
  perpTicks: string
): Promise<ScenarioCreationResult> {
  return createPhoenixMarketScenario(
    studioUrl,
    'phoenix-reference-price-divergence',
    `Phoenix ${symbol.trim()} Spot/Perp Reference Divergence`,
    'Set independent spot and external-perp references while preserving the current mark.',
    `Phoenix ${symbol.trim()} spot/perp reference divergence`,
    ['phoenix-eternal', 'reference-divergence', 'risk'],
    { symbol: symbol.trim(), spot_ticks: spotTicks.trim(), perp_ticks: perpTicks.trim() }
  );
}

/**
 * The seam for scenarios a template cannot express, where the backend must read live accounts to
 * compute the values: Phoenix collateral stress against its vault backing, Tessera fair value
 * against both mints' decimals.
 */
async function createScenarioWithMcpTool(
  studioUrl: string,
  toolName: string,
  args: Record<string, string>
): Promise<ScenarioCreationResult> {
  const { sessionId } = await fetchMCPTools(studioUrl);
  const result = (await callMCPTool(studioUrl, toolName, args, sessionId)) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  let text: string | undefined;
  for (const content of result.content ?? []) {
    if (content.type === 'text' && content.text) {
      text = content.text;
      break;
    }
  }
  if (!text) throw new Error(`Surfpool MCP tool ${toolName} returned no result`);

  const payload = JSON.parse(text) as { error?: string | null; url?: string | null };
  if (payload.error) throw new Error(payload.error);
  if (!payload.url) throw new Error(`Surfpool MCP tool ${toolName} returned no scenario URL`);

  const scenarioId = new URL(payload.url, studioUrl).searchParams.get('id');
  if (!scenarioId) throw new Error(`Surfpool MCP tool ${toolName} returned an invalid scenario URL`);
  return { id: scenarioId };
}

/**
 * Build the POST body for creating a new scenario.
 */
export function createScenarioPayload(scenario: Scenario) {
  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    overrides: [],
    tags: [],
  };
}

/**
 * The backend override document as PATCH payloads must send it. The index
 * signature lets fields the UI does not know about (loaded via
 * `ScenarioAction.original`) pass through a full-replace PATCH unharmed.
 */
export type OverridePayload = {
  id: string;
  templateId: string;
  values: Record<string, unknown>;
  scenarioRelativeSlot: number;
  label: string;
  enabled: boolean;
  fetchBeforeUse: boolean;
  account?: unknown;
  [passthrough: string]: unknown;
};

/**
 * Convert a scenario's steps/actions into the backend "overrides" format
 * and return the full PATCH payload. Mirrors the scenario editor's sync
 * payload: everything loaded from the backend (override ids, values, account,
 * fetchBeforeUse, enabled, tags) is carried through, so a metadata-only
 * update cannot strip a scenario of its data.
 */
export function buildUpdatePayload(scenario: Scenario) {
  const overrides = (scenario.steps || []).flatMap((step, stepIndex) => {
    const slotNumber = step.slotNumber ?? stepIndex;
    return (step.actions || []).map((action) => {
      const original = (action.original ?? {}) as Partial<OverridePayload>;
      const override: OverridePayload = {
        ...original,
        id: action.overrideId || `${action.actionId}_${slotNumber}`,
        templateId: action.actionId,
        values: flattenOverrideValues(action.overrides, action.modifiedFields),
        scenarioRelativeSlot: slotNumber,
        label: action.action,
        enabled: original.enabled ?? true,
        fetchBeforeUse: action.fetchBeforeUse || false,
      };
      if (action.account) {
        override.account = action.account;
      }
      return override;
    });
  });

  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description || '',
    overrides,
    tags: scenario.tags || [],
  };
}

/**
 * Collect an action's override values into the flat dot-notation map the backend expects.
 *
 * Values arrive in two shapes: entries restored from the backend (and constant_ref selections
 * like feed_id) are already flat at the top level, while fields edited in the UI live nested
 * inside the account-shaped editing state, reachable only through their dotted paths in
 * modifiedFields. Dropping either shape loses data, so both are collected.
 */
export function flattenOverrideValues(
  overrides: Record<string, unknown> | undefined,
  modifiedFields?: string[]
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  if (!overrides) return flat;

  const isNestedObject = (value: unknown): boolean =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

  for (const [key, value] of Object.entries(overrides)) {
    if (!isNestedObject(value)) {
      flat[key] = value;
    }
  }

  for (const path of modifiedFields ?? []) {
    if (path in flat) continue;

    let current: unknown = overrides;
    for (const key of path.split('.')) {
      if (isNestedObject(current)) {
        current = (current as Record<string, unknown>)[key];
      } else {
        current = undefined;
        break;
      }
    }

    if (current !== undefined && !isNestedObject(current)) {
      flat[path] = current;
    }
  }

  return flat;
}

/**
 * Map a Scenario to a ScenarioBentoItem for display in GenericBento.
 */
export function scenarioToBentoItem(scenario: Scenario): ScenarioBentoItem {
  return {
    id: String(scenario.id),
    name: String(scenario.name),
    description: String(scenario.description || 'No description available'),
    status: scenario.status
      ? {
          online: scenario.status === 'active' || scenario.status === 'running',
          status: String(scenario.status),
        }
      : undefined,
    created_at: scenario.created_at,
    updated_at: scenario.updated_at,
    steps: scenario.steps,
    tags: scenario.tags,
    metadata: scenario.metadata,
  };
}

/**
 * Augment a base prompt with selected protocol names.
 */
export function buildAiPrompt(basePrompt: string, selectedProtocolIds: Set<string>): string {
  const trimmed = basePrompt.trim();
  const selectedProtocolNames = PROTOCOLS.filter((p) => selectedProtocolIds.has(p.id)).map((p) => p.name);

  if (selectedProtocolNames.length === 0) {
    return trimmed;
  }

  return `${trimmed}\n\nUse only these protocols: ${selectedProtocolNames.join(', ')}.`;
}
