# 甜點工作室訂購系統規格書

**版本：** v1.11  
**最後更新：** 2026-05  
**性質：** 個人工作室，非正式公司

**v1.1 異動說明：** 同步 implementation v1.3 的設計決策。新增 RBAC 系統（人員管理、角色管理）、`per_person_limit` 支援 NULL 無上限、後台驗證改為 Supabase Auth + RBAC、開發排程更新至六週。

**v1.2 異動說明：** 新增現金付款方式、取貨方式管理功能。`orders` 表新增 `payment_method`、`pickup_option_id`、`pickup_fee` 欄位；新增 `pickup_options` 表；狀態機補充現金付款可跳過 `payment_submitted`；新增 `pickup_options:manage` 權限項目；開發排程更新至七週。

**v1.3 異動說明：** 新增 Session 預設開搶時間與追加庫存排程功能。`sessions` 表的 `opens_at` / `closes_at` 正式驅動開放判斷邏輯，不再依賴純手動的 `is_active`；新增 `session_restocks` 與 `restock_items` 兩張表；`create_order` DB Function 於下單前惰性套用到期的 restock；後台新增追加庫存排程 UI；LIFF 客戶端顯示倒數與追加庫存預告；新增 `restocks:manage` 權限項目；開發排程更新至八週。

**v1.6 異動說明：** 新增 M10 UI 美化規格。明確定義 LIFF 手機優先設計規範、後台響應式佈局、色彩系統、載入體驗、數字顯示穩定性等 UX 要求；新增第十週開發排程。

**v1.7 異動說明：** 新增系統設定規格。新增 `settings` 表（key-value，含 `is_public`）；匯款帳號資訊（`bank_code`、`bank_account`、`bank_holder`）從環境變數移至 DB；新增後台設定頁（`/admin/settings`）；新增公開設定 API（`GET /api/settings/public`）；移除 `NEXT_PUBLIC_BANK_*` 環境變數；新增 M11 Milestone。

**v1.8 異動說明：** 新增商品圖庫與多張商品圖片規格。`product_images` 表（圖片庫）；Cloudflare R2 存放圖片；上傳時自動存入圖庫；可從圖庫選擇圖片；後台 `/admin/images` 圖庫管理頁；`product_image_links` 多對多表支援每個商品關聯多張圖片；LIFF 選購頁展示多圖 Slide；新增 M12、M13 Milestone。

**v1.11 異動說明：** 新增 M16 UI 互動優化與詳情展示規格。後台所有按鈕新增 hover/active 視覺回饋（亮度變化）；Sidebar inactive 連結 hover 顯示灰色底；`ImageCropper` 按鈕同步補齊；後台歷史訂單頁點擊列可展開詳細資訊（accordion）；LIFF 訂單詳情頁新增取貨方式卡片；`LiffLoader` 動畫由 stroke-dashoffset 改為依序彈跳（fill-based）。

**v1.10 異動說明：** 新增訂購人與收貨人資訊規格。`orders` 表新增 `customer_name`、`customer_phone`、`recipient_name`、`recipient_phone`、`recipient_address` 五個欄位；`pickup_options` 新增 `requires_address` 旗標控制地址是否必填；LIFF 訂購流程新增「填寫資料」步驟，支援「收貨人同訂購人」快速帶入；後台訂單卡片展示完整聯絡與收貨資訊；新增 M15 Milestone。

**v1.9 異動說明：** 新增品牌識別規格。LIFF 載入動畫改為 SVG `stroke-dashoffset` 逐條描繪（Ditto Cake Logo，3 波錯開，4.2s 循環）；新增 `config/site.ts` 集中管理站名；Favicon 設定（apple-touch-icon / favicon-32x32 / favicon-16x16 / site.webmanifest）；新增 M14 Milestone。更新 11.3 節：GIF 動圖改為 SVG 動畫規格。

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
    ├── settings（系統設定，key-value）
    ├── product_images（圖片庫）
    ├── product_image_links（商品與圖片多對多）
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
| customer_name | text | 訂購人姓名 |
| customer_phone | text | 訂購人聯絡電話 |
| recipient_name | text | 收貨人姓名（可同訂購人） |
| recipient_phone | text | 收貨人電話（可同訂購人） |
| recipient_address | text | 收貨地址；僅取貨方式 `requires_address = true` 時必填，其餘可為 `NULL` |
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
| requires_address | boolean | 是否需要填寫收貨地址；宅配設為 `true`，自取設為 `false` |
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

