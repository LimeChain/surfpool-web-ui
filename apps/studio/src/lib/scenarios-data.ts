export type ScenarioAction = {
  protocolId: string;
  actionId: string;
  protocol: string;
  action: string;
  account?: any; // Account address (Pubkey or PDA)
};

export type ScenarioStep = {
  id: string;
  name: string;
  type: string;
  status?: string;
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
  metadata?: Record<string, any>;
};
