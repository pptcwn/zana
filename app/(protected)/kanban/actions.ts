"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/auth/shield";
import { moveKanbanCard } from "@/lib/data/kanban";
import type { Capability } from "@/lib/auth/capabilities";
import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";

const schema = z.object({
  entity: z.enum(["order", "customer", "followup"]),
  id: z.uuid(),
  toStage: z.string().min(1).max(50),
  sortOrder: z.number().int().positive(),
  expectedUpdatedAt: z.iso.datetime(),
});

export async function moveKanbanCardAction(input: z.infer<typeof schema>) {
  const parsed = schema.parse(input);
  const capabilityByEntity: Record<typeof parsed.entity, Capability> = {
    order: "kanban:orders",
    customer: "kanban:customers",
    followup: "kanban:followups",
  };
  const capability = capabilityByEntity[parsed.entity];
  const admin = await requireCapability(capability);
  const result = await moveKanbanCard(parsed, admin.adminId);
  revalidatePath("/kanban");
  revalidatePath("/orders");
  revalidatePath("/customers");
  revalidatePath("/crm");
  return result;
}

const rebalanceSchema = z.object({
  entity: z.enum(["order", "customer", "followup"]),
  stage: z.string().min(1).max(50),
});

export async function rebalanceKanbanColumnAction(
  input: z.infer<typeof rebalanceSchema>
) {
  const parsed = rebalanceSchema.parse(input);
  const capabilityByEntity: Record<typeof parsed.entity, Capability> = {
    order: "kanban:orders",
    customer: "kanban:customers",
    followup: "kanban:followups",
  };
  const admin = await requireCapability(capabilityByEntity[parsed.entity]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("rebalance_kanban_column", {
    p_entity_type: parsed.entity,
    p_stage: parsed.stage,
    p_admin_id: admin.adminId,
  });
  if (error) throwDatabaseError(error, "rebalanceKanbanColumn");
  revalidatePath("/kanban");
}
