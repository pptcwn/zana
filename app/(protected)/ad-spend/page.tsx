import { getAdSpend } from "@/lib/data/adspend";
import AdSpendClient from "./ad-spend-client";

export default async function AdSpendPage() {
  const records = await getAdSpend(30);
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Ad Spend</h1>
        <p className="text-sm text-muted-foreground mt-1">บันทึกค่าโฆษณารายวัน</p>
      </div>
      <AdSpendClient records={records} />
    </div>
  );
}
