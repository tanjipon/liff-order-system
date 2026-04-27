# 甜點工作室訂購系統規格書

**版本：** v1.5  
**最後更新：** 2026-04  
**性質：** 個人工作室，非正式公司

**v1.1 異動說明：** 同步 implementation v1.3 的設計決策。新增 RBAC 系統（人員管理、角色管理）、`per_person_limit` 支援 NULL 無上限、後台驗證改為 Supabase Auth + RBAC、開發排程更新至六週。

**v1.2 異動說明：** 新增現金付款方式、取貨方式管理功能。`orders` 表新增 `payment_method`、`pickup_option_id`、`pickup_fee` 欄位；新增 `pickup_options` 表；狀態機補充現金付款可跳過 `payment_submitted`；新增 `pickup_options:manage` 權限項目；開發排程更新至七週。

**v1.3 異動說明：** 新增 Session 預設開搶時間與追加庫存排程功能。`sessions` 表的 `opens_at` / `closes_at` 正式驅動開放判斷邏輯，不再依賴純手動的 `is_active`；新增 `session_restocks` 與 `restock_items` 兩張表；`create_order` DB Function 於下單前惰性套用到期的 restock；後台新增追加庫存排程 UI；LIFF 客戶端顯示倒數與追加庫存預告；新增 `restocks:manage` 權限項目；開發排程更新至八週。

**v1.5 異動說明：** 新增商品個別購買上限。`products` 表新增 `max_per_person`（NULL = 不限）；與 `sessions.per_person_limit` 並存，各自獨立控制；`create_order` 加入 per-product quota 檢查；新增錯誤碼 `PRODUCT_QUOTA_EXCEEDED`；後台商品表單與 LIFF 選購頁同步更新；新增 M9 Milestone。

**v1.4 異動說明：** 調整 restock 套用機制為**主動觸發 + 惰性備援**雙層架構。客戶進入 session 頁面時，系統主動呼叫 `apply_pending_restocks()` 套用到期 restock，確保頁面載入即看到最新庫存；API 回傳 `next_restock_at`，前端在庫存歸零時顯示倒數計時器，時間到自動刷新庫存。`create_order` 內保留惰性套用作為雙重保護。

---

## 1. 專案概述

### 1.1 背景

個人甜點工作室，原先透過 LINE 群組以訊息方式讓客戶訂購與搶購甜點，造成訂單難以統計與管理的問題。

### 1.2 目標

建立一套結合 LINE 生態系的輕量訂購系統，解決以下問題：

- 訂單數量難以統計
- 無法防止黃牛一次掃貨
- 缺乏結構化的訂單紀錄
- 金流與排單流程不透明

### 1.3 設計原則

- 成本最低（目標每月 $0）
- 客戶不需額外下載 App 或註冊帳號
- 以現金或匯款為主，避免第三方金流報稅問題
- 製作完成後才請款，完全避免退款情境

---

## 2. 系統架構

### 2.1 技術選型

| 層級 | 技術 | 費用 |
|------|------|------|
| 前端部署 | Vercel | 免費 |
| 前端框架 | Next.js / React | 免費 |
| 後端 + 資料庫 | Supabase | 免費（500MB） |
| LINE 整合 | LINE LIFF | 免費 |
| LINE 推播 | 不主動推播，客戶自行查詢 | 免費 |

**每月固定成本：$0**（網域可選，約 $10 USD/年）

### 2.2 整體架構

```
客戶端（LINE App）
    ↓ LIFF 開啟
前端層（Vercel）
    ├── LIFF 訂購頁（Next.js）
    ├── LIFF 訂單查詢頁（Next.js）
    └── 後台管理頁（Next.js）
    ↓
後端層（Supabase）
    ├── REST API（Next.js Route Handlers）
    ├── Auth（LINE ID 驗證 / 後台 Supabase Auth）
    └── RLS 規則（防黃牛 / 權限控管）
    ↓
資料層（Supabase PostgreSQL）
    ├── sessions（開單紀錄）
    ├── products（商品資料）
    ├── session_restocks（追加庫存排程）
    ├── restock_items（追加庫存品項）
    ├── orders（訂單紀錄）
    ├── order_items（訂單品項）
    ├── pickup_options（取貨方式）
    ├── roles（後台角色定義）
    ├── permissions（後台權限項目）
    ├── role_permissions（角色與權限對應）
    └── user_roles（後台人員帳號）
```

