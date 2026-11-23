/*
 * step5.js — 第五步的排序、拖曳、釘選（第五輪）
 * ------------------------------------------------------------
 * 視覺順序是一個陣列，標準搬移：remove(from) 再 insert(to)。
 * 滑鼠按住就拖；觸控長按約 0.2 秒才拖，短按與滑動留給捲動。
 */
(function () {
  'use strict';

  function arrayMove(arr, from, to) {
    var next = arr.slice();
    if (from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next;
    var item = next.splice(from, 1)[0];
    next.splice(to, 0, item);
    return next;
  }

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

  function bindDrag(g, api) {
    if (!g) return;
    if (g._dragAbort) g._dragAbort();
    var ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    g._dragAbort = function () { if (ac) ac.abort(); };
    var opt = ac ? { signal: ac.signal } : false;
    var drag = null;
    var scrollTimer = 0;

    function cells() { return Array.prototype.slice.call(g.querySelectorAll('.pc:not(.none)')); }
    function clearGhost() {
      if (drag && drag.ghost) drag.ghost.remove();
      if (drag && drag.slot) drag.slot.remove();
      cells().forEach(function (el) {
        el.style.transform = '';
        el.style.transition = '';
        el.style.zIndex = '';
        el.style.opacity = '';
        el.classList.remove('is-lift', 'is-gone');
      });
      document.body.classList.remove('is-dragging');
      document.documentElement.style.touchAction = '';
    }
    function stopScroll() { clearInterval(scrollTimer); scrollTimer = 0; }

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

    function pointInGrid(e) {
      var b = g.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top, outside: e.clientX < b.left - 28 || e.clientX > b.right + 28 || e.clientY < b.top - 28 || e.clientY > b.bottom + 28 };
    }

    function moveGhost(e) {
      if (!drag || !drag.ghost) return;
      drag.ghost.style.left = (e.clientX - drag.ox) + 'px';
      drag.ghost.style.top = (e.clientY - drag.oy) + 'px';
    }

    function onMove(e) {
      if (!drag || e.pointerId !== drag.pid) return;
      if (!drag.started) {
        var dist = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
        if (!drag.mouse) {
          if (dist > 12) { window.clearTimeout(drag.timer); drag = null; }
          return;
        }
        if (dist < 4) return;
        start(e);
      }
      if (!drag || !drag.started) return;
      if (e.cancelable) e.preventDefault();
      moveGhost(e);
      var p = pointInGrid(e);
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
      moveGhost(e);
      layout(from, from);
    }

    function finish(e, cancel) {
      if (!drag || (e && e.pointerId !== drag.pid)) return;
      window.clearTimeout(drag.timer);
      stopScroll();
      var d = drag;
      drag = null;
      var from = d.from, to = d.to;
      clearGhost();
      if (!d.started) {
        if (api.onTap) api.onTap(d.index, d.el);
        return;
      }
      if (cancel || to < 0 || to === from) { if (api.onCancel) api.onCancel(); return; }
      if (api.onCommit) api.onCommit(from, to);
    }

    function onDown(e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      var el = e.target.closest ? e.target.closest('#pgrid .pc') : null;
      if (!el || el.classList.contains('none') || !g.contains(el)) return;
      if (e.target.closest && e.target.closest('button, a')) return;
      var mouse = e.pointerType === 'mouse';
      drag = { pid: e.pointerId, x: e.clientX, y: e.clientY, el: el, mouse: mouse, started: false, timer: 0, from: -1, to: -1 };
      if (!mouse) {
        drag.timer = window.setTimeout(function () { if (drag && drag.pid === e.pointerId) start(e); }, 200);
      }
    }

    g.addEventListener('pointerdown', onDown, opt);
    window.addEventListener('touchmove', function (e) {
      if (drag && drag.started && e.cancelable) e.preventDefault();
    }, ac ? { signal: ac.signal, passive: false } : { passive: false });
    window.addEventListener('pointermove', onMove, ac ? { signal: ac.signal, passive: false } : { passive: false });
    window.addEventListener('pointerup', function (e) { finish(e, false); }, opt);
    window.addEventListener('pointercancel', function (e) { finish(e, true); }, opt);
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drag && drag.started) { e.preventDefault(); finish({ pointerId: drag.pid }, true); }
    }, opt);
  }

  window.Step5 = {
    arrayMove: arrayMove,
    syncOrder: syncOrder,
    shifted: shifted,
    tasks: tasks,
    hitIndex: hitIndex,
    bindDrag: bindDrag
  };
})();
