# ZANA Plan 3: External Integrations — TikTok, Shopee, LINE + pg-boss

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** รับ webhook จาก TikTok Shop และ Shopee เพื่อ upsert orders อัตโนมัติ, ส่ง LINE Notify แจ้งเตือน followup due ทุกวัน 09:00 ผ่าน pg-boss

**Architecture:** Next.js API route รับ webhook → validate HMAC signature → upsert order ใน Supabase → pg-boss queue followup job. pg-boss worker รันแยกใน Docker container, ใช้ DB เดียวกับ Supabase

**Tech Stack:** pg-boss 9, LINE Messaging API, TikTok Shop API (webhook), Shopee Open API (webhook), Next.js API Routes

**Prerequisite:** Plan 1 + Plan 2 ต้องเสร็จก่อน

---

## File Map

```
app/
└── api/
    └── webhooks/
        ├── tiktok/route.ts          # TikTok Shop webhook receiver
        └── shopee/route.ts          # Shopee webhook receiver
lib/
├── integrations/
│   ├── tiktok.ts                    # TikTok signature validation + order mapper
│   ├── shopee.ts                    # Shopee signature validation + order mapper
│   └── line.ts                      # LINE Notify sender
└── jobs/
    ├── worker.ts                    # pg-boss worker entry point
    └── followup-reminder.ts         # Daily followup job definition
env.ts                               # เพิ่ม LINE_NOTIFY_TOKEN, webhook secrets
```

---

### Task 1: เพิ่ม env variables สำหรับ integrations

**Files:**
- Modify: `env.ts`
- Modify: `.env.example`

- [ ] **Step 1: เพิ่ม integration env ใน `env.ts`**

```typescript
// env.ts (แก้ไข — เพิ่ม server variables)
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    PGBOSS_DATABASE_URL: z.string().url(),
    TIKTOK_APP_SECRET: z.string().min(1),
    SHOPEE_PARTNER_KEY: z.string().min(1),
    LINE_NOTIFY_TOKEN: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PGBOSS_DATABASE_URL: process.env.PGBOSS_DATABASE_URL,
    TIKTOK_APP_SECRET: process.env.TIKTOK_APP_SECRET,
    SHOPEE_PARTNER_KEY: process.env.SHOPEE_PARTNER_KEY,
    LINE_NOTIFY_TOKEN: process.env.LINE_NOTIFY_TOKEN,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
});
```

- [ ] **Step 2: อัปเดต `.env.example`**

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
PGBOSS_DATABASE_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres
TIKTOK_APP_SECRET=your_tiktok_app_secret
SHOPEE_PARTNER_KEY=your_shopee_partner_key
LINE_NOTIFY_TOKEN=your_line_notify_token
```

- [ ] **Step 3: ใส่ค่าจริงใน `.env.local`**

- `TIKTOK_APP_SECRET`: ดูจาก TikTok Developer > App > App Secret
- `SHOPEE_PARTNER_KEY`: ดูจาก Shopee Open Platform > Partner > Partner Key
- `LINE_NOTIFY_TOKEN`: สร้างที่ notify-bot.line.me > Generate token

- [ ] **Step 4: Commit**

```bash
git add env.ts .env.example
git commit -m "chore: add integration env variables for TikTok, Shopee, LINE"
```

---

### Task 2: LINE Notify Integration

**Files:**
- Create: `lib/integrations/line.ts`

- [ ] **Step 1: สร้าง `lib/integrations/line.ts`**

```typescript
// lib/integrations/line.ts
import { env } from "@/env";

export async function sendLineNotify(message: string): Promise<void> {
  const response = await fetch("https://notify-api.line.me/api/notify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LINE_NOTIFY_TOKEN}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ message }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE Notify failed: ${response.status} ${text}`);
  }
}
```

- [ ] **Step 2: ทดสอบ LINE Notify ด้วย script ชั่วคราว**

สร้างไฟล์ `scripts/test-line.ts`:

```typescript
// scripts/test-line.ts
import { sendLineNotify } from "../lib/integrations/line";

sendLineNotify("🧪 ZANA test notification — LINE Notify ใช้งานได้แล้ว!")
  .then(() => console.log("✓ ส่งสำเร็จ"))
  .catch(console.error);
