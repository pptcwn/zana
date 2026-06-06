import type { KanbanColumn, KanbanEntity } from "./types";

export const KANBAN_COLUMNS: Record<KanbanEntity, KanbanColumn[]> = {
  order: [
    { id: "pending", label: "รอยืนยัน" },
    { id: "confirmed", label: "ยืนยันแล้ว" },
    { id: "packed", label: "แพ็กแล้ว" },
    { id: "shipped", label: "จัดส่งแล้ว" },
    { id: "delivered", label: "สำเร็จ" },
    { id: "cancelled", label: "ยกเลิก" },
  ],
  customer: [
    { id: "lead", label: "Lead" },
    { id: "contacted", label: "ติดต่อแล้ว" },
    { id: "qualified", label: "Qualified" },
    { id: "customer", label: "ลูกค้า" },
    { id: "repeat", label: "ซื้อซ้ำ" },
    { id: "inactive", label: "Inactive" },
  ],
  followup: [
    { id: "todo", label: "ต้องติดตาม" },
    { id: "in_progress", label: "กำลังดำเนินการ" },
    { id: "waiting", label: "รอลูกค้า" },
    { id: "done", label: "เสร็จแล้ว" },
    { id: "cancelled", label: "ยกเลิก" },
  ],
};

export function canMoveCard(
  entity: KanbanEntity,
  fromStage: string,
  toStage: string
) {
  if (fromStage === toStage) return true;
  if (entity === "order" && ["delivered", "cancelled"].includes(fromStage)) {
    return false;
  }
  return KANBAN_COLUMNS[entity].some((column) => column.id === toStage);
}
