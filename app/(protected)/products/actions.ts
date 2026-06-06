"use server";

import { revalidatePath } from "next/cache";
import { updateProduct, adjustStock } from "@/lib/data/products";

export async function updateProductAction(id: string, input: Parameters<typeof updateProduct>[1]) {
  await updateProduct(id, input);
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function adjustStockAction(id: string, qtyChange: number, notes: string) {
  await adjustStock(id, qtyChange, notes);
  revalidatePath("/products");
  revalidatePath("/dashboard");
}
