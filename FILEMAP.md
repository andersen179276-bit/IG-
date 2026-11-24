# FILEMAP — 功能 → 檔案:主要函式（行號）

最後更新：第五輪第 9 節 A（自動排好推薦版本、拖曳不重建配樂區、步驟 3／4 版面）。每節改完都要更新行號。
載入順序見 `index.html` 的 script 標籤：mock-data → music-library → artist-aliases → fuzzy → **layout-score → step5 → step5-drag → step5-swap → auto-arrange** → music-filter → music → preview → ai → grid → grid-detect → editor → app。

## 第 5 步：排列（九宮格預覽）

| 功能 | 檔案:函式（行號） |
|---|---|
| 順序陣列搬移 | `js/step5.js:14` arrayMove |
| 順序同步（新照片／舊貼文／釘選） | `js/step5.js:23` syncOrder |
| 舊貼文是否被移動過（顯示「已移動」） | `js/step5.js:47` shifted |
| IG 待辦清單文字 | `js/step5.js:64` tasks |
| 對外 API `window.Step5`（建立） | `js/step5.js:102` |
| 版面星數：取樣（canvas／img／色碼，圖片依網址快取） | `js/layout-score.js:18` 區段、`:50` measure |
| 版面星數：相鄰明暗差／色相差／同類相黏 → 0–100 → 1–5 星（門檻 `:10`） | `js/layout-score.js:67` score |
| 版面星數：一句最主要原因、和上次比較（比剛剛好／差／一樣）、星星字串 | `js/layout-score.js:101` reasonOf、`:114` compare、`:120` starText、`:123` window.LayoutScore |
| 版面星數：step5 呼叫端（取樣→計分→只重寫 #layoutScore） | `js/step5.js:81` showScore |
| 版面星數：app 接線（收集每格來源、圖片載好補算；放下／互換／復原才帶比較，scoreCompare；不呼叫 drawPhotos） | `js/app.js:1516` updateLayoutScore、`:1532` scoreSources（每格取樣來源，自動排列共用）、`:1515` scoreCompare；容器 `#layoutScore` 在 `:1371`（格子區正下方） |
| 點選互換：陣列兩格交換（對外 `Step5.arraySwap`） | `js/step5-swap.js:17` arraySwap |
| 點選互換：點一下的判斷（選取／再點同格取消／點另一格互換） | `js/step5-swap.js:27` swapTap |
| 點選互換：選取框＋小勾「已選取」（.is-sel、.pc-sel、#pgrid.is-picking，不重畫） | `js/step5-swap.js:38` markSel |
| 點選互換：互換後兩格約 250ms 小動畫（.is-swapped） | `js/step5-swap.js:13` FLASH_MS、`:55` flashSwap |
| 點選互換：對外 API（arraySwap、swapTap、markSel、flashSwap） | `js/step5-swap.js:67` |
| 點選互換：接線（state.swapSel、提示文字、互換＋toast「已互換第 X 和第 Y 格・復原」） | `js/app.js:35` state.swapSel、`:1662` swapCtx、`:1677` tapCell、`:1678` swapCells |
| 點選互換：只重畫格子＋縮圖列（不重建配樂區） | `js/app.js:1698` redrawAfterSwap、`:1704` refreshStrip |
| 寫入新順序（釘選重算、syncPhotoOrder、recs=null；拖曳與互換共用） | `js/app.js:1638` applyOrder |
| 拖曳：長按門檻 LONG_PRESS_MS（350ms）、殘影選擇器、短按位移 TAP_SLOP（10px） | `js/step5-drag.js:15`–`:17` |
| 拖曳：上一組監聽 prevAbort（模組層） | `js/step5-drag.js:20` |
| 拖曳：全域殘影掃除 | `js/step5-drag.js:23` sweepGhosts |
| 拖曳：格子位置／命中判斷 | `js/step5-drag.js:28` cellRects、`:34` hitIndex |
| 拖曳：綁定入口（onCommit／onTap／onCancel；先 abort 上一組＋清殘影） | `js/step5-drag.js:48` bindDrag、`:59` prevAbort、`:66` on |
| 拖曳：殘影清除（吃參數 d） | `js/step5-drag.js:76` clearGhost(d)（內部） |
| 拖曳：其他格子讓位預覽 | `js/step5-drag.js:94` layout |
| 拖曳：浮動複本跟手 | `js/step5-drag.js:125` pointInGrid、`:130` moveGhost |
| 拖曳：移動＋邊緣自動捲動；觸控拖曳只在同一排內（換排用點選互換） | `js/step5-drag.js:137` onMove |
| 拖曳：開始（複本、虛線落點 .pc-slot、.is-lift、震動） | `js/step5-drag.js:166` start |
| 拖曳：結束／取消（取消不當 tap）／短按（未拖、非取消、位移 < 10px）→ onTap(index, el) | `js/step5-drag.js:203` finish |
| 拖曳：按下（觸控長按計時；drag.index = data-i） | `js/step5-drag.js:221` onDown |
| 拖曳：中斷收尾（touchcancel、blur、visibilitychange） | `js/step5-drag.js:234` abortAll |
| 拖曳：事件綁定（含 contextmenu、dragstart、lostpointercapture） | `js/step5-drag.js:236` |
| 拖曳：對外 API（hitIndex、bindDrag 掛到 Step5） | `js/step5-drag.js:255` |
| 換位置寫入（拖曳放下、鍵盤 ← →；跟互換一樣只 drawGridPreview({keepMusic:true})＋refreshStrip，不重建配樂區） | `js/app.js:1653` commitMove |
| 九宮格互動綁定（鍵盤 Enter／Space 選取互換、Esc 取消、← →；拖曳；短按 → tapCell） | `js/app.js:1724` bindGridDrag |
| 九宮格預覽重畫（只動 #pgrid；`{ keepMusic: true }` 不重建配樂區；會清掉 swapSel 並 markSel(g,null) 清 .is-picking 虛線 `:1436`） | `js/app.js:1431` drawGridPreview |
| 自動排好推薦版本：只在新照片占的格子間重排；≤6 張窮舉（EXHAUST_MAX `:8`）、更多張貪婪＋兩兩互換 | `js/auto-arrange.js:11` evalPerm、`:18` exhaustive、`:35` greedy、`:60` best、`:74` same |
| 自動排好提示列「已幫你排好推薦版本…」＋「改回原本順序」（#autoNote，星數區上方） | `js/auto-arrange.js:79` showNote、`:89` window.AutoArrange；容器 `js/app.js:1370`；CSS `css/style.css:1012` |
| 自動排列接線（state.auto {key,before,manual}；照片組合變了才排、手動排過就不覆蓋；圖片沒載好等 load 再排） | `js/app.js:1554` autoArrange、`:1579` drawAutoNote、`:1591` markManual（commitMove、swapCells 呼叫）；觸發點 drawGridPreview 內 `:1504` |
| 預覽外框＋操作提示 #dragHint（文案 HINT_TEXT、選取中 HINT_PICK；關閉記錄 key v2） | `js/app.js:1331` HINT_TEXT、`:1333` setHint、`:1338` hintHidden、`:1342` gridPreviewShell |
| 仿 IG 版頭（含 .fb-hl） | `js/app.js:1367` headerHTML、`:1398` paintChrome |
| IG 待辦清單 | `js/app.js:1389` drawIgTodo |
| 釘選與順序狀態 | `js/app.js:1290` pinList、`:1297` pinSave、`:1300` keptOldKs、`:1305` ensureOrder、`:1309` syncPhotoOrder |
| 釘選／取消釘選舊貼文 | `js/app.js:1526` pinOld、`:1536` unpinOld |

