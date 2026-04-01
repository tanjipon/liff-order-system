# 甜點工作室訂購系統規格書

**版本：** v1.0  
**最後更新：** 2025-06  
**性質：** 個人工作室，非正式公司

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
- 以現金匯款為主，避免第三方金流報稅問題
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
    ├── REST API（Auto-generated）
    ├── Auth（LINE ID 驗證）
    └── RLS 規則（防黃牛 / 權限控管）
    ↓
資料層（Supabase PostgreSQL）
    ├── sessions（開單紀錄）
    ├── products（商品資料）
    ├── orders（訂單紀錄）
    └── order_items（訂單品項）
```

---

## 3. 資料庫設計

### 3.1 Schema

#### sessions（開單批次）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| title | text | 開單名稱，例如「六月草莓塔開單」 |
| opens_at | timestamp | 開放訂購時間 |
| closes_at | timestamp | 截止訂購時間 |
| is_active | boolean | 是否開放中 |
| per_person_limit | int | 每人購買上限（件數） |

#### products（商品）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| session_id | uuid FK | 所屬開單批次 |
| name | text | 商品名稱 |
| price | int | 單價（新台幣） |
| stock_qty | int | 剩餘庫存數量 |

#### orders（訂單）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 主鍵 |
| session_id | uuid FK | 所屬開單批次 |
| line_user_id | text | LINE 使用者 ID（防黃牛核心欄位） |
| line_display_name | text | LINE 顯示名稱 |
| status | enum | 訂單狀態（見第 4 節） |
| total_amount | int | 應付總金額（新台幣） |
| remit_last5 | text | 匯款後五碼 |
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

### 3.2 防黃牛 Quota 計算

同一 session 內，依 LINE ID 累加非取消狀態的訂購數量：

```sql
SELECT COALESCE(SUM(oi.quantity), 0)
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.session_id = $session_id
  AND o.line_user_id = $line_user_id
  AND o.status != 'cancelled'
