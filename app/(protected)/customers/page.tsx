import { getCustomers } from "@/lib/data/customers";
import { parsePositiveInteger, singleSearchParam } from "@/lib/data/pagination";
import CustomersClient from "./customers-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = {
    page: parsePositiveInteger(params.page),
    limit: parsePositiveInteger(params.limit),
    search: singleSearchParam(params.search),
    platform: singleSearchParam(params.platform),
  };
  const customers = await getCustomers(filters);
  return (
    <div>
      <CustomersClient
        key={`${filters.search ?? ""}:${filters.platform ?? "all"}`}
        customers={customers.data}
        page={customers.page}
        pageCount={customers.pageCount}
        total={customers.total}
        filters={{
          search: filters.search ?? "",
          platform: filters.platform ?? "all",
        }}
      />
    </div>
  );
}
