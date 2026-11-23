# 留格 · IG 主頁排版助理（可點原型）

> 幫你變會拍、會選、會排。不生成任何圖片，照片永遠是你的。

這是純前端的靜態網頁原型，沒有建置步驟，也不接 AI。

- **第 3、4 步**：總評、五個面向、建議和拍攝卡都是寫死的示範內容。
- **格子區偵測**：真的會做。在瀏覽器本地用 canvas 分析像素，找出貼文在哪裡、有幾篇。
- **建議封存**：依偵測結果在本地挑選。
- **第 5 步**：照片編輯、照片氛圍、配樂推薦、zip 打包，全部在瀏覽器本地完成。

第一輪版本備份在 `_archive/v1/`。

## 怎麼打開

**方法一：直接雙擊** `index.html`。所有 JS 都是一般的 `<script>`，`file://` 也能用。

**方法二：本機 server**（行為最接近正式環境）

```bash
cd /workspace/ig-layout-app
python3 -m http.server 8765 --bind 127.0.0.1
# 開 http://127.0.0.1:8765/
```

字體來自 Google Fonts CDN（免費）。離線時會改用系統字體。

## 流程（hash 路由）

| 路由 | 畫面 |
|---|---|
| `#/` | 首頁 |
| `#/upload` | 01 上傳主頁截圖。上傳後立刻偵測，顯示「找到貼文區：N 篇貼文」 |
| `#/style` | 02 選類型（6 種） |
| `#/analysis` | 03 分析：截圖上會畫出偵測框、編號貼文、標出空格和建議封存的格子，也可以手動拖框 |
| `#/next` | 04 下一篇拍什麼 |
| `#/photos` | 05 整理新照片，包含配這組照片的歌、zip 下載、逐張下載 |
| `#/music` | 配樂偏好。沒有偏好時是建立流程，有偏好時是設定頁。從 header 的音符圖示進入 |

## 檔案結構

```
index.html              外殼：header（含配樂入口）、script 載入順序
css/style.css           全部樣式；審美 tokens 在 :root
vendor/jszip.min.js     JSZip 3.10.2（本地檔）＋ vendor/jszip-LICENSE.md
js/mock-data.js         6 種類型的規則、示範分析、拍攝卡
js/music-library.js     內建歌單 85 首（曲風、氛圍標籤、建議起始段落）
js/music.js             配樂偏好（localStorage）、照片氛圍計算、推薦計分
js/ai.js                AI 接口（目前回傳示範結果）← 之後在這裡接 AI
js/grid.js              色塊九宮格、示範主頁產生器、從截圖裁出既有貼文
js/grid-detect.js       ★ 截圖格子區偵測（獨立模組，測試也呼叫它）
js/editor.js            第 5 步 canvas 編輯、輸出 JPEG、zip 打包
js/app.js               路由與各畫面
tools/lib.mjs           腳本共用：本機 server＋無頭 Chrome
tools/make-fixtures.mjs 產生合成測試截圖與測試照片（全部是色塊）
tools/test-grid-detect.mjs  格線偵測自動測試（PASS/FAIL）
tools/screenshot.mjs    走完整個流程、截全部畫面、做功能檢查（含 zip 的 unzip -t）
tools/fixtures/         測試圖；synth-expect.json 是合成截圖的真實格線座標
screenshots/            截圖
REVIEW.md               自我審查紀錄
```

## 格線偵測（`js/grid-detect.js`）

全部在瀏覽器本地用 canvas 分析像素，不花 token，也不送網路。

1. **估背景色**：取截圖四邊的像素，量化後取眾數。淺色和深色模式都適用，`theme` 也由這一步判斷。
2. **找出非背景的像素**：和背景色的最大通道差超過門檻（深色模式 6、淺色模式 8）就算。另外建一張積分圖，之後任何矩形都能 O(1) 求和。
3. **切橫帶**：逐列投影，用整列都是背景的列把畫面切成一條條橫帶。頭像、簡介、按鈕、精選動態、分頁列、每一排貼文，各自會落在不同的橫帶。
4. **切方塊**：每條橫帶再做欄投影，切出方塊，並找出真正的上下緣。上下緣要求連續 3 列成立，避免把分頁列的底線算進去。照片內部偶爾會有一整列接近背景色，所以也會試著把相鄰橫帶合併後再切一次。
5. **提出假設並打分**：每個大方塊都會提出幾組假設，內容是欄寬、比例（3:4、4:5、1:1）、左緣和縫寬。分數看這組假設能解釋幾格「3 欄等寬」的貼文，同一格只算一次。
   - 頭像、按鈕、精選動態對不上 3 欄等寬的格子，自然會被排除。
   - 左緣是從方塊位置推出來的，所以電腦版、iPad 的左右留邊會自動排除。
