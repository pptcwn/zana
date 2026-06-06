import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
import { Feedback } from "@/components/ui/feedback";
import { getAuthorizedAdmin } from "@/lib/auth/shield";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const admin = await getAuthorizedAdmin();

  return (
    <div className="flex min-h-screen">
      <Sidebar role={admin.role} capabilities={admin.capabilities} />
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8 pt-16 lg:pt-8">
        {children}
      </main>
      <Feedback />
    </div>
  );
}
