import rpcSchema from "@/data/rpc-schema.json";
import responseSchema from "@/data/response_schema.json";
import type { Endpoint } from "@/lib/rpc-endpoints";

// =================================================================================
// INTERNAL HELPERS
// =================================================================================

function resolveSchemaReference(ref: string, schemaSource: any): any {
  const refName = ref.split("/").pop();
  return refName ? (schemaSource.$defs as any)[refName] : null;
}
// =================================================================================
// EXPORTED SCHEMA PARSERS
// =================================================================================

/**
 * Recursively extracts and flattens parameters from a JSON schema definition for a method.
 * This function navigates through object properties, references ($ref), and other schema constructs
 * to produce a simple list of parameters for display.
 *
 * @param methodDef - The JSON schema definition for the method's parameters.
 * @param methodName - The name of the method, used for context in descriptions.
 * @param parentPath - The path of the parent object, for nested parameters.
 * @param nestingLevel - The current depth in the schema, for indentation and layout.
 * @param isParentOptional - Indicates if the parent parameter is optional.
 * @returns An array of parameter objects for the endpoint.
 */
export function extractParametersFromSchema(
  methodDef: any,
  methodName: string,
  parentPath: string = "",
  nestingLevel: number = 0,
  isParentOptional = false,
  parentName: string = "",
): Endpoint["params"] {
  if (!methodDef || typeof methodDef !== "object") return [];

  const properties = methodDef.properties || {};
  const required = new Set(methodDef.required || []);

  const params: Endpoint["params"] = [];

  Object.entries(properties).forEach(([propName, propDef]: [string, any]) => {
    const isOptional = isParentOptional || !required.has(propName);
    const displayName = propName;

    function getBestDescription(def: any, fallbackName: string): string {
      if (def && def.description) return def.description;
      if (def && def.$ref) {
        const referencedDef = resolveSchemaReference(def.$ref, rpcSchema);
        if (referencedDef && referencedDef.description) return referencedDef.description;
      }
      const baseName = fallbackName.split(".").pop()?.toLowerCase() || "";
      return `${baseName.charAt(0).toUpperCase() + baseName.slice(1)}`;
    }

    if (propDef.$ref) {
      const referencedDef = resolveSchemaReference(propDef.$ref, rpcSchema);
      if (
        referencedDef &&
        referencedDef.type === "object" &&
        referencedDef.properties
      ) {
        params.push({
          name: displayName,
          type: isOptional ? "object" : "object",
          description: getBestDescription(propDef, displayName) ||
            getBestDescription(referencedDef, displayName) ||
            `Configuration object`,
          isObjectHeader: true,
          parentName: parentName || undefined,
          required: !isOptional,
        });
        const nestedParams = extractParametersFromSchema(
          referencedDef,
          methodName,
          parentPath,
          nestingLevel + 1,
          isOptional,
          displayName,
        );
        params.push(...nestedParams);
        return;
      } else {
        const refName = propDef.$ref.split("/").pop();
        let refType = refName || "object";
        if (referencedDef) {
          if (referencedDef.type) {
            refType = referencedDef.type;
            if (Array.isArray(referencedDef.type)) {
              refType = referencedDef.type.filter((t: string) => t !== "null").join(" | ");
              if (referencedDef.type.includes("null")) refType += " (optional)";
            }
          } else if (referencedDef.enum) {
            refType = referencedDef.enum.map((e: any) => JSON.stringify(e)).join(" | ");
          } else if (referencedDef.oneOf) {
            refType = referencedDef.oneOf.map((option: any) => {
              if (option.type) return option.type;
              if (option.const) return `"${option.const}"`;
              return "unknown";
            }).join(" | ");
          }
        }
        params.push({
          name: displayName,
          type: refType,
          description: getBestDescription(propDef, displayName) || getBestDescription(referencedDef, displayName),
          isNested: nestingLevel > 0,
          parentName: parentName || undefined,
          required: !isOptional,
        });
        return;
      }
    }

    if (propDef.anyOf) {
      const nonNullOption = propDef.anyOf.find(
        (option: any) => option.type !== "null" && option.$ref,
      );
      if (nonNullOption && nonNullOption.$ref) {
        const referencedDef = resolveSchemaReference(
          nonNullOption.$ref,
          rpcSchema,
        );
        if (
          referencedDef &&
          referencedDef.type === "object" &&
          referencedDef.properties
        ) {
          params.push({
            name: displayName,
            type: "object",
            description: getBestDescription(propDef, displayName) ||
              getBestDescription(referencedDef, displayName) ||
              `Configuration object`,
            isObjectHeader: true,
            parentName: parentName || undefined,
            required: false,
          });
          const nestedParams = extractParametersFromSchema(
            referencedDef,
            methodName,
            parentPath,
            nestingLevel + 1,
            true,
            displayName,
          );
          params.push(...nestedParams);
          return;
        }
      }
    }

    if (propDef.type === "object" && propDef.properties) {
      params.push({
        name: displayName,
        type: "object",
        description: getBestDescription(propDef, displayName) ||
          `Configuration object`,
        isObjectHeader: true,
        parentName: parentName || undefined,
        required: !isOptional,
      });
      const nestedParams = extractParametersFromSchema(
        propDef,
        methodName,
        parentPath,
        nestingLevel + 1,
        isOptional,
        displayName,
      );
      params.push(...nestedParams);
      return;
    }

    let type = "string";
    let description = getBestDescription(propDef, propName);

    if (propDef.type) {
      if (Array.isArray(propDef.type)) {
        type = propDef.type.filter((t: string) => t !== "null").join(" | ");
        if (propDef.type.includes("null")) {
          type += " (optional)";
        }
      } else {
        type = propDef.type;
        if (propDef.format) {
          type = propDef.type;
        }
        if (type === "array" && propDef.items) {
          if (propDef.items.type) {
            type = `array[${propDef.items.type}]`;
            if (!description && propDef.items.description) {
              description = propDef.items.description;
            }
          } else if (propDef.items.$ref) {
            const refName = propDef.items.$ref.split("/").pop();
            type = `array[${refName}]`;
            const referencedDef = resolveSchemaReference(propDef.items.$ref, rpcSchema);
            if (!description && referencedDef && referencedDef.description) {
              description = referencedDef.description;
            }
          } else {
            type = "array";
          }
        }
      }
    } else if (propDef.oneOf) {
      type = "union type";
      const unionTypes = propDef.oneOf.map((option: any) => {
        if (option.type) return option.type;
        if (option.const) return `"${option.const}"`;
        if (option.$ref) return option.$ref.split("/").pop();
        return "unknown";
      });
      if (unionTypes.length > 0) {
        type = unionTypes.join(" | ");
      }
    }

    params.push({
      name: displayName,
      type,
      description,
      isNested: nestingLevel > 0,
      parentName: parentName || undefined,
      required: !isOptional,
    });
  });

  return params;
}

