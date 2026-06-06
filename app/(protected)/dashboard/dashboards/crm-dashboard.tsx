import DashboardClient from "../dashboard-client";
import type { DashboardData } from "@/lib/data/dashboard";

export function CrmDashboard({ data }: { data: DashboardData }) {
  return <DashboardClient data={data} role="crm" />;
}
