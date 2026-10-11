# 兌換碼系統串接文件（給別的網站用）

這份文件是給「想接兌換碼系統的網站工程師」看的。白話版：你的網站不用自己做會員、做金流，只要會打三支 API，就能賣「密碼」給客人。

## 觀念（先看懂這段）

- **密碼**：你（商家）在發碼後台產生，一組 12 碼（例如 `ABCD-2345-EFGH`），傳給付錢的客人。
- **憑證 token**：客人拿密碼來開通，系統回傳一串 token。這串 token 就是「他有權利」的證明，請存在你自己網站的資料庫，會員登入後綁在他帳號上。
- **單次碼**：token 能用 N 次（扣完即失效）。**月訂碼**：token 在到期日前無限用。
- 錢怎麼收是你家的事（轉帳、LINE Pay 都行），這套系統不碰金流。

## 串接三步驟

### 0. 拿 API key

向系統管理員要一組 API key（長得像 `ppk_live_…`）。之後每一支 API 都要在 HTTP header 帶：

```
Authorization: Bearer ppk_live_….
```

key 有權限區分（開通／查詢／扣次數），拿到的 key 能做什麼，管理員決定。

API 主機：`https://yiwen-api.taicalc.com`

### 1. 開通 — 客人輸入密碼

```
POST /api/v1/redeem
Content-Type: application/json

{ "code": "ABCD-2345-EFGH" }
```

成功回傳：

```json
{ "ok": true, "token": "…", "type": "one_time", "uses_left": 1, "expires_at": 0 }
```

- `type`：`one_time` 單次／`subscription` 月訂
- `uses_left`：單次碼剩餘次數；月訂是 `null`（無限）
- `expires_at`：月訂到期日（unix 秒）；單次碼是 `0`（不靠日期，靠次數）
- **把 `token` 存下來**，綁在客人帳號上。之後查權限、扣次數都用它。

失敗回傳（舉例）：`{"error":"invalid"}`（密碼不對／已用過／過期，一律模糊回應，不會告訴你是壞在哪一種）。

### 2. 查詢 — 客人還有沒有權利

```
GET /api/v1/verify?token=…
```

成功回傳：`{"ok":true,"type":"one_time","uses_left":1,"expires_at":0}`
失效回傳：`{"ok":false,"reason":"invalid_or_expired"}`

每次提供服務前先查一次，沒過就擋下來。

### 3. 扣次數 — 客人用掉一次

```
POST /api/v1/consume
Content-Type: application/json

{ "token": "…" }
```

- 單次碼：扣 1 次，回傳剩餘 `uses_left`；扣完再扣會回 `{"ok":false,"reason":"quota_exhausted"}`（HTTP 409）
- 月訂碼：不扣次數，只確認還有效，回 `{"ok":true,…}`

**重要**：先做完服務再扣，還是先扣再做，由你決定；建議服務成功才扣，失敗不扣（客人不冤）。

## 錯誤碼總表

| HTTP | error | 意思 |
|------|-------|------|
| 401 | `unauthorized` | 沒帶 key 或 key 不對／已撤銷 |
| 403 | `forbidden_scope` | 這組 key 沒開這個權限 |
| 400 | `invalid` | 密碼不對／已用完／過期／已撤銷 |
| 400 | `invalid_hint` | 密碼有 0、O、1、I、L（我們密碼不用這些字，客人抄錯了） |
| 409 | `quota_exhausted` | 次數已用完 |
| 429 | `too_many` | 驗碼太頻繁，同 IP 10 分鐘超過 30 次 |

## 建議的客人流程（參考）

1. 客人在你網站付款（你自己收）。
2. 你把密碼傳給客人（發碼後台產生，或驗證收款後自動產生）。
3. 客人到你網站「輸入密碼」頁開通 → 你後端打 `/api/v1/redeem` → token 存進客人帳號。
4. 客人每次要用服務 → 你後端先 `/api/v1/verify`，通過才給 → 用完打 `/api/v1/consume`。

## 試玩

`demo-integration.html`（跟這份文件同一層）是一個假裝成「別人的網站」的示範頁，拿一組 key 就能實際操作開通→查詢→扣次數。