---

## 3. 資料庫設計

### 3.1 Schema

#### sessions（開單批次）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| title | text | 開單名稱，例如「六月草莓塔開單」 |
| opens_at | timestamp | 開始訂購時間；`NULL` 代表立即開放；到時間前客戶看到倒數 |
| closes_at | timestamp | 截止訂購時間；`NULL` 代表不設截止 |
| is_active | boolean | 老闆是否批准此開單（緊急關閉用）；`false` 時無論時間為何皆不開放 |
| per_person_limit | int | 每人購買上限（件數）；`NULL` 表示無上限 |

**開放判斷邏輯：** session 對客戶開放的條件為 `is_active = true` 且 `now()` 在 `opens_at` 至 `closes_at` 的區間內（`NULL` 的欄位視為無限制）。

#### products（商品）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| session_id | uuid FK | 所屬開單批次 |
| name | text | 商品名稱 |
| price | int | 單價（新台幣） |
| stock_qty | int | 剩餘庫存數量 |
| max_per_person | int | 此商品每人購買上限（件）；`NULL` 表示不限 |

#### orders（訂單）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| session_id | uuid FK | 所屬開單批次 |
| line_user_id | text | LINE 使用者 ID（防黃牛核心欄位） |
| line_display_name | text | LINE 顯示名稱 |
| status | enum | 訂單狀態（見第 4 節） |
| payment_method | enum | `bank_transfer` \| `cash`，下單時選擇，之後不得修改 |
| total_amount | int | 應付總金額（商品小計 + 取貨費用，新台幣） |
| remit_last5 | text | 匯款後五碼（僅 `bank_transfer` 適用） |
| pickup_option_id | uuid FK | 客戶選擇的取貨方式 |
| pickup_fee | int | 下單當時的取貨費用快照（防止事後修改費用影響舊訂單） |
| queue_number | int | 排單號碼 |
| edit_count | int | 修改次數（預設 0） |
| last_edited_at | timestamp | 最後修改時間 |
| cancelled_by | enum | `customer` \| `admin` |
| cancel_reason | text | 取消原因（老闆填寫） |
| created_at | timestamp | 建立時間 |

#### order_items（訂單品項）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| order_id | uuid FK | 所屬訂單 |
| product_id | uuid FK | 商品 |
| quantity | int | 數量 |
| unit_price | int | 下單當時單價（快照） |

#### pickup_options（取貨方式）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| name | text | 選項名稱，例如「自取」、「宅配」 |
| description | text | 說明文字，例如取貨地點、時間、注意事項 |
| extra_fee | int | 額外費用（新台幣），`0` 代表免費 |
| allowed_payment_methods | text[] | 允許的付款方式，`NULL` 代表不限制；例如宅配可限制為 `['bank_transfer']` |
| is_active | boolean | 是否開放；下架後客戶選購頁不顯示 |
| sort_order | int | 排列順序（影響客戶端顯示順序） |
| created_at | timestamp | 建立時間 |

#### session_restocks（追加庫存排程）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| session_id | uuid FK | 所屬開單批次 |
| opens_at | timestamp | 此波庫存開放搶購時間 |
| is_active | boolean | 老闆是否啟用此波排程（可取消） |
| applied | boolean | 是否已套用至 `products.stock_qty`（套用後不可取消） |
| created_at | timestamp | 建立時間 |

#### restock_items（追加庫存品項）

| 欄位 | 型別 | 說明 |
|------|------|------|
| restock_id | uuid FK PK | 所屬追加庫存排程 |
| product_id | uuid FK PK | 商品 |
| quantity | int | 追加數量 |

#### roles（後台角色）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| name | text | 角色名稱，例如 `owner`、`assistant` |
| created_at | timestamp | 建立時間 |

#### permissions（後台權限項目）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| key | text | 權限識別碼，例如 `orders:cancel` |
| name | text | 顯示名稱，例如「取消訂單」 |

#### role_permissions（角色與權限對應）

| 欄位 | 型別 | 說明 |
|------|------|------|
| role_id | uuid FK | 角色 |
| permission_id | uuid FK | 權限 |

#### user_roles（後台人員帳號）

| 欄位 | 型別 | 說明 |
|------|------|------|
| user_id | uuid PK FK | Supabase Auth 使用者 ID |
| role_id | uuid FK | 所屬角色 |
| display_name | text | 顯示姓名 |
| is_active | boolean | 是否啟用（停用時無法登入後台） |
| created_at | timestamp | 建立時間 |

