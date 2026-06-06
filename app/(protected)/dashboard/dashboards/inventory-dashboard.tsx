import DashboardClient from "../dashboard-client";
import type { DashboardData } from "@/lib/data/dashboard";

export function InventoryDashboard({ data }: { data: DashboardData }) {
  return <DashboardClient data={data} role="inventory" />;
}
