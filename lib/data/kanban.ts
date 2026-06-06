import { createClient } from "@/lib/supabase/server";
import { throwDatabaseError } from "@/lib/errors/database-error";
import type { Capability } from "@/lib/auth/capabilities";
import type {
  KanbanCard,
  KanbanSnapshot,
  MoveKanbanInput,
} from "@/lib/kanban/types";

const EMPTY: KanbanSnapshot = { order: [], customer: [], followup: [] };

export async function getKanbanSnapshot(
  capabilities: Capability[]
): Promise<KanbanSnapshot> {
  const supabase = await createClient();
  const canOrders = capabilities.includes("kanban:orders");
  const canCustomers = capabilities.includes("kanban:customers");
  const canFollowups = capabilities.includes("kanban:followups");
  const [orders, customers, followups] = await Promise.all([
    canOrders
      ? supabase
          .from("orders")
          .select("id,order_number,platform,status,kanban_stage,sort_order,updated_at,total_amount,customers(name)")
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    canCustomers
      ? supabase
          .from("customers")
          .select("id,name,phone,platform,kanban_stage,sort_order,updated_at")
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    canFollowups
      ? supabase
          .from("followups")
          .select("id,followup_type,due_date,kanban_stage,sort_order,updated_at,customers(name,phone)")
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (orders.error) throwDatabaseError(orders.error, "getOrderKanban");
  if (customers.error) throwDatabaseError(customers.error, "getCustomerKanban");
  if (followups.error) throwDatabaseError(followups.error, "getFollowupKanban");

  return {
    ...EMPTY,
    order: (orders.data ?? []).map((row): KanbanCard => ({
      id: row.id,
      entity: "order",
      stage: row.kanban_stage,
      sortOrder: row.sort_order,
      updatedAt: row.updated_at,
      title: row.order_number,
      subtitle: row.customers?.name ?? "ไม่ระบุลูกค้า",
      meta: `${row.platform} · ฿${row.total_amount.toLocaleString("th-TH")}`,
    })),
    customer: (customers.data ?? []).map((row): KanbanCard => ({
      id: row.id,
      entity: "customer",
      stage: row.kanban_stage,
      sortOrder: row.sort_order,
      updatedAt: row.updated_at,
      title: row.name,
      subtitle: row.phone ?? "ไม่มีเบอร์โทร",
      meta: row.platform,
    })),
    followup: (followups.data ?? []).map((row): KanbanCard => ({
      id: row.id,
      entity: "followup",
      stage: row.kanban_stage,
      sortOrder: row.sort_order,
      updatedAt: row.updated_at,
      title: row.customers?.name ?? "ไม่ระบุลูกค้า",
      subtitle: `${row.followup_type} · ${row.due_date}`,
      meta: row.customers?.phone ?? undefined,
    })),
  };
}

export async function moveKanbanCard(
  input: MoveKanbanInput,
  adminId: string
) {
  const supabase = await createClient();
  const common = {
    p_to_stage: input.toStage,
    p_sort_order: input.sortOrder,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_admin_id: adminId,
    p_source: "web",
  };

  const result = input.entity === "order"
    ? await supabase.rpc("move_order_kanban_card", {
        ...common,
        p_order_id: input.id,
      })
    : input.entity === "customer"
      ? await supabase.rpc("move_customer_kanban_card", {
          ...common,
          p_customer_id: input.id,
        })
      : await supabase.rpc("move_followup_kanban_card", {
          ...common,
          p_followup_id: input.id,
        });

  if (result.error) throwDatabaseError(result.error, "moveKanbanCard");
  const row = result.data;
  if (!row) throw new Error("KANBAN_MOVE_RETURNED_NO_RESULT");

  return {
    id: row.id,
    entity: input.entity,
    stage: row.kanban_stage,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}
