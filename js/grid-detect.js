/*
 * grid-detect.js — 在瀏覽器本地偵測 IG 主頁截圖裡的「貼文格子區」
 * ------------------------------------------------------------
 * 純 canvas 像素分析：不呼叫 AI、不花 token、不送出網路。
 *
 * 公開介面（掛在 window.GridDetect）：
 *   GridDetect.detect(src, opts)                → Result
 *        src：Image／canvas／ImageBitmap（建議先縮到寬 ≤ 1080，見 app.js）
 *        opts.full = { w, h }：原圖尺寸（src 是縮圖時，結果座標換算回原圖）
 *        opts.kind = 'phone' | 'desktop'：強制用某一種偵測（使用者按了切換）
 *   GridDetect.redetect(prevResult, kind)        → Result（用快取的像素重跑，不必重新解碼）
 *   GridDetect.classify(src, opts)               → { kind, ar, status, nav, reason }
 *   GridDetect.fromFrame(result, frame, ratio)   → Result（使用者手動拖框後重算）
 *   GridDetect.pickArchive(result)               → [{ cell, no, reason }]（依貼文數決定 0／1／2 格）
 *   GridDetect.archiveCount(posts)               → 0 | 1 | 2
 *   GridDetect.usableCell(cell)                  → 可以裁成舊貼文縮圖嗎（有貼文、可見 ≥ 60%、不像導覽列碎片）
 *
 * Result（座標都是原圖像素）：
 *   { ok, confidence, mode:'auto'|'manual', theme:'light'|'dark',
 *     kind:'phone'|'desktop'（實際用的偵測）, cls:{ kind:'phone'|'desktop'|'ipad'|'uncertain', … }（自動分類）,
 *     box:{x,y,w,h}, cols:3, colW, cellH, gap, ratio:'3:4'|'4:5'|'1:1', ratioGuessed,
 *     rows, posts, cells:[{ i,row,col,x,y,w,h,visible,hasPost,navLike,postNo,stats }],
 *     tabRow, nav, manualFrame, note }
 *
 * 流程：先分類、再偵測
 *   A. 分類：高÷寬 ≥ 1.7 → 手機；寬 > 高 → 電腦；1.25–1.7 → iPad；1–1.25 → 不確定。
 *      另外量頂部狀態列、底部導覽列（5 個等距小 icon）當輔助證據。
 *   B. 手機 → 版型定位（不做通用格線搜尋，避免把頭像當格子）：
 *      1. 由上往下找 IG「分頁 icon 列」：一條細橫帶，裡面 3–4 個等距小 icon（約在 1/8、3/8、5/8、7/8
 *         或 1/6、1/2、5/6），其中只有一個 icon 下面有一條短底線（淺色＝黑線、深色＝白線）。
 *      2. 貼文區 top ＝ 底線／分隔線之下；左右貼齊全寬；三欄等寬。
 *      3. 格子比例：量第一排的列縫（3:4／4:5／1:1）；量不到就看第一篇的實際高度；再不行預設 3:4 並標「推測」。
 *      4. 下緣停在底部導覽列上緣（導覽列：舊版 5 等分 icon、新版膠囊底／大致等距、或底部帶狀區；
 *         都找不到就停在 H*0.9，最後一排再看實際內容到哪裡）。
 *      5. 找不到分頁列 → ok=false，交給使用者手動拖框（不硬給錯框）。
 *      沒有寫死任何像素位置或比例位置；頭像、簡介、按鈕、精選都在分頁列之上，不可能被當成貼文。
 *   C. 電腦／iPad → 沿用第二輪的通用偵測（下面 1–7）：
 *      1. 估背景色：取四邊像素做色彩量化，取眾數（淺色、深色模式都適用）。
 *      2. 「非背景」遮罩：與背景色最大通道差 > 門檻。
 *      3. 逐列投影：全是背景的列把畫面切成橫帶（頭像、簡介、按鈕、精選、分頁列、每一排貼文…）。
 *      4. 每條橫帶再做欄投影，切出「方塊」，並找出方塊真正的上下緣。
 *      5. 對每個大方塊提出假設：欄寬 cw、比例（3:4／4:5／1:1）、左緣 x0、縫寬 gap，
 *         用「能解釋幾格貼文」替每個假設打分 —— 頭像、按鈕、精選動態都對不上 3 欄等寬方格，自然被排除；
 *         左右留邊（電腦版、iPad）也因為 x0 由方塊位置推得而自動排除。
 *      6. 用最佳假設從格子區頂端往下排列，逐格檢查「格內有沒有非背景、有變化」→ 判斷是否真的有貼文。
 *      7. 信心分數低於 0.6 → 介面請使用者手動拖框。
 *   D. 不確定 → 兩種都試，挑可信的；介面仍會問「這是手機還是電腦截圖？」。兩種都失敗 → 手動拖框。
 */
