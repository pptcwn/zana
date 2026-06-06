# ZANA Plan 2: Core App — Auth, Dashboard, CRM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate ZanaDashboard และ CRMFollowupTracker จาก mock data prototype ไปเป็น Next.js 14 App Router พร้อม Supabase Auth และข้อมูลจริง

**Architecture:** App Router layout แบ่งเป็น (auth) group สำหรับ login และ (dashboard) group สำหรับหน้าที่ต้อง login ก่อน, TanStack Query จัดการ server state ทุก component, Supabase Realtime broadcast เมื่อมีออเดอร์ใหม่

**Tech Stack:** Next.js 14 App Router, Supabase Auth + SSR, TanStack Query 5, Zustand 4, Recharts 2, shadcn/ui

**Prerequisite:** Plan 1 ต้องเสร็จก่อน (Supabase client, env.ts, Docker setup)

---

## File Map

```
app/
├── (auth)/
│   └── login/
│       └── page.tsx              # Login form
├── (dashboard)/
│   ├── layout.tsx                # Sidebar + nav wrapper, auth guard
│   ├── dashboard/
│   │   └── page.tsx              # ZanaDashboard (real data)
│   └── crm/
│       └── page.tsx              # CRMFollowupTracker (real data)
components/
└── zana/
    ├── kpi-card.tsx              # KPICard component
    ├── profit-card.tsx           # ProfitCard interactive calculator
    ├── platform-chart.tsx        # Sales by Platform bar chart
    ├── product-chart.tsx         # Sales by Product pie chart
    ├── admin-table.tsx           # Admin Performance table+chart
    ├── revenue-chart.tsx         # Revenue & Profit area chart
    ├── followup-table.tsx        # CRM followup table
    └── mark-done-modal.tsx       # Mark done modal
lib/
├── queries/
│   ├── dashboard.ts              # TanStack Query hooks for dashboard
│   └── followups.ts             # TanStack Query hooks for CRM
└── providers.tsx                 # TanStack Query + Supabase provider
middleware.ts                     # Auth redirect middleware
```

---

### Task 1: TanStack Query Provider

**Files:**
- Create: `lib/providers.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: สร้าง `lib/providers.tsx`**

```typescript
// lib/providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

- [ ] **Step 2: Wrap `app/layout.tsx` ด้วย Providers**

```typescript
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZANA",
  description: "ZANA E-Commerce & CRM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/providers.tsx app/layout.tsx
git commit -m "feat: add TanStack Query provider"
```

---

### Task 2: Supabase Auth — Login Page

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `middleware.ts`
- Create: `app/page.tsx`

- [ ] **Step 1: สร้าง `app/page.tsx` (redirect ไป dashboard)**

```typescript
// app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 2: สร้าง `middleware.ts` สำหรับ auth guard**

```typescript
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
```

- [ ] **Step 3: สร้าง `app/(auth)/login/page.tsx`**

```typescript
// app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <span className="text-white font-bold">Z</span>
          </div>
          <span className="font-bold text-gray-900 text-xl">ZANA</span>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">อีเมล</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="admin@zana.co.th"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-60 transition-colors"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: สร้าง user ทดสอบใน Supabase**

ไปที่ Supabase dashboard > Authentication > Users > Add user:
- Email: `admin@zana.co.th`
- Password: `zana1234`

- [ ] **Step 5: ทดสอบ login flow**

```bash
npm run dev
```

เปิด `http://localhost:3000` — Expected: redirect ไป `/login`
กรอก email/password ที่สร้างไว้ — Expected: redirect ไป `/dashboard` (404 ยังโอเค เพราะยังไม่ได้สร้างหน้า)
เปิด `http://localhost:3000/login` ขณะ login แล้ว — Expected: redirect ไป `/dashboard`

- [ ] **Step 6: Commit**

```bash
git add app/ middleware.ts
git commit -m "feat: add Supabase Auth login page and middleware auth guard"
```

---

### Task 3: Dashboard Layout (Sidebar)

**Files:**
- Create: `app/(dashboard)/layout.tsx`

- [ ] **Step 1: สร้าง `app/(dashboard)/layout.tsx`**

