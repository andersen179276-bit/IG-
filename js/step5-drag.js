/*
 * step5-drag.js — 第五步：九宮格拖曳（從 step5.js 拆出，行為不變）
 * ------------------------------------------------------------
 * 滑鼠按住就拖；觸控長按約 0.35 秒才拖（成立時 .is-lift 放大＋震動），短按與滑動留給捲動。
 * 第五輪第 3 節：手機以「點選互換」為主（js/step5-swap.js）；觸控拖曳只在同一排內（格子是 touch-action:pan-y，
 * 上下拉會被系統當捲動），短按（未開始拖、非取消、位移 < 10px）→ onTap(index, el)。
 * 第五輪第 1、2 節：殘影一定清掉；iOS 中斷（cancel、失去 capture、切走、blur、contextmenu）都會收尾。
 * 必須在 js/step5.js 之後載入（用到 Step5.arrayMove）。
 * 對外：window.Step5.hitIndex、window.Step5.bindDrag
 */
(function () {
  'use strict';

  var arrayMove = window.Step5.arrayMove;
  var LONG_PRESS_MS = 350;
  var GHOST_SEL = 'body > .pc.ghost, body > .ghost, .pc-slot';
  var TAP_SLOP = 10;   // 短按：放開時離按下點 < 10px 才算點一下

  // ===== 拖曳：上一組監聽（模組層，#pgrid 被重建也能解除舊的 window 監聽） =====
  var prevAbort = null;

  // ===== 拖曳：全域殘影掃除（任何漏掉的浮動複本、虛線落點） =====
  function sweepGhosts() {
    document.querySelectorAll(GHOST_SEL).forEach(function (n) { n.remove(); });
  }

  // ===== 拖曳：格子位置與命中判斷 =====
  function cellRects(g) {
    return Array.prototype.map.call(g.querySelectorAll('.pc:not(.none)'), function (el) {
      return { left: el.offsetLeft, top: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, el: el };
    });
  }

  function hitIndex(rects, x, y) {
    var i, inside = -1, best = -1, bestD = Infinity;
    for (i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (x >= r.left && x <= r.left + r.w && y >= r.top && y <= r.top + r.h) inside = i;
      var d = Math.hypot(x - (r.left + r.w / 2), y - (r.top + r.h / 2));
      if (d < bestD) { bestD = d; best = i; }
    }
    if (inside >= 0) return inside;
    if (bestD > Math.max(rects[0] ? rects[0].w : 48, 48)) return -1;
    return best;
  }

  // ===== 拖曳：綁定（api: onCommit(from,to)、onTap(index,el)、onCancel()） =====
  function bindDrag(g, api) {
    if (!g) return;
    // 先收掉上一組（不管 g 是不是同一個元素），再清一次殘影
    if (prevAbort) prevAbort();
    sweepGhosts();
    document.body.classList.remove('is-dragging');
    document.documentElement.style.touchAction = '';
    var ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var alive = true;   // 沒有 AbortController 的舊瀏覽器：靠旗標讓舊監聽失效
    var drag = null;
    var scrollTimer = 0;
    prevAbort = function () {
      alive = false;
      if (drag) { var d = drag; drag = null; clearGhost(d); }
      stopScroll();
      if (ac) ac.abort();
      prevAbort = null;
    };
    function on(target, type, fn, passiveFalse) {
      var h = function (e) { if (alive) fn(e); };
      var o = passiveFalse ? { passive: false } : {};
      if (ac) o.signal = ac.signal;
      target.addEventListener(type, h, o);
    }

    // ===== 拖曳：殘影清除 =====
    function cells() { return Array.prototype.slice.call(g.querySelectorAll('.pc:not(.none)')); }
    // d：這次拖曳的狀態（finish 會先把 drag 設成 null，所以一定要傳進來）
    function clearGhost(d) {
      if (d && d.ghost) d.ghost.remove();
      if (d && d.slot) d.slot.remove();
      if (d && d.timer) window.clearTimeout(d.timer);
      cells().forEach(function (el) {
        el.style.transform = '';
        el.style.transition = '';
        el.style.zIndex = '';
        el.style.opacity = '';
        el.classList.remove('is-lift', 'is-gone');
      });
      document.body.classList.remove('is-dragging');
      document.documentElement.style.touchAction = '';
      sweepGhosts();   // 保險：任何漏網的複本／虛線框都掃掉
    }
    function stopScroll() { clearInterval(scrollTimer); scrollTimer = 0; }

    // ===== 拖曳：其他格子讓位預覽 =====
    function layout(from, to) {
      var rects = drag.rects;
      var n = rects.length;
      var order = [];
      for (var i = 0; i < n; i++) order.push(i);
      var preview = to < 0 ? order : arrayMove(order, from, to);
      rects.forEach(function (r, i) {
        var el = r.el;
        if (i === from) {
          el.classList.add('is-gone');
          return;
        }
        var dest = preview.indexOf(i);
        var dx = rects[dest].left - r.left;
        var dy = rects[dest].top - r.top;
        el.style.transition = 'transform 180ms ease';
        el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      });
      if (drag.slot) {
        if (to < 0) drag.slot.hidden = true;
        else {
          drag.slot.hidden = false;
          drag.slot.style.left = rects[to].left + 'px';
          drag.slot.style.top = rects[to].top + 'px';
          drag.slot.style.width = rects[to].w + 'px';
          drag.slot.style.height = rects[to].h + 'px';
        }
      }
    }

    // ===== 拖曳：指標座標換算、浮動複本跟手 =====
    function pointInGrid(e) {
      var b = g.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top, outside: e.clientX < b.left - 28 || e.clientX > b.right + 28 || e.clientY < b.top - 28 || e.clientY > b.bottom + 28 };
    }

    function moveGhost(e) {
      if (!drag || !drag.ghost) return;
      drag.ghost.style.left = (e.clientX - drag.ox) + 'px';
      drag.ghost.style.top = (e.clientY - drag.oy) + 'px';
    }

    // ===== 拖曳：移動（滑鼠超過 4px 開始；觸控長按前移動超過 12px 視為捲動）＋邊緣自動捲動 =====
    function onMove(e) {
      if (!drag || e.pointerId !== drag.pid) return;
      if (!drag.started) {
        var dist = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
        if (!drag.mouse) {
          if (dist > 12) { var d0 = drag; drag = null; clearGhost(d0); }
          return;
        }
        if (dist < 4) return;
        start(e);
      }
      if (!drag || !drag.started) return;
      if (e.cancelable) e.preventDefault();
      moveGhost(e);
      var p = pointInGrid(e);
      // 觸控拖曳只在同一排內（換排請用點選互換）：y 固定在原本那一排
      if (!drag.mouse) { var fr = drag.rects[drag.from]; p.y = fr.top + fr.h / 2; }
      drag.to = p.outside ? -1 : hitIndex(drag.rects, p.x, p.y);
      layout(drag.from, drag.to);
      var edge = 64;
      var dy = 0;
      if (e.clientY < edge) dy = -14;
      else if (e.clientY > window.innerHeight - edge) dy = 14;
      if (dy && !scrollTimer) {
        scrollTimer = window.setInterval(function () { window.scrollBy(0, dy); }, 16);
      } else if (!dy) stopScroll();
    }

    // ===== 拖曳：開始（建立浮動複本與虛線落點） =====
    function start(e) {
      if (!drag || drag.started) return;
      var el = drag.el;
      var rects = cellRects(g);
      var from = rects.findIndex(function (r) { return r.el === el; });
      if (from < 0) { drag = null; return; }
      drag.started = true;
      drag.from = from;
      drag.to = from;
      drag.rects = rects;
      var r = el.getBoundingClientRect();
      drag.ox = e.clientX - r.left;
      drag.oy = e.clientY - r.top;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      var gh = el.cloneNode(true);
      gh.classList.add('ghost');
      gh.querySelectorAll('button').forEach(function (b) { b.remove(); });
      gh.style.width = r.width + 'px';
      gh.style.height = r.height + 'px';
      var c1 = el.querySelector('canvas'), c2 = gh.querySelector('canvas');
      if (c1 && c2) { try { c2.getContext('2d').drawImage(c1, 0, 0); } catch (err) {} }
      document.body.appendChild(gh);
      drag.ghost = gh;
      var slot = document.createElement('div');
      slot.className = 'pc-slot';
      g.appendChild(slot);
      drag.slot = slot;
      document.body.classList.add('is-dragging');
      document.documentElement.style.touchAction = 'none';
      el.classList.add('is-lift');
      gh.classList.add('is-lift');
      if (!drag.mouse && navigator.vibrate) { try { navigator.vibrate(10); } catch (err) {} }
      moveGhost(e);
      layout(from, from);
    }

    // ===== 拖曳：結束（放下／取消／短按 → onTap；取消一律不當點一下，位移 ≥ 10px 也不算） =====
    function finish(e, cancel) {
      if (!drag || (e && e.pointerId != null && e.pointerId !== drag.pid)) return;
      var d = drag;
      drag = null;
      // 先停計時器、清殘影，再處理其他（任何後續錯誤都不會留下殘影）
      stopScroll();
      clearGhost(d);
      var from = d.from, to = d.to;
      if (!d.started) {
        var moved = e && e.clientX != null ? Math.hypot(e.clientX - d.x, e.clientY - d.y) : 0;
        if (!cancel && moved < TAP_SLOP && api.onTap) api.onTap(d.index, d.el);
        return;
      }
      if (cancel || to < 0 || to === from) { if (api.onCancel) api.onCancel(); return; }
      if (api.onCommit) api.onCommit(from, to);
    }

    // ===== 拖曳：按下（觸控啟動長按計時） =====
    function onDown(e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      var el = e.target.closest ? e.target.closest('#pgrid .pc') : null;
      if (!el || el.classList.contains('none') || !g.contains(el)) return;
      if (e.target.closest && e.target.closest('button, a')) return;
      var mouse = e.pointerType === 'mouse';
      drag = { pid: e.pointerId, x: e.clientX, y: e.clientY, el: el, index: Number(el.getAttribute('data-i')), mouse: mouse, started: false, timer: 0, from: -1, to: -1 };
      if (!mouse) {
        drag.timer = window.setTimeout(function () { if (drag && drag.pid === e.pointerId) start(e); }, LONG_PRESS_MS);
      }
    }

    // ===== 拖曳：中斷收尾（iOS 系統手勢、切走 App、失焦） =====
    function abortAll() { if (drag) finish(null, true); }

    // ===== 拖曳：事件綁定（每次 bindDrag 先 abort 上一組） =====
    on(g, 'pointerdown', onDown);
    on(g, 'contextmenu', function (e) { e.preventDefault(); });
    on(g, 'dragstart', function (e) { e.preventDefault(); });
    on(g, 'lostpointercapture', function (e) { if (drag && drag.started) finish(e, true); });
    on(window, 'touchmove', function (e) {
      if (drag && drag.started && e.cancelable) e.preventDefault();
    }, true);
    on(window, 'touchcancel', abortAll);
    on(window, 'pointermove', onMove, true);
    on(window, 'pointerup', function (e) { finish(e, false); });
    on(window, 'pointercancel', function (e) { finish(e, true); });
    on(window, 'blur', abortAll);
    on(document, 'visibilitychange', function () { if (document.hidden) abortAll(); });
    on(window, 'keydown', function (e) {
      if (e.key === 'Escape' && drag && drag.started) { e.preventDefault(); finish({ pointerId: drag.pid }, true); }
    });
  }

  // ===== 對外 API =====
  window.Step5.hitIndex = hitIndex;
  window.Step5.bindDrag = bindDrag;
})();
