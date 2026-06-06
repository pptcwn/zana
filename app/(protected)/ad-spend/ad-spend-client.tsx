"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { createAdSpendAction, deleteAdSpendAction } from "./actions";
import type { AdSpendRow } from "@/lib/data/adspend";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  tiktok:   { label: "TikTok",   color: "bg-red-50 text-red-600" },
  facebook: { label: "Facebook", color: "bg-blue-50 text-blue-600" },
  line:     { label: "Line OA",  color: "bg-green-50 text-green-600" },
  shopee:   { label: "Shopee",   color: "bg-orange-50 text-orange-600" },
  google:   { label: "Google",   color: "bg-yellow-50 text-yellow-600" },
  other:    { label: "อื่นๆ",    color: "bg-slate-100 text-slate-600" },
};

export default function AdSpendClient({ records }: { records: AdSpendRow[] }) {
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [platform, setPlatform] = useState("tiktok");
  const [amount, setAmount] = useState("");
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError("กรุณากรอกจำนวนเงิน");
      return;
    }
    setSaving(true);
    setError("");
    await createAdSpendAction({
      spend_date: date,
      platform,
      amount: Number(amount),
      impressions: impressions ? Number(impressions) : null,
      clicks: clicks ? Number(clicks) : null,
      notes: notes || null,
    });
    setAmount("");
    setImpressions("");
    setClicks("");
    setNotes("");
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteAdSpendAction(id);
    setDeletingId(null);
  }

  // summary this month
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRecords = records.filter((r) => r.spend_date.startsWith(thisMonth));
  const totalMonth = monthRecords.reduce((s, r) => s + r.amount, 0);
  const totalToday = records.filter((r) => r.spend_date === today).reduce((s, r) => s + r.amount, 0);

  const byPlatform = monthRecords.reduce<Record<string, number>>((acc, r) => {
    acc[r.platform] = (acc[r.platform] ?? 0) + r.amount;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">วันนี้</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(totalToday)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">เดือนนี้</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(totalMonth)}</p>
        </div>
        {Object.entries(byPlatform).map(([plat, total]) => (
          <div key={plat} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">{PLATFORM_META[plat]?.label ?? plat}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(total)}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">บันทึกค่าโฆษณา</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">วันที่</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white">
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
                <option value="line">Line OA</option>
                <option value="shopee">Shopee</option>
                <option value="google">Google</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">จำนวนเงิน (฿) *</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={saving}
                className="w-full bg-slate-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                บันทึก
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Impressions (ไม่บังคับ)</label>
              <input type="number" value={impressions} onChange={(e) => setImpressions(e.target.value)} placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Clicks (ไม่บังคับ)</label>
              <input type="number" value={clicks} onChange={(e) => setClicks(e.target.value)} placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">หมายเหตุ</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ไม่บังคับ"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-700">ประวัติ 30 วัน</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3 font-medium">วันที่</th>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">จำนวนเงิน</th>
                <th className="px-4 py-3 font-medium">Impressions</th>
                <th className="px-4 py-3 font-medium">Clicks</th>
                <th className="px-4 py-3 font-medium">หมายเหตุ</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {records.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-300 text-sm">ยังไม่มีรายการ</td></tr>
              ) : records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-slate-700">
                    {new Date(r.spend_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${PLATFORM_META[r.platform]?.color ?? "bg-slate-100 text-slate-600"}`}>
                      {PLATFORM_META[r.platform]?.label ?? r.platform}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{fmt(r.amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{r.impressions?.toLocaleString() ?? "–"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.clicks?.toLocaleString() ?? "–"}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{r.notes ?? "–"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}
                      className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-50">
                      {deletingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
