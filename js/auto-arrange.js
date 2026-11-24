/* 留格 · 第 5 步：自動排好推薦版本（DIAGNOSIS 第 9 節）
 * 只在「新照片目前占的格子」之間重新分配新照片，舊貼文與釘選位置不動。
 * 新照片 ≤ EXHAUST_MAX 張窮舉所有排列；更多張用貪婪＋兩兩互換改良。
 * 計分用 window.LayoutScore.score（同星數）。 */
(function () {
  'use strict';

  var EXHAUST_MAX = 6;

  // ===== 計分：把新照片依 perm 放進 slots 後的分數 =====
  function evalPerm(base, slots, ids, perm, statOf) {
    var cells = base.slice();
    for (var j = 0; j < slots.length; j++) cells[slots[j]] = perm[j] == null ? null : statOf[ids[perm[j]]];
    return window.LayoutScore.score(cells, 3).score;
  }

  // ===== 窮舉（≤6 張，最多 720 種） =====
  function exhaustive(base, slots, ids, statOf) {
    var n = ids.length, best = null, bestS = -1, used = [], cur = [];
    (function rec(d) {
      if (d === n) {
        var s = evalPerm(base, slots, ids, cur, statOf);
        if (s > bestS) { bestS = s; best = cur.slice(); }
        return;
      }
      for (var i = 0; i < n; i++) {
        if (used[i]) continue;
        used[i] = true; cur[d] = i; rec(d + 1); used[i] = false;
      }
    })(0);
    return best;
  }

  // ===== 貪婪（>6 張）：一格一格挑最好的，再做兩兩互換改良 =====
  function greedy(base, slots, ids, statOf) {
    var n = ids.length, perm = [], left = ids.map(function (_, i) { return i; });
    for (var d = 0; d < n; d++) {
      var bi = 0, bs = -1;
      left.forEach(function (c, li) {
        var p = perm.concat([c]);
        var s = evalPerm(base, slots, ids, p, statOf);
        if (s > bs) { bs = s; bi = li; }
      });
      perm.push(left.splice(bi, 1)[0]);
    }
    var cur = evalPerm(base, slots, ids, perm, statOf), improved = true, guard = 0;
    while (improved && guard++ < 20) {
      improved = false;
      for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) {
        var t = perm[a]; perm[a] = perm[b]; perm[b] = t;
        var s = evalPerm(base, slots, ids, perm, statOf);
        if (s > cur) { cur = s; improved = true; } else { t = perm[a]; perm[a] = perm[b]; perm[b] = t; }
      }
    }
    return perm;
  }

  /* order：Step5 順序陣列；stats：每格 { l, h, s }／null（與 order 對齊）
   * 回傳新順序（陣列，可能與原本相同） */
  function best(order, stats) {
    if (!window.LayoutScore) return order.slice();
    var slots = [], ids = [], statOf = {}, base = stats.slice();
    order.forEach(function (it, i) {
      if (it.t !== 'n') return;
      slots.push(i); ids.push(it.id); statOf[it.id] = stats[i]; base[i] = null;
    });
    if (ids.length < 2) return order.slice();
    var perm = ids.length <= EXHAUST_MAX ? exhaustive(base, slots, ids, statOf) : greedy(base, slots, ids, statOf);
    var next = order.slice();
    slots.forEach(function (s, j) { next[s] = { t: 'n', id: ids[perm[j]] }; });
    return next;
  }

  function same(a, b) {
    return a.length === b.length && a.every(function (it, i) { return it.t === b[i].t && it.id === b[i].id && it.k === b[i].k; });
  }

  // ===== 提示列：「已幫你排好推薦版本…」＋「改回原本順序」 =====
  function showNote(box, show, canRevert, onRevert) {
    if (!box) return;
    box.hidden = !show;
    if (!show) { box.innerHTML = ''; return; }
    box.innerHTML = '<span>已幫你排好推薦版本，點兩格就能互換微調</span>' +
      (canRevert ? '<button type="button" class="btn btn-ghost btn-sm" id="autoRevert">改回原本順序</button>' : '');
    var b = box.querySelector('#autoRevert');
    if (b) b.addEventListener('click', onRevert);
  }

  window.AutoArrange = { best: best, same: same, showNote: showNote, EXHAUST_MAX: EXHAUST_MAX };
})();
