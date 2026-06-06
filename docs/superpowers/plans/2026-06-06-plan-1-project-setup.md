# ZANA Plan 1: Project Setup & Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง Next.js 14 project พร้อม TypeScript, Tailwind, Supabase connection, Docker, Nginx, และ GitHub Actions CI/CD พร้อม deploy บน VPS

**Architecture:** Next.js 14 App Router รัน Docker container บน VPS, Nginx เป็น reverse proxy จัดการ SSL, GitHub Actions deploy ผ่าน SSH เมื่อ push main branch

**Tech Stack:** Next.js 14, TypeScript 5, Tailwind CSS 3, shadcn/ui, Supabase JS v2, t3-env, Docker, Docker Compose, Nginx, GitHub Actions

---

## File Map

```
zana/
├── app/
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Redirect to /dashboard
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   ├── server.ts               # Server Supabase client
│   │   └── types.ts                # Generated types (placeholder ก่อน)
├── env.ts                          # t3-env schema
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx.conf
├── .env.example
└── .github/
    └── workflows/
        └── deploy.yml
```

---

### Task 1: Init Next.js Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`

- [ ] **Step 1: สร้าง Next.js project ใหม่**

```bash
npx create-next-app@latest zana \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
cd zana
```

- [ ] **Step 2: ติดตั้ง dependencies หลัก**

```bash
npm install @supabase/supabase-js @supabase/ssr \
  @t3-oss/env-nextjs zod \
  zustand @tanstack/react-query \
  recharts lucide-react \
  pg-boss
npm install -D @types/pg
```

- [ ] **Step 3: ติดตั้ง shadcn/ui**

```bash
npx shadcn@latest init
```

เลือก options:
- Style: Default
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 4: ตรวจสอบ project build ได้**

```bash
npm run build
```

Expected output: ไม่มี error, เห็น `✓ Compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: init Next.js 14 project with TypeScript, Tailwind, shadcn"
```

---

### Task 2: Environment Variables (t3-env)

**Files:**
- Create: `env.ts`
- Create: `.env.example`
- Create: `.env.local` (ไม่ commit)

- [ ] **Step 1: สร้าง `env.ts`**

```typescript
// env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    PGBOSS_DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PGBOSS_DATABASE_URL: process.env.PGBOSS_DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
});
```

- [ ] **Step 2: สร้าง `.env.example`**

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...
PGBOSS_DATABASE_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres
```

- [ ] **Step 3: สร้าง `.env.local` จริงบนเครื่อง**

```bash
cp .env.example .env.local
# แล้วใส่ค่าจริงจาก Supabase dashboard > Settings > API
```

- [ ] **Step 4: เพิ่ม `.env.local` ใน `.gitignore`**

ตรวจสอบว่า `.gitignore` มีบรรทัดนี้แล้ว (create-next-app เพิ่มให้อัตโนมัติ):
```
.env*.local
```

- [ ] **Step 5: ทดสอบว่า env validation ทำงาน**

```bash
# ลบ key ออกชั่วคราวแล้ว build
NEXT_PUBLIC_SUPABASE_URL="" npm run build
```

Expected: error ข้อความ `❌ Invalid environment variables: ...`

```bash
# คืนค่ากลับ แล้ว build ปกติ
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 6: Commit**

```bash
git add env.ts .env.example .gitignore
git commit -m "chore: add t3-env schema for type-safe environment variables"
```

---

### Task 3: Supabase Client Setup

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/types.ts`

- [ ] **Step 1: Apply schema ใน Supabase Cloud**

เปิด Supabase dashboard > SQL Editor แล้วรัน `zana_supabase_schema.sql` ทั้งหมด

Expected: ไม่มี error, เห็นตาราง products, customers, orders, ... ใน Table Editor

- [ ] **Step 2: Generate TypeScript types**

```bash
npx supabase login
npx supabase gen types typescript \
  --project-id <your-project-id> \
  > lib/supabase/types.ts
```

หา `project-id` ที่ Supabase dashboard > Settings > General > Reference ID

Expected: ไฟล์ `lib/supabase/types.ts` มี `export type Database = { ... }`

- [ ] **Step 3: สร้าง `lib/supabase/client.ts`**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { env } from "@/env";

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
```

- [ ] **Step 4: สร้าง `lib/supabase/server.ts`**

```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { env } from "@/env";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export async function createServiceClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
```

- [ ] **Step 5: ทดสอบ connection**

สร้างไฟล์ทดสอบชั่วคราว `app/test-db/page.tsx`:

```typescript
// app/test-db/page.tsx
import { createClient } from "@/lib/supabase/server";

export default async function TestPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("id, name").limit(3);
  return (
    <pre>{JSON.stringify({ data, error }, null, 2)}</pre>
  );
}
```

```bash
npm run dev
# เปิด http://localhost:3000/test-db
```

Expected: เห็น JSON ของ products (หรือ `data: []` ถ้ายังไม่มีข้อมูล) ไม่มี error