## 第 5 步：拿掉／還原（模擬封存）

| 功能 | 檔案:函式（行號） |
|---|---|
| 既有貼文清單 | `js/app.js:1016` existingItems |
| localStorage 讀寫 | `js/app.js:1028` archLoad、`:1031` archRemoved、`:1035` archSave |
| 拿掉（toast 帶「復原」） | `js/app.js:1038` archiveOld |
| 恢復單格／全部還原 | `js/app.js:1047` restoreOld、`:1064` restoreAll |
| 「已拿掉」區塊與縮圖 | `js/app.js:1069` oldThumbHTML、`:1072` drawArchived |
| 「拿掉」按鈕 HTML（.pc-rm） | `js/app.js` drawGridPreview 內（`:1450`）；點格子本身不會拿掉 |

## 第 5 步：頁面、照片、編輯、下載

| 功能 | 檔案:函式（行號） |
|---|---|
| 頁面進出 | `js/app.js:904` cleanupPhotos、`:914` viewPhotos |
| 讀取新照片 | `js/app.js:941` addFiles、`:980` makeThumb |
| 既有貼文縮圖（從主頁截圖裁格） | `js/app.js:987` prepareExisting（`:999` 用 `GD.usableCell` 篩選）；`js/grid.js:277` usable、`:281` cropExistingCells；格子 `<img draggable="false">` 在 `js/app.js:1069` oldThumbHTML |
| 排除導覽列碎片（>70% 單色深底＋少數小圖示；cell.navLike） | `js/grid-detect.js:322` navStripStats、`:360` looksLikeNavStrip、`:370` usableCell（對外 `GridDetect.usableCell`） |
| 整頁重畫（會重建配樂區） | `js/app.js:1113` drawPhotos |
| 單張照片編輯器 | `js/app.js:1206` bindEditor（編輯中照片只由上方 .strip 切換）；canvas 處理 `js/editor.js` |
| 下載（單張／zip） | `js/app.js:1544` bindDownloads；`js/editor.js:151` downloadAll、`:183` buildZip |
| 提示訊息（含動作按鈕） | `js/app.js:57` toast |

