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
        <span className="font-bold text-slate-900">ZANA</span>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            ออกจากระบบ
          </button>
        </form>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
