import type { LosslessNumber } from 'lossless-json';

export type PersistSetting = boolean | { slots: number | LosslessNumber };

export type ScenarioAction = {
  protocolId: string;
  actionId: string;
  protocol: string;
  action: string;
  overrideId?: string;
  fetchBeforeUse?: boolean;
  persist?: PersistSetting;
  overrides?: Record<string, unknown>;
  modifiedFields?: string[];
  account?: any; // Account address (Pubkey or PDA)
  // The untouched backend override this action was loaded from. PATCH is a full
  // document replace, so update payloads spread this first — fields the UI does
  // not know about (enabled, future additions) survive the roundtrip
  original?: Record<string, unknown>;
};

export type ScenarioStep = {
  id: string;
  name: string;
  type: string;
  status?: string;
  slotNumber?: number;
  actions?: ScenarioAction[];
};

export type Scenario = {
  id: string;
  name: string;
  description?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  steps?: ScenarioStep[];
  tags?: string[];
  metadata?: Record<string, any>;
};