```typescript
// app/(dashboard)/layout.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BarChart2, Users, ShoppingBag, Package,
  Megaphone, LogOut,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart2 },
  { href: "/crm", label: "CRM Follow-up", icon: Users },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/products", label: "Products", icon: Package },
  { href: "/ad-spend", label: "Ad Spend", icon: Megaphone },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-gray-100">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">Z</span>
          </div>
          <span className="font-bold text-gray-900">ZANA</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-violet-50 hover:text-violet-700 transition-colors"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-sm text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <LogOut size={16} /> ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: สร้าง sign-out route**

```typescript
// app/api/auth/signout/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
}
```

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat: add dashboard sidebar layout with auth guard and sign-out"
```

---

### Task 4: Dashboard Queries (TanStack Query)

**Files:**
- Create: `lib/queries/dashboard.ts`

- [ ] **Step 1: สร้าง `lib/queries/dashboard.ts`**

```typescript
// lib/queries/dashboard.ts
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export function useDailySales(date: string) {
  return useQuery({
    queryKey: ["daily-sales", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("total_amount, net_profit, id")
        .eq("invoice_date", date)
        .eq("status", "delivered");

      if (error) throw error;

      const revenue = data.reduce((s, r) => s + Number(r.total_amount), 0);
      const profit = data.reduce((s, r) => s + Number(r.net_profit), 0);
      const orders = data.length;
      return { revenue, profit, orders };
    },
  });
}

export function useMonthlyRevenue() {
  return useQuery({
    queryKey: ["monthly-revenue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("invoice_date, total_amount, net_profit")
        .eq("status", "delivered")
        .gte("invoice_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);

      if (error) throw error;

      // Group by date
      const byDate = data.reduce<Record<string, { revenue: number; profit: number; orders: number }>>(
        (acc, row) => {
          const d = row.invoice_date;
          if (!acc[d]) acc[d] = { revenue: 0, profit: 0, orders: 0 };
          acc[d].revenue += Number(row.total_amount);
          acc[d].profit += Number(row.net_profit);
          acc[d].orders += 1;
          return acc;
        },
        {}
      );

      return Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date: date.slice(5), // "MM-DD"
          ...vals,
        }));
    },
  });
}

export function usePlatformSales() {
  return useQuery({
    queryKey: ["platform-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("platform, total_amount")
        .eq("status", "delivered");

      if (error) throw error;

      const byPlatform = data.reduce<Record<string, { revenue: number; orders: number }>>(
        (acc, row) => {
          if (!acc[row.platform]) acc[row.platform] = { revenue: 0, orders: 0 };
          acc[row.platform].revenue += Number(row.total_amount);
          acc[row.platform].orders += 1;
          return acc;
        },
        {}
      );

      const COLORS: Record<string, string> = {
        tiktok: "#fe2c55",
        facebook: "#1877f2",
        line: "#06c755",
        shopee: "#ee4d2d",
      };

      return Object.entries(byPlatform).map(([platform, vals]) => ({
        platform,
        color: COLORS[platform] ?? "#94a3b8",
        ...vals,
      }));
    },
  });
}

export function useLowStock() {
  return useQuery({
    queryKey: ["low-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("name, sku, stock_qty, low_stock_threshold")
        .filter("stock_qty", "lte", supabase.from("products").select("low_stock_threshold"))
        .eq("is_active", true);

      if (error) throw error;
      return data.filter((p) => p.stock_qty <= p.low_stock_threshold);
    },
  });
}

export function useAdminPerformance() {
  return useQuery({
    queryKey: ["admin-performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("admin_id, total_amount, admins(name)")
        .eq("status", "delivered");

      if (error) throw error;

      const byAdmin = data.reduce<Record<string, { name: string; revenue: number; orders: number }>>(
        (acc, row) => {
          const id = row.admin_id ?? "unknown";
          const name = (row.admins as { name: string } | null)?.name ?? "Unknown";
          if (!acc[id]) acc[id] = { name, revenue: 0, orders: 0 };
          acc[id].revenue += Number(row.total_amount);
          acc[id].orders += 1;
          return acc;
        },
        {}
      );

      return Object.values(byAdmin);
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/queries/
git commit -m "feat: add TanStack Query hooks for dashboard data"
```

---

### Task 5: Dashboard Page (Real Data)

**Files:**
- Create: `app/(dashboard)/dashboard/page.tsx`
- Create: `components/zana/kpi-card.tsx`
- Create: `components/zana/revenue-chart.tsx`

