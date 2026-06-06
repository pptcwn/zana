"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Pencil, Check } from "lucide-react";
import { updateProductAction, adjustStockAction } from "./actions";
import { toast } from "@/components/ui/feedback";
import type { ProductRow } from "@/lib/data/products";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

function StockModal({ product, onClose }: { product: ProductRow; onClose: () => void }) {
  const [qty, setQty] = useState("1");
  const [type, setType] = useState<"add" | "remove">("add");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(qty);
    if (!n || n <= 0) { setError("กรุณากรอกจำนวน"); return; }
    setSaving(true);
    setError("");
    try {
      await adjustStockAction(product.id, type === "add" ? n : -n, notes);
      toast.success("ปรับ stock แล้ว");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
    setSaving(false);
  }

  const inputCls = "input-luxe";

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="glass-strong w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-foreground">ปรับ Stock</p>
          <button onClick={onClose} className="text-pink-300 hover:text-pink-500"><X size={16} /></button>
        </div>
        <div className="bg-pink-50 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-foreground">{product.name}</p>
          <p className="text-xs text-pink-400 mt-0.5">คงเหลือ: {product.stock_qty} ชิ้น</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            {[["add", "เพิ่ม"], ["remove", "ลด"]].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setType(val as "add" | "remove")}
                className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${type === val ? "btn-primary border-pink-200" : "border-pink-100 text-muted-foreground hover:bg-pink-50"}`}>
                {label}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-pink-400 block mb-1">จำนวน</label>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} min="1" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-pink-400 block mb-1">หมายเหตุ</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="เช่น รับสินค้าจากซัพ" className={inputCls} />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-pink-100 text-muted-foreground py-2 rounded-lg text-sm hover:bg-pink-50">ยกเลิก</button>
            <button type="submit" disabled={saving}
              className="flex-1 btn-primary py-2 rounded-lg text-sm font-medium  disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={13} className="animate-spin" /> : null} บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InlineEdit({ value, onSave }: { value: number; onSave: (v: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(Number(val));
      setEditing(false);
    } catch {
      toast.error("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input type="number" value={val} onChange={(e) => setVal(e.target.value)}
          className="w-16 border border-pink-100 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-pink-300" autoFocus />
        <button onClick={handleSave} disabled={saving} className="text-emerald-400 hover:text-emerald-500">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
        </button>
        <button onClick={() => setEditing(false)} className="text-pink-200 hover:text-pink-400"><X size={11} /></button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1 group text-sm text-foreground/90 hover:text-foreground">
      {value}
      <Pencil size={10} className="text-pink-200 group-hover:text-pink-400" />
    </button>
  );
}

export default function ProductsClient({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const [stockModal, setStockModal] = useState<ProductRow | null>(null);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");

  const filtered = products.filter((p) => {
    if (filterActive === "active") return p.is_active;
    if (filterActive === "inactive") return !p.is_active;
    return true;
  });

  const lowStock = products.filter((p) => p.is_active && p.stock_qty <= p.low_stock_threshold);

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground mt-0.5">จัดการสินค้าและ stock</p>
      </div>

      {lowStock.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-2.5 text-xs text-amber-700">
          <span className="font-medium">สินค้าใกล้หมด:</span>{" "}
          {lowStock.map((p) => `${p.name} (${p.stock_qty} ชิ้น)`).join(" · ")}
        </div>
      )}

      <div className="flex gap-0.5 border border-pink-100 rounded-lg p-0.5 bg-white/70 w-fit">
        {[["active", "ขายอยู่"], ["inactive", "หยุดขาย"], ["all", "ทั้งหมด"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilterActive(val as typeof filterActive)}
            className={`text-xs px-2.5 py-1 rounded-md transition-colors ${filterActive === val ? "btn-primary" : "text-muted-foreground hover:text-pink-500"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-pink-100 text-xs text-pink-400">
              <th className="px-4 py-3 font-medium">สินค้า</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">ราคาขาย</th>
              <th className="px-4 py-3 font-medium">ต้นทุน</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">แจ้งเตือนที่</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-xs text-pink-200">ไม่พบสินค้า</td></tr>
            ) : filtered.map((p) => {
              const isLow = p.stock_qty <= p.low_stock_threshold;
              return (
                <tr key={p.id} className="hover:bg-pink-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground/70">{p.category}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground/70 font-mono">{p.sku}</td>
                  <td className="px-4 py-3">
                    <InlineEdit value={p.sell_price} onSave={async (v) => { await updateProductAction(p.id, { sell_price: v }); router.refresh(); }} />
                  </td>
                  <td className="px-4 py-3">
                    <InlineEdit value={p.cost_price} onSave={async (v) => { await updateProductAction(p.id, { cost_price: v }); router.refresh(); }} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${isLow ? "text-amber-500" : "text-foreground"}`}>{p.stock_qty}</span>
                  </td>
                  <td className="px-4 py-3">
                    <InlineEdit value={p.low_stock_threshold} onSave={async (v) => { await updateProductAction(p.id, { low_stock_threshold: v }); router.refresh(); }} />
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={async () => { await updateProductAction(p.id, { is_active: !p.is_active }); router.refresh(); }}
                      className={`text-xs px-2 py-0.5 rounded-md border transition-colors ${p.is_active ? "border-pink-100 text-pink-500 hover:bg-pink-50" : "border-slate-200 text-muted-foreground/70 hover:bg-slate-50"}`}>
                      {p.is_active ? "ขายอยู่" : "หยุดขาย"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setStockModal(p)}
                      className="text-xs px-2.5 py-1 border border-pink-100 rounded-lg text-pink-500 hover:bg-pink-50 transition-colors">
                      ปรับ stock
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {stockModal && <StockModal product={stockModal} onClose={() => { setStockModal(null); router.refresh(); }} />}
    </div>
  );
}
