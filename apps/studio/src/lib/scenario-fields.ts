type ScenarioField = { name: string; type: unknown; [key: string]: unknown };
type ScenarioTemplate = {
  accountType?: string;
  idl?: {
    accounts?: { name: string; type?: { fields?: ScenarioField[] } }[];
    types?: { name: string; type?: { kind?: string; fields?: ScenarioField[] } }[];
  };
  properties?: { path: string; value_type?: unknown }[];
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

export function getScenarioFields(template: ScenarioTemplate): ScenarioField[] {
  const fields = new Map<string, ScenarioField>();
  for (const field of getIdlFields(template)) {
    fields.set(field.name, field);
  }
  for (const property of template.properties ?? []) {
    if (property.value_type !== undefined && property.value_type !== null) {
      fields.set(property.path, { ...fields.get(property.path), name: property.path, type: property.value_type });
    }
  }
  return [...fields.values()];
}
