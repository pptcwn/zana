import { getDashboardData } from "@/lib/data/dashboard";
import { getAuthorizedAdmin } from "@/lib/auth/shield";
import { OwnerDashboard } from "./dashboards/owner-dashboard";
import { AdminDashboard } from "./dashboards/admin-dashboard";
import { SalesDashboard } from "./dashboards/sales-dashboard";
import { CrmDashboard } from "./dashboards/crm-dashboard";
import { InventoryDashboard } from "./dashboards/inventory-dashboard";

export default async function DashboardPage() {
  const admin = await getAuthorizedAdmin();
  const data = await getDashboardData(admin.capabilities);
  switch (admin.role) {
    case "owner":
      return <OwnerDashboard data={data} />;
    case "admin":
      return <AdminDashboard data={data} />;
    case "sales":
      return <SalesDashboard data={data} />;
    case "crm":
      return <CrmDashboard data={data} />;
    case "inventory":
      return <InventoryDashboard data={data} />;
  }
}
