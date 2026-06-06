# ZANA — Tech Stack Design Spec
**Date:** 2026-06-06  
**Project:** ZANA E-Commerce & CRM  
**Author:** Solo developer  
**Status:** Approved

---

## Context

ZANA เป็นระบบ E-Commerce & CRM สำหรับธุรกิจขายสินค้าออนไลน์ไทย (น้ำหอมเด็ก, กางเกงคนท้อง, เซรั่ม, กาแฟสุขภาพ) ผ่าน TikTok Shop, Facebook, LINE OA, Shopee มีโปรเจค prototype แล้ว (JSX + SQL schema) และกำลังจะ build production system

**Constraints:**
- Solo developer
- Web browser เป็น primary interface (desktop + mobile browser)
- มี VPS เป็นของตัวเอง — host Next.js เอง
- ใช้ Supabase Cloud เป็น managed backend service
- Priority 6 เดือนแรก: integration กับ platform ภายนอก (TikTok, Shopee, LINE)

---

## Architecture Overview

```
VPS (self-hosted)
├── Next.js 14 App        — Docker container, port 3000
├── Nginx                 — reverse proxy, SSL termination
├── pg-boss worker        — background job processor
└── Uptime Kuma           — self-hosted monitoring

         ↓ HTTPS / Supabase JS client

Supabase Cloud
├── PostgreSQL            — schema จาก zana_supabase_schema.sql
├── Auth                  — JWT sessions, role-based (admins table)
├── Realtime              — order notifications, followup alerts
└── Storage               — รูปสินค้า, slip การชำระเงิน

         ↓ Server Actions (server-side only)

External APIs
├── LINE Notify / LINE Messaging API
├── TikTok Shop API
└── Shopee Open API
```

---

## Tech Stack

| Layer | Technology | Version | เหตุผล |
|-------|-----------|---------|--------|
| **Framework** | Next.js | 14 (App Router) | ต่อยอด JSX prototype ได้ทันที, Server Actions ลด boilerplate |
| **Language** | TypeScript | 5.x | Type safety ตั้งแต่ DB ถึง UI |
| **UI Library** | Tailwind CSS | 3.x | มีอยู่ใน prototype แล้ว |
| **Components** | shadcn/ui | latest | headless components บน Radix UI, ไม่ lock-in |
| **Charts** | Recharts | 2.x | มีอยู่ใน prototype แล้ว |
| **Server State** | TanStack Query | 5.x | cache, refetch, optimistic updates |
| **Client State** | Zustand | 4.x | UI state เบาและเรียบง่าย |
| **Database** | Supabase Cloud (PostgreSQL) | — | schema พร้อม, RLS พร้อม |
| **Auth** | Supabase Auth | — | role-based ตาม admins table |
| **Realtime** | Supabase Realtime | — | order notifications, followup due alerts |
| **Background Jobs** | pg-boss | 9.x | ใช้ DB เดิม ไม่ต้องเพิ่ม Redis |
| **Env Validation** | t3-env | latest | validate env ตอน build time |
| **Reverse Proxy** | Nginx | latest stable | SSL termination, static files |
| **Containerization** | Docker + Docker Compose | — | reproducible deploy บน VPS |
| **CI/CD** | GitHub Actions → SSH | — | push แล้ว auto deploy |
| **Monitoring** | Uptime Kuma | 1.x | self-host บน VPS เดียวกัน, แจ้งเตือน LINE |

---

## Project Structure

