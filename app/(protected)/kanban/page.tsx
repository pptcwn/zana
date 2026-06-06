import { getAuthorizedAdmin } from "@/lib/auth/shield";
import { getKanbanSnapshot } from "@/lib/data/kanban";
import KanbanClient from "./kanban-client";

export default async function KanbanPage() {
  const admin = await getAuthorizedAdmin();
  const snapshot = await getKanbanSnapshot(admin.capabilities);
  return (
    <KanbanClient
      initialSnapshot={snapshot}
      allowedEntities={[
        ...(admin.capabilities.includes("kanban:orders") ? ["order" as const] : []),
        ...(admin.capabilities.includes("kanban:customers") ? ["customer" as const] : []),
        ...(admin.capabilities.includes("kanban:followups") ? ["followup" as const] : []),
      ]}
    />
  );
}
