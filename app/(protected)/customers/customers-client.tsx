"use client";

import { useState, useMemo } from "react";
import { Search, X, ChevronRight, Loader2 } from "lucide-react";
import { updateCustomerAction } from "./actions";
import type { CustomerRow } from "@/lib/data/customers";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok", facebook: "Facebook", line: "Line OA", shopee: "Shopee",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "รอส่ง", shipped: "ส่งแล้ว", completed: "เสร็จสิ้น", cancelled: "ยกเลิก",
};

function CustomerPanel({ customer, onClose }: { customer: CustomerRow; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [saving, setSaving] = useState(false);

  const totalSpend = (customer.orders ?? []).reduce((s, o) => s + o.total_amount, 0);
  const inputCls = "w-full border border-pink-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pink-300";

  async function handleSave() {
    setSaving(true);
    try {
      await updateCustomerAction(customer.id, { name, phone, address: address || null, notes: notes || null });
      setEditing(false);
    } catch {
      alert("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm bg-white h-full overflow-y-auto border-l border-pink-100" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-pink-100 px-5 py-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">{customer.name}</p>
          <button onClick={onClose} className="text-pink-300 hover:text-pink-500"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-pink-100 rounded-xl px-4 py-3">
              <p className="text-xl font-semibold text-slate-800">{customer.orders?.length ?? 0}</p>
              <p className="text-xs text-pink-400 mt-0.5">ออเดอร์</p>
            </div>
            <div className="border border-pink-100 rounded-xl px-4 py-3">
              <p className="text-xl font-semibold text-slate-800">{fmt(totalSpend)}</p>
              <p className="text-xs text-pink-400 mt-0.5">ยอดรวม</p>
            </div>
          </div>

          {editing ? (
            <div className="space-y-3">
              {[
                { label: "ชื่อ", val: name, set: setName },
                { label: "เบอร์", val: phone, set: setPhone },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-xs text-pink-400 block mb-1">{label}</label>
                  <input value={val} onChange={(e) => set(e.target.value)} className={inputCls} />
                </div>
              ))}
              <div>
                <label className="text-xs text-pink-400 block mb-1">ที่อยู่</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3}
                  className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="text-xs text-pink-400 block mb-1">หมายเหตุ</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  className={`${inputCls} resize-none`} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="flex-1 border border-pink-100 text-slate-500 py-2 rounded-lg text-sm hover:bg-pink-50">ยกเลิก</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-pink-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-pink-400 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : null} บันทึก
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-pink-400">เบอร์</span>
                  <span className="text-slate-700">{customer.phone ?? "–"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-pink-400">Platform</span>
                  <span className="text-slate-700">{PLATFORM_LABEL[customer.platform] ?? customer.platform}</span>
                </div>
                {customer.address && (
                  <div>
                    <p className="text-pink-400 mb-1">ที่อยู่</p>
                    <p className="text-slate-600 text-xs leading-relaxed">{customer.address}</p>
                  </div>
                )}
                {customer.notes && (
                  <div>
                    <p className="text-pink-400 mb-1">หมายเหตุ</p>
                    <p className="text-slate-600 text-xs">{customer.notes}</p>
                  </div>
                )}
              </div>
              <button onClick={() => setEditing(true)}
                className="w-full border border-pink-100 text-slate-600 py-1.5 rounded-lg text-xs hover:bg-pink-50 transition-colors">
                แก้ไขข้อมูล
              </button>
            </div>
          )}

          <div>
            <p className="text-xs text-pink-400 uppercase tracking-wider font-medium mb-2">ประวัติออเดอร์</p>
            {(customer.orders ?? []).length === 0 ? (
              <p className="text-xs text-pink-200 py-4 text-center">ยังไม่มีออเดอร์</p>
            ) : (
              <div className="space-y-1.5">
                {[...(customer.orders ?? [])].sort((a, b) => b.invoice_date.localeCompare(a.invoice_date)).map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-pink-50">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{o.order_number}</p>
                      <p className="text-xs text-pink-300">{new Date(o.invoice_date).toLocaleDateString("th-TH")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-800">{fmt(o.total_amount)}</p>
                      <p className="text-xs text-slate-400">{STATUS_LABEL[o.status] ?? o.status}</p>
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
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Customers</h1>
        <p className="text-xs text-pink-300 mt-0.5">ประวัติและข้อมูลลูกค้า</p>
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-300" />
          <input type="text" placeholder="ค้นหาชื่อ, เบอร์..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-pink-100 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-pink-300 bg-white placeholder:text-pink-200" />
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
              <th className="px-4 py-3 font-medium">ลูกค้า</th>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium">ออเดอร์</th>
              <th className="px-4 py-3 font-medium">ยอดรวม</th>
              <th className="px-4 py-3 font-medium">ล่าสุด</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-xs text-pink-200">ไม่พบลูกค้า</td></tr>
            ) : filtered.map((c) => {
              const totalSpend = (c.orders ?? []).reduce((s, o) => s + o.total_amount, 0);
              const lastOrder = [...(c.orders ?? [])].sort((a, b) => b.invoice_date.localeCompare(a.invoice_date))[0];
              return (
                <tr key={c.id} onClick={() => setSelected(c)} className="hover:bg-pink-50/40 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.phone ?? "–"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{PLATFORM_LABEL[c.platform] ?? c.platform}</td>
                  <td className="px-4 py-3 text-slate-600">{c.orders?.length ?? 0}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{fmt(totalSpend)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {lastOrder ? new Date(lastOrder.invoice_date).toLocaleDateString("th-TH") : "–"}
                  </td>
                  <td className="px-4 py-3"><ChevronRight size={14} className="text-pink-200" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && <CustomerPanel customer={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