6. **排格子**：從格子區頂端往下排，每排會吸附到實際偵測到的上緣。往下掃到連續一段整排幾乎都是背景時就停，例如底部導覽列，或是完全沒有貼文的一排。
7. **判斷有沒有貼文**：取格子內縮 8% 的範圍。非背景比例 ≥ 15%，或非背景比例 ≥ 3% 且亮度標準差 ≥ 10，才算有貼文。空格不算。
8. **信心分數**：低於 0.6 時，畫面會請使用者手動拖框。
   - 手動拖框：框的四邊、四角、整個框都能拖（用 pointer events，手機觸控也能用），也可以用方向鍵移動。
   - 框內會即時顯示 3 欄格線，比例可以切換。
   - 按「套用」後，由 `GridDetect.fromFrame()` 依框重新判斷每格有沒有貼文。

**建議封存**（`GridDetect.pickArchive`）：

- 格數依貼文數決定：≤ 5 篇不建議封存，6–11 篇封存 1 格，≥ 12 篇封存 2 格。
- 只從真的有貼文的格子裡挑。挑法是看 Lab 色彩和整頁平均的色差，再加上彩度突兀的程度，分數最高的入選。
- 原因文字依「偏冷／偏暖、偏暗／偏亮、飽和度」自動組合，畫面上標「示範內容」。
- 示範截圖也走同一套偵測流程。

**測試**：

```bash
mkdir -p /tmp/shot && cd /tmp/shot && npm init -y && npm i puppeteer-core
cd /workspace/ig-layout-app
node tools/make-fixtures.mjs        # 產生合成截圖（只需一次）
node tools/test-grid-detect.mjs     # 6 張全部 PASS
```

## 配樂推薦

留格不會、也不能把歌加進 IG，只做推薦。

- **偏好**：存在 `localStorage['liuge.music.v1']`，內容包括曲風、歌手、歌、分析句、喜歡和不喜歡的紀錄。
- **建立偏好**有兩個分頁：
  - (a) 複選 10 種曲風，再加上歌手標籤。
  - (b) 填 3–5 首歌，然後由 `AI.analyzeMusicTaste(songs)` 推測曲風。目前是示範：比對內建歌單的歌手和歌名，比不到就給預設，並有假延遲。之後在 `js/ai.js` 接 AI。
- **照片氛圍**：從第 5 步各照片套用調色後的縮圖計算，看平均亮度、R−B 和 HSV 飽和度，歸類成「暖亮、暖沉、冷靜、暗夜、柔和、鮮明」其中一種。
- **推薦計分**：
  - 曲風符合 +3，喜歡的歌手 +4，自己填過的歌手 +2。
  - 照片氛圍：冷暖符合 +1.5，明暗符合 +1.5，節奏符合 +1。
  - 喜歡的同曲風歌每首 +0.8（上限 2.4）。
  - 不喜歡的歌直接排除；同歌手每首不喜歡的歌 −2.5。
  - 加一點固定雜訊；同一組裡不重複歌手。
  - 「換一組」會換雜訊種子，並避開剛推過的歌。
- **歌單**（`js/music-library.js`）共 85 首，依知識整理，**沒有上網逐首核對**。起始段落只寫「前奏、主歌、副歌、橋段」，不寫秒數。

## zip 下載

- 用 **JSZip 3.10.2**：用 `npm pack jszip` 取得，`dist/jszip.min.js` 複製到 `vendor/jszip.min.js`。
  - JSZip 是 MIT／GPLv3 雙授權，檔頭的授權註解原樣保留，完整授權在 `vendor/jszip-LICENSE.md`。
  - 用 `<script>` 引入本地檔，不依賴網路。
- 打包方式：JPEG 本身已經壓縮，所以用 STORE（不再壓縮）。檔名是 `留格_YYYYMMDD.zip`，裡面依目前順序放 `01.jpg…`（1080×1350）。
- 截圖腳本會實際觸發下載，並用 `unzip -t` 驗證。

## AI 接口在哪

`js/ai.js` 掛在 `window.AI` 底下，目前都回傳示範資料：

```js
AI.analyzeProfile(screenshot, styleId)  // → { summary, dims[5], tips[3] }
AI.suggestNextShot(analysis, styleId)   // → Shot[]（2–3 組）
AI.analyzeMusicTaste(songs)             // → { sentence, genres[], matched, isMock }
```

格子位置和建議封存**不靠 AI**，由 `js/grid-detect.js` 在本地完成。

## 重跑截圖

```bash
node tools/screenshot.mjs             # 全部（約 2 分鐘）
ONLY=bugfix node tools/screenshot.mjs # 只跑 bug 修正證明
```

腳本會自己啟動 `127.0.0.1:8765`，結束時關閉。它會檢查以下項目：

- page error、console error、失敗的請求、水平溢出
- 輸出的 JPEG 尺寸、色溫有沒有真的改變像素
- 封存標記、配樂偏好有沒有存進 localStorage、喜歡和不喜歡、zip