#### settings（系統設定）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| key | text UNIQUE | 設定識別碼，例如 `bank_code`、`bank_account`、`bank_holder` |
| value | text | 設定值 |
| is_public | boolean | `true` 時可由公開 API 取得（LIFF 查詢頁使用） |
| updated_at | timestamp | 最後更新時間 |

**設計原則：** 所有後台可設定的參數統一存此表，避免散落在環境變數中難以管理。

#### product_images（圖片庫）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| url | text | Cloudflare R2 公開 URL |
| name | text | 備註名稱（可為 null，老闆在後台填寫） |
| created_at | timestamp | 建立時間 |

**設計原則：** 圖片上傳後自動存入此表（無論是從商品直接上傳或從圖庫管理頁上傳）。刪除圖片時先從 R2 移除檔案，再刪除此表記錄。

#### product_image_links（商品圖片關聯）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| product_id | uuid FK | 所屬商品（on delete cascade） |
| image_id | uuid FK | 所屬圖片（on delete cascade） |
| position | int | 排列順序（新增時自動累加） |
| created_at | timestamp | 建立時間 |

**Unique constraint：** `(product_id, image_id)` — 同一圖片不可重複關聯至同一商品。

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
8. 填寫訂購人與收貨人資訊：
    - **訂購人**：姓名、聯絡電話（必填）
    - **收貨人**：可勾選「同訂購人」自動帶入；若取消勾選，需另填姓名、電話
    - **收貨地址**：僅取貨方式 `requires_address = true` 時顯示並為必填
9. 確認頁顯示：商品明細 + 商品小計 + 取貨費用 + 總金額 + 付款方式 + 收貨資訊摘要
10. 送出訂單，畫面顯示訂單編號，狀態為「待確認」
11. **待確認期間**：可回 LIFF 修改品項、數量，或取消訂單
12. 老闆確認接單後，狀態變為「製作中」，客戶端鎖定，無法再修改
13. 製作完成後，老闆通知付款（透過 LINE 群組告知）
14. 客戶回 LIFF 查詢頁：
    - **匯款**：依畫面顯示帳號完成 ATM / 網銀匯款，填入後五碼送出
    - **現金**：等待老闆當面收款確認
15. 老闆確認收款後，訂單狀態變為「完成」

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
- 每筆訂單卡片可展開查看取貨方式、訂購人姓名、電話，以及收貨人姓名、電話、地址（有填才顯示）

### 7.2 歷史訂單查詢

**篩選條件（可組合）：**

- Session（下拉選單）
- LINE 名稱（模糊搜尋）
- 訂單狀態（全部 / 完成 / 取消 / 進行中）
- 日期區間（依 `created_at`）

**列表欄位：** 訂單編號、建立時間、LINE 名稱、品項摘要、金額、狀態、取消原因

**可展開詳細資訊（accordion）：** 點擊任一列展開，顯示訂購商品與數量、取貨方式、付款方式、訂購人與收貨人聯絡資訊、客人備注、店家備注

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
- 新增取貨方式（名稱、說明、費用、允許付款方式、是否需要收貨地址、排列順序）
- 編輯取貨方式（費用修改只影響新訂單，舊訂單已快照 `pickup_fee`；`requires_address` 修改立即影響新訂單的表單顯示）
- 上架 / 下架（切換 `is_active`，下架後客戶選購頁不顯示）
- 拖曳調整顯示順序

### 7.8 系統設定

具備 `sessions:edit` 權限的人員可操作（入口位於後台 `/admin/settings`）：

- 查看目前所有設定值（key / value / is_public）
- 編輯匯款帳號資訊：`bank_code`（銀行代碼）、`bank_account`（帳號）、`bank_holder`（戶名）
- 儲存後即時生效（LIFF 查詢頁下次呼叫 `/api/settings/public` 即取得最新值）

### 7.9 圖庫管理

後台 `/admin/images` 頁面，無需特定權限（登入後台即可訪問）：

- 以 Grid（4 欄）檢視所有已上傳圖片
- 點擊縮圖開啟 Lightbox 放大檢視
- 點擊備註名稱進行 inline 編輯（Enter 儲存，Escape 取消）
- 刪除圖片（二次確認 Dialog，刪除後同步移除 R2 檔案）
- 點擊「上傳新圖片」開啟 `ImageCropper`（裁切後上傳並自動存入圖庫）