```

```bash
npx ts-node --esm scripts/test-line.ts
```

Expected: เห็นข้อความใน LINE

ลบ script ทดสอบ:
```bash
rm scripts/test-line.ts
```

- [ ] **Step 3: Commit**

```bash
git add lib/integrations/line.ts
git commit -m "feat: add LINE Notify integration"
```

---

### Task 3: TikTok Webhook

**Files:**
- Create: `lib/integrations/tiktok.ts`
- Create: `app/api/webhooks/tiktok/route.ts`

- [ ] **Step 1: สร้าง `lib/integrations/tiktok.ts`**

```typescript
// lib/integrations/tiktok.ts
import { createHmac } from "crypto";
import { env } from "@/env";

export function verifyTikTokSignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string
): boolean {
  const message = [env.TIKTOK_APP_SECRET, timestamp, nonce, body]
    .sort()
    .join("");
  const expected = createHmac("sha256", env.TIKTOK_APP_SECRET)
    .update(message)
    .digest("hex");
  return expected === signature;
}

export interface TikTokOrderPayload {
  order_id: string;
  order_status: string;
  buyer_uid: string;
  item_list: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    sale_price: number;
  }>;
  payment_info: {
    total_amount: number;
    shipping_fee: number;
  };
}

export function mapTikTokOrderStatus(status: string): string {
  const map: Record<string, string> = {
    UNPAID: "pending",
    ON_HOLD: "pending",
    AWAITING_SHIPMENT: "confirmed",
    AWAITING_COLLECTION: "confirmed",
    IN_TRANSIT: "shipped",
    DELIVERED: "delivered",
    COMPLETED: "delivered",
    CANCELLED: "cancelled",
  };
  return map[status] ?? "pending";
}
```

- [ ] **Step 2: สร้าง `app/api/webhooks/tiktok/route.ts`**

```typescript
// app/api/webhooks/tiktok/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyTikTokSignature, mapTikTokOrderStatus, type TikTokOrderPayload } from "@/lib/integrations/tiktok";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const timestamp = request.headers.get("x-tiktok-timestamp") ?? "";
  const nonce = request.headers.get("x-tiktok-nonce") ?? "";
  const signature = request.headers.get("x-tiktok-signature") ?? "";
  const body = await request.text();

  if (!verifyTikTokSignature(timestamp, nonce, body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as { type: string; data: TikTokOrderPayload };

  if (payload.type !== "order_status_change") {
    return NextResponse.json({ ok: true });
  }

  const order = payload.data;
  const supabase = await createServiceClient();

  // Upsert customer
  const { data: customer } = await supabase
    .from("customers")
    .upsert(
      { name: order.buyer_uid, platform: "tiktok" },
      { onConflict: "name,platform", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (!customer) {
    return NextResponse.json({ error: "Failed to upsert customer" }, { status: 500 });
  }

  // Upsert order
  const { data: upsertedOrder, error: orderError } = await supabase
    .from("orders")
    .upsert(
      {
        order_number: order.order_id,
        customer_id: customer.id,
        platform: "tiktok",
        status: mapTikTokOrderStatus(order.order_status),
        total_amount: order.payment_info.total_amount,
        shipping_fee: order.payment_info.shipping_fee,
      },
      { onConflict: "order_number" }
    )
    .select("id")
    .single();

  if (orderError || !upsertedOrder) {
    console.error("TikTok webhook order upsert error:", orderError);
    return NextResponse.json({ error: "Failed to upsert order" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: ทดสอบ webhook endpoint ด้วย curl**

```bash
npm run dev
```

```bash
curl -X POST http://localhost:3000/api/webhooks/tiktok \
  -H "Content-Type: application/json" \
  -H "x-tiktok-timestamp: invalid" \
  -H "x-tiktok-nonce: test" \
  -H "x-tiktok-signature: badsig" \
  -d '{"type":"test"}'
```

Expected: `{"error":"Invalid signature"}` status 401

- [ ] **Step 4: Commit**

```bash
git add lib/integrations/tiktok.ts app/api/webhooks/tiktok/
git commit -m "feat: add TikTok Shop webhook receiver with HMAC validation"
```

---

### Task 4: Shopee Webhook

**Files:**
- Create: `lib/integrations/shopee.ts`
- Create: `app/api/webhooks/shopee/route.ts`

- [ ] **Step 1: สร้าง `lib/integrations/shopee.ts`**

```typescript
// lib/integrations/shopee.ts
import { createHmac } from "crypto";
import { env } from "@/env";

export function verifyShopeeSignature(
  url: string,
  body: string,
  receivedSignature: string
): boolean {
  const baseString = `${url}|${body}`;
  const expected = createHmac("sha256", env.SHOPEE_PARTNER_KEY)
    .update(baseString)
    .digest("hex");
  return expected === receivedSignature;
}

export function mapShopeeOrderStatus(status: string): string {
  const map: Record<string, string> = {
    UNPAID: "pending",
    READY_TO_SHIP: "confirmed",
    PROCESSED: "confirmed",
    SHIPPED: "shipped",
    COMPLETED: "delivered",
    CANCELLED: "cancelled",
    IN_CANCEL: "cancelled",
  };
  return map[status] ?? "pending";
}
```

- [ ] **Step 2: สร้าง `app/api/webhooks/shopee/route.ts`**

```typescript
// app/api/webhooks/shopee/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyShopeeSignature, mapShopeeOrderStatus } from "@/lib/integrations/shopee";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("authorization") ?? "";
  const url = request.url;

  if (!verifyShopeeSignature(url, body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as {
    code: number;
    data: {
      ordersn: string;
      status: string;
      buyer_username: string;
      total_amount: number;
    };
  };

  if (payload.code !== 3) {
    // code 3 = order status update, ignore others
    return NextResponse.json({ ok: true });
  }

  const order = payload.data;
  const supabase = await createServiceClient();

  const { data: customer } = await supabase
    .from("customers")
    .upsert(
      { name: order.buyer_username, platform: "shopee" },
      { onConflict: "name,platform", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (!customer) {
    return NextResponse.json({ error: "Failed to upsert customer" }, { status: 500 });
  }

  const { error: orderError } = await supabase
    .from("orders")
    .upsert(
      {
        order_number: order.ordersn,
        customer_id: customer.id,
        platform: "shopee",
        status: mapShopeeOrderStatus(order.status),
        total_amount: order.total_amount,
      },
      { onConflict: "order_number" }
    );

  if (orderError) {
    console.error("Shopee webhook order upsert error:", orderError);
    return NextResponse.json({ error: "Failed to upsert order" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: ทดสอบ endpoint**

```bash
curl -X POST http://localhost:3000/api/webhooks/shopee \
  -H "Content-Type: application/json" \
  -H "authorization: badsignature" \
  -d '{"code":3}'
```

Expected: `{"error":"Invalid signature"}` status 401

- [ ] **Step 4: Commit**

```bash
git add lib/integrations/shopee.ts app/api/webhooks/shopee/
git commit -m "feat: add Shopee webhook receiver with HMAC validation"
```

---

### Task 5: pg-boss Worker Setup

**Files:**
- Create: `lib/jobs/worker.ts`
- Create: `lib/jobs/followup-reminder.ts`
- Modify: `docker-compose.yml`

- [ ] **Step 1: สร้าง `lib/jobs/followup-reminder.ts`**

```typescript
// lib/jobs/followup-reminder.ts
import { createClient } from "@supabase/supabase-js";
import { sendLineNotify } from "@/lib/integrations/line";
import { env } from "@/env";

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

export async function runFollowupReminder(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const { data: followups, error } = await supabase
    .from("followups")
    .select(`
      id,
      followup_type,
      customers(name, phone),
      admins(name),
      orders(order_number)
    `)
    .eq("status", "pending")
    .eq("due_date", today);

  if (error) throw error;
  if (!followups || followups.length === 0) return;

  const lines = followups.map((f) => {
    const customer = f.customers as { name: string; phone: string } | null;
    const admin = f.admins as { name: string } | null;
    const order = f.orders as { order_number: string } | null;
    return `• ${customer?.name} (${f.followup_type}) — แอดมิน: ${admin?.name} — ${order?.order_number}`;
  });

  const message = [
    `\n📋 ZANA Follow-up วันนี้ (${today})`,
    `มี ${followups.length} รายการที่ต้องติดตาม:`,
    ...lines,
  ].join("\n");

  await sendLineNotify(message);
  console.log(`[followup-reminder] ส่งแจ้งเตือน ${followups.length} รายการแล้ว`);
}
```

- [ ] **Step 2: สร้าง `lib/jobs/worker.ts`**

```typescript
// lib/jobs/worker.ts
import PgBoss from "pg-boss";
import { runFollowupReminder } from "./followup-reminder";

const boss = new PgBoss(process.env.PGBOSS_DATABASE_URL!);

boss.on("error", (error) => console.error("[pg-boss]", error));

async function start() {
  await boss.start();
  console.log("[pg-boss] worker started");

  // Daily followup reminder — runs at 09:00 every day (Asia/Bangkok = UTC+7 → 02:00 UTC)
  await boss.schedule(
    "followup-reminder",
    "0 2 * * *",  // 09:00 Bangkok time
    {},
    { tz: "UTC" }
  );

  await boss.work("followup-reminder", async () => {
    console.log("[followup-reminder] running...");
    await runFollowupReminder();
  });

  console.log("[pg-boss] jobs registered");
}

start().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
```

- [ ] **Step 3: เพิ่ม jobs service ใน `docker-compose.yml`**

```yaml
# docker-compose.yml (เพิ่ม jobs service)
services:
  app:
    build: .
    expose:
      - "3000"
    env_file:
      - .env.local
    restart: unless-stopped

  jobs:
    build: .
    command: node -r ts-node/register lib/jobs/worker.ts
    env_file:
      - .env.local
    depends_on:
      - app
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

  uptime-kuma:
    image: louislam/uptime-kuma:1
    ports:
      - "3001:3001"
    volumes:
      - ./uptime-kuma-data:/app/data
    restart: unless-stopped
```

- [ ] **Step 4: ติดตั้ง ts-node สำหรับ worker**

```bash
npm install -D ts-node
```

- [ ] **Step 5: ทดสอบ worker รันได้**

```bash
npx ts-node lib/jobs/worker.ts
```

Expected: เห็น `[pg-boss] worker started` และ `[pg-boss] jobs registered` ไม่มี error

กด Ctrl+C เพื่อหยุด

- [ ] **Step 6: Commit**

```bash
git add lib/jobs/ docker-compose.yml package.json
git commit -m "feat: add pg-boss worker with daily followup LINE Notify reminder"
```

---

### Task 6: ทดสอบ End-to-End

- [ ] **Step 1: ทดสอบ followup reminder แบบ manual**

สร้างไฟล์ `scripts/trigger-reminder.ts` ชั่วคราว:

```typescript
// scripts/trigger-reminder.ts
import { runFollowupReminder } from "../lib/jobs/followup-reminder";

runFollowupReminder()
  .then(() => console.log("✓ เสร็จ"))
  .catch(console.error);
```

```bash
npx ts-node scripts/trigger-reminder.ts
```

Expected: เห็นข้อความแจ้งเตือนใน LINE (ถ้ามี followup วันนี้)

ลบ script:
```bash
rm scripts/trigger-reminder.ts
```

- [ ] **Step 2: ทดสอบ Docker Compose ทั้งระบบ**

```bash
docker compose build
docker compose up
```

Expected:
- `app` container รันที่ port 3000
- `jobs` container แสดง `[pg-boss] worker started`
- `uptime-kuma` รันที่ port 3001

```bash
docker compose down
```

- [ ] **Step 3: เพิ่ม webhook URLs ใน TikTok/Shopee dashboard**

**TikTok Shop:**
- ไปที่ TikTok Developer > Webhook > Add endpoint
- URL: `https://your-domain.com/api/webhooks/tiktok`
- Events: `ORDER_STATUS_CHANGE`

**Shopee:**
- ไปที่ Shopee Open Platform > Webhook > Set push URL
- URL: `https://your-domain.com/api/webhooks/shopee`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify all integrations configured and docker compose working"
git push origin main
```

Expected: GitHub Actions deploy ไปยัง VPS โดยอัตโนมัติ

---

## Plan 3 Complete

เมื่อจบ Plan 3 จะได้:
- ✅ TikTok Shop webhook รับออเดอร์อัตโนมัติ (HMAC validated)
- ✅ Shopee webhook รับออเดอร์อัตโนมัติ (HMAC validated)
- ✅ LINE Notify แจ้งเตือน followup due ทุกวัน 09:00
- ✅ pg-boss worker รันใน Docker container แยก
- ✅ ระบบทั้งหมด deploy บน VPS ผ่าน GitHub Actions

---

## Success Criteria (ครบ 3 Plans)

- [x] Dashboard แสดงข้อมูลจริงจาก Supabase แทน mock data
- [x] Webhook รับออเดอร์จาก TikTok Shop / Shopee ได้อัตโนมัติ
- [x] LINE Notify แจ้งเตือน followup due ทุกวัน 09:00
- [x] Deploy บน VPS ผ่าน GitHub Actions
- [x] Uptime Kuma monitor และแจ้งเตือนถ้า server down
