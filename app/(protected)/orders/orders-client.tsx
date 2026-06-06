"use client";

import { useState, useMemo } from "react";
import { Plus, Search, X, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { createOrderAction, updateTrackingAction, updateStatusAction } from "./actions";
import type { OrderRow } from "@/lib/data/orders";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok", facebook: "Facebook", line: "Line OA", shopee: "Shopee",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "รอส่ง", shipped: "ส่งแล้ว", completed: "เสร็จสิ้น", cancelled: "ยกเลิก",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-400", shipped: "bg-blue-400", completed: "bg-emerald-400", cancelled: "bg-slate-300",
};

type Product = { id: string; name: string; sku: string; sell_price: number; cost_price: number; stock_qty: number };

function CreateOrderModal({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [payment, setPayment] = useState("transfer");
  const [shippingFee, setShippingFee] = useState(50);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ product_id: string; product_name: string; qty: number; unit_price: number; unit_cost: number }[]>([]);

  function addItem(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === productId);
      if (existing) return prev.map((i) => i.product_id === productId ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product_id: p.id, product_name: p.name, qty: 1, unit_price: p.sell_price, unit_cost: p.cost_price }];
    });
  }

  const total = items.reduce((s, i) => s + i.unit_price * i.qty, 0) + shippingFee - discount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !phone || items.length === 0) { setError("กรุณากรอกชื่อ, เบอร์ และเลือกสินค้า"); return; }
    setSaving(true);
    setError("");
    try {
      await createOrderAction({ customer: { name, phone, address, platform }, items, platform, payment_method: payment, shipping_fee: shippingFee, discount, notes });
      window.location.reload();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSaving(false);
    }
  }

  const inputCls = "w-full border border-pink-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pink-300 bg-white";

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-xl sm:max-w-xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-pink-100 px-6 py-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">สร้างออเดอร์ใหม่</p>
          <button onClick={onClose} className="text-pink-300 hover:text-pink-500"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-medium text-pink-400 uppercase tracking-wider">ลูกค้า</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">ชื่อ *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="คุณ..." />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">เบอร์ *</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="08x-xxx-xxxx" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-500 block mb-1">ที่อยู่จัดส่ง</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2}
                  className={`${inputCls} resize-none`} placeholder="บ้านเลขที่, ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
                <option value="tiktok">TikTok Shop</option>
                <option value="facebook">Facebook</option>
                <option value="line">Line OA</option>
                <option value="shopee">Shopee</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">ช่องทางชำระ</label>
              <select value={payment} onChange={(e) => setPayment(e.target.value)} className={inputCls}>
                <option value="transfer">โอนเงิน</option>
                <option value="cod">COD</option>
                <option value="credit_card">บัตรเครดิต</option>
                <option value="tiktok_pay">TikTok Pay</option>
                <option value="shopee_pay">ShopeePay</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-pink-400 uppercase tracking-wider">สินค้า *</p>
            <select onChange={(e) => { addItem(e.target.value); e.target.value = ""; }} defaultValue="" className={inputCls}>
              <option value="" disabled>เลือกสินค้า...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {fmt(p.sell_price)}</option>
              ))}
            </select>
            {items.map((item) => (
              <div key={item.product_id} className="flex items-center gap-3 py-2 border-b border-pink-50">
                <span className="flex-1 text-sm text-slate-700">{item.product_name}</span>
                <span className="text-xs text-slate-400">{fmt(item.unit_price)}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setItems((p) => p.map((i) => i.product_id === item.product_id ? { ...i, qty: Math.max(1, i.qty - 1) } : i))}
                    className="w-5 h-5 rounded border border-pink-100 text-pink-400 text-xs flex items-center justify-center hover:bg-pink-50">−</button>
                  <span className="text-sm w-5 text-center">{item.qty}</span>
                  <button type="button" onClick={() => setItems((p) => p.map((i) => i.product_id === item.product_id ? { ...i, qty: i.qty + 1 } : i))}
                    className="w-5 h-5 rounded border border-pink-100 text-pink-400 text-xs flex items-center justify-center hover:bg-pink-50">+</button>
                </div>
                <span className="text-sm font-medium text-slate-800 w-16 text-right">{fmt(item.unit_price * item.qty)}</span>
                <button type="button" onClick={() => setItems((p) => p.filter((i) => i.product_id !== item.product_id))}
                  className="text-pink-200 hover:text-pink-400"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">ค่าส่ง (฿)</label>
              <input type="number" value={shippingFee} onChange={(e) => setShippingFee(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">ส่วนลด (฿)</label>
              <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">หมายเหตุ</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="ไม่บังคับ" />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-pink-50">
            <div>
              <p className="text-xs text-pink-400">ยอดรวม</p>
              <p className="text-xl font-semibold text-slate-800">{fmt(total)}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-pink-100 text-slate-500 rounded-lg text-sm hover:bg-pink-50">ยกเลิก</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium hover:bg-pink-400 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} บันทึก
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
      </div>
    </div>
  );
}

function OrderPanel({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [savedTracking, setSavedTracking] = useState(order.tracking_number ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSaveTracking() {
    setSaving(true);
    try {
      await updateTrackingAction(order.id, tracking);
      setSavedTracking(tracking);
    } catch {
      alert("บันทึก tracking ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(status: string) {
    await updateStatusAction(order.id, status);
    onClose();
    window.location.reload();
  }

  const inputCls = "w-full border border-pink-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pink-300";

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm bg-white h-full overflow-y-auto border-l border-pink-100" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-pink-100 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">{order.order_number}</p>
            <p className="text-xs text-pink-300">{new Date(order.invoice_date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <button onClick={onClose} className="text-pink-300 hover:text-pink-500"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[order.status] ?? "bg-slate-300"}`} />
            <span className="text-sm text-slate-600">{STATUS_LABEL[order.status]}</span>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-pink-400 uppercase tracking-wider font-medium">ลูกค้า</p>
            <p className="text-sm font-medium text-slate-800">{order.customers?.name}</p>
            <p className="text-xs text-slate-500">{order.customers?.phone}</p>
            {order.customers?.address && <p className="text-xs text-slate-400 leading-relaxed">{order.customers.address}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-pink-400 mb-0.5">Platform</p>
              <p className="text-slate-700">{PLATFORM_LABEL[order.platform] ?? order.platform}</p>
            </div>
            <div>
              <p className="text-xs text-pink-400 mb-0.5">ชำระ</p>
              <p className="text-slate-700">{order.payment_method ?? "–"}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-pink-400 uppercase tracking-wider font-medium mb-2">สินค้า</p>
            <div className="space-y-1.5">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.product_name} ×{item.qty}</span>
                  <span className="text-slate-800">{fmt(item.unit_price * item.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-pink-50 space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>ค่าส่ง</span><span>{fmt(order.shipping_fee)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-xs text-slate-400">
                  <span>ส่วนลด</span><span>−{fmt(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold text-slate-800">
                <span>รวม</span><span>{fmt(order.total_amount)}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-pink-400 uppercase tracking-wider font-medium mb-2">Tracking</p>
            <div className="flex gap-2">
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} className={inputCls} placeholder="TH123456789" />
              <button onClick={handleSaveTracking} disabled={saving || tracking === savedTracking}
                className="px-3 py-1.5 bg-pink-500 text-white rounded-lg text-xs font-medium hover:bg-pink-400 disabled:opacity-40">
                {saving ? <Loader2 size={12} className="animate-spin" /> : "บันทึก"}
              </button>
            </div>
          </div>

          {order.notes && (
            <div>
              <p className="text-xs text-pink-400 uppercase tracking-wider font-medium mb-1">หมายเหตุ</p>
              <p className="text-sm text-slate-600">{order.notes}</p>
            </div>
          )}

          {order.status !== "cancelled" && order.status !== "completed" && (
            <div className="pt-3 border-t border-pink-50 space-y-2">
              <p className="text-xs text-pink-400 uppercase tracking-wider font-medium">เปลี่ยนสถานะ</p>
              <div className="flex gap-2">
                {order.status === "pending" && (
                  <button onClick={() => handleStatus("shipped")}
                    className="flex-1 border border-pink-100 text-slate-600 py-1.5 rounded-lg text-xs hover:bg-pink-50 transition-colors">
                    ส่งแล้ว
                  </button>
                )}
                {order.status === "shipped" && (
                  <button onClick={() => handleStatus("completed")}
                    className="flex-1 border border-pink-100 text-slate-600 py-1.5 rounded-lg text-xs hover:bg-pink-50 transition-colors">
                    เสร็จสิ้น
                  </button>
                )}
                <button onClick={() => handleStatus("cancelled")}
                  className="flex-1 border border-pink-100 text-slate-400 py-1.5 rounded-lg text-xs hover:bg-pink-50 transition-colors">
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrdersClient({ orders, products }: { orders: OrderRow[]; products: Product[] }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchSearch = !q || o.order_number.toLowerCase().includes(q) ||
        o.customers?.name?.toLowerCase().includes(q) || o.customers?.phone?.includes(q) ||
        o.tracking_number?.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || o.status === filterStatus;
      const matchPlat = filterPlatform === "all" || o.platform === filterPlatform;
      return matchSearch && matchStatus && matchPlat;
    });
  }, [orders, search, filterStatus, filterPlatform]);

  const counts = {
    pending: orders.filter((o) => o.status === "pending").length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    completed: orders.filter((o) => o.status === "completed").length,
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Orders</h1>
          <p className="text-xs text-pink-300 mt-0.5">จัดการออเดอร์ทั้งหมด</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500 text-white rounded-lg text-sm font-medium hover:bg-pink-400 transition-colors">
          <Plus size={14} /> สร้างออเดอร์
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "รอส่ง", count: counts.pending, dot: "bg-amber-400" },
          { label: "ส่งแล้ว", count: counts.shipped, dot: "bg-blue-400" },
          { label: "เสร็จสิ้น", count: counts.completed, dot: "bg-emerald-400" },
        ].map(({ label, count, dot }) => (
          <div key={label} className="bg-white border border-pink-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
            <span className="text-sm text-slate-500">{label}</span>
            <span className="ml-auto text-lg font-semibold text-slate-800">{count}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-300" />
          <input type="text" placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-pink-100 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-pink-300 text-slate-800 placeholder:text-pink-200 bg-white" />
        </div>
        <div className="flex gap-0.5 border border-pink-100 rounded-lg p-0.5 bg-white">
          {[["all", "ทั้งหมด"], ["pending", "รอส่ง"], ["shipped", "ส่งแล้ว"], ["completed", "เสร็จ"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${filterStatus === val ? "bg-pink-500 text-white" : "text-slate-500 hover:text-pink-500"}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}
          className="border border-pink-100 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none bg-white">
          <option value="all">ทุก Platform</option>
          <option value="tiktok">TikTok</option>
          <option value="facebook">Facebook</option>
          <option value="line">Line OA</option>
          <option value="shopee">Shopee</option>
        </select>
      </div>

      <div className="bg-white border border-pink-100 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-pink-50 text-xs text-pink-400">
              <th className="px-4 py-3 font-medium">ออเดอร์</th>
              <th className="px-4 py-3 font-medium">ลูกค้า</th>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium">ยอด</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium">Tracking</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-xs text-pink-200">ไม่พบรายการ</td></tr>
            ) : filtered.map((o) => (
              <tr key={o.id} onClick={() => setSelectedOrder(o)} className="hover:bg-pink-50/40 cursor-pointer transition-colors">
                <td className="px-4 py-3">
                  <p className="text-slate-800 font-medium">{o.order_number}</p>
                  <p className="text-xs text-pink-300">{new Date(o.invoice_date).toLocaleDateString("th-TH")}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-700">{o.customers?.name ?? "–"}</p>
                  <p className="text-xs text-slate-400">{o.customers?.phone}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{PLATFORM_LABEL[o.platform] ?? o.platform}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{fmt(o.total_amount)}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[o.status] ?? "bg-slate-300"}`} />
                    {STATUS_LABEL[o.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 font-mono">{o.tracking_number ?? "–"}</td>
                <td className="px-4 py-3"><ChevronRight size={14} className="text-pink-200" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateOrderModal products={products} onClose={() => setShowCreate(false)} />}
      {selectedOrder && <OrderPanel order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
}
