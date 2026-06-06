"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateProduct, adjustStock } from "@/lib/data/products";
import { requireCapability } from "@/lib/auth/shield";

const productUpdateSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  sell_price: z.number().nonnegative().optional(),
  cost_price: z.number().nonnegative().optional(),
  low_stock_threshold: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional(),
});

export async function updateProductAction(id: string, input: Parameters<typeof updateProduct>[1]) {
  await requireCapability("products:write");
  await updateProduct(z.uuid().parse(id), productUpdateSchema.parse(input));
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function adjustStockAction(id: string, qtyChange: number, notes: string) {
  const admin = await requireCapability("products:write");
  await adjustStock(
    z.uuid().parse(id),
    z.number().int().refine((value) => value !== 0).parse(qtyChange),
    z.string().trim().max(1000).parse(notes),
    admin.adminId
  );
  revalidatePath("/products");
  revalidatePath("/dashboard");
}
