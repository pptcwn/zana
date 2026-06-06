"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function PaginationControls({
  page,
  pageCount,
  total,
}: {
  page: number;
  pageCount: number;
  total: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function href(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    return `${pathname}?${params.toString()}`;
  }

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>ทั้งหมด {total.toLocaleString("th-TH")} รายการ</span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="border border-pink-100 rounded-lg px-3 py-1.5 hover:bg-pink-50">
            ก่อนหน้า
          </Link>
        ) : (
          <span className="border border-pink-100 rounded-lg px-3 py-1.5 opacity-40">ก่อนหน้า</span>
        )}
        <span>หน้า {page} / {pageCount}</span>
        {page < pageCount ? (
          <Link href={href(page + 1)} className="border border-pink-100 rounded-lg px-3 py-1.5 hover:bg-pink-50">
            ถัดไป
          </Link>
        ) : (
          <span className="border border-pink-100 rounded-lg px-3 py-1.5 opacity-40">ถัดไป</span>
        )}
      </div>
    </div>
  );
}