- [ ] **Step 1: สร้าง `components/zana/kpi-card.tsx`**

```typescript
// components/zana/kpi-card.tsx
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

const fmtShort = (n: number) =>
  n >= 1000 ? `฿${(n / 1000).toFixed(1)}K` : `฿${n}`;

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: number;
  icon: LucideIcon;
  accent: string;
}

export function KPICard({ label, value, sub, trend, icon: Icon, accent }: KPICardProps) {
  const isUp = (trend ?? 0) >= 0;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">{label}</span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={18} />
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">
          {typeof value === "number" ? fmtShort(value) : value}
        </p>
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
```

- [ ] **Step 2: สร้าง `app/(dashboard)/dashboard/page.tsx`**

```typescript
// app/(dashboard)/dashboard/page.tsx
"use client";

import { useDailySales, useMonthlyRevenue, usePlatformSales, useLowStock, useAdminPerformance } from "@/lib/queries/dashboard";
import { KPICard } from "@/components/zana/kpi-card";
import { AlertTriangle, TrendingUp, BarChart2, ShoppingBag, Megaphone } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) =>
  n >= 1000 ? `฿${(n / 1000).toFixed(1)}K` : `฿${n}`;

const today = new Date().toISOString().split("T")[0];

export default function DashboardPage() {
  const { data: daily } = useDailySales(today);
  const { data: monthly = [] } = useMonthlyRevenue();
  const { data: platforms = [] } = usePlatformSales();
  const { data: lowStock = [] } = useLowStock();
  const { data: admins = [] } = useAdminPerformance();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">สินค้าใกล้หมด:</span>{" "}
            {lowStock.map((p) => `${p.name} (เหลือ ${p.stock_qty} ชิ้น)`).join(" · ")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="รายได้วันนี้" value={daily?.revenue ?? 0} sub={`${daily?.orders ?? 0} ออเดอร์`} icon={TrendingUp} accent="bg-violet-100 text-violet-600" />
        <KPICard label="กำไรวันนี้" value={daily?.profit ?? 0} sub="หลังหักต้นทุน" icon={BarChart2} accent="bg-emerald-100 text-emerald-600" />
        <KPICard label="ยอดขาย (เดือน)" value={monthly.reduce((s, r) => s + r.revenue, 0)} sub={`${monthly.reduce((s, r) => s + r.orders, 0)} ออเดอร์รวม`} icon={ShoppingBag} accent="bg-cyan-100 text-cyan-600" />
        <KPICard label="Platform หลัก" value={platforms[0]?.platform ?? "–"} sub={platforms[0] ? fmt(platforms[0].revenue) : ""} icon={Megaphone} accent="bg-orange-100 text-orange-600" />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h2 className="text-base font-bold text-gray-800 mb-4">📈 Revenue & Profit (เดือนนี้)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => fmtShort(v)} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" fill="#10b98120" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Platform + Admin row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-800 mb-4">📱 Sales by Platform</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={platforms} layout="vertical" margin={{ left: 20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="platform" width={80} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => fmtShort(v)} />
              <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]}>
                {platforms.map((p) => <Cell key={p.platform} fill={p.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-800 mb-4">👤 Admin Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-4 font-medium">แอดมิน</th>
                  <th className="py-2 pr-4 font-medium">ออเดอร์</th>
                  <th className="py-2 font-medium">ยอดขาย</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.name} className="border-b border-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-800">{a.name}</td>
                    <td className="py-2 pr-4 text-gray-500">{a.orders}</td>
                    <td className="py-2 text-gray-700 font-medium">{fmt(a.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: ทดสอบ**

```bash
npm run dev
# เปิด http://localhost:3000/dashboard
```

Expected: Dashboard โหลดได้ ไม่มี console error, KPI cards แสดงข้อมูลจาก Supabase (อาจเป็น 0 ถ้ายังไม่มี order)

- [ ] **Step 4: Commit**

```bash
git add app/ components/
git commit -m "feat: migrate ZanaDashboard to real Supabase data with TanStack Query"
```

---

### Task 6: CRM Follow-up Queries

**Files:**
- Create: `lib/queries/followups.ts`

- [ ] **Step 1: สร้าง `lib/queries/followups.ts`**

```typescript
// lib/queries/followups.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export function useFollowups(filters: {
  status?: string;
  followupType?: string;
  platform?: string;
}) {
  return useQuery({
    queryKey: ["followups", filters],
    queryFn: async () => {
      let query = supabase
        .from("followups")
        .select(`
          id,
          followup_type,
          due_date,
          status,
          outcome,
          contacted_at,
          customers(id, name, phone, platform),
          orders(id, order_number, total_amount),
          admins(id, name)
        `)
        .order("due_date", { ascending: true });

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.followupType && filters.followupType !== "all") {
        query = query.eq("followup_type", filters.followupType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useMarkDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, outcome }: { id: string; outcome: string }) => {
      const { error } = await supabase
        .from("followups")
        .update({
          status: "done",
          outcome,
          contacted_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    },
  });
}

export function useSkipFollowup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("followups")
        .update({ status: "skipped" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/queries/followups.ts
git commit -m "feat: add TanStack Query hooks for CRM followups with mutations"
```

---

### Task 7: CRM Follow-up Page (Real Data)

**Files:**
- Create: `app/(dashboard)/crm/page.tsx`

- [ ] **Step 1: สร้าง `app/(dashboard)/crm/page.tsx`**

```typescript
// app/(dashboard)/crm/page.tsx
"use client";

import { useState, useMemo } from "react";
import { useFollowups, useMarkDone, useSkipFollowup } from "@/lib/queries/followups";
import {
  Phone, MessageCircle, CheckCircle2, Clock, AlertCircle,
  Search, Calendar, X, Loader2,
} from "lucide-react";

function daysDiff(dateStr: string) {
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

function DueBadge({ dueDate, status }: { dueDate: string; status: string }) {
  if (status === "done") return (
    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
      <CheckCircle2 size={11} /> เสร็จแล้ว
    </span>
  );
  if (status === "skipped") return (
    <span className="flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
      <X size={11} /> ข้าม
    </span>
  );
  const diff = daysDiff(dueDate);
  if (diff < 0) return (
    <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full animate-pulse">
      <AlertCircle size={11} /> เกินกำหนด {Math.abs(diff)} วัน
    </span>
  );
  if (diff === 0) return (
    <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
      <AlertCircle size={11} /> วันนี้!
    </span>
  );
  if (diff <= 2) return (
    <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
      <Clock size={11} /> อีก {diff} วัน
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
      <Calendar size={11} /> {diff} วัน
    </span>
  );
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  "3day":  { label: "3 วัน",  color: "bg-violet-100 text-violet-700" },
  "7day":  { label: "7 วัน",  color: "bg-cyan-100 text-cyan-700" },
  "14day": { label: "14 วัน", color: "bg-amber-100 text-amber-700" },
  "30day": { label: "30 วัน", color: "bg-fuchsia-100 text-fuchsia-700" },
};

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

export default function CRMPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterType, setFilterType] = useState("all");
  const [modalItem, setModalItem] = useState<{ id: string; name: string } | null>(null);
  const [outcome, setOutcome] = useState("");

  const { data: followups = [], isLoading } = useFollowups({
    status: filterStatus,
    followupType: filterType,
  });

  const markDone = useMarkDone();
  const skipFollowup = useSkipFollowup();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return followups
      .filter((f) => {
        const customer = f.customers as { name: string; phone: string } | null;
        return !q || customer?.name.toLowerCase().includes(q) || customer?.phone?.includes(q);
      })
      .sort((a, b) => daysDiff(a.due_date) - daysDiff(b.due_date));
  }, [followups, search]);

  const todayCount = followups.filter((f) => f.status === "pending" && daysDiff(f.due_date) <= 0).length;
  const upcomingCount = followups.filter((f) => f.status === "pending" && daysDiff(f.due_date) > 0).length;
  const doneCount = followups.filter((f) => f.status === "done").length;

  async function handleMarkDone() {
    if (!modalItem) return;
    await markDone.mutateAsync({ id: modalItem.id, outcome });
    setModalItem(null);
    setOutcome("");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-2xl p-4 border ${todayCount > 0 ? "bg-red-50 border-red-100" : "bg-white border-gray-100"}`}>
          <p className="text-xs text-red-400 font-medium uppercase tracking-widest">ติดตามวันนี้</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{todayCount}</p>
        </div>
        <div className="rounded-2xl p-4 border bg-amber-50 border-amber-100">
          <p className="text-xs text-amber-500 font-medium uppercase tracking-widest">กำลังจะถึง</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{upcomingCount}</p>
        </div>
        <div className="rounded-2xl p-4 border bg-emerald-50 border-emerald-100">
          <p className="text-xs text-emerald-500 font-medium uppercase tracking-widest">เสร็จแล้ว</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{doneCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="ค้นหาชื่อ, เบอร์..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[["all", "ทั้งหมด"], ["pending", "รอติดตาม"], ["done", "เสร็จแล้ว"]] .map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${filterStatus === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
          <option value="all">ทุก follow-up</option>
          <option value="3day">3 วัน</option>
          <option value="7day">7 วัน</option>
          <option value="14day">14 วัน</option>
          <option value="30day">30 วัน</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-violet-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3 font-medium">ลูกค้า</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Follow-up</th>
                  <th className="px-4 py-3 font-medium">กำหนด</th>
                  <th className="px-4 py-3 font-medium">ผล</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-300">ไม่พบรายการ</td></tr>
                ) : filtered.map((f) => {
                  const customer = f.customers as { name: string; phone: string } | null;
                  const order = f.orders as { order_number: string; total_amount: number } | null;
                  return (
                    <tr key={f.id} className="hover:bg-violet-50/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-gray-800">{customer?.name}</p>
                        <a href={`tel:${customer?.phone}`} className="text-xs text-violet-500 flex items-center gap-0.5 mt-0.5">
                          <Phone size={10} /> {customer?.phone}
                        </a>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs text-gray-400">{order?.order_number}</p>
                        <p className="text-xs font-semibold text-gray-800 mt-0.5">{fmt(Number(order?.total_amount ?? 0))}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${TYPE_META[f.followup_type]?.color}`}>
                          {TYPE_META[f.followup_type]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <DueBadge dueDate={f.due_date} status={f.status} />
                      </td>
                      <td className="px-4 py-3.5 max-w-[140px]">
                        {f.outcome ? <p className="text-xs text-gray-500 line-clamp-2">{f.outcome}</p> : <span className="text-xs text-gray-200">–</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {f.status === "pending" ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setModalItem({ id: f.id, name: customer?.name ?? "" })}
                              className="bg-violet-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-violet-700 flex items-center gap-1">
                              <CheckCircle2 size={11} /> Mark done
                            </button>
                            <button onClick={() => skipFollowup.mutate(f.id)}
                              className="border border-gray-200 text-gray-400 px-2 py-1.5 rounded-lg text-xs hover:bg-gray-50">
                              <X size={11} />
                            </button>
                            <a href={`https://line.me/ti/p/~${customer?.phone}`} target="_blank" rel="noopener noreferrer"
                              className="border border-green-200 text-green-500 px-2 py-1.5 rounded-lg text-xs hover:bg-green-50">
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mark Done Modal */}
      {modalItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">บันทึกผลการติดตาม</h3>
              <button onClick={() => setModalItem(null)} className="text-gray-400"><X size={18} /></button>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-3">{modalItem.name}</p>
            <textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={3}
              placeholder="เช่น ลูกค้าพอใจ / ไม่รับสาย / สั่งซื้อเพิ่ม..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setModalItem(null)}
                className="flex-1 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm hover:bg-gray-50">
                ยกเลิก
              </button>
              <button onClick={handleMarkDone} disabled={markDone.isPending}
                className="flex-1 bg-violet-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-violet-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {markDone.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ทดสอบ CRM page**

```bash
npm run dev
# เปิด http://localhost:3000/crm
```

Expected: หน้า CRM โหลดได้ แสดง loading spinner ระหว่าง fetch, table แสดง followups จาก Supabase

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "feat: migrate CRMFollowupTracker to real Supabase data with mutations"
```

---

## Plan 2 Complete

เมื่อจบ Plan 2 จะได้:
- ✅ Supabase Auth login/logout
- ✅ Middleware auth guard
- ✅ Dashboard sidebar layout
- ✅ Dashboard page ด้วยข้อมูลจริง (revenue, platform, admin)
- ✅ CRM Follow-up page พร้อม mark done / skip mutations

**Next:** Plan 3 — External Integrations (TikTok, Shopee, LINE webhooks + pg-boss jobs)
