/*
 * grid-detect.js — 在瀏覽器本地偵測 IG 主頁截圖裡的「貼文格子區」
 * ------------------------------------------------------------
 * 純 canvas 像素分析：不呼叫 AI、不花 token、不送出網路。
 *
 * 公開介面（掛在 window.GridDetect）：
 *   GridDetect.detect(imageOrCanvas)            → Result
 *   GridDetect.fromFrame(result, frame, ratio)  → Result（使用者手動拖框後重算）
 *   GridDetect.pickArchive(result)              → [{ cell, no, reason }]（依貼文數決定 0／1／2 格）
 *   GridDetect.archiveCount(posts)              → 0 | 1 | 2
 *
 * Result（座標都是原圖像素）：
 *   { ok, confidence, mode:'auto'|'manual', theme:'light'|'dark',
 *     box:{x,y,w,h}, cols:3, colW, cellH, gap, ratio:'3:4'|'4:5'|'1:1',
 *     rows, posts, cells:[{ i,row,col,x,y,w,h,visible,hasPost,postNo,stats }], note }
 *
 * 方法（詳見 README「格線偵測」）：
 *   1. 估背景色：取四邊像素做色彩量化，取眾數（淺色、深色模式都適用）。
 *   2. 「非背景」遮罩：與背景色最大通道差 > 門檻。
 *   3. 逐列投影：全是背景的列把畫面切成橫帶（頭像、簡介、按鈕、精選、分頁列、每一排貼文…）。
 *   4. 每條橫帶再做欄投影，切出「方塊」，並找出方塊真正的上下緣。
 *   5. 對每個大方塊提出假設：欄寬 cw、比例（3:4／4:5／1:1）、左緣 x0、縫寬 gap，
 *      用「能解釋幾格貼文」替每個假設打分 —— 頭像、按鈕、精選動態都對不上 3 欄等寬方格，自然被排除；
 *      左右留邊（電腦版、iPad）也因為 x0 由方塊位置推得而自動排除。
 *   6. 用最佳假設從格子區頂端往下排列，逐格檢查「格內有沒有非背景、有變化」→ 判斷是否真的有貼文。
 *   7. 信心分數低於 0.6 → 介面請使用者手動拖框。
 */
(function () {
  'use strict';

  var RATIOS = [{ id: '3:4', r: 4 / 3 }, { id: '4:5', r: 5 / 4 }, { id: '1:1', r: 1 }];
  var MAX_W = 900;           // 工作解析度：寬度上限（效能）
  var MIN_CELL = 0.12;       // 貼文格寬至少佔截圖寬度的比例
  var OK_CONF = 0.6;

  function ratioById(id) {
    for (var i = 0; i < RATIOS.length; i++) if (RATIOS[i].id === id) return RATIOS[i];
    return RATIOS[0];
  }

  /* ---------- 1. 讀像素 ---------- */
  function getPixels(src) {
    var nw = src.naturalWidth || src.width, nh = src.naturalHeight || src.height;
    var s = Math.min(1, MAX_W / nw);
    var w = Math.max(1, Math.round(nw * s)), h = Math.max(1, Math.round(nh * s));
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    var id = ctx.getImageData(0, 0, w, h);
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

  function buildCells(ctx, geo) {
    var px = ctx.px, M = ctx.M, sx = px.sx, sy = px.sy;
    var cw = geo.cw, g = geo.g, ch = cw * geo.r, pitch = ch + g;
    var bottomLimit = geo.bottom !== undefined ? geo.bottom : px.h;
    var cells = [], rows = 0, top = geo.y0, m = 0, posts = 0, lastVisBot = 0;
    while (top < bottomLimit - ch * 0.35 && m < 60) {
      if (geo.rowTops && geo.rowTops[m + geo.minRow] !== undefined) top = geo.rowTops[m + geo.minRow];
      var visTop = Math.max(0, top), visBot = Math.min(bottomLimit, top + ch);
      visBot = contentBottom(M, geo.x0, 3 * cw + 2 * g, visTop, visBot, ch);
      var vis = Math.max(0, visBot - visTop) / ch;
      if (vis >= 0.35) {
        rows++; lastVisBot = visBot;
        for (var k = 0; k < 3; k++) {
          var x = geo.x0 + k * (cw + g);
          var st = cellStats(px, M, x, visTop, cw, visBot - visTop);
          var has = looksLikePost(st);
          cells.push({
            i: cells.length, row: rows - 1, col: k,
            x: x / sx, y: top / sy, w: cw / sx, h: ch / sy,
            visible: Math.round(vis * 100) / 100,
            hasPost: has, postNo: has ? ++posts : 0,
            stats: st ? { frac: round2(st.frac), r: Math.round(st.r), g: Math.round(st.g), b: Math.round(st.b), lum: Math.round(st.lum), std: round2(st.std) } : null
          });
        }
      }
      top += pitch; m++;
    }
    var gridW = 3 * cw + 2 * g;
    var boxBottom = rows ? lastVisBot : geo.y0;
    var boxTop = Math.max(0, cells.length ? cells[0].y * sy : geo.y0);
    return {
      box: { x: geo.x0 / sx, y: boxTop / sy, w: gridW / sx, h: Math.max(0, boxBottom - boxTop) / sy },
      cols: 3, colW: cw / sx, cellH: ch / sy, gap: g / sx, ratio: geo.ratio,
      rows: rows, posts: posts, cells: cells
    };
  }
  function round2(v) { return Math.round(v * 100) / 100; }

  /* ---------- 主函式 ---------- */
  function detect(src) {
    var px = getPixels(src);
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
      res = emptyResult(px, bg, '找不到像貼文格子的方塊');
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
    res.mode = 'auto';
    res.theme = bg.dark ? 'dark' : 'light';
    res.image = { w: px.nw, h: px.nh };
    Object.defineProperty(res, '_ctx', { value: ctx, enumerable: false });
    return res;
  }

  function emptyResult(px, bg, note) {
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
    var geo = { x0: x0, cw: cw, g: g, r: R.r, ratio: R.id, y0: frame.y * px.sy, bottom: Math.min(px.h, (frame.y + frame.h) * px.sy), minRow: 0 };
    var res = buildCells(ctx, geo);
    res.box = { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
    res.ok = true; res.confidence = 1; res.mode = 'manual'; res.note = '';
    res.theme = prev.theme; res.image = prev.image;
    Object.defineProperty(res, '_ctx', { value: ctx, enumerable: false });
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
    fromFrame: fromFrame,
    pickArchive: pickArchive,
    archiveCount: archiveCount
  };
})();
