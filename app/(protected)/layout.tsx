import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/login/actions";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-slate-900">ZANA</span>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Dashboard
            </Link>
            <Link href="/orders" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Orders
            </Link>
            <Link href="/crm" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              CRM
            </Link>
            <Link href="/customers" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Customers
            </Link>
            <Link href="/products" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Products
            </Link>
            <Link href="/ad-spend" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Ad Spend
            </Link>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            ออกจากระบบ
          </button>
        </form>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
