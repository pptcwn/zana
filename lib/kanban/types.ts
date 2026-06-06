export type KanbanEntity = "order" | "customer" | "followup";

export type KanbanCard = {
  id: string;
  entity: KanbanEntity;
  stage: string;
  sortOrder: number;
  updatedAt: string;
  title: string;
  subtitle: string;
  meta?: string;
};

export type KanbanColumn = {
  id: string;
  label: string;
};

export type KanbanSnapshot = Record<KanbanEntity, KanbanCard[]>;

export type MoveKanbanInput = {
  entity: KanbanEntity;
  id: string;
  toStage: string;
  sortOrder: number;
  expectedUpdatedAt: string;
};
