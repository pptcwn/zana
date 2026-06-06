"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { DashboardData } from "@/lib/data/dashboard";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) =>
  n >= 1000000 ? `฿${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `฿${(n / 1000).toFixed(1)}K` : `฿${n}`;

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-pink-100 rounded-lg shadow-sm p-3 text-xs">
      <p className="text-slate-500 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="text-slate-400">{p.name}</span>
          <span className="font-medium text-slate-900">{p.value > 999 ? fmtShort(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-pink-100 rounded-xl p-5 shadow-sm">
      <p className="text-xs text-pink-400 mb-3">{label}</p>
      <p className="text-2xl font-semibold text-slate-800 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
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
    <div className="bg-white border border-pink-100 rounded-xl p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-800 mb-4">Profit Calculator</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
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
              className="w-full border border-pink-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-pink-300 bg-pink-50/30"
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-pink-50">
        {[
          { label: "Ad Spend", value: fmt(adSpend) },
          { label: "Net Profit", value: fmt(netProfit), muted: netProfit < 0 },
          { label: "ROAS", value: `${roas}×` },
          { label: "Margin", value: `${margin}%`, muted: parseFloat(margin) < 0 },
        ].map(({ label, value, muted }) => (
          <div key={label}>
            <p className="text-xs text-pink-400">{label}</p>
            <p className={`text-sm font-semibold mt-0.5 ${muted ? "text-red-400" : "text-slate-800"}`}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-base font-semibold text-slate-800">Dashboard</h1>
        <p className="text-xs text-pink-300 mt-0.5">ภาพรวมธุรกิจ</p>
      </div>

      {/* Low stock */}
      {data.lowStock.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-2.5 text-xs text-amber-700">
          <span className="font-medium">สินค้าใกล้หมด:</span>{" "}
          {data.lowStock.map((p) => `${p.name} (${p.stock} ชิ้น)`).join(" · ")}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="รายได้วันนี้" value={fmtShort(data.today.revenue)} sub={`${data.today.orders} ออเดอร์`} />
        <StatCard label="กำไรสุทธิ เดือนนี้" value={fmtShort(data.month.profit)} sub="หลังหักต้นทุน" />
        <StatCard label="ยอดขาย เดือนนี้" value={fmtShort(data.month.revenue)} sub={`${data.month.orders} ออเดอร์`} />
        <StatCard label="Ad Spend วันนี้" value={fmtShort(data.adSpendToday)} sub="รวมทุกช่องทาง" />
      </div>

      {/* Chart */}
      <div className="bg-white border border-pink-100 rounded-xl p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-800 mb-4">Revenue & Profit เดือนนี้</p>
        {data.dailySales.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs text-pink-200">ยังไม่มีข้อมูล</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.dailySales} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                {[{ id: "r", color: "#ec4899" }, { id: "p", color: "#f9a8d4" }].map(({ id, color }) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#f9a8d4" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#f9a8d4" }} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#ec4899" strokeWidth={2} fill="url(#r)" dot={false} />
              <Area type="monotone" dataKey="profit" name="Profit" stroke="#f9a8d4" strokeWidth={2} fill="url(#p)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Platform */}
      {data.platformSales.length > 0 && (
        <div className="bg-white border border-pink-100 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-800 mb-4">Sales by Platform เดือนนี้</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.platformSales} layout="vertical" margin={{ left: 0, right: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#f9a8d4" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="platform" width={80} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                {data.platformSales.map((_, i) => (
                  <Cell key={i} fill={["#ec4899", "#f472b6", "#f9a8d4", "#fce7f3"][i % 4]} />
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