```
zana/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx            # shared nav/sidebar
│   │   ├── dashboard/page.tsx    # ZanaDashboard
│   │   ├── crm/page.tsx          # CRMFollowupTracker
│   │   ├── orders/page.tsx
│   │   ├── products/page.tsx
│   │   └── ad-spend/page.tsx
│   └── api/
│       └── webhooks/
│           ├── tiktok/route.ts
│           ├── shopee/route.ts
│           └── line/route.ts
├── components/
│   ├── ui/                       # shadcn/ui components
│   └── zana/                     # ZANA-specific components
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # browser client
│   │   ├── server.ts             # server client (Server Actions)
│   │   └── types.ts              # generated types (supabase gen types)
│   ├── integrations/
│   │   ├── tiktok.ts
│   │   ├── shopee.ts
│   │   └── line.ts
│   └── jobs/                     # pg-boss job definitions
│       ├── worker.ts             # job worker entry point
│       ├── followup-reminder.ts
│       └── platform-sync.ts
├── env.ts                        # t3-env schema
├── docker-compose.yml
└── nginx.conf
```

---

## Key Patterns

### Supabase Type Safety
```bash
# รันหลัง schema เปลี่ยน
supabase gen types typescript --project-id <id> > lib/supabase/types.ts
```
ทุก query จะ type-safe โดยอัตโนมัติ ลด runtime bug

### External API Integration Flow
```
Webhook → /api/webhooks/[platform]/route.ts
  → validate signature (HMAC)
  → Server Action: upsert order ใน Supabase
  → pg-boss: queue followup job
  → Supabase Realtime: broadcast → UI update
```

### Background Job Pattern (pg-boss)
```typescript
// lib/jobs/followup-reminder.ts
// ส่ง LINE Notify เมื่อ followup due
// รัน schedule ทุกวัน 09:00
```

### Environment Validation (t3-env)
```typescript
// env.ts — crash ตอน startup ถ้า env ขาด
// ไม่มี runtime surprise จาก missing key
```

---

## Infrastructure: Docker Compose

```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env.production
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on: [app]

  jobs:
    build: .
    command: node lib/jobs/worker.js
    env_file: .env.production
    restart: unless-stopped

  uptime-kuma:
    image: louislam/uptime-kuma:1
    ports: ["3001:3001"]
    volumes: ["./uptime-kuma:/app/data"]
    restart: unless-stopped
```

---

## CI/CD: GitHub Actions

```
git push → GitHub Actions
  → npm run build (type check + build)
  → SSH to VPS
  → docker compose pull && docker compose up -d
```

---

## What We Explicitly Exclude

| สิ่ง | เหตุผล |
|------|--------|
| Redis / BullMQ | pg-boss เพียงพอ ไม่เพิ่ม service |
| tRPC | Server Actions ทำได้เหมือนกัน solo dev ไม่คุ้ม |
| Kubernetes | VPS เดียว Docker Compose เพียงพอ |
| Separate API server | Next.js จัดการได้ครบ |
| Supabase self-host | ใช้ Supabase Cloud — ลด ops overhead |

---

## Migration from Prototype

ไฟล์ที่มีอยู่แล้วจะ migrate ดังนี้:

| ไฟล์เดิม | ปลายทาง |
|---------|---------|
| `ZanaDashboard.jsx` | `app/(dashboard)/dashboard/page.tsx` + แปลงเป็น `.tsx` |
| `ZanaCRMFollowup.jsx` | `app/(dashboard)/crm/page.tsx` + แปลงเป็น `.tsx` |
| `zana_supabase_schema.sql` | apply ใน Supabase Cloud, generate types |

Mock data ใน JSX จะถูกแทนที่ด้วย TanStack Query + Supabase queries ทีละ component

---

## Success Criteria (6 เดือนแรก)

- [ ] Dashboard แสดงข้อมูลจริงจาก Supabase แทน mock data
- [ ] Webhook รับออเดอร์จาก TikTok Shop / Shopee ได้อัตโนมัติ
- [ ] LINE Notify แจ้งเตือน followup due ทุกวัน 09:00
- [ ] Realtime notification เมื่อมีออเดอร์ใหม่
- [ ] Deploy บน VPS ผ่าน GitHub Actions
- [ ] Uptime Kuma monitor และแจ้งเตือนถ้า server down