## 第 5 步：配樂

| 功能 | 檔案:函式（行號） |
|---|---|
| 配樂區 #musicBox | `js/app.js:1694` renderMusicBox、`:1681` currentMood |
| 配樂語言偏好 | `js/app.js:1318` musicLang、`:1325` setMusicLang |
| 未設定偏好時的內嵌設定 | `js/app.js:1824` renderInlineSetup |
| 推薦計分、照片氛圍 | `js/music.js:39` moodOf、`:87` score、`:125` recommend（先呼叫 MusicFilter.split 硬篩，湊不滿 3 首才從 loose 補並標 near）、`:194` genreConflict |
| 曲風硬篩選：華語類判斷（名稱含「華語」或曲庫中全為 zh）、strict／loose 分組、曲風與語言衝突提示文字 | `js/music-filter.js:11` zhGenres、`:24` isZhGenre、`:27` genreHit、`:34` split、`:43` conflict、`:56` window.MusicFilter |
| 歌曲列曲風標籤 .song-g（用該首自己的 genre）、「相近推薦」.song-near、衝突提示 #genreNote（.mf-hint） | `js/app.js:1724`、`:1732`、`:1740`；CSS `css/style.css:999` |
| 內建歌單 | `js/music-library.js:26` s（資料）、`:390` window.MusicLibrary |
| 試聽 | `js/preview.js:98` renderLink、`:117` renderPlayer |
| 模糊比對 | `js/fuzzy.js:82` libraryHits、`:123` itunes；別名 `js/artist-aliases.js` |

## 其他步驟

| 功能 | 檔案:函式（行號） |
|---|---|
| 路由 | `js/app.js:135` render |
| 首頁／上傳／風格／分析／下一篇 | `js/app.js:157` viewHome、`:197` viewUpload、`:473` viewStyle、`:539` viewAnalysis、`:800` viewNext |
| 步驟 3 版面：標題先給結論與動作（analysisVerdict：「先收起第 X 排第 Y 格」）、頂部「看下一篇拍什麼」#toNextTop、三件事在前、「細節：五個面向」在後 | `js/app.js:560` drawAnalysis、`:606` analysisVerdict；CSS `.an-foot-top` `css/style.css:314`、`.nowrap` `:315` |
| 步驟 4 版面：標題直接是「下一篇拍這個：主題」#nextTitle、卡片緊接在下、說明移到卡片後 | `js/app.js:859` drawNext |
| 截圖分析、截圖面板 | `js/app.js:354` analyzeShot、`:614` renderShotPanel |
| 配樂偏好頁 | `js/app.js:1844` viewMusic、`:2102` viewMusicSettings |
| 主頁截圖偵測（找格線、導覽列） | `js/grid-detect.js:796` detectPhone（找不到導覽列 → bottom＝H*0.9、`:818` trimLast）、`:420` detectDesktop、`:625` findNav、`:575` navIconsOk（舊版 5 等分／新版膠囊底、大致等距）、`:599` findNavBand（底部 12% 帶狀區保險）、`:301` contentBottom、`:374` buildCells（`:385` 最後一排 contentBottom）、`:990` window.GridDetect |
| 抽象色塊九宮格 | `js/grid.js` |
| AI mock | `js/ai.js` |
| 給測試用的 `window.__app` | `js/app.js:2259` |