(function () {
  'use strict';

  var RATIOS = [{ id: '3:4', r: 4 / 3 }, { id: '4:5', r: 5 / 4 }, { id: '1:1', r: 1 }];
  var MAX_W = 1080;          // 工作解析度：寬度上限（效能；iOS canvas 面積上限約 16.7M 像素）
  var MIN_CELL = 0.12;       // 貼文格寬至少佔截圖寬度的比例
  var OK_CONF = 0.6;

  function ratioById(id) {
    for (var i = 0; i < RATIOS.length; i++) if (RATIOS[i].id === id) return RATIOS[i];
    return RATIOS[0];
  }

  /* ---------- 1. 讀像素：畫一次、getImageData 一次 ---------- */
  function getPixels(src, full) {
    var sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
    var nw = (full && full.w) || sw, nh = (full && full.h) || sh;
    var s = Math.min(1, MAX_W / sw);
    var w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s));
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    var id = ctx.getImageData(0, 0, w, h);
    cv.width = 0; cv.height = 0; // 釋放 canvas 記憶體（iOS Safari 很在意）
    return { data: id.data, w: w, h: h, sx: w / nw, sy: h / nh, nw: nw, nh: nh };
  }

  /* ---------- 2. 背景色：四邊眾數 ---------- */
  function estimateBg(px) {
    var d = px.data, w = px.w, h = px.h, bins = {}, best = null;
    function add(x, y) {
      var i = (y * w + x) * 4;
      var k = (d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3);
      var b = bins[k] || (bins[k] = { n: 0, r: 0, g: 0, b: 0 });
      b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
      if (!best || b.n > best.n) best = b;
    }
    var step = Math.max(1, Math.round(Math.min(w, h) / 400));
    for (var x = 0; x < w; x += step) { add(x, 0); add(x, 1); add(x, h - 1); add(x, h - 2); }
    for (var y = 0; y < h; y += step) { add(0, y); add(1, y); add(w - 1, y); add(w - 2, y); }
    var r = best.r / best.n, g = best.g / best.n, b = best.b / best.n;
    var lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return { r: r, g: g, b: b, lum: lum, dark: lum < 110 };
  }

  /* ---------- 3. 遮罩＋積分圖 ---------- */
  function buildMask(px, bg, T) {
    var d = px.data, w = px.w, h = px.h, n = w * h;
    var m = new Uint8Array(n), rowCnt = new Int32Array(h);
    var integ = new Int32Array((w + 1) * (h + 1));
    for (var y = 0; y < h; y++) {
      var run = 0;
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var dr = Math.abs(d[i] - bg.r), dg = Math.abs(d[i + 1] - bg.g), db = Math.abs(d[i + 2] - bg.b);
        var v = (dr > T || dg > T || db > T) ? 1 : 0;
        m[y * w + x] = v; rowCnt[y] += v; run += v;
        integ[(y + 1) * (w + 1) + x + 1] = integ[y * (w + 1) + x + 1] + run;
      }
    }
    return { m: m, rowCnt: rowCnt, integ: integ, w: w, h: h };
  }
  function rectSum(M, x0, y0, x1, y1) { // [x0,x1) × [y0,y1)
    x0 = Math.max(0, Math.min(M.w, Math.round(x0))); x1 = Math.max(0, Math.min(M.w, Math.round(x1)));
    y0 = Math.max(0, Math.min(M.h, Math.round(y0))); y1 = Math.max(0, Math.min(M.h, Math.round(y1)));
    if (x1 <= x0 || y1 <= y0) return 0;
    var W = M.w + 1, I = M.integ;
    return I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0];
  }

  /* ---------- 4. 橫帶與方塊 ---------- */
  function findBands(M) {
    var lim = Math.max(1, Math.round(M.w * 0.002)), out = [], s = -1;
    for (var y = 0; y <= M.h; y++) {
      var blank = y === M.h || M.rowCnt[y] <= lim;
      if (!blank && s < 0) s = y;
      if (blank && s >= 0) { out.push({ y0: s, y1: y - 1 }); s = -1; }
    }
    return out;
  }

  function segmentsInBand(M, y0, y1, merged) {
    var w = M.w, h = y1 - y0 + 1, out = [];
    if (h < 6) return out;
    var colCnt = new Int32Array(w);
    for (var y = y0; y <= y1; y++) {
      var off = y * w;
      for (var x = 0; x < w; x++) colCnt[x] += M.m[off + x];
    }
    var minW = w * MIN_CELL * 0.85, s = -1;
    for (var x2 = 0; x2 <= w; x2++) {
      var on = x2 < w && colCnt[x2] >= h * 0.25;
      if (on && s < 0) s = x2;
      if (!on && s >= 0) {
        var xa = s, xb = x2 - 1; s = -1;
        if (xb - xa + 1 < minW) continue;
        // 真正的上下緣：該方塊欄位內，非背景 ≥ 35% 的列
        // 需要連續 3 列都成立，避免把分頁列底線之類的細線算進方塊
        var sw = xb - xa + 1, top = -1, bot = -1, streak = 0;
        for (var yy = y0; yy <= y1; yy++) {
          if (rectSum(M, xa, yy, xb + 1, yy + 1) >= sw * 0.35) {
            streak++;
            if (streak >= 3) { if (top < 0) top = yy - streak + 1; bot = yy; }
          } else streak = 0;
        }
        if (top < 0) continue;
        var sh = bot - top + 1;
        out.push({
          x: xa, y: top, w: sw, h: sh,
          fill: rectSum(M, xa, top, xb + 1, bot + 1) / (sw * sh),
          tTop: top <= 1, tBot: bot >= M.h - 2, merged: !!merged
        });
      }
    }
    return out;
  }

  function allSegments(M, bands) {
    var segs = [], gapMax = Math.max(2, Math.round(M.w * 0.004));
    bands.forEach(function (b, i) {
      segs = segs.concat(segmentsInBand(M, b.y0, b.y1, false));
      // 照片內若剛好有一整列接近背景色，橫帶會被切開 → 也試試與下面 1–2 條橫帶合併
      var end = b.y1;
      for (var j = i + 1; j < Math.min(bands.length, i + 3); j++) {
        if (bands[j].y0 - end - 1 > gapMax) break;
        end = bands[j].y1;
        segs = segs.concat(segmentsInBand(M, b.y0, end, true));
      }
    });
    return segs;
  }

  /* ---------- 5. 假設與打分 ---------- */
  function estimateGap(segs, W) {
    var gaps = [];
    for (var i = 0; i < segs.length; i++) for (var j = 0; j < segs.length; j++) {
      var a = segs[i], b = segs[j];
      if (a.merged || b.merged || a === b) continue;
      if (Math.abs(a.y - b.y) > 3 || Math.abs(a.h - b.h) > 4) continue;
      var g = b.x - (a.x + a.w);
      if (g >= 1 && g <= W * 0.02) gaps.push(g);
    }
    if (!gaps.length) return Math.max(1, Math.round(W * 0.002));
    gaps.sort(function (p, q) { return p - q; });
    return gaps[gaps.length >> 1];
  }

  function makeHypotheses(segs, W, g) {
    var hs = [], seen = {};
    function push(cw, rObj, x0, prior) {
      if (cw < W * MIN_CELL || 3 * cw + 2 * g > W + 4) return;
      if (x0 < -3 || x0 + 3 * cw + 2 * g > W + 4) return;
      var key = Math.round(cw) + '|' + rObj.id + '|' + Math.round(x0);
      if (seen[key]) return;
      seen[key] = 1;
      hs.push({ cw: cw, r: rObj.r, ratio: rObj.id, x0: x0, g: g, prior: prior });
    }
    segs.forEach(function (s) {
      for (var n = 1; n <= 3; n++) {
        var cwW = (s.w - (n - 1) * g) / n;
        RATIOS.forEach(function (R) {
          var complete = !s.tTop && !s.tBot;
          if (complete) {
            var cwH = s.h / R.r;
            if (Math.abs(cwH - cwW) / cwW > 0.07) return;
          } else if (s.h > cwW * R.r * 1.07) return;
          for (var j = 0; j <= 3 - n; j++) push(cwW, R, s.x - j * (cwW + g), complete ? 1 : 0.6);
        });
      }
    });
    return hs;
  }

  function scoreHyp(H, segs, M) {
    var cw = H.cw, g = H.g, ch = cw * H.r, pitch = ch + g;
    var tol = Math.max(3, cw * 0.04), tolH = Math.max(3, ch * 0.06);
    var aligned = [];
    segs.forEach(function (s) {
      var k = Math.round((s.x - H.x0) / (cw + g));
      if (k < 0 || k > 2 || Math.abs(s.x - (H.x0 + k * (cw + g))) > tol) return;
      var n = Math.round((s.w + g) / (cw + g));
      if (n < 1 || k + n > 3) return;
      var right = H.x0 + (k + n - 1) * (cw + g) + cw;
      if (Math.abs(s.x + s.w - right) > tol) return;
      var complete = !s.tTop && !s.tBot;
      if (complete && Math.abs(s.h - ch) > tolH) return;
      if (!complete && (s.h > ch + tolH || s.h < ch * 0.25)) return;
      aligned.push({ s: s, k: k, n: n, complete: complete });
    });
    if (!aligned.length) return null;
    // 錨點：最上面的完整方塊（沒有就用被截斷的）
    var anchor = null;
    function better(a, b) { // 完整 > 被截斷；未合併 > 合併；越上面越好
      if (!b) return true;
      if (a.complete !== b.complete) return a.complete;
      if (a.s.merged !== b.s.merged) return !a.s.merged;
      return a.s.y < b.s.y;
    }
    aligned.forEach(function (a) { if (better(a, anchor)) anchor = a; });
    if (!anchor) anchor = aligned[0];
    var ay = anchor.s.tTop && !anchor.complete ? anchor.s.y + anchor.s.h - ch : anchor.s.y;
    var cells = {}, rowsSeen = {}, minRow = 0, completeN = 0, rowTops = {};
    var ok = aligned.filter(function (a) {
      var top = a.s.tTop && !a.complete ? a.s.y + a.s.h - ch : a.s.y;
      var m = Math.round((top - ay) / pitch);
      if (Math.abs(top - (ay + m * pitch)) > Math.max(tolH, 4 + Math.abs(m) * 1.5)) return false;
      a.row = m; a.top = top;
      if (m < minRow) minRow = m;
      return true;
    });
    // 同一格只算一次（避免合併後的方塊重複計分）
    ok.forEach(function (a) {
      for (var c = a.k; c < a.k + a.n; c++) cells[a.row + ',' + c] = 1;
      rowsSeen[a.row] = 1;
      if (a.complete) completeN++;
      if (!a.s.tTop && !a.s.merged) (rowTops[a.row] = rowTops[a.row] || []).push(a.s.y);
    });
    Object.keys(rowTops).forEach(function (k) {
      var v = rowTops[k].sort(function (p, q) { return p - q; });
      rowTops[k] = v[v.length >> 1];
    });
    var nCells = Object.keys(cells).length;
    var score = nCells * cw * ch * H.prior * (completeN ? 1 : 0.7);
    // 寬度沒被任何完整一排確認、而且右邊會超出畫面 → 扣分
    var gridR = H.x0 + 3 * cw + 2 * g;
    if (gridR > M.w + 2) score *= 0.5;
    return { score: score, cells: nCells, completeN: completeN, aligned: ok, y0: ay + minRow * pitch, minRow: minRow, ay: ay, rowTops: rowTops };
  }

  /* ---------- 6. 逐格判斷有沒有貼文 ---------- */
  function cellStats(px, M, x, y, w, h) {
    var ix = Math.max(0, Math.round(x + w * 0.08)), iy = Math.max(0, Math.round(y + h * 0.08));
    var ix1 = Math.min(px.w, Math.round(x + w * 0.92)), iy1 = Math.min(px.h, Math.round(y + h * 0.92));
    if (ix1 - ix < 2 || iy1 - iy < 2) return null;
    var frac = rectSum(M, ix, iy, ix1, iy1) / ((ix1 - ix) * (iy1 - iy));
    var d = px.data, n = 0, sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0;
    var step = Math.max(1, Math.round(Math.min(ix1 - ix, iy1 - iy) / 48));
    for (var yy = iy; yy < iy1; yy += step) {
      for (var xx = ix; xx < ix1; xx += step) {
        var i = (yy * px.w + xx) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
        var l = 0.299 * r + 0.587 * g + 0.114 * b;
        n++; sr += r; sg += g; sb += b; sl += l; sl2 += l * l;
      }
    }
    var mean = sl / n;
    return { frac: frac, r: sr / n, g: sg / n, b: sb / n, lum: mean, std: Math.sqrt(Math.max(0, sl2 / n - mean * mean)) };
  }
  /* 一排格子實際看得到多高：往下掃，遇到連續一段「整排幾乎都是背景」就停
   * （例如手機底部導覽列蓋住最後一排、或最後一排完全沒有貼文） */
  function contentBottom(M, x0, gw, yTop, yBot, ch) {
    var need = Math.max(4, Math.round(ch * 0.06)), run = 0;
    var xa = Math.max(0, x0), xb = Math.min(M.w, x0 + gw), span = Math.max(1, xb - xa);
    for (var y = Math.round(yTop); y < yBot; y++) {
      if (rectSum(M, xa, y, xb, y + 1) < span * 0.08) {
        run++;
        if (run >= need) return y - run + 1;
      } else run = 0;
    }
    return yBot;
  }
  function looksLikePost(st) {
    if (!st) return false;
    return st.frac >= 0.15 || (st.frac >= 0.03 && st.std >= 10);
  }

  // ===== 格子：像不像「導覽列碎片」（深色單色底＋少數小圖示） =====
  /* 把格子縮成約 48 寬的取樣網格，算：
   *   dom：最多的那個顏色（RGB 各量化成 16 階）占多少比例、它的亮度
   *   comps：其餘像素的連通塊（8 鄰接，忽略 1 格的雜點）——數量、每塊的寬高、全部塊的上下範圍
   * 給 looksLikeNavStrip 判斷。 */
  function navStripStats(px, x, y, w, h) {
    var d = px.data, x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
    var x1 = Math.min(px.w, Math.round(x + w)), y1 = Math.min(px.h, Math.round(y + h));
    if (x1 - x0 < 4 || y1 - y0 < 4) return null;
    var step = Math.max(1, Math.round((x1 - x0) / 48));
    var gw = Math.ceil((x1 - x0) / step), gh = Math.ceil((y1 - y0) / step), n = gw * gh;
    var q = new Int32Array(n), cnt = {}, best = -1, bestN = 0;
    for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
      var k = ((y0 + j * step) * px.w + x0 + i * step) * 4;
      var key = (d[k] >> 4) << 8 | (d[k + 1] >> 4) << 4 | (d[k + 2] >> 4);
      q[j * gw + i] = key;
      var c = (cnt[key] || 0) + 1; cnt[key] = c;
      if (c > bestN) { bestN = c; best = key; }
    }
    var domLum = 0.299 * ((best >> 8) * 16 + 8) + 0.587 * (((best >> 4) & 15) * 16 + 8) + 0.114 * ((best & 15) * 16 + 8);
    // 連通塊
    var seen = new Uint8Array(n), comps = [], stack = [];
    for (var s0 = 0; s0 < n; s0++) {
      if (seen[s0] || q[s0] === best) continue;
      var minX = gw, maxX = -1, minY = gh, maxY = -1, size = 0;
      stack.push(s0); seen[s0] = 1;
      while (stack.length) {
        var p = stack.pop(), pxi = p % gw, pyi = (p / gw) | 0; size++;
        if (pxi < minX) minX = pxi; if (pxi > maxX) maxX = pxi; if (pyi < minY) minY = pyi; if (pyi > maxY) maxY = pyi;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var nx = pxi + dx, ny = pyi + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          var np = ny * gw + nx;
          if (!seen[np] && q[np] !== best) { seen[np] = 1; stack.push(np); }
        }
      }
      if (size >= 2) comps.push({ w: (maxX - minX + 1) / gw, h: (maxY - minY + 1) / gh, y0: minY / gh, y1: (maxY + 1) / gh });
    }
    return { dom: bestN / n, domLum: domLum, comps: comps };
  }
  /* 判斷規則（Bug 4：導覽列被當成貼文裁出來）：
   *   底色是深色（亮度 < 60）且占 > 70%；其餘只有 1–6 個小塊，每塊高 ≤ 30%、寬 ≤ 80%（膠囊底可以寬），
   *   而且全部擠在同一條橫帶裡（上下範圍 ≤ 40%）。真的深色照片通常有漸層／大面積內容，不會符合。 */
  function looksLikeNavStrip(ns) {
    if (!ns || ns.dom <= 0.7 || ns.domLum >= 60) return false;
    var cs = ns.comps;
    if (cs.length < 1 || cs.length > 6) return false;
    if (cs.some(function (c) { return c.h > 0.3 || c.w > 0.8; })) return false;
    var top = Math.min.apply(null, cs.map(function (c) { return c.y0; }));
    var bot = Math.max.apply(null, cs.map(function (c) { return c.y1; }));
    return bot - top <= 0.4;
  }
  /* 第 5 步要裁成舊貼文縮圖的格子：有貼文、看得到 ≥ 60%、不像導覽列碎片（grid.js cropExistingCells 與 app.js 共用） */
  function usableCell(c) {
    return !!(c && c.hasPost && c.visible >= 0.6 && !c.navLike);
  }

  function buildCells(ctx, geo) {
    var px = ctx.px, M = ctx.M, sx = px.sx, sy = px.sy;
    var cw = geo.cw, g = geo.g, ch = cw * geo.r, pitch = ch + g;
    var bottomLimit = geo.bottom !== undefined ? geo.bottom : px.h;
    var cells = [], rows = 0, top = geo.y0, m = 0, posts = 0, lastVisBot = 0;
    while (top < bottomLimit - ch * 0.35 && m < 60) {
      if (geo.rowTops && geo.rowTops[m + geo.minRow] !== undefined) top = geo.rowTops[m + geo.minRow];
      var visTop = Math.max(0, top), visBot = Math.min(bottomLimit, top + ch);
      // fullRows（手機版型定位、手動框）：框內每一排都列出，空的就標空格；否則看實際內容到哪裡
      // trimLast（手機找不到導覽列）：碰到下緣的最後一排也看實際內容到哪裡
      var isLast = top + ch >= bottomLimit - g;
      if (!geo.fullRows || (geo.trimLast && isLast)) visBot = contentBottom(M, geo.x0, 3 * cw + 2 * g, visTop, visBot, ch);
      var vis = Math.max(0, visBot - visTop) / ch;
      if (vis >= 0.35) {
        rows++; lastVisBot = visBot;
        for (var k = 0; k < 3; k++) {
          var x = geo.x0 + k * (cw + g);
          var st = cellStats(px, M, x, visTop, cw, visBot - visTop);
          var has = looksLikePost(st);
          var nl = has ? navStripStats(px, x, visTop, cw, visBot - visTop) : null;
          cells.push({
            i: cells.length, row: rows - 1, col: k,
            x: x / sx, y: top / sy, w: cw / sx, h: ch / sy,
            visible: Math.round(vis * 100) / 100,
            hasPost: has, postNo: has ? ++posts : 0,
            navLike: !!(nl && looksLikeNavStrip(nl)),
            stats: st ? { frac: round2(st.frac), r: Math.round(st.r), g: Math.round(st.g), b: Math.round(st.b), lum: Math.round(st.lum), std: round2(st.std) } : null
          });
        }
      }
      top += pitch; m++;
    }
    var gridW = 3 * cw + 2 * g;
    var boxBottom = geo.fullRows ? bottomLimit : rows ? lastVisBot : geo.y0;
    var boxTop = Math.max(0, cells.length ? cells[0].y * sy : geo.y0);
    return {
      box: { x: geo.x0 / sx, y: boxTop / sy, w: gridW / sx, h: Math.max(0, boxBottom - boxTop) / sy },
      cols: 3, colW: cw / sx, cellH: ch / sy, gap: g / sx, ratio: geo.ratio,
      rows: rows, posts: posts, cells: cells
    };
  }
  function round2(v) { return Math.round(v * 100) / 100; }

  /* =========================================================
     C. 電腦／iPad：第二輪的通用格線偵測（原樣保留）
     ========================================================= */
  function detectDesktop(px) {
    var bg = estimateBg(px);
    var M = buildMask(px, bg, bg.dark ? 6 : 8);
    var bands = findBands(M);
    var segs = allSegments(M, bands);
    var g = estimateGap(segs, px.w);
    var hyps = makeHypotheses(segs, px.w, g);
    var best = null, bestH = null;
    hyps.forEach(function (H) {
      var sc = scoreHyp(H, segs, M);
      if (!sc) return;
      // 同分時偏好 IG 目前的 3:4
      var s = sc.score * (H.ratio === '3:4' ? 1.02 : 1);
      if (!best || s > best.s) { best = { s: s, sc: sc }; bestH = H; }
    });

    var ctx = { px: px, M: M, bg: bg };
    var res;
    if (!best) {
      res = emptyResult('找不到像貼文格子的方塊');
    } else {
      var H = bestH, sc = best.sc;
      // 用對齊的方塊微調欄寬與左緣
      var cws = [], x0s = [];
      sc.aligned.forEach(function (a) {
        cws.push((a.s.w - (a.n - 1) * H.g) / a.n);
      });
      cws.sort(function (p, q) { return p - q; });
      var cw = cws[cws.length >> 1];
      sc.aligned.forEach(function (a) { x0s.push(a.s.x - a.k * (cw + H.g)); });
      x0s.sort(function (p, q) { return p - q; });
      var x0 = x0s[x0s.length >> 1];
      // 實測比例；接近標準值就吸附
      var rs = sc.aligned.filter(function (a) { return a.complete; }).map(function (a) { return a.s.h / cw; });
      var rr = H.r, rid = H.ratio;
      if (rs.length) {
        rs.sort(function (p, q) { return p - q; });
        var med = rs[rs.length >> 1], near = RATIOS.slice().sort(function (p, q) { return Math.abs(p.r - med) - Math.abs(q.r - med); })[0];
        rr = Math.abs(near.r - med) / near.r < 0.05 ? near.r : med; rid = near.id;
      }
      var geo = { x0: x0, cw: cw, g: H.g, r: rr, ratio: rid, y0: sc.y0, rowTops: sc.rowTops, minRow: sc.minRow };
      res = buildCells(ctx, geo);
      // 信心分數
      var conf = 0.5;
      if (sc.completeN) conf += 0.2;
      if (sc.cells >= 2) conf += 0.15;
      var bigBelow = 0, explained = 0;
      segs.forEach(function (s) {
        if (s.merged || s.y < sc.y0 - 2 || s.w * s.h < px.w * px.h * 0.01) return;
        bigBelow += s.w * s.h;
      });
      sc.aligned.forEach(function (a) { if (!a.s.merged) explained += a.s.w * a.s.h; });
      if (!bigBelow || explained / bigBelow > 0.7) conf += 0.15;
      if (x0 + 3 * cw + 2 * H.g > px.w + 3 || x0 < -3) conf -= 0.3;
      if (!res.posts) conf = Math.min(conf, 0.3);
      res.confidence = Math.max(0, Math.min(1, round2(conf)));
      res.ok = res.confidence >= OK_CONF;
      res.note = res.ok ? '' : '格子區不太確定';
    }
    res.kind = 'desktop';
    res.theme = bg.dark ? 'dark' : 'light';
    Object.defineProperty(res, '_ctx', { value: ctx, enumerable: false, writable: true });
    return res;
  }

  /* =========================================================
     A. 分類＋B. 手機版型定位
     ========================================================= */
  // 手機的背景色：取上方 12% 的眾數（狀態列、頂列都是純背景；四邊常被貼文佔滿，不準）
  function phoneBg(px) {
    var d = px.data, w = px.w, h = px.h, bins = {}, best = null;
    var yEnd = Math.max(2, Math.round(h * 0.12)), sx = Math.max(1, Math.round(w / 160)), sy = Math.max(1, Math.round(yEnd / 120));
    for (var y = 0; y < yEnd; y += sy) for (var x = 0; x < w; x += sx) {
      var i = (y * w + x) * 4;
      var k = (d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3);
      var b = bins[k] || (bins[k] = { n: 0, r: 0, g: 0, b: 0 });
      b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
      if (!best || b.n > best.n) best = b;
    }
    var r = best.r / best.n, g = best.g / best.n, bb = best.b / best.n;
    var lum = 0.299 * r + 0.587 * g + 0.114 * bb;
    return { r: r, g: g, b: bb, lum: lum, dark: lum < 110 };
  }

  // 手機用的像素脈絡（分類與版型定位共用，只算一次）
  function phoneCtx(px) {
    if (px._phone) return px._phone;
    var bg = phoneBg(px);
    var M = buildMask(px, bg, 12); // 門檻稍高：容忍 JPEG（HEIC 轉檔）雜訊
    var c = { px: px, M: M, bg: bg };
    Object.defineProperty(px, '_phone', { value: c, enumerable: false });
    return c;
  }

  // 某個 y 範圍內的橫帶（以「幾乎全是背景的列」切開）
  function bandsIn(M, ya, yb) {
    var lim = Math.max(1, Math.round(M.w * 0.002)), out = [], s = -1;
    for (var y = ya; y <= yb; y++) {
      var blank = y === yb || M.rowCnt[y] <= lim;
      if (!blank && s < 0) s = y;
      if (blank && s >= 0) { out.push({ y0: s, y1: y - 1, h: y - s }); s = -1; }
    }
    return out;
  }
  // 一條橫帶裡的水平小塊（欄投影），間隔 < mergeGap 的併成同一塊（icon 內部常有縫）
  function blobsIn(M, y0, y1, mergeGap) {
    var w = M.w, col = new Int32Array(w), out = [];
    for (var y = y0; y <= y1; y++) { var off = y * w; for (var x = 0; x < w; x++) col[x] += M.m[off + x]; }
    var s = -1, last = -1;
    for (var x2 = 0; x2 <= w; x2++) {
      var on = x2 < w && col[x2] > 0;
      if (on) {
        if (s < 0) s = x2;
        else if (x2 - last - 1 > mergeGap) { out.push({ x0: s, x1: last }); s = x2; }
        last = x2;
      }
    }
    if (s >= 0) out.push({ x0: s, x1: last });
    out.forEach(function (b) { b.w = b.x1 - b.x0 + 1; b.c = (b.x0 + b.x1) / 2; });
    return out;
  }
  // 「深色線」：與背景亮度差很大（淺色模式的黑線、深色模式的白線）；淡灰分隔線不算
  function strongRun(px, bg, y) {
    var d = px.data, w = px.w, best = null, s = -1, total = 0;
    for (var x = 0; x <= w; x++) {
      var on = false;
      if (x < w) {
        var i = (y * w + x) * 4;
        var l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        on = Math.abs(l - bg.lum) > 90;
      }
      if (on) { total++; if (s < 0) s = x; }
      if (!on && s >= 0) { if (!best || x - s > best.w) best = { x0: s, x1: x - 1, w: x - s }; s = -1; }
    }
    if (best) { best.c = (best.x0 + best.x1) / 2; best.total = total; }
    return best;
  }

  // 一整列幾乎是同一個顏色（分隔線）；照片的第一列會有明顯的亮度變化
  function uniformRow(px, y) {
    var d = px.data, w = px.w, n = 0, s = 0, s2 = 0, step = Math.max(1, Math.round(w / 200));
    for (var x = 0; x < w; x += step) {
      var i = (y * w + x) * 4, l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      n++; s += l; s2 += l * l;
    }
    var m = s / n;
    return Math.sqrt(Math.max(0, s2 / n - m * m)) < 8;
  }

  // ===== 底部導覽列：偵測（findNav ＋ 兩種判斷 ＋ 底部帶狀區保險） =====
  /* 一排塊是不是「導覽列的 icon」：
   *  (1) 舊版：5 個等距小 icon，中心在 W*(k+0.5)/5 附近（誤差 4.5%），至少中 4 個
   *  (2) 新版：3 個以上、大致等距（相鄰間距與中位數差 ≤ 25%），橫跨至少半個寬度
   * 兩種都允許「最多 1 塊」寬度在 13%–25%：選中分頁的膠囊底（例如頭像外面那塊灰色圓角底）
   * 回傳 false，或 { pill: 有沒有膠囊底 } */
  function navIconsOk(bl, W) {
    if (bl.length < 3 || bl.length > 6) return false;
    if (bl.some(function (x) { return x.w > W * 0.25; })) return false;
    var wide = bl.filter(function (x) { return x.w > W * 0.13; }).length;
    if (wide > 1) return false;
    var ok = { pill: wide === 1 };
    var hit = {};
    bl.forEach(function (x) {
      var k = Math.round(x.c / W * 5 - 0.5);
      if (k >= 0 && k < 5 && Math.abs(x.c - (k + 0.5) * W / 5) < W * 0.045) hit[k] = 1;
    });
    if (Object.keys(hit).length >= 4) return ok;
    var cs = bl.map(function (x) { return x.c; }).sort(function (a, b) { return a - b; });
    var d = [];
    for (var i = 1; i < cs.length; i++) d.push(cs[i] - cs[i - 1]);
    var med = d.slice().sort(function (a, b) { return a - b; })[d.length >> 1];
    if (med < W * 0.12) return false;
    if (d.some(function (v) { return Math.abs(v - med) > med * 0.25; })) return false;
    return cs[cs.length - 1] - cs[0] >= W * 0.5 ? ok : false;
  }
  /* 保險：圖片最下面約 12% 內，有一條橫跨全寬、和上方格子明顯不同的帶狀區（例如有底色的導覽列）
   * 條件：連續 ≥ 3 列幾乎同色（uniformRow），上方幾列不是同一個純色，和上方格子區的平均亮度差 > 12，
   *      顏色和頁面背景也不同（> 8；和背景同色的導覽列交給上面的 icon 判斷），高度 ≥ 圖高 4%，
   *      而且從這裡到圖底，大部分（≥ 60%）的列都是同一個底色（中間只夾著 icon）。 */
  function findNavBand(P) {
    var px = P.px, W = px.w, H = px.h, d = px.data;
    if (!px.data) return null;
    var step = Math.max(1, Math.round(W / 200));
    function rowLum(y) {
      var s = 0, n = 0;
      for (var x = 0; x < W; x += step) { var i = (y * W + x) * 4; s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; }
      return s / n;
    }
    var y0 = Math.round(H * 0.88), aboveL = 0, na = 0;
    for (var ya = Math.round(H * 0.7); ya < y0; ya += 4) { aboveL += rowLum(ya); na++; }
    aboveL = na ? aboveL / na : 0;
    for (var y = y0; y < H - 4; y++) {
      if (!(uniformRow(px, y) && uniformRow(px, y + 1) && uniformRow(px, y + 2))) continue;
      var L = rowLum(y);
      if (H - y < H * 0.04) break;
      var yUp = Math.max(0, y - 3); // 縮圖會把交界那一列混色，往上多看幾列
      if ((uniformRow(px, yUp) && Math.abs(L - rowLum(yUp)) <= 6) || Math.abs(L - aboveL) <= 12) continue;
      if (P.bg && P.bg.lum !== undefined && Math.abs(L - P.bg.lum) <= 8) continue;
      var same = 0, tot = 0;
      for (var yy = y; yy < H; yy += 2) { tot++; if (Math.abs(rowLum(yy) - L) < 10) same++; }
      if (tot && same / tot >= 0.6) return { top: y, iconY0: y, iconY1: H - 1, home: false, band: true };
    }
    return null;
  }
  /* 底部導覽列：先找 icon 列（navIconsOk），再找底部帶狀區（findNavBand）；都沒有回傳 null */
  function findNav(P) {
    var M = P.M, W = M.w, H = M.h;
    var bands = bandsIn(M, Math.round(H * 0.82), H);
    var home = null, icons = null, pill = false;
    for (var i = bands.length - 1; i >= 0; i--) {
      var b = bands[i];
      if (!home && !icons && b.h <= H * 0.012 && b.y0 > H * 0.95) {
        var hb = blobsIn(M, b.y0, b.y1, Math.round(W * 0.01));
        if (hb.length === 1 && hb[0].w > W * 0.2 && hb[0].w < W * 0.5 && Math.abs(hb[0].c - W / 2) < W * 0.05) { home = b; continue; }
      }
      if (b.h < W * 0.015 || b.h > W * 0.1) continue;
      var okN = navIconsOk(blobsIn(M, b.y0, b.y1, Math.round(W * 0.02)), W);
      if (okN) { icons = b; pill = okN.pill; break; }
    }
    if (!icons) return findNavBand(P);
    // 導覽列上緣：icon 之上若有一條分隔線就用它，否則留 icon 高度的 0.7 倍
    // （有膠囊底時這條帶子的高度是膠囊高，比 icon 高很多 → 只留 0.2 倍）
    var top = Math.max(0, icons.y0 - Math.round(icons.h * (pill ? 0.2 : 0.7)));
    var j = bands.indexOf(icons);
    if (j > 0) {
      var prev = bands[j - 1];
      if (prev.h <= 3 && icons.y0 - prev.y1 < icons.h * 1.6 && M.rowCnt[prev.y0] > W * 0.85) top = prev.y0;
    }
    return { top: top, iconY0: icons.y0, iconY1: icons.y1, home: !!home, pill: pill };
  }

  /* 頂部狀態列：上方 7% 內有一條細帶，左邊有時間、右邊有訊號／電量 */
  function findStatus(P) {
    var M = P.M, W = M.w, H = M.h;
    var bands = bandsIn(M, 0, Math.round(H * 0.07));
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      if (b.h > H * 0.035) continue;
      var bl = blobsIn(M, b.y0, b.y1, Math.round(W * 0.015));
      var left = bl.some(function (x) { return x.c > W * 0.05 && x.c < W * 0.35 && x.w < W * 0.25; });
      var right = bl.some(function (x) { return x.c > W * 0.65 && x.c < W * 0.97 && x.w < W * 0.3; });
      if (left && right) return true;
    }
    return false;
  }

  function classifyPx(px) {
    var W = px.nw, H = px.nh, ar = H / W, P = phoneCtx(px);
    var nav = findNav(P), status = findStatus(P), kind, reason;
    if (ar >= 1.7) { kind = 'phone'; reason = '高÷寬 ' + ar.toFixed(2) + ' ≥ 1.7'; }
    else if (ar >= 1.6 && nav && status) { kind = 'phone'; reason = '高÷寬 ' + ar.toFixed(2) + '，有狀態列與底部導覽列'; }
    else if (W > H) { kind = 'desktop'; reason = '橫式（寬 > 高）'; }
    else if (ar >= 1.25) { kind = 'ipad'; reason = '高÷寬 ' + ar.toFixed(2) + '，介於手機與電腦之間'; }
    else { kind = 'uncertain'; reason = '高÷寬 ' + ar.toFixed(2) + '，接近正方形'; }
    return { kind: kind, ar: round2(ar), status: status, nav: !!nav, reason: reason };
  }

  /* 分頁 icon 列：由上往下找第一條符合特徵的橫帶 */
  function findTabRow(P, yLimit) {
    var M = P.M, px = P.px, W = M.w, H = M.h;
    var bands = bandsIn(M, Math.round(H * 0.06), yLimit);
    var fallback = null;
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      // icon 大小跟著寬度走（各機型、裁切過的截圖都一樣），所以用寬度當尺度，不用高度
      if (b.h < W * 0.015 || b.h > W * 0.095) continue;
      var bl = blobsIn(M, b.y0, b.y1, Math.round(W * 0.02));
      var n = bl.length;
      if (n < 3 || n > 4) continue;
      var ws = bl.map(function (x) { return x.w; });
      var wMin = Math.min.apply(null, ws), wMax = Math.max.apply(null, ws);
      if (wMin < W * 0.018 || wMax > W * 0.11 || wMax / wMin > 2.6) continue;
      var aligned = bl.every(function (x, k) { return Math.abs(x.c - (k + 0.5) * W / n) < W * 0.035; });
      if (!aligned) continue;
      // 底線：分頁列下方不遠處，一條很深（或很亮）的短橫線，只在其中一個 icon 下
      var ul = null, sep = null, yEnd = Math.min(H - 1, b.y1 + Math.round(W * 0.07));
      for (var y = b.y1 + 1; y <= yEnd; y++) {
        var run = strongRun(px, P.bg, y);
        if (run && run.w >= W * 0.04 && run.w <= W * (1 / n + 0.04) && run.total < run.w * 1.3) {
          var under = bl.filter(function (x) { return Math.abs(x.c - run.c) < W * 0.05; });
          if (under.length === 1) {
            if (!ul) ul = { y0: y, y1: y, x0: run.x0, x1: run.x1, tab: bl.indexOf(under[0]) };
            else if (y === ul.y1 + 1) ul.y1 = y;
          }
        } else if (ul && y > ul.y1 + 1 && !sep) {
          // 底線之後的細分隔線（淡灰、近乎全寬、整條同一個顏色；貼文第一列不是）
          if (M.rowCnt[y] > W * 0.85 && uniformRow(px, y)) sep = { y0: y, y1: y };
        }
        if (!ul && M.rowCnt[y] > W * 0.85 && uniformRow(px, y)) { if (!sep) sep = { y0: y, y1: y }; else if (y === sep.y1 + 1) sep.y1 = y; }
        if (sep && y > sep.y1 + 1 && M.rowCnt[y] > W * 0.25) break; // 已經進到貼文
      }
      if (ul && ul.y1 - ul.y0 > W * 0.012) ul = null; // 太粗，不是底線
      if (sep && y > sep.y1 + 1 && M.rowCnt[sep.y1 + 1] > W * 0.85 && uniformRow(px, sep.y1 + 1)) sep.y1++;
      var hit = { y0: b.y0, y1: b.y1, n: n, centers: bl.map(function (x) { return x.c; }), underline: ul, separator: sep };
      hit.bottom = Math.max(b.y1, ul ? ul.y1 : 0, sep ? sep.y1 : 0);
      if (ul) return hit;
      if (sep && !fallback) fallback = hit; // 沒底線但有分隔線：備用，信心較低
    }
    return fallback;
  }

  // 每一欄的「與背景差異」逐列平均（量列縫、量貼文高度用）
  function colProfile(px, bg, xa, xb, ya, yb) {
    var d = px.data, w = px.w, out = new Float32Array(Math.max(0, yb - ya));
    var step = Math.max(1, Math.round((xb - xa) / 120));
    for (var y = ya; y < yb; y++) {
      var off = y * w, s = 0, n = 0;
      for (var x = Math.round(xa); x < xb; x += step) {
        var i = (off + x) * 4;
        s += Math.max(Math.abs(d[i] - bg.r), Math.abs(d[i + 1] - bg.g), Math.abs(d[i + 2] - bg.b)); n++;
      }
      out[y - ya] = n ? s / n : 0;
    }
    return out;
  }
  function median(arr, a, b) {
    a = Math.max(0, Math.round(a)); b = Math.min(arr.length, Math.round(b));
    if (b <= a) return 0;
    var v = Array.prototype.slice.call(arr, a, b).sort(function (p, q) { return p - q; });
    return v[v.length >> 1];
  }
  function meanOf(arr, a, b) {
    a = Math.max(0, Math.round(a)); b = Math.min(arr.length, Math.round(b));
    if (b <= a) return 0;
    var s = 0; for (var i = a; i < b; i++) s += arr[i];
    return s / (b - a);
  }
  function minOf(arr, a, b) {
    a = Math.max(0, Math.round(a)); b = Math.min(arr.length, Math.round(b));
    var m = Infinity; for (var i = a; i < b; i++) if (arr[i] < m) m = arr[i];
    return m;
  }

  /* 量格子比例：在預期的列縫位置找「差異突然變小」的縫；量不到就量第一篇的高度 */
  function measureRatio(P, top, bottom, cw, g) {
    var px = P.px, prof = [];
    for (var c = 0; c < 3; c++) {
      var x = c * (cw + g);
      prof.push(colProfile(px, P.bg, x + cw * 0.06, x + cw * 0.94, top, bottom));
    }
    var best = null;
    RATIOS.forEach(function (R, ri) {
      var ch = cw * R.r, score = 0, miss = 0;
      for (var row = 1; row <= 3; row++) {
        var ys = row * ch + (row - 1) * g; // 相對 top 的列縫位置
        if (ys + g + 4 > bottom - top) break;
        for (var c2 = 0; c2 < 3; c2++) {
          var p = prof[c2];
          var inside = median(p, ys - ch * 0.12, ys - ch * 0.03);
          if (inside < 8) continue;                                  // 這格沒貼文
          var nearEnd = meanOf(p, ys - ch * 0.025, ys - 3);
          if (nearEnd < inside * 0.5) { miss++; continue; }          // 貼文在列縫之前就結束了 → 不是這個比例
          var dip = minOf(p, ys - 2, ys + g + 3);
          if (dip <= inside * 0.6) score++; else miss++;             // 該有縫的地方沒有縫 → 扣分
        }
      }
      var s = score - miss + (R.id === '3:4' ? 0.2 : R.id === '4:5' ? 0.1 : 0);
      if (score && score > miss && (!best || s > best.s)) best = { s: s, R: R, score: score };
    });
    if (best) return { R: best.R, how: 'seam', seams: best.score };
    // 量不到列縫（例如只有 1 篇、底下全白）→ 量第一篇的非背景高度
    var p0 = prof[0], head = median(p0, 0, Math.min(p0.length, cw * 0.3));
    if (head >= 8) {
      var run = 0, end = -1;
      for (var y = 0; y < p0.length; y++) {
        if (p0[y] < Math.max(3, head * 0.15)) { run++; if (run >= 6) { end = y - run + 1; break; } }
        else run = 0;
      }
      if (end > 0) {
        var r0 = end / cw, near = RATIOS.slice().sort(function (a, b) { return Math.abs(a.r - r0) - Math.abs(b.r - r0); })[0];
        if (Math.abs(near.r - r0) / near.r < 0.06) return { R: near, how: 'post' };
      }
    }
    return { R: ratioById('3:4'), how: 'guess' };
  }

  function detectPhone(px) {
    var P = phoneCtx(px), M = P.M, W = px.w, H = px.h;
    var nav = findNav(P);
    // 找不到導覽列：不要延伸到圖底（導覽列常常就在最下面 10%），改停在 H*0.9，最後一排再跑 contentBottom
    var bottom = nav ? nav.top : Math.round(H * 0.9);
    var tab = findTabRow(P, Math.round(nav ? nav.top : H * 0.94));
    var ctx = { px: px, M: M, bg: P.bg };
    var res;
    var navOrig = nav ? { top: nav.top / px.sy } : null;
    if (!tab) {
      res = emptyResult('找不到 IG 的分頁圖示列');
      var fy = H * 0.45;
      res.manualFrame = { x: 0, y: fy / px.sy, w: px.nw, h: Math.max(H * 0.2, bottom - fy) / px.sy };
    } else {
      var top = tab.bottom + 1;
      // 第一篇貼文若緊接在下方（2.5% 圖高內），以它的上緣為準；要連續 3 列都夠寬才算（避免把底線、分隔線當貼文）
      for (var y = top; y < Math.min(bottom - 3, top + W * 0.05); y++) {
        if (M.rowCnt[y] > W * 0.15 && M.rowCnt[y + 1] > W * 0.15 && M.rowCnt[y + 2] > W * 0.15) { top = y; break; }
      }
      var g = Math.max(1, Math.round(W * 0.0025));
      var cw = (W - 2 * g) / 3;
      var mr = measureRatio(P, top, bottom, cw, g);
      var geo = { x0: 0, cw: cw, g: g, r: mr.R.r, ratio: mr.R.id, y0: top, bottom: bottom, minRow: 0, fullRows: true, trimLast: !nav };
      res = buildCells(ctx, geo);
      res.box = { x: 0, y: top / px.sy, w: px.nw, h: (bottom - top) / px.sy };
      res.ratioGuessed = mr.how === 'guess';
      res.ratioHow = mr.how;
      var conf = tab.underline ? 0.92 : 0.72;
      if (res.ratioGuessed) conf -= 0.08;
      if (!res.rows) conf = 0.3;
      res.confidence = round2(conf);
      res.ok = res.confidence >= OK_CONF;
      res.note = res.ok ? '' : '分頁列下方看不到貼文格';
      res.tabRow = { y: tab.y0 / px.sy, h: (tab.y1 - tab.y0 + 1) / px.sy, bottom: tab.bottom / px.sy, icons: tab.n, underline: !!tab.underline, separator: !!tab.separator };
      res.manualFrame = { x: 0, y: res.box.y, w: px.nw, h: res.box.h };
    }
    res.nav = navOrig;
    res.kind = 'phone';
    res.theme = P.bg.dark ? 'dark' : 'light';
    Object.defineProperty(res, '_ctx', { value: ctx, enumerable: false, writable: true });
    return res;
  }

  /* ---------- 主函式：先分類、再偵測 ---------- */
  function run(px, forced) {
    var t0 = now();
    var cls = classifyPx(px), res;
    var kind = forced || cls.kind;
    if (kind === 'phone') res = detectPhone(px);
    else if (kind === 'desktop' || kind === 'ipad') res = detectDesktop(px);
    else {
      // 不確定：兩種都試，挑可信度高的（介面仍會問使用者）
      var a = detectPhone(px), b = detectDesktop(px);
      if (a.ok && (!b.ok || a.confidence >= b.confidence)) res = a;
      else if (b.ok) res = b;
      else { res = a; res.manualFrame = res.manualFrame || null; }
      res.tried = ['phone', 'desktop'];
    }
    res.cls = cls;
    res.forced = forced || null;
    res.mode = 'auto';
    res.image = { w: px.nw, h: px.nh };
    res.ms = Math.round(now() - t0);
    if (!res.manualFrame && res.box) res.manualFrame = { x: res.box.x, y: res.box.y, w: res.box.w, h: res.box.h };
    Object.defineProperty(res, '_px', { value: px, enumerable: false });
    return res;
  }
  function now() { return (typeof performance !== 'undefined' ? performance : Date).now(); }

  /* 讀圖並縮到「分析用」寬度（預設 1080，等比）。
   *   blob：File／Blob；url：同一張圖的 object URL（預覽也用它，不另外解碼一次）
   *   回傳 Promise<{ src, w, h, how }>：src 是縮小後的 ImageBitmap 或 canvas（寬 ≤ maxW），w/h 是原圖尺寸。
   *   用完請呼叫 GridDetect.release(src)（ImageBitmap.close()／canvas 寬高設 0）。
   *   iOS Safari 的 canvas 面積上限約 16.7M 像素，全解析度 1290×2796 也還在上限內，但縮到 1080 寬可省一半以上記憶體。 */
  function decode(blob, url, maxW) {
    maxW = maxW || MAX_W;
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { resolve(img); };
      img.onerror = function () { var e = new Error('decode'); e.code = 'decode'; reject(e); };
      img.src = url;
    }).then(function (img) {
      var w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) { var e = new Error('decode'); e.code = 'decode'; throw e; }
      if (w <= maxW) return { src: img, w: w, h: h, how: 'original' };
      var tw = maxW, th = Math.max(1, Math.round(h * maxW / w));
      function viaCanvas() {
        var cv = document.createElement('canvas');
        cv.width = tw; cv.height = th;
        var c = cv.getContext('2d');
        c.imageSmoothingQuality = 'high';
        c.drawImage(img, 0, 0, tw, th);
        return { src: cv, w: w, h: h, how: 'canvas' };
      }
      if (typeof createImageBitmap !== 'function' || !blob) return viaCanvas();
      return createImageBitmap(blob, { resizeWidth: tw, resizeHeight: th, resizeQuality: 'high' }).then(function (bmp) {
        if (bmp.width !== tw) { try { bmp.close(); } catch (e) {} return viaCanvas(); } // 舊版 Safari 會忽略 resize 選項
        return { src: bmp, w: w, h: h, how: 'createImageBitmap' };
      }, viaCanvas);
    });
  }
  function release(src) {
    if (!src) return;
    try { if (typeof src.close === 'function') src.close(); } catch (e) {}
    if (src.getContext) { src.width = 0; src.height = 0; }
  }

  function detect(src, opts) {
    opts = opts || {};
    return run(getPixels(src, opts.full), opts.kind);
  }
  function redetect(prev, kind) {
    return run(prev._px, kind);
  }
  function classify(src, opts) {
    return classifyPx(getPixels(src, opts && opts.full));
  }

  function emptyResult(note) {
    return {
      ok: false, confidence: 0, box: null, cols: 3, colW: 0, cellH: 0, gap: 0, ratio: '3:4',
      rows: 0, posts: 0, cells: [], note: note
    };
  }

  /* 使用者手動拖框：frame 為原圖像素 {x,y,w,h}；ratioId 預設沿用偵測結果 */
  function fromFrame(prev, frame, ratioId) {
    var ctx = prev._ctx, px = ctx.px;
    var R = ratioById(ratioId || prev.ratio || '3:4');
    var g = Math.max(1, Math.round(px.w * 0.002));
    var x0 = frame.x * px.sx, w = frame.w * px.sx;
    var cw = (w - 2 * g) / 3;
    var geo = { x0: x0, cw: cw, g: g, r: R.r, ratio: R.id, y0: frame.y * px.sy, bottom: Math.min(px.h, (frame.y + frame.h) * px.sy), minRow: 0, fullRows: true };
    var res = buildCells(ctx, geo);
    res.box = { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
    res.ok = true; res.confidence = 1; res.mode = 'manual'; res.note = '';
    res.theme = prev.theme; res.image = prev.image; res.kind = prev.kind; res.cls = prev.cls; res.forced = prev.forced;
    res.manualFrame = { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
    Object.defineProperty(res, '_ctx', { value: ctx, enumerable: false });
    Object.defineProperty(res, '_px', { value: prev._px, enumerable: false });
    return res;
  }

  /* ---------- 建議封存：依貼文數決定格數，挑最突兀的格子 ---------- */
  function archiveCount(posts) {
    if (posts <= 5) return 0;
    if (posts <= 11) return 1;
    return 2;
  }

  function toLab(r, g, b) {
    function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var R = lin(r), G = lin(g), B = lin(b);
    var X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    var Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
    var Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    var fx = f(X), fy = f(Y), fz = f(Z);
    return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }

  function pickArchive(res) {
    var posts = res.cells.filter(function (c) { return c.hasPost && c.stats; });
    var n = archiveCount(posts.length);
    if (!n) return [];
    var labs = posts.map(function (c) { return toLab(c.stats.r, c.stats.g, c.stats.b); });
    var mL = 0, ma = 0, mb = 0;
    labs.forEach(function (l) { mL += l.L; ma += l.a; mb += l.b; });
    mL /= labs.length; ma /= labs.length; mb /= labs.length;
    var mC = Math.sqrt(ma * ma + mb * mb);
    var scored = posts.map(function (c, i) {
      var l = labs[i], C = Math.sqrt(l.a * l.a + l.b * l.b);
      var dE = Math.sqrt((l.L - mL) * (l.L - mL) + (l.a - ma) * (l.a - ma) + (l.b - mb) * (l.b - mb));
      var dC = C - mC;
      return { cell: c, score: dE + Math.max(0, dC) * 0.5, dE: dE, dC: dC, dL: l.L - mL, db: l.b - mb, lab: l };
    }).sort(function (p, q) { return q.score - p.score; });
    return scored.slice(0, n).map(function (x) {
      return { cell: x.cell, no: x.cell.postNo, reason: describe(x) };
    });
  }

  function describe(x) {
    var bits = [];
    if (x.db < -8) bits.push('偏冷');
    else if (x.db > 8) bits.push('偏暖');
    if (x.dL < -12) bits.push('偏暗');
    else if (x.dL > 12) bits.push('偏亮');
    if (x.dC > 12) bits.push('飽和度特別高');
    var head = bits.length ? '這格' + bits.join('、') + '，' : '';
    if (x.dC > 12 && x.dC * 0.5 > x.dE * 0.4) return head + '在縮圖上最先跳出來，和其他格不像同一組。';
    return head + '和整頁的平均色差最大，是最不合群的一格。';
  }

  window.GridDetect = {
    RATIOS: RATIOS,
    OK_CONF: OK_CONF,
    detect: detect,
    redetect: redetect,
    classify: classify,
    decode: decode,
    release: release,
    MAX_W: MAX_W,
    fromFrame: fromFrame,
    pickArchive: pickArchive,
    archiveCount: archiveCount,
    usableCell: usableCell,
    // 測試／除錯用（不屬於穩定介面）
    _dbg: { getPixels: getPixels, phoneCtx: phoneCtx, bandsIn: bandsIn, blobsIn: blobsIn, findTabRow: findTabRow, findNav: findNav, navStripStats: navStripStats, looksLikeNavStrip: looksLikeNavStrip }
  };
})();
