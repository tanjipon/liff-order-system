# Ditto Cake 訂購系統｜維運手冊

**版本：** v1.0  
**最後更新：** 2026-05  
**適用環境：** demo、production

---

## 目錄

1. [環境架構總覽](#1-環境架構總覽)
2. [初次建立 Demo 環境](#2-初次建立-demo-環境)
3. [初次建立 Production 環境](#3-初次建立-production-環境)
4. [資料庫備份計畫](#4-資料庫備份計畫)
5. [版本管理規則](#5-版本管理規則)
6. [版本更新 SOP](#6-版本更新-sop)
7. [Rollback SOP](#7-rollback-sop)
8. [日常維運清單](#8-日常維運清單)

---

## 1. 環境架構總覽

```
local（開發）→ demo（驗收）→ production（正式）
```

| 項目 | local | demo | production |
|------|-------|------|-----------|
| Next.js | `npm run dev` | Vercel Preview | Vercel Production |
| Supabase | Docker（`supabase start`） | 獨立 project | 獨立 project |
| Cloudflare R2 | 不需要（測試用本地） | 獨立 bucket | 獨立 bucket |
| LINE LIFF | mock / 不需要 | 獨立 LIFF app | 正式 LIFF app |
| 資料 | 隨時可清 | 測試資料 | 真實客戶資料 |

**重要原則：**
- demo 和 production 的 Supabase、R2、LIFF **完全獨立**，資料不互通
- Production DB 只有在 **版本更新 SOP** 的步驟內才允許直接操作
- 任何 migration 都必須先在 demo 環境驗證過才能到 production

---

## 2. 初次建立 Demo 環境

### 2.1 Supabase

1. 前往 [supabase.com](https://supabase.com) → New Project
2. 命名：`ditto-cake-demo`，選擇離台灣最近的 region（`ap-northeast-1` Tokyo）
3. 記下以下三個值（Settings → API）：
   ```
   Project URL     → NEXT_PUBLIC_SUPABASE_URL
   anon key        → NEXT_PUBLIC_SUPABASE_ANON_KEY
   service_role key → SUPABASE_SERVICE_ROLE_KEY（勿外洩）
   ```
4. 取得 DB 連線字串（Settings → Database → Connection string → URI）：
   ```
   postgresql://postgres:[password]@[host]:5432/postgres
   → 存為 DEMO_DB_URL（只在本地終端使用，不放 GitHub Secrets）
   ```
5. 套用所有 migration：
   ```bash
   supabase db push --db-url "postgresql://postgres:[password]@[host]:5432/postgres"
   ```
6. 執行 RBAC seed（如 migration 未包含）：
   ```bash
   psql "$DEMO_DB_URL" -f supabase/migrations/004_rbac_seed.sql
   ```
7. 建立 owner 帳號：
   - Supabase Dashboard → Authentication → Users → Add user
   - 填入 Email + 密碼，記下 User UUID
   ```sql
   -- 在 Supabase SQL Editor 執行
   INSERT INTO user_roles (user_id, role_id, display_name)
   VALUES (
     '[owner-uuid]',
     '00000000-0000-0000-0000-000000000001',  -- owner role seed ID
     '老闆姓名'
   );
   ```
8. Settings → Authentication → 關閉「Confirm email」（讓邀請信直接生效）

### 2.2 Cloudflare R2

1. 前往 Cloudflare Dashboard → R2 → Create bucket
2. 命名：`ditto-cake-demo`
3. 建立 Custom Domain（或使用 R2 Public URL）→ 記下公開網域
4. 建立 API Token（My Profile → API Tokens → Create Token）：
   - 選擇 R2 Read & Write
   - 記下：
     ```
     Access Key ID     → R2_ACCESS_KEY_ID
     Secret Access Key → R2_SECRET_ACCESS_KEY
     Account ID        → 在 R2 首頁右側可見 → R2_ACCOUNT_ID
     ```
5. R2 Endpoint 格式：
   ```
   https://[account-id].r2.cloudflarestorage.com
   → R2_ENDPOINT
   ```
6. 設定 Bucket CORS（允許前端上傳）：
   ```json
   [
     {
       "AllowedOrigins": ["https://[your-vercel-demo-url]"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

### 2.3 LINE LIFF（Demo）

1. 前往 [LINE Developers Console](https://developers.line.biz)
2. 選擇你的 Provider → 建立新的 Channel（LINE Login）
3. Channel 名稱：`Ditto Cake Demo`
4. 在 Channel 內 → LIFF → Add
   - 名稱：`Demo Order`
   - Size：Full
   - Endpoint URL：`https://[vercel-preview-url]/liff/order`（先填暫時的，Vercel 建好後更新）
5. 記下 LIFF ID → `NEXT_PUBLIC_LIFF_ID`
6. Scope 勾選：`profile`、`openid`

### 2.4 Vercel（Demo）

1. 前往 [vercel.com](https://vercel.com) → Import Git Repository
2. 選擇此 repo → Framework: Next.js → Root: `apps/web`
3. 環境變數設定（Settings → Environment Variables），選擇 **Preview** 環境：

```
NEXT_PUBLIC_SUPABASE_URL        = [demo supabase url]
NEXT_PUBLIC_SUPABASE_ANON_KEY   = [demo anon key]
SUPABASE_SERVICE_ROLE_KEY       = [demo service role key]
NEXT_PUBLIC_LIFF_ID             = [demo liff id]
R2_ACCESS_KEY_ID                = [demo r2 access key]
R2_SECRET_ACCESS_KEY            = [demo r2 secret]
R2_ENDPOINT                     = [r2 endpoint]
R2_BUCKET_NAME                  = ditto-cake-demo
NEXT_PUBLIC_R2_PUBLIC_URL       = https://[demo-r2-domain]
```

4. Push `feature` branch → Vercel 自動建立 Preview URL
5. 回到 LINE Developers → 將 Endpoint URL 更新為正確的 Vercel Preview URL

### 2.5 後台初始設定

登入後台 `https://[vercel-url]/admin`，進入系統設定頁面：
- 填入匯款帳號（`bank_code`、`bank_account`、`bank_holder`）
- 確認店名顯示正確

---

## 3. 初次建立 Production 環境

流程與 Demo 相同，以下列出差異點：

### 3.1 Supabase（Production）

- 命名：`ditto-cake`（或 `ditto-cake-prod`）
- **建議升級 Pro 方案**（$25/月）以取得自動每日備份；Free 方案需依賴第四節的手動備份
- DB URL 存為 `PROD_DB_URL`（**只存本地，不放任何線上系統**）

### 3.2 Cloudflare R2（Production）

- Bucket 命名：`ditto-cake`
- CORS 設定的 `AllowedOrigins` 改為正式 Vercel 網域

### 3.3 LINE LIFF（Production）

- 可在同一個 Channel 下建立新的 LIFF，或建立獨立 Channel
- Endpoint URL 指向 Vercel Production URL

### 3.4 Vercel（Production）

Demo 和 Production 共用**同一個 Vercel 專案**，透過環境變數區分：

```
feature branch push → Vercel Preview URL（demo）  ← 持續存在
main branch push    → Vercel Production URL（正式）← 持續存在
```

**環境變數分開設定：**

Vercel → Settings → Environment Variables，每個變數可勾選「Production」或「Preview」分別填值：

| 環境變數 | Production | Preview（demo） |
|---------|-----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | production DB URL | demo DB URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | production key | demo key |
| `SUPABASE_SERVICE_ROLE_KEY` | production key | demo key |
| `NEXT_PUBLIC_LIFF_ID` | 正式 LIFF ID | demo LIFF ID |
| `R2_ACCESS_KEY_ID` | production R2 key | demo R2 key |
| `R2_SECRET_ACCESS_KEY` | production R2 secret | demo R2 secret |
| `R2_ENDPOINT` | 同（共用 Cloudflare account） | 同 |
| `R2_BUCKET_NAME` | `ditto-cake` | `ditto-cake-demo` |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | production R2 網域 | demo R2 網域 |

**GitHub Secrets 設定**（供 CI/CD workflow 使用）：

前往 GitHub → Settings → Secrets and variables → Actions：

```
VERCEL_TOKEN        = [Vercel Personal Access Token]
VERCEL_ORG_ID       = [Vercel Team/Org ID]
VERCEL_PROJECT_ID   = [Vercel Project ID]
PROD_DB_URL         = [production DB connection string]（備份 workflow 用）
R2_ENDPOINT         = https://[account-id].r2.cloudflarestorage.com
R2_BUCKET_NAME      = ditto-cake（production bucket）
R2_ACCESS_KEY_ID    = [R2 API token]
R2_SECRET_ACCESS_KEY = [R2 API secret]
```

> Vercel Token 在 Vercel → Account Settings → Tokens 建立；Org ID 和 Project ID 可在 Vercel 專案的 `.vercel/project.json` 或 Dashboard 的 Settings 找到。

**手動 Deploy（不依賴 branch push）：**

```
GitHub → Actions → Deploy → Run workflow
  └── 選擇 environment：
        preview    → 部署目前 feature branch 到 demo URL
        production → 部署目前 main branch 到正式 URL
```

> 通常不需要手動觸發；push branch 會自動觸發對應環境的 deploy。手動觸發適合需要強制重新 deploy 但沒有新 commit 的情況。

### 3.5 驗證清單

首次 production deploy 完成後確認：

```
□ /admin/login 可以登入
□ 後台系統設定：匯款帳號填寫完成
□ /liff/order 在 LINE app 內可正常開啟（非瀏覽器）
□ 完整走一次訂購流程（下單 → 後台接單 → 付款 → 完成）
□ 圖片上傳功能正常（R2 連線正確）
□ R2 CORS 設定正確（圖片可公開讀取）
```

---

## 4. 資料庫備份計畫

### 4.1 自動備份 Workflow

`.github/workflows/backup.yaml` 每天凌晨 2:00（台灣時間）自動備份 production DB，上傳至 R2 `backups/` 並保留 GitHub artifact 30 天。

所需 GitHub Secrets（與 3.4 節共用，已設定過可跳過）：

```
PROD_DB_URL          = postgresql://postgres:[password]@[host]:5432/postgres
R2_ENDPOINT          = https://[account-id].r2.cloudflarestorage.com
R2_BUCKET_NAME       = ditto-cake
R2_ACCESS_KEY_ID     = [R2 API token]
R2_SECRET_ACCESS_KEY = [R2 API secret]
```

備份檔命名格式：`backup-YYYYMMDD-HHMM.dump`，存放於 R2 `backups/` prefix。

建立 `.github/workflows/backup.yaml`，每天凌晨 2:00（台灣時間）自動備份 production DB，並上傳至 R2：

```yaml
name: DB Backup

on:
  schedule:
    - cron: '0 18 * * *'  # UTC 18:00 = 台灣 02:00
  workflow_dispatch:       # 允許手動觸發（版本更新前使用）

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install PostgreSQL client
        run: sudo apt-get install -y postgresql-client

      - name: Dump database
        run: |
          pg_dump "${{ secrets.PROD_DB_URL }}" \
            --no-owner --no-acl \
            --format=custom \
            -f backup-$(date +%Y%m%d-%H%M).dump
        env:
          PGPASSWORD: ""  # 已包含在 PROD_DB_URL 內

      - name: Upload to R2
        run: |
          curl -X PUT \
            "https://${{ secrets.R2_ACCOUNT_ID }}.r2.cloudflarestorage.com/ditto-cake/backups/backup-$(date +%Y%m%d-%H%M).dump" \
            --aws-sigv4 "aws:amz:auto:s3" \
            --user "${{ secrets.R2_ACCESS_KEY_ID }}:${{ secrets.R2_SECRET_ACCESS_KEY }}" \
            --upload-file backup-$(date +%Y%m%d-%H%M).dump

      - name: Upload as GitHub artifact (30 day retention)
        uses: actions/upload-artifact@v4
        with:
          name: db-backup-${{ github.run_id }}
          path: "*.dump"
          retention-days: 30
```

> 備份存放策略：R2 `backups/` prefix 保留所有備份；GitHub artifact 自動 30 天後刪除。
> R2 備份可手動定期清理，建議保留最近 90 天。

### 4.2 手動備份（版本更新前必做）

```bash
# 在本地執行，備份存到本機
pg_dump "$PROD_DB_URL" \
  --no-owner --no-acl \
  --format=custom \
  -f "backup-manual-$(date +%Y%m%d).dump"
```

或直接在 GitHub → Actions → DB Backup → Run workflow 手動觸發。

### 4.3 備份還原

```bash
# 還原到指定 DB（會覆蓋現有資料，謹慎操作）
pg_restore \
  --no-owner --no-acl \
  -d "$PROD_DB_URL" \
  backup-20260513.dump
```

---

## 5. 版本管理規則

### 5.1 版本號格式

採用 `vMAJOR.MINOR.PATCH`：

| 類型 | 何時遞增 | 範例 |
|------|---------|------|
| MAJOR | 破壞性架構改動（極少） | v2.0.0 |
| MINOR | 新 milestone 上線 | v1.1.0 |
| PATCH | hotfix、文件、小修正 | v1.1.1 |

### 5.2 Tag 命名與建立

```bash
# merge to main 後執行
git tag v1.1.0 -m "M16: UI interaction polish"
git push origin v1.1.0
```

### 5.3 GitHub Release

每個 tag 在 GitHub 建立 Release，記錄以下資訊：

```markdown
## v1.1.0 — 2026-05-13

### 新功能
- 後台所有按鈕 hover/active 效果（M16）
- 歷史訂單 accordion 詳情展開
- LiffLoader 彈跳動畫

### Bug 修正
- 修正 create_order RPC 缺少聯絡資訊參數

### DB Migrations
- 無（此版本無 schema change）

### Rollback 方式
- 無 schema change → 直接 Vercel rollback 即可，不需處理 DB
```

**Release 內「DB Migrations」和「Rollback 方式」是最重要的資訊**，決定 rollback 時是否需要動 DB。

### 5.4 版本對應表（持續維護）

| Tag | 日期 | Migrations | 有無 Schema Change | Rollback 方式 |
|-----|------|-----------|-------------------|--------------|
| v1.0.0 | 2026-05-xx | 001–012 | ✅ 有 | 需還原 DB |
| v1.1.0 | 2026-05-13 | 無新增 | ❌ 無 | Vercel rollback |

---

## 6. 版本更新 SOP

### 6.1 有 Schema Change 的版本

```
步驟 1：在 demo 環境驗證 migration
  └── supabase db push --db-url "$DEMO_DB_URL"
  └── 走一次完整訂購流程確認功能正常

步驟 2：手動觸發備份
  └── GitHub → Actions → DB Backup → Run workflow

步驟 3：對 production DB 執行 migration
  └── supabase db push --db-url "$PROD_DB_URL"
  └── 若失敗 → 立即執行 Rollback SOP 7.2

步驟 4：merge PR → main
  └── CI 通過後 merge
  └── deploy.yaml 自動觸發 Vercel deploy

步驟 5：驗收
  └── 確認後台功能正常
  └── 確認 LIFF 功能正常

步驟 6：打 tag
  └── git tag v1.x.0 -m "說明"
  └── git push origin v1.x.0
  └── 在 GitHub 建立 Release，註記此版本有 schema change
```

### 6.2 無 Schema Change 的版本

```
步驟 1：merge PR → main（CI 通過後）
步驟 2：Vercel 自動 deploy
步驟 3：驗收
步驟 4：打 tag + 建立 GitHub Release（註記無 schema change）
```

### 6.3 Migration 的安全原則

**加法（最安全，直接執行）：**
```sql
-- 新增欄位，允許 NULL 或有 DEFAULT
ALTER TABLE orders ADD COLUMN new_field text;
```

**修改現有欄位（分兩次 deploy）：**
```sql
-- Deploy N：加欄位但允許 NULL，backfill 舊資料
UPDATE orders SET new_field = '' WHERE new_field IS NULL;

-- Deploy N+1（下一版）：才收緊 constraint
ALTER TABLE orders ALTER COLUMN new_field SET NOT NULL;
```

**刪除欄位（分兩次 deploy）：**
```
Deploy N：先從 code 移除所有對該欄位的引用
Deploy N+1（下一版）：才執行 DROP COLUMN
```

**永遠不要在同一個 deploy 同時移除 code 引用 + DROP COLUMN。**

---

## 7. Rollback SOP

### 7.1 無 Schema Change 的 Rollback（最常用）

```
方法 A：Vercel Dashboard（最快，30 秒）
  └── Vercel → Deployments → 找到目標版本的 deployment
  └── 點選「...」→「Promote to Production」

方法 B：git revert（乾淨，有記錄）
  └── git revert <bad-commit-hash>
  └── git push origin main
  └── CI/CD 自動 deploy
```

### 7.2 有 Schema Change 的 Rollback

```
步驟 1：先確認備份存在
  └── 確認最近一次備份時間（GitHub Actions → DB Backup 最後執行時間）

步驟 2：Vercel rollback code
  └── Vercel → Deployments → Promote 上一個版本

步驟 3：還原 DB（若 migration 造成資料損壞）
  └── pg_restore --no-owner --no-acl -d "$PROD_DB_URL" backup-YYYYMMDD.dump
  └── ⚠️ 此操作會覆蓋現有資料，執行前再次確認備份日期

步驟 4：驗收確認
  └── 確認系統功能回到上一版狀態
  └── 通知相關人員
```

### 7.3 判斷流程

```
系統出問題
  ↓
查 GitHub Release：這版有無 schema change？
  ├── 無 → Vercel rollback（方法 A 或 B）
  └── 有 → 評估 migration 是加法還是破壞性
             ├── 加法（新增欄位）→ 通常 Vercel rollback 即可（舊 code 忽略新欄位）
             └── 破壞性（刪除、改型別）→ 需還原 DB（步驟 7.2）
```

---

## 8. 日常維運清單

### 8.1 每次開單前確認

```
□ session 設定正確（opens_at、per_person_limit、商品庫存）
□ 取貨方式費用正確
□ 用 demo 環境走一次完整訂購流程
□ 後台訂單管理頁面正常載入
```

### 8.2 定期確認（每月）

```
□ Supabase 用量（Dashboard → Usage）：DB 容量 < 400MB（Free 上限 500MB）
□ Vercel 用量（Dashboard → Usage）：Bandwidth < 80GB（Free 上限 100GB）
□ R2 用量（Cloudflare Dashboard）：Storage < 8GB（Free 上限 10GB）
□ GitHub Actions 用量：Minutes < 1800 min/月（Free 上限 2000 min）
□ 清理 R2 backups/ 中超過 90 天的備份
```

### 8.3 資源用量警戒線與對策

| 資源 | 免費上限 | 警戒線 | 對策 |
|------|---------|--------|------|
| Supabase DB | 500MB | 400MB | 升 Pro（$25/月）或清理舊 order_items |
| Vercel Bandwidth | 100GB/月 | 80GB | 升 Pro 或優化圖片 CDN |
| R2 Storage | 10GB | 8GB | 清理過舊的備份、壓縮圖片 |
| R2 Requests | 10M/月 | 8M | 極少情況，不用擔心 |

### 8.4 緊急聯絡資源

| 服務 | Status Page | 說明 |
|------|------------|------|
| Supabase | status.supabase.com | DB / Auth 服務狀態 |
| Vercel | vercel-status.com | 部署 / CDN 狀態 |
| Cloudflare | cloudflarestatus.com | R2 / CDN 狀態 |
| LINE Platform | developers.line.biz/ja/status | LIFF / Login 狀態 |
