"use client";

import { useState, useMemo } from "react";
import {
  Phone, MessageCircle, CheckCircle2, Clock, AlertCircle,
  Search, Calendar, X, Loader2,
} from "lucide-react";
import { markDoneAction, skipAction } from "./actions";
import type { FollowupRow } from "@/lib/data/crm";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  tiktok:   { label: "TikTok",   color: "bg-red-50 text-red-600 border-red-100" },
  facebook: { label: "Facebook", color: "bg-blue-50 text-blue-600 border-blue-100" },
  line:     { label: "Line OA",  color: "bg-green-50 text-green-600 border-green-100" },
  shopee:   { label: "Shopee",   color: "bg-orange-50 text-orange-600 border-orange-100" },
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  "3day":  { label: "3 วัน",  color: "bg-violet-100 text-violet-700" },
  "7day":  { label: "7 วัน",  color: "bg-cyan-100 text-cyan-700" },
  "14day": { label: "14 วัน", color: "bg-amber-100 text-amber-700" },
  "30day": { label: "30 วัน", color: "bg-fuchsia-100 text-fuchsia-700" },
};

function daysDiff(dateStr: string) {
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

function DueBadge({ dueDate, status }: { dueDate: string; status: string }) {
  if (status === "done") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
        <CheckCircle2 size={11} /> เสร็จแล้ว
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
        <X size={11} /> ข้าม
      </span>
    );
  }
  const diff = daysDiff(dueDate);
  if (diff < 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full animate-pulse">
        <AlertCircle size={11} /> เกินกำหนด {Math.abs(diff)} วัน
      </span>
    );
  }
  if (diff === 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
        <AlertCircle size={11} /> วันนี้!
      </span>
    );
  }
  if (diff <= 2) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
        <Clock size={11} /> อีก {diff} วัน
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
      <Calendar size={11} /> {diff} วัน
    </span>
  );
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">บันทึกผลการติดตาม</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 mb-4 text-sm text-slate-700">
          <p className="font-medium">{item.customers?.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {item.orders?.order_number} · {fmt(item.orders?.total_amount ?? 0)}
          </p>
        </div>
        <label className="text-xs text-slate-400 block mb-1.5">ผลการติดต่อ (ไม่บังคับ)</label>
        <textarea
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          rows={3}
          placeholder="เช่น ลูกค้าพอใจ / ไม่รับสาย / สั่งซื้อเพิ่ม..."
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none text-slate-800 placeholder:text-slate-300"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-200 text-slate-500 py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            บันทึก
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

  const todayCount = followups.filter(
    (f) => f.status === "pending" && !skipped.has(f.id) && daysDiff(f.due_date) <= 0
  ).length;
  const upcomingCount = followups.filter(
    (f) => f.status === "pending" && !skipped.has(f.id) && daysDiff(f.due_date) > 0
  ).length;
  const doneCount = followups.filter((f) => f.status === "done").length;

  const filtered = useMemo(() => {
    return followups
      .filter((f) => {
        const effectiveStatus = skipped.has(f.id) ? "skipped" : f.status;
        const q = search.toLowerCase();
        const name = f.customers?.name?.toLowerCase() ?? "";
        const phone = f.customers?.phone ?? "";
        const adminName = f.admins?.name?.toLowerCase() ?? "";
        const matchSearch = !q || name.includes(q) || phone.includes(q) || adminName.includes(q);
        const matchStatus = filterStatus === "all" || effectiveStatus === filterStatus;
        const matchType = filterType === "all" || f.followup_type === filterType;
        const matchPlat = filterPlatform === "all" || f.customers?.platform === filterPlatform;
        return matchSearch && matchStatus && matchType && matchPlat;
      })
      .sort((a, b) => {
        const da = daysDiff(a.due_date);
        const db = daysDiff(b.due_date);
        if (a.status === "done" && b.status !== "done") return 1;
        if (b.status === "done" && a.status !== "done") return -1;
        return da - db;
      });
  }, [followups, search, filterStatus, filterType, filterPlatform, skipped]);

  async function handleSkip(id: string) {
    setSkipped((prev) => new Set(prev).add(id));
    await skipAction(id);
  }

  function rowHighlight(f: FollowupRow) {
    if (f.status === "done" || skipped.has(f.id)) return "bg-white opacity-60";
    const diff = daysDiff(f.due_date);
    if (diff <= 0) return "bg-red-50/60 border-l-4 border-l-red-400";
    if (diff <= 2) return "bg-amber-50/40 border-l-4 border-l-amber-300";
    return "bg-white";
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-2xl p-4 border ${todayCount > 0 ? "bg-red-50 border-red-100" : "bg-white border-slate-100"}`}>
          <p className="text-xs text-red-400 font-medium uppercase tracking-widest">ติดตามวันนี้</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{todayCount}</p>
          <p className="text-xs text-red-300 mt-1">รายการที่ต้องติดตาม</p>
        </div>
        <div className="rounded-2xl p-4 border bg-amber-50 border-amber-100">
          <p className="text-xs text-amber-500 font-medium uppercase tracking-widest">กำลังจะถึง</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{upcomingCount}</p>
          <p className="text-xs text-amber-300 mt-1">รายการที่รอ</p>
        </div>
        <div className="rounded-2xl p-4 border bg-emerald-50 border-emerald-100">
          <p className="text-xs text-emerald-500 font-medium uppercase tracking-widest">เสร็จแล้ว</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{doneCount}</p>
          <p className="text-xs text-emerald-300 mt-1">รายการทั้งหมด</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, เบอร์, แอดมิน..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-800 placeholder:text-slate-300"
            />
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {[["all", "ทั้งหมด"], ["pending", "รอติดตาม"], ["done", "เสร็จแล้ว"]] .map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterStatus(val)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${filterStatus === val ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 focus:outline-none bg-white"
          >
            <option value="all">ทุก follow-up</option>
            <option value="3day">3 วัน</option>
            <option value="7day">7 วัน</option>
            <option value="14day">14 วัน</option>
            <option value="30day">30 วัน</option>
          </select>
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 focus:outline-none bg-white"
          >
            <option value="all">ทุก Platform</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
            <option value="line">Line OA</option>
            <option value="shopee">Shopee</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">
            รายการทั้งหมด <span className="text-slate-400 font-normal">({filtered.length} รายการ)</span>
          </p>
          <p className="text-xs text-slate-400">อัปเดต: {new Date().toLocaleDateString("th-TH")}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">ลูกค้า</th>
                <th className="px-4 py-3 font-medium">ออเดอร์</th>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Follow-up</th>
                <th className="px-4 py-3 font-medium">กำหนด</th>
                <th className="px-4 py-3 font-medium">แอดมิน</th>
                <th className="px-4 py-3 font-medium">ผล</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-300 text-sm">ไม่พบรายการ</td>
                </tr>
              ) : filtered.map((f) => {
                const effectiveStatus = skipped.has(f.id) ? "skipped" : f.status;
                const platform = f.customers?.platform ?? "";
                return (
                  <tr key={f.id} className={`${rowHighlight(f)} hover:bg-violet-50/20 transition-colors`}>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800 text-sm">{f.customers?.name ?? "–"}</p>
                      {f.customers?.phone && (
                        <a href={`tel:${f.customers.phone}`} className="text-xs text-violet-500 hover:underline flex items-center gap-0.5 mt-0.5">
                          <Phone size={10} /> {f.customers.phone}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-slate-400">{f.orders?.order_number ?? "–"}</p>
                      <p className="text-xs font-semibold text-slate-800 mt-0.5">{fmt(f.orders?.total_amount ?? 0)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${PLATFORM_META[platform]?.color ?? "bg-slate-50 text-slate-500 border-slate-100"}`}>
                        {PLATFORM_META[platform]?.label ?? platform}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${TYPE_META[f.followup_type]?.color ?? "bg-slate-100 text-slate-600"}`}>
                        {TYPE_META[f.followup_type]?.label ?? f.followup_type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <DueBadge dueDate={f.due_date} status={effectiveStatus} />
                        <p className="text-xs text-slate-300">
                          {new Date(f.due_date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {f.admins?.name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-600">
                            {f.admins.name[0]}
                          </div>
                          <span className="text-xs text-slate-600">{f.admins.name}</span>
                        </div>
                      ) : <span className="text-xs text-slate-300">–</span>}
                    </td>
                    <td className="px-4 py-3.5 max-w-[140px]">
                      {f.outcome
                        ? <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{f.outcome}</p>
                        : <span className="text-xs text-slate-200">–</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {effectiveStatus === "pending" ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setModalItem(f)}
                            className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            <CheckCircle2 size={11} /> Mark done
                          </button>
                          <button
                            onClick={() => handleSkip(f.id)}
                            className="border border-slate-200 text-slate-400 px-2 py-1.5 rounded-lg text-xs hover:bg-slate-50 transition-colors"
                            title="ข้าม"
                          >
                            <X size={11} />
                          </button>
                          {f.customers?.phone && (
                            <a
                              href={`https://line.me/ti/p/~${f.customers.phone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="border border-green-200 text-green-500 px-2 py-1.5 rounded-lg text-xs hover:bg-green-50 transition-colors"
                              title="ส่ง Line"
                            >
                              <MessageCircle size={11} />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-slate-300">
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          {effectiveStatus === "done" ? "สำเร็จ" : "ข้ามแล้ว"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalItem && (
        <MarkDoneModal item={modalItem} onClose={() => setModalItem(null)} />
      )}
    </div>
  );
}