ลบไฟล์ทดสอบ:
```bash
rm -rf app/test-db
```

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/ env.ts
git commit -m "feat: add Supabase browser and server clients with type safety"
```

---

### Task 4: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: สร้าง `.dockerignore`**

```
node_modules
.next
.git
.env*.local
*.md
docs/
```

- [ ] **Step 2: สร้าง `Dockerfile`**

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

- [ ] **Step 3: เพิ่ม `output: "standalone"` ใน `next.config.ts`**

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 4: สร้าง `docker-compose.yml` (development)**

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    restart: unless-stopped

  uptime-kuma:
    image: louislam/uptime-kuma:1
    ports:
      - "3001:3001"
    volumes:
      - ./uptime-kuma-data:/app/data
    restart: unless-stopped
```

- [ ] **Step 5: ทดสอบ Docker build**

```bash
docker compose build
docker compose up
```

เปิด `http://localhost:3000` — Expected: Next.js default page โหลดได้

```bash
docker compose down
```

- [ ] **Step 6: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore next.config.ts
git commit -m "chore: add Docker and Docker Compose setup for VPS deployment"
```

---

### Task 5: Nginx Configuration

**Files:**
- Create: `nginx.conf`

- [ ] **Step 1: สร้าง `nginx.conf`**

```nginx
# nginx.conf
events {
  worker_connections 1024;
}

http {
  upstream nextjs {
    server app:3000;
  }

  # Redirect HTTP to HTTPS
  server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl;
    server_name your-domain.com;  # แก้เป็น domain จริง

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location / {
      proxy_pass         http://nextjs;
      proxy_http_version 1.1;
      proxy_set_header   Upgrade $http_upgrade;
      proxy_set_header   Connection 'upgrade';
      proxy_set_header   Host $host;
      proxy_set_header   X-Real-IP $remote_addr;
      proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header   X-Forwarded-Proto $scheme;
      proxy_cache_bypass $http_upgrade;
    }

    # Static files cache
    location /_next/static/ {
      proxy_pass http://nextjs;
      add_header Cache-Control "public, max-age=31536000, immutable";
    }
  }
}
```

- [ ] **Step 2: เพิ่ม nginx service ใน `docker-compose.yml`**

```yaml
# docker-compose.yml (แก้ไข — เพิ่ม nginx service)
services:
  app:
    build: .
    expose:
      - "3000"        # ไม่ expose ออก host โดยตรง
    env_file:
      - .env.local
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

- [ ] **Step 3: Commit**

```bash
git add nginx.conf docker-compose.yml
git commit -m "chore: add Nginx reverse proxy config with SSL and security headers"
```

---

### Task 6: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: เพิ่ม GitHub Secrets บน repo**

ไปที่ GitHub repo > Settings > Secrets and variables > Actions > New repository secret:

| Secret Name | ค่า |
|------------|-----|
| `VPS_HOST` | IP address ของ VPS |
| `VPS_USER` | username (เช่น `root` หรือ `ubuntu`) |
| `VPS_SSH_KEY` | private key (รัน `cat ~/.ssh/id_rsa` บน local) |
| `VPS_PORT` | SSH port (ปกติ `22`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `PGBOSS_DATABASE_URL` | PostgreSQL connection string |

- [ ] **Step 2: สร้าง `.github/workflows/deploy.yml`**

```yaml
# .github/workflows/deploy.yml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          PGBOSS_DATABASE_URL: ${{ secrets.PGBOSS_DATABASE_URL }}

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            cd /opt/zana
            git pull origin main
            echo "NEXT_PUBLIC_SUPABASE_URL=${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}" > .env.production
            echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" >> .env.production
            echo "SUPABASE_SERVICE_ROLE_KEY=${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" >> .env.production
            echo "PGBOSS_DATABASE_URL=${{ secrets.PGBOSS_DATABASE_URL }}" >> .env.production
            docker compose -f docker-compose.yml up -d --build
```

- [ ] **Step 3: เตรียม VPS ครั้งแรก (รัน manual ครั้งเดียว)**

SSH เข้า VPS แล้วรัน:

```bash
# ติดตั้ง Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Clone repo
mkdir -p /opt/zana
cd /opt/zana
git clone https://github.com/<your-username>/zana.git .

# สร้าง SSL directory (ใส่ cert จาก Let's Encrypt)
mkdir -p ssl
# certbot certonly --standalone -d your-domain.com
# cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/
# cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/
```

- [ ] **Step 4: ทดสอบ CI/CD**

```bash
git add .github/
git commit -m "chore: add GitHub Actions deploy workflow"
git push origin main
```

Expected: ไปที่ GitHub Actions tab เห็น workflow รันและผ่าน (green checkmark)

- [ ] **Step 5: ตรวจสอบ deployment บน VPS**

เปิด browser ที่ `https://your-domain.com`

Expected: Next.js app โหลดได้ผ่าน HTTPS

---

## Plan 1 Complete

เมื่อจบ Plan 1 จะได้:
- ✅ Next.js 14 + TypeScript + Tailwind + shadcn/ui
- ✅ Supabase connected พร้อม type safety
- ✅ t3-env validate environment variables
- ✅ Docker + Nginx บน VPS
- ✅ GitHub Actions auto-deploy เมื่อ push main
- ✅ Uptime Kuma monitoring

**Next:** Plan 2 — Core App (Auth, Dashboard, CRM migration)
