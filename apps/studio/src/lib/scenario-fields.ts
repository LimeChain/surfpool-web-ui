type ScenarioField = { name: string; type: unknown; [key: string]: unknown };
type ScenarioTemplate = {
  accountType?: string;
  idl?: {
    accounts?: { name: string; type?: { fields?: ScenarioField[] } }[];
    types?: { name: string; type?: { kind?: string; fields?: ScenarioField[] } }[];
  };
  rawLayout?: unknown;
  properties?: { path: string; value_type?: unknown; encoding?: unknown }[];
};

function getIdlFields(template: ScenarioTemplate): ScenarioField[] {
  if (!template?.idl || !template?.accountType) return [];

  if (template.idl.accounts && Array.isArray(template.idl.accounts)) {
    const account = template.idl.accounts.find((acc) => acc.name === template.accountType);

    if (account?.type?.fields) {
      return account.type.fields;
    }
  }

  if (template.idl.types && Array.isArray(template.idl.types)) {
    const typeDefinition = template.idl.types.find(
      (type) => type.name === template.accountType && type.type?.kind === 'struct'
    );

    if (typeDefinition?.type?.fields) {
      return typeDefinition.type.fields;
    }
  }

  if (template.idl.types) {
    const structType = template.idl.types.find((type) => type.type?.kind === 'struct');

    if (structType?.type?.fields) {
      return structType.type.fields;
    }
  }

  return [];
}

// Raw-layout templates describe an IDL-less program; each property carries its own encoding.
function getRawLayoutFields(template: ScenarioTemplate): ScenarioField[] {
  if (!template?.rawLayout || !Array.isArray(template.properties)) return [];

  return template.properties.map((property) => ({
    name: property.path,
    type:
      typeof property.encoding === 'string'
        ? property.encoding
        : Object.keys((property.encoding as Record<string, unknown> | undefined) ?? {})[0]?.replace(/_strided$/, '') ||
          'u64',
  }));
}

export function getScenarioFields(template: ScenarioTemplate): ScenarioField[] {
  const fields = new Map<string, ScenarioField>();
  const baseFields = template?.idl && template?.accountType ? getIdlFields(template) : getRawLayoutFields(template);
  for (const field of baseFields) {
    fields.set(field.name, field);
  }
  for (const property of template.properties ?? []) {
    if (property.value_type !== undefined && property.value_type !== null) {
      fields.set(property.path, { ...fields.get(property.path), name: property.path, type: property.value_type });
    }
  }
  return [...fields.values()];
}
