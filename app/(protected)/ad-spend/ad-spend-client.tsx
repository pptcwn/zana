"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { createAdSpendAction, deleteAdSpendAction } from "./actions";
import type { AdSpendRow } from "@/lib/data/adspend";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok", facebook: "Facebook", line: "Line OA",
  shopee: "Shopee", google: "Google", other: "อื่นๆ",
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
    if (!amount || Number(amount) <= 0) { setError("กรุณากรอกจำนวนเงิน"); return; }
    setSaving(true);
    setError("");
    await createAdSpendAction({
      spend_date: date, platform, amount: Number(amount),
      impressions: impressions ? Number(impressions) : null,
      clicks: clicks ? Number(clicks) : null,
      notes: notes || null,
    });
    setAmount(""); setImpressions(""); setClicks(""); setNotes("");
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteAdSpendAction(id);
    setDeletingId(null);
  }

  const thisMonth = new Date().toISOString().slice(0, 7);
  const totalToday = records.filter((r) => r.spend_date === today).reduce((s, r) => s + r.amount, 0);
  const totalMonth = records.filter((r) => r.spend_date.startsWith(thisMonth)).reduce((s, r) => s + r.amount, 0);

  const inputCls = "w-full border border-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-base font-semibold text-slate-900">Ad Spend</h1>
        <p className="text-xs text-slate-400 mt-0.5">บันทึกค่าโฆษณารายวัน</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-100 rounded-lg px-5 py-4">
          <p className="text-xs text-slate-400">วันนี้</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{fmt(totalToday)}</p>
        </div>
        <div className="bg-white border border-slate-100 rounded-lg px-5 py-4">
          <p className="text-xs text-slate-400">เดือนนี้</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{fmt(totalMonth)}</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white border border-slate-100 rounded-lg p-5">
        <p className="text-sm font-medium text-slate-900 mb-4">บันทึกค่าโฆษณา</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">วันที่</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
                <option value="line">Line OA</option>
                <option value="shopee">Shopee</option>
                <option value="google">Google</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">จำนวนเงิน (฿) *</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={saving}
                className="w-full bg-slate-900 text-white py-1.5 rounded-md text-sm font-medium hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} บันทึก
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Impressions", val: impressions, set: setImpressions },
              { label: "Clicks", val: clicks, set: setClicks },
              { label: "หมายเหตุ", val: notes, set: setNotes, text: true },
            ].map(({ label, val, set, text }) => (
              <div key={label}>
                <label className="text-xs text-slate-400 block mb-1">{label}</label>
                <input type={text ? "text" : "number"} value={val} onChange={(e) => set(e.target.value)}
                  placeholder={text ? "ไม่บังคับ" : "0"} className={inputCls} />
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </form>
      </div>

      {/* History */}
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs text-slate-500">ประวัติ 30 วัน</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">วันที่</th>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium">จำนวนเงิน</th>
              <th className="px-4 py-3 font-medium">Impressions</th>
              <th className="px-4 py-3 font-medium">Clicks</th>
              <th className="px-4 py-3 font-medium">หมายเหตุ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {records.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-xs text-slate-300">ยังไม่มีรายการ</td></tr>
            ) : records.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-700">
                  {new Date(r.spend_date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{PLATFORM_LABEL[r.platform] ?? r.platform}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{fmt(r.amount)}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{r.impressions?.toLocaleString() ?? "–"}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{r.clicks?.toLocaleString() ?? "–"}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{r.notes ?? "–"}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}
                    className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-50">
                    {deletingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
