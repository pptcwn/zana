export const ADMIN_ROLES = [
  "owner",
  "admin",
  "sales",
  "crm",
  "inventory",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const CAPABILITIES = [
  "dashboard:financial",
  "dashboard:sales",
  "dashboard:crm",
  "dashboard:inventory",
  "orders:write",
  "customers:write",
  "crm:write",
  "ad-spend:write",
  "products:write",
  "kanban:orders",
  "kanban:customers",
  "kanban:followups",
  "integrations:manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" &&
    (ADMIN_ROLES as readonly string[]).includes(value);
}

export function isCapability(value: unknown): value is Capability {
  return typeof value === "string" &&
    (CAPABILITIES as readonly string[]).includes(value);
}
