"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, ChevronRight, Loader2, Plus, Trash2, Star } from "lucide-react";
import { upsertCustomerAction, type CustomerInput } from "./actions";
import { toast } from "@/components/ui/feedback";
import type { CustomerRow, CustomerPlatform } from "@/lib/data/customers";
import { PaginationControls } from "@/components/ui/pagination-controls";

const fmt = (n: number) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok", facebook: "Facebook", line: "Line OA", shopee: "Shopee",
};

const PLATFORM_OPTIONS = ["tiktok", "facebook", "line", "shopee"] as const;
type PlatformId = (typeof PLATFORM_OPTIONS)[number];

const STATUS_LABEL: Record<string, string> = {
  pending: "รอส่ง", confirmed: "ยืนยันแล้ว", shipped: "ส่งแล้ว", delivered: "เสร็จสิ้น", cancelled: "ยกเลิก",
};

const inputCls = "input-luxe";

type EditablePlatform = { platform: PlatformId; handle: string; is_primary: boolean };

function toEditable(platforms: CustomerPlatform[]): EditablePlatform[] {
  if (platforms.length === 0) {
    return [{ platform: "tiktok", handle: "", is_primary: true }];
  }
  return platforms.map((p) => ({
    platform: (PLATFORM_OPTIONS.includes(p.platform as PlatformId) ? p.platform : "tiktok") as PlatformId,
    handle: p.handle ?? "",
    is_primary: p.is_primary,
  }));
}

