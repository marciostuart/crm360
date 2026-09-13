export type LeadFieldMapping = {
  external_id?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string | null;
  custom_fields?: Record<string, string>;
};

function valueAtPath(input: unknown, path: string | null | undefined): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    if (Array.isArray(value)) {
      const index = Number(key);
      return Number.isInteger(index) && index >= 0 ? value[index] : undefined;
    }
    return (value as Record<string, unknown>)[key];
  }, input);
}

function text(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export function mapIncomingLead(input: unknown, mapping: LeadFieldMapping | null) {
  if (!mapping) return input;
  const result: Record<string, unknown> = {};
  for (const field of ["external_id", "name", "phone", "email", "source", "notes"] as const) {
    const value = text(valueAtPath(input, mapping[field]));
    if (value !== undefined && value.trim() !== "") result[field] = value;
  }
  if (mapping.custom_fields) {
    const custom: Record<string, unknown> = {};
    for (const [target, path] of Object.entries(mapping.custom_fields)) {
      const value = valueAtPath(input, path);
      if (value !== undefined && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")) custom[target] = value;
    }
    if (Object.keys(custom).length) result.custom_fields = custom;
  }
  return result;
}

export function parseLeadMapping(value: unknown): LeadFieldMapping | null {
  if (!value) return null;
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return null; } }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const mapping: LeadFieldMapping = {};
  for (const field of ["external_id", "name", "phone", "email", "source", "notes"] as const) if (typeof source[field] === "string") mapping[field] = source[field] as string;
  if (source.custom_fields && typeof source.custom_fields === "object" && !Array.isArray(source.custom_fields)) {
    const custom: Record<string, string> = {};
    for (const [key, path] of Object.entries(source.custom_fields as Record<string, unknown>)) if (/^[\w .-]{1,80}$/.test(key) && typeof path === "string" && path.length <= 191) custom[key] = path;
    if (Object.keys(custom).length) mapping.custom_fields = custom;
  }
  return Object.keys(mapping).length ? mapping : null;
}
