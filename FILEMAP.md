# FILEMAP — 功能 → 檔案:主要函式（行號）

最後更新：9b（步驟 2 參考圖複選＋自動歸納方向、配樂依照片情緒每個曲風一首；9a 的星數上限文案、空位標示保留）。每節改完都要更新行號；本次 `js/app.js` 行號已全部重新對過。
載入順序見 `index.html` 的 script 標籤：mock-data → **style-pick** → music-library → artist-aliases → fuzzy → **layout-score → step5 → step5-drag → step5-swap → auto-arrange** → music-filter → **music-mood** → music → preview → ai → grid → grid-detect → editor → app。

## 第 2 步：選喜歡的樣子（9b：參考圖複選、自動歸納、換一個方向）

| 功能 | 檔案:函式（行號） |
|---|---|
| 參考圖定義（01–06：圖檔、名稱、溫度 warm／cool／bw、對應 STYLES 分數與理由註解） | `js/style-pick.js:23` REFS；圖檔 `assets/style-ref/01_beige.jpg`…`06_quotes.jpg`（PIL 縮到最長邊 720px、JPEG q82，共約 400KB） |
| 方向的白話名稱（畫面不再出現帳號類型名稱） | `js/style-pick.js:34` DIR_NAME |
| 混搭規則：多種溫度 → 七成主色（多數溫度，平手取先選）、三成點綴、黑白過渡；單一溫度 → null | `js/style-pick.js:48` mixOf、`:64` mixText |
| 歸納：styleId 加總分數排序（平手取先選的參考圖）→ 方向清單；多溫度時補「改用另一溫度當主色」的方向 | `js/style-pick.js:75` summarize |
| 換一個方向（同一組選取，清單下一個，循環）、目前方向 | `js/style-pick.js:107` nextDirection、`:112` current、`:114` window.StylePick |
| 步驟 2 畫面：大圖一張、上一張／下一張（也可左右滑、← →）、「喜歡這張」切換（點大圖也可）、六張縮圖＋已選勾、「用這些喜好」（0 張時 disabled） | `js/app.js:477` viewStyle |
| 套用：summarize → state.stylePick／styleId／styleMix，直接進步驟 3（不追問） | `js/app.js:565` applyStylePick、`:572` useDirection |
| 「換一個方向」列（目前方向、依哪幾張、混搭文字；步驟 2 頂部與步驟 3 標題下 #dirBar） | `js/app.js:580` dirBarInner、`:589` bindDirBar；步驟 3 插入點 drawAnalysis 內 `:638`、綁定 `:672` |
| state 欄位（refSel、refIdx、stylePick、styleMix） | `js/app.js:30`–`:32` |
| 分析快取 key 含主色（換方向就重跑分析） | `js/app.js:610` |
| 首頁步驟 02 文案、進度列名稱、上傳頁按鈕 | `js/app.js:187`、`:20`、`:322` |
| CSS（.refview、.ref-img、.ref-ctl、.ref-thumbs、.ref-foot、.dir-bar） | `css/style.css:1022`–`:1053`；配樂 .song-gh／.mb-filter／.mb-none `:1055`–`:1058` |

## 第 5 步：排列（九宮格預覽）

