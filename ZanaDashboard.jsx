/**
 * ZANA — Main Dashboard
 * Stack: Next.js + Tailwind CSS + Recharts
 * Data: Supabase (swap mockData calls with supabase.from() queries)
 *
 * Install deps:
 *   npm install recharts @supabase/supabase-js lucide-react
 */

"use client";

import { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Package, Users, ShoppingBag,
  AlertTriangle, Megaphone, BarChart2, RefreshCw, ChevronDown,
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// MOCK DATA  (replace with Supabase queries in production)
// ─────────────────────────────────────────────────────────

const DAILY_SALES = [
  { date: "01/06", revenue: 12400, orders: 42, profit: 5100, adSpend: 2800 },
  { date: "02/06", revenue: 9800,  orders: 33, profit: 3900, adSpend: 2200 },
  { date: "03/06", revenue: 15600, orders: 54, profit: 6800, adSpend: 3100 },
  { date: "04/06", revenue: 11200, orders: 39, profit: 4500, adSpend: 2600 },
  { date: "05/06", revenue: 18900, orders: 65, profit: 8400, adSpend: 3800 },
  { date: "06/06", revenue: 14300, orders: 48, profit: 6200, adSpend: 3000 },
  { date: "07/06", revenue: 16700, orders: 57, profit: 7100, adSpend: 3400 },
];

const MONTHLY_SALES = [
  { month: "ม.ค.", revenue: 198000, orders: 682, profit: 84000 },
  { month: "ก.พ.", revenue: 215000, orders: 740, profit: 91000 },
  { month: "มี.ค.", revenue: 241000, orders: 829, profit: 102000 },
  { month: "เม.ย.", revenue: 229000, orders: 789, profit: 97000 },
  { month: "พ.ค.", revenue: 267000, orders: 920, profit: 113000 },
  { month: "มิ.ย.", revenue: 98900, orders: 338, profit: 42100 },
];

const PLATFORM_SALES = [
  { platform: "TikTok Shop", revenue: 412000, orders: 1420, color: "#fe2c55" },
  { platform: "Facebook",    revenue: 298000, orders: 1026, color: "#1877f2" },
  { platform: "Line OA",     revenue: 186000, orders: 641,  color: "#06c755" },
  { platform: "Shopee",      revenue: 153000, orders: 527,  color: "#ee4d2d" },
];

const PRODUCT_SALES = [
  { name: "Baby Perfume Milk Blossom", qty: 824, revenue: 239000, color: "#8b5cf6" },
  { name: "Alpha Arbutin Serum",       qty: 612, revenue: 238000, color: "#06b6d4" },
  { name: "Maternity Pants",           qty: 498, revenue: 244000, color: "#f59e0b" },
  { name: "Collagen Coffee",           qty: 374, revenue: 119000, color: "#10b981" },
  { name: "Vitamin C Serum",           qty: 291, revenue: 122000, color: "#f43f5e" },
  { name: "Detox Coffee",              qty: 215, revenue:  68800, color: "#64748b" },
];

const ADMIN_PERFORMANCE = [
  { name: "นุ้ย",   orders: 412, revenue: 312000, target: 350000 },
  { name: "แพร",   orders: 368, revenue: 278000, target: 300000 },
  { name: "มิ้น",  orders: 301, revenue: 228000, target: 280000 },
  { name: "กิ๊ฟ",  orders: 287, revenue: 217000, target: 250000 },
  { name: "แบม",  orders: 246, revenue: 185000, target: 220000 },
];

const LOW_STOCK = [
  { name: "Maternity Pants XL", sku: "MAT-XL", stock: 14, threshold: 10 },
  { name: "Collagen Face Cream", sku: "CRM-001", stock: 30, threshold: 10 },
];

const AD_SPEND_TODAY = { tiktok: 3800, facebook: 2600 };
const REVENUE_TODAY = 18900;
const ORDERS_TODAY = 65;

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const fmtShort = (n) =>
  n >= 1000 ? `฿${(n / 1000).toFixed(1)}K` : `฿${n}`;

const pct = (a, b) => (b === 0 ? 0 : ((a - b) / b) * 100).toFixed(1);

// ─────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────

function KPICard({ label, value, sub, trend, icon: Icon, accent }) {
  const isUp = parseFloat(trend) >= 0;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">{label}</span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={18} />
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${isUp ? "text-emerald-600" : "text-red-500"}`}>
          {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {Math.abs(trend)}% vs เมื่อวาน
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold text-gray-800">{title}</h2>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-medium">{typeof p.value === "number" && p.value > 999 ? fmtShort(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// PROFIT CALCULATOR CARD
// ─────────────────────────────────────────────────────────

function ProfitCard() {
  const [tkSpend, setTkSpend] = useState(AD_SPEND_TODAY.tiktok);
  const [fbSpend, setFbSpend] = useState(AD_SPEND_TODAY.facebook);
  const [revenue, setRevenue] = useState(REVENUE_TODAY);

  const totalAdSpend = tkSpend + fbSpend;
  const cogs = revenue * 0.38; // avg cost ratio
  const netProfit = revenue - totalAdSpend - cogs;
  const roas = totalAdSpend > 0 ? (revenue / totalAdSpend).toFixed(2) : "–";
  const isProfit = netProfit >= 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <SectionHeader title="💰 Profit & Ad Spend Calculator" sub="คำนวณกำไร/ขาดทุนรายวัน" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: "Revenue วันนี้ (฿)", val: revenue, set: setRevenue },
          { label: "TikTok Ad Spend (฿)", val: tkSpend, set: setTkSpend },
          { label: "Facebook Ad Spend (฿)", val: fbSpend, set: setFbSpend },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <label className="text-xs text-gray-400 block mb-1">{label}</label>
            <input
              type="number"
              value={val}
              onChange={(e) => set(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Ad Spend", value: fmt(totalAdSpend), accent: "bg-orange-50 text-orange-600" },
          { label: "Net Profit", value: fmt(netProfit), accent: isProfit ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600" },
          { label: "ROAS", value: `${roas}x`, accent: parseFloat(roas) >= 3 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700" },
          { label: "Margin", value: `${revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : 0}%`, accent: isProfit ? "bg-violet-50 text-violet-700" : "bg-red-50 text-red-600" },
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

// ─────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────

export default function ZanaDashboard() {
  const [period, setPeriod] = useState("daily"); // "daily" | "monthly"
  const chartData = period === "daily" ? DAILY_SALES : MONTHLY_SALES;
  const xKey = period === "daily" ? "date" : "month";

  const totalRevenue = MONTHLY_SALES.reduce((s, r) => s + r.revenue, 0);
  const totalOrders  = MONTHLY_SALES.reduce((s, r) => s + r.orders, 0);
  const totalProfit  = MONTHLY_SALES.reduce((s, r) => s + r.profit, 0);
  const totalAdSpend = AD_SPEND_TODAY.tiktok + AD_SPEND_TODAY.facebook;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">Z</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">ZANA</span>
          <span className="text-gray-300 text-sm">/ Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-xs text-gray-400 flex items-center gap-1 hover:text-gray-600">
            <RefreshCw size={13} /> Sync
          </button>
          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-600">A</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Low stock banner */}
        {LOW_STOCK.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">สินค้าใกล้หมด:</span>{" "}
              {LOW_STOCK.map((p) => `${p.name} (เหลือ ${p.stock} ชิ้น)`).join(" · ")}
            </p>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="รายได้วันนี้"      value={fmtShort(REVENUE_TODAY)} sub={`${ORDERS_TODAY} ออเดอร์`}      trend={12.4}  icon={TrendingUp}   accent="bg-violet-100 text-violet-600" />
          <KPICard label="กำไรสุทธิ (เดือน)" value={fmtShort(totalProfit)}   sub="หลังหักต้นทุน + ads"            trend={8.1}   icon={BarChart2}    accent="bg-emerald-100 text-emerald-600" />
          <KPICard label="ยอดขาย (เดือน)"    value={fmtShort(totalRevenue)}  sub={`${totalOrders} ออเดอร์รวม`}  trend={4.7}   icon={ShoppingBag}  accent="bg-cyan-100 text-cyan-600" />
          <KPICard label="Ad Spend วันนี้"    value={fmtShort(totalAdSpend)}  sub="TikTok + Facebook"             trend={-3.2}  icon={Megaphone}    accent="bg-orange-100 text-orange-600" />
        </div>

        {/* Revenue + Profit Area Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="📈 Revenue & Profit" sub="เปรียบเทียบรายได้ vs กำไร" />
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {["daily", "monthly"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${period === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                >
                  {p === "daily" ? "รายวัน" : "รายเดือน"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-4 mb-3 text-xs">
            {[{ label: "Revenue", color: "#8b5cf6" }, { label: "Profit", color: "#10b981" }, { label: "Ad Spend", color: "#f59e0b" }].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-gray-500">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} /> {l.label}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {[
                  { id: "gradRevenue", color: "#8b5cf6" },
                  { id: "gradProfit",  color: "#10b981" },
                  { id: "gradAds",     color: "#f59e0b" },
                ].map(({ id, color }) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `฿${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue"  name="Revenue"   stroke="#8b5cf6" fill="url(#gradRevenue)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="profit"   name="Profit"    stroke="#10b981" fill="url(#gradProfit)"  strokeWidth={2} dot={false} />
              {period === "daily" && (
                <Area type="monotone" dataKey="adSpend" name="Ad Spend" stroke="#f59e0b" fill="url(#gradAds)"    strokeWidth={2} dot={false} strokeDasharray="5 3" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Platform + Product row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Sales by Platform */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <SectionHeader title="📱 Sales by Platform" sub="ยอดขายแยกตามช่องทาง" />
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={PLATFORM_SALES} layout="vertical" margin={{ left: 20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `฿${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="platform" width={90} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]}>
                  {PLATFORM_SALES.map((entry) => (
                    <Cell key={entry.platform} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1">
              {PLATFORM_SALES.map((p) => (
                <div key={p.platform} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-gray-600">{p.platform}</span>
                  </span>
                  <span className="text-gray-400">{p.orders} orders · {fmt(p.revenue)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sales by Product — Pie */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <SectionHeader title="🛍️ Sales by Product" sub="สัดส่วนยอดขายแยกสินค้า" />
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={PRODUCT_SALES}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                  >
                    {PRODUCT_SALES.map((p) => (
                      <Cell key={p.name} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => fmtShort(v)}
                    contentStyle={{ borderRadius: 12, border: "1px solid #f1f5f9", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {PRODUCT_SALES.map((p) => {
                  const total = PRODUCT_SALES.reduce((s, r) => s + r.revenue, 0);
                  const share = ((p.revenue / total) * 100).toFixed(0);
                  return (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-700 truncate">{p.name}</span>
                          <span className="text-gray-400 ml-2">{share}%</span>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full mt-1">
                          <div className="h-1 rounded-full" style={{ width: `${share}%`, background: p.color }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Admin Performance */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <SectionHeader title="👤 Admin Performance" sub="เปรียบเทียบยอดขายรายแอดมิน vs เป้าหมาย" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ADMIN_PERFORMANCE} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `฿${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="ยอดจริง" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="target"  name="เป้าหมาย" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-4 font-medium">แอดมิน</th>
                  <th className="py-2 pr-4 font-medium">ออเดอร์</th>
                  <th className="py-2 pr-4 font-medium">ยอดขาย</th>
                  <th className="py-2 pr-4 font-medium">เป้า</th>
                  <th className="py-2 font-medium">% เป้า</th>
                </tr>
              </thead>
              <tbody>
                {ADMIN_PERFORMANCE.map((a) => {
                  const hit = ((a.revenue / a.target) * 100).toFixed(0);
                  return (
                    <tr key={a.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2 pr-4 font-medium text-gray-800">{a.name}</td>
                      <td className="py-2 pr-4 text-gray-500">{a.orders}</td>
                      <td className="py-2 pr-4 text-gray-700 font-medium">{fmt(a.revenue)}</td>
                      <td className="py-2 pr-4 text-gray-400">{fmt(a.target)}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${parseInt(hit) >= 100 ? "bg-emerald-100 text-emerald-700" : parseInt(hit) >= 80 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                          {hit}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Profit Calculator */}
        <ProfitCard />

      </main>
    </div>
  );
}
