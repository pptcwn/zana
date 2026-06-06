import { getCustomers } from "@/lib/data/customers";
import CustomersClient from "./customers-client";

export default async function CustomersPage() {
  const customers = await getCustomers();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Customers</h1>
        <p className="text-sm text-slate-500 mt-1">ประวัติและข้อมูลลูกค้า</p>
      </div>
      <CustomersClient customers={customers} />
    </div>
  );
}