| 功能 | 檔案:函式（行號） |
|---|---|
| 順序陣列搬移 | `js/step5.js:14` arrayMove |
| 順序同步（新照片／舊貼文／釘選） | `js/step5.js:23` syncOrder |
| 舊貼文是否被移動過（顯示「已移動」） | `js/step5.js:47` shifted |
| IG 待辦清單文字 | `js/step5.js:64` tasks |
| 對外 API `window.Step5`（建立） | `js/step5.js:124` |
| 版面星數：取樣（canvas／img／色碼，圖片依網址快取） | `js/layout-score.js:18` 區段、`:50` measure |
| 版面星數：相鄰明暗差／色相差／同類相黏 → 0–100 → 1–5 星（門檻 `:11`）；回傳 `{ score, stars, reason, spots }`（spots＝主要原因牽涉的相鄰格，9a 新增） | `js/layout-score.js:67` score |
| 版面星數：一句最主要原因、和上次比較（比剛剛好／差／一樣）、星星字串 | `js/layout-score.js:102` reasonOf、`:115` compare、`:121` starText、`:124` window.LayoutScore |
| 版面星數：step5 呼叫端（取樣→計分→只重寫 #layoutScore；第 4 參數 opts `{ ceiling, fixed }`） | `js/step5.js:83` showScore |
| 版面星數：推薦版上限文案（9a：推薦版且 <5 顆、沒有比較文字時 → `.ls-cap`「這組照片最多只能到 X 顆，」＋「原因是…」；原因格全是舊貼文時補「這幾格是已發的舊貼文，位置不能動」，否則補「這已是新照片能排出的最好組合」；`#layoutScore[data-ceiling]`） | `js/step5.js:95`–`:105`、`:111` ceilingWhy |
| 版面星數：app 接線（收集每格來源、圖片載好補算；放下／互換／復原才帶比較，scoreCompare；不呼叫 drawPhotos） | `js/app.js:1590` updateLayoutScore（`:1595`–`:1598` 算 ceiling＝state.auto.applied && !manual && 不比較、fixed＝每格是否舊貼文）、`:1610` scoreSources（每格取樣來源，自動排列共用）、`:1589` scoreCompare；容器 `#layoutScore` 在 `:1441`（格子區正下方） |
| 點選互換：陣列兩格交換（對外 `Step5.arraySwap`） | `js/step5-swap.js:17` arraySwap |
| 點選互換：點一下的判斷（選取／再點同格取消／點另一格互換） | `js/step5-swap.js:27` swapTap |
| 點選互換：選取框＋小勾「已選取」（.is-sel、.pc-sel、#pgrid.is-picking，不重畫） | `js/step5-swap.js:38` markSel |
| 點選互換：互換後兩格約 250ms 小動畫（.is-swapped） | `js/step5-swap.js:13` FLASH_MS、`:55` flashSwap |
| 點選互換：對外 API（arraySwap、swapTap、markSel、flashSwap） | `js/step5-swap.js:67` |
| 點選互換：接線（state.swapSel、提示文字、互換＋toast「已互換第 X 和第 Y 格・復原」） | `js/app.js:38` state.swapSel、`:1740` swapCtx、`:1755` tapCell、`:1756` swapCells |
| 點選互換：只重畫格子＋縮圖列（不重建配樂區） | `js/app.js:1776` redrawAfterSwap、`:1782` refreshStrip |
| 寫入新順序（釘選重算、syncPhotoOrder、recs=null；拖曳與互換共用） | `js/app.js:1716` applyOrder |
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
| 換位置寫入（拖曳放下、鍵盤 ← →；跟互換一樣只 drawGridPreview({keepMusic:true})＋refreshStrip，不重建配樂區） | `js/app.js:1731` commitMove |
| 九宮格互動綁定（鍵盤 Enter／Space 選取互換、Esc 取消、← →；拖曳；短按 → tapCell） | `js/app.js:1802` bindGridDrag |
| 九宮格預覽重畫（只動 #pgrid；`{ keepMusic: true }` 不重建配樂區；會清掉 swapSel 並 markSel(g,null) 清 .is-picking 虛線 `js/app.js:1509`） | `js/app.js:1504` drawGridPreview |
| 尾端補齊 3 欄的空位（9a：`.pc.old.none` 內含 `.pc-empty`「空位」；沒有 data-i → 不可拖、不可點選互換、沒有「拿掉」） | `js/app.js:1501` EMPTY_CELL、補齊迴圈 `:1545`–`:1546`；CSS `css/style.css:558`–`:564` |
| 自動排好推薦版本：只在新照片占的格子間重排；≤6 張窮舉（EXHAUST_MAX `:8`）、更多張貪婪＋兩兩互換 | `js/auto-arrange.js:11` evalPerm、`:18` exhaustive、`:35` greedy、`:60` best、`:74` same |
| 自動排好提示列「已幫你排好推薦版本…」＋「改回原本順序」（#autoNote，星數區上方） | `js/auto-arrange.js:79` showNote、`:89` window.AutoArrange；容器 `js/app.js:1440`；CSS `css/style.css:1018` |
| 自動排列接線（state.auto {key,before,manual}；照片組合變了才排、手動排過就不覆蓋；圖片沒載好等 load 再排） | `js/app.js:1632` autoArrange、`:1657` drawAutoNote、`:1669` markManual（commitMove、swapCells 呼叫）；觸發點 drawGridPreview 內 `:1578` |
| 預覽外框＋操作提示 #dragHint（文案 HINT_TEXT、選取中 HINT_PICK；關閉記錄 key v2） | `js/app.js:1418` HINT_TEXT、`:1420` setHint、`:1425` hintHidden、`:1429` gridPreviewShell |
| 仿 IG 版頭（含 .fb-hl） | `js/app.js:1455` headerHTML、`:1486` paintChrome |
| IG 待辦清單 | `js/app.js:1477` drawIgTodo |
| 釘選與順序狀態 | `js/app.js:1377` pinList、`:1384` pinSave、`:1387` keptOldKs、`:1392` ensureOrder、`:1396` syncPhotoOrder |
| 釘選／取消釘選舊貼文 | `js/app.js:1672` pinOld、`:1682` unpinOld |