```

- `cancelled` → 釋放 quota，客戶可在同一 session 重新下單
- `completed` → 計入 quota，不重新開放

---

## 4. 訂單狀態機

### 4.1 狀態定義

| 狀態 | 說明 |
|------|------|
| `pending` | 待確認，客戶剛送出訂單 |
| `in_production` | 製作中，老闆已確認接單並分配排單號 |
| `pending_payment` | 待付款，製作完成，等待客戶匯款 |
| `payment_submitted` | 確認付款中，客戶已填入匯款後五碼 |
| `completed` | 完成取貨 |
| `cancelled` | 已取消（含客戶自行取消、老闆拒絕、老闆取消） |

### 4.2 狀態轉移

```
pending → in_production     （老闆接單）
pending → cancelled         （客戶取消 或 老闆拒絕）
in_production → pending_payment    （老闆標記製作完成）
in_production → cancelled          （老闆取消）
pending_payment → payment_submitted（客戶填入匯款後五碼）
pending_payment → cancelled        （老闆取消）
payment_submitted → completed      （老闆確認收款）
```

`payment_submitted` 後不得取消，避免客戶已匯款卻遭取消的糾紛。

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
3. 系統檢查該 LINE ID 是否超過此 session 每人購買上限
4. 瀏覽商品，選擇品項與數量，送出訂單
5. 畫面顯示訂單編號，狀態為「待確認」
6. **待確認期間**：可回 LIFF 修改品項、數量，或取消訂單
7. 老闆確認接單後，狀態變為「製作中」，客戶端鎖定，無法再修改
8. 製作完成後，老闆通知付款（透過 LINE 群組告知）
9. 客戶至 LIFF 查詢頁，依畫面顯示之帳號完成 ATM / 網銀匯款
10. 回 LIFF 填入匯款後五碼送出
11. 老闆確認收款後，訂單狀態變為「完成」

### 5.2 老闆後台流程

1. 新增 session（開單名稱、品項、庫存、每人限購）
2. 複製 LIFF 連結，貼至 LINE 群組開放訂購
3. 後台查看「待確認」訂單列表，審核產能
4. 逐筆點擊「接單」（→ `in_production`，系統分配排單號）或「拒絕」（→ `cancelled`）
5. 完成製作後，點擊「製作完成，通知付款」（→ `pending_payment`）
6. 等待客戶填入匯款後五碼
7. 核對銀行帳戶明細，確認後點擊「確認收款」（→ `completed`）
8. 若需取消（`in_production` 或 `pending_payment`），填寫原因後取消，系統自動釋放庫存與 quota

---

## 6. LIFF 訂單查詢頁邏輯

客戶進入後，以 LINE ID 自動查詢訂單並顯示：

| 訂單狀態 | 顯示內容 | 可操作 |
|----------|----------|--------|
| `pending` | 訂單編號、品項明細 | 「修改訂單」「取消訂單」按鈕 |
| `in_production` | 排單號碼、製作中提示 | 無（鎖定） |
| `pending_payment` | 匯款帳號、應付金額 | 填入匯款後五碼欄位 |
| `payment_submitted` | 等待老闆確認付款 | 無 |
| `completed` | 訂單完成 | 無 |
| `cancelled` | 已取消 / 拒絕原因 | 提供重新下單連結 |

---

## 7. 後台管理功能

### 7.1 進行中訂單

- 待確認列表：顯示 LINE 名稱、品項、數量，可接單 / 拒絕
- 製作中列表：可標記完成、可取消
- 待付款列表：可確認收款、可取消
- 確認付款中列表：可確認收款

### 7.2 歷史訂單查詢（新增）

**篩選條件（可組合）：**

- Session（下拉選單）
- LINE 名稱（模糊搜尋）
- 訂單狀態（全部 / 完成 / 取消 / 進行中）
- 日期區間（依 `created_at`）

**列表欄位：** 訂單編號、建立時間、LINE 名稱、品項摘要、金額、狀態、取消原因

**匯出：** 依目前篩選條件匯出 CSV

### 7.3 開單統計（新增）

每個 session 可查看：

- 總訂單數（完成 / 取消 / 進行中 各佔比）
- 各品項銷售數量
- 總銷售金額 / 平均客單價
- 取消率
- 回購客戶數（跨 session 重複出現的 LINE ID）

---

## 8. API 端點

### 8.1 客戶端

| 端點 | 方法 | 說明 |
|------|------|------|
| `/sessions/active` | GET | 取得目前開放的 session |
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

---

## 9. 安全性設計

### 9.1 防黃牛

- LIFF 自動取得 LINE ID，無法偽造
- 每筆訂單綁定 LINE ID，後端 RLS 強制驗證
- 每次下單前檢查同一 session 的 quota，超過直接拒絕

### 9.2 訂單權限

- 客戶只能操作自己的訂單（以 LINE ID 驗證）
- 後台 API 需獨立驗證老闆身份
- `payment_submitted` 後，前後台均不顯示取消按鈕，後端亦回傳 403

### 9.3 庫存一致性

- 所有涉及庫存變更的操作（新增訂單、修改訂單、取消訂單）皆以資料庫 transaction 執行，避免超賣

---

## 10. 建議開發順序

| 階段 | 內容 | 目標 |
|------|------|------|
| 第一週 | Supabase Schema 建立、RLS 規則、防黃牛邏輯 | 地基建好 |
| 第二週 | LIFF 訂購頁（選購、送出、防黃牛提示） | 客戶可以下單 |
| 第三週 | LIFF 訂單查詢頁（狀態顯示、修改、取消、填匯款碼） | 客戶可以自助查詢 |
| 第四週 | 後台進行中訂單管理（接單、拒絕、完成、取消） | 老闆可以操作 |
| 第五週 | 後台歷史訂單查詢、CSV 匯出、開單統計 | 完整後台 |
