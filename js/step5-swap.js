/*
 * step5-swap.js — 第五步：點一下選取、再點另一格互換（第五輪第 3 節）
 * ------------------------------------------------------------
 * 手機主要的換位置方式（觸控拖曳只是輔助，且只在同一排內）。
 * 這個檔只管「互換的資料」與「格子上的選取／動畫樣式」，不重畫、不碰配樂區；
 * 實際寫入順序、釘選、toast 由 app.js 接線（見 FILEMAP.md）。
 * 必須在 js/step5.js 之後載入。
 * 對外：window.Step5.arraySwap、window.Step5.swapTap、window.Step5.markSel、window.Step5.flashSwap
 */
(function () {
  'use strict';

  var FLASH_MS = 250;
  var SEL_TAG = '<span class="pc-sel" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.4 6.6 11.4 12.5 4.8"/></svg>已選取</span>';

  // ===== 互換：陣列兩個位置交換（不是搬移，結果和 arrayMove 不同） =====
  function arraySwap(arr, a, b) {
    var next = (arr || []).slice();
    if (a === b || a < 0 || b < 0 || a >= next.length || b >= next.length) return next;
    var t = next[a]; next[a] = next[b]; next[b] = t;
    return next;
  }

  // ===== 互換：點一下的判斷（選取／取消／互換） =====
  /* ctx：{ getSel(), setSel(i|null), swap(a, b), onSelect(i), onClear() }
   * 回傳 'select'／'clear'／'swap'／'none'，方便測試與除錯 */
  function swapTap(i, ctx) {
    if (typeof i !== 'number' || isNaN(i) || i < 0) return 'none';
    var sel = ctx.getSel();
    if (sel == null) { ctx.setSel(i); if (ctx.onSelect) ctx.onSelect(i); return 'select'; }
    if (sel === i) { ctx.setSel(null); if (ctx.onClear) ctx.onClear(); return 'clear'; }
    ctx.setSel(null);
    ctx.swap(sel, i);
    return 'swap';
  }

  // ===== 互換：選取框＋小勾（只改 class，不重畫） =====
  function markSel(g, i) {
    if (!g) return;
    Array.prototype.forEach.call(g.querySelectorAll('.pc.is-sel'), function (el) {
      el.classList.remove('is-sel');
      el.removeAttribute('aria-pressed');
      var tag = el.querySelector('.pc-sel'); if (tag) tag.remove();
    });
    g.classList.toggle('is-picking', i != null);
    if (i == null) return;
    var cell = g.querySelector('.pc[data-i="' + i + '"]');
    if (!cell) return;
    cell.classList.add('is-sel');
    cell.setAttribute('aria-pressed', 'true');
    cell.insertAdjacentHTML('beforeend', SEL_TAG);
  }

  // ===== 互換：互換後兩格的小動畫（約 250ms） =====
  function flashSwap(g, a, b) {
    if (!g) return;
    [a, b].forEach(function (i) {
      var el = g.querySelector('.pc[data-i="' + i + '"]');
      if (!el) return;
      el.classList.remove('is-swapped');
      void el.offsetWidth;   // 重新觸發動畫
      el.classList.add('is-swapped');
      window.setTimeout(function () { el.classList.remove('is-swapped'); }, FLASH_MS + 50);
    });
  }

  // ===== 對外 API =====
  window.Step5 = window.Step5 || {};
  window.Step5.arraySwap = arraySwap;
  window.Step5.swapTap = swapTap;
  window.Step5.markSel = markSel;
  window.Step5.flashSwap = flashSwap;
})();