## 第 5 步：拿掉／還原（模擬封存）

| 功能 | 檔案:函式（行號） |
|---|---|
| 既有貼文清單 | `js/app.js:1103` existingItems |
| localStorage 讀寫 | `js/app.js:1115` archLoad、`:1118` archRemoved、`:1122` archSave |
| 拿掉（toast 帶「復原」） | `js/app.js:1125` archiveOld |
| 恢復單格／全部還原 | `js/app.js:1134` restoreOld、`:1151` restoreAll |
| 「已拿掉」區塊與縮圖 | `js/app.js:1156` oldThumbHTML、`:1159` drawArchived |
| 「拿掉」按鈕 HTML（.pc-rm） | `js/app.js` drawGridPreview 內（`:1472`）；點格子本身不會拿掉 |

## 第 5 步：頁面、照片、編輯、下載

| 功能 | 檔案:函式（行號） |
|---|---|
| 頁面進出 | `js/app.js:991` cleanupPhotos、`:1001` viewPhotos |
| 讀取新照片 | `js/app.js:1028` addFiles、`:1067` makeThumb |
| 既有貼文縮圖（從主頁截圖裁格） | `js/app.js:1074` prepareExisting（`:1086` 用 `GD.usableCell` 篩選）；`js/grid.js:277` usable、`:281` cropExistingCells；格子 `<img draggable="false">` 在 `js/app.js:1156` oldThumbHTML |
| 排除導覽列碎片（>70% 單色深底＋少數小圖示；cell.navLike） | `js/grid-detect.js:322` navStripStats、`:360` looksLikeNavStrip、`:370` usableCell（對外 `GridDetect.usableCell`） |
| 整頁重畫（會重建配樂區） | `js/app.js:1183` drawPhotos |
| 單張照片編輯器 | `js/app.js:1293` bindEditor（編輯中照片只由上方 .strip 切換）；canvas 處理 `js/editor.js` |
| 下載（單張／zip） | `js/app.js:1690` bindDownloads；`js/editor.js:151` downloadAll、`:183` buildZip |
| 提示訊息（含動作按鈕） | `js/app.js:60` toast |

## 第 5 步：配樂

