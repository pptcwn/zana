"use client";

import { useState, useMemo } from "react";
import { Search, X, ChevronRight, Phone, MapPin, Loader2 } from "lucide-react";
import { updateCustomerAction } from "./actions";
import type { CustomerRow } from "@/lib/data/customers";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  tiktok:   { label: "TikTok",   color: "bg-red-50 text-red-600 border-red-100" },
  facebook: { label: "Facebook", color: "bg-blue-50 text-blue-600 border-blue-100" },
  line:     { label: "Line OA",  color: "bg-green-50 text-green-600 border-green-100" },
  shopee:   { label: "Shopee",   color: "bg-orange-50 text-orange-600 border-orange-100" },
};

function CustomerPanel({ customer, onClose }: { customer: CustomerRow; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [saving, setSaving] = useState(false);

  const totalSpend = (customer.orders ?? []).reduce((s, o) => s + o.total_amount, 0);
  const orderCount = customer.orders?.length ?? 0;

  async function handleSave() {
    setSaving(true);
    await updateCustomerAction(customer.id, {
      name, phone, address: address || null, notes: notes || null,
    });
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <p className="font-bold text-slate-900">{customer.name}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{orderCount}</p>
              <p className="text-xs text-slate-400 mt-1">ออเดอร์ทั้งหมด</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-slate-900">{fmt(totalSpend)}</p>
              <p className="text-xs text-slate-400 mt-1">ยอดซื้อรวม</p>
            </div>
          </div>

          {/* Info */}
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">ชื่อ</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">เบอร์โทร</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">ที่อยู่</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} resize-none
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">หมายเหตุ</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)}
                  className="flex-1 border border-slate-200 text-slate-500 py-2 rounded-xl text-sm hover:bg-slate-50">ยกเลิก</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-slate-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : "บันทึก"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Phone size={15} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-slate-700">{customer.phone ?? "–"}</p>
                </div>
              </div>
              {customer.address && (
                <div className="flex items-start gap-3">
                  <MapPin size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-700 leading-relaxed">{customer.address}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${PLATFORM_META[customer.platform]?.color ?? ""}`}>
                  {PLATFORM_META[customer.platform]?.label ?? customer.platform}
                </span>
                {(customer.tags ?? []).map((tag) => (
                  <span key={tag} className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-600">{tag}</span>
                ))}
              </div>
              {customer.notes && (
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-xs text-amber-600 font-medium mb-1">หมายเหตุ</p>
                  <p className="text-sm text-amber-800">{customer.notes}</p>
                </div>
              )}
              <button onClick={() => setEditing(true)}
                className="w-full border border-slate-200 text-slate-600 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors">
                แก้ไขข้อมูล
              </button>
            </div>
          )}

          {/* Order history */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">ประวัติออเดอร์</p>
            {(customer.orders ?? []).length === 0 ? (
              <p className="text-sm text-slate-300 text-center py-4">ยังไม่มีออเดอร์</p>
            ) : (
              <div className="space-y-2">
                {[...(customer.orders ?? [])].sort((a, b) => b.invoice_date.localeCompare(a.invoice_date)).map((o) => (
                  <div key={o.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{o.order_number}</p>
                      <p className="text-xs text-slate-400">{new Date(o.invoice_date).toLocaleDateString("th-TH")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800">{fmt(o.total_amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        o.status === "completed" ? "bg-emerald-50 text-emerald-600" :
                        o.status === "shipped" ? "bg-blue-50 text-blue-600" :
                        o.status === "cancelled" ? "bg-slate-100 text-slate-400" :
                        "bg-amber-50 text-amber-600"
                      }`}>{o.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomersClient({ customers }: { customers: CustomerRow[] }) {
  const [search, setSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [selected, setSelected] = useState<CustomerRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter((c) => {
      const matchSearch = !q || c.name.toLowerCase().includes(q) || c.phone?.includes(q);
      const matchPlat = filterPlatform === "all" || c.platform === filterPlatform;
      return matchSearch && matchPlat;
    });
  }, [customers, search, filterPlatform]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="ค้นหาชื่อ, เบอร์..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-800 placeholder:text-slate-300" />
        </div>
        <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 focus:outline-none bg-white">
          <option value="all">ทุก Platform</option>
          <option value="tiktok">TikTok</option>
          <option value="facebook">Facebook</option>
          <option value="line">Line OA</option>
          <option value="shopee">Shopee</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">
            ลูกค้าทั้งหมด <span className="text-slate-400 font-normal">({filtered.length} คน)</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">ลูกค้า</th>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">ออเดอร์</th>
                <th className="px-4 py-3 font-medium">ยอดรวม</th>
                <th className="px-4 py-3 font-medium">ล่าสุด</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-300 text-sm">ไม่พบลูกค้า</td></tr>
              ) : filtered.map((c) => {
                const totalSpend = (c.orders ?? []).reduce((s, o) => s + o.total_amount, 0);
                const lastOrder = [...(c.orders ?? [])].sort((a, b) => b.invoice_date.localeCompare(a.invoice_date))[0];
                return (
                  <tr key={c.id} onClick={() => setSelected(c)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.phone ?? "–"}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${PLATFORM_META[c.platform]?.color ?? ""}`}>
                        {PLATFORM_META[c.platform]?.label ?? c.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{c.orders?.length ?? 0}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">{fmt(totalSpend)}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">
                      {lastOrder ? new Date(lastOrder.invoice_date).toLocaleDateString("th-TH") : "–"}
                    </td>
                    <td className="px-4 py-3.5"><ChevronRight size={16} className="text-slate-300" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <CustomerPanel customer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
