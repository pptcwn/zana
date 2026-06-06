import { getDashboardData } from "@/lib/data/dashboard";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardClient data={data} />;
}
