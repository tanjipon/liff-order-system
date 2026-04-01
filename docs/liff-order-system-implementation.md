# 甜點工作室訂購系統｜實作細節與 GitHub Project 規劃

**版本：** v1.0  
**依據：** dessert-shop-spec.md v1.0  
**原則：** 最佳軟體工程實踐、單人開發、零成本部署

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
│   │   │   ├── supabase.ts  # Supabase client
│   │   │   ├── liff.ts      # LINE LIFF SDK wrapper
│   │   │   └── api.ts       # API 呼叫封裝
│   │   └── __tests__/
├── supabase/
│   ├── migrations/          # 資料庫版本控制
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   └── 003_functions.sql
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

# Admin 驗證（簡易密碼保護後台，MVP 階段）
ADMIN_SECRET=

# 匯款帳號資訊（顯示給客戶）
NEXT_PUBLIC_BANK_CODE=
NEXT_PUBLIC_BANK_ACCOUNT=
NEXT_PUBLIC_BANK_HOLDER=
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
  per_person_limit int not null default 1,
  created_at       timestamptz not null default now()
);

-- products
create table products (
  id         uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  name       text not null,
  price      int not null check (price >= 0),
  stock_qty  int not null check (stock_qty >= 0),
  created_at timestamptz not null default now()
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

create table orders (
  id                uuid primary key default uuid_generate_v4(),
  session_id        uuid not null references sessions(id),
  line_user_id      text not null,
  line_display_name text not null,
  status            order_status not null default 'pending',
  total_amount      int not null default 0,
  remit_last5       text,
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

-- index: 常用查詢加速
create index idx_orders_session_line on orders(session_id, line_user_id);
create index idx_orders_status on orders(status);
create index idx_orders_created_at on orders(created_at);
create index idx_order_items_order on order_items(order_id);
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
```

### 3.3 Migration 003 — Database Functions

關鍵業務邏輯以 PostgreSQL Function 實作，確保 transaction 原子性。

```sql
-- 003_functions.sql

-- (A) 建立訂單（含庫存扣除 + quota 檢查）
create or replace function create_order(
  p_session_id    uuid,
  p_line_user_id  text,
  p_display_name  text,
  p_items         jsonb  -- [{product_id, quantity}]
) returns uuid language plpgsql as $$
declare
  v_order_id     uuid;
  v_total        int := 0;
  v_quota_used   int;
  v_quota_limit  int;
  v_item         jsonb;
  v_product      record;
begin
  -- 1. 檢查 session 是否開放
  select per_person_limit into v_quota_limit
  from sessions where id = p_session_id and is_active = true;
  if not found then
    raise exception 'SESSION_NOT_ACTIVE';
  end if;

  -- 2. 檢查 quota
  select coalesce(sum(oi.quantity), 0) into v_quota_used
  from orders o
  join order_items oi on oi.order_id = o.id
  where o.session_id = p_session_id
    and o.line_user_id = p_line_user_id
    and o.status != 'cancelled';

  -- 計算本次欲購買總量
  select coalesce(sum((item->>'quantity')::int), 0) into v_quota_used
  from jsonb_array_elements(p_items) as item;

  if v_quota_used > v_quota_limit then
    raise exception 'QUOTA_EXCEEDED';
  end if;

  -- 3. 建立訂單
  insert into orders (session_id, line_user_id, line_display_name)
  values (p_session_id, p_line_user_id, p_display_name)
  returning id into v_order_id;

  -- 4. 逐項處理品項：扣庫存、建 order_items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from products
    where id = (v_item->>'product_id')::uuid
      and session_id = p_session_id
    for update; -- 鎖定防止 race condition

    if not found then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;

    if v_product.stock_qty < (v_item->>'quantity')::int then
      raise exception 'INSUFFICIENT_STOCK:%', v_product.name;
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

  -- 5. 更新總金額
  update orders set total_amount = v_total where id = v_order_id;

  return v_order_id;
end;
$$;

-- (B) 後台取消訂單（連鎖釋放庫存 + quota）
create or replace function admin_cancel_order(
  p_order_id     uuid,
  p_reason       text
) returns void language plpgsql as $$
declare
  v_order record;
  v_item  record;
begin
  select * into v_order from orders where id = p_order_id for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

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

  -- 更新狀態
  update orders
  set status = 'cancelled',
      cancelled_by = 'admin',
      cancel_reason = p_reason
  where id = p_order_id;
end;
$$;

-- (C) 接受訂單（分配排單號）
create or replace function admin_accept_order(
  p_order_id uuid
) returns int language plpgsql as $$
declare
  v_queue_number int;
  v_session_id   uuid;
begin
  select session_id into v_session_id
  from orders where id = p_order_id;

  -- 取得此 session 目前最大排單號 + 1
  select coalesce(max(queue_number), 0) + 1 into v_queue_number
  from orders
  where session_id = v_session_id
    and queue_number is not null;

  update orders
  set status = 'in_production',
      queue_number = v_queue_number
  where id = p_order_id and status = 'pending';

  if not found then
    raise exception 'ORDER_NOT_PENDING';
  end if;

  return v_queue_number;
end;
$$;
```

---

## 4. 後端 API 實作細節

Next.js **Route Handlers**（`app/api/`）作為 API 層，呼叫 Supabase function 或直接使用 service role key 操作資料庫。

### 4.1 LINE ID 驗證 Middleware

```typescript
// lib/auth/verifyLiff.ts
import { NextRequest } from 'next/server'
import { getLiffProfile } from '@/lib/liff'

export async function verifyLiffToken(req: NextRequest) {
  const token = req.headers.get('x-liff-token')
  if (!token) throw new Error('UNAUTHORIZED')

  // 呼叫 LINE API 驗證 token，取得 LINE user profile
  const profile = await getLiffProfile(token)
  return profile // { userId, displayName }
}
```

### 4.2 後台驗證 Middleware

MVP 階段使用 shared secret，後續可升級為 Supabase Auth：

```typescript
// lib/auth/verifyAdmin.ts
import { NextRequest } from 'next/server'

export function verifyAdmin(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    throw new Error('FORBIDDEN')
  }
}
```

### 4.3 統一錯誤處理

```typescript
// lib/api/response.ts
export function errorResponse(code: string, status = 400) {
  const messages: Record<string, string> = {
    UNAUTHORIZED:                    '請透過 LINE 開啟此頁面',
    FORBIDDEN:                       '無操作權限',
    QUOTA_EXCEEDED:                  '已超過本次開單每人購買上限',
    INSUFFICIENT_STOCK:              '商品庫存不足',
    SESSION_NOT_ACTIVE:              '目前沒有開放中的開單',
    ORDER_NOT_FOUND:                 '找不到此訂單',
    CANNOT_CANCEL_PAYMENT_SUBMITTED: '付款確認中的訂單無法取消',
    ORDER_ALREADY_FINALIZED:         '此訂單已結束',
    ORDER_NOT_PENDING:               '此訂單狀態不允許此操作',
  }
  return Response.json(
    { error: code, message: messages[code] ?? '系統錯誤，請稍後再試' },
    { status }
  )
}
```

### 4.4 API 路由規範

每個 Route Handler 遵循相同結構：

```typescript
// app/api/orders/route.ts（建立訂單範例）
import { verifyLiffToken } from '@/lib/auth/verifyLiff'
import { errorResponse } from '@/lib/api/response'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const profile = await verifyLiffToken(req)
    const body = await req.json()

    const { data, error } = await supabaseAdmin.rpc('create_order', {
      p_session_id:   body.sessionId,
      p_line_user_id: profile.userId,
      p_display_name: profile.displayName,
      p_items:        body.items,
    })

    if (error) return errorResponse(error.message)
    return Response.json({ orderId: data }, { status: 201 })

  } catch (e: any) {
    return errorResponse(e.message)
  }
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
| `/liff/order` | LIFF 訂購頁（商品列表、數量選擇、送出） |
| `/liff/status` | LIFF 訂單狀態查詢頁 |
| `/admin` | 後台首頁（進行中訂單 Dashboard） |
| `/admin/orders` | 歷史訂單查詢 |
| `/admin/sessions/new` | 新增開單 |
| `/admin/sessions/[id]/stats` | 開單統計 |

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

