"use client";

import { useState, useMemo } from "react";
import {
  Plus, Search, X, ChevronRight, Package, Truck, CheckCircle2,
  XCircle, Loader2, Trash2,
} from "lucide-react";
import { createOrderAction, updateTrackingAction, updateStatusAction } from "./actions";
import type { OrderRow } from "@/lib/data/orders";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  tiktok:   { label: "TikTok",   color: "bg-red-50 text-red-600 border-red-100" },
  facebook: { label: "Facebook", color: "bg-blue-50 text-blue-600 border-blue-100" },
  line:     { label: "Line OA",  color: "bg-green-50 text-green-600 border-green-100" },
  shopee:   { label: "Shopee",   color: "bg-orange-50 text-orange-600 border-orange-100" },
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "รอส่ง",    color: "bg-amber-50 text-amber-600",   icon: Package },
  shipped:   { label: "ส่งแล้ว",  color: "bg-blue-50 text-blue-600",    icon: Truck },
  completed: { label: "เสร็จสิ้น", color: "bg-emerald-50 text-emerald-600", icon: CheckCircle2 },
  cancelled: { label: "ยกเลิก",   color: "bg-slate-100 text-slate-500",  icon: XCircle },
};

type Product = { id: string; name: string; sku: string; sell_price: number; cost_price: number; stock_qty: number };

// ── Create Order Form ──────────────────────────────────────

