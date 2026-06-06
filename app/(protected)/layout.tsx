import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-[#FFF0F3]">
      <Sidebar />
      <main className="flex-1 min-w-0 px-8 py-8 bg-[#FFF0F3]">
        {children}
      </main>
    </div>
  );
}