### 3.2 防黃牛 Quota 計算

系統有兩層獨立的購買限制，下單時兩層都必須通過：

**層一：Session 總件數上限（`sessions.per_person_limit`）**

同一 session 內，依 LINE ID 累加非取消狀態的**跨商品總數量**：

```sql
SELECT COALESCE(SUM(oi.quantity), 0)
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.session_id = $session_id
  AND o.line_user_id = $line_user_id
  AND o.status != 'cancelled'
```

**層二：商品個別上限（`products.max_per_person`）**

針對**每個商品**，依 LINE ID 累加非取消狀態的**單品數量**：

```sql
SELECT COALESCE(SUM(oi.quantity), 0)
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.session_id = $session_id
  AND o.line_user_id = $line_user_id
  AND o.status != 'cancelled'
  AND oi.product_id = $product_id
```

**共同規則：**
- `cancelled` → 釋放 quota，客戶可在同一 session 重新下單
- `completed` → 計入 quota，不重新開放
- 欄位為 `NULL` → 跳過該層檢查，不限購
- 兩層各自獨立：通過 session limit 不代表通過 product limit，反之亦然

### 3.3 總金額計算

```
total_amount = Σ(unit_price × quantity) + pickup_fee
```

`pickup_fee` 於建立訂單時從 `pickup_options.extra_fee` 快照寫入，事後修改取貨方式費用不影響已建立的訂單。

---

## 4. 訂單狀態機

### 4.1 狀態定義

| 狀態 | 說明 |
|------|------|
| `pending` | 待確認，客戶剛送出訂單 |
| `in_production` | 製作中，老闆已確認接單並分配排單號 |
| `pending_payment` | 待付款，製作完成，等待客戶付款 |
| `payment_submitted` | 確認付款中，客戶已填入匯款後五碼（**僅 `bank_transfer` 適用**） |
| `completed` | 完成取貨 |
| `cancelled` | 已取消（含客戶自行取消、老闆拒絕、老闆取消） |

### 4.2 狀態轉移

```
pending → in_production               （老闆接單）
pending → cancelled                   （客戶取消 或 老闆拒絕）
in_production → pending_payment       （老闆標記製作完成）
in_production → cancelled             （老闆取消）

── 匯款付款（bank_transfer）──
pending_payment → payment_submitted   （客戶填入匯款後五碼）
payment_submitted → completed         （老闆確認收款）

── 現金付款（cash）──
pending_payment → completed           （老闆當面收現金後直接確認）

pending_payment → cancelled           （老闆取消，兩種付款方式皆適用）
```

`payment_submitted` 後不得取消，避免客戶已匯款卻遭取消的糾紛。現金訂單不經過此狀態，故無此限制。

### 4.3 取消連鎖動作（Transaction）

後台取消訂單時，以下三步驟必須在同一 transaction 內完成：

1. `orders.status` → `cancelled`，寫入 `cancel_reason` 與 `cancelled_by`
2. 釋放庫存：`products.stock_qty += order_items` 各品項數量
3. 釋放 quota：該 `line_user_id` 在此 session 可重新下單

### 4.4 修改訂單邏輯

修改限於 `pending` 狀態，修改時以 transaction 執行：

1. 釋放舊 `order_items` 數量回 `products.stock_qty`
2. 檢查新數量是否超過庫存與 quota 限制
3. 扣除新數量，更新 `order_items`，重新計算 `total_amount`

---

## 5. 使用者流程

### 5.1 客戶訂購流程

1. 點擊 LINE 群組內的訂購連結
2. LIFF 開啟，自動取得 LINE ID（無需另外登入）
3. 若 session 尚未到 `opens_at`，顯示倒數計時，商品清單可見但無法送出
4. 開搶時間到後按鈕自動解鎖，系統檢查 LINE ID 是否超過購買上限（session 總件數 + 各商品個別上限）
5. 瀏覽商品，選擇品項與數量（系統已在頁面載入時主動套用到期 restock；單品設有 `max_per_person` 時，數量選擇器自動限制上限並顯示提示；庫存為 0 時，若 `next_restock_at` 有值則顯示「追加庫存將於 XX:XX 開放」倒數，時間到自動刷新庫存；無排程則顯示「已售完」）
6. 選擇取貨方式（顯示名稱、說明、費用）
7. 選擇付款方式（依取貨方式的 `allowed_payment_methods` 過濾可選項）
8. 確認頁顯示：商品小計 + 取貨費用 + 總金額
9. 送出訂單，畫面顯示訂單編號，狀態為「待確認」
10. **待確認期間**：可回 LIFF 修改品項、數量，或取消訂單
11. 老闆確認接單後，狀態變為「製作中」，客戶端鎖定，無法再修改
12. 製作完成後，老闆通知付款（透過 LINE 群組告知）
13. 客戶回 LIFF 查詢頁：
    - **匯款**：依畫面顯示帳號完成 ATM / 網銀匯款，填入後五碼送出
    - **現金**：等待老闆當面收款確認