**圖片命名規則：** 備註名稱純屬後台辨識用，不影響 URL 或客戶端顯示。

### 7.10 商品圖片管理

商品圖片功能整合在後台開單詳情頁的商品卡片內：

- 每個商品顯示已關聯的圖片縮圖列（56×42px）
- 點擊縮圖開啟 Lightbox
- 縮圖右上角的 ✕ 按鈕可移除圖片關聯（不刪除圖庫中的圖片）
- 點擊 `+` 按鈕開啟 `ImageCropper`（可上傳新圖片或從圖庫選擇）
- 圖片顯示順序依 `position` 排列（新增時自動追加至末尾）

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
| `/settings/public` | GET | 取得 `is_public = true` 的設定值（如匯款帳號資訊），供 LIFF 查詢頁使用 |
| `/pickup-options` | GET | 取得 active 取貨方式列表；response 含 `requires_address` 欄位，供 LIFF 判斷是否顯示地址欄位 |
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
| `/admin/settings` | GET | 取得所有設定值 |
| `/admin/settings` | PATCH | 更新設定值 |
| `/admin/upload-url` | POST | 發行 Cloudflare R2 預簽 PUT URL（前端直傳 R2，後端不做中轉） |
| `/admin/images` | GET | 取得所有圖庫圖片 |
| `/admin/images` | POST | 新增圖庫記錄（url, name?） |
| `/admin/images/:id` | PATCH | 更新圖片備註名稱 |
| `/admin/images/:id` | DELETE | 刪除圖片（R2 檔案 + DB 記錄） |
| `/admin/products/:id/images` | POST | 新增商品圖片連結 |
| `/admin/products/:id/images/:linkId` | DELETE | 移除商品圖片連結 |

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
| 第十週 | UI 美化（色彩系統、載入動畫、LIFF 手機優先、後台響應式、數字固定寬度） | 整體 UX 提升 |
| 第十一週 | 系統設定（settings 表、設定頁、匯款資訊移至 DB） | 後台自助管理設定 |
| 第十二週 | 商品圖庫（product_images、R2 上傳、ImageCropper、圖庫管理頁） | 商品圖片集中管理 |
| 第十三週 | 多張商品圖片（product_image_links、ProductImageStrip、LIFF 多圖 Slide） | 每個商品展示多張圖片 |
| 第十四週 | 品牌識別（LiffLoader SVG 動畫、config/site.ts、Favicon） | 一致的品牌視覺體驗 |
| 第十五週 | 訂購人與收貨人資訊（orders 新欄位、pickup_options.requires_address、LIFF 填寫資料步驟、後台顯示） | 工作室可追蹤客戶聯絡資訊與收貨地址 |
| 第十六週 | UI 互動優化（後台所有按鈕 hover/active、Sidebar hover、歷史訂單 accordion 詳情、訂單管理取貨方式顯示、LIFF 訂單詳情取貨方式、LiffLoader 彈跳動畫） | 整體互動體驗提升，操作回饋感更清晰 |

---

## 11. UI 設計規格（M10）

### 11.1 設計原則

| 面向 | LIFF（客戶端） | 後台（Admin） |
|------|--------------|-------------|
| 主要裝置 | 手機優先（任何手機動態島尺寸） | 桌機 + 手機雙模式 |
| 設計風格 | 溫暖粉嫩系 | Gmail 系（清晰功能導向） |
| 實作方式 | 純 Tailwind CSS 手刻 | 純 Tailwind CSS 手刻 |

### 11.2 色彩系統

以 CSS custom properties（`@theme`）定義於 `globals.css`，所有元件引用 token，改色只需改一處。

**LIFF 粉嫩系 token：**

| Token | 色碼 | 用途 |
|-------|------|------|
| `--color-liff-bg` | `#FFF8F5` | 頁面底色 |
| `--color-liff-surface` | `#FFFFFF` | 卡片、輸入框底色 |
| `--color-liff-border` | `#F3D0D7` | 邊框 |
| `--color-liff-primary` | `#E8789A` | 主要按鈕、強調色 |
| `--color-liff-primary-hover` | `#D4607F` | 按鈕 hover |
| `--color-liff-accent` | `#F9A8C9` | 次要強調 |
| `--color-liff-text` | `#3D1F2A` | 主要文字 |
| `--color-liff-muted` | `#9C7080` | 次要文字、說明文字 |
| `--color-liff-success` | `#86EFAC` | 成功狀態 |