function PlatformEditor({
  platforms,
  onChange,
}: {
  platforms: EditablePlatform[];
  onChange: (next: EditablePlatform[]) => void;
}) {
  const used = new Set(platforms.map((p) => p.platform));
  const available = PLATFORM_OPTIONS.filter((p) => !used.has(p));

  function update(index: number, patch: Partial<EditablePlatform>) {
    onChange(platforms.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function setPrimary(index: number) {
    onChange(platforms.map((p, i) => ({ ...p, is_primary: i === index })));
  }

  function remove(index: number) {
    const next = platforms.filter((_, i) => i !== index);
    // Ensure exactly one primary remains.
    if (next.length > 0 && !next.some((p) => p.is_primary)) next[0].is_primary = true;
    onChange(next);
  }

  function add() {
    if (available.length === 0) return;
    onChange([...platforms, { platform: available[0], handle: "", is_primary: platforms.length === 0 }]);
  }

  return (
    <div className="space-y-2">
      <label className="text-xs text-pink-400 block">Platform (เลือกหลักได้ 1)</label>
      {platforms.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPrimary(i)}
            title={p.is_primary ? "Platform หลัก" : "ตั้งเป็นหลัก"}
            className={`shrink-0 p-1.5 rounded-lg transition-colors ${
              p.is_primary ? "text-amber-500 bg-amber-50" : "text-pink-200 hover:text-amber-400 hover:bg-pink-50"
            }`}
          >
            <Star size={14} fill={p.is_primary ? "currentColor" : "none"} />
          </button>
          <select
            value={p.platform}
            onChange={(e) => update(i, { platform: e.target.value as PlatformId })}
            className="border border-pink-100 rounded-lg px-2 py-1.5 text-xs bg-white/70 focus:outline-none focus:ring-1 focus:ring-pink-300"
          >
            {PLATFORM_OPTIONS.filter((opt) => opt === p.platform || !used.has(opt)).map((opt) => (
              <option key={opt} value={opt}>{PLATFORM_LABEL[opt]}</option>
            ))}
          </select>
          <input
            value={p.handle}
            onChange={(e) => update(i, { handle: e.target.value })}
            placeholder="@handle / id"
            className="flex-1 min-w-0 border border-pink-100 rounded-lg px-2 py-1.5 text-xs bg-white/70 focus:outline-none focus:ring-1 focus:ring-pink-300 placeholder:text-pink-200"
          />
          {platforms.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 p-1.5 rounded-lg text-pink-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      {available.length > 0 && (
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-600 transition-colors"
        >
          <Plus size={13} /> เพิ่ม platform
        </button>
      )}
    </div>
  );
}

function CustomerForm({
  customer,
  onCancel,
  onSaved,
}: {
  customer: CustomerRow | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [platforms, setPlatforms] = useState<EditablePlatform[]>(
    toEditable(customer?.platforms ?? [])
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อลูกค้า");
      return;
    }
    setSaving(true);
    try {
      const input: CustomerInput = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim() || null,
        notes: notes.trim() || null,
        platforms: platforms.map((p) => ({
          platform: p.platform,
          handle: p.handle.trim() || null,
          is_primary: p.is_primary,
        })),
      };
      await upsertCustomerAction(customer?.id ?? null, input);
      toast.success(customer ? "บันทึกข้อมูลลูกค้าแล้ว" : "เพิ่มลูกค้าใหม่แล้ว");
      onSaved();
    } catch {
      toast.error("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-pink-400 block mb-1">ชื่อ</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-pink-400 block mb-1">เบอร์</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
      </div>
      <PlatformEditor platforms={platforms} onChange={setPlatforms} />
      <div>
        <label className="text-xs text-pink-400 block mb-1">ที่อยู่</label>
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3}
          className={`${inputCls} resize-none`} />
      </div>
      <div>
        <label className="text-xs text-pink-400 block mb-1">หมายเหตุ</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className={`${inputCls} resize-none`} />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 border border-pink-100 text-muted-foreground py-2 rounded-lg text-sm hover:bg-pink-50">ยกเลิก</button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 btn-primary py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={13} className="animate-spin" /> : null} บันทึก
        </button>
      </div>
    </div>
  );
}

function CustomerPanel({
  customer,
  isNew,
  onClose,
  onSaved,
}: {
  customer: CustomerRow | null;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(isNew);

  const title = isNew ? "เพิ่มลูกค้าใหม่" : customer?.name ?? "";
  const totalSpend = customer?.total_spend ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm glass-strong !rounded-none h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/70 backdrop-blur border-b border-pink-100 px-5 py-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <button onClick={onClose} className="text-pink-300 hover:text-pink-500"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          {!isNew && customer && (
            <div className="grid grid-cols-2 gap-3">
              <div className="glass px-4 py-3">
                <p className="text-xl font-semibold text-foreground">{customer.order_count}</p>
                <p className="text-xs text-pink-400 mt-0.5">ออเดอร์</p>
              </div>
              <div className="glass px-4 py-3">
                <p className="text-xl font-semibold text-foreground">{fmt(totalSpend)}</p>
                <p className="text-xs text-pink-400 mt-0.5">ยอดรวม</p>
              </div>
            </div>
          )}

          {editing ? (
            <CustomerForm
              customer={customer}
              onCancel={isNew ? onClose : () => setEditing(false)}
              onSaved={onSaved}
            />
          ) : customer ? (
            <div className="space-y-3">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-pink-400">เบอร์</span>
                  <span className="text-foreground/90">{customer.phone ?? "–"}</span>
                </div>
                <div>
                  <p className="text-pink-400 mb-1.5">Platform</p>
                  <div className="flex flex-wrap gap-1.5">
                    {customer.platforms.map((p) => (
                      <span key={p.platform}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                          p.is_primary ? "bg-amber-50 text-amber-600" : "bg-pink-50 text-pink-500"
                        }`}>
                        {p.is_primary && <Star size={10} fill="currentColor" />}
                        {PLATFORM_LABEL[p.platform] ?? p.platform}
                        {p.handle ? <span className="opacity-70">· {p.handle}</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
                {customer.address && (
                  <div>
                    <p className="text-pink-400 mb-1">ที่อยู่</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">{customer.address}</p>
                  </div>
                )}
                {customer.notes && (
                  <div>
                    <p className="text-pink-400 mb-1">หมายเหตุ</p>
                    <p className="text-muted-foreground text-xs">{customer.notes}</p>
                  </div>
                )}
              </div>
              <button onClick={() => setEditing(true)}
                className="w-full border border-pink-100 text-muted-foreground py-1.5 rounded-lg text-xs hover:bg-pink-50 transition-colors">
                แก้ไขข้อมูล
              </button>
            </div>
          ) : null}

          {!isNew && customer && (
            <div>
              <p className="text-xs text-pink-400 uppercase tracking-wider font-medium mb-2">ประวัติออเดอร์</p>
              {(customer.orders ?? []).length === 0 ? (
                <p className="text-xs text-pink-200 py-4 text-center">ยังไม่มีออเดอร์</p>
              ) : (
                <div className="space-y-1.5">
                  {[...(customer.orders ?? [])].sort((a, b) => b.invoice_date.localeCompare(a.invoice_date)).map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-2 border-b border-pink-100">
                      <div>
                        <p className="text-xs font-medium text-foreground/90">{o.order_number}</p>
                        <p className="text-xs text-pink-300">{new Date(o.invoice_date + "T00:00:00").toLocaleDateString("th-TH")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-foreground">{fmt(o.total_amount)}</p>
                        <p className="text-xs text-muted-foreground/70">{STATUS_LABEL[o.status] ?? o.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomersClient({
  customers,
  page,
  pageCount,
  total,
  filters,
}: {
  customers: CustomerRow[];
  page: number;
  pageCount: number;
  total: number;
  filters: { search: string; platform: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(filters.search);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [creating, setCreating] = useState(false);

  const updateQuery = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search !== filters.search) updateQuery("search", search);
    }, 350);
    return () => clearTimeout(timeout);
  }, [search, filters.search, updateQuery]);

  function handleSaved() {
    setSelected(null);
    setCreating(false);
    router.refresh();
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ประวัติและข้อมูลลูกค้า</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shrink-0">
          <Plus size={14} /> เพิ่มลูกค้า
        </button>
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-300" />
          <input type="text" placeholder="ค้นหาชื่อ, เบอร์..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-pink-100 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-pink-300 bg-white/70 placeholder:text-pink-200" />
        </div>
        <select value={filters.platform} onChange={(e) => updateQuery("platform", e.target.value)}
          className="border border-pink-100 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground focus:outline-none bg-white/70">
          <option value="all">ทุก Platform</option>
          <option value="tiktok">TikTok</option>
          <option value="facebook">Facebook</option>
          <option value="line">Line OA</option>
          <option value="shopee">Shopee</option>
        </select>
      </div>

      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-pink-100 text-xs text-pink-400">
              <th className="px-4 py-3 font-medium">ลูกค้า</th>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium">ออเดอร์</th>
              <th className="px-4 py-3 font-medium">ยอดรวม</th>
              <th className="px-4 py-3 font-medium">ล่าสุด</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-100">
            {customers.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-xs text-pink-200">ไม่พบลูกค้า</td></tr>
            ) : customers.map((c) => {
              const lastOrderDate = c.last_order_date;
              return (
                <tr key={c.id} onClick={() => setSelected(c)} className="hover:bg-pink-50/60 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground/70">{c.phone ?? "–"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.platforms.map((p) => (
                        <span key={p.platform}
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            p.is_primary ? "bg-amber-50 text-amber-600" : "bg-pink-50 text-pink-500"
                          }`}>
                          {PLATFORM_LABEL[p.platform] ?? p.platform}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.order_count}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{fmt(c.total_spend)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground/70">
                    {lastOrderDate ? new Date(lastOrderDate).toLocaleDateString("th-TH") : "–"}
                  </td>
                  <td className="px-4 py-3"><ChevronRight size={14} className="text-pink-200" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationControls page={page} pageCount={pageCount} total={total} />

      {creating && (
        <CustomerPanel customer={null} isNew onClose={() => setCreating(false)} onSaved={handleSaved} />
      )}
      {selected && !creating && (
        <CustomerPanel customer={selected} isNew={false} onClose={() => setSelected(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
