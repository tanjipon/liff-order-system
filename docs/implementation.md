# 甜點工作室訂購系統｜實作細節與 GitHub Project 規劃

**版本：** v1.7  
**依據：** dessert-shop-spec.md v1.5  
**原則：** 最佳軟體工程實踐、單人開發、零成本部署

**v1.1 異動說明：** 依據 DB Function vs Backend Logic 分析結果，調整業務邏輯分層。僅保留真正需要原子性保證的操作於 DB Function（`create_order`、`admin_cancel_order`），其餘狀態轉移邏輯移至 Backend，提升可讀性與可測試性。

**v1.2 異動說明：** `sessions.per_person_limit` 支援無上限設定。`NULL` 表示不限購，影響 Schema constraint、DB Function quota 檢查、Backend quota 邏輯及對應 Unit Test。

**v1.3 異動說明：** 導入資料庫驅動的 RBAC 系統。新增 `roles`、`permissions`、`role_permissions`、`user_roles` 四張表，取代原本的 shared secret 驗證。後台新增人員管理與角色權限管理功能，讓老闆可自行在後台管理帳號與角色，IT 僅需負責初始設定。新增 M6 Milestone 負責人員與角色管理功能。

**v1.4 異動說明：** 新增現金付款方式與取貨方式管理功能。`orders` 表新增 `payment_method`、`pickup_option_id`、`pickup_fee` 三個欄位；新增 `pickup_options` 表；`create_order` DB Function 更新以支援取貨費用快照；狀態機新增現金付款跳過 `payment_submitted` 的路徑；RBAC seed 新增 `pickup_options:manage` 權限；新增 M7 Milestone。

**v1.5 異動說明：** 新增 Session 預設開搶時間與追加庫存排程功能。Session 開放判斷改為時間條件驅動（`opens_at / closes_at`）；新增 `session_restocks` 與 `restock_items` 表；`create_order` DB Function 於庫存扣除前惰性套用到期 restock；RBAC seed 新增 `restocks:manage` 權限；新增 M8 Milestone。

**v1.8 異動說明：** 新增 M10 UI 美化 Milestone。採純 Tailwind CSS 手刻（不引入 shadcn/ui），以 CSS custom properties 建立 LIFF 粉嫩系與 Admin Gmail 系雙色彩 token；新增 `useMinLoading` hook（最少 1.5 秒載入，避免畫面閃爍）；LIFF 載入動畫改為 GIF 動圖；後台載入改為 Spinner；LIFF 頁面採手機優先設計；後台 Dashboard 支援桌機與手機響應式佈局；所有數字顯示元件採固定寬度，避免版面位移。

**v1.7 異動說明：** 新增商品個別購買上限功能。`products` 表新增 `max_per_person int`（NULL = 不限）；`create_order` DB Function 在庫存扣除前加入 per-product quota 檢查；新增錯誤碼 `PRODUCT_QUOTA_EXCEEDED`；後台新增/編輯商品表單新增欄位；LIFF 選購頁依 `max_per_person` 限制單品數量選擇器；新增 M9 Milestone。

**v1.6 異動說明：** 調整 restock 套用機制。改為**主動觸發 + 惰性備援**雙層架構：新增 `apply_pending_restocks(session_id)` DB Function，由 `GET /api/sessions/active` 在回傳前主動呼叫，確保客戶進入頁面時即看到最新庫存；Function 同時回傳下一波 restock 的 `next_restock_at`，讓前端在庫存歸零時顯示倒數計時器，時間到自動重新拉取庫存。`create_order` 內的惰性套用邏輯保留作為雙重保護。M8 Issue 清單依此機制調整。

---

## 目錄

