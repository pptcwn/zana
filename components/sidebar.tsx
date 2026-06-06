"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, Users, Package, TrendingUp, MessageSquare,
  Menu, X, LogOut, Workflow,
} from "lucide-react";
import type { AdminRole, Capability } from "@/lib/auth/capabilities";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, capability: null },
  { href: "/kanban", label: "Workflow", icon: Workflow, capability: "kanban:orders" },
  { href: "/orders", label: "Orders", icon: ShoppingBag, capability: "orders:write" },
  { href: "/crm", label: "CRM", icon: MessageSquare, capability: "crm:write" },
  { href: "/customers", label: "Customers", icon: Users, capability: "customers:write" },
  { href: "/products", label: "Products", icon: Package, capability: "products:write" },
  { href: "/ad-spend", label: "Ad Spend", icon: TrendingUp, capability: "ad-spend:write" },
];

export default function Sidebar({
  role,
  capabilities,
}: {
  role: AdminRole;
  capabilities: Capability[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const Brand = (
    <span className="text-base font-semibold tracking-tight">
      <span aria-hidden className="mr-1">✿</span>
      <span className="text-rose-gold">ZANA</span>
    </span>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 h-12 flex items-center gap-2 px-3 bg-white/70 backdrop-blur-xl border-b border-pink-100">
        <button
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-pink-50 hover:text-primary transition-colors"
        >
          <Menu size={18} />
        </button>
        {Brand}
      </div>

      {/* Overlay (mobile) */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-[#3d2b33]/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-[230px] shrink-0 h-screen z-50 flex flex-col
          bg-white/70 backdrop-blur-2xl border-r border-pink-100 text-sidebar-foreground
          shadow-[0_20px_60px_-30px_rgba(150,85,105,0.5)]
          fixed lg:sticky top-0 transition-transform duration-300 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="px-5 h-[68px] flex items-center justify-between border-b border-pink-100">
          {Brand}
          <button
            onClick={() => setOpen(false)}
            aria-label="ปิดเมนู"
            className="lg:hidden p-1 rounded-md text-muted-foreground hover:text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/70">
            เมนู
          </p>
          {NAV.filter(
            ({ capability }) =>
              !capability || capabilities.includes(capability as Capability)
          ).map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  active
                    ? "btn-primary font-medium shadow-md"
                    : "text-muted-foreground hover:bg-pink-50 hover:text-primary"
                }`}
              >
                <Icon size={16} strokeWidth={active ? 2.2 : 1.6} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-3 border-t border-pink-100">
          <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
            {role}
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-pink-50 hover:text-primary transition-colors text-left"
          >
            <LogOut size={16} strokeWidth={1.6} />
            ออกจากระบบ
          </button>
        </div>
      </aside>
    </>
  );
}