## CSS（`css/style.css`）

| 功能 | 行號 |
|---|---|
| body overflow-x:hidden | `:45` |
| .ph（第 5 步兩欄；手機 minmax(0,1fr) 在 `:994`–`:996`；880 以上 `:806`、`:947`） | `:354` |
| .pgrid／.pc／拖曳複本 .pc.ghost（格子 touch-action:pan-y：觸控以點選互換為主，拖曳只在同排） | `:433`–`:442`（pan-y 在 `:436`） |
| .song（手機防溢出覆寫 32px minmax(0,1fr) 在 `:991`） | `:569` |
| .pc-rm「拿掉」（不換行覆寫：寬度 auto、nowrap、手機 letter-spacing 0 在 `:983`–`:988`） | `:699`–`:709` |
| 配樂區防溢出：.song-body／.pv／.pv-ctl>* 等 min-width:0、.pv-left nowrap、.fb-hl overflow:hidden | `:990`–`:996` |
| .drag-hint | `:851` |
| 版面星數 .layout-score（.ls-stars／.ls-cmp／.ls-why） | `:1007` |
| 自動排好提示 .auto-note | `:1012` |
| .pc-slot、.pc.ghost（拖曳） | `:896`、`:904` |
| .pgrid .pc 防 iOS 長按選單／圖片拖放（touch-callout、user-drag、img/canvas pointer-events:none） | `:898`–`:900` |
| .is-lift 長按成立回饋（格子、複本） | `:902`–`:903` |
| 點選互換：.is-picking 虛線、.is-sel 選取框、.pc-sel 小勾、.is-swapped 動畫 | `:910`–`:922` |
| 手機斷點 | `:819`、`:830`、`:834`、`:837`、`:951`（≤390）起 |

## 工具（`tools/`）

| 功能 | 檔案 |
|---|---|
| 共用 http server＋Chrome | `tools/lib.mjs` |
| 主頁截圖偵測測試（必須全過；含 Bug 4：要裁的格子不伸進導覽列、真貼文不標 navLike、膠囊底導覽列圖 `:60`） | `tools/test-grid-detect.mjs` |
| 第五輪驗收：殘影、溢出、容器右緣（b2，warn）、「拿掉」標籤、console error、點選互換（e：跨排、新↔舊、復原、配樂區同一節點）；自動排好 i_auto（`:192`，`--shot` 時在這裡截提示＋格子＋星數）；h_score 另檢查互換後無 .is-picking 殘留（`:382`）；`--shot`（有互換時停在已選取＋toast）／`--shot-music` 截圖；`--fixture` 指定主頁截圖（`:39`）、`--shot-removed` 全部拿掉後截「已拿掉」區（f_removed）、版面星數 h_score（`:314`；`--shot` 時改在這裡截格子＋下方星數）、曲風硬篩選 g_genre（`:391`，genres=[華語抒情]；`--shot-music` 在這頁截歌曲列） | `tools/verify-r5.mjs`（`:48` mark（pass/fail/skip/warn）、`:128` preparePage（第 4 參數 genres）、`:146` overflowAcrossWidths、`:81` measureOverflow（含 .ph／.gp 右緣）、`:114` measureRmChip、`:73` touchTap、`:229` 點選互換檢查 e_tapSwap） |
| 全流程截圖 | `tools/screenshot.mjs` |
| 390 寬截步驟 3、步驟 4 頂部（`PORT=… node tools/shot-steps34.mjs [前綴]` → screenshots/前綴-step3/4.png） | `tools/shot-steps34.mjs` |
| 產生合成測試圖（`--only 檔名` 只重產指定的圖；膠囊底導覽列 `navStyle:'pill'`、`:324` synth-mobile-dark-pillnav.png） | `tools/make-fixtures.mjs` |
