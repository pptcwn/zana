/**
 * ZANA — CRM Follow-up Tracker
 * Stack: Next.js + Tailwind CSS
 * Supabase query pattern shown in comments
 *
 * Logic: Auto-tags customers needing follow-up at 3/7/14/30 days
 * Visual priority: TODAY = red alert, UPCOMING = amber, DONE = green
 */

"use client";

import { useState, useMemo } from "react";
import {
  Phone, MessageCircle, CheckCircle2, Clock, AlertCircle,
  Search, Filter, ChevronDown, Calendar, SlidersHorizontal,
  X, Loader2, ArrowUpRight,
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// MOCK DATA  (replace with Supabase RPC / view query)
// ─────────────────────────────────────────────────────────

const today = new Date();
const d = (offsetDays) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + offsetDays);
  return dt.toISOString().split("T")[0];
};

const MOCK_FOLLOWUPS = [
  {
    id: "fu-001", customer: "คุณน้ำตาล ปัญญา", phone: "081-234-5678",
    platform: "tiktok", lastOrder: "Baby Perfume Milk Blossom x2", orderTotal: 580,
    invoiceDate: d(-3), dueDate: d(0), followupType: "3day", status: "pending",
    admin: "นุ้ย", orderRef: "ORD-20240602-041",
  },
  {
    id: "fu-002", customer: "คุณมาลี สุขใจ", phone: "089-876-5432",
    platform: "facebook", lastOrder: "Alpha Arbutin Serum x1", orderTotal: 390,
    invoiceDate: d(-3), dueDate: d(0), followupType: "3day", status: "pending",
    admin: "แพร", orderRef: "ORD-20240602-038",
  },
  {
    id: "fu-003", customer: "คุณสมหญิง รักดี", phone: "063-111-2233",
    platform: "line", lastOrder: "Maternity Pants M + L", orderTotal: 980,
    invoiceDate: d(-3), dueDate: d(0), followupType: "3day", status: "pending",
    admin: "มิ้น", orderRef: "ORD-20240602-029",
  },
  {
    id: "fu-004", customer: "คุณจันทร์ สว่างใจ", phone: "091-555-6677",
    platform: "shopee", lastOrder: "Collagen Coffee x3", orderTotal: 960,
    invoiceDate: d(-7), dueDate: d(0), followupType: "7day", status: "pending",
    admin: "กิ๊ฟ", orderRef: "ORD-20240528-018",
  },
  {
    id: "fu-005", customer: "คุณอรทัย ใจดี", phone: "085-444-9988",
    platform: "tiktok", lastOrder: "Vitamin C Serum x2", orderTotal: 840,
    invoiceDate: d(-14), dueDate: d(0), followupType: "14day", status: "pending",
    admin: "แบม", orderRef: "ORD-20240521-011",
  },
  {
    id: "fu-006", customer: "คุณสุดา พรมสุข", phone: "086-321-0099",
    platform: "facebook", lastOrder: "Baby Perfume Sweet Powder x1", orderTotal: 290,
    invoiceDate: d(-10), dueDate: d(3), followupType: "14day", status: "pending",
    admin: "นุ้ย", orderRef: "ORD-20240525-022",
  },
  {
    id: "fu-007", customer: "คุณพิมพ์ ทองดี", phone: "082-654-3210",
    platform: "line", lastOrder: "Alpha Arbutin Serum x1", orderTotal: 390,
    invoiceDate: d(-11), dueDate: d(3), followupType: "14day", status: "pending",
    admin: "แพร", orderRef: "ORD-20240524-019",
  },
  {
    id: "fu-008", customer: "คุณอนงค์ ดาวเรือง", phone: "090-777-5544",
    platform: "tiktok", lastOrder: "Detox Coffee x2", orderTotal: 640,
    invoiceDate: d(-27), dueDate: d(3), followupType: "30day", status: "pending",
    admin: "มิ้น", orderRef: "ORD-20240508-007",
  },
  {
    id: "fu-009", customer: "คุณรัตนา แสงเทียน", phone: "088-123-4455",
    platform: "shopee", lastOrder: "Maternity Pants XL x2", orderTotal: 980,
    invoiceDate: d(-30), dueDate: d(0), followupType: "30day", status: "done",
    admin: "กิ๊ฟ", outcome: "ลูกค้าพอใจมาก สั่งซื้ออีก", orderRef: "ORD-20240505-003",
  },
  {
    id: "fu-010", customer: "คุณลัดดา จันทร์หอม", phone: "087-998-7766",
    platform: "facebook", lastOrder: "Collagen Face Cream x1", orderTotal: 550,
    invoiceDate: d(-7), dueDate: d(0), followupType: "7day", status: "done",
    admin: "แบม", outcome: "ส่งข้อความแล้ว ยังไม่ตอบ", orderRef: "ORD-20240528-015",
  },
];

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