14. 老闆確認收款後，訂單狀態變為「完成」

### 5.2 老闆後台流程

1. 新增 session（開單名稱、品項、庫存、**商品個別限購**、每人總件數限購、**開搶時間**）
2. 複製 LIFF 連結，提前貼至 LINE 群組，客戶可看到倒數
3. 到開搶時間後，系統自動開放下單（`opens_at <= now()`）
4. 後台查看「待確認」訂單列表，審核產能
5. 逐筆點擊「接單」（→ `in_production`，系統分配排單號）或「拒絕」（→ `cancelled`）
6. 完成製作後，點擊「製作完成，通知付款」（→ `pending_payment`）
7. 等待客戶填入匯款後五碼 / 現場收現
8. 核對確認後點擊「確認收款」（→ `completed`）
9. 若需取消（`in_production` 或 `pending_payment`），填寫原因後取消，系統自動釋放庫存與 quota
10. **若需追加庫存**：在開單詳情頁新增追加庫存排程，設定開搶時間與各商品追加數量；時間到後客戶重新進入頁面即自動套用（主動觸發），或最晚於下一筆下單時套用（惰性備援）

---

## 6. LIFF 訂單查詢頁邏輯

客戶進入後，以 LINE ID 自動查詢訂單並顯示。所有狀態均顯示取貨方式名稱與費用。

| 訂單狀態 | 付款方式 | 顯示內容 | 客戶可操作 |
|----------|---------|---------|-----------|
| `pending` | 任意 | 訂單編號、品項明細、取貨方式、總金額 | 「修改訂單」「取消訂單」按鈕 |
| `in_production` | 任意 | 排單號碼、製作中提示 | 無（鎖定） |
| `pending_payment` | `bank_transfer` | 匯款帳號、應付金額 | 填入匯款後五碼欄位 |
| `pending_payment` | `cash` | 「請於取貨時付現 NT$XXX」 | 無（等老闆確認） |
| `payment_submitted` | `bank_transfer` | 等待老闆確認付款 | 無 |
| `completed` | 任意 | 訂單完成 | 無 |
| `cancelled` | 任意 | 已取消 / 拒絕原因 | 提供重新下單連結 |

---

## 7. 後台管理功能

### 7.1 進行中訂單

- 待確認列表：顯示 LINE 名稱、品項、數量，可接單 / 拒絕
- 製作中列表：可標記完成、可取消
- 待付款列表：可確認收款、可取消
- 確認付款中列表：可確認收款

### 7.2 歷史訂單查詢

**篩選條件（可組合）：**

- Session（下拉選單）
- LINE 名稱（模糊搜尋）
- 訂單狀態（全部 / 完成 / 取消 / 進行中）
- 日期區間（依 `created_at`）

**列表欄位：** 訂單編號、建立時間、LINE 名稱、品項摘要、金額、狀態、取消原因

**匯出：** 依目前篩選條件匯出 CSV

### 7.3 開單統計

每個 session 可查看：

- 總訂單數（完成 / 取消 / 進行中 各佔比）
- 各品項銷售數量
- 總銷售金額 / 平均客單價
- 取消率
- 回購客戶數（跨 session 重複出現的 LINE ID）

### 7.4 人員管理

具備 `staff:manage` 權限的人員可操作：

- 查看人員列表（顯示姓名、Email、角色、帳號狀態）
- 新增人員（填姓名、Email、角色，系統寄送邀請信，對方自行設定密碼）
- 編輯人員姓名或角色
- 停用 / 啟用帳號（不刪除資料，停用後立即無法登入）
- 重新寄送邀請信

**安全限制：** 不可停用自己的帳號。

### 7.5 角色管理

具備 `roles:manage` 權限的人員可操作：