> **注意：** `--color-liff-primary` 亦作為 LiffLoader SVG 描繪線條的顏色（`stroke="var(--color-liff-primary)"`），改色時同步影響載入動畫外觀。

**Admin Gmail 系 token：**

| Token | 色碼 | 用途 |
|-------|------|------|
| `--color-admin-bg` | `#F6F8FC` | 頁面底色 |
| `--color-admin-surface` | `#FFFFFF` | 卡片、sidebar 底色 |
| `--color-admin-border` | `#E0E0E0` | 邊框 |
| `--color-admin-primary` | `#1A73E8` | 主要按鈕、active 狀態 |
| `--color-admin-primary-hover` | `#1558B0` | 按鈕 hover |
| `--color-admin-text` | `#202124` | 主要文字 |
| `--color-admin-muted` | `#5F6368` | 次要文字 |
| `--color-admin-sidebar-active` | `#D3E3FD` | Sidebar 選中背景 |

### 11.3 LIFF UX 規範

- **版面**：`max-w-md mx-auto`，適配任何手機寬度；padding `p-4`
- **數字顯示穩定性**：購買數量選擇器的數字容器固定寬度（`w-8 text-center tabular-nums`），不因數字增減（1→10）導致 `+` / `-` 按鈕位移
- **載入動畫**：GIF 動圖（`/public/loading-dog.gif`），居中全版顯示於粉嫩底色上
- **最少載入時間**：1.5 秒，使用 `useMinLoading(1500)` hook，避免資料瞬間回來時畫面閃爍

### 11.4 後台 UX 規範

- **桌機佈局**：固定 Sidebar（寬 224px）+ 主內容區域，Sidebar 含品牌名稱與導覽項目
- **手機佈局**：Sidebar 收合，改以頂部導覽列（橫向捲動）呈現
- **Sidebar 導覽項目**：訂單管理 / 開單管理 / 歷史訂單 / 取貨方式 / 人員管理 / 角色權限
- **Active 狀態**：以 `--color-admin-sidebar-active` 背景 + 圓角 pill 標示當前頁面
- **Sidebar hover**：inactive 連結 hover 時顯示 `gray-100` 底色、`gray-600` 文字；active 連結不受影響
- **按鈕互動回饋**：所有可點擊按鈕（含 Link 元素）套用 `hover:brightness-90/95`、`active:brightness-75/90`；disabled 狀態排除 hover 效果（`disabled:hover:brightness-100`）
- **載入動畫**：SVG spinner（`animate-spin`），支援全版頁面（`min-h-screen` 居中）與 inline 兩種模式

### 11.5 LIFF 載入動畫規格（SVG，M16 更新）

**v1.11 更新（M16）：** 動畫由 stroke-dashoffset 描繪改為依序彈跳，路徑以 fill 顯示，19 個圖形依波段 delay 順序逐一彈跳，視覺更俏皮活潑。

| 項目 | 規格 |
|------|------|
| 元件 | `components/liff/LiffLoader.tsx` |
| 動畫方式 | CSS `@keyframes liff-bounce`（`translateY` 0 → −34px → 0 → −17px → 0 → −8px → 0） |
| 路徑數量 | 19 條 SVG path |
| 波段分組 | Wave 1（頂部插圖，0–200ms）/ Wave 2（人物，400–520ms）/ Wave 3（文字，720–1280ms） |
| 週期 | 4200ms（`key={cycle}` + `setInterval` 強制 re-mount） |
| 填色 | `fill="var(--color-liff-primary)"`，`transformBox: fill-box`，`transformOrigin: center` |

**v1.9 更新（M14）：** GIF 動圖改為 SVG `stroke-dashoffset` 路徑描繪動畫（已於 M16 取代）。

**原 GIF 動圖規格（已棄用，M10 設計，M14 取代）：**

| 項目 | 規格 |
|------|------|
| 格式 | GIF 或 APNG |
| 尺寸 | 160 × 160 px（顯示 80px，Retina 清晰）|
| 路徑 | `apps/web/public/loading-dog.gif` |