const PLATFORM_META = {
  tiktok:   { label: "TikTok", color: "bg-red-50 text-red-600 border-red-100" },
  facebook: { label: "Facebook", color: "bg-blue-50 text-blue-600 border-blue-100" },
  line:     { label: "Line OA", color: "bg-green-50 text-green-600 border-green-100" },
  shopee:   { label: "Shopee", color: "bg-orange-50 text-orange-600 border-orange-100" },
};

const TYPE_META = {
  "3day":  { label: "3 วัน",  color: "bg-violet-100 text-violet-700" },
  "7day":  { label: "7 วัน",  color: "bg-cyan-100 text-cyan-700" },
  "14day": { label: "14 วัน", color: "bg-amber-100 text-amber-700" },
  "30day": { label: "30 วัน", color: "bg-fuchsia-100 text-fuchsia-700" },
};

const fmt = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

function daysDiff(dateStr) {
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due - now) / 86400000);
}

function DueBadge({ dueDate, status }) {
  if (status === "done") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
        <CheckCircle2 size={11} /> เสร็จแล้ว
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
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
    <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
      <Calendar size={11} /> {diff} วัน
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// MARK DONE MODAL
// ─────────────────────────────────────────────────────────

function MarkDoneModal({ item, onClose, onConfirm }) {
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    // Supabase call: await supabase.from('followups').update({ status: 'done', outcome, contacted_at: new Date() }).eq('id', item.id)
    await new Promise((r) => setTimeout(r, 600)); // simulate
    onConfirm(item.id, outcome);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">บันทึกผลการติดตาม</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm text-gray-700">
          <p className="font-medium">{item.customer}</p>
          <p className="text-xs text-gray-400 mt-0.5">{item.lastOrder} · {fmt(item.orderTotal)}</p>
        </div>
        <label className="text-xs text-gray-400 block mb-1.5">ผลการติดต่อ (ไม่บังคับ)</label>
        <textarea
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          rows={3}
          placeholder="เช่น ลูกค้าพอใจ / ไม่รับสาย / สั่งซื้อเพิ่ม..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none text-gray-800 placeholder:text-gray-300"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors">
            ยกเลิก
          </button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 bg-violet-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────

export default function CRMFollowupTracker() {
  const [followups, setFollowups] = useState(MOCK_FOLLOWUPS);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending"); // "all"|"pending"|"done"
  const [filterType, setFilterType] = useState("all");         // "all"|"3day"|"7day"|"14day"|"30day"
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [modalItem, setModalItem] = useState(null);

  // Summary counts
  const todayCount     = followups.filter((f) => f.status === "pending" && daysDiff(f.dueDate) <= 0).length;
  const upcomingCount  = followups.filter((f) => f.status === "pending" && daysDiff(f.dueDate) > 0).length;
  const doneCount      = followups.filter((f) => f.status === "done").length;

  const filtered = useMemo(() => {
    return followups.filter((f) => {
      const q = search.toLowerCase();
      const matchSearch = !q || f.customer.toLowerCase().includes(q) || f.phone.includes(q) || f.admin.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || f.status === filterStatus;
      const matchType   = filterType === "all" || f.followupType === filterType;
      const matchPlat   = filterPlatform === "all" || f.platform === filterPlatform;
      return matchSearch && matchStatus && matchType && matchPlat;
    }).sort((a, b) => {
      // Today/overdue first, then by due date
      const da = daysDiff(a.dueDate), db = daysDiff(b.dueDate);
      if (a.status === "done" && b.status !== "done") return 1;
      if (b.status === "done" && a.status !== "done") return -1;
      return da - db;
    });
  }, [followups, search, filterStatus, filterType, filterPlatform]);

  function handleMarkDone(id, outcome) {
    setFollowups((prev) =>
      prev.map((f) => f.id === id ? { ...f, status: "done", outcome } : f)
    );
  }

  function handleSkip(id) {
    setFollowups((prev) =>
      prev.map((f) => f.id === id ? { ...f, status: "skipped" } : f)
    );
  }

  function rowHighlight(f) {
    if (f.status === "done" || f.status === "skipped") return "bg-white opacity-60";
    const diff = daysDiff(f.dueDate);
    if (diff <= 0) return "bg-red-50/60 border-l-4 border-l-red-400";
    if (diff <= 2) return "bg-amber-50/40 border-l-4 border-l-amber-300";
    return "bg-white";
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">Z</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">ZANA</span>
          <span className="text-gray-300 text-sm">/ CRM Follow-up</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className={`rounded-2xl p-4 border ${todayCount > 0 ? "bg-red-50 border-red-100" : "bg-white border-gray-100"}`}>
            <p className="text-xs text-red-400 font-medium uppercase tracking-widest">ติดตามวันนี้</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{todayCount}</p>
            <p className="text-xs text-red-300 mt-1">รายการที่ต้องติดตาม</p>
          </div>
          <div className="rounded-2xl p-4 border bg-amber-50 border-amber-100">
            <p className="text-xs text-amber-500 font-medium uppercase tracking-widest">กำลังจะถึง</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{upcomingCount}</p>
            <p className="text-xs text-amber-300 mt-1">ภายใน 3 วันหน้า</p>
          </div>
          <div className="rounded-2xl p-4 border bg-emerald-50 border-emerald-100">
            <p className="text-xs text-emerald-500 font-medium uppercase tracking-widest">เสร็จแล้ว</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{doneCount}</p>
            <p className="text-xs text-emerald-300 mt-1">รายการเดือนนี้</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, เบอร์, แอดมิน..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800 placeholder:text-gray-300"
              />
            </div>

            {/* Status filter */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {[["all", "ทั้งหมด"], ["pending", "รอติดตาม"], ["done", "เสร็จแล้ว"]].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilterStatus(val)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${filterStatus === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
            >
              <option value="all">ทุก follow-up</option>
              <option value="3day">3 วัน</option>
              <option value="7day">7 วัน</option>
              <option value="14day">14 วัน</option>
              <option value="30day">30 วัน</option>
            </select>

            {/* Platform filter */}
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              รายการทั้งหมด <span className="text-gray-400 font-normal">({filtered.length} รายการ)</span>
            </p>
            <p className="text-xs text-gray-400">อัปเดต: {new Date().toLocaleDateString("th-TH")}</p>
          </div>

          {/* Desktop table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3 font-medium">ลูกค้า</th>
                  <th className="px-4 py-3 font-medium">สินค้าล่าสุด</th>
                  <th className="px-4 py-3 font-medium">Platform</th>
                  <th className="px-4 py-3 font-medium">Follow-up</th>
                  <th className="px-4 py-3 font-medium">กำหนด</th>
                  <th className="px-4 py-3 font-medium">แอดมิน</th>
                  <th className="px-4 py-3 font-medium">ผล</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-300 text-sm">ไม่พบรายการ</td>
                  </tr>
                ) : filtered.map((f) => (
                  <tr key={f.id} className={`${rowHighlight(f)} hover:bg-violet-50/20 transition-colors`}>
                    {/* Customer */}
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{f.customer}</p>
                        <a href={`tel:${f.phone}`} className="text-xs text-violet-500 hover:underline flex items-center gap-0.5 mt-0.5">
                          <Phone size={10} /> {f.phone}
                        </a>
                        <p className="text-xs text-gray-300 mt-0.5">{f.orderRef}</p>
                      </div>
                    </td>

                    {/* Last order */}
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-gray-600 max-w-[160px] leading-relaxed">{f.lastOrder}</p>
                      <p className="text-xs font-semibold text-gray-800 mt-0.5">{fmt(f.orderTotal)}</p>
                    </td>

                    {/* Platform */}
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${PLATFORM_META[f.platform]?.color}`}>
                        {PLATFORM_META[f.platform]?.label}
                      </span>
                    </td>

                    {/* Follow-up type */}
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${TYPE_META[f.followupType]?.color}`}>
                        {TYPE_META[f.followupType]?.label}
                      </span>
                    </td>

                    {/* Due date */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <DueBadge dueDate={f.dueDate} status={f.status} />
                        <p className="text-xs text-gray-300">
                          {new Date(f.dueDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </td>

                    {/* Admin */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-600">
                          {f.admin[0]}
                        </div>
                        <span className="text-xs text-gray-600">{f.admin}</span>
                      </div>
                    </td>

                    {/* Outcome */}
                    <td className="px-4 py-3.5 max-w-[140px]">
                      {f.outcome ? (
                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{f.outcome}</p>
                      ) : (
                        <span className="text-xs text-gray-200">–</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      {f.status === "pending" ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setModalItem(f)}
                            className="bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-violet-700 transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            <CheckCircle2 size={11} /> Mark done
                          </button>
                          <button
                            onClick={() => handleSkip(f.id)}
                            className="border border-gray-200 text-gray-400 px-2 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition-colors"
                            title="ข้าม"
                          >
                            <X size={11} />
                          </button>
                          <a
                            href={`https://line.me/ti/p/~${f.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border border-green-200 text-green-500 px-2 py-1.5 rounded-lg text-xs hover:bg-green-50 transition-colors"
                            title="ส่ง Line"
                          >
                            <MessageCircle size={11} />
                          </a>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-300">
                          <CheckCircle2 size={12} className="text-emerald-400" /> สำเร็จ
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards (hidden on desktop) */}
        <div className="sm:hidden space-y-3">
          {filtered.map((f) => (
            <div key={f.id} className={`rounded-2xl border p-4 ${daysDiff(f.dueDate) <= 0 && f.status === "pending" ? "border-red-200 bg-red-50/40" : "border-gray-100 bg-white"}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-800">{f.customer}</p>
                  <a href={`tel:${f.phone}`} className="text-xs text-violet-500">{f.phone}</a>
                </div>
                <DueBadge dueDate={f.dueDate} status={f.status} />
              </div>
              <p className="text-xs text-gray-500 mb-2">{f.lastOrder} · {fmt(f.orderTotal)}</p>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PLATFORM_META[f.platform]?.color}`}>
                  {PLATFORM_META[f.platform]?.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_META[f.followupType]?.color}`}>
                  {TYPE_META[f.followupType]?.label}
                </span>
              </div>
              {f.status === "pending" && (
                <button
                  onClick={() => setModalItem(f)}
                  className="w-full bg-violet-600 text-white py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={13} /> Mark done
                </button>
              )}
            </div>
          ))}
        </div>

      </main>

      {/* Mark Done Modal */}
      {modalItem && (
        <MarkDoneModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          onConfirm={handleMarkDone}
        />
      )}
    </div>
  );
}