function CreateOrderModal({ products, onClose, onCreated }: {
  products: Product[];
  onClose: () => void;
  onCreated: () => void;
}) {
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

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.product_id !== productId));
  }

  function updateQty(productId: string, qty: number) {
    if (qty < 1) return;
    setItems((prev) => prev.map((i) => i.product_id === productId ? { ...i, qty } : i));
  }

  const total = items.reduce((s, i) => s + i.unit_price * i.qty, 0) + shippingFee - discount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !phone || items.length === 0) {
      setError("กรุณากรอกชื่อ, เบอร์ และเลือกสินค้าอย่างน้อย 1 รายการ");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createOrderAction({ customer: { name, phone, address, platform }, items, platform, payment_method: payment, shipping_fee: shippingFee, discount, notes });
      onCreated();
      onClose();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">สร้างออเดอร์ใหม่</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Customer */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">ข้อมูลลูกค้า</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-slate-500 block mb-1">ชื่อลูกค้า *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="คุณ..." />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-slate-500 block mb-1">เบอร์โทร *</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="08x-xxx-xxxx" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-500 block mb-1">ที่อยู่จัดส่ง</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" placeholder="บ้านเลขที่, ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์" />
              </div>
            </div>
          </div>

          {/* Platform & Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white">
                <option value="tiktok">TikTok Shop</option>
                <option value="facebook">Facebook</option>
                <option value="line">Line OA</option>
                <option value="shopee">Shopee</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">ช่องทางชำระ</label>
              <select value={payment} onChange={(e) => setPayment(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white">
                <option value="transfer">โอนเงิน</option>
                <option value="cod">COD</option>
                <option value="credit_card">บัตรเครดิต</option>
                <option value="tiktok_pay">TikTok Pay</option>
                <option value="shopee_pay">ShopeePay</option>
              </select>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">สินค้า *</h3>
            <select onChange={(e) => { addItem(e.target.value); e.target.value = ""; }} defaultValue="" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white mb-3">
              <option value="" disabled>+ เลือกสินค้า</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {fmt(p.sell_price)}</option>
              ))}
            </select>
            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.product_id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2">
                    <span className="flex-1 text-sm text-slate-700">{item.product_name}</span>
                    <span className="text-xs text-slate-400">{fmt(item.unit_price)}</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateQty(item.product_id, item.qty - 1)} className="w-6 h-6 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">−</button>
                      <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                      <button type="button" onClick={() => updateQty(item.product_id, item.qty + 1)} className="w-6 h-6 rounded-lg bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center">+</button>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 w-16 text-right">{fmt(item.unit_price * item.qty)}</span>
                    <button type="button" onClick={() => removeItem(item.product_id)} className="text-slate-300 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shipping & Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">ค่าส่ง (฿)</label>
              <input type="number" value={shippingFee} onChange={(e) => setShippingFee(Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">ส่วนลด (฿)</label>
              <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">หมายเหตุ</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" placeholder="ไม่บังคับ" />
          </div>

          {/* Total */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">ยอดรวมทั้งหมด</span>
            <span className="text-xl font-bold text-slate-900">{fmt(total)}</span>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-500 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors">ยกเลิก</button>
            <button type="submit" disabled={saving} className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              บันทึกออเดอร์
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Order Detail Side Panel ────────────────────────────────

function OrderPanel({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [saving, setSaving] = useState(false);
  const [savedTracking, setSavedTracking] = useState(order.tracking_number ?? "");

  async function handleSaveTracking() {
    setSaving(true);
    await updateTrackingAction(order.id, tracking);
    setSavedTracking(tracking);
    setSaving(false);
  }

  async function handleStatus(status: string) {
    await updateStatusAction(order.id, status);
    onClose();
  }

  const statusMeta = STATUS_META[order.status] ?? STATUS_META.pending;
  const StatusIcon = statusMeta.icon;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-slate-900">{order.order_number}</p>
            <p className="text-xs text-slate-400">{new Date(order.invoice_date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusMeta.color}`}>
              <StatusIcon size={14} /> {statusMeta.label}
            </span>
          </div>

          {/* Customer */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">ลูกค้า</p>
            <p className="font-semibold text-slate-800">{order.customers?.name}</p>
            <p className="text-sm text-slate-500">{order.customers?.phone}</p>
            {order.customers?.address && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{order.customers.address}</p>}
          </div>

          {/* Platform & Payment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Platform</p>
              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${PLATFORM_META[order.platform]?.color ?? ""}`}>
                {PLATFORM_META[order.platform]?.label ?? order.platform}
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">ชำระ</p>
              <p className="text-sm font-medium text-slate-700">{order.payment_method ?? "–"}</p>
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">สินค้า</p>
            <div className="space-y-2">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-slate-700">{item.product_name} × {item.qty}</span>
                  <span className="font-medium text-slate-800">{fmt(item.unit_price * item.qty)}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-2 space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>ค่าส่ง</span><span>{fmt(order.shipping_fee)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>ส่วนลด</span><span>−{fmt(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900">
                  <span>รวม</span><span>{fmt(order.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tracking */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">เลข Tracking</p>
            <div className="flex gap-2">
              <input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="TH123456789"
              />
              <button
                onClick={handleSaveTracking}
                disabled={saving || tracking === savedTracking}
                className="bg-slate-900 text-white px-4 rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : "บันทึก"}
              </button>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-xs text-amber-600 font-medium mb-1">หมายเหตุ</p>
              <p className="text-sm text-amber-800">{order.notes}</p>
            </div>
          )}

          {/* Status actions */}
          {order.status !== "cancelled" && order.status !== "completed" && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">เปลี่ยนสถานะ</p>
              <div className="flex gap-2">
                {order.status === "pending" && (
                  <button onClick={() => handleStatus("shipped")} className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1">
                    <Truck size={14} /> ส่งแล้ว
                  </button>
                )}
                {order.status === "shipped" && (
                  <button onClick={() => handleStatus("completed")} className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1">
                    <CheckCircle2 size={14} /> เสร็จสิ้น
                  </button>
                )}
                <button onClick={() => handleStatus("cancelled")} className="flex-1 border border-slate-200 text-slate-500 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-1">
                  <XCircle size={14} /> ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────

export default function OrdersClient({ orders, products }: { orders: OrderRow[]; products: Product[] }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchSearch = !q ||
        o.order_number.toLowerCase().includes(q) ||
        o.customers?.name?.toLowerCase().includes(q) ||
        o.customers?.phone?.includes(q) ||
        o.tracking_number?.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || o.status === filterStatus;
      const matchPlat = filterPlatform === "all" || o.platform === filterPlatform;
      return matchSearch && matchStatus && matchPlat;
    });
  }, [orders, search, filterStatus, filterPlatform]);

  const counts = useMemo(() => ({
    pending: orders.filter((o) => o.status === "pending").length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    completed: orders.filter((o) => o.status === "completed").length,
  }), [orders]);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-2xl p-4 border ${counts.pending > 0 ? "bg-amber-50 border-amber-100" : "bg-white border-slate-100"}`}>
          <p className="text-xs text-amber-500 font-medium uppercase tracking-widest">รอส่ง</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{counts.pending}</p>
        </div>
        <div className="rounded-2xl p-4 border bg-blue-50 border-blue-100">
          <p className="text-xs text-blue-500 font-medium uppercase tracking-widest">ส่งแล้ว</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{counts.shipped}</p>
        </div>
        <div className="rounded-2xl p-4 border bg-emerald-50 border-emerald-100">
          <p className="text-xs text-emerald-500 font-medium uppercase tracking-widest">เสร็จสิ้น</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{counts.completed}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาออเดอร์, ชื่อ, เบอร์, tracking..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-800 placeholder:text-slate-300"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {[["all", "ทั้งหมด"], ["pending", "รอส่ง"], ["shipped", "ส่งแล้ว"], ["completed", "เสร็จ"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${filterStatus === val ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 focus:outline-none bg-white">
          <option value="all">ทุก Platform</option>
          <option value="tiktok">TikTok</option>
          <option value="facebook">Facebook</option>
          <option value="line">Line OA</option>
          <option value="shopee">Shopee</option>
        </select>
        <button onClick={() => setShowCreate(true)}
          className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors flex items-center gap-2">
          <Plus size={14} /> สร้างออเดอร์
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">
            ออเดอร์ทั้งหมด <span className="text-slate-400 font-normal">({filtered.length} รายการ)</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">ออเดอร์</th>
                <th className="px-4 py-3 font-medium">ลูกค้า</th>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">ยอด</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3 font-medium">Tracking</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-300 text-sm">ไม่พบรายการ</td></tr>
              ) : filtered.map((o) => {
                const statusMeta = STATUS_META[o.status] ?? STATUS_META.pending;
                const StatusIcon = statusMeta.icon;
                return (
                  <tr key={o.id} onClick={() => setSelectedOrder(o)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">{o.order_number}</p>
                      <p className="text-xs text-slate-400">{new Date(o.invoice_date).toLocaleDateString("th-TH")}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-slate-700">{o.customers?.name ?? "–"}</p>
                      <p className="text-xs text-slate-400">{o.customers?.phone}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${PLATFORM_META[o.platform]?.color ?? ""}`}>
                        {PLATFORM_META[o.platform]?.label ?? o.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">{fmt(o.total_amount)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium w-fit ${statusMeta.color}`}>
                        <StatusIcon size={11} /> {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{o.tracking_number ?? "–"}</td>
                    <td className="px-4 py-3.5"><ChevronRight size={16} className="text-slate-300" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateOrderModal
          products={products}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); window.location.reload(); }}
        />
      )}

      {selectedOrder && (
        <OrderPanel order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}
