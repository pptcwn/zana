-- ============================================================
-- ZANA E-Commerce & CRM — Supabase Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PRODUCTS (Master inventory list)
-- ============================================================
create table products (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  sku           text unique not null,
  category      text not null,           -- 'perfume' | 'skincare' | 'maternity' | 'supplement'
  cost_price    numeric(10,2) not null default 0,
  sell_price    numeric(10,2) not null default 0,
  stock_qty     int not null default 0,
  low_stock_threshold int not null default 10,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 2. ADMINS (Team members / sales agents)
-- ============================================================
create table admins (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  email         text unique not null,
  role          text not null default 'telesales',  -- 'admin' | 'telesales' | 'clerk' | 'stock' | 'ceo'
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 3. CUSTOMERS (CRM base)
-- ============================================================
create table customers (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  phone         text,
  address       text,
  platform      text not null,           -- 'tiktok' | 'facebook' | 'line' | 'shopee'
  tags          text[] default '{}',     -- ['vip','repeat','new']
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 4. ORDERS
-- ============================================================
create table orders (
  id              uuid primary key default uuid_generate_v4(),
  order_number    text unique not null,   -- e.g. 'ORD-20240601-001'
  customer_id     uuid references customers(id) on delete set null,
  admin_id        uuid references admins(id) on delete set null,
  platform        text not null,          -- 'tiktok' | 'facebook' | 'line' | 'shopee'
  status          text not null default 'pending',  -- 'pending'|'confirmed'|'shipped'|'delivered'|'cancelled'
  invoice_date    date not null default current_date,
  shipped_date    date,
  total_amount    numeric(10,2) not null default 0,
  total_cost      numeric(10,2) not null default 0,
  shipping_fee    numeric(10,2) not null default 0,
  discount        numeric(10,2) not null default 0,
  net_profit      numeric(10,2) generated always as (total_amount - total_cost - shipping_fee + discount) stored,
  payment_method  text,
  tracking_number text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 5. ORDER ITEMS (Line items per order)
-- ============================================================
create table order_items (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid references orders(id) on delete cascade,
  product_id  uuid references products(id) on delete set null,
  product_name text not null,            -- snapshot at time of order
  qty         int not null default 1,
  unit_price  numeric(10,2) not null,
  unit_cost   numeric(10,2) not null default 0,
  subtotal    numeric(10,2) generated always as (qty * unit_price) stored
);

-- ============================================================
-- 6. INVENTORY MOVEMENTS (Audit trail)
-- ============================================================
create table inventory_movements (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid references products(id) on delete cascade,
  order_id    uuid references orders(id) on delete set null,
  movement_type text not null,           -- 'sale' | 'restock' | 'adjustment' | 'return'
  qty_change  int not null,              -- negative for sales, positive for restock
  qty_after   int not null,
  notes       text,
  created_by  uuid references admins(id),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 7. CRM FOLLOW-UPS (Auto-generated or manual)
-- ============================================================
create table followups (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid references customers(id) on delete cascade,
  order_id        uuid references orders(id) on delete cascade,
  admin_id        uuid references admins(id) on delete set null,
  followup_type   text not null,         -- '3day' | '7day' | '14day' | '30day' | 'manual'
  due_date        date not null,
  status          text not null default 'pending',  -- 'pending' | 'done' | 'skipped'
  outcome         text,                  -- notes from the call/message
  contacted_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 8. AD SPEND (Daily tracking per platform)
-- ============================================================
create table ad_spend (
  id          uuid primary key default uuid_generate_v4(),
  spend_date  date not null,
  platform    text not null,             -- 'tiktok' | 'facebook'
  amount      numeric(10,2) not null default 0,
  impressions int,
  clicks      int,
  notes       text,
  created_by  uuid references admins(id),
  created_at  timestamptz not null default now(),
  unique(spend_date, platform)
);

-- ============================================================
-- INDEXES (Performance)
-- ============================================================
create index idx_orders_invoice_date on orders(invoice_date);
create index idx_orders_customer_id  on orders(customer_id);
create index idx_orders_admin_id     on orders(admin_id);
create index idx_orders_platform     on orders(platform);
create index idx_orders_status       on orders(status);
create index idx_followups_due_date  on followups(due_date);
create index idx_followups_status    on followups(status);
create index idx_inventory_product   on inventory_movements(product_id);
create index idx_ad_spend_date       on ad_spend(spend_date);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-deduct stock on order item insert
create or replace function fn_deduct_stock()
returns trigger language plpgsql as $$
declare
  v_qty_after int;
begin
  update products
  set stock_qty = stock_qty - NEW.qty,
      updated_at = now()
  where id = NEW.product_id
  returning stock_qty into v_qty_after;

  insert into inventory_movements(product_id, order_id, movement_type, qty_change, qty_after)
  values (NEW.product_id, NEW.order_id, 'sale', -NEW.qty, v_qty_after);

  return NEW;
end;
$$;

create trigger trg_deduct_stock
after insert on order_items
for each row execute function fn_deduct_stock();

-- Auto-create follow-up tasks on new order (3, 7, 14, 30 days)
create or replace function fn_create_followups()
returns trigger language plpgsql as $$
begin
  if NEW.status = 'delivered' then
    insert into followups(customer_id, order_id, followup_type, due_date)
    values
      (NEW.customer_id, NEW.id, '3day',  NEW.invoice_date + 3),
      (NEW.customer_id, NEW.id, '7day',  NEW.invoice_date + 7),
      (NEW.customer_id, NEW.id, '14day', NEW.invoice_date + 14),
      (NEW.customer_id, NEW.id, '30day', NEW.invoice_date + 30);
  end if;
  return NEW;
end;
$$;

create trigger trg_create_followups
after insert or update of status on orders
for each row execute function fn_create_followups();

-- Update orders.total_amount from order_items
create or replace function fn_sync_order_totals()
returns trigger language plpgsql as $$
begin
  update orders
  set total_amount = (select coalesce(sum(subtotal),0) from order_items where order_id = NEW.order_id),
      total_cost   = (select coalesce(sum(qty * unit_cost),0) from order_items where order_id = NEW.order_id),
      updated_at   = now()
  where id = NEW.order_id;
  return NEW;
end;
$$;

create trigger trg_sync_order_totals
after insert or update or delete on order_items
for each row execute function fn_sync_order_totals();

-- ============================================================
-- ROW LEVEL SECURITY (Basic setup)
-- ============================================================
alter table orders       enable row level security;
alter table customers    enable row level security;
alter table products     enable row level security;
alter table followups    enable row level security;
alter table ad_spend     enable row level security;

-- Allow authenticated users full access (tighten by role in production)
create policy "auth_all_orders"     on orders     for all using (auth.role() = 'authenticated');
create policy "auth_all_customers"  on customers  for all using (auth.role() = 'authenticated');
create policy "auth_all_products"   on products   for all using (auth.role() = 'authenticated');
create policy "auth_all_followups"  on followups  for all using (auth.role() = 'authenticated');
create policy "auth_all_ad_spend"   on ad_spend   for all using (auth.role() = 'authenticated');

-- ============================================================
-- SEED DATA — ZANA Products
-- ============================================================
insert into products (name, sku, category, cost_price, sell_price, stock_qty, low_stock_threshold) values
  ('Baby Perfume — Milk Blossom 30ml',  'PRF-001', 'perfume',    85,  290,  120, 20),
  ('Baby Perfume — Sweet Powder 30ml',  'PRF-002', 'perfume',    85,  290,   98, 20),
  ('Baby Perfume — Gentle Breeze 30ml', 'PRF-003', 'perfume',    85,  290,   45,  20),
  ('Maternity Pants — S',               'MAT-S',   'maternity', 180,  490,   60, 15),
  ('Maternity Pants — M',               'MAT-M',   'maternity', 180,  490,   72, 15),
  ('Maternity Pants — L',               'MAT-L',   'maternity', 180,  490,   38, 15),
  ('Maternity Pants — XL',              'MAT-XL',  'maternity', 180,  490,   14,  10),
  ('Alpha Arbutin Serum 30ml',          'SER-001', 'skincare',  110,  390,   85, 15),
  ('Vitamin C Brightening Serum 30ml',  'SER-002', 'skincare',  120,  420,   60, 15),
  ('Collagen Face Cream 50g',           'CRM-001', 'skincare',  150,  550,   30, 10),
  ('Detox Coffee 100g',                 'COF-001', 'supplement', 95,  320,   90, 20),
  ('Collagen Coffee 100g',              'COF-002', 'supplement', 95,  320,   65, 20);

