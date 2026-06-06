import "server-only";

import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";
import {
  isAdminRole,
  isCapability,
  type AdminRole,
  type Capability,
} from "@/lib/auth/capabilities";

export type AuthorizedAdmin = {
  userId: string;
  adminId: string;
  role: AdminRole;
  capabilities: Capability[];
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

type AdminContextPayload = {
  admin_id?: unknown;
  role?: unknown;
  capabilities?: unknown;
};

export async function getAuthorizedAdmin(): Promise<AuthorizedAdmin> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AuthorizationError("UNAUTHENTICATED");
  }

  const { data, error: adminError } = await supabase.rpc(
    "get_my_admin_context"
  );

  if (adminError) {
    throwDatabaseError(adminError, "requireCapability");
  }

  const context = data as AdminContextPayload | null;
  if (!context || typeof context.admin_id !== "string") {
    throw new AuthorizationError("ADMIN_NOT_LINKED");
  }

  if (!isAdminRole(context.role)) {
    throw new AuthorizationError("FORBIDDEN");
  }

  const capabilities = Array.isArray(context.capabilities)
    ? context.capabilities.filter(isCapability)
    : [];

  return {
    userId: user.id,
    adminId: context.admin_id,
    role: context.role,
    capabilities,
  };
}

export async function requireCapability(
  capability: Capability
): Promise<AuthorizedAdmin> {
  const admin = await getAuthorizedAdmin();
  if (!admin.capabilities.includes(capability)) {
    throw new AuthorizationError("FORBIDDEN");
  }
  return admin;
}