| 功能 | 檔案:函式（行號） |
|---|---|
| 配樂區 #musicBox（9b：一律先推「每個曲風一首」；篩選選填；只預查前 3 首的 Apple 試聽） | `js/app.js:1850` renderMusicBox（`:1844` filterLine 篩選說明、`:1880` 歌曲列 data-genre、`:1936` 預查前 3 首、`:1942` 換一組（`:1879` 沒有符合篩選時的 .mb-none）、`:1952` openFilter）、`:1830` currentMood |
| 配樂語言偏好 | `js/app.js:1405` musicLang、`:1412` setMusicLang |
| 篩選設定（選填；沒存過偏好時內嵌、存過時開偏好面板）；「套用篩選」不再要求至少一種曲風或歌手 | `js/app.js:1979` renderInlineSetup、`:2163` renderGenreTab（`:2177` 不擋）、`:2152` finishSetup |
| 照片情緒（冷暖、明暗、節奏，只算一次） | `js/music-mood.js:20` moodOf（`js/music.js:39` moodOf 轉呼叫） |
| 貼合度 fit（照片非適中時：同溫 +1.5／反向 −0.5、同亮度 +1.5／反向 −0.3；同節奏 +1） | `js/music-mood.js:56` fit |
| 每個曲風一首：無篩選＝GENRES 十個曲風；選了曲風＝MusicFilter.split 的 strict（華語鎖 zh、不補相近推薦）；填了歌手＝該曲風有他們的歌就只挑他們、命中的曲風排前；同分看 tieBonus；換一組＝跳過已推過的下一首 | `js/music-mood.js:108` perGenre、`:73` artistHit、`:77` tieBonus、`:157` window.MusicMood |
| 推薦入口、曲風語言衝突 | `js/music.js:48` recommend（轉呼叫 MusicMood.perGenre）、`js/music.js:83` window.Music.genreConflict |
| 曲風硬篩選：華語類判斷（名稱含「華語」或曲庫中全為 zh）、strict／loose 分組（9b 起只用 strict）、曲風與語言衝突提示文字 | `js/music-filter.js:11` zhGenres、`:24` isZhGenre、`:27` genreHit、`:34` split、`:43` conflict、`:56` window.MusicFilter |
| 歌曲列曲風標籤 .song-g（用該首自己的 genre）、「相近推薦」.song-near、衝突提示 #genreNote（.mf-hint） | `js/app.js:1887`（.song-g）、`:1888`（.song-near）、`:1877`（#genreNote）；CSS `css/style.css:1008` |
| 內建歌單 | `js/music-library.js:26` s（資料）、`:390` window.MusicLibrary |
| 試聽 | `js/preview.js:98` renderLink、`:117` renderPlayer |
| 模糊比對 | `js/fuzzy.js:82` libraryHits、`:123` itunes；別名 `js/artist-aliases.js` |

## 其他步驟

| 功能 | 檔案:函式（行號） |
|---|---|
| 路由 | `js/app.js:138` render |
| 首頁／上傳／喜歡的樣子／分析／下一篇 | `js/app.js:160` viewHome、`:200` viewUpload、`:477` viewStyle（見「第 2 步」）、`:607` viewAnalysis、`:886` viewNext |
| 步驟 3 版面：標題先給結論與動作（analysisVerdict：「先收起第 X 排第 Y 格」）、頂部「看下一篇拍什麼」#toNextTop、三件事在前、「細節：五個面向」在後 | `js/app.js:628` drawAnalysis、`:676` analysisVerdict；CSS `.an-foot-top` `css/style.css:314`、`.nowrap` `:315` |
| 步驟 4 版面：標題直接是「下一篇拍這個：主題」#nextTitle、卡片緊接在下、說明移到卡片後 | `js/app.js:929` drawNext |
| 截圖分析、截圖面板 | `js/app.js:357` analyzeShot、`:700` renderShotPanel |
| 配樂偏好頁 | `js/app.js:1999` viewMusic、`:2130` viewMusicSetup、`:2257` viewMusicSettings |
| 主頁截圖偵測（找格線、導覽列） | `js/grid-detect.js:796` detectPhone（找不到導覽列 → bottom＝H*0.9、`:818` trimLast）、`:420` detectDesktop、`:625` findNav、`:575` navIconsOk（舊版 5 等分／新版膠囊底、大致等距）、`:599` findNavBand（底部 12% 帶狀區保險）、`:301` contentBottom、`:374` buildCells（`:385` 最後一排 contentBottom）、`:990` window.GridDetect |
| 抽象色塊九宮格 | `js/grid.js` |
| AI mock | `js/ai.js` |
| 給測試用的 `window.__app`（9a 新增 `layoutStats()`：目前順序＋每格 {l,h,s}，verify 比對最高分用；9b 新增 `mood()`：目前照片情緒） | `js/app.js:2414`、`:2420` mood、`:2422` layoutStats |

## CSS（`css/style.css`）

