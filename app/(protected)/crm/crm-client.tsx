"use client";

import { useState, useMemo } from "react";
import { Search, X, Loader2, Phone, MessageCircle } from "lucide-react";
import { markDoneAction, skipAction } from "./actions";
import type { FollowupRow } from "@/lib/data/crm";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok", facebook: "Facebook", line: "Line OA", shopee: "Shopee",
};

const TYPE_LABEL: Record<string, string> = {
  "3day": "3 วัน", "7day": "7 วัน", "14day": "14 วัน", "30day": "30 วัน",
};

function daysDiff(dateStr: string) {
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

function DueLabel({ dueDate, status }: { dueDate: string; status: string }) {
  if (status === "done") return <span className="text-xs text-slate-400">เสร็จแล้ว</span>;
  if (status === "skipped") return <span className="text-xs text-slate-300">ข้ามแล้ว</span>;
  const diff = daysDiff(dueDate);
  if (diff < 0) return <span className="text-xs text-red-500 font-medium">เกิน {Math.abs(diff)} วัน</span>;
  if (diff === 0) return <span className="text-xs text-red-500 font-medium">วันนี้</span>;
  if (diff <= 2) return <span className="text-xs text-amber-500">อีก {diff} วัน</span>;
  return <span className="text-xs text-slate-400">อีก {diff} วัน</span>;
}

function MarkDoneModal({ item, onClose }: { item: FollowupRow; onClose: () => void }) {
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    await markDoneAction(item.id, outcome);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-900">บันทึกผลการติดตาม</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-slate-800">{item.customers?.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{item.orders?.order_number} · {fmt(item.orders?.total_amount ?? 0)}</p>
        </div>
        <label className="text-xs text-slate-400 block mb-1.5">ผลการติดต่อ</label>
        <textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={3}
          placeholder="เช่น ลูกค้าพอใจ / ไม่รับสาย / สั่งซื้อเพิ่ม..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none placeholder:text-slate-300" />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-500 py-2 rounded-lg text-sm hover:bg-slate-50">ยกเลิก</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={13} className="animate-spin" /> : null} บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CRMClient({ followups }: { followups: FollowupRow[] }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterType, setFilterType] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [modalItem, setModalItem] = useState<FollowupRow | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const todayCount = followups.filter((f) => f.status === "pending" && !skipped.has(f.id) && daysDiff(f.due_date) <= 0).length;
  const upcomingCount = followups.filter((f) => f.status === "pending" && !skipped.has(f.id) && daysDiff(f.due_date) > 0).length;
  const doneCount = followups.filter((f) => f.status === "done").length;

  const filtered = useMemo(() => {
    return followups.filter((f) => {
      const effectiveStatus = skipped.has(f.id) ? "skipped" : f.status;
      const q = search.toLowerCase();
      const matchSearch = !q || f.customers?.name?.toLowerCase().includes(q) ||
        f.customers?.phone?.includes(q) || f.admins?.name?.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || effectiveStatus === filterStatus;
      const matchType = filterType === "all" || f.followup_type === filterType;
      const matchPlat = filterPlatform === "all" || f.customers?.platform === filterPlatform;
      return matchSearch && matchStatus && matchType && matchPlat;
    }).sort((a, b) => daysDiff(a.due_date) - daysDiff(b.due_date));
  }, [followups, search, filterStatus, filterType, filterPlatform, skipped]);

  async function handleSkip(id: string) {
    setSkipped((prev) => new Set(prev).add(id));
    await skipAction(id);
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-base font-semibold text-slate-900">CRM Follow-up</h1>
        <p className="text-xs text-slate-400 mt-0.5">ติดตามลูกค้าหลังการสั่งซื้อ</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "ติดตามวันนี้", count: todayCount, urgent: todayCount > 0 },
          { label: "กำลังจะถึง", count: upcomingCount, urgent: false },
          { label: "เสร็จแล้ว", count: doneCount, urgent: false },
        ].map(({ label, count, urgent }) => (
          <div key={label} className={`border rounded-lg px-4 py-3 ${urgent ? "border-red-100 bg-red-50" : "border-slate-100 bg-white"}`}>
            <p className={`text-xs font-medium ${urgent ? "text-red-400" : "text-slate-400"}`}>{label}</p>
            <p className={`text-2xl font-semibold mt-1 ${urgent ? "text-red-600" : "text-slate-900"}`}>{count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white placeholder:text-slate-300" />
        </div>
        <div className="flex gap-0.5 border border-slate-200 rounded-md p-0.5 bg-white">
          {[["all", "ทั้งหมด"], ["pending", "รอติดตาม"], ["done", "เสร็จ"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${filterStatus === val ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none bg-white">
          <option value="all">ทุก follow-up</option>
          <option value="3day">3 วัน</option>
          <option value="7day">7 วัน</option>
          <option value="14day">14 วัน</option>
          <option value="30day">30 วัน</option>
        </select>
        <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}
          className="border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none bg-white">
          <option value="all">ทุก Platform</option>
          <option value="tiktok">TikTok</option>
          <option value="facebook">Facebook</option>
          <option value="line">Line OA</option>
          <option value="shopee">Shopee</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
          <p className="text-xs text-slate-500">{filtered.length} รายการ</p>
          <p className="text-xs text-slate-400">{new Date().toLocaleDateString("th-TH")}</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">ลูกค้า</th>
              <th className="px-4 py-3 font-medium">ออเดอร์</th>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium">ประเภท</th>
              <th className="px-4 py-3 font-medium">กำหนด</th>
              <th className="px-4 py-3 font-medium">ผล</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-xs text-slate-300">ไม่พบรายการ</td></tr>
            ) : filtered.map((f) => {
              const effectiveStatus = skipped.has(f.id) ? "skipped" : f.status;
              const diff = daysDiff(f.due_date);
              const urgent = effectiveStatus === "pending" && diff <= 0;
              return (
                <tr key={f.id} className={`transition-colors ${urgent ? "bg-red-50/40" : "hover:bg-slate-50"} ${effectiveStatus !== "pending" ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="text-slate-800 font-medium">{f.customers?.name ?? "–"}</p>
                    {f.customers?.phone && (
                      <a href={`tel:${f.customers.phone}`} className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {f.customers.phone}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-500">{f.orders?.order_number ?? "–"}</p>
                    <p className="text-xs font-medium text-slate-700">{fmt(f.orders?.total_amount ?? 0)}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{PLATFORM_LABEL[f.customers?.platform ?? ""] ?? f.customers?.platform ?? "–"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{TYPE_LABEL[f.followup_type] ?? f.followup_type}</td>
                  <td className="px-4 py-3">
                    <DueLabel dueDate={f.due_date} status={effectiveStatus} />
                    <p className="text-xs text-slate-300 mt-0.5">
                      {new Date(f.due_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                    </p>
                  </td>
                  <td className="px-4 py-3 max-w-[120px]">
                    <p className="text-xs text-slate-400 truncate">{f.outcome ?? "–"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {effectiveStatus === "pending" ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setModalItem(f)}
                          className="px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-700 transition-colors">
                          Done
                        </button>
                        <button onClick={() => handleSkip(f.id)} className="text-slate-300 hover:text-slate-500"><X size={13} /></button>
                        {f.customers?.phone && (
                          <a href={`https://line.me/ti/p/~${f.customers.phone}`} target="_blank" rel="noopener noreferrer"
                            className="text-slate-300 hover:text-slate-500"><MessageCircle size={13} /></a>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">{effectiveStatus === "done" ? "สำเร็จ" : "ข้ามแล้ว"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalItem && <MarkDoneModal item={modalItem} onClose={() => setModalItem(null)} />}
    </div>
  );
}
