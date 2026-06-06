import { getFollowups } from "@/lib/data/crm";
import CRMClient from "./crm-client";

export default async function CRMPage() {
  const followups = await getFollowups();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">CRM Follow-up</h1>
        <p className="text-sm text-slate-500 mt-1">ติดตามลูกค้าหลังการสั่งซื้อ</p>
      </div>
      <CRMClient followups={followups} />
    </div>
  );
}