| 功能 | 行號 |
|---|---|
| body overflow-x:hidden | `:45` |
| .ph（第 5 步兩欄；手機 minmax(0,1fr) 在 `:1003`–`:1005`；880 以上 `:814`、`:955`） | `:356` |
| .pgrid／.pc／拖曳複本 .pc.ghost（格子 touch-action:pan-y：觸控以點選互換為主，拖曳只在同排） | `:435`–`:444`（pan-y 在 `:438`） |
| 尾端補齊「空位」.pc.old.none／.pc-empty（9a：虛線框＋淡字，深色主題另調） | `:558`–`:564` |
| .song（手機防溢出覆寫 32px minmax(0,1fr) 在 `:999`） | `:577` |
| .pc-rm「拿掉」（不換行覆寫：寬度 auto、nowrap、手機 letter-spacing 0 在 `:992`–`:996`） | `:708`–`:716` |
| 配樂區防溢出：.song-body／.pv／.pv-ctl>* 等 min-width:0、.pv-left nowrap、.fb-hl overflow:hidden | `:999`–`:1005` |
| .drag-hint | `:859` |
| 版面星數 .layout-score（.ls-stars／.ls-cmp（推薦版上限 .ls-cap 共用）／.ls-why） | `:1013` |
| 自動排好提示 .auto-note | `:1018` |
| .pc-slot、.pc.ghost（拖曳） | `:904`、`:444` |
| .pgrid .pc 防 iOS 長按選單／圖片拖放（touch-callout、user-drag、img/canvas pointer-events:none） | `:907`–`:908` |
| .is-lift 長按成立回饋（格子、複本） | `:910`–`:911` |
| 點選互換：.is-picking 虛線、.is-sel 選取框、.pc-sel 小勾、.is-swapped 動畫 | `:917`–`:928` |
| 手機斷點 | `:827`、`:838`、`:842`、`:845`、`:959`（≤390）起 |

## 工具（`tools/`）

| 功能 | 檔案 |
|---|---|
| 共用 http server＋Chrome | `tools/lib.mjs` |
| 主頁截圖偵測測試（必須全過；含 Bug 4：要裁的格子不伸進導覽列、真貼文不標 navLike、膠囊底導覽列圖 `:60`） | `tools/test-grid-detect.mjs` |
| 第五輪驗收：殘影、溢出、容器右緣（b2，warn）、「拿掉」標籤、console error、點選互換（e：跨排、新↔舊、復原、配樂區同一節點）；自動排好 i_auto（`:196`，`--shot` 時在這裡截提示＋格子＋星數）；**9a 新增** i_autoBest（`:211`：目前順序 LayoutScore 分數＝AutoArrange.best＝獨立窮舉最高分，另記錄尾端空位也可放時的 padMax）、i_ceiling（`:268`：推薦版 <5 顆要有「最多只能到 X 顆」）、j_emptySlot（`:280`：空位有可見「空位」、無「拿掉」、無 data-i、點了不進選取）；h_score 另檢查互換後無 .is-picking 殘留（`:478`）；`--shot`（有互換時停在已選取＋toast）／`--shot-music` 截圖；`--fixture` 指定主頁截圖（`:45`）、`--shot-removed` 全部拿掉後截「已拿掉」區（f_removed）、版面星數 h_score（`:448`；`--shot` 時改在這裡截格子＋下方星數）、曲風硬篩選 g_genre（`:527`，genres=[華語抒情]；9b 改成恰 1 首、不得有相近推薦；`--shot-music` 在這頁截歌曲列） | `tools/verify-r5.mjs`（`:54` mark（pass/fail/skip/warn）、`:133` preparePage（第 4 參數 genres）、`:152` overflowAcrossWidths、`:87` measureOverflow（含 .ph／.gp 右緣）、`:120` measureRmChip、`:79` touchTap、`:366` 點選互換檢查 e_tapSwap） |
| 9b 驗收（`PORT=89xx node tools/verify-r9b.mjs [--shots]`）：步驟 2 無帳號類型卡片、六張可翻、未選不能繼續、可複選、套用不追問且寫入七成／三成混搭、換一個方向；配樂無篩選每曲風一首且為最貼合、選填不擋、換一組、只選華語抒情、填歌手、360/375/390 溢出、console error。Apple 試聽查詢在測試中攔截回空結果；`--shots` 存 s9b-style／s9b-style-applied／s9b-music | `tools/verify-r9b.mjs`（`:40` fitOf 獨立重算、`:49` newPage（攔截 itunes）、`:65` toMusic） |
| 全流程截圖 | `tools/screenshot.mjs` |
| 390 寬截步驟 3、步驟 4 頂部（`PORT=… node tools/shot-steps34.mjs [前綴]` → screenshots/前綴-step3/4.png） | `tools/shot-steps34.mjs` |
| 產生合成測試圖（`--only 檔名` 只重產指定的圖；膠囊底導覽列 `navStyle:'pill'`、`:324` synth-mobile-dark-pillnav.png） | `tools/make-fixtures.mjs` |