採三層測試金字塔，單人開發以「高信心、低維護成本」為原則。

```
        E2E Tests（少量，保護關鍵路徑）
       ────────────────────────────────
      Integration Tests（API + DB Function）
     ────────────────────────────────────────
    Unit Tests（純邏輯、工具函式）
```

### 6.1 Unit Tests

**範圍：** 不涉及 I/O 的純函式

**工具：** Vitest

**測試項目：**

```
lib/quota.ts
  ✓ 計算 quota：排除 cancelled 訂單
  ✓ 計算 quota：completed 訂單計入
  ✓ 超過上限回傳正確錯誤

lib/orderStatus.ts
  ✓ 允許的狀態轉移應通過
  ✓ 不允許的狀態轉移應丟出例外
  ✓ payment_submitted 不允許取消

lib/api/response.ts
  ✓ 已知錯誤碼回傳正確中文訊息
  ✓ 未知錯誤碼回傳預設訊息
```

範例：

```typescript
// __tests__/unit/quota.test.ts
import { describe, it, expect } from 'vitest'
import { calcQuotaUsed } from '@/lib/quota'

describe('calcQuotaUsed', () => {
  it('excludes cancelled orders', () => {
    const orders = [
      { status: 'completed', quantity: 1 },
      { status: 'cancelled', quantity: 2 },
      { status: 'in_production', quantity: 1 },
    ]
    expect(calcQuotaUsed(orders)).toBe(2)
  })

  it('includes completed orders', () => {
    const orders = [
      { status: 'completed', quantity: 2 },
    ]
    expect(calcQuotaUsed(orders)).toBe(2)
  })
})
```

