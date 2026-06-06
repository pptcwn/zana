"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Package, ShoppingBag, Megaphone, BarChart2, AlertTriangle,
} from "lucide-react";
import type { DashboardData } from "@/lib/data/dashboard";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) =>
  n >= 1000 ? `฿${(n / 1000).toFixed(1)}K` : `฿${n}`;

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-medium">{p.value > 999 ? fmtShort(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

function KPICard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">{label}</span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={18} />
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function ProfitCalculator({ adSpendToday, todayRevenue }: { adSpendToday: number; todayRevenue: number }) {
  const [revenue, setRevenue] = useState(todayRevenue);
  const [adSpend, setAdSpend] = useState(adSpendToday);

  const cogs = revenue * 0.38;
  const netProfit = revenue - adSpend - cogs;
  const roas = adSpend > 0 ? (revenue / adSpend).toFixed(2) : "–";
  const margin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-800">Profit Calculator</h2>
        <p className="text-xs text-slate-400 mt-0.5">คำนวณกำไร/ขาดทุนรายวัน</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {[
          { label: "Revenue วันนี้ (฿)", val: revenue, set: setRevenue },
          { label: "Ad Spend วันนี้ (฿)", val: adSpend, set: setAdSpend },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <label className="text-xs text-slate-400 block mb-1">{label}</label>
            <input
              type="number"
              value={val}
              onChange={(e) => set(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Ad Spend", value: fmt(adSpend), ok: true, accent: "bg-orange-50 text-orange-600" },
          { label: "Net Profit", value: fmt(netProfit), ok: netProfit >= 0, accent: netProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600" },
          { label: "ROAS", value: `${roas}x`, ok: parseFloat(roas) >= 3, accent: parseFloat(roas) >= 3 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700" },
          { label: "Margin", value: `${margin}%`, ok: parseFloat(margin) >= 0, accent: parseFloat(margin) >= 0 ? "bg-violet-50 text-violet-700" : "bg-red-50 text-red-600" },
        ].map(({ label, value, accent }) => (
          <div key={label} className={`rounded-xl px-3 py-3 ${accent}`}>
            <p className="text-xs opacity-70">{label}</p>
            <p className="text-lg font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");

  const PRODUCT_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#f43f5e", "#64748b"];

  return (
    <div className="space-y-6">
      {/* Low stock banner */}
      {data.lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">สินค้าใกล้หมด:</span>{" "}
            {data.lowStock.map((p) => `${p.name} (เหลือ ${p.stock} ชิ้น)`).join(" · ")}
          </p>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="รายได้วันนี้" value={fmtShort(data.today.revenue)} sub={`${data.today.orders} ออเดอร์`} icon={TrendingUp} accent="bg-violet-100 text-violet-600" />
        <KPICard label="กำไรสุทธิ (เดือน)" value={fmtShort(data.month.profit)} sub="หลังหักต้นทุน" icon={BarChart2} accent="bg-emerald-100 text-emerald-600" />
        <KPICard label="ยอดขาย (เดือน)" value={fmtShort(data.month.revenue)} sub={`${data.month.orders} ออเดอร์รวม`} icon={ShoppingBag} accent="bg-cyan-100 text-cyan-600" />
        <KPICard label="Ad Spend วันนี้" value={fmtShort(data.adSpendToday)} sub="รวมทุกช่องทาง" icon={Megaphone} accent="bg-orange-100 text-orange-600" />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-800">Revenue & Profit</h2>
            <p className="text-xs text-slate-400 mt-0.5">รายได้ vs กำไรเดือนนี้</p>
          </div>
        </div>
        {data.dailySales.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">ยังไม่มีข้อมูลเดือนนี้</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.dailySales} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {[{ id: "gradRevenue", color: "#8b5cf6" }, { id: "gradProfit", color: "#10b981" }].map(({ id, color }) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#8b5cf6" fill="url(#gradRevenue)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" fill="url(#gradProfit)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Platform breakdown */}
      {data.platformSales.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800">Sales by Platform</h2>
            <p className="text-xs text-slate-400 mt-0.5">ยอดขายแยกตามช่องทางเดือนนี้</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.platformSales} layout="vertical" margin={{ left: 20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="platform" width={90} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]}>
                {data.platformSales.map((entry) => (
                  <Cell key={entry.platform} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Profit Calculator */}
      <ProfitCalculator adSpendToday={data.adSpendToday} todayRevenue={data.today.revenue} />
    </div>
  );
}
