# 易問 YIWEN — 線上易經起卦與 AI 解卦

問事・起卦・觀變。輸入問題，選擇起卦方式（擲錢幣／時間起卦／自選卦象），
查看本卦、變爻、之卦，再由 AI 以白話解讀並給出行動建議。

## 架構

- 前端：純靜態單頁（`index.html` + `app.js`），Cloudflare Pages 從 GitHub `main` 自動部署
- 後端：`worker/worker.js`（Cloudflare Worker + Workers AI），`POST /divine` 回傳結構化解卦
- 資料：`data/gua.json`（六十四卦經文：卦辭＋爻辭，取自維基文庫周易）、`data/baihua.json`（卦辭白話＋一句啟示）

## 商業模式（v1）

- 每月 3 次免費 AI 解卦（localStorage 計數）
- 超額後進入候補名單；v2 接金流（單次 NT$49／月訂 NT$149）

## 本地開發

直接用瀏覽器開 `index.html` 即可預覽起卦流程（AI 解卦需 Worker 上線）。