### 6.2 Integration Tests

**範圍：** API Route Handlers + Supabase DB Functions

**工具：** Vitest + Supabase 本地實例（`supabase start`）

**測試策略：** 每個測試案例前重置資料庫至 seed 狀態，確保隔離

**測試項目：**

```
POST /api/orders（建立訂單）
  ✓ 正常下單：庫存正確扣除
  ✓ 正常下單：order_items 正確建立
  ✓ 無效 LIFF token：回傳 401
  ✓ session 未開放：回傳 SESSION_NOT_ACTIVE
  ✓ 超過 quota：回傳 QUOTA_EXCEEDED
  ✓ 庫存不足：回傳 INSUFFICIENT_STOCK
  ✓ 同時兩筆訂單搶最後一個庫存：只有一筆成功（race condition）

PUT /api/orders/:id（修改訂單）
  ✓ pending 狀態可修改，庫存正確更新
  ✓ in_production 狀態修改：回傳 403
  ✓ 修改後超過 quota：回傳 QUOTA_EXCEEDED

DELETE /api/orders/:id（客戶取消）
  ✓ pending 狀態可取消，庫存正確釋放
  ✓ 取消後 quota 釋放，同一 LINE ID 可重新下單
  ✓ in_production 狀態取消：回傳 403

PATCH /api/admin/orders/:id/accept
  ✓ pending → in_production，排單號正確遞增
  ✓ 非 pending 狀態：回傳錯誤

PATCH /api/admin/orders/:id/cancel
  ✓ in_production 可取消，庫存釋放，quota 釋放
  ✓ pending_payment 可取消，庫存釋放，quota 釋放
  ✓ payment_submitted 取消：回傳 CANNOT_CANCEL_PAYMENT_SUBMITTED
  ✓ completed 取消：回傳 ORDER_ALREADY_FINALIZED
  ✓ 取消後同一 LINE ID 可重新下單

PATCH /api/admin/orders/:id/confirm-payment
  ✓ payment_submitted → completed
  ✓ completed 後 quota 不釋放

GET /admin/sessions/:id/stats
  ✓ 回傳正確訂單數、各品項數量、總金額
  ✓ 取消訂單不計入銷售金額
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
| M1 — 地基 | Supabase Schema + RLS + DB Functions + 測試框架 | 第 1 週 |
| M2 — 客戶下單 | LIFF 訂購頁、建立訂單 API、防黃牛 | 第 2 週 |
| M3 — 客戶查詢 | LIFF 狀態查詢頁、修改 / 取消訂單 | 第 3 週 |
| M4 — 後台操作 | 後台進行中訂單管理（接單、取消、完成） | 第 4 週 |
| M5 — 後台報表 | 歷史訂單查詢、CSV 匯出、開單統計 | 第 5 週 |

### 8.3 Issues 清單

#### M1 — 地基

```
[chore][layer: infra]  #001 初始化 Monorepo 結構與環境設定
[chore][layer: infra]  #002 設定 Supabase 本地開發環境
[chore][layer: db]     #003 Migration 001：初始 Schema
[chore][layer: db]     #004 Migration 002：RLS Policies
[chore][layer: db]     #005 Migration 003：DB Functions（create_order、admin_cancel_order、admin_accept_order）
[chore][layer: db]     #006 建立 seed.sql 測試資料
[type: test]           #007 建立 Vitest 測試框架與 Unit Test 基礎設定
[type: test]           #008 Integration Test：create_order DB Function
[type: test]           #009 Integration Test：admin_cancel_order DB Function
[chore][layer: infra]  #010 設定 GitHub Actions CI workflow
```

#### M2 — 客戶下單

```
[type: feature][layer: api]      #011 API：GET /api/sessions/active
[type: feature][layer: api]      #012 API：POST /api/orders（含 LIFF token 驗證）
[type: feature][layer: api]      #013 LIFF token 驗證 middleware
[type: test]                     #014 Integration Test：POST /api/orders 全案例
[type: feature][layer: frontend] #015 LIFF 訂購頁：商品列表與數量選擇
[type: feature][layer: frontend] #016 LIFF 訂購頁：Quota 即時顯示
[type: feature][layer: frontend] #017 LIFF 訂購頁：送出訂單與成功畫面
[type: test]                     #018 E2E Test：完整訂購流程 Happy Path
```

#### M3 — 客戶查詢

```
[type: feature][layer: api]      #019 API：GET /api/orders（依 LINE ID 查詢）
[type: feature][layer: api]      #020 API：PATCH /api/orders/:id/remit（填入匯款後五碼）
[type: feature][layer: api]      #021 API：PUT /api/orders/:id（修改訂單）
[type: feature][layer: api]      #022 API：DELETE /api/orders/:id（客戶取消）
[type: test]                     #023 Integration Test：修改 / 取消訂單全案例
[type: feature][layer: frontend] #024 LIFF 訂單查詢頁：狀態顯示與各狀態對應 UI
[type: feature][layer: frontend] #025 LIFF 訂單查詢頁：修改訂單流程
[type: feature][layer: frontend] #026 LIFF 訂單查詢頁：取消訂單確認
[type: feature][layer: frontend] #027 LIFF 訂單查詢頁：待付款 — 顯示匯款資訊與填入後五碼
[type: test]                     #028 E2E Test：防黃牛阻擋與取消後重新下單
```

#### M4 — 後台操作

```
[chore][layer: api]              #029 後台 Admin 驗證 middleware
[type: feature][layer: api]      #030 API：PATCH /admin/orders/:id/accept
[type: feature][layer: api]      #031 API：PATCH /admin/orders/:id/reject
[type: feature][layer: api]      #032 API：PATCH /admin/orders/:id/ready
[type: feature][layer: api]      #033 API：PATCH /admin/orders/:id/cancel
[type: feature][layer: api]      #034 API：PATCH /admin/orders/:id/confirm-payment
[type: feature][layer: api]      #035 API：POST /admin/sessions（新增開單）
[type: feature][layer: api]      #036 API：POST /admin/products（新增商品）
[type: test]                     #037 Integration Test：後台操作全案例
[type: feature][layer: frontend] #038 後台：進行中訂單 Dashboard（待確認 / 製作中 / 待付款 / 確認付款中）
[type: feature][layer: frontend] #039 後台：接單 / 拒絕 / 取消操作（含取消原因輸入）
[type: feature][layer: frontend] #040 後台：新增開單表單
[chore][layer: infra]            #041 設定 GitHub Actions CD workflow（Vercel 部署）
[chore][layer: infra]            #042 設定 Supabase migration 自動套用
```

#### M5 — 後台報表

```
[type: feature][layer: api]      #043 API：GET /admin/orders（歷史查詢，支援篩選）
[type: feature][layer: api]      #044 API：GET /admin/orders/export（CSV 匯出）
[type: feature][layer: api]      #045 API：GET /admin/sessions/:id/stats
[type: test]                     #046 Integration Test：歷史查詢與統計 API
[type: feature][layer: frontend] #047 後台：歷史訂單查詢頁（篩選 + 列表）
[type: feature][layer: frontend] #048 後台：CSV 匯出按鈕
[type: feature][layer: frontend] #049 後台：開單統計頁（數字摘要）
```

### 8.4 GitHub Project Board 欄位設定

使用 **GitHub Projects（Table view + Board view）**：

**Board View 欄位（Kanban）：**

```
Backlog → In Progress → In Review → Done
```

**Table View 欄位：**

| 欄位 | 型別 | 說明 |
|------|------|------|
| Title | text | Issue 標題 |
| Milestone | milestone | M1 ~ M5 |
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
| M1 — 地基 | 10 | 12 hr |
| M2 — 客戶下單 | 8 | 10 hr |
| M3 — 客戶查詢 | 10 | 12 hr |
| M4 — 後台操作 | 14 | 16 hr |
| M5 — 後台報表 | 7 | 8 hr |
| **總計** | **49** | **~58 hr** |

單人每週投入約 10~12 小時，五週完成 MVP 是合理目標。
