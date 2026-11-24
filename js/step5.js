/*
 * step5.js — 第五步：排列順序的核心（純資料，不碰 DOM）
 * ------------------------------------------------------------
 * 視覺順序是一個陣列，標準搬移：remove(from) 再 insert(to)。
 * 這個檔建立 window.Step5；其他子模組（載入順序在本檔之後）往上掛：
 *   js/step5-drag.js  拖曳（hitIndex、bindDrag）
 *   js/step5-swap.js  點選互換（arraySwap、swapTap、markSel、flashSwap）
 * 「拿掉／還原」目前在 app.js（第 5 步區段），見 FILEMAP.md。
 */
(function () {
  'use strict';

  // ===== 順序：搬移 =====
  function arrayMove(arr, from, to) {
    var next = arr.slice();
    if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next;
    var item = next.splice(from, 1)[0];
    next.splice(to, 0, item);
    return next;
  }

  // ===== 順序：同步（新照片／舊貼文／釘選） =====
  function syncOrder(order, photoIds, oldKs, pins) {
    order = (order || []).slice();
    pins = (pins || []).filter(function (k) { return oldKs.indexOf(k) >= 0; });
    order = order.filter(function (it) {
      return it.t === 'n' ? photoIds.indexOf(it.id) >= 0 : oldKs.indexOf(it.k) >= 0;
    });
    var pinCount = 0;
    while (pinCount < order.length && order[pinCount].t === 'o' && pins.indexOf(order[pinCount].k) >= 0) pinCount++;
    var missingN = photoIds.filter(function (id) { return !order.some(function (it) { return it.t === 'n' && it.id === id; }); });
    missingN.forEach(function (id, i) { order.splice(pinCount + i, 0, { t: 'n', id: id }); });
    oldKs.slice().sort(function (a, b) { return a - b; }).forEach(function (k) {
      if (!order.some(function (it) { return it.t === 'o' && it.k === k; })) order.push({ t: 'o', k: k });
    });
    var pinItems = [];
    pins.forEach(function (k) {
      var i = -1;
      for (var j = 0; j < order.length; j++) if (order[j].t === 'o' && order[j].k === k) { i = j; break; }
      if (i >= 0) pinItems.push(order.splice(i, 1)[0]);
    });
    return pinItems.concat(order);
  }

  // ===== 順序：舊貼文是否被移動過 =====
  /* 未釘選的舊貼文若不在「新照片全部在前、舊貼文依原始索引」的位置，就算被移動過 */
  function shifted(order, k, pins) {
    pins = pins || [];
    if (pins.indexOf(k) >= 0) return false;
    var idx = -1;
    for (var i = 0; i < order.length; i++) if (order[i].t === 'o' && order[i].k === k) { idx = i; break; }
    if (idx < 0) return false;
    var news = 0, olds = [];
    order.forEach(function (it) {
      if (it.t === 'n') news++;
      else if (pins.indexOf(it.k) < 0) olds.push(it.k);
    });
    var sorted = olds.slice().sort(function (a, b) { return a - b; });
    var natural = pins.length + news + sorted.indexOf(k);
    return idx !== natural;
  }

  // ===== IG 待辦清單（發文順序、釘選、封存） =====
  function tasks(order, pins, archived) {
    var news = order.filter(function (it) { return it.t === 'n'; }).length;
    var lines = [];
    if (news) {
      var last = (news < 10 ? '0' : '') + news;
      lines.push('把 ' + news + ' 張新照片依 01→' + last + ' 順序發佈（最後發的會在最前面，所以實際要從 ' + last + ' 先發）');
    }
    (pins || []).forEach(function (k) { lines.push('到 IG 把第 ' + (k + 1) + ' 篇改成釘選'); });
    (archived || []).slice().sort(function (a, b) { return a - b; }).forEach(function (k) {
      lines.push('到 IG 封存第 ' + (k + 1) + ' 篇（已拿掉的）');
    });
    return lines;
  }

  // ===== 版面星數：呼叫 js/layout-score.js 並只重寫 #layoutScore 小區塊 =====
  // cells：每格取樣來源（{ canvas }／{ img, url }／{ hex }／null）；prev：上一次結果（null＝不比較）
  // 回傳 { result, pending }；pending＝有圖片還沒載好（呼叫端可等載好再補算一次）
  function showScore(box, cells, prev) {
    var LS = window.LayoutScore;
    if (!box || !LS) return null;
    var pending = false;
    var stats = cells.map(function (c) {
      var s = LS.measure(c);
      if (c && !s) pending = true;
      return s;
    });
    var r = LS.score(stats, 3);
    var cmp = LS.compare(prev, r);
    box.hidden = false;
    box.setAttribute('data-stars', r.stars);
    box.setAttribute('data-score', r.score);
    box.innerHTML = '<span class="ls-stars" aria-label="' + r.stars + ' 顆星">' + LS.starText(r.stars) + '</span>' +
      (cmp ? '<span class="ls-cmp">' + cmp + '</span>' : '') +
      '<span class="ls-why"></span>';
    box.querySelector('.ls-why').textContent = r.reason;
    return { result: r, pending: pending };
  }

  // ===== 對外 API =====
  // hitIndex、bindDrag 由 js/step5-drag.js 補上，對外仍是同一個 window.Step5。
  window.Step5 = window.Step5 || {};
  window.Step5.arrayMove = arrayMove;
  window.Step5.syncOrder = syncOrder;
  window.Step5.shifted = shifted;
  window.Step5.tasks = tasks;
  window.Step5.showScore = showScore;
})();
