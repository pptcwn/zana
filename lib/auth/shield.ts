import "server-only";

import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";

export const ADMIN_ROLES = [
  "admin",
  "ceo",
  "telesales",
  "clerk",
  "stock",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type Capability =
  | "orders:write"
  | "customers:write"
  | "crm:write"
  | "ad-spend:write"
  | "products:write";

export type AuthorizedAdmin = {
  userId: string;
  adminId: string;
  role: AdminRole;
};

export type AuthorizationErrorCode =
  | "UNAUTHENTICATED"
  | "ADMIN_NOT_LINKED"
  | "ADMIN_INACTIVE"
  | "FORBIDDEN";

export class AuthorizationError extends Error {
  constructor(public readonly code: AuthorizationErrorCode) {
    super(code);
    this.name = "AuthorizationError";
  }
}

const CAPABILITIES: Record<AdminRole, readonly Capability[]> = {
  admin: [
    "orders:write",
    "customers:write",
    "crm:write",
    "ad-spend:write",
    "products:write",
  ],
  ceo: [
    "orders:write",
    "customers:write",
    "crm:write",
    "ad-spend:write",
    "products:write",
  ],
  telesales: ["orders:write", "customers:write", "crm:write"],
  clerk: ["orders:write", "customers:write", "ad-spend:write"],
  stock: ["products:write"],
};

function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

export async function requireCapability(
  capability: Capability
): Promise<AuthorizedAdmin> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AuthorizationError("UNAUTHENTICATED");
  }

  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("id, role, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (adminError) {
    throwDatabaseError(adminError, "requireCapability");
  }

  if (!admin) {
    throw new AuthorizationError("ADMIN_NOT_LINKED");
  }

  if (!admin.is_active) {
    throw new AuthorizationError("ADMIN_INACTIVE");
  }

  if (!isAdminRole(admin.role) || !CAPABILITIES[admin.role].includes(capability)) {
    throw new AuthorizationError("FORBIDDEN");
  }

  return {
    userId: user.id,
    adminId: admin.id,
    role: admin.role,
  };
}
