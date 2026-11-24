/*
 * 留格 — 第 5 步：版面星數（純計算，不碰 DOM 版面）
 * 對每格算平均亮度與色相 → 相鄰格明暗差、色相差、同類相黏 → 0–100 分 → 1–5 星＋一句最主要原因。
 * 明暗棋盤的想法同 js/grid.js（AFTER_ORDER：亮暗交錯、同類隔開）。
 * 呼叫端（js/app.js updateLayoutScore）只在放開／互換／復原後呼叫，拖曳中不算。
 */
(function () {
  'use strict';

  // ===== 版面星數：門檻 =====
  var DARK = 0.38;      // 亮度低於這個算暗照片
  var LIGHT = 0.74;     // 亮度高於這個算亮照片
  var FLAT = 0.06;      // 相鄰明暗差小於這個算「糊成一片」
  var SAT_MIN = 0.22;   // 飽和度太低就不看色相
  var HUE_CLASH = 0.22; // 色相差（0–0.5 圈）超過這個算打架
  var PEN = { dark: 14, light: 7, clash: 9, flat: 4 };

  // ===== 版面星數：顏色取樣（canvas／img／色碼；圖片結果依網址快取） =====
  var urlCache = {};
  var sc = null;
  function stats(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d + 6) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { l: 0.299 * r + 0.587 * g + 0.114 * b, h: h, s: mx ? d / mx : 0 };
  }
  function fromHex(hex) {
    var n = parseInt(String(hex).replace('#', ''), 16);
    return isNaN(n) ? null : stats((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
  function fromDrawable(src) {
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    if (!w || !h) return null;
    sc = sc || document.createElement('canvas');
    sc.width = 12; sc.height = 15;
    var ctx = sc.getContext('2d', { willReadFrequently: true });
    try {
      ctx.drawImage(src, 0, 0, 12, 15);
      var d = ctx.getImageData(0, 0, 12, 15).data, R = 0, G = 0, B = 0, n = d.length / 4;
      for (var i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; }
      return stats(R / n, G / n, B / n);
    } catch (e) { return null; }
  }
  // src：{ canvas } ／ { img, url } ／ { hex }；回傳 { l, h, s } 或 null（圖片還沒載好）
  function measure(src) {
    if (!src) return null;
    if (src.hex) return fromHex(src.hex);
    if (src.canvas) return fromDrawable(src.canvas);
    if (src.img) {
      if (src.url && urlCache[src.url]) return urlCache[src.url];
      if (!src.img.complete || !src.img.naturalWidth) return null;
      var s = fromDrawable(src.img);
      if (s && src.url) urlCache[src.url] = s;
      return s;
    }
    return null;
  }

  // ===== 版面星數：相鄰比較與計分 =====
  function hueDist(a, b) { var d = Math.abs(a - b); return d > 0.5 ? 1 - d : d; }
  // cells：每格 { l, h, s } 或 null（空格不算）；cols 預設 3
  function score(cells, cols) {
    cols = cols || 3;
    var pens = { dark: [], light: [], clash: [], flat: [] };
    var pairs = 0, dlSum = 0;
    function pair(i, j) {
      var a = cells[i], b = cells[j];
      if (!a || !b) return;
      pairs++;
      var dl = Math.abs(a.l - b.l);
      dlSum += dl;
      var where = [i + 1, j + 1];
      if (a.l < DARK && b.l < DARK) pens.dark.push(where);
      else if (a.l > LIGHT && b.l > LIGHT) pens.light.push(where);
      else if (dl < FLAT) pens.flat.push(where);
      if (Math.min(a.s, b.s) > SAT_MIN && hueDist(a.h, b.h) > HUE_CLASH) pens.clash.push(where);
    }
    for (var i = 0; i < cells.length; i++) {
      if ((i % cols) < cols - 1 && i + 1 < cells.length) pair(i, i + 1);
      if (i + cols < cells.length) pair(i, i + cols);
    }
    if (!pairs) return { score: 60, stars: 3, reason: '格子太少，還看不出整體節奏' };
    var total = 0, top = null, topPen = 0;
    Object.keys(pens).forEach(function (k) {
      var p = pens[k].length * PEN[k];
      total += p;
      if (p > topPen) { topPen = p; top = k; }
    });
    // 以 3×3（12 組相鄰）為基準換算，格子多寡不影響分數尺度
    var s = Math.round(Math.max(0, Math.min(100, 100 - total * 12 / pairs)));
    var stars = s >= 85 ? 5 : s >= 70 ? 4 : s >= 55 ? 3 : s >= 40 ? 2 : 1;
    // spots：主要原因牽涉到的相鄰格（1 起算，例如 [[4,5],[5,8]]），給「最多只能到」文案判斷是不是舊貼文造成的
    return { score: s, stars: stars, reason: reasonOf(top, pens, dlSum / pairs), spots: top ? pens[top].slice() : [] };
  }

  // ===== 版面星數：一句最主要原因 =====
  function reasonOf(top, pens, avgDl) {
    if (!top) return avgDl >= 0.12 ? '明暗交錯得很平均' : '整體色調很一致，看起來很乾淨';
    var w = pens[top][0], at = '第 ' + w[0] + '、' + w[1] + ' 格';
    var more = (pens[top].length > 1 ? '等 ' + pens[top].length + ' 處' : '') + '：';
    switch (top) {
      case 'dark':  return at + more + '兩張暗照片貼在一起';
      case 'light': return at + more + '兩張亮照片貼在一起，有點糊成一片';
      case 'clash': return at + more + '色調差太多，互相打架';
      default:      return at + more + '明暗太接近，少了節奏';
    }
  }

  // ===== 版面星數：和上一次比較、顯示文字 =====
  function compare(prev, cur) {
    if (!prev || !cur) return '';
    if (cur.score > prev.score) return '比剛剛好';
    if (cur.score < prev.score) return '比剛剛差';
    return '跟剛剛一樣';
  }
  function starText(n) { return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }

  // ===== 版面星數：對外 API =====
  window.LayoutScore = { measure: measure, score: score, compare: compare, starText: starText };
})();
