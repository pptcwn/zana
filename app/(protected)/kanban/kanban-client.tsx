"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "@/components/ui/feedback";
import type { KanbanCard, KanbanEntity, KanbanSnapshot } from "@/lib/kanban/types";
import { optimisticMove, replaceCanonicalCard } from "@/lib/kanban/optimistic-move";
import { moveKanbanCardAction } from "./actions";
import { KanbanBoard } from "./components/kanban-board";

const LABEL: Record<KanbanEntity, string> = {
  order: "Orders",
  customer: "Customers",
  followup: "Follow-ups",
};

function KanbanContent({
  initialSnapshot,
  allowedEntities,
}: {
  initialSnapshot: KanbanSnapshot;
  allowedEntities: KanbanEntity[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [entity, setEntity] = useState<KanbanEntity>(allowedEntities[0] ?? "order");
  const queryKey = ["kanban", "snapshot"] as const;
  const { data = initialSnapshot } = useQuery({
    queryKey,
    queryFn: async () => initialSnapshot,
    initialData: initialSnapshot,
    staleTime: Infinity,
  });
  const mutation = useMutation({
    mutationFn: moveKanbanCardAction,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<KanbanSnapshot>(queryKey);
      queryClient.setQueryData<KanbanSnapshot>(queryKey, (current) =>
        current
          ? optimisticMove(current, input.entity, input.id, input.toStage, input.sortOrder)
          : current
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast.error("ย้ายรายการไม่สำเร็จ ข้อมูลถูกคืนตำแหน่งเดิม");
    },
    onSuccess: (partial, input) => {
      const previousCard = data[input.entity].find((card) => card.id === input.id);
      if (!previousCard) return;
      queryClient.setQueryData<KanbanSnapshot>(queryKey, (current) =>
        current
          ? replaceCanonicalCard(current, { ...previousCard, ...partial })
          : current
      );
    },
    onSettled: () => router.refresh(),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Workflow Canvas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ลาก node เพื่อเปลี่ยนขั้นตอน ระบบจะบันทึกแบบ transaction
          </p>
        </div>
        <div className="flex rounded-xl border border-pink-100 bg-white/60 p-1">
          {allowedEntities.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setEntity(item)}
              className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
                entity === item ? "btn-primary shadow-sm" : "text-muted-foreground hover:bg-pink-50"
              }`}
            >
              {LABEL[item]}
            </button>
          ))}
        </div>
      </div>
      <KanbanBoard
        entity={entity}
        cards={data[entity]}
        moving={mutation.isPending}
        onMove={(card: KanbanCard, stage, sortOrder) =>
          mutation.mutate({
            entity,
            id: card.id,
            toStage: stage,
            sortOrder,
            expectedUpdatedAt: card.updatedAt,
          })
        }
      />
    </div>
  );
}

export default function KanbanClient(props: {
  initialSnapshot: KanbanSnapshot;
  allowedEntities: KanbanEntity[];
}) {
  const [client] = useState(() => {
    return new QueryClient();
  });
  return (
    <QueryClientProvider client={client}>
      <KanbanContent {...props} />
    </QueryClientProvider>
  );
}