export function generateSampleFromSchema(
  schemaObj: any,
  schemaSource: any,
  fieldName?: string,
): any {
  if (!schemaObj) return null;

  // Handle $ref
  if (schemaObj.$ref) {
    const refPath = schemaObj.$ref.replace("#/$defs/", "");
    const referencedSchema = (schemaSource.$defs as any)[refPath];
    if (referencedSchema) {
      return generateSampleFromSchema(referencedSchema, schemaSource, refPath || fieldName);
    }
    return null;
  }

  // Handle const values
  if (schemaObj.const !== undefined) {
    return schemaObj.const;
  }

  // Handle enums - return first value
  if (schemaObj.enum && Array.isArray(schemaObj.enum) && schemaObj.enum.length > 0) {
    return schemaObj.enum[0];
  }

  // Handle anyOf - pick first non-null option
  if (schemaObj.anyOf) {
    const nonNullOption = schemaObj.anyOf.find((item: any) => item.type !== "null");
    if (nonNullOption) {
      return generateSampleFromSchema(nonNullOption, schemaSource, fieldName);
    }
    return null;
  }

  // Handle oneOf - pick first non-null option
  if (schemaObj.oneOf) {
    const nonNullOption = schemaObj.oneOf.find((item: any) => item.type !== "null");
    if (nonNullOption) {
      return generateSampleFromSchema(nonNullOption, schemaSource, fieldName);
    }
    return null;
  }

  // Handle objects
  if (schemaObj.type === "object" && schemaObj.properties) {
    const sample: any = {};
    Object.entries(schemaObj.properties).forEach(
      ([key, value]: [string, any]) => {
        sample[key] = generateSampleFromSchema(value, schemaSource, key);
      },
    );
    return sample;
  }

  // Handle arrays
  if (schemaObj.type === "array" && schemaObj.items) {
    if (Array.isArray(schemaObj.items)) {
      return schemaObj.items.map((item: any) =>
        generateSampleFromSchema(item, schemaSource, fieldName),
      );
    }
    return [generateSampleFromSchema(schemaObj.items, schemaSource, fieldName)];
  }

  // Handle primitive types with realistic examples
  if (schemaObj.type) {
    switch (schemaObj.type) {
      case "string":
        // Use field name to generate contextual examples
        if (fieldName) {
          const name = fieldName.toLowerCase();
          if (name.includes("pubkey") || name.includes("address") || name.includes("account")) {
            return "83astBRguLMdt2h5U1Tpdq5tjFoJ6noeGwaY3mDLVcri";
          }
          if (name.includes("signature") || name.includes("sig")) {
            return "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";
          }
          if (name.includes("hash") || name.includes("blockhash")) {
            return "EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N";
          }
          if (name.includes("encoding")) {
            return "base64";
          }
          if (name.includes("commitment")) {
            return "finalized";
          }
        }
        return "string";
      case "integer":
        if (fieldName) {
          const name = fieldName.toLowerCase();
          if (name.includes("slot")) return 123456789;
          if (name.includes("lamport") || name.includes("balance")) return 1000000000;
          if (name.includes("epoch")) return 100;
        }
        return 0;
      case "number":
        return 0;
      case "boolean":
        return true;
      case "null":
        return null;
      case "array":
        return [];
      case "object":
        return {};
      default:
        return schemaObj.type;
    }
  }

  // If we have default value, use it
  if (schemaObj.default !== undefined) {
    return schemaObj.default;
  }

  return null;
}

export function formatResponseSchema(schema: any, methodName?: string): string {
  if (!schema) {
    return JSON.stringify({ error: "Schema not found" }, null, 2);
  }

  const sampleResponse = generateSampleFromSchema(
    schema,
    responseSchema,
    methodName,
  );

  return JSON.stringify(
    {
      jsonrpc: "2.0",
      id: 1,
      result: sampleResponse,
    },
    null,
    2,
  );
}