1. [Repository 結構](#1-repository-結構)
2. [環境設定](#2-環境設定)
3. [Supabase 實作細節](#3-supabase-實作細節)
4. [後端 API 實作細節](#4-後端-api-實作細節)
5. [前端實作細節](#5-前端實作細節)
6. [測試策略](#6-測試策略)
7. [CI/CD 流程](#7-cicd-流程)
8. [GitHub Project 規劃](#8-github-project-規劃)
9. [RBAC 系統設計](#9-rbac-系統設計)

---

## 1. Repository 結構

採用 **Monorepo**，單一 repo 管理前後端，降低單人開發的管理複雜度。

```
dessert-shop/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml           # PR 觸發：lint + test
│   │   └── deploy.yml       # main merge 觸發：部署到 Vercel
│   └── ISSUE_TEMPLATE/
│       ├── feature.md
│       └── bug.md
├── apps/
│   ├── web/                 # Next.js 前端（LIFF + 後台）
│   │   ├── app/
│   │   │   ├── liff/        # LIFF 訂購頁 & 查詢頁
│   │   │   │   ├── order/   # 訂購流程
│   │   │   │   └── status/  # 訂單查詢
│   │   │   └── admin/       # 後台管理頁
│   │   │       ├── orders/
│   │   │       ├── sessions/
│   │   │       └── stats/
│   │   ├── components/
│   │   │   ├── liff/
│   │   │   └── admin/
│   │   ├── lib/
│   │   │   ├── supabase.ts      # Supabase client
│   │   │   ├── liff.ts          # LINE LIFF SDK wrapper
│   │   │   ├── api.ts           # API 呼叫封裝
│   │   │   ├── orderStatus.ts   # 狀態轉移驗證（純邏輯，可 unit test）
│   │   │   ├── quota.ts         # Quota 計算（純邏輯，可 unit test）
│   │   │   └── auth/
│   │   │       ├── verifyLiff.ts    # LIFF token 驗證
│   │   │       ├── verifyAdmin.ts   # 後台 JWT + RBAC 驗證
│   │   │       └── permissions.ts   # Permission key 型別定義
│   │   └── __tests__/
├── supabase/
│   ├── migrations/              # 資料庫版本控制
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_functions.sql    # 僅保留需要原子性的 2 個 function
│   │   └── 004_rbac_seed.sql    # 初始角色、權限資料
│   ├── seed.sql             # 開發用測試資料
│   └── config.toml
├── docs/
│   ├── spec.md              # 規格書
│   └── implementation.md   # 本文件
├── .env.example
└── package.json             # workspace root
```

---

## 2. 環境設定

### 2.1 環境變數

```bash
# .env.example

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # 僅後台 API 使用，絕不暴露至前端

# LINE LIFF
NEXT_PUBLIC_LIFF_ID=

# 匯款帳號資訊（顯示給客戶）
NEXT_PUBLIC_BANK_CODE=
NEXT_PUBLIC_BANK_ACCOUNT=
NEXT_PUBLIC_BANK_HOLDER=

# 備註：後台登入改用 Supabase Auth，不再需要 ADMIN_SECRET
```

### 2.2 開發環境啟動

```bash
# 安裝 Supabase CLI
brew install supabase/tap/supabase

# 本地 Supabase 啟動（含 PostgreSQL + Studio）
supabase start

# 套用 migration
supabase db push

# 注入測試資料
supabase db seed

# 啟動 Next.js
cd apps/web && npm run dev
```

### 2.3 Branch 策略

```
main          ← 唯一保護分支，永遠可部署
  └── feature/xxx   ← 功能開發
  └── fix/xxx       ← 修正
  └── chore/xxx     ← 設定、文件
```

所有 PR 合併至 main 前必須通過 CI。

---

## 3. Supabase 實作細節

### 3.1 Migration 001 — 初始 Schema

```sql
-- 001_initial_schema.sql

create extension if not exists "uuid-ossp";

-- sessions
create table sessions (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  opens_at         timestamptz,
  closes_at        timestamptz,
  is_active        boolean not null default false,
  per_person_limit int check (per_person_limit > 0),  -- NULL = 無上限；有值時必須 > 0
  created_at       timestamptz not null default now()
);

-- products
create table products (
  id             uuid primary key default uuid_generate_v4(),
  session_id     uuid not null references sessions(id) on delete cascade,
  name           text not null,
  price          int not null check (price >= 0),
  stock_qty      int not null check (stock_qty >= 0),
  max_per_person int check (max_per_person > 0),  -- NULL = 不限；有值時必須 > 0
  created_at     timestamptz not null default now()
);

-- orders
create type order_status as enum (
  'pending',
  'in_production',
  'pending_payment',
  'payment_submitted',
  'completed',
  'cancelled'
);

create type cancelled_by_enum as enum ('customer', 'admin');
create type payment_method_enum as enum ('bank_transfer', 'cash');

create table orders (
  id                uuid primary key default uuid_generate_v4(),
  session_id        uuid not null references sessions(id),
  line_user_id      text not null,
  line_display_name text not null,
  status            order_status not null default 'pending',
  payment_method    payment_method_enum not null,          -- 下單時選擇，之後不得修改
  total_amount      int not null default 0,                -- 商品小計 + pickup_fee
  remit_last5       text,                                  -- 僅 bank_transfer 適用
  pickup_option_id  uuid references pickup_options(id),
  pickup_fee        int not null default 0,                -- 下單當時取貨費用快照
  queue_number      int,
  edit_count        int not null default 0,
  last_edited_at    timestamptz,
  cancelled_by      cancelled_by_enum,
  cancel_reason     text,
  created_at        timestamptz not null default now()
);

-- order_items
create table order_items (
  id         uuid primary key default uuid_generate_v4(),
  order_id   uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity   int not null check (quantity > 0),
  unit_price int not null check (unit_price >= 0)
);

-- pickup_options（取貨方式，老闆在後台管理）
create table pickup_options (
  id                       uuid primary key default uuid_generate_v4(),
  name                     text not null,
  description              text,
  extra_fee                int not null default 0 check (extra_fee >= 0),
  allowed_payment_methods  text[],   -- NULL = 不限制；例如 ['bank_transfer']
  is_active                boolean not null default true,
  sort_order               int not null default 0,
  created_at               timestamptz not null default now()
);

create index idx_pickup_options_active on pickup_options(is_active, sort_order);

-- session_restocks（追加庫存排程）
create table session_restocks (
  id         uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  opens_at   timestamptz not null,
  is_active  boolean not null default true,   -- false = 老闆取消
  applied    boolean not null default false,  -- true = 已套用，不可取消
  created_at timestamptz not null default now()
);

-- restock_items（追加庫存品項）
create table restock_items (
  restock_id uuid not null references session_restocks(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity   int not null check (quantity > 0),
  primary key (restock_id, product_id)
);

create index idx_restocks_session_pending
  on session_restocks(session_id, opens_at)
  where is_active = true and applied = false;

-- index: 常用查詢加速
create index idx_orders_session_line on orders(session_id, line_user_id);
create index idx_orders_status on orders(status);
create index idx_orders_created_at on orders(created_at);
create index idx_order_items_order on order_items(order_id);

-- ── RBAC 系統 ──────────────────────────────────────────

-- roles（角色定義，老闆可在後台新增）
create table roles (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,   -- 'owner', 'assistant', 'baker' 等
  created_at timestamptz not null default now()
);

-- permissions（權限項目清單，由 IT 部署時建立，程式碼不再更動）
create table permissions (
  id   uuid primary key default uuid_generate_v4(),
  key  text not null unique,  -- 'orders:cancel', 'sessions:create' 等
  name text not null          -- '取消訂單', '建立開單' 等（UI 顯示用）
);

-- role_permissions（角色與權限的多對多關係，老闆可在後台勾選）
create table role_permissions (
  role_id       uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- user_roles（人員帳號管理）
create table user_roles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role_id      uuid not null references roles(id),
  display_name text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index idx_user_roles_role on user_roles(role_id);
```

### 3.2 Migration 002 — RLS Policies

```sql
-- 002_rls_policies.sql

alter table sessions   enable row level security;
alter table products   enable row level security;
alter table orders     enable row level security;
alter table order_items enable row level security;

-- sessions: 所有人可讀取 active session
create policy "sessions_select_active"
  on sessions for select
  using (is_active = true);

-- products: 所有人可讀取
create policy "products_select_all"
  on products for select
  using (true);

-- orders: 客戶只能讀取自己的訂單
-- line_user_id 由後端從 LIFF token 解析後存入 request header
create policy "orders_select_own"
  on orders for select
  using (line_user_id = current_setting('app.current_line_user_id', true));

-- orders: 客戶建立訂單
create policy "orders_insert_own"
  on orders for insert
  with check (line_user_id = current_setting('app.current_line_user_id', true));

-- orders: 客戶修改自己的訂單（僅 pending 狀態，由 function 強制驗證）
create policy "orders_update_own"
  on orders for update
  using (
    line_user_id = current_setting('app.current_line_user_id', true)
    and status = 'pending'
  );

-- order_items: 跟隨訂單權限
create policy "order_items_select_own"
  on order_items for select
  using (
    order_id in (
      select id from orders
      where line_user_id = current_setting('app.current_line_user_id', true)
    )
  );

-- ── RBAC 表的 RLS ────────────────────────────────────────

alter table roles            enable row level security;
alter table permissions      enable row level security;
alter table role_permissions enable row level security;
alter table user_roles       enable row level security;

-- roles / permissions / role_permissions：登入用戶皆可讀取（前端渲染角色管理頁面需要）
create policy "roles_select_authenticated"
  on roles for select
  using (auth.role() = 'authenticated');

create policy "permissions_select_authenticated"
  on permissions for select
  using (auth.role() = 'authenticated');

create policy "role_permissions_select_authenticated"
  on role_permissions for select
  using (auth.role() = 'authenticated');

-- user_roles：使用者只能讀取自己的紀錄（verifyAdmin 查詢用）
create policy "user_roles_select_own"
  on user_roles for select
  using (user_id = auth.uid());

-- 寫入操作（roles / permissions / role_permissions / user_roles）
-- 皆由後台透過 service role key 執行，不開放 RLS 寫入 policy
```

### 3.4 Migration 004 — RBAC 初始資料

IT 部署時執行一次，建立系統內所有權限項目與預設角色。之後老闆在後台自行調整角色與權限的對應關係，不需要再改這份 SQL。

```sql
-- 004_rbac_seed.sql

-- 1. 建立預設角色
insert into roles (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-000000000002', 'assistant');

-- 2. 建立所有權限項目（固定清單，後續新增功能才會異動）
insert into permissions (id, key, name) values
  ('10000000-0000-0000-0000-000000000001', 'sessions:create',          '建立開單'),
  ('10000000-0000-0000-0000-000000000002', 'sessions:edit',            '編輯開單'),
  ('10000000-0000-0000-0000-000000000003', 'orders:accept',            '接受訂單'),
  ('10000000-0000-0000-0000-000000000004', 'orders:reject',            '拒絕訂單'),
  ('10000000-0000-0000-0000-000000000005', 'orders:mark_ready',        '標記製作完成'),
  ('10000000-0000-0000-0000-000000000006', 'orders:cancel',            '取消訂單'),
  ('10000000-0000-0000-0000-000000000007', 'orders:confirm_payment',   '確認付款'),
  ('10000000-0000-0000-0000-000000000008', 'stats:view',               '查看報表'),
  ('10000000-0000-0000-0000-000000000009', 'staff:manage',             '管理人員'),
  ('10000000-0000-0000-0000-000000000010', 'roles:manage',             '管理角色權限'),
  ('10000000-0000-0000-0000-000000000011', 'pickup_options:manage',    '管理取貨方式'),
  ('10000000-0000-0000-0000-000000000012', 'restocks:manage',          '管理追加庫存排程');

-- 3. 設定 owner 擁有所有權限
insert into role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000000001', id from permissions;

-- 4. 設定 assistant 的預設權限
insert into role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000000002', id
from permissions
where key in (
  'orders:accept',
  'orders:reject',
  'orders:mark_ready',
  'orders:confirm_payment',
  'stats:view'
);
```

### 3.3 Migration 003 — Database Functions

只保留**真正需要原子性保證**的 function。其餘狀態轉移邏輯移至 Backend（見第 4 節）。

| Function | 位置 | 理由 |
|----------|------|------|
| `create_order` | DB Function | 多步驟 transaction + 庫存 `FOR UPDATE` 鎖定，放 DB 防止 race condition |
| `admin_cancel_order` | DB Function | 連鎖釋放庫存 + quota，transaction 保證必要 |
| `apply_pending_restocks` | DB Function | `FOR UPDATE` 鎖定防止並發重複套用；回傳 `next_restock_at` 供前端倒數 |
| `admin_accept_order` | **Backend** | 單純狀態更新 + 排單號計算，無需原子性，放 Backend 提升可測試性 |
| 其他狀態轉移 | **Backend** | 純狀態驗證，易 unit test，不需 DB |

```sql
-- 003_functions.sql

-- (A) 建立訂單（含庫存扣除 + quota 檢查 + 取貨費用快照）
-- 需要 DB Function：多品項庫存鎖定（FOR UPDATE）+ quota + order_items 必須原子完成
-- 注意：Step 5 的 restock 惰性套用保留作為雙重保護；主動套用已由 apply_pending_restocks 完成
create or replace function create_order(
  p_session_id       uuid,
  p_line_user_id     text,
  p_display_name     text,
  p_items            jsonb,
  p_pickup_option_id uuid,
  p_payment_method   payment_method_enum
) returns uuid language plpgsql as $$
declare
  v_order_id         uuid;
  v_total            int := 0;
  v_quota_used       int;
  v_quota_limit      int;
  v_new_qty          int;
  v_item             jsonb;
  v_product          record;
  v_pickup           record;
  v_restock          record;
  v_product_qty_used int;
begin
  -- 1. 檢查 session 是否開放（時間條件 + is_active 雙重驗證）
  select per_person_limit into v_quota_limit
  from sessions
  where id = p_session_id
    and is_active = true
    and (opens_at is null or opens_at <= now())
    and (closes_at is null or closes_at >= now());
  if not found then
    raise exception 'SESSION_NOT_ACTIVE';
  end if;

  -- 2. quota 檢查：NULL 表示無上限，直接跳過
  if v_quota_limit is not null then
    select coalesce(sum(oi.quantity), 0) into v_quota_used
    from orders o
    join order_items oi on oi.order_id = o.id
    where o.session_id = p_session_id
      and o.line_user_id = p_line_user_id
      and o.status != 'cancelled';

    select coalesce(sum((item->>'quantity')::int), 0) into v_new_qty
    from jsonb_array_elements(p_items) as item;

    if (v_quota_used + v_new_qty) > v_quota_limit then
      raise exception 'QUOTA_EXCEEDED';
    end if;
  end if;

  -- 3. 取得取貨方式，驗證是否開放並快照費用
  select * into v_pickup
  from pickup_options
  where id = p_pickup_option_id and is_active = true;
  if not found then
    raise exception 'PICKUP_OPTION_NOT_FOUND';
  end if;

  -- 4. 驗證付款方式是否符合取貨方式的限制
  if v_pickup.allowed_payment_methods is not null then
    if not (p_payment_method::text = any(v_pickup.allowed_payment_methods)) then
      raise exception 'PAYMENT_METHOD_NOT_ALLOWED';
    end if;
  end if;

  -- 5. 惰性套用到期的 restock（FOR UPDATE 鎖定，避免重複套用）
  for v_restock in
    select sr.id
    from session_restocks sr
    where sr.session_id = p_session_id
      and sr.is_active = true
      and sr.applied = false
      and sr.opens_at <= now()
    order by sr.opens_at
    for update of sr
  loop
    -- 將此 restock 的追加數量加回各商品庫存
    update products p
    set stock_qty = p.stock_qty + ri.quantity
    from restock_items ri
    where ri.restock_id = v_restock.id
      and ri.product_id = p.id;

    -- 標記已套用
    update session_restocks
    set applied = true
    where id = v_restock.id;
  end loop;

  -- 6. 建立訂單（含 pickup_fee 快照）
  insert into orders (
    session_id, line_user_id, line_display_name,
    payment_method, pickup_option_id, pickup_fee
  )
  values (
    p_session_id, p_line_user_id, p_display_name,
    p_payment_method, p_pickup_option_id, v_pickup.extra_fee
  )
  returning id into v_order_id;

  -- 7. 逐項處理品項：FOR UPDATE 鎖定防止 race condition
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from products
    where id = (v_item->>'product_id')::uuid
      and session_id = p_session_id
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;

    if v_product.stock_qty < (v_item->>'quantity')::int then
      raise exception 'INSUFFICIENT_STOCK:%', v_product.name;
    end if;

    -- 商品個別 quota 檢查（NULL 表示不限）
    if v_product.max_per_person is not null then
      select coalesce(sum(oi.quantity), 0) into v_product_qty_used
      from orders o
      join order_items oi on oi.order_id = o.id
      where o.session_id = p_session_id
        and o.line_user_id = p_line_user_id
        and o.status != 'cancelled'
        and oi.product_id = v_product.id;

      if (v_product_qty_used + (v_item->>'quantity')::int) > v_product.max_per_person then
        raise exception 'PRODUCT_QUOTA_EXCEEDED:%', v_product.name;
      end if;
    end if;

    update products
    set stock_qty = stock_qty - (v_item->>'quantity')::int
    where id = v_product.id;

    insert into order_items (order_id, product_id, quantity, unit_price)
    values (
      v_order_id,
      v_product.id,
      (v_item->>'quantity')::int,
      v_product.price
    );

    v_total := v_total + v_product.price * (v_item->>'quantity')::int;
  end loop;

  -- 8. 更新總金額（商品小計 + 取貨費用）
  update orders
  set total_amount = v_total + v_pickup.extra_fee
  where id = v_order_id;

  return v_order_id;
end;
$$;

-- (B) 主動套用到期 restock（FOR UPDATE 防止並發重複套用）
-- 由 GET /api/sessions/active 在回傳前呼叫，確保客戶進入頁面即看到最新庫存
-- 回傳此 session 下一波尚未套用的 restock 開放時間（供前端倒數計時器使用）
create or replace function apply_pending_restocks(
  p_session_id uuid
) returns timestamptz language plpgsql as $$
declare
  v_restock record;
  v_next_at timestamptz;
begin
  -- 1. 套用所有時間已到且未套用的 restock（FOR UPDATE 防止並發重複套用）
  for v_restock in
    select sr.id
    from session_restocks sr
    where sr.session_id = p_session_id
      and sr.is_active = true
      and sr.applied = false
      and sr.opens_at <= now()
    order by sr.opens_at
    for update of sr
  loop
    update products p
    set stock_qty = p.stock_qty + ri.quantity
    from restock_items ri
    where ri.restock_id = v_restock.id
      and ri.product_id = p.id;

    update session_restocks
    set applied = true
    where id = v_restock.id;
  end loop;

  -- 2. 取得下一波尚未套用的 restock 時間（供前端倒數計時器）
  select min(opens_at) into v_next_at
  from session_restocks
  where session_id = p_session_id
    and is_active = true
    and applied = false
    and opens_at > now();

  return v_next_at;  -- NULL 表示沒有待套用的排程
end;
$$;

-- (C) 後台取消訂單（連鎖釋放庫存 + quota）
-- 需要 DB Function：庫存釋放 + 狀態更新必須原子完成，避免庫存不一致
create or replace function admin_cancel_order(
  p_order_id uuid,
  p_reason   text
) returns void language plpgsql as $$
declare
  v_order record;
  v_item  record;
begin
  select * into v_order from orders where id = p_order_id for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  -- 狀態守門：payment_submitted 後不可取消
  if v_order.status = 'payment_submitted' then
    raise exception 'CANNOT_CANCEL_PAYMENT_SUBMITTED';
  end if;

  if v_order.status in ('completed', 'cancelled') then
    raise exception 'ORDER_ALREADY_FINALIZED';
  end if;

  -- 釋放庫存
  for v_item in
    select product_id, quantity from order_items where order_id = p_order_id
  loop
    update products
    set stock_qty = stock_qty + v_item.quantity
    where id = v_item.product_id;
  end loop;

  -- 更新狀態（quota 自動隨 status != 'cancelled' 條件釋放）
  update orders
  set status = 'cancelled',
      cancelled_by = 'admin',
      cancel_reason = p_reason
  where id = p_order_id;
end;
$$;
```

---

## 4. 後端 API 實作細節

### 4.1 LINE ID 驗證 Middleware

```typescript
// lib/auth/verifyLiff.ts
import { NextRequest } from 'next/server'
import { getLiffProfile } from '@/lib/liff'

export async function verifyLiffToken(req: NextRequest) {
  const token = req.headers.get('x-liff-token')
  if (!token) throw new Error('UNAUTHORIZED')

  const profile = await getLiffProfile(token)
  return profile // { userId, displayName }
}
```

### 4.2 後台驗證 Middleware（RBAC）

改用 Supabase Auth JWT 驗證，並查詢 `user_roles` + `role_permissions` 確認權限，取代原本的 shared secret。

```typescript
// lib/auth/permissions.ts
export type Permission =
  | 'sessions:create'
  | 'sessions:edit'
  | 'orders:accept'
  | 'orders:reject'
  | 'orders:mark_ready'
  | 'orders:cancel'
  | 'orders:confirm_payment'
  | 'stats:view'
  | 'staff:manage'
  | 'roles:manage'
  | 'pickup_options:manage'
  | 'restocks:manage'
```

```typescript
// lib/auth/verifyAdmin.ts
import { createClient } from '@supabase/supabase-js'
import { Permission } from './permissions'

export type AdminContext = {
  userId: string
  displayName: string
  roleId: string
  roleName: string
  permissions: Permission[]
}

export async function verifyAdmin(req: NextRequest): Promise<AdminContext> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new Error('UNAUTHORIZED')

  // 1. 驗證 JWT，取得 user
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new Error('UNAUTHORIZED')

  // 2. 查詢 user_roles + role + permissions（一次 join 完成）
  const { data, error: roleError } = await supabaseAdmin
    .from('user_roles')
    .select(`
      display_name,
      is_active,
      roles (
        id,
        name,
        role_permissions (
          permissions ( key )
        )
      )
    `)
    .eq('user_id', user.id)
    .single()

  if (roleError || !data) throw new Error('UNAUTHORIZED')
  if (!data.is_active) throw new Error('ACCOUNT_DISABLED')

  const permissions = data.roles.role_permissions
    .map((rp: any) => rp.permissions.key as Permission)

  return {
    userId:      user.id,
    displayName: data.display_name,
    roleId:      data.roles.id,
    roleName:    data.roles.name,
    permissions,
  }
}

// 權限驗證 helper
export function assertPermission(ctx: AdminContext, permission: Permission): void {
  if (!ctx.permissions.includes(permission)) {
    throw new Error('FORBIDDEN')
  }
}
```

每支後台 API 使用方式：

```typescript
// 範例：取消訂單（需要 orders:cancel 權限）
export async function PATCH(req: NextRequest, { params }) {
  try {
    const ctx = await verifyAdmin(req)
    assertPermission(ctx, 'orders:cancel')
    // 執行取消邏輯...
  } catch (e: any) {
    return errorResponse(e.message)
  }
}
```

### 4.3 訂單狀態機（Backend 純邏輯）

狀態轉移驗證放在 Backend，與資料庫完全解耦，可純 unit test。

```typescript
// lib/orderStatus.ts
import { OrderStatus } from '@/types'

// 定義允許的狀態轉移表
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:           ['in_production', 'cancelled'],
  in_production:     ['pending_payment', 'cancelled'],
  pending_payment:   ['payment_submitted', 'completed', 'cancelled'], // cash 可直接 → completed
  payment_submitted: ['completed'],
  completed:         [],
  cancelled:         [],
}

export function assertTransition(
  current: OrderStatus,
  next: OrderStatus
): void {
  const allowed = ALLOWED_TRANSITIONS[current]
  if (!allowed.includes(next)) {
    throw new Error(`INVALID_TRANSITION:${current}->${next}`)
  }
}

// 現金付款直接 completed，不需經過 payment_submitted
// 匯款付款必須先進入 payment_submitted
export function assertPaymentTransition(
  current: OrderStatus,
  next: OrderStatus,
  paymentMethod: 'bank_transfer' | 'cash'
): void {
  assertTransition(current, next)
  if (
    paymentMethod === 'bank_transfer' &&
    current === 'pending_payment' &&
    next === 'completed'
  ) {
    throw new Error('INVALID_TRANSITION:bank_transfer_must_submit_remit_first')
  }
}

// 取消限制：payment_submitted 後不可取消
export function assertCancellable(status: OrderStatus): void {
  if (status === 'payment_submitted') {
    throw new Error('CANNOT_CANCEL_PAYMENT_SUBMITTED')
  }
  if (status === 'completed' || status === 'cancelled') {
    throw new Error('ORDER_ALREADY_FINALIZED')
  }
}
```

### 4.4 Quota 預檢（Backend 純邏輯）

前端送出前呼叫預檢 API，提早給使用者回饋。DB Function 內部仍做最終驗證（double-check），防止 race condition。

```typescript
// lib/quota.ts

type OrderSnapshot = { status: string; quantity: number }

// 計算已使用的 quota（cancelled 不計，completed 計入）
export function calcQuotaUsed(orders: OrderSnapshot[]): number {
  return orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.quantity, 0)
}

// limit 為 null 表示無上限，直接通過
export function assertQuota(
  used: number,
  incoming: number,
  limit: number | null
): void {
  if (limit === null) return  // 無上限，直接放行
  if (used + incoming > limit) {
    throw new Error('QUOTA_EXCEEDED')
  }
}
```

### 4.5 admin_accept_order（Backend 實作）

邏輯單純（狀態更新 + 排單號計算），不需原子性，放 Backend 提升可讀性與可測試性。

```typescript
// app/api/admin/orders/[id]/accept/route.ts
import { verifyAdmin } from '@/lib/auth/verifyAdmin'
import { assertTransition } from '@/lib/orderStatus'
import { errorResponse } from '@/lib/api/response'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    verifyAdmin(req)

    // 1. 取得訂單現狀
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('status, session_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !order) return errorResponse('ORDER_NOT_FOUND', 404)

    // 2. 狀態機驗證（Backend 純邏輯）
    assertTransition(order.status, 'in_production')

    // 3. 計算排單號：此 session 目前最大值 + 1
    const { data: maxRow } = await supabaseAdmin
      .from('orders')
      .select('queue_number')
      .eq('session_id', order.session_id)
      .not('queue_number', 'is', null)
      .order('queue_number', { ascending: false })
      .limit(1)
      .single()

    const queueNumber = (maxRow?.queue_number ?? 0) + 1

    // 4. 更新狀態
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'in_production', queue_number: queueNumber })
      .eq('id', params.id)

    if (updateError) throw updateError

    return Response.json({ queueNumber }, { status: 200 })

  } catch (e: any) {
    return errorResponse(e.message)
  }
}
```

其他後台狀態操作（`reject`、`ready`、`confirm-payment`）依相同模式實作：取得訂單 → `assertTransition()` 驗證 → `supabaseAdmin.update()`。

### 4.6 統一錯誤處理

```typescript
// lib/api/response.ts
export function errorResponse(code: string, status = 400) {
  const messages: Record<string, string> = {
    UNAUTHORIZED:                      '請透過 LINE 開啟此頁面',
    FORBIDDEN:                         '無操作權限',
    ACCOUNT_DISABLED:                  '此帳號已停用，請聯絡管理員',
    QUOTA_EXCEEDED:                    '已超過本次開單每人購買上限',
    PRODUCT_QUOTA_EXCEEDED:            '已超過此商品每人購買上限',
    INSUFFICIENT_STOCK:                '商品庫存不足',
    SESSION_NOT_ACTIVE:                '目前沒有開放中的開單',
    ORDER_NOT_FOUND:                   '找不到此訂單',
    CANNOT_CANCEL_PAYMENT_SUBMITTED:   '付款確認中的訂單無法取消',
    ORDER_ALREADY_FINALIZED:           '此訂單已結束',
    INVALID_TRANSITION:                '此訂單狀態不允許此操作',
    CANNOT_DEACTIVATE_SELF:            '無法停用自己的帳號',
    CREATE_USER_FAILED:                '建立帳號失敗，請確認 Email 是否已被使用',
    ROLE_NOT_FOUND:                    '找不到此角色',
    CANNOT_DELETE_OWNER_ROLE:          '無法刪除 owner 角色',
    PICKUP_OPTION_NOT_FOUND:           '取貨方式不存在或已下架',
    PAYMENT_METHOD_NOT_ALLOWED:        '此取貨方式不支援所選付款方式',
    RESTOCK_NOT_FOUND:                 '找不到此追加庫存排程',
    RESTOCK_ALREADY_APPLIED:           '此追加庫存已套用，無法取消',
  }
  return Response.json(
    { error: code, message: messages[code] ?? '系統錯誤，請稍後再試' },
    { status }
  )
}
```

---

## 5. 前端實作細節

### 5.1 LIFF 初始化

```typescript
// lib/liff.ts
import liff from '@line/liff'

export async function initLiff() {
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
  if (!liff.isLoggedIn()) {
    liff.login()
    return null
  }
  const profile = await liff.getProfile()
  const token   = liff.getAccessToken()
  return { profile, token }
}
```

### 5.2 頁面結構

| 路由 | 說明 |
|------|------|
| `/liff/order` | LIFF 訂購頁（商品選擇 → 取貨方式 → 付款方式 → 確認 → 送出） |
| `/liff/status` | LIFF 訂單狀態查詢頁 |
| `/admin/login` | 後台登入頁（Email + 密碼） |
| `/admin` | 後台首頁（進行中訂單 Dashboard） |
| `/admin/orders` | 歷史訂單查詢 |
| `/admin/sessions/new` | 新增開單 |
| `/admin/sessions/[id]/stats` | 開單統計 |
| `/admin/staff` | 人員管理（列表、新增、停用） |
| `/admin/roles` | 角色管理（列表、新增角色、勾選權限） |
| `/admin/sessions/[id]` | 開單詳情（含商品列表、追加庫存排程區塊） |
| `/admin/pickup-options` | 取貨方式管理（列表、新增、編輯、上下架、排序） |

### 5.3 狀態管理

使用 **SWR** 做資料拉取與快取，不引入 Redux 等複雜狀態管理工具：

```typescript
// hooks/useOrderStatus.ts
import useSWR from 'swr'

export function useOrderStatus(lineUserId: string) {
  return useSWR(
    lineUserId ? `/api/orders?line_user_id=${lineUserId}` : null,
    fetcher,
    { refreshInterval: 10000 } // 每 10 秒自動重新拉取
  )
}
```

### 5.4 防黃牛提示 UX

前端在送出前先呼叫 quota 檢查 API，讓客戶在送出前就看到提示，而非等到後端拒絕：

```
選購頁底部顯示：
「本次開單每人限購 2 件，你已選 2 件（上限）」
```

---

## 6. 測試策略

採三層測試金字塔，單人開發以「高信心、低維護成本」為原則。業務邏輯移至 Backend 後，Unit Test 覆蓋範圍大幅提升，減少對真實 DB 的依賴。

```
        E2E Tests（少量，保護關鍵路徑）
       ────────────────────────────────
      Integration Tests（API + DB Function）
     ────────────────────────────────────────
    Unit Tests（純邏輯：狀態機、quota、工具函式）  ← 覆蓋範圍擴大
```

### 6.1 Unit Tests

**範圍：** 不涉及 I/O 的純函式（`orderStatus.ts`、`quota.ts`、`response.ts`）

**工具：** Vitest

**優點：** 不需啟動 DB，執行速度快，CI 不需額外 setup

**測試項目：**

```
lib/orderStatus.ts
  ✓ pending → in_production：允許
  ✓ pending → cancelled：允許
  ✓ in_production → pending_payment：允許
  ✓ in_production → cancelled：允許
  ✓ pending_payment → payment_submitted：允許
  ✓ pending_payment → cancelled：允許
  ✓ pending_payment → completed（cash）：允許
  ✓ pending_payment → completed（bank_transfer）：丟出 INVALID_TRANSITION（須先填後五碼）
  ✓ payment_submitted → completed：允許
  ✓ payment_submitted → cancelled：丟出 CANNOT_CANCEL_PAYMENT_SUBMITTED
  ✓ completed → 任何狀態：丟出 ORDER_ALREADY_FINALIZED
  ✓ cancelled → 任何狀態：丟出 ORDER_ALREADY_FINALIZED
  ✓ 跳躍轉移（pending → completed）：丟出 INVALID_TRANSITION

lib/quota.ts
  ✓ calcQuotaUsed：排除 cancelled 訂單
  ✓ calcQuotaUsed：completed 訂單計入
  ✓ calcQuotaUsed：in_production / pending 皆計入
  ✓ calcQuotaUsed：空陣列回傳 0
  ✓ assertQuota：used + incoming <= limit 通過
  ✓ assertQuota：used + incoming > limit 丟出 QUOTA_EXCEEDED
  ✓ assertQuota：剛好等於 limit 通過（邊界值）

lib/api/response.ts
  ✓ 已知錯誤碼回傳正確中文訊息與 HTTP status
  ✓ 未知錯誤碼回傳預設訊息
```

範例：

```typescript
// __tests__/unit/orderStatus.test.ts
import { describe, it, expect } from 'vitest'
import { assertTransition, assertCancellable } from '@/lib/orderStatus'

describe('assertTransition', () => {
  it('allows valid transitions', () => {
    expect(() => assertTransition('pending', 'in_production')).not.toThrow()
    expect(() => assertTransition('in_production', 'cancelled')).not.toThrow()
  })

  it('rejects payment_submitted → cancelled', () => {
    expect(() => assertTransition('payment_submitted', 'cancelled'))
      .toThrow('CANNOT_CANCEL_PAYMENT_SUBMITTED')
  })

  it('rejects skip transitions', () => {
    expect(() => assertTransition('pending', 'completed'))
      .toThrow('INVALID_TRANSITION')
  })
})

// __tests__/unit/quota.test.ts
import { describe, it, expect } from 'vitest'
import { calcQuotaUsed, assertQuota } from '@/lib/quota'

describe('calcQuotaUsed', () => {
  it('excludes cancelled, includes completed', () => {
    const orders = [
      { status: 'completed',     quantity: 1 },
      { status: 'cancelled',     quantity: 2 },
      { status: 'in_production', quantity: 1 },
    ]
    expect(calcQuotaUsed(orders)).toBe(2)
  })

  it('returns 0 for empty array', () => {
    expect(calcQuotaUsed([])).toBe(0)
  })
})

describe('assertQuota', () => {
  it('passes when exactly at limit', () => {
    expect(() => assertQuota(1, 1, 2)).not.toThrow()
  })

  it('throws when over limit', () => {
    expect(() => assertQuota(1, 2, 2)).toThrow('QUOTA_EXCEEDED')
  })

  it('always passes when limit is null (unlimited)', () => {
    expect(() => assertQuota(999, 999, null)).not.toThrow()
  })
})
```

### 6.2 Integration Tests

**範圍：** API Route Handlers + Supabase DB Functions

**工具：** Vitest + Supabase 本地實例（`supabase start`）

**策略：** 每個測試案例前重置資料庫至 seed 狀態，確保隔離

**注意：** 狀態轉移的「拒絕」案例（如 payment_submitted 取消）已由 Unit Test 覆蓋，Integration Test 聚焦於「DB 副作用是否正確」（庫存數字、quota 計算）。

**測試項目：**

```
POST /api/orders（建立訂單）
  ✓ 正常下單（匯款 + 免費自取）：庫存正確扣除，total_amount = 商品小計
  ✓ 正常下單（匯款 + 宅配費 100）：total_amount = 商品小計 + 100，pickup_fee 快照正確
  ✓ 正常下單（現金 + 自取）：payment_method = cash，狀態機允許直接 pending_payment → completed
  ✓ 無效 LIFF token：回傳 401
  ✓ session 未開放（is_active = false）：回傳 SESSION_NOT_ACTIVE
  ✓ session opens_at 尚未到：回傳 SESSION_NOT_ACTIVE
  ✓ session closes_at 已過：回傳 SESSION_NOT_ACTIVE
  ✓ 超過 quota：回傳 QUOTA_EXCEEDED
  ✓ per_person_limit 為 null：不受 quota 限制
  ✓ 庫存不足，但有到期 restock：create_order 內惰性套用後庫存補充，下單成功（備援路徑）
  ✓ 庫存不足，restock 尚未到期：回傳 INSUFFICIENT_STOCK
  ✓ 商品設有 max_per_person，購買數量未超過：下單成功
  ✓ 商品設有 max_per_person，本次購買超過上限：回傳 PRODUCT_QUOTA_EXCEEDED
  ✓ 商品設有 max_per_person，累計歷史訂單後超過上限：回傳 PRODUCT_QUOTA_EXCEEDED
  ✓ 商品 max_per_person 為 null：不受單品限制（搭配 session per_person_limit 正常運作）
  ✓ pickup_option 已下架：回傳 PICKUP_OPTION_NOT_FOUND
  ✓ 選擇現金但取貨方式只允許匯款：回傳 PAYMENT_METHOD_NOT_ALLOWED
  ✓ 同時兩筆訂單搶最後一個庫存：只有一筆成功（race condition）
  ✓ 同時兩筆訂單觸發同一 restock：restock 只套用一次（FOR UPDATE 保護）
  ✓ 修改取貨費用後，舊訂單的 pickup_fee 快照不受影響

PUT /api/orders/:id（修改訂單）
  ✓ pending 狀態可修改，庫存正確更新（舊庫存釋放、新庫存扣除）
  ✓ 修改後 total_amount 正確重新計算
  ✓ 非 pending 狀態修改：回傳 INVALID_TRANSITION（由 assertTransition 攔截）

DELETE /api/orders/:id（客戶取消）
  ✓ pending 狀態可取消，庫存正確釋放
  ✓ 取消後 quota 釋放，同一 LINE ID 可重新下單
  ✓ 非 pending 狀態取消：回傳 INVALID_TRANSITION

PATCH /api/admin/orders/:id/accept
  ✓ pending → in_production，排單號正確遞增（多筆訂單驗證序號不重複）
  ✓ 排單號從 1 開始，同一 session 第二筆為 2

PATCH /api/admin/orders/:id/cancel
  ✓ in_production 可取消，庫存正確釋放
  ✓ pending_payment 可取消，庫存正確釋放
  ✓ 取消後同一 LINE ID 可重新下單（quota 已釋放）
  ✓ payment_submitted 取消：回傳 CANNOT_CANCEL_PAYMENT_SUBMITTED
  ✓ completed 取消：回傳 ORDER_ALREADY_FINALIZED

PATCH /api/admin/orders/:id/confirm-payment
  ✓ payment_submitted → completed
  ✓ completed 後 quota 不釋放（同一 LINE ID 無法在此 session 再次下單至上限外）

GET /admin/sessions/:id/stats
  ✓ 回傳正確訂單數、各品項數量、總金額
  ✓ cancelled 訂單不計入銷售金額
  ✓ 回購客戶數正確（跨 session 同一 LINE ID）

POST /admin/staff（新增人員）
  ✓ owner 可新增人員，Supabase Auth 建立帳號並寄出邀請信
  ✓ assistant 新增人員：回傳 FORBIDDEN
  ✓ Email 已存在：回傳 CREATE_USER_FAILED
  ✓ 新增後 user_roles 正確建立

PATCH /admin/staff/:id/deactivate（停用帳號）
  ✓ owner 可停用其他人員
  ✓ 停用自己：回傳 CANNOT_DEACTIVATE_SELF
  ✓ 停用後該帳號呼叫任意後台 API：回傳 ACCOUNT_DISABLED

POST /admin/roles（新增角色）
  ✓ owner 可新增角色
  ✓ 新增後 role_permissions 可正確設定

PATCH /admin/roles/:id/permissions（更新角色權限）
  ✓ 更新後該角色人員的 assertPermission 結果即時反映
  ✓ 嘗試移除 owner 的 roles:manage 權限：回傳 CANNOT_DELETE_OWNER_ROLE
```

### 6.3 E2E Tests

**範圍：** 最關鍵的兩條使用者路徑

**工具：** Playwright

**測試路徑 1：完整訂購流程（Happy Path）**

```
1. 開啟 LIFF 訂購頁（mock LINE ID）
2. 選擇商品，點擊送出
3. 確認訂單建立，顯示訂單編號
4. 後台接單 → 確認狀態變為 in_production
5. 後台標記完成 → 確認狀態變為 pending_payment
6. 客戶填入匯款後五碼送出
7. 後台確認付款 → 確認狀態變為 completed
```

**測試路徑 2：防黃牛阻擋**

```
1. LINE ID A 下單至上限
2. 同一 LINE ID A 再次嘗試下單 → 確認被阻擋
3. 後台取消 LINE ID A 的訂單
4. 同一 LINE ID A 再次下單 → 確認可成功
```

### 6.4 測試指令

```bash
# Unit + Integration
npm run test

# 僅 Unit
npm run test:unit

# 僅 Integration（需先 supabase start）
npm run test:integration

# E2E（需先啟動 dev server）
npm run test:e2e

# Coverage 報告
npm run test:coverage
```

### 6.5 Coverage 目標

| 層級 | 目標覆蓋率 | 說明 |
|------|-----------|------|
| Unit | ≥ 90% | 純邏輯必須完整覆蓋 |
| Integration | 關鍵路徑全覆蓋 | 依上方清單逐一實作 |
| E2E | 2 條主路徑 | Happy path + 防黃牛 |

---

## 7. CI/CD 流程

### 7.1 CI（Pull Request 觸發）

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install deps
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Start Supabase
        uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase start

      - name: Run tests
        run: npm run test
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_ANON_KEY: ${{ env.SUPABASE_LOCAL_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ env.SUPABASE_LOCAL_SERVICE_KEY }}

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

### 7.2 CD（合併至 main 觸發）

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

      - name: Apply Supabase migrations
        run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

---

## 8. GitHub Project 規劃

### 8.1 Labels

| Label | 顏色 | 用途 |
|-------|------|------|
| `type: feature` | 藍 | 新功能 |
| `type: bug` | 紅 | 錯誤修正 |
| `type: chore` | 灰 | 設定、文件、重構 |
| `type: test` | 黃 | 測試相關 |
| `layer: db` | 深紫 | Supabase Schema / RLS / Function |
| `layer: api` | 紫 | API Route Handler |
| `layer: frontend` | 綠 | 前端頁面與元件 |
| `layer: infra` | 橘 | CI/CD、部署設定 |
| `priority: high` | 深紅 | 阻塞其他工作 |
| `priority: low` | 淺灰 | 有空再做 |

### 8.2 Milestones

| Milestone | 目標 | 預計完成 |
|-----------|------|---------|
| M1 — 地基 | Supabase Schema + RLS + DB Functions + RBAC seed + 測試框架 | 第 1 週 |
| M2 — 客戶下單 | LIFF 訂購頁、建立訂單 API、防黃牛 | 第 2 週 |
| M3 — 客戶查詢 | LIFF 狀態查詢頁、修改 / 取消訂單 | 第 3 週 |
| M4 — 後台操作 | 後台進行中訂單管理（接單、取消、完成）+ 登入頁 | 第 4 週 |
| M5 — 後台報表 | 歷史訂單查詢、CSV 匯出、開單統計 | 第 5 週 |
| M6 — 人員與角色管理 | 人員帳號管理、角色新增、權限勾選 | 第 6 週 |
| M7 — 取貨與付款方式 | pickup_options 管理、現金付款流程、LIFF 選購步驟 | 第 7 週 |
| M8 — 開搶時間與追加庫存 | Session 時間條件開放、restock 排程、倒數 UI、追加庫存預告 | 第 8 週 |
| M9 — 商品個別購買上限 | products.max_per_person、create_order 商品 quota 檢查、後台欄位、LIFF 選購限制 | 第 9 週 |
| M10 — UI 美化 | 色彩系統、載入動畫、LIFF 手機優先、後台響應式、數字固定寬度 | 第 10 週 |

### 8.3 Issues 清單

#### M1 — 地基

```
[chore][layer: infra]  #001 初始化 Monorepo 結構與環境設定
[chore][layer: infra]  #002 設定 Supabase 本地開發環境
[chore][layer: db]     #003 Migration 001：初始 Schema（含 RBAC 四張表）
[chore][layer: db]     #004 Migration 002：RLS Policies（含 RBAC 表）
[chore][layer: db]     #005 Migration 003：DB Functions（create_order、admin_cancel_order）
[chore][layer: db]     #006 Migration 004：RBAC 初始角色與權限 seed
[chore][layer: db]     #007 建立 seed.sql 開發用測試資料
[chore][layer: api]    #008 實作 lib/auth/permissions.ts（Permission 型別定義）
[chore][layer: api]    #009 實作 lib/auth/verifyAdmin.ts（JWT + RBAC 查詢）
[chore][layer: api]    #010 實作 lib/orderStatus.ts（狀態機純邏輯）
[chore][layer: api]    #011 實作 lib/quota.ts（quota 計算純邏輯）
[type: test]           #012 建立 Vitest 測試框架與設定
[type: test]           #013 Unit Test：lib/orderStatus.ts 全案例
[type: test]           #014 Unit Test：lib/quota.ts 全案例
[type: test]           #015 Integration Test：create_order DB Function
[type: test]           #016 Integration Test：admin_cancel_order DB Function
[chore][layer: infra]  #017 設定 GitHub Actions CI workflow
```

#### M2 — 客戶下單

```
[type: feature][layer: api]      #018 API：GET /api/sessions/active
[type: feature][layer: api]      #019 API：POST /api/orders（含 LIFF token 驗證，呼叫 create_order DB Function）
[type: feature][layer: api]      #020 LIFF token 驗證 middleware
[type: test]                     #021 Integration Test：POST /api/orders 全案例
[type: feature][layer: frontend] #022 LIFF 訂購頁：商品列表與數量選擇
[type: feature][layer: frontend] #023 LIFF 訂購頁：Quota 即時顯示
[type: feature][layer: frontend] #024 LIFF 訂購頁：送出訂單與成功畫面
[type: test]                     #025 E2E Test：完整訂購流程 Happy Path
```

#### M3 — 客戶查詢

```
[type: feature][layer: api]      #026 API：GET /api/orders（依 LINE ID 查詢）
[type: feature][layer: api]      #027 API：PATCH /api/orders/:id/remit（填入匯款後五碼）
[type: feature][layer: api]      #028 API：PUT /api/orders/:id（修改訂單，含 assertTransition 驗證）
[type: feature][layer: api]      #029 API：DELETE /api/orders/:id（客戶取消，含 assertTransition 驗證）
[type: test]                     #030 Integration Test：修改 / 取消訂單全案例
[type: feature][layer: frontend] #031 LIFF 訂單查詢頁：狀態顯示與各狀態對應 UI
[type: feature][layer: frontend] #032 LIFF 訂單查詢頁：修改訂單流程
[type: feature][layer: frontend] #033 LIFF 訂單查詢頁：取消訂單確認
[type: feature][layer: frontend] #034 LIFF 訂單查詢頁：待付款 — 顯示匯款資訊與填入後五碼
[type: test]                     #035 E2E Test：防黃牛阻擋與取消後重新下單
```

#### M4 — 後台操作

```
[type: feature][layer: frontend] #036 後台登入頁（Email + 密碼，Supabase Auth）
[type: feature][layer: api]      #037 API：PATCH /admin/orders/:id/accept（含排單號計算，assertPermission orders:accept）
[type: feature][layer: api]      #038 API：PATCH /admin/orders/:id/reject（assertPermission orders:reject）
[type: feature][layer: api]      #039 API：PATCH /admin/orders/:id/ready（assertPermission orders:mark_ready）
[type: feature][layer: api]      #040 API：PATCH /admin/orders/:id/cancel（assertPermission orders:cancel）
[type: feature][layer: api]      #041 API：PATCH /admin/orders/:id/confirm-payment（assertPermission orders:confirm_payment）
[type: feature][layer: api]      #042 API：POST /admin/sessions（assertPermission sessions:create）
[type: feature][layer: api]      #043 API：POST /admin/products（assertPermission sessions:edit）
[type: test]                     #044 Integration Test：後台操作全案例（含 RBAC 權限驗證）
[type: feature][layer: frontend] #045 後台：進行中訂單 Dashboard（待確認 / 製作中 / 待付款 / 確認付款中）
[type: feature][layer: frontend] #046 後台：接單 / 拒絕 / 取消操作（含取消原因輸入）
[type: feature][layer: frontend] #047 後台：新增開單表單
[chore][layer: infra]            #048 設定 GitHub Actions CD workflow（Vercel 部署）
[chore][layer: infra]            #049 設定 Supabase migration 自動套用
```

#### M5 — 後台報表

```
[type: feature][layer: api]      #050 API：GET /admin/orders（歷史查詢，支援篩選，assertPermission stats:view）
[type: feature][layer: api]      #051 API：GET /admin/orders/export（CSV 匯出）
[type: feature][layer: api]      #052 API：GET /admin/sessions/:id/stats
[type: test]                     #053 Integration Test：歷史查詢與統計 API
[type: feature][layer: frontend] #054 後台：歷史訂單查詢頁（篩選 + 列表）
[type: feature][layer: frontend] #055 後台：CSV 匯出按鈕
[type: feature][layer: frontend] #056 後台：開單統計頁（數字摘要）
```

#### M6 — 人員與角色管理

```
[type: feature][layer: api]      #057 API：GET /admin/staff（assertPermission staff:manage）
[type: feature][layer: api]      #058 API：POST /admin/staff（inviteUserByEmail + 寫入 user_roles）
[type: feature][layer: api]      #059 API：PATCH /admin/staff/:id（修改姓名 / 角色）
[type: feature][layer: api]      #060 API：PATCH /admin/staff/:id/deactivate（含自我停用保護）
[type: feature][layer: api]      #061 API：PATCH /admin/staff/:id/activate
[type: feature][layer: api]      #062 API：POST /admin/staff/:id/resend-invite
[type: feature][layer: api]      #063 API：GET /admin/roles（assertPermission roles:manage）
[type: feature][layer: api]      #064 API：POST /admin/roles（新增角色）
[type: feature][layer: api]      #065 API：PATCH /admin/roles/:id/permissions（更新角色權限，保護 owner 不可移除 roles:manage）
[type: test]                     #066 Integration Test：人員管理 API 全案例
[type: test]                     #067 Integration Test：角色權限管理 API 全案例
[type: feature][layer: frontend] #068 後台：人員管理列表頁（顯示姓名、Email、角色、狀態）
[type: feature][layer: frontend] #069 後台：新增人員表單（填姓名、Email、角色，送出寄邀請信）
[type: feature][layer: frontend] #070 後台：角色管理頁（角色列表 + 權限勾選）
[type: feature][layer: frontend] #071 後台：新增角色表單
```

#### M7 — 取貨方式管理

```
[chore][layer: db]       #072 Migration 001 更新：pickup_options 表 + orders 新欄位
[chore][layer: db]       #073 Migration 003 更新：create_order function 支援 pickup_option_id 與 payment_method
[chore][layer: db]       #074 Migration 004 更新：RBAC seed 新增 pickup_options:manage 權限
[chore][layer: api]      #075 更新 lib/orderStatus.ts：現金付款路徑（pending_payment → completed）與 assertPaymentTransition
[type: test]             #076 Unit Test：lib/orderStatus.ts 補充現金付款轉移案例
[type: feature][layer: api] #077 API：GET /api/pickup-options（客戶選購頁取得 active 選項）
[type: feature][layer: api] #078 更新 API：POST /api/orders 加入 pickup_option_id + payment_method 參數
[type: test]             #079 Integration Test：create_order 含取貨費用快照與付款方式驗證全案例
[type: feature][layer: api] #080 API：GET /admin/pickup-options（assertPermission pickup_options:manage）
[type: feature][layer: api] #081 API：POST /admin/pickup-options
[type: feature][layer: api] #082 API：PATCH /admin/pickup-options/:id
[type: feature][layer: api] #083 API：PATCH /admin/pickup-options/:id/toggle（上下架）
[type: feature][layer: api] #084 API：PATCH /admin/pickup-options/reorder
[type: test]             #085 Integration Test：取貨方式管理 API 全案例
[type: feature][layer: frontend] #086 LIFF 訂購頁：取貨方式選擇步驟（顯示名稱、說明、費用）
[type: feature][layer: frontend] #087 LIFF 訂購頁：付款方式選擇步驟（依取貨方式過濾可選項）
[type: feature][layer: frontend] #088 LIFF 訂購頁：確認頁顯示商品小計 + 取貨費用 + 總金額
[type: feature][layer: frontend] #089 LIFF 訂單查詢頁：依 payment_method 顯示不同付款說明
[type: feature][layer: frontend] #090 後台：取貨方式管理頁（列表、新增、編輯、上下架、排序）
```

#### M8 — 開搶時間與追加庫存排程

restock 套用採**主動觸發 + 惰性備援**雙層架構：
- **主動觸發**：客戶進入 session 頁面時，`GET /api/sessions/active` 呼叫 `apply_pending_restocks()`，套用到期 restock 並回傳 `next_restock_at`。
- **惰性備援**：`create_order` 內保留原有的惰性套用邏輯，處理極端情況（API 呼叫失敗或直接呼叫下單 API 時）。

```
[chore][layer: db]       #091 Migration 001 更新：session_restocks 與 restock_items 表
[chore][layer: db]       #092 Migration 003 更新：create_order function 加入時間條件驗證與 restock 惰性套用（保留作為雙重保護）
[chore][layer: db]       #093 Migration 003 新增：apply_pending_restocks(session_id) DB Function（FOR UPDATE 鎖定，回傳 next_restock_at）
[chore][layer: db]       #094 Migration 004 更新：RBAC seed 新增 restocks:manage 權限
[type: feature][layer: api] #095 更新 API：GET /api/sessions/active — 呼叫 apply_pending_restocks() 後回傳，response 新增 next_restock_at 欄位
[type: feature][layer: api] #096 API：GET /admin/sessions/:id/restocks（assertPermission restocks:manage）
[type: feature][layer: api] #097 API：POST /admin/sessions/:id/restocks（新增追加庫存排程）
[type: feature][layer: api] #098 API：DELETE /admin/restocks/:id（取消待套用排程，applied = false 才允許）
[type: test]             #099 Integration Test：create_order 時間條件驗證全案例（opens_at 未到 / 已過 closes_at）
[type: test]             #100 Integration Test：apply_pending_restocks 全案例（正常套用 / 並發不重複套用 / next_restock_at 回傳正確 / applied 後無法取消）
[type: feature][layer: frontend] #101 後台：新增開單表單加入開搶時間欄位
[type: feature][layer: frontend] #102 後台：開單詳情頁追加庫存排程區塊（列表、新增、取消）
[type: feature][layer: frontend] #103 LIFF 訂購頁：雙倒數 UI — opens_at 倒數解鎖下單按鈕；next_restock_at 倒數於時間到時自動重新拉取 sessions/active 刷新庫存
[type: feature][layer: frontend] #104 LIFF 訂購頁：庫存 0 時依 next_restock_at 顯示「追加庫存將於 HH:MM 開放」或「已售完」
```

#### M9 — 商品個別購買上限

每個商品可獨立設定 `max_per_person`（NULL = 不限），與 session 的 `per_person_limit` 並存互補：session limit 控制總件數，product limit 保護特定熱門商品的公平分配。

```
[chore][layer: db]          #105 Migration 001 更新：products 表新增 max_per_person int（NULL = 不限，有值需 > 0）
[chore][layer: db]          #106 Migration 003 更新：create_order function 在庫存扣除前加入 per-product quota 檢查
[chore][layer: api]         #107 更新 lib/api/response.ts：新增 PRODUCT_QUOTA_EXCEEDED 錯誤碼
[type: feature][layer: api] #108 更新 API：POST /admin/sessions/:id/products 接收 maxPerPerson 欄位
[type: feature][layer: api] #109 更新 API：PATCH /admin/sessions/:id/products/:id 接收 maxPerPerson 欄位
[type: test]                #110 Integration Test：create_order 商品個別 quota 全案例
[type: feature][layer: frontend] #111 後台：新增/編輯商品表單加入「每人限購（件）」欄位（空白 = 不限）
[type: feature][layer: frontend] #112 LIFF 訂購頁：單品數量選擇器依 max_per_person 設定上限，超過時顯示「每人限購 N 件」提示
```

#### M10 — UI 美化

LIFF 採**溫暖粉嫩系**（米白底、玫瑰粉主色），後台採 **Gmail 系**（白底、藍主色、灰 sidebar）。兩套色彩以 CSS custom properties（`@theme`）定義於 `globals.css`，所有元件 inline style 引用 token，確保日後改色只需改一處。

**設計規範：**
- **LIFF**：手機優先（`max-w-md` 置中，適配任何手機動態島尺寸）；數字元件（購買數量選擇器）使用固定寬度容器（`w-8 text-center`），不因數字位數影響版面
- **後台**：Sidebar + 主內容雙欄佈局；手機時 sidebar 收合為頂部導覽列
- **載入動畫**：LIFF 使用 GIF 動圖（`/public/loading-dog.gif`，規格：160×160px、透明背景、無限循環）；後台使用 SVG spinner（`animate-spin`）
- **最少載入時間**：`useMinLoading(1500)` hook，讓 `Promise.all([fetch, sleep(1500)])` 並行，取最慢者，避免資料瞬間回來時畫面閃爍

**實作架構：**
```
apps/web/
├── hooks/
│   └── useMinLoading.ts          ← 最少載入時間 hook
├── components/
│   ├── liff/
│   │   └── LiffLoader.tsx        ← GIF 載入元件
│   └── admin/
│       └── AdminSpinner.tsx      ← Spinner 元件
├── app/
│   ├── globals.css               ← 色彩 token（@theme）
│   └── admin/
│       └── layout.tsx            ← Gmail sidebar layout
└── public/
    └── loading-dog.gif           ← GIF 動圖（160×160px 透明背景）
```

```
[type: feature][layer: frontend] #113 globals.css：建立 LIFF 粉嫩系 + Admin Gmail 系色彩 token（CSS custom properties）
[type: feature][layer: frontend] #114 建立 hooks/useMinLoading.ts（最少 1.5 秒載入，combine(dataLoaded) 回傳 isLoading）
[type: feature][layer: frontend] #115 建立 components/liff/LiffLoader.tsx（GIF 動圖，規格：160×160px 透明 GIF，放 public/loading-dog.gif）
[type: feature][layer: frontend] #116 建立 components/admin/AdminSpinner.tsx（SVG animate-spin，支援 fullPage / inline 模式）
[type: feature][layer: frontend] #117 建立 app/admin/layout.tsx（Gmail 風格 sidebar；手機版改為頂部導覽列）
[type: feature][layer: frontend] #118 美化 LIFF /liff/order 頁面（粉嫩系配色、手機優先、數字固定寬度、LiffLoader + useMinLoading）
[type: feature][layer: frontend] #119 美化 LIFF /liff/status 頁面（粉嫩系配色、手機優先、LiffLoader + useMinLoading）
[type: feature][layer: frontend] #120 美化後台 Dashboard /admin（Gmail 配色、響應式、AdminSpinner + useMinLoading）
[type: feature][layer: frontend] #121 美化後台其他頁面（sessions、orders、staff、roles、pickup-options）
```

**Board View 欄位（Kanban）：**

```
Backlog → In Progress → In Review → Done
```

**Table View 欄位：**

| 欄位 | 型別 | 說明 |
|------|------|------|
| Title | text | Issue 標題 |
| Milestone | milestone | M1 ~ M8 |
| Layer | single select | db / api / frontend / infra |
| Priority | single select | high / normal / low |
| Status | single select | Backlog / In Progress / In Review / Done |
| Estimate | number | 預估工時（小時） |

### 8.5 PR 規範

```
格式：[type][layer] 簡短描述
範例：[feature][api] POST /api/orders 建立訂單 API

PR body 必填：
- 關聯 Issue（Closes #xxx）
- 測試覆蓋說明（新增哪些測試案例）
- 若有 DB migration，說明 migration 內容
```

---

## 附錄：工作時間估算

| Milestone | Issues 數 | 預估工時 |
|-----------|----------|---------|
| M1 — 地基 | 17 | 16 hr |
| M2 — 客戶下單 | 8 | 10 hr |
| M3 — 客戶查詢 | 10 | 12 hr |
| M4 — 後台操作 | 14 | 16 hr |
| M5 — 後台報表 | 7 | 8 hr |
| M6 — 人員與角色管理 | 15 | 14 hr |
| M7 — 取貨與付款方式 | 19 | 16 hr |
| M8 — 開搶時間與追加庫存 | 14 | 14 hr |
| M9 — 商品個別購買上限 | 8 | 6 hr |
| M10 — UI 美化 | 9 | 12 hr |
| **總計** | **121** | **~124 hr** |

單人每週投入約 10~12 小時，八週完成 MVP 是合理目標。

M8 的核心複雜度在兩個 DB Function：`apply_pending_restocks`（主動套用，回傳 `next_restock_at`）與 `create_order` 內的惰性備援（已有但需驗證雙層機制不衝突）。建議實作順序：先完成 #093（apply_pending_restocks），再更新 #095（sessions/active API），接著撰寫 #100（Integration Test），最後實作前端 #103 / #104。注意 `FOR UPDATE` 鎖定在兩個 function 內各自獨立，需驗證並發情境下 restock 只被套用一次。

---

## 9. RBAC 系統設計

### 9.1 設計概覽

採資料庫驅動的 RBAC（Role-Based Access Control），角色與權限的對應關係存於資料庫，老闆可在後台 UI 自行調整，無需 IT 介入。

```
auth.users（Supabase 管理）
    ↓ user_id
user_roles ──── role_id ────→ roles
                                ↓ role_id
                          role_permissions ──── permission_id ────→ permissions
```

### 9.2 資料關係說明

| 表格 | 說明 | 由誰維護 |
|------|------|---------|
| `auth.users` | 帳號與密碼，Supabase Auth 管理 | IT 初始設定，之後由後台 API 透過 Admin SDK 管理 |
| `user_roles` | 人員與角色的對應，含姓名與啟用狀態 | 老闆透過後台操作 |
| `roles` | 角色定義，老闆可自行新增 | 老闆透過後台操作 |
| `permissions` | 所有權限項目的固定清單 | IT 部署時建立，新功能上線才會新增 |
| `role_permissions` | 角色與權限的多對多對應，老闆可勾選 | 老闆透過後台操作 |

### 9.3 完整權限清單

| Permission Key | 顯示名稱 | 說明 |
|----------------|---------|------|
| `sessions:create` | 建立開單 | 新增開單批次與商品 |
| `sessions:edit` | 編輯開單 | 修改開單資訊與商品 |
| `orders:accept` | 接受訂單 | 將訂單從待確認移至製作中 |
| `orders:reject` | 拒絕訂單 | 拒絕待確認訂單 |
| `orders:mark_ready` | 標記製作完成 | 通知客戶付款 |
| `orders:cancel` | 取消訂單 | 取消製作中或待付款訂單 |
| `orders:confirm_payment` | 確認付款 | 確認客戶匯款完成或現金收訖 |
| `stats:view` | 查看報表 | 歷史訂單查詢與開單統計 |
| `staff:manage` | 管理人員 | 新增、編輯、停用人員帳號 |
| `roles:manage` | 管理角色權限 | 新增角色、調整角色權限 |
| `pickup_options:manage` | 管理取貨方式 | 新增、編輯、上下架取貨方式 |
| `restocks:manage` | 管理追加庫存排程 | 新增、查看、取消追加庫存排程 |

### 9.4 預設角色權限配置

| Permission | owner | assistant |
|------------|-------|-----------|
| `sessions:create` | ✅ | ❌ |
| `sessions:edit` | ✅ | ❌ |
| `orders:accept` | ✅ | ✅ |
| `orders:reject` | ✅ | ✅ |
| `orders:mark_ready` | ✅ | ✅ |
| `orders:cancel` | ✅ | ❌ |
| `orders:confirm_payment` | ✅ | ✅ |
| `stats:view` | ✅ | ✅ |
| `staff:manage` | ✅ | ❌ |
| `roles:manage` | ✅ | ❌ |
| `pickup_options:manage` | ✅ | ❌ |
| `restocks:manage` | ✅ | ❌ |

`owner` 為受保護角色，`roles:manage` 權限不可被移除，防止老闆意外把自己鎖在系統外。

### 9.5 IT 初始設定流程

部署後 IT 執行一次，之後老闆完全自主管理：

```
步驟 1：執行 Migration 004，建立預設角色與權限 seed
步驟 2：Supabase Dashboard → Authentication → Providers → Email
         關閉「Confirm email」，讓邀請信直接生效
步驟 3：Supabase Dashboard → Authentication → Users → Add user
         建立 owner 帳號（Email + 密碼）
步驟 4：SQL Editor 查出 owner 帳號的 UUID，插入 user_roles
         insert into user_roles (user_id, role_id, display_name)
         values ('owner-uuid', '00000000-0000-0000-0000-000000000001', '老闆姓名');
步驟 5：告知老闆登入網址與帳密，後續人員管理由老闆自行操作
```

### 9.6 老闆後台操作流程

**新增人員：**

```
人員管理頁 → [+ 新增人員]
  ↓
填入姓名、Email、選擇角色 → [新增並寄送邀請信]
  ↓
系統呼叫 Supabase inviteUserByEmail，寄出邀請信
新人員點信中連結 → 自行設定密碼 → 即可登入
```

**新增角色：**

```
角色管理頁 → [+ 新增角色]
  ↓
輸入角色名稱 → 勾選此角色可執行的權限 → [儲存]
  ↓
回人員管理，將對應人員的角色改為新角色
```

**調整既有角色權限：**

```
角色管理頁 → 點擊角色名稱
  ↓
權限列表顯示所有 permission，目前已勾選的打勾
  ↓
勾選 / 取消勾選 → [儲存]
  ↓
該角色所有人員的操作權限立即生效（下次 API 請求即反映）
```

### 9.7 安全邊界

| 保護規則 | 實作位置 | 說明 |
|----------|---------|------|
| owner 的 `roles:manage` 不可被移除 | API 層 | `PATCH /admin/roles/:id/permissions` 時檢查，違反回傳 `CANNOT_DELETE_OWNER_ROLE` |
| 不可停用自己 | API 層 | `PATCH /admin/staff/:id/deactivate` 比對 `currentUserId`，違反回傳 `CANNOT_DEACTIVATE_SELF` |
| 停用帳號後立即生效 | `verifyAdmin` middleware | 每次 API 請求都查詢 `is_active`，停用後下次請求即被擋 |
| `permissions` 表不開放後台修改 | API 設計 | 不提供新增 / 刪除 permission 的 API，只有 IT 透過 migration 才能異動 |
| `roles:manage` 操作只有 owner 預設擁有 | Migration 004 seed | assistant 預設不具備此權限，新角色預設也不勾選 |