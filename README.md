# 留格 · IG 主頁排版助理（可點原型）

> 幫你變會拍、會選、會排。不生成任何圖片，照片永遠是你的。

這是純前端的靜態網頁原型，沒有建置步驟，也不接 AI。

- **第 3、4 步**：總評、五個面向、建議和拍攝卡都是寫死的示範內容。
- **格子區偵測**：真的會做。在瀏覽器本地用 canvas 分析像素，找出貼文在哪裡、有幾篇。
- **建議封存**：依偵測結果在本地挑選。
- **截圖分類**（第三輪）：先判斷是手機、電腦、iPad 截圖，手機走「IG App 版型定位」，電腦／iPad 走通用格線偵測。
- **第 5 步**：照片編輯、整個主頁預覽（截圖上半部＋可拖曳的格子）、暫時拿掉／釘選、配樂推薦、zip 打包，全部在瀏覽器本地完成。配樂只出現在這一步。
- **試聽**：只播聲音。推薦的歌用 Apple Music 的 30 秒試聽片段播放（頁面內沒有任何影片框）；沒有 Apple 試聽的歌只給「到 YouTube 聽 ↗」外部連結（新分頁）。

第一輪版本備份在 `_archive/v1/`，第二輪在 `_archive/v2/`，第三輪在 `_archive/v3/`。

## 怎麼打開

**方法一：直接雙擊** `index.html`。所有 JS 都是一般的 `<script>`，`file://` 也能用（Apple 試聽的查詢與音檔在 `file://` 下一般也能用；若被瀏覽器擋，會改顯示「到 YouTube 聽／搜尋 ↗」外部連結）。

**方法二：本機 server**（行為最接近正式環境）

```bash
cd /workspace/ig-layout-app
python3 -m http.server 8765 --bind 127.0.0.1
# 開 http://localhost:8765/
```

頁面不嵌入 YouTube。試聽走 Apple 的公開音檔；本機用 `localhost` 或正式網域開即可。

字體來自 Google Fonts CDN（免費）。離線時會改用系統字體。

## 流程（hash 路由）

| 路由 | 畫面 |
|---|---|
| `#/` | 首頁 |
| `#/upload` | 01 上傳主頁截圖。讀取中顯示細線轉圈「正在讀取主頁…」；完成後顯示「偵測到：手機截圖」＋「手機｜電腦」切換、「找到貼文區：N 篇貼文」 |
| `#/style` | 02 選喜歡的樣子：一張一張看 6 張參考主頁、可複選，按「用這些喜好」後自動歸納方向並直接套用（多種溫度自動七成主色／三成點綴／黑白過渡）；之後只留「換一個方向」 |
| `#/analysis` | 03 分析：分類與切換、偵測框、編號貼文、空格、建議封存；不確定時問「這是手機還是電腦截圖？」；可以手動拖框 |
| `#/next` | 04 下一篇拍什麼 |
| `#/photos` | 05 整理新照片：整個主頁預覽、拖曳換位、拿掉／釘選、配樂（語言切換、試聽、偏好）、zip 下載 |
| `#/music` | 回到第五步的配樂區 |

## 檔案結構

```
index.html              外殼與 script 載入順序（配樂入口只在第五步）
css/style.css           全部樣式；審美 tokens 在 :root
vendor/jszip.min.js     JSZip 3.10.2（本地檔）＋ vendor/jszip-LICENSE.md
vendor/opencc-t2cn.js   opencc-js 瀏覽器版（MIT），歌手搜尋的繁簡轉換。授權見同目錄 opencc-js-LICENSE.txt、opencc-js-Apache-2.0.txt、opencc-js-THIRD_PARTY_LICENSES.md
js/mock-data.js         6 種類型的規則、示範分析、拍攝卡（步驟 2 不再顯示類型卡片，由 style-pick.js 對應）
js/style-pick.js        步驟 2 參考圖定義、歸納方向、混搭規則、換一個方向（圖檔在 assets/style-ref/）
js/music-library.js     內建歌單（曲風、語言、氛圍、youtubeId、itunesPreview；youtubeId 只用於外部連結）
js/artist-aliases.js    歌單歌手的英文名與暱稱
js/fuzzy.js             歌手／歌名模糊比對（子字串、繁簡、錯字、別名）
js/step5.js             第五步排序核心（順序同步、待辦）
js/step5-drag.js        第五步九宮格拖曳
js/music-mood.js        照片情緒（冷暖、明暗、節奏）＋每個曲風推一首最搭的歌（曲風、歌手選填，只做篩選）
js/music.js             配樂偏好（localStorage）；推薦轉呼叫 music-mood.js
js/preview.js           試聽：只播 Apple 30 秒試聽（<audio>）；沒有就給 YouTube 外部連結，不嵌入影片
js/ai.js                AI 接口（目前回傳示範結果）← 之後在這裡接 AI
js/grid.js              色塊九宮格、示範主頁產生器、從截圖裁出既有貼文
js/grid-detect.js       ★ 截圖格子區偵測（獨立模組，測試也呼叫它）
js/editor.js            第 5 步 canvas 編輯、輸出 JPEG、zip 打包
js/app.js               路由與各畫面
tools/lib.mjs           腳本共用：本機 server＋無頭 Chrome
tools/make-fixtures.mjs 產生合成測試截圖與測試照片（全部是色塊）
tools/test-grid-detect.mjs  格線偵測自動測試（PASS/FAIL）
tools/screenshot.mjs    走完整個流程、截全部畫面、做功能檢查（含 zip 的 unzip -t）
tools/fixtures/         測試圖；synth-expect.json 是合成截圖的真實格線座標（含分頁列下緣、導覽列上緣）
tools/music-lookup/     執行方查 YouTube ID 的腳本與結果；verified.json 是唯一的 youtubeId／itunesPreview 來源；
                        check-ids.mjs 比對 music-library.js 與 verified.json（node tools/music-lookup/check-ids.mjs .）
screenshots/            截圖
REVIEW.md               自我審查紀錄
```

## 格線偵測（`js/grid-detect.js`）

全部在瀏覽器本地用 canvas 分析像素，不花 token，也不送網路。第三輪起是**先分類、再偵測**。

### 0. 讀圖（效能）

- `GridDetect.decode(file, objectURL)`：先只解碼拿尺寸，再用 `createImageBitmap(file, { resizeWidth, resizeHeight })` 直接縮到**寬 1080**；不支援時退回 Image＋canvas。原圖只當預覽用的 object URL，主執行緒不處理全解析度像素（iOS Safari canvas 上限約 16.7M 像素）。
- 偵測時畫一次、`getImageData` 一次取完像素；用完 `ImageBitmap.close()`、canvas 寬高設 0。
- 讀取期間顯示「正在讀取主頁…」，按鈕停用；先 `requestAnimationFrame`＋`setTimeout(0)` 讓狀態畫出來再算。
- HEIC 解不開時顯示：「請改用螢幕截圖（PNG），或到 iPhone『設定 › 相機 › 格式』改成『最相容』。」

### A. 分類（`GridDetect.classify`）

- 高÷寬 ≥ 1.7 → 手機；寬 > 高 → 電腦；1.25–1.7 → iPad；1–1.25 → 不確定。
- 高÷寬 1.6–1.7 但同時有頂部狀態列（左時間、右電量）與底部導覽列（5 個等距小 icon）→ 也算手機。
- 畫面顯示「偵測到：手機截圖」與「手機｜電腦」細框分段切換，切換後用快取的像素立刻重跑（`GridDetect.redetect`）。
- 不確定：兩種都試、先用信心高的結果，同時問「這是手機還是電腦截圖？」。兩種都失敗 → 手動拖框。

### B. 手機：IG App 版型定位（不做通用格線搜尋）

1. **找分頁 icon 列**：由上往下找一條細橫帶，內有 3–4 個等距小 icon（中心約在 1/8、3/8、5/8、7/8 或 1/6、1/2、5/6），且只有一個 icon 下方有一條很深（深色模式是很亮）的短底線；底線下若有整條同色的 1px 分隔線也一併算進去。icon 高度用**寬度**當尺度（各機型、裁切過的截圖都適用），沒有寫死任何 y 位置。
2. **貼文區 top** ＝ 分頁列（底線／分隔線）之下；頭像、簡介、按鈕、限動精選都在它上面，不可能被當成貼文。
3. **左右貼齊全寬、三欄等寬**（格縫約 1–3px）。
4. **比例**：在 3:4／4:5／1:1 預期的列縫位置找「差異突然變小」的縫，命中減未命中最高者勝；量不到（例如只有 1 篇、底下全白）就量第一篇的高度；再不行預設 3:4，畫面標「格子比例為推測」。
5. **下緣**停在底部導覽列上緣（沒有導覽列就到圖底），框內每一排都列出，空的標「空格」。
6. **找不到分頁列** → 不硬給框，交給手動拖框；初始框是保守猜測：全寬、圖高 45%～導覽列。

### C. 電腦／iPad：通用格線偵測（第二輪的方法，原樣保留）

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
node tools/test-grid-detect.mjs     # 10 張全部 PASS（也檢查分類、iPhone 框不蓋頭像、左右貼齊、下緣停在導覽列）
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
- **歌單**（`js/music-library.js`）共 85 首，依知識整理。起始段落是「前奏、主歌、副歌、橋段」，另有 `startSec`（人工估計的秒數）。

### 試聽（`js/preview.js`，第四輪：只播聲音）

- **只用 Apple／iTunes 30 秒試聽**：`https://itunes.apple.com/search?term=<歌手 歌名>&entity=song&country=tw&limit=10`（回應帶 `access-control-allow-origin: *`，直接 fetch，8 秒逾時），歌名＋歌手正規化比對後取 `previewUrl`，用一個共用的 `<audio>`（`preload="none"`、`playsinline`）從 0 播到結尾（約 30 秒）自動停止並重置。查詢結果存在記憶體。
- **不顯示任何影片框，不嵌入 YouTube**。每首只有：細線圓形播放／暫停鍵（44×44）＋ 1–2px 可可棕細進度線（底線 `--line`）＋剩餘秒數小字＋「Apple Music 試聽」。載入中按鈕是細線轉圈。
- **沒有 Apple 試聽 → 外部連結**（`target="_blank" rel="noopener"`，絕不編造 ID）：
  - `music-library.js` 的 `itunesPreview`（照 `verified.json` 寫入）為 false 的 3 首（〈Fly Me to the Moon〉、〈Plastic Love〉、〈Spring Day〉）一開始就顯示「到 YouTube 聽 ↗」→ `https://www.youtube.com/watch?v=<youtubeId>&t=<startSec>s`。
  - 執行期查不到／比對不到／音檔載入錯誤：有已驗證 `youtubeId` →「到 YouTube 聽 ↗」；`youtubeId` 為 null（〈董小姐〉）→「到 YouTube 搜尋 ↗」（`results?search_query=歌名 歌手`）。
  - `startSec` 只用在連結的 `t=`，畫面標「從建議段落開始（人工估計）」。
- **iPhone Safari**：不自動播放；`audio.play()` 只在點擊播放鍵的處理中呼叫。推薦區出現時先查好 previewUrl（只查不播），點擊時同步 `play()`；若還沒查好，點擊當下先 `load()` 解鎖 `<audio>`，查到再播；被拒（`NotAllowedError`）就顯示「再按一次播放」。
- **同時只播一首**；按另一首、換一組、不喜歡、換頁、推薦區被重畫或移除、`visibilitychange` 隱藏、`pagehide` 時立刻 `pause()` 並重置。
- **設定頁「喜歡的歌」**：只用 Apple 試聽；沒有就顯示「沒有找到試聽」＋「到 YouTube 搜尋 ↗」，不播 YouTube、不用 AI。

## 第 5 步「暫時拿掉」（模擬封存，不會真的刪除）

- 九宮格預覽裡每一張**既有貼文**右上有「拿掉」（點擊區 44×44）；分析頁標「建議封存」的那幾格會加小標「建議拿掉」。新照片仍用原本的 ×。
- 拿掉後，其餘既有貼文依原始順序往前補位；底部跳出細框米白提示「已拿掉原第 n 格・復原」（5 秒）。
- 預覽下方的「已拿掉」區：縮圖、「原第 n 格」、「恢復」（依原始索引排回原位，不是補到最後）、標題列的「全部還原」。
- 一行小字：「這只是模擬封存的預覽，不會動到你的 IG，也不會刪除相簿裡的照片。」
- **存在本機**：
  - `localStorage['liuge.archived.v1'] = { v:1, src:'檔名|寬x高'（或 demo-placeholder）, removed:[原始索引…] }`，來源不同就不套用。
  - `sessionStorage['liuge.shot.v1']`：分析用的縮小截圖（寬 ≤ 1080 的 JPEG dataURL）、分類切換與手動框。重新整理後自動還原截圖、重新偵測，第 5 步預覽仍是拿掉後的樣子；存不下時只保留已拿掉的索引。
  - 新照片本身不保存（重新整理後要重新選）。

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

```bash
ONLY=iphone,perf,archive,music node tools/screenshot.mjs   # 只跑第三輪新增的流程
```

腳本會自己啟動本機 server（以 `http://localhost:8765` 開，原因見上），結束時關閉。它會檢查以下項目：

- page error、console error、失敗的請求、水平溢出
- 輸出的 JPEG 尺寸、色溫有沒有真的改變像素
- 封存標記、配樂偏好有沒有存進 localStorage、喜歡和不喜歡、zip
- iPhone 截圖：分類、框在分頁列下、全寬、手動框初始位置、切換手機／電腦、不確定時的提問
- 暫時拿掉：索引、toast 復原、恢復回原位、重新整理後保留、全部還原
- 試聽：Apple previewUrl 是否真的播放、沒有自動播放、暫停／繼續、播完自動停止重置、同時只播一首、換一組／推薦區移除／換頁停止、iTunes 失敗時的外部連結（watch／search）、無 Apple 試聽歌的連結、設定頁找不到的歌、畫面沒有 iframe／video
- 效能：1179×2556 與 1290×2796 從選檔到偵測完成的時間
