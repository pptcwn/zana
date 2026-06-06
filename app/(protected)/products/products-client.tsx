"use client";

import { useState } from "react";
import { AlertTriangle, Plus, Minus, Loader2, Pencil, Check, X } from "lucide-react";
import { updateProductAction, adjustStockAction } from "./actions";
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
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">ปรับ Stock</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 mb-4">
          <p className="font-medium text-slate-800 text-sm">{product.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">คงเหลือ: {product.stock_qty} ชิ้น</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            {[["add", "เพิ่ม stock"], ["remove", "ลด stock"]].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setType(val as "add" | "remove")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${type === val ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">จำนวน</label>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} min="1"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">หมายเหตุ</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="เช่น รับสินค้าจากซัพพลายเออร์"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-500 py-2.5 rounded-xl text-sm hover:bg-slate-50">ยกเลิก</button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : (type === "add" ? <Plus size={14} /> : <Minus size={14} />)}
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InlineEdit({ value, onSave, prefix = "" }: {
  value: number; onSave: (v: number) => Promise<void>; prefix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(Number(val));
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input type="number" value={val} onChange={(e) => setVal(e.target.value)}
          className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900" autoFocus />
        <button onClick={handleSave} disabled={saving} className="text-emerald-500 hover:text-emerald-700">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        </button>
        <button onClick={() => setEditing(false)} className="text-slate-300 hover:text-slate-500"><X size={12} /></button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1 group text-sm text-slate-700 hover:text-slate-900">
      {prefix}{value}
      <Pencil size={11} className="text-slate-300 group-hover:text-slate-500" />
    </button>
  );
}

export default function ProductsClient({ products }: { products: ProductRow[] }) {
  const [stockModal, setStockModal] = useState<ProductRow | null>(null);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");

  const filtered = products.filter((p) => {
    if (filterActive === "active") return p.is_active;
    if (filterActive === "inactive") return !p.is_active;
    return true;
  });

  const lowStock = products.filter((p) => p.is_active && p.stock_qty <= p.low_stock_threshold);

  return (
    <div className="space-y-5">
      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">สินค้าใกล้หมด {lowStock.length} รายการ</p>
            <p className="text-xs text-amber-600 mt-0.5">{lowStock.map((p) => `${p.name} (${p.stock_qty} ชิ้น)`).join(" · ")}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[["active", "ขายอยู่"], ["inactive", "หยุดขาย"], ["all", "ทั้งหมด"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilterActive(val as typeof filterActive)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${filterActive === val ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">สินค้า</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">ราคาขาย</th>
                <th className="px-4 py-3 font-medium">ต้นทุน</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">แจ้งเตือนที่</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3 font-medium">ปรับ Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-300 text-sm">ไม่พบสินค้า</td></tr>
              ) : filtered.map((p) => {
                const isLow = p.stock_qty <= p.low_stock_threshold;
                return (
                  <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${isLow ? "bg-amber-50/30" : ""}`}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.category}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 font-mono">{p.sku}</td>
                    <td className="px-4 py-3.5">
                      <InlineEdit value={p.sell_price} prefix="฿"
                        onSave={(v) => updateProductAction(p.id, { sell_price: v })} />
                    </td>
                    <td className="px-4 py-3.5">
                      <InlineEdit value={p.cost_price} prefix="฿"
                        onSave={(v) => updateProductAction(p.id, { cost_price: v })} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`font-semibold ${isLow ? "text-amber-600" : "text-slate-800"}`}>
                        {p.stock_qty}
                        {isLow && <AlertTriangle size={12} className="inline ml-1 text-amber-500" />}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <InlineEdit value={p.low_stock_threshold}
                        onSave={(v) => updateProductAction(p.id, { low_stock_threshold: v })} />
                    </td>
                    <td className="px-4 py-3.5">
                      <button onClick={() => updateProductAction(p.id, { is_active: !p.is_active })}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${p.is_active ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}>
                        {p.is_active ? "ขายอยู่" : "หยุดขาย"}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <button onClick={() => setStockModal(p)}
                        className="border border-slate-200 text-slate-600 px-3 py-1 rounded-lg text-xs hover:bg-slate-50 transition-colors">
                        ปรับ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {stockModal && <StockModal product={stockModal} onClose={() => setStockModal(null)} />}
    </div>
  );
}
