import { createClient } from "@/lib/supabase/server";
import type { Capability } from "@/lib/auth/capabilities";

export async function getDashboardData(capabilities: Capability[]) {
  const supabase = await createClient();
  const financial = capabilities.includes("dashboard:financial");
  const sales = financial || capabilities.includes("dashboard:sales");
  const inventory = capabilities.includes("dashboard:inventory");

  const today = new Date().toISOString().split("T")[0];
  const startOfMonth = today.slice(0, 7) + "-01";

  const [todayOrders, monthOrders, adSpendToday, lowStock] = await Promise.all([
    sales ? supabase
      .from("orders")
      .select("total_amount, net_profit, platform")
      .gte("invoice_date", today) : Promise.resolve({ data: [], error: null }),

    sales ? supabase
      .from("orders")
      .select("invoice_date, total_amount, net_profit, platform")
      .gte("invoice_date", startOfMonth) : Promise.resolve({ data: [], error: null }),

    financial ? supabase
      .from("ad_spend")
      .select("platform, amount")
      .eq("spend_date", today) : Promise.resolve({ data: [], error: null }),

    inventory ? supabase
      .from("products")
      .select("name, sku, stock_qty, low_stock_threshold")
      .eq("is_active", true) : Promise.resolve({ data: [], error: null }),
  ]);

  const todayRevenue = (todayOrders.data ?? []).reduce((s, o) => s + o.total_amount, 0);
  const todayOrderCount = todayOrders.data?.length ?? 0;
  const todayProfit = (todayOrders.data ?? []).reduce((s, o) => s + (o.net_profit ?? 0), 0);

  const monthRevenue = (monthOrders.data ?? []).reduce((s, o) => s + o.total_amount, 0);
  const monthOrderCount = monthOrders.data?.length ?? 0;
  const monthProfit = (monthOrders.data ?? []).reduce((s, o) => s + (o.net_profit ?? 0), 0);

  const totalAdSpendToday = (adSpendToday.data ?? []).reduce((s, a) => s + a.amount, 0);

  // daily chart: group by invoice_date for this month
  const dailyMap = new Map<string, { revenue: number; orders: number; profit: number }>();
  for (const o of monthOrders.data ?? []) {
    const d = o.invoice_date.slice(0, 10);
    const cur = dailyMap.get(d) ?? { revenue: 0, orders: 0, profit: 0 };
    cur.revenue += o.total_amount;
    cur.orders += 1;
    cur.profit += o.net_profit ?? 0;
    dailyMap.set(d, cur);
  }
  const dailySales = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: date.slice(5).replace("-", "/"),
      ...v,
      adSpend: 0,
    }));

  // platform breakdown this month
  const platformMap = new Map<string, { revenue: number; orders: number }>();
  for (const o of monthOrders.data ?? []) {
    const cur = platformMap.get(o.platform) ?? { revenue: 0, orders: 0 };
    cur.revenue += o.total_amount;
    cur.orders += 1;
    platformMap.set(o.platform, cur);
  }
  const PLATFORM_COLORS: Record<string, string> = {
    tiktok: "#fe2c55",
    facebook: "#1877f2",
    line: "#06c755",
    shopee: "#ee4d2d",
  };
  const platformSales = Array.from(platformMap.entries()).map(([platform, v]) => ({
    platform,
    ...v,
    color: PLATFORM_COLORS[platform.toLowerCase()] ?? "#8b5cf6",
  }));

  return {
    today: { revenue: todayRevenue, orders: todayOrderCount, profit: todayProfit },
    month: { revenue: monthRevenue, orders: monthOrderCount, profit: monthProfit },
    adSpendToday: totalAdSpendToday,
    dailySales,
    platformSales,
    lowStock: (lowStock.data ?? [])
      .filter((p) => p.stock_qty <= p.low_stock_threshold)
      .map((p) => ({
        name: p.name,
        sku: p.sku,
        stock: p.stock_qty,
        threshold: p.low_stock_threshold,
      })),
    visibility: { financial, sales, inventory },
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