- 查看所有角色與各角色的權限配置
- 新增自訂角色
- 勾選 / 取消勾選角色的權限項目

**預設角色：** `owner`（全權限）、`assistant`（訂單操作 + 報表）。

**保護規則：** `owner` 角色的 `roles:manage` 權限不可被移除，防止所有人員被鎖在系統外。

**完整權限清單：**

| 權限識別碼 | 顯示名稱 |
|------------|---------|
| `sessions:create` | 建立開單 |
| `sessions:edit` | 編輯開單 |
| `orders:accept` | 接受訂單 |
| `orders:reject` | 拒絕訂單 |
| `orders:mark_ready` | 標記製作完成 |
| `orders:cancel` | 取消訂單 |
| `orders:confirm_payment` | 確認付款 |
| `stats:view` | 查看報表 |
| `staff:manage` | 管理人員 |
| `roles:manage` | 管理角色權限 |
| `pickup_options:manage` | 管理取貨方式 |
| `restocks:manage` | 管理追加庫存排程 |

### 7.6 取貨方式管理

具備 `pickup_options:manage` 權限的人員可操作：

- 查看目前所有取貨方式（含費用、說明、狀態）
- 新增取貨方式（名稱、說明、費用、允許付款方式、排列順序）
- 編輯取貨方式（費用修改只影響新訂單，舊訂單已快照 `pickup_fee`）
- 上架 / 下架（切換 `is_active`，下架後客戶選購頁不顯示）
- 拖曳調整顯示順序

### 7.7 追加庫存排程管理

具備 `restocks:manage` 權限的人員可操作。入口位於**開單詳情頁**，與商品列表整合：

**查看排程：** 顯示此 session 所有追加庫存排程，含開搶時間、各商品追加數量、狀態。

| 狀態 | 說明 |
|------|------|
| 待套用 | `applied = false`，時間尚未到，可取消 |
| 已套用 | `applied = true`，已自動觸發寫入庫存，唯讀 |
| 已取消 | `is_active = false`，不可恢復 |

**新增排程：** 填寫開搶時間、各商品追加數量（留空代表不追加），儲存後顯示「待套用」。

**取消排程：** 僅限「待套用」狀態。套用後不可取消。

**套用機制：** 採**主動觸發 + 惰性備援**雙層架構，不依賴 cron job。

- **主動觸發（優先）**：客戶進入 LIFF 訂購頁時，前端呼叫 `GET /api/sessions/active`，後端主動執行 `apply_pending_restocks(session_id)`，套用所有時間已到且未套用的 restock，並回傳 `next_restock_at`（下一波待套用 restock 的開放時間）。客戶看到的庫存數量已是套用後的最新狀態。
- **惰性備援（防護）**：`create_order` 在庫存扣除前仍保留惰性套用邏輯，處理極端情況（如客戶長時間停留在頁面後直接送出，未再次拉取最新 session 資料）。
- **並發保護**：兩個套用路徑皆以 `FOR UPDATE` 鎖定 `session_restocks` 列，確保同一 restock 不會被重複套用。

---

## 8. API 端點

### 8.1 客戶端

| 端點 | 方法 | 說明 |
|------|------|------|
| `/sessions/active` | GET | 取得目前開放或即將開放的 session；後端主動套用到期 restock 後回傳；response 含 `next_restock_at`（下一波追加庫存時間，`null` 表示無排程） |
| `/orders` | POST | 建立新訂單 |
| `/orders?line_user_id=xxx` | GET | 查詢自己的訂單列表 |
| `/orders/:id/remit` | PATCH | 填入匯款後五碼 |
| `/orders/:id` | PUT | 修改訂單（限 `pending`） |
| `/orders/:id` | DELETE | 取消訂單（限 `pending`） |

### 8.2 後台（Admin）

| 端點 | 方法 | 說明 |
|------|------|------|
| `/admin/sessions` | POST | 建立新開單 |
| `/admin/products` | POST / PATCH | 新增 / 編輯商品 |
| `/admin/orders` | GET | 歷史訂單查詢（支援篩選參數） |
| `/admin/orders/export` | GET | 匯出 CSV（同篩選參數） |
| `/admin/orders/:id/accept` | PATCH | 接受訂單 → `in_production`，分配排單號 |
| `/admin/orders/:id/reject` | PATCH | 拒絕訂單 → `cancelled` |
| `/admin/orders/:id/ready` | PATCH | 製作完成 → `pending_payment` |
| `/admin/orders/:id/cancel` | PATCH | 取消訂單（限 `in_production` / `pending_payment`），附 `cancel_reason` |
| `/admin/orders/:id/confirm-payment` | PATCH | 確認收款 → `completed` |
| `/admin/sessions/:id/stats` | GET | 指定 session 統計摘要 |
| `/admin/staff` | GET | 取得人員列表 |
| `/admin/staff` | POST | 新增人員（寄送邀請信） |
| `/admin/staff/:id` | PATCH | 修改人員姓名或角色 |
| `/admin/staff/:id/deactivate` | PATCH | 停用帳號 |
| `/admin/staff/:id/activate` | PATCH | 啟用帳號 |
| `/admin/staff/:id/resend-invite` | POST | 重新寄送邀請信 |
| `/admin/roles` | GET | 取得角色列表（含各角色權限） |
| `/admin/roles` | POST | 新增角色 |
| `/admin/roles/:id/permissions` | PATCH | 更新角色的權限配置 |
| `/admin/pickup-options` | GET | 取得取貨方式列表 |
| `/admin/pickup-options` | POST | 新增取貨方式 |
| `/admin/pickup-options/:id` | PATCH | 編輯取貨方式 |
| `/admin/pickup-options/:id/toggle` | PATCH | 上架 / 下架取貨方式 |
| `/admin/pickup-options/reorder` | PATCH | 更新排列順序 |
| `/admin/sessions/:id/restocks` | GET | 取得此 session 所有 restock 排程 |
| `/admin/sessions/:id/restocks` | POST | 新增追加庫存排程 |
| `/admin/restocks/:id` | DELETE | 取消尚未套用的 restock 排程 |

---

## 9. 安全性設計

### 9.1 防黃牛

- LIFF 自動取得 LINE ID，無法偽造
- 每筆訂單綁定 LINE ID，後端 RLS 強制驗證
- 每次下單前檢查同一 session 的 quota，超過直接拒絕

### 9.2 訂單存取控制

- 客戶只能操作自己的訂單（以 LINE ID 驗證，RLS 強制執行）
- `payment_submitted` 後，前後台均不顯示取消按鈕，後端亦回傳 403

### 9.3 後台存取控制

- 後台採用 **Supabase Auth（Email + 密碼）** 登入，不使用 shared secret
- 登入後依 JWT 查詢 `user_roles` → `roles` → `role_permissions`，取得該人員的完整權限清單
- 每支後台 API 明確宣告所需 permission key，無對應權限回傳 403
- 帳號停用（`is_active = false`）後，即使 JWT 未過期，下次 API 請求也會被擋下
- `owner` 角色的 `roles:manage` 權限不可被移除，防止老闆意外鎖死整個後台

### 9.4 庫存一致性

- 所有涉及庫存變更的操作（新增訂單、修改訂單、取消訂單、套用 restock）皆以資料庫 transaction 執行，避免超賣
- Restock 套用於 `create_order` 內，使用 `FOR UPDATE` 鎖定相關商品列，確保多人同時下單時不重複套用

---

## 10. 建議開發順序

| 階段 | 內容 | 目標 |
|------|------|------|
| 第一週 | Supabase Schema 建立（含 RBAC、pickup_options、session_restocks）、RLS 規則、DB Functions、RBAC seed | 地基建好 |
| 第二週 | LIFF 訂購頁（選購、取貨方式、付款方式、防黃牛提示、倒數 UI） | 客戶可以下單 |
| 第三週 | LIFF 訂單查詢頁（狀態顯示、修改、取消、填匯款碼） | 客戶可以自助查詢 |
| 第四週 | 後台登入頁、進行中訂單管理（接單、拒絕、完成、取消） | 老闆可以操作 |
| 第五週 | 後台歷史訂單查詢、CSV 匯出、開單統計 | 完整後台 |
| 第六週 | 後台人員管理、角色管理與權限勾選 | 老闆自主管理帳號 |
| 第七週 | 後台取貨方式管理（新增、編輯、上下架、排序） | 老闆自主管理取貨選項 |
| 第八週 | 後台追加庫存排程管理（新增、查看、取消）、LIFF 追加庫存提示 | 老闆可排程追加庫存 |
| 第九週 | products.max_per_person 欄位、create_order 商品 quota 檢查、後台表單與 LIFF 選購頁限制 | 熱門商品公平分配 |