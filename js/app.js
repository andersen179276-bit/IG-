/*
 * app.js — 路由與畫面
 * ------------------------------------------------------------
 * hash 路由：#/ → #/upload → #/style → #/analysis → #/next → #/photos。#/music 會回到第五步的配樂區。
 * 照片與截圖都不離開裝置。會留在這台裝置上的資料：
 *   localStorage['liuge.music.v1']     配樂偏好（見 js/music.js）
 *   localStorage['liuge.archived.v1']  第 5 步「暫時拿掉」的貼文索引（原始位置＋來源截圖識別）
 *   sessionStorage['liuge.shot.v1']    分析用的縮小截圖（寬 ≤ 1080 的 JPEG），重新整理後還原預覽；關掉分頁就清除
 * 唯一的對外連線：配樂推薦出現時用歌名＋歌手查 Apple 的公開 30 秒試聽（只查不播），按播放鍵才載入音檔（js/preview.js）。
 *   沒有 Apple 試聽的歌只顯示「到 YouTube 聽／搜尋 ↗」外部連結（新分頁），頁面內不嵌入任何影片。
 */
(function () {
  'use strict';

  var STYLES = window.MockData.STYLES;
  var Grid = window.Grid, Editor = window.Editor, AI = window.AI, GD = window.GridDetect, Music = window.Music, Preview = window.Preview;

  var ROUTES = ['', 'upload', 'style', 'analysis', 'next', 'photos'];
  var EXTRA = ['music'];
  var STEP_NAME = { upload: '上傳主頁', style: '選類型', analysis: '分析', next: '下一篇', photos: '整理照片' };

  var state = {
    shot: null,          // { url, width, height, name, isDemo, det, grid, srcId, chosen, ms }
    shotP: null,         // 讀取＋偵測中的 Promise
    loading: null,       // 上傳後讀取中：{ text }
    uploadError: null,   // 上傳失敗的溫和提示（例如 HEIC 解不開）
    debugDelay: 0,       // 截圖腳本用：人為延遲偵測，才拍得到讀取狀態
    frameEdit: null,     // 手動拖框中：{ x, y, w, h, ratio }（原圖像素）
    styleId: null,
    analysis: null, analysisKey: null,
    shots: null, shotsKey: null, shotIndex: 0,
    photos: [], cur: null,
    existing: null, existingKey: null, existingHints: [],
    order: null,
    swapSel: null,   // 第 5 步點選互換：已選取那一格的 order 索引（js/step5-swap.js）
    chrome: null,
    music: { seed: 0, avoid: [], recs: null, returnTo: null, tab: 'genre', draft: null, taste: null, lang: 'all', focus: false }
  };

  var $main = document.getElementById('main');

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function styleById(id) { return STYLES.filter(function (s) { return s.id === id; })[0]; }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pct(v, total) { return (v / total * 100).toFixed(3) + '%'; }

  var toastTimer;
  /* toast(msg) 一般提示；toast(msg, { label, fn }) 帶一個動作（例如「復原」），預設停 5 秒 */
  function toast(msg, action, ms) {
    var t = document.getElementById('toast');
    t.innerHTML = '';
    var sp = document.createElement('span'); sp.textContent = msg; t.appendChild(sp);
    t.classList.toggle('act', !!action);
    if (action) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'toast-btn'; b.textContent = action.label;
      b.addEventListener('click', function () { t.classList.remove('show'); clearTimeout(toastTimer); action.fn(); });
      t.appendChild(b);
    }
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || (action ? 5000 : 2200));
  }
  function nextFrame() {
    // 先讓瀏覽器把「讀取中」畫出來，再開始算（避免畫面凍結）
    return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms || 0); }); }
  function isHeic(f) { return /hei[cf]/i.test(f.type || '') || /\.hei[cf]$/i.test(f.name || ''); }
  var HEIC_MSG = '這張是 HEIC 格式，這個瀏覽器讀不出來。請改用螢幕截圖（PNG），或到 iPhone「設定 › 相機 › 格式」改成「最相容」。';

  /* ---------- 細線圖示（stroke 1.25） ---------- */
  var I = {
    arrow: '<svg class="arr" viewBox="0 0 18 10" aria-hidden="true"><path d="M0 5h17M13 1l4 4-4 4"/></svg>',
    upload: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="11" y="4" width="18" height="32" rx="2"/><path d="M17 33h6M20 24V13M16 17l4-4 4 4"/></svg>',
    style: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="6" width="7.5" height="9"/><rect x="16.25" y="6" width="7.5" height="9"/><rect x="25.5" y="6" width="7.5" height="9"/><rect x="7" y="16.5" width="7.5" height="9"/><rect x="16.25" y="16.5" width="7.5" height="9"/><rect x="25.5" y="16.5" width="7.5" height="9"/><rect x="7" y="27" width="7.5" height="9"/><rect x="16.25" y="27" width="7.5" height="9"/><rect x="25.5" y="27" width="7.5" height="9"/><path d="M17.5 21l1.8 1.8 3.2-3.6"/></svg>',
    tips: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="8" y="5" width="24" height="30"/><path d="M13 13h14M13 18h14M13 23h9"/><circle cx="27" cy="29" r="3.5"/></svg>',
    lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>',
    device: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="1.5" width="7" height="13" rx="1"/><path d="M7 12.5h2"/></svg>',
    check: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 4.8 9 10 3"/></svg>',
    plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12"/></svg>',
    left: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>',
    right: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>',
    swap: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5h11M10 2l3 3-3 3M14 11H3M6 8l-3 3 3 3"/></svg>',
    close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    frame: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 5V1.5H5M11 1.5h3.5V5M14.5 11v3.5H11M5 14.5H1.5V11"/><path d="M6 1.5v13M10 1.5v13" stroke-dasharray="1.5 1.5"/></svg>',
    scan: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12"/><path d="M6 2v12M10 2v12M2 7h12"/></svg>',
    note: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 12.2V3.2l7-1.4v8.6"/><ellipse cx="4.3" cy="12.3" rx="1.8" ry="1.4"/><ellipse cx="11.3" cy="10.5" rx="1.8" ry="1.4"/></svg>',
    baArrow: '<svg class="arrow" viewBox="0 0 28 12" aria-hidden="true"><path d="M0 6h27M22 1l5 5-5 5"/></svg>'
  };

  /* ---------- Header ---------- */
  function updateHeader(route) {
    var idx = ROUTES.indexOf(route);
    var nav = document.getElementById('topNav');
    var bar = document.getElementById('progressBar');
    document.body.classList.toggle('in-steps', idx > 0);
    var ml = document.getElementById('musicLink');
    if (ml) { if (route === 'music') ml.setAttribute('aria-current', 'page'); else ml.removeAttribute('aria-current'); }
    if (idx <= 0) {
      nav.hidden = true;
      bar.style.width = '0';
    } else {
      nav.hidden = false;
      document.getElementById('stepCount').textContent = pad2(idx) + ' / 05';
      document.getElementById('stepCount').setAttribute('aria-label', '第 ' + idx + ' 步，共 5 步：' + STEP_NAME[route]);
      bar.style.width = (idx / 5 * 100) + '%';
    }
  }
  document.getElementById('backBtn').addEventListener('click', function () {
    var idx = ROUTES.indexOf(currentRoute());
    go(ROUTES[Math.max(0, idx - 1)]);
  });

  /* ---------- Router ---------- */
  function currentRoute() {
    var r = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES.indexOf(r) >= 0 || EXTRA.indexOf(r) >= 0 ? r : '';
  }
  function routeQuery() {
    var q = (location.hash || '').split('?')[1] || '', o = {};
    q.split('&').forEach(function (kv) { if (kv) { var p = kv.split('='); o[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '1'); } });
    return o;
  }
  function go(route) { location.hash = '#/' + route; }

  function render() {
    var route = currentRoute();
    // 需要前置條件的步驟：沒選類型就回到選類型
    if ((route === 'analysis' || route === 'next') && !state.styleId) { go('style'); return; }
    updateHeader(route);
    if (Preview) Preview.stop(); // 換頁立刻停止試聽
    cleanupPhotos();
    var view = VIEWS[route] || VIEWS[''];
    $main.innerHTML = '';
    view();
    stagger();
    window.scrollTo(0, 0);
    $main.focus({ preventScroll: true });
  }
  function stagger() {
    qsa('.stg', $main).forEach(function (el, i) { el.style.animationDelay = (i * 60) + 'ms'; });
  }
  window.addEventListener('hashchange', render);

  /* =========================================================
     0. 首頁
     ========================================================= */
  function viewHome() {
    $main.innerHTML =
      '<div class="wrap screen">' +
        '<section class="hero">' +
          '<div class="stg">' +
            '<span class="eyebrow">IG 主頁排版室</span>' +
            '<h1 class="h1">讓你的主頁，<br>更像你。</h1>' +
            '<p class="promise-sub">幫你變會拍、會選、會排</p>' +
            '<p class="lead">給我一張主頁截圖、告訴我你想走的樣子。我會讀出色調、留白與節奏，告訴你哪幾張可以先收起來、下一篇拍什麼，再陪你把新照片修成同一個調子。</p>' +
            '<div class="hero-cta mt-32">' +
              '<a class="btn" href="#/upload">開始整理 ' + I.arrow + '</a>' +
              '<p class="promise-note small">' + I.lock + '<span>不會生成任何圖片，照片永遠是你的。</span></p>' +
            '</div>' +
          '</div>' +
          '<div class="stg">' +
            '<div class="ba">' +
              '<figure><div class="ba-frame">' + Grid.gridHTML(Grid.BEFORE) + '</div>' +
                '<figcaption><span>整理前</span><em>雜</em></figcaption></figure>' +
              I.baArrow +
              '<figure><div class="ba-frame">' + Grid.gridHTML(Grid.afterCells()) + '</div>' +
                '<figcaption><span>整理後</span><em>靜</em></figcaption></figure>' +
            '</div>' +
            '<p class="small mt-16">同一組貼文，只是重新排序、收攏色調、把字太多的那張換成樣板。示意圖以色塊表示。</p>' +
          '</div>' +
        '</section>' +
        '<ol class="steps3 stg">' +
          step3('01', I.upload, '上傳主頁', '一張主頁截圖就好，照片不會離開你的手機。') +
          step3('02', I.style, '選想走的樣子', '六種帳號類型，各有一套看得見的排版規則。') +
          step3('03', I.tips, '拿到建議', '哪幾張先封存、下一篇怎麼拍，再把新照片修成一致。') +
        '</ol>' +
      '</div>';
  }
  function step3(no, icon, title, body) {
    return '<li><div>' + icon.replace('<svg', '<svg class="ic"') + '</div>' +
      '<div><span class="no">步驟 ' + no + '</span><h3>' + title + '</h3><p>' + body + '</p></div></li>';
  }

  /* =========================================================
     1. 上傳主頁截圖
     ========================================================= */
  function viewUpload() {
    $main.innerHTML =
      '<div class="wrap screen"><div class="two">' +
        '<div class="stg">' +
          '<span class="eyebrow">步驟 01 — 你的主頁</span>' +
          '<h1 class="h1">先讓我看看<br>你現在的主頁。</h1>' +
          '<p class="lead">在 Instagram 打開自己的主頁，往下滑到看得見九宮格，截一張圖就好。建議上傳 IG App 主頁截圖；電腦版截圖也可以。深色模式也行。</p>' +
          '<ol class="reads">' +
            '<li><span class="n">01</span><span>色調：最近幾格是不是同一個色系</span></li>' +
            '<li><span class="n">02</span><span>留白：畫面有沒有喘息的空間</span></li>' +
            '<li><span class="n">03</span><span>主體：每一張的主角清不清楚</span></li>' +
            '<li><span class="n">04</span><span>節奏：相鄰的格子有沒有互相打架</span></li>' +
          '</ol>' +
        '</div>' +
        '<div class="stg" id="upArea"></div>' +
      '</div></div>';
    renderUploadArea();
  }

  var KIND_LABEL = { phone: '手機截圖', desktop: '電腦截圖', ipad: 'iPad 截圖', uncertain: '還不確定是手機或電腦' };

  function detLine(s) {
    if (!s || !s.grid) return '';
    var g = s.grid;
    if (g.ok) return '<span class="det-ok">' + I.scan + '找到貼文區：' + g.posts + ' 篇貼文 · ' + g.cols + ' 欄 · 格子 ' + g.ratio + (g.ratioGuessed ? '（推測）' : '') + '</span>';
    if (g.kind === 'phone' && !g.tabRow) return '<span class="det-warn">' + I.frame + '沒找到 IG 的分頁圖示列，分析時請手動框選貼文區</span>';
    return '<span class="det-warn">' + I.frame + '沒找到明確的貼文格子，分析時可以手動框選</span>';
  }

  /* 「偵測到：手機截圖」＋細框分段切換（手機｜電腦），切換後立刻用另一種偵測重跑 */
  function kindBarHTML(sh) {
    var d = sh && sh.det;
    if (!d || !d.cls) return '';
    var used = d.kind;
    var extra = d.cls.kind === 'ipad' ? '<span class="kb-sub">（用電腦版的偵測）</span>'
      : sh.chosen && sh.chosen !== (d.cls.kind === 'uncertain' ? null : d.cls.kind) ? '<span class="kb-sub">（你改成用' + (used === 'phone' ? '手機' : '電腦') + '版偵測）</span>' : '';
    return '<div class="kindbar">' +
      '<span class="kb-l">偵測到：<b>' + KIND_LABEL[d.cls.kind] + '</b>' + extra + '</span>' +
      '<span class="seg" role="group" aria-label="用哪一種截圖的方式偵測">' +
        '<button type="button" data-kind="phone" aria-pressed="' + (used === 'phone') + '">手機</button>' +
        '<button type="button" data-kind="desktop" aria-pressed="' + (used === 'desktop') + '">電腦</button>' +
      '</span></div>';
  }
  function askKindHTML(sh) {
    var d = sh && sh.det;
    if (!d || !d.cls || d.cls.kind !== 'uncertain' || sh.chosen) return '';
    return '<div class="notice ask" role="group" aria-label="選擇截圖類型">' + I.scan +
      '<div><b>這是手機還是電腦截圖？</b><p>這張圖的比例介於兩者之間（高÷寬 ' + d.cls.ar + '）。我先用比較有把握的方式找了一次，選一下會更準。</p>' +
      '<div class="ask-row"><button type="button" class="pill" data-kind="phone">手機截圖</button><button type="button" class="pill" data-kind="desktop">電腦截圖</button></div></div></div>';
  }
  function bindKind(root, after) {
    qsa('[data-kind]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-kind');
        if (!state.shot) return;
        b.disabled = true;
        nextFrame().then(function () { switchKind(k); after(); });
      });
    });
  }
  function switchKind(kind) {
    var sh = state.shot;
    sh.det = GD.redetect(sh.det, kind);
    sh.grid = sh.det;
    sh.chosen = kind;
    state.frameEdit = null; state.existing = null;
    updateShotSession({ kind: kind, frame: null });
    toast((kind === 'phone' ? '改用手機版型定位' : '改用電腦版偵測') + '：' + (sh.grid.ok ? '找到 ' + sh.grid.posts + ' 篇貼文' : '沒找到，請手動框選'));
  }

  function renderUploadArea() {
    var area = document.getElementById('upArea');
    if (!area) return;
    var err = state.uploadError ? '<div class="notice" role="alert">' + I.frame + '<p>' + esc(state.uploadError) + '</p></div>' : '';
    if (state.loading) {
      area.innerHTML =
        '<div class="drop is-loading" aria-busy="true" role="status">' +
          '<span class="spin" aria-hidden="true"></span>' +
          '<span class="d-title">' + esc(state.loading.text) + '</span>' +
          '<span class="d-sub">在你的裝置上縮圖、判斷截圖類型、找出貼文區</span>' +
        '</div>' +
        '<p class="privacy">' + I.device + '照片只在你的裝置上處理，不會上傳。</p>' +
        '<div class="actions mt-24"><button class="link muted" type="button" disabled>沒有截圖？先用示範截圖</button></div>';
      return;
    }
    if (!state.shot) {
      area.innerHTML = err +
        '<label class="drop" id="drop" tabindex="0">' +
          I.upload +
          '<span class="d-title">把主頁截圖拖到這裡</span>' +
          '<span class="d-sub">或點一下選擇圖片 · PNG、JPG 皆可</span>' +
          '<input type="file" id="shotInput" accept="image/*">' +
        '</label>' +
        '<p class="privacy">' + I.device + '照片只在你的裝置上處理，不會上傳。</p>' +
        '<div class="actions mt-24">' +
          '<button class="link muted" type="button" id="useDemo">沒有截圖？先用示範截圖</button>' +
        '</div>';
      var drop = document.getElementById('drop');
      var input = document.getElementById('shotInput');
      input.addEventListener('change', function () { if (input.files[0]) readShot(input.files[0]); });
      drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
      bindDrop(drop, function (files) { if (files[0]) readShot(files[0]); });
      document.getElementById('useDemo').addEventListener('click', useDemoShot);
    } else {
      var s = state.shot;
      area.innerHTML = err +
        '<div class="preview">' +
          '<div class="shot"><img src="' + s.url + '" alt="你的主頁截圖預覽"></div>' +
          '<div class="meta">' +
            '<span class="ok">' + I.check + (s.isDemo ? '已載入示範截圖' : '已讀取截圖') + '</span>' +
            '<span class="fname">' + esc(s.name) + '</span>' +
            '<span class="small">' + s.width + ' × ' + s.height + ' px' + (s.isDemo ? ' · 抽象色塊示意' : '') + '</span>' +
            kindBarHTML(s) +
            '<span class="det small">' + detLine(s) + '</span>' +
            '<div class="row">' +
              '<label class="link muted" tabindex="0" id="replaceLbl">更換<input type="file" id="shotInput" accept="image/*" hidden></label>' +
              '<button class="link muted" type="button" id="removeShot">移除</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        askKindHTML(s) +
        '<p class="privacy">' + I.device + '照片只在你的裝置上處理，不會上傳。</p>' +
        '<div class="actions mt-32"><button class="btn btn-block" type="button" id="toStyle">下一步：選類型 ' + I.arrow + '</button></div>';
      var inp = document.getElementById('shotInput');
      inp.addEventListener('change', function () { if (inp.files[0]) readShot(inp.files[0]); });
      document.getElementById('replaceLbl').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
      document.getElementById('removeShot').addEventListener('click', function () {
        if (state.shot && !state.shot.isDemo && /^blob:/.test(state.shot.url)) URL.revokeObjectURL(state.shot.url);
        state.shot = null; state.shotP = null; state.analysisKey = null; state.existing = null; state.frameEdit = null;
        clearShotSession();
        renderUploadArea(); toast('已移除截圖');
      });
      document.getElementById('toStyle').addEventListener('click', function () { go('style'); });
      bindDrop(qs('.preview', area), function (files) { if (files[0]) readShot(files[0]); });
      bindKind(area, renderUploadArea);
    }
  }

  function bindDrop(el, onFiles) {
    ['dragenter', 'dragover'].forEach(function (t) {
      el.addEventListener(t, function (e) { e.preventDefault(); el.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      el.addEventListener(t, function (e) { e.preventDefault(); el.classList.remove('over'); });
    });
    el.addEventListener('drop', function (e) {
      var files = Array.prototype.filter.call(e.dataTransfer.files || [], function (f) { return /^image\//.test(f.type) || isHeic(f); });
      if (files.length) onFiles(files); else toast('請放入圖片檔');
    });
  }

  /* ---------- 讀圖＋分類＋偵測（全部在本地，不送網路） ----------
   * 1. 先讓「正在讀取主頁…」畫出來（rAF＋setTimeout 0）
   * 2. GridDetect.decode：只解碼取尺寸，再用 createImageBitmap 縮到寬 1080（原圖只拿來當預覽的 object URL）
   * 3. GridDetect.detect：getImageData 一次取像素 → 分類 → 手機版型定位／電腦版偵測
   * 4. 把縮小後的截圖存成 JPEG 放進 sessionStorage（重新整理後還原第 5 步預覽；存不下就算了）
   * 5. 釋放 ImageBitmap／canvas */
  function analyzeShot(o) {
    state.loading = { text: o.loadingText || '正在讀取主頁…' };
    state.uploadError = null;
    if (currentRoute() === 'upload') renderUploadArea();
    var t0 = performance.now(), t1;
    return nextFrame().then(function () {
      return GD.decode(o.blob, o.url);
    }).then(function (d) {
      t1 = performance.now();
      return wait(state.debugDelay).then(function () {
        var t2 = performance.now();
        var det = GD.detect(d.src, { full: { w: d.w, h: d.h } });
        if (o.kind && o.kind !== det.kind) det = GD.redetect(det, o.kind);
        var t3 = performance.now();
        var snap = o.persist === false ? null : snapshot(d.src);
        GD.release(d.src);
        var shot = {
          url: o.url, width: d.w, height: d.h, name: o.name, isDemo: !!o.isDemo, det: det, grid: det,
          srcId: o.srcId || (o.isDemo ? 'demo' : o.name + '|' + d.w + 'x' + d.h), chosen: o.kind || null,
          ms: { decode: Math.round(t1 - t0), detect: Math.round(t3 - t2), total: Math.round(t3 - t0 - (t2 - t1)), how: d.how }
        };
        if (o.frame) {
          var F = o.frame;
          shot.grid = GD.fromFrame(det, { x: F.x * d.w, y: F.y * d.h, w: F.w * d.w, h: F.h * d.h }, F.ratio);
        }
        if (snap) saveShotSession(shot, snap);
        return shot;
      });
    }).then(function (sh) {
      state.loading = null; return sh;
    }, function (e) {
      state.loading = null; throw e;
    });
  }
  // 分析用縮圖（寬 ≤ 1080）→ JPEG dataURL
  function snapshot(src) {
    try {
      var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(src, 0, 0);
      var url = cv.toDataURL('image/jpeg', 0.8);
      cv.width = 0; cv.height = 0;
      return { url: url, w: w, h: h };
    } catch (e) { return null; }
  }

  /* ---------- sessionStorage：重新整理後還原截圖（存不下時溫和降級：只保留已拿掉的索引） ---------- */
  var SHOT_KEY = 'liuge.shot.v1';
  function saveShotSession(shot, snap) {
    try {
      sessionStorage.setItem(SHOT_KEY, JSON.stringify({ v: 1, name: shot.name, isDemo: shot.isDemo, srcId: shot.srcId, url: snap.url, kind: shot.chosen, frame: null }));
    } catch (e) { try { sessionStorage.removeItem(SHOT_KEY); } catch (e2) {} }
  }
  function loadShotSession() {
    try { var o = JSON.parse(sessionStorage.getItem(SHOT_KEY) || 'null'); return o && o.v === 1 && o.url ? o : null; } catch (e) { return null; }
  }
  function updateShotSession(patch) {
    var o = loadShotSession(); if (!o) return;
    Object.keys(patch).forEach(function (k) { o[k] = patch[k]; });
    try { sessionStorage.setItem(SHOT_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function clearShotSession() { try { sessionStorage.removeItem(SHOT_KEY); } catch (e) {} }
  function restoreShot() {
    var o = loadShotSession();
    if (!o || state.shot || state.shotP) return;
    setShot(analyzeShot({ blob: null, url: o.url, name: o.name, isDemo: o.isDemo, srcId: o.srcId, kind: o.kind, frame: o.frame, persist: false, loadingText: '正在還原剛才的截圖…' }))
      .then(function () {
        var r = currentRoute();
        if (r === 'upload') renderUploadArea();
        if (r === 'photos') { prepareExisting(); drawGridPreview(); }
      }, function () { clearShotSession(); state.shotP = null; if (currentRoute() === 'upload') renderUploadArea(); });
  }

  function setShot(p) {
    state.shotP = p;
    state.analysisKey = null; state.existing = null; state.frameEdit = null;
    return p.then(function (s) {
      if (state.shotP !== p) return s;
      if (state.shot && !state.shot.isDemo && state.shot.url !== s.url && /^blob:/.test(state.shot.url)) URL.revokeObjectURL(state.shot.url);
      state.shot = s;
      return s;
    });
  }

  function readShot(file) {
    var heic = isHeic(file);
    if (!/^image\//.test(file.type) && !heic) { toast('請選擇圖片檔'); return; }
    if (state.loading) return;
    // object URL：只在本機記憶體裡，不送出網路；原圖只拿來預覽
    var url = URL.createObjectURL(file);
    setShot(analyzeShot({ blob: file, url: url, name: file.name, isDemo: false })).then(function () {
      renderUploadArea();
    }, function () {
      URL.revokeObjectURL(url);
      state.shotP = null;
      state.uploadError = heic ? HEIC_MSG : '這張圖讀不出來，換一張試試（PNG、JPG 最穩）。';
      renderUploadArea();
      toast(heic ? '這張 HEIC 讀不出來' : '這張圖讀不出來，換一張試試');
    });
  }

  function demoShotP() {
    var d = Grid.makeDemoScreenshot();
    return analyzeShot({ blob: null, url: d.url, name: '示範主頁.png', isDemo: true });
  }
  function useDemoShot() {
    setShot(demoShotP()).then(renderUploadArea);
  }
  // 分析頁、下一篇需要截圖：沒有就悄悄用示範截圖
  function ensureShot() {
    if (state.shot) return Promise.resolve(state.shot);
    if (state.shotP) return state.shotP;
    return setShot(demoShotP());
  }

  /* =========================================================
     2. 選類型
     ========================================================= */
  function viewStyle() {
    var cards = STYLES.map(function (s, i) {
      var on = s.id === state.styleId;
      return '<button class="card" type="button" data-id="' + s.id + '" aria-pressed="' + on + '">' +
        Grid.gridHTML(Grid.MINI[s.id]) +
        '<span class="check">' + I.check + '</span>' +
        '<span><span class="c-no">類型 ' + pad2(i + 1) + '</span>' +
        '<span class="c-name" style="display:block">' + s.name + '</span>' +
        '<span class="c-tag" style="display:block">' + s.tagline + '</span></span>' +
      '</button>';
    }).join('');
    $main.innerHTML =
      '<div class="wrap screen">' +
        '<div class="stg">' +
          '<span class="eyebrow">步驟 02 — 方向</span>' +
          '<h1 class="h1">你想讓主頁，<br>走哪一種樣子？</h1>' +
          '<p class="lead">每一種類型都有自己的排版規則。選一個最接近的目標就好，混合也沒關係，我會以它為主來看你的主頁。</p>' +
        '</div>' +
        '<div class="style-layout">' +
          '<div class="cards stg" role="group" aria-label="帳號類型">' + cards + '</div>' +
          '<aside class="stg" id="rulesBox"></aside>' +
        '</div>' +
      '</div>';
    qsa('.card', $main).forEach(function (b) {
      b.addEventListener('click', function () {
        state.styleId = b.getAttribute('data-id');
        qsa('.card', $main).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        renderRules(true);
        if (window.innerWidth < 880) {
          var box = document.getElementById('rulesBox');
          setTimeout(function () { box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); }, 60);
        }
      });
    });
    renderRules(false);
  }

  function renderRules(animate) {
    var box = document.getElementById('rulesBox');
    var s = styleById(state.styleId);
    if (!s) {
      box.innerHTML = '<div class="rules"><p class="rules-empty">點一張卡片，這裡會顯示該類型的排版重點。</p></div>' +
        '<div class="style-foot"><button class="btn" type="button" disabled>下一步：開始分析 ' + I.arrow + '</button></div>';
      return;
    }
    box.innerHTML =
      '<div class="rules' + (animate ? ' fade-swap' : '') + '">' +
        '<span class="section-label">排版規則</span>' +
        '<h3>' + s.name + '的排版重點</h3>' +
        '<ol>' + s.rules.map(function (r, i) {
          return '<li><span class="n">' + pad2(i + 1) + '</span><span>' + r + '</span></li>';
        }).join('') + '</ol>' +
        '<p class="cad">發文節奏：' + s.cadence + '</p>' +
      '</div>' +
      '<div class="style-foot"><button class="btn" type="button" id="toAnalysis">下一步：開始分析 ' + I.arrow + '</button></div>';
    document.getElementById('toAnalysis').addEventListener('click', function () { go('analysis'); });
  }

  /* =========================================================
     3. 分析結果（總評與建議是示範內容；格子區與封存位置是本地偵測）
     ========================================================= */
  function loadingHTML(title, sub) {
    return '<div class="wrap screen"><div class="loading stg" role="status">' +
      '<p class="l-title">' + title + '</p><div class="lbar"></div><p class="l-sub">' + sub + '</p></div></div>';
  }

  function viewAnalysis() {
    $main.innerHTML = loadingHTML('正在讀你的主頁…', '找出貼文區 · 色調 · 留白 · 節奏');
    ensureShot().then(function () {
      var key = state.styleId + '|' + state.shot.url;
      if (state.analysisKey === key && state.analysis) { drawAnalysis(); stagger(); return; }
      AI.analyzeProfile(state.shot, state.styleId).then(function (res) {
        if (currentRoute() !== 'analysis' || state.styleId + '|' + state.shot.url !== key) return;
        state.analysis = res; state.analysisKey = key;
        state.shots = null; state.shotsKey = null;
        drawAnalysis();
        stagger();
      });
    });
  }

  function levelOf(v) {
    if (v >= 0.68) return { t: '穩定', cls: '' };
    if (v >= 0.48) return { t: '還可以', cls: '' };
    return { t: '可以再加強', cls: 'low' };
  }

  function drawAnalysis() {
    var a = state.analysis, s = styleById(state.styleId);
    $main.innerHTML =
      '<div class="wrap screen analysis-ready">' +
        '<div class="an">' +
          '<div class="an-head stg">' +
            '<div class="title-row"><span class="eyebrow" style="margin:0">步驟 03 — 讀主頁</span><span class="tag-demo">示範內容</span></div>' +
            '<h1 class="h1 mt-16">' + analysisVerdict(a) + '</h1>' +
            '<p class="summary">' + a.summary + '</p>' +
            '<div class="an-foot an-foot-top"><button class="btn" type="button" id="toNextTop">看下一篇拍什麼 ' + I.arrow + '</button></div>' +
          '</div>' +
          '<div class="an-left stg" id="anLeft"></div>' +
          '<div class="an-body">' +
            '<div class="stg">' +
              '<span class="section-label">接下來要做的三件事</span>' +
              '<ol class="tips">' + a.tips.map(function (t, i) {
                return '<li><span class="num">' + pad2(i + 1) + '</span><div><h3>' + t.title + '</h3><p>' + t.body + '</p></div></li>';
              }).join('') + '</ol>' +
            '</div>' +
            '<div class="stg mt-48">' +
              '<span class="section-label">細節：五個面向</span>' +
              '<div class="dims">' + a.dims.map(function (d) {
                var lv = levelOf(d.value);
                return '<div class="dim"><div class="dim-top"><span class="dim-name">' + d.label + '</span><span class="dim-lv ' + lv.cls + '">' + lv.t + '</span></div>' +
                  '<div class="track" role="img" aria-label="' + d.label + '：' + lv.t + '"><span data-w="' + Math.round(d.value * 100) + '"></span><i class="ticks"></i></div>' +
                  '<p class="dim-note">' + d.note + '</p></div>';
              }).join('') + '</div>' +
              '<p class="small mt-24">細條分三段：可以再加強／還可以／穩定。這裡不打分數，只看方向。</p>' +
              '<div class="an-foot"><button class="btn" type="button" id="toNext">下一篇拍什麼 ' + I.arrow + '</button></div>' +
            '</div>' +

          '</div>' +
        '</div>' +
      '</div>';
    renderShotPanel();
    // 條圖進場動畫（800ms）
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        qsa('.track span', $main).forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; });
      });
    });
    document.getElementById('toNext').addEventListener('click', function () { go('next'); });
    document.getElementById('toNextTop').addEventListener('click', function () { go('next'); });
  }

  // 步驟 3 標題：先講結論與要做的動作（有建議收起的格子就直接說第幾格）
  function analysisVerdict(a) {
    var g = state.shot && state.shot.grid;
    var arch = [];
    try { if (g && g.ok && g.mode !== 'manual') arch = GD.pickArchive(g); } catch (e) {}
    if (arch.length) {
      return '先收起' + arch.slice(0, 3).map(function (x) { return '<span class="nowrap">第 ' + (x.cell.row + 1) + ' 排第 ' + (x.cell.col + 1) + ' 格</span>'; }).join('、') +
        '，<br>再照下面三件事做';
    }
    var t = a.tips && a.tips[0];
    return t ? '先做這件事：<br>' + t.title : '照下面三件事做';
  }

  /* ---------- 截圖面板：偵測框、格線、封存標記、手動拖框 ---------- */
  function guessFrame(sh) {
    var g = sh.grid;
    // 偵測結果附的初始框：手機＝分頁列之下、全寬到導覽列；找不到分頁列＝全寬、圖高 45%～導覽列（保守猜測）
    var mf = g && g.manualFrame;
    if (mf && mf.w > 0 && mf.h > 0) return { x: mf.x, y: mf.y, w: mf.w, h: mf.h };
    if (g && g.box && g.box.w > 0) return { x: g.box.x, y: g.box.y, w: g.box.w, h: Math.max(g.box.h, g.cellH * 0.6) };
    var W = sh.width, H = sh.height;
    var h = Math.min(H * 0.5, W * 1.2);
    return { x: W * 0.04, y: H - h - H * 0.04, w: W * 0.92, h: h };
  }

  function renderShotPanel() {
    var box = document.getElementById('anLeft');
    if (!box) return;
    var sh = state.shot, g = sh.grid, W = sh.width, H = sh.height;
    var auto = g && g.ok;
    if (!auto && !state.frameEdit) state.frameEdit = Object.assign(guessFrame(sh), { ratio: (g && g.ratio) || '3:4' });
    var ed = state.frameEdit;
    var arch = auto && !ed ? GD.pickArchive(g) : [];
    var archBy = {};
    arch.forEach(function (x, k) { archBy[x.cell.i] = k + 1; });

    var layer = '';
    if (ed) {
      layer = '<i class="dim" id="dimT"></i><i class="dim" id="dimB"></i><i class="dim" id="dimL"></i><i class="dim" id="dimR"></i>' +
        '<div class="mframe" id="mframe" tabindex="0" role="group" aria-label="手動框選貼文區：拖曳框內移動，拖曳四邊或四角調整大小，也可用方向鍵移動">' +
        '<div class="mf-grid" id="mfGrid"></div>' +
        ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map(function (h) { return '<span class="hd hd-' + h + '" data-h="' + h + '"></span>'; }).join('') +
      '</div>';
    } else if (g && g.box) {
      var bx = g.box, bBot = bx.y + bx.h;
      layer += '<div class="gbox tag-in" style="left:' + pct(bx.x, W) + ';top:' + pct(bx.y, H) + ';width:' + pct(bx.w, W) + ';height:' + pct(bx.h, H) + '"><span class="gbox-tag">貼文區</span></div>';
      g.cells.forEach(function (c) {
        var top = Math.max(c.y, bx.y), bot = Math.min(c.y + c.h, bBot);
        if (bot - top < 2) return;
        var n = archBy[c.i];
        var cls = n ? 'gc arch' : c.hasPost ? 'gc post' : 'gc gempty'; // 不用 .empty：會吃到第 5 步空狀態的虛線框與 padding
        var chip = n ? '<span class="mk"><b>' + pad2(n) + '</b>建議封存</span>'
          : c.hasPost ? '<span class="gn">' + pad2(c.postNo) + '</span>' : '<span class="ge">空格</span>';
        layer += '<div class="' + cls + '" style="left:' + pct(c.x, W) + ';top:' + pct(top, H) + ';width:' + pct(c.w, W) + ';height:' + pct(bot - top, H) + '">' + chip + '</div>';
      });
    }

    var head = kindBarHTML(sh) + askKindHTML(sh);
    if (!auto) {
      if (g && g.kind === 'phone' && !g.tabRow) {
        head += '<div class="notice" role="status">' + I.frame + '<p><b>我找不到 IG 主頁的分頁圖示列（九宮格、Reels、標記那一排）。</b>先放了一個保守的框：全寬、從畫面中段到底部導覽列。請把框的上緣拖到第一排貼文的上緣；框裡會即時畫出 3 欄格線。如果這其實是電腦截圖，按上面的「電腦」。</p></div>';
      } else {
        head += '<div class="notice" role="status">' + I.frame + '<p><b>我不太確定你的貼文從哪裡開始。</b>請拖一個框，框住你的貼文；框裡會即時畫出 3 欄格線。</p></div>';
      }
    }

    var controls = '';
    if (ed) {
      controls =
        '<div class="mf-bar">' +
          '<p class="small">拖曳框內移動，拖曳四邊或四角調整大小。框的上緣對齊第一排貼文，左右對齊貼文的左右邊。</p>' +
          '<div class="mf-ratio" role="group" aria-label="格子比例"><span class="lbl">格子比例</span>' +
            GD.RATIOS.map(function (R) { return '<button type="button" class="pill" data-r="' + R.id + '" aria-pressed="' + (ed.ratio === R.id) + '">' + R.id + '</button>'; }).join('') +
          '</div>' +
          '<div class="mf-actions">' +
            '<button class="btn btn-sm" type="button" id="mfApply">套用這個框</button>' +
            (auto ? '<button class="link muted" type="button" id="mfCancel">取消</button>' : '') +
            (sh.det && sh.det.ok && g.mode === 'manual' ? '<button class="link muted" type="button" id="mfAuto">改回自動偵測</button>' : '') +
          '</div>' +
        '</div>';
    } else if (g && g.box) {
      controls =
        '<div class="det-cap">' +
          '<p class="det-line">' + I.scan + '<span>' + (g.mode === 'manual' ? '依你拉的框：' : '找到貼文區：') + '<b>' + g.posts + '</b> 篇貼文 · ' + g.cols + ' 欄 · 格子 ' + g.ratio + (sh.det ? ' · ' + (sh.det.theme === 'dark' ? '深色模式' : '淺色模式') : '') + '</span></p>' +
          '<button class="link muted manual-btn" type="button" id="manualBtn">' + I.frame + '手動調整</button>' +
        '</div>' +
        '<p class="small mt-8">' + (g.mode === 'manual' ? '格線依你拉的框重新計算。'
          : g.kind === 'phone' ? '依 IG App 的版面定位：先找到九宮格／Reels／標記那一排分頁圖示，貼文區從它下面開始、左右貼齊、等寬 3 欄，停在底部導覽列之前；頭像、簡介、按鈕、限動精選都在分頁列上面，不會被標記。'
          : '在你的裝置上用像素分析找出貼文區，跳過頭像、簡介、精選動態與分頁圖示。') + '只有真的有貼文的格子會被編號，空格永遠不會被標記。</p>' +
        (g.ratioGuessed && g.mode !== 'manual' ? '<p class="small mt-8 ratio-guess">格子比例為推測（' + g.ratio + '）：貼文太少、量不到列縫。如果格線對不上，按「手動調整」換比例。</p>' : '');
    }

    var archHTML = '';
    if (!ed && auto) {
      if (!arch.length) {
        archHTML = '<div class="gentle"><p>貼文還不多，先不用封存，專心把下一篇拍好。</p>' +
          '<span class="small">目前偵測到 ' + g.posts + ' 篇。超過 5 篇後，我才會建議要不要收起哪一格。</span></div>';
      } else {
        archHTML = '<div class="title-row mt-24"><span class="section-label" style="flex:1;margin:0">建議封存</span><span class="tag-demo">示範內容</span></div>' +
          '<ul class="archive-list">' + arch.map(function (x, k) {
            return '<li><span class="pos">' + pad2(k + 1) + '</span><span><b class="where">第 ' + (x.cell.row + 1) + ' 排第 ' + (x.cell.col + 1) + ' 格</b>' + x.reason + '</span></li>';
          }).join('') + '</ul>' +
          '<p class="small mt-8">' + g.posts + ' 篇貼文 → 建議封存 ' + arch.length + ' 格。挑法是示範：和整頁平均色差最大、或飽和度最突兀的格子。</p>';
      }
    }

    box.innerHTML =
      '<span class="section-label">你的九宮格</span>' +
      head +
      '<div class="shotbox">' +
        '<div class="shotwrap' + (ed ? ' editing' : '') + '" id="shotWrap" style="--ar:' + (W / H).toFixed(4) + '"><img src="' + sh.url + '" alt="主頁截圖，疊上偵測到的貼文格線" draggable="false">' +
          '<div class="glayer" id="glayer">' + layer + '</div>' +
        '</div>' +
        '<div class="shot-cap"><span class="small">' + (sh.isDemo ? '示範主頁（抽象色塊）' : esc(sh.name)) + '</span>' + (ed ? '<span class="tag-demo">手動框選中</span>' : '') + '</div>' +
        controls +
      '</div>' +
      archHTML;

    if (ed) bindFrame();
    bindKind(box, function () { renderShotPanel(); });
    var mb = document.getElementById('manualBtn');
    if (mb) mb.addEventListener('click', function () {
      state.frameEdit = Object.assign(guessFrame(sh), { ratio: g.ratio });
      renderShotPanel();
    });
  }

  function positionFrame() {
    var f = state.frameEdit, sh = state.shot, W = sh.width, H = sh.height;
    var fr = document.getElementById('mframe'), gridEl = document.getElementById('mfGrid');
    if (!fr) return;
    fr.style.left = pct(f.x, W); fr.style.top = pct(f.y, H);
    fr.style.width = pct(f.w, W); fr.style.height = pct(f.h, H);
    // 框外變暗（四塊矩形，不用巨大陰影，這樣邊緣的拖曳把手不會被裁掉）
    var dims = { dimT: [0, 0, W, f.y], dimB: [0, f.y + f.h, W, H - f.y - f.h], dimL: [0, f.y, f.x, f.h], dimR: [f.x + f.w, f.y, W - f.x - f.w, f.h] };
    Object.keys(dims).forEach(function (id) {
      var d = dims[id], el = document.getElementById(id);
      if (!el) return;
      el.style.left = pct(d[0], W); el.style.top = pct(d[1], H); el.style.width = pct(Math.max(0, d[2]), W); el.style.height = pct(Math.max(0, d[3]), H);
    });
    // 框內即時 3 欄格線（依目前比例畫橫線）
    var R = GD.RATIOS.filter(function (r) { return r.id === f.ratio; })[0] || GD.RATIOS[0];
    var ch = (f.w / 3) * R.r, lines = '<i class="v" style="left:33.333%"></i><i class="v" style="left:66.666%"></i>';
    for (var y = ch; y < f.h - 2; y += ch) lines += '<i class="h" style="top:' + pct(y, f.h) + '"></i>';
    gridEl.innerHTML = lines;
  }

  function bindFrame() {
    var sh = state.shot, wrap = document.getElementById('shotWrap'), fr = document.getElementById('mframe');
    positionFrame();
    var drag = null;
    fr.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button > 0) return;
      var h = e.target.getAttribute && e.target.getAttribute('data-h') || 'move';
      drag = { h: h, sx: e.clientX, sy: e.clientY, f: Object.assign({}, state.frameEdit), k: sh.width / wrap.clientWidth };
      fr.setPointerCapture(e.pointerId);
      fr.classList.add('dragging');
      e.preventDefault();
    });
    fr.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = (e.clientX - drag.sx) * drag.k, dy = (e.clientY - drag.sy) * drag.k;
      var f = Object.assign({}, drag.f), W = sh.width, H = sh.height, h = drag.h;
      var minW = W * 0.2, minH = Math.min(H * 0.08, W * 0.1);
      if (h === 'move') {
        f.x = clamp(f.x + dx, 0, W - f.w); f.y = clamp(f.y + dy, 0, H - f.h);
      } else {
        if (h.indexOf('w') >= 0) { var nx = clamp(f.x + dx, 0, f.x + f.w - minW); f.w += f.x - nx; f.x = nx; }
        if (h.indexOf('e') >= 0) f.w = clamp(f.w + dx, minW, W - f.x);
        if (h.indexOf('n') >= 0) { var ny = clamp(f.y + dy, 0, f.y + f.h - minH); f.h += f.y - ny; f.y = ny; }
        if (h.indexOf('s') >= 0) f.h = clamp(f.h + dy, minH, H - f.y);
      }
      Object.assign(state.frameEdit, f);
      positionFrame();
    });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      fr.addEventListener(t, function () { drag = null; fr.classList.remove('dragging'); });
    });
    fr.addEventListener('keydown', function (e) {
      var m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!m) return;
      e.preventDefault();
      var f = state.frameEdit, step = sh.width * (e.shiftKey ? 0.05 : 0.01);
      f.x = clamp(f.x + m[0] * step, 0, sh.width - f.w); f.y = clamp(f.y + m[1] * step, 0, sh.height - f.h);
      positionFrame();
    });
    qsa('.mf-ratio .pill', $main).forEach(function (b) {
      b.addEventListener('click', function () {
        state.frameEdit.ratio = b.getAttribute('data-r');
        qsa('.mf-ratio .pill', $main).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        positionFrame();
      });
    });
    document.getElementById('mfApply').addEventListener('click', function () {
      var f = state.frameEdit;
      state.shot.grid = GD.fromFrame(state.shot.det, { x: f.x, y: f.y, w: f.w, h: f.h }, f.ratio);
      state.frameEdit = null; state.existing = null;
      var sw = state.shot.width, shh = state.shot.height;
      updateShotSession({ frame: { x: f.x / sw, y: f.y / shh, w: f.w / sw, h: f.h / shh, ratio: f.ratio } });
      renderShotPanel();
      toast('已套用：框內有 ' + state.shot.grid.posts + ' 篇貼文');
    });
    var cancel = document.getElementById('mfCancel');
    if (cancel) cancel.addEventListener('click', function () { state.frameEdit = null; renderShotPanel(); });
    var back = document.getElementById('mfAuto');
    if (back) back.addEventListener('click', function () { state.shot.grid = state.shot.det; state.frameEdit = null; state.existing = null; updateShotSession({ frame: null }); renderShotPanel(); });
  }

  /* =========================================================
     4. 下一篇拍什麼（示範內容）
     ========================================================= */
  function viewNext() {
    var key = state.styleId;
    if (state.shotsKey === key && state.shots) { drawNext(); return; }
    $main.innerHTML = loadingHTML('正在想下一篇…', '光線 · 構圖 · 輪播順序');
    var go2 = function (analysis) {
      return AI.suggestNextShot(analysis, state.styleId).then(function (list) {
        if (currentRoute() !== 'next' || state.styleId !== key) return;
        state.shots = list; state.shotsKey = key; state.shotIndex = 0;
        drawNext(); stagger();
      });
    };
    ensureShot().then(function () {
      if (state.analysis && state.analysisKey && state.analysisKey.indexOf(key + '|') === 0) go2(state.analysis);
      else AI.analyzeProfile(state.shot, key).then(function (a) {
        state.analysis = a; state.analysisKey = key + '|' + state.shot.url; return go2(a);
      });
    });
  }

  function compSVG(comp) {
    var x = comp.subject[0] * 120, y = comp.subject[1] * 150;
    var g = '<rect x="0.6" y="0.6" width="118.8" height="148.8" fill="none" stroke="#2B2724" stroke-width="1.25"/>';
    var guide = 'stroke="#7A7169" stroke-width=".75" stroke-dasharray="2 3" fill="none"';
    var sub = '<circle cx="' + x + '" cy="' + y + '" r="10" fill="none" stroke="#8A6F5A" stroke-width="1.25"/><circle cx="' + x + '" cy="' + y + '" r="1.6" fill="#8A6F5A"/>';
    if (comp.type === 'thirds') {
      g += '<path ' + guide + ' d="M40 0v150M80 0v150M0 50h120M0 100h120"/>' + sub;
    } else if (comp.type === 'center') {
      g += '<path ' + guide + ' d="M60 0v150M0 75h120"/>' +
        '<rect x="' + (x - 14) + '" y="' + (y - 22) + '" width="28" height="44" fill="none" stroke="#8A6F5A" stroke-width="1.25"/>' +
        '<path d="M0 50h120" stroke="#DDD5CA" stroke-width=".75"/>';
    } else if (comp.type === 'diagonal') {
      g += '<path ' + guide + ' d="M0 150L120 0"/>' +
        '<path d="M14 132l22-12M52 106l18-10" stroke="#7A7169" stroke-width="1.25"/>' + sub;
    } else if (comp.type === 'topdown') {
      g += '<path ' + guide + ' d="M40 0v150M80 0v150M0 50h120M0 100h120"/>' +
        '<circle cx="' + x + '" cy="' + y + '" r="30" fill="none" stroke="#8A6F5A" stroke-width="1.25"/>' +
        '<circle cx="' + x + '" cy="' + y + '" r="17" fill="none" stroke="#8A6F5A" stroke-width=".75"/>';
    }
    // 光線方向（左上斜線）
    g += '<path d="M6 6l12 12M6 16l7 7M16 6l7 7" stroke="#C7B39C" stroke-width=".75"/>';
    return '<svg viewBox="0 0 120 150" role="img" aria-label="構圖示意：' + esc(comp.note) + '">' + g + '</svg>';
  }

  function drawNext() {
    var list = state.shots, i = state.shotIndex, sc = list[i], s = styleById(state.styleId);
    $main.innerHTML =
      '<div class="wrap screen">' +
        '<div class="stg">' +
          '<div class="title-row"><span class="eyebrow" style="margin:0">步驟 04 — 下一篇</span><span class="tag-demo">示範內容</span></div>' +
          '<h1 class="h1 mt-16" id="nextTitle">下一篇拍這個：' + sc.theme + '</h1>' +
        '</div>' +
        '<article class="shotcard stg" id="shotCard">' + shotCardInner(sc, i, list.length) + '</article>' +
        '<p class="lead stg">依你選的「' + s.name + '」與剛才的分析，挑一張最能讓主頁變安靜的照片。</p>' +
        '<div class="sc-tools stg">' +
          '<div class="dots" aria-hidden="true">' + list.map(function (_, k) { return '<i class="' + (k === i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
          '<div class="actions">' +
            '<button class="link swap" type="button" id="swapShot">' + I.swap + '換一個建議</button>' +
            '<button class="btn" type="button" id="toPhotos">整理新照片 ' + I.arrow + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.getElementById('swapShot').addEventListener('click', function () {
      state.shotIndex = (state.shotIndex + 1) % state.shots.length;
      var card = document.getElementById('shotCard');
      card.innerHTML = shotCardInner(state.shots[state.shotIndex], state.shotIndex, state.shots.length);
      document.getElementById('nextTitle').textContent = '下一篇拍這個：' + state.shots[state.shotIndex].theme;
      card.classList.remove('fade-swap'); void card.offsetWidth; card.classList.add('fade-swap');
      qsa('.dots i', $main).forEach(function (d, k) { d.classList.toggle('on', k === state.shotIndex); });
    });
    document.getElementById('toPhotos').addEventListener('click', function () { go('photos'); });
  }

  // 左欄：時間＋構圖；右欄：輪播順序＋曝光（兩欄高度接近）
  function shotCardInner(sc, i, n) {
    return '<header class="sc-head">' +
        '<div>' +
          '<div class="sc-kicker"><span class="k">第 ' + (i + 1) + ' 組，共 ' + n + ' 組 · ' + sc.kicker + '</span></div>' +
          '<h2 class="sc-title">' + sc.theme + '</h2>' +
          '<p class="sc-why">' + sc.why + '</p>' +
        '</div>' +
      '</header>' +
      '<div class="sc-body">' +
        '<div class="sc-col"><dl style="margin:0">' +
          '<div class="spec"><dt>時間</dt><dd>' + sc.time + '<span class="sub">' + sc.light + '</span></dd></div>' +
          '<div class="spec"><dt>構圖</dt><dd><div class="comp">' + compSVG(sc.comp) + '<p>' + sc.comp.note + '</p></div></dd></div>' +
        '</dl></div>' +
        '<div class="sc-col">' +
          '<span class="section-label">輪播順序</span>' +
          '<div class="carousel">' + sc.carousel.map(function (t, k) {
            var mini = Grid.MINI[state.styleId] || Grid.MINI.life;
            var cell = mini[[4, 0, 2, 6, 8][(k + i) % 5]];
            return '<div class="ci"><div class="cb">' + Grid.cellHTML(cell) + '<span>' + pad2(k + 1) + '</span></div><span class="ct">' + t + '</span></div>';
          }).join('') + '</div>' +
          '<p class="small mt-16">第一張要能單獨成立：它會出現在主頁九宮格上。其餘四張講過程，最後一張放資訊。</p>' +
          '<dl class="mt-32" style="margin-bottom:0"><div class="spec spec-top"><dt>曝光</dt><dd><ul>' + sc.exposure.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul></dd></div></dl>' +
        '</div>' +
      '</div>';
  }

  /* =========================================================
     5. 整理新照片（canvas，本地處理）
     ========================================================= */
  // ===== 第 5 步：頁面狀態與進出（cleanupPhotos／viewPhotos） =====
  var ph = { raf: 0, stageCv: null, drag: null, listeners: [] };

  function cleanupPhotos() {
    ph.listeners.forEach(function (l) { window.removeEventListener(l[0], l[1]); });
    ph.listeners = [];
    ph.stageCv = null;
  }
  function onWin(type, fn) { window.addEventListener(type, fn); ph.listeners.push([type, fn]); }
  function curPhoto() {
    return state.photos.filter(function (p) { return p.id === state.cur; })[0] || state.photos[0] || null;
  }

  function viewPhotos() {
    $main.innerHTML =
      '<div class="wrap screen">' +
        '<div class="stg">' +
          '<span class="eyebrow">步驟 05 — 修圖與排列</span>' +
          '<h1 class="h1">把新照片，<br>修成同一個調子。</h1>' +
          '<p class="lead">裁成 4:5、扶正水平、調亮度對比與色溫，一鍵套用到全部，再看它們排在主頁上的樣子。全部在你的瀏覽器裡完成。</p>' +
        '</div>' +
        '<div id="phBody"></div>' +
        '<input type="file" id="phInput" accept="image/*" multiple hidden>' +
      '</div>';
    var input = document.getElementById('phInput');
    input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
    prepareExisting();
    drawPhotos();
    onWin('resize', function () { if (ph.stageCv) sizeStage(); });
    if (state.music.focus) {
      setTimeout(function () {
        var b = document.getElementById('musicBox');
        if (b) b.scrollIntoView({ block: 'start' });
        state.music.focus = false;
      }, 80);
    }
  }

  /* 多張照片：逐張讀（每張之間讓畫面喘口氣），顯示「正在讀取第 n／N 張…」 */
  // ===== 第 5 步：讀取新照片 =====
  function addFiles(fileList) {
    var files = Array.prototype.filter.call(fileList || [], function (f) { return /^image\//.test(f.type) || isHeic(f); });
    if (!files.length) { toast('請選擇圖片檔'); return; }
    if (ph.loading) { toast('上一批還在讀取中'); return; }
    ph.loading = true;
    var N = files.length, added = [], heicFail = 0, fail = 0, i = 0;
    function next() {
      if (i >= N) return done();
      phLoading(i + 1, N);
      nextFrame().then(function () { return Editor.loadFile(files[i]); }).then(function (p) {
        makeThumb(p); state.photos.push(p); added.push(p);
      }, function (e) { if (e && e.code === 'heic') heicFail++; else fail++; }).then(function () { i++; next(); });
    }
    function done() {
      ph.loading = false;
      phLoading(0, 0);
      if (!state.cur && added[0]) state.cur = added[0].id;
      if (added.length) state.music.recs = null;
      if (currentRoute() === 'photos') drawPhotos();
      if (heicFail) toast(HEIC_MSG, null, 6000);
      else if (fail) toast('有 ' + fail + ' 張讀不出來，已加入 ' + added.length + ' 張');
      else toast('已加入 ' + added.length + ' 張照片');
    }
    next();
  }
  function phLoading(n, N) {
    var body = document.getElementById('phBody');
    var el = document.getElementById('phLoad');
    if (!n) { if (el) el.remove(); qsa('#addMore, #phEmpty', $main).forEach(function (b) { b.removeAttribute('aria-disabled'); b.classList.remove('is-busy'); }); return; }
    if (!body) return;
    if (!el) {
      el = document.createElement('div');
      el.id = 'phLoad'; el.className = 'ph-load'; el.setAttribute('role', 'status');
      body.insertBefore(el, body.firstChild);
    }
    el.innerHTML = '<span class="spin" aria-hidden="true"></span><span>正在讀取第 ' + n + '／' + N + ' 張…</span>';
    qsa('#addMore, #phEmpty', $main).forEach(function (b) { b.setAttribute('aria-disabled', 'true'); b.classList.add('is-busy'); });
  }

  function makeThumb(p) {
    p._thumb = p._thumb || document.createElement('canvas');
    Editor.render(p, p._thumb, 216, 270);
  }

  // 既有貼文：有主頁截圖就從偵測到的貼文格裁，沒有就用抽象色塊
  // ===== 第 5 步：既有貼文縮圖（從主頁截圖裁格） =====
  function prepareExisting() {
    var sh = state.shot;
    if (!sh && state.shotP) { // 重新整理後截圖還在還原中
      state.shotP.then(function () { if (currentRoute() === 'photos') { prepareExisting(); drawGridPreview(); } }, function () {});
      return;
    }
    if (!sh || !sh.grid || !sh.grid.posts) { state.existing = null; state.existingHints = []; state.chrome = null; return; }
    var g = sh.grid, key = sh.url + '|' + g.mode + '|' + g.kind + '|' + (g.box ? [g.box.x, g.box.y, g.box.w].map(Math.round).join(',') : '');
    if (state.existing && state.existingKey === key) return;
    // 分析頁標「建議封存」的格子 → 第 5 步加小標「建議拿掉」
    var archSet = {};
    if (g.ok && g.mode !== 'manual') GD.pickArchive(g).forEach(function (x) { archSet[x.cell.i] = 1; });
    var cells = g.cells.filter(GD.usableCell).slice(0, 12); // 和 Grid.cropExistingCells 同一套篩選（排除導覽列碎片）
    var img = new Image();
    img.onload = function () {
      state.existing = Grid.cropExistingCells(img, g, 12);
      state.chrome = Grid.cropProfileChrome(img, g);
      state.existingHints = cells.map(function (c) { return !!archSet[c.i]; });
      state.existingKey = key;
      if (currentRoute() === 'photos') drawGridPreview();
    };
    img.src = sh.url;
  }

  // ===== 第 5 步：拿掉／還原（archiveOld、restoreOld、restoreAll、drawArchived） =====
  /* ---------- 第 5 步：既有貼文「暫時拿掉」（模擬封存，絕不真的刪除） ----------
   * localStorage['liuge.archived.v1'] = { v:1, src:'來源截圖識別（檔名|寬x高）', removed:[原始索引…], updatedAt }
   * 原始索引 k ＝ 這張貼文在主頁上的順序（0 起算，畫面顯示「原第 k+1 格」）。恢復時依 k 排回原位，不是補到最後。 */
  var ARCH_KEY = 'liuge.archived.v1';
  function existingItems() {
    if (state.existing && state.existing.length) {
      return state.existing.map(function (u, k) { return { k: k, url: u, hint: !!state.existingHints[k] }; });
    }
    if (state.shot && state.shot.grid && state.shot.grid.posts) return []; // 還在裁切
    if (!state.shot && state.shotP) return [];
    return Grid.DEMO_PROFILE.map(function (c, k) { return { k: k, cell: c, hint: false }; });
  }
  function archSource() {
    var sh = state.shot;
    return sh && sh.grid && sh.grid.posts ? sh.srcId : 'demo-placeholder';
  }
  function archLoad() {
    try { var o = JSON.parse(localStorage.getItem(ARCH_KEY) || 'null'); return o && o.v === 1 && Array.isArray(o.removed) ? o : null; } catch (e) { return null; }
  }
  function archRemoved() {
    var o = archLoad();
    return o && o.src === archSource() ? o.removed.filter(function (k) { return typeof k === 'number'; }) : [];
  }
  function archSave(removed) {
    try { localStorage.setItem(ARCH_KEY, JSON.stringify({ v: 1, src: archSource(), removed: removed, updatedAt: new Date().toISOString() })); } catch (e) { /* 無痕模式存不了：畫面照常 */ }
  }
  function archiveOld(k) {
    var r = archRemoved();
    if (r.indexOf(k) >= 0) return;
    r.push(k); archSave(r);
    pinSave(pinList().filter(function (x) { return x !== k; }));
    if (state.order) state.order = state.order.filter(function (it) { return !(it.t === 'o' && it.k === k); });
    drawGridPreview();
    toast('已拿掉原第 ' + (k + 1) + ' 格', { label: '復原', fn: function () { restoreOld(k, true); } });
  }
  function restoreOld(k, quiet) {
    archSave(archRemoved().filter(function (x) { return x !== k; }));
    var pins = pinList();
    var order = (state.order || []).filter(function (it) { return !(it.t === 'o' && it.k === k); });
    var pinItems = [], rest = [];
    order.forEach(function (it) {
      if (it.t === 'o' && pins.indexOf(it.k) >= 0) pinItems.push(it); else rest.push(it);
    });
    var at = rest.length;
    for (var i = 0; i < rest.length; i++) {
      if (rest[i].t === 'o' && rest[i].k > k) { at = i; break; }
    }
    rest.splice(at, 0, { t: 'o', k: k });
    state.order = pinItems.concat(rest);
    drawGridPreview();
    if (!quiet) toast('原第 ' + (k + 1) + ' 格回到原位');
  }
  function restoreAll() {
    archSave([]);
    drawGridPreview();
    toast('已全部還原');
  }
  function oldThumbHTML(it) {
    return it.url ? '<img alt="" src="' + it.url + '" draggable="false">' : Grid.cellHTML(it.cell);
  }
  function drawArchived() {
    var box = document.getElementById('archBox');
    if (!box) return;
    var items = existingItems(), removed = archRemoved().slice().sort(function (a, b) { return a - b; });
    var byK = {}; items.forEach(function (it) { byK[it.k] = it; });
    removed = removed.filter(function (k) { return byK[k]; });
    var html = items.length ? '<p class="small arch-note">' + I.lock.replace('<svg', '<svg class="ic-inline"') + '這只是模擬封存的預覽，不會動到你的 IG，也不會刪除相簿裡的照片。</p>' : '';
    if (removed.length) {
      html += '<div class="archd">' +
        '<div class="arch-head"><span class="arch-title">已拿掉（' + removed.length + '）</span><button class="link muted" type="button" id="archAll">全部還原</button></div>' +
        '<ul class="arch-list">' + removed.map(function (k) {
          return '<li><span class="arch-th">' + oldThumbHTML(byK[k]) + '</span><span class="arch-pos">原第 ' + (k + 1) + ' 格' + (byK[k].hint ? '<em>建議拿掉</em>' : '') + '</span>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-restore="' + k + '">恢復</button></li>';
        }).join('') + '</ul></div>';
    }
    box.innerHTML = html;
    qsa('[data-restore]', box).forEach(function (b) {
      b.addEventListener('click', function () { restoreOld(Number(b.getAttribute('data-restore'))); });
    });
    var all = document.getElementById('archAll');
    if (all) all.addEventListener('click', restoreAll);
  }

  // ===== 第 5 步：整頁重畫（drawPhotos 會重建配樂區，換位置時不要呼叫） =====
  function drawPhotos() {
    var body = document.getElementById('phBody');
    if (!body) return;
    if (!state.photos.length) {
      body.innerHTML =
        '<div class="ph stg"><div>' +
          '<div class="empty" id="phEmpty" tabindex="0" role="button" aria-label="選擇照片">' +
            '<div class="e-art" aria-hidden="true"><span class="on"></span><span class="on"></span><span class="on"></span><span></span><span></span><span></span></div>' +
            '<span class="d-title">把這次想發的照片放進來</span>' +
            '<span class="d-sub">拖放或點一下選擇，可一次多張。之後可以裁切、扶正、調色，並看它們排在主頁上的樣子。</span>' +
            '<span class="btn btn-ghost btn-sm mt-16">選擇照片</span>' +
          '</div>' +
          '<p class="privacy">' + I.device + '照片只在你的裝置上處理，不會上傳。</p>' +
        '</div>' +
        '<div class="gp">' + gridPreviewShell() + '</div></div>';
      var em = document.getElementById('phEmpty');
      em.addEventListener('click', function () { if (!ph.loading) document.getElementById('phInput').click(); });
      em.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('phInput').click(); } });
      bindDrop(em, addFiles);
      drawGridPreview();
      return;
    }
    var p = curPhoto(); state.cur = p.id;
    var idx = state.photos.indexOf(p);
    body.innerHTML =
      '<div class="ph">' +
        '<section class="ed" aria-label="編輯照片">' +
          '<div class="strip" id="strip">' + state.photos.map(function (q, k) {
            return '<button class="th" type="button" data-id="' + q.id + '" aria-current="' + (q.id === p.id) + '" aria-label="編輯第 ' + (k + 1) + ' 張">' +
              '<canvas data-pid="' + q.id + '" width="216" height="270"></canvas><span class="ord chip">' + pad2(k + 1) + '</span></button>';
          }).join('') +
            '<button class="add" type="button" id="addMore" aria-label="再加入照片">' + I.plus + '</button>' +
          '</div>' +
          '<div class="ed-head">' +
            '<span class="ed-name">' + pad2(idx + 1) + ' · ' + esc(p.name) + '</span>' +
            '<span class="ed-ord">' +
              '<button class="icon-btn" type="button" id="rmPh" aria-label="移除這張">' + I.close + '</button>' +
            '</span>' +
          '</div>' +
          '<div class="stage" id="stage"><canvas id="stageCv"></canvas><div class="thirds"></div>' +
            '<span class="chip hint">拖曳調整位置</span><span class="chip ratio">4 : 5</span></div>' +
          '<div class="sliders">' +
            '<p class="sl-group">裁切</p>' +
            slider('rotate', '水平', -10, 10, 0.1, p.rotate) +
            slider('zoom', '縮放', 1, 3, 0.01, p.zoom) +
            '<p class="sl-group">調色</p>' +
            slider('brightness', '亮度', -50, 50, 1, p.brightness) +
            slider('contrast', '對比', -50, 50, 1, p.contrast) +
            slider('temperature', '色溫', -50, 50, 1, p.temperature) +
          '</div>' +
          '<div class="ed-actions">' +
            '<button class="btn btn-ghost" type="button" id="applyAll">套用這組調色到全部</button>' +
            '<button class="link muted" type="button" id="resetPh">重設這張</button>' +
          '</div>' +
        '</section>' +
        '<section class="gp" aria-label="九宮格預覽">' + gridPreviewShell() + '</section>' +
      '</div>';

    ph.stageCv = document.getElementById('stageCv');
    sizeStage();
    paintThumbs();
    drawGridPreview();
    renderMusicBox();
    bindEditor(p);
  }

  // ===== 第 5 步：單張照片編輯器（滑桿、舞台、縮圖列） =====
  function slider(key, label, min, max, step, val) {
    return '<div class="sl"><label for="sl-' + key + '">' + label + '</label>' +
      '<input type="range" id="sl-' + key + '" data-k="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">' +
      '<output id="o-' + key + '">' + fmt(key, val) + '</output></div>';
  }
  function fmt(k, v) {
    v = Number(v);
    if (k === 'rotate') return (v > 0 ? '+' : '') + v.toFixed(1) + '°';
    if (k === 'zoom') return v.toFixed(2) + '×';
    return (v > 0 ? '+' : '') + Math.round(v);
  }

  function sizeStage() {
    var cv = ph.stageCv; if (!cv) return;
    var w = cv.parentNode.clientWidth;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = Math.min(1080, Math.round(w * dpr));
    cv.width = W; cv.height = Math.round(W * 5 / 4);
    redraw(true);
  }

  // 用 rAF 合併連續的滑桿事件
  function redraw(thumbsToo) {
    cancelAnimationFrame(ph.raf);
    ph.raf = requestAnimationFrame(function () {
      var p = curPhoto();
      if (!p || !ph.stageCv) return;
      Editor.render(p, ph.stageCv);
      if (thumbsToo !== false) { makeThumb(p); paintThumbs(p.id); }
    });
  }

  function paintThumbs(onlyId) {
    qsa('canvas[data-pid]', $main).forEach(function (c) {
      var id = c.getAttribute('data-pid');
      if (onlyId && id !== onlyId) return;
      var p = state.photos.filter(function (q) { return q.id === id; })[0];
      if (!p || !p._thumb) return;
      var ctx = c.getContext('2d');
      ctx.drawImage(p._thumb, 0, 0, c.width, c.height);
    });
  }

  function bindEditor(p) {
    qsa('.sliders input[type=range]', $main).forEach(function (inp) {
      inp.addEventListener('input', function () {
        var k = inp.getAttribute('data-k');
        p[k] = Number(inp.value);
        document.getElementById('o-' + k).textContent = fmt(k, inp.value);
        redraw();
      });
      // 調完色再更新「照片氛圍」那一句（推薦的歌不跟著跳）
      inp.addEventListener('change', function () { setTimeout(updateMoodLine, 60); });
      // 雙擊滑桿回到 0
      inp.addEventListener('dblclick', function () {
        var k = inp.getAttribute('data-k');
        inp.value = k === 'zoom' ? 1 : 0; inp.dispatchEvent(new Event('input'));
      });
    });
    qsa('#strip .th', $main).forEach(function (b) {
      b.addEventListener('click', function () { state.cur = b.getAttribute('data-id'); drawPhotos(); });
    });
    document.getElementById('addMore').addEventListener('click', function () { if (!ph.loading) document.getElementById('phInput').click(); });
    bindDrop(document.getElementById('strip'), addFiles);
    document.getElementById('rmPh').addEventListener('click', function () {
      var i = state.photos.indexOf(p);
      state.photos.splice(i, 1);
      Editor.release(p); // ImageBitmap.close()、canvas 歸零
      var n = state.photos[Math.min(i, state.photos.length - 1)];
      state.cur = n ? n.id : null;
      state.music.recs = null;
      drawPhotos(); toast('已移除這張照片');
    });
    document.getElementById('resetPh').addEventListener('click', function () {
      var d = Editor.defaults();
      Object.keys(d).forEach(function (k) { p[k] = d[k]; });
      drawPhotos(); toast('已重設');
    });
    document.getElementById('applyAll').addEventListener('click', function () {
      Editor.copyTone(p, state.photos);
      state.photos.forEach(makeThumb);
      paintThumbs();
      updateMoodLine();
      toast('已把亮度、對比、色溫套用到全部 ' + state.photos.length + ' 張');
    });

    // 拖曳平移裁切框
    var stage = document.getElementById('stage');
    var last = null;
    stage.addEventListener('pointerdown', function (e) {
      last = { x: e.clientX, y: e.clientY }; stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!last) return;
      Editor.pan(p, -(e.clientX - last.x), -(e.clientY - last.y), stage.clientWidth);
      last = { x: e.clientX, y: e.clientY };
      redraw();
    });
    ['pointerup', 'pointercancel'].forEach(function (t) { stage.addEventListener(t, function () { last = null; }); });
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      p.zoom = Math.max(1, Math.min(3, p.zoom * (e.deltaY < 0 ? 1.04 : 1 / 1.04)));
      var z = document.getElementById('sl-zoom'); z.value = p.zoom;
      document.getElementById('o-zoom').textContent = fmt('zoom', p.zoom);
      redraw();
    }, { passive: false });
    stage.tabIndex = 0;
    stage.setAttribute('aria-label', '裁切預覽，可用方向鍵移動位置');
    stage.addEventListener('keydown', function (e) {
      var m = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[e.key];
      if (!m) return;
      e.preventDefault(); Editor.pan(p, m[0], m[1], stage.clientWidth); redraw();
    });
  }

  function move(p, dir) {
    var i = state.photos.indexOf(p), j = i + dir;
    if (j < 0 || j >= state.photos.length) return;
    state.photos.splice(i, 1); state.photos.splice(j, 0, p);
    drawPhotos();
  }

  var PIN_KEY = 'liuge.pinned.v1';
  var HINT_KEY = 'liuge.draghint.v2';   // v2：提示改成點選互換，關過舊提示的人也再看一次
  var LANG_KEY = 'liuge.music.lang';

  // ===== 第 5 步：釘選與順序（pinList、ensureOrder、syncPhotoOrder） =====
  function pinList() {
    try {
      var o = JSON.parse(localStorage.getItem(PIN_KEY) || 'null');
      if (!o || o.v !== 1 || o.src !== archSource() || !Array.isArray(o.pins)) return [];
      return o.pins.filter(function (k) { return typeof k === 'number'; }).slice(0, 3);
    } catch (e) { return []; }
  }
  function pinSave(pins) {
    try { localStorage.setItem(PIN_KEY, JSON.stringify({ v: 1, src: archSource(), pins: pins.slice(0, 3), updatedAt: new Date().toISOString() })); } catch (e) {}
  }
  function keptOldKs() {
    var removed = archRemoved();
    return existingItems().map(function (it) { return it.k; }).filter(function (k) { return removed.indexOf(k) < 0; });
  }
  function photoIds() { return state.photos.map(function (p) { return p.id; }); }
  function ensureOrder() {
    state.order = window.Step5.syncOrder(state.order, photoIds(), keptOldKs(), pinList());
    return state.order;
  }
  function syncPhotoOrder() {
    var ids = ensureOrder().filter(function (it) { return it.t === 'n'; }).map(function (it) { return it.id; });
    var map = {};
    state.photos.forEach(function (p) { map[p.id] = p; });
    var next = ids.map(function (id) { return map[id]; }).filter(Boolean);
    state.photos.forEach(function (p) { if (ids.indexOf(p.id) < 0) next.push(p); });
    state.photos = next;
  }
  // ===== 第 5 步：配樂語言偏好 =====
  function musicLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      if (v === 'zh' || v === 'en' || v === 'all') return v;
    } catch (e) {}
    return state.music.lang || 'all';
  }
  function setMusicLang(v) {
    state.music.lang = v;
    try { localStorage.setItem(LANG_KEY, v); } catch (e) {}
    state.music.recs = null;
  }
  // ===== 第 5 步：九宮格預覽外框與操作提示（#dragHint） =====
  var HINT_TEXT = '點一張照片，再點另一格就能互換；電腦也可以按住拖曳';
  var HINT_PICK = '再點另一格就會互換（點同一格取消）';
  function setHint(text) {
    var sp = document.querySelector('#dragHint span');
    if (sp) { sp.textContent = text; return true; }
    return false;
  }
  function hintHidden() {
    try { return localStorage.getItem(HINT_KEY) === '1'; } catch (e) { return false; }
  }

  function gridPreviewShell() {
    var hasOld = state.shot && state.shot.grid && state.shot.grid.posts;
    var note = hasOld ? '上半部是你的主頁截圖，下面的格子可以互換位置。既有貼文裁自偵測到的 ' + state.shot.grid.posts + ' 篇。' : '沒有截圖時用示範版頭，下面的色塊代表既有貼文。';
    var n = state.photos.length;
    var hint = hintHidden() ? '' :
      '<div class="drag-hint" id="dragHint" aria-live="polite"><span>' + HINT_TEXT + '</span><button type="button" id="dragHintX" aria-label="關閉提示">' + I.close + '</button></div>';
    return '<span class="section-label">整個主頁</span>' +
      '<h2 class="h2">排在主頁上的樣子</h2>' +
      '<p class="small mt-8">' + note + '新照片與舊貼文都可以換到任何一格。主頁縮圖以 4:5 直式呈現。</p>' +
      hint +
      '<div class="phone-frame" id="phoneFrame"><div class="ig-head" id="igHead"></div><div class="pgrid" id="pgrid"></div><div class="ig-nav" id="igNav" hidden></div></div>' +
      '<div class="auto-note" id="autoNote" aria-live="polite" hidden></div>' +
      '<p class="layout-score" id="layoutScore" aria-live="polite" hidden></p>' +
      '<div class="gp-legend"><span><i></i>新照片</span><span><i class="o"></i>既有貼文 · 可拿掉、可釘選</span></div>' +
      '<div id="igTodo" class="ig-todo"></div>' +
      '<div id="archBox" class="archbox"></div>' +
      '<div id="musicBox" class="musicbox"></div>' +
      '<div class="dl">' +
        '<button class="btn btn-block" type="button" id="dlZip"' + (n ? '' : ' disabled') + '>打包成 zip 下載（' + n + ' 張）</button>' +
        '<p class="small mt-8">zip 裡只有新照片，依它們之間的相對順序命名 01.jpg、02.jpg…（1080×1350 JPEG）。舊貼文不會放進去。檔名「' + Editor.zipName() + '」。</p>' +
        '<button class="btn btn-ghost btn-block mt-16" type="button" id="dlAll"' + (n ? '' : ' disabled') + '>逐張下載</button>' +
        '<p class="small mt-8">同樣只下載新照片，順序與 zip 相同。</p>' +
      '</div>';
  }

  // ===== 第 5 步：仿 IG 主頁版頭 =====
  function headerHTML() {
    var ch = state.chrome;
    if (ch && ch.url) {
      return { head: '<img class="ig-shot" alt="主頁上半部" src="' + ch.url + '">', nav: ch.nav ? '<img alt="" src="' + ch.nav + '">' : '', theme: ch.theme || 'light' };
    }
    var name = '你的帳號';
    var demo = !(state.shot && state.shot.grid && state.shot.grid.posts);
    return {
      theme: 'light',
      nav: '',
      head:
        '<div class="ig-fallback' + (demo ? ' is-demo' : '') + '">' +
          '<div class="fb-top"><span class="av" aria-hidden="true"></span><div><b class="fb-name">' + name + '</b><span class="fb-sub">' + (demo ? '示範帳號' : '從截圖讀不到名稱') + '</span></div></div>' +
          '<div class="fb-stats"><span><b>' + (demo ? '12' : '—') + '</b>貼文</span><span><b>' + (demo ? '1280' : '—') + '</b>粉絲</span><span><b>' + (demo ? '320' : '—') + '</b>追蹤中</span></div>' +
          '<p class="fb-bio">' + (demo ? '色塊示範。上傳主頁截圖後，這裡會換成你的版頭。' : '這次沒能切出版頭，先用這個樣子對齊格子。') + '</p>' +
          '<div class="fb-hl" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' +
          '<div class="fb-tabs" aria-hidden="true"><span class="on"></span><span></span><span></span></div>' +
        '</div>'
    };
  }

  // ===== 第 5 步：IG 待辦清單 =====
  function drawIgTodo() {
    var box = document.getElementById('igTodo');
    if (!box) return;
    var lines = window.Step5.tasks(ensureOrder(), pinList(), archRemoved());
    if (!lines.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<span class="section-label">你在 IG 要做的事</span><ol class="todo">' +
      lines.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>';
  }

  function paintChrome() {
    var frame = document.getElementById('phoneFrame');
    var head = document.getElementById('igHead');
    var nav = document.getElementById('igNav');
    if (!frame || !head) return;
    var h = headerHTML();
    frame.setAttribute('data-theme', h.theme || 'light');
    head.innerHTML = h.head;
    if (nav) {
      if (h.nav) { nav.hidden = false; nav.innerHTML = h.nav; }
      else { nav.hidden = true; nav.innerHTML = ''; }
    }
  }

  // ===== 第 5 步：九宮格預覽重畫（只動 #pgrid；opts.keepMusic 時連配樂區也不碰） =====
  function drawGridPreview(opts) {
    var g = document.getElementById('pgrid');
    if (!g) return;
    // 重畫後索引可能變了：選取一律清掉
    state.swapSel = null;
    window.Step5.markSel(g, null);   // #pgrid 本身不會被換掉：清掉 .is-picking 虛線
    setHint(HINT_TEXT);
    paintChrome();
    var order = ensureOrder();
    var pins = pinList();
    var byId = {};
    state.photos.forEach(function (p) { byId[p.id] = p; });
    var byK = {};
    existingItems().forEach(function (it) { byK[it.k] = it; });
    var newOrdinal = {};
    var ni = 0;
    order.forEach(function (it) { if (it.t === 'n') { ni++; newOrdinal[it.id] = ni; } });
    var html = order.map(function (it, i) {
      if (it.t === 'n') {
        var p = byId[it.id];
        if (!p) return '';
        var no = newOrdinal[p.id];
        return '<div class="pc new' + (p.id === state.cur ? ' cur' : '') + '" data-i="' + i + '" data-id="' + p.id + '" tabindex="0" role="button" aria-label="第 ' + no + ' 張新照片，點一下選取後再點另一格互換">' +
          '<canvas data-pid="' + p.id + '" width="216" height="270"></canvas><span class="badge">' + pad2(no) + '</span></div>';
      }
      var old = byK[it.k];
      if (!old) return '';
      var pinned = pins.indexOf(it.k) >= 0;
      var moved = window.Step5.shifted(order, it.k, pins);
      var pinBtn = moved && i < 3 && !pinned
        ? '<button class="pc-pin" type="button" data-pin="' + it.k + '">改成釘選</button>' : '';
      var unpin = pinned ? '<button class="pc-pin" type="button" data-unpin="' + it.k + '">取消釘選</button>' : '';
      return '<div class="pc old' + (pinned ? ' is-pin' : '') + (moved ? ' is-moved' : '') + '" data-i="' + i + '" data-k="' + it.k + '" tabindex="0" role="button" aria-label="原第 ' + (it.k + 1) + ' 格既有貼文，點一下選取後再點另一格互換">' +
        oldThumbHTML(old) +
        (pinned ? '<span class="pc-pinmark" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M8 1.5v7.2M5.2 4.2h5.6M6.4 8.6 8 14.2 9.6 8.6"/></svg></span>' : '') +
        (old.hint && !moved ? '<span class="pc-hint">建議拿掉</span>' : '') +
        (moved ? '<span class="pc-moved">無法重排</span><p class="pc-moved-full">IG 無法重排已發貼文，可改用釘選</p>' : '') +
        pinBtn + unpin +
        '<button class="pc-rm" type="button" data-arch="' + it.k + '" aria-label="暫時拿掉原第 ' + (it.k + 1) + ' 格（不會刪除）"><span>拿掉</span></button></div>';
    }).join('');
    while ((order.length % 3) !== 0) { html += '<div class="pc old none"></div>'; order = order.concat([{ t: 'x' }]); }
    if (!html) html = '<div class="pc old none"></div><div class="pc old none"></div><div class="pc old none"></div>';
    g.innerHTML = html;
    var cap = document.getElementById('movedCaption');
    if (!cap) {
      cap = document.createElement('p');
      cap.id = 'movedCaption';
      cap.className = 'moved-caption';
      g.parentNode.insertBefore(cap, g.nextSibling);
    }
    var anyMoved = !!g.querySelector('.is-moved');
    cap.hidden = !anyMoved;
    cap.textContent = anyMoved ? 'IG 無法重排已發貼文，可改用釘選' : '';
    qsa('[data-arch]', g).forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); archiveOld(Number(b.getAttribute('data-arch'))); });
    });
    qsa('[data-pin]', g).forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); pinOld(Number(b.getAttribute('data-pin'))); });
    });
    qsa('[data-unpin]', g).forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); unpinOld(Number(b.getAttribute('data-unpin'))); });
    });
    var hx = document.getElementById('dragHintX');
    if (hx && !hx._bound) {
      hx._bound = true;
      hx.addEventListener('click', function () {
        try { localStorage.setItem(HINT_KEY, '1'); } catch (e) {}
        var bar = document.getElementById('dragHint'); if (bar) bar.remove();
      });
    }
    drawArchived();
    drawIgTodo();
    paintThumbs();
    if (autoArrange()) { drawGridPreview(opts); refreshStrip(); return; }
    drawAutoNote();
    bindGridDrag(g);
    bindDownloads();
    updateLayoutScore(scoreCompare);
    scoreCompare = false;
    if (!(opts && opts.keepMusic)) renderMusicBox();
  }

  // ===== 第 5 步：版面星數（計分在 js/layout-score.js；顯示在 #layoutScore，只重寫這一小塊） =====
  // 只在放下／互換／復原後帶「比剛剛…」；其他重畫（拿掉、釘選、進頁）只顯示星數，但會更新比較基準。
  var scoreCompare = false;
  function updateLayoutScore(withCompare) {
    var box = document.getElementById('layoutScore');
    if (!box || !window.Step5.showScore) return;
    var src = scoreSources();
    var cells = src.cells, waiting = src.waiting;
    var out = window.Step5.showScore(box, cells, withCompare ? state.layoutScore : null);
    if (!out) return;
    state.layoutScore = out.result;
    // 舊貼文圖片還沒載好：等載好再補算一次（不帶比較）
    if (out.pending) {
      waiting.forEach(function (img) {
        if (!img.complete) img.addEventListener('load', function () { if (img.isConnected) updateLayoutScore(false); }, { once: true });
      });
    }
  }
  // 每格取樣來源（{ canvas }／{ img, url }／{ hex }／null）；waiting＝格子裡的舊貼文 img
  function scoreSources() {
    var byId = {};
    state.photos.forEach(function (p) { byId[p.id] = p; });
    var byK = {};
    existingItems().forEach(function (it) { byK[it.k] = it; });
    var waiting = [];
    var cells = ensureOrder().map(function (it, i) {
      if (it.t === 'n') { var p = byId[it.id]; return p && p._thumb ? { canvas: p._thumb } : null; }
      var old = byK[it.k];
      if (!old) return null;
      if (old.url) {
        var img = qs('#pgrid .pc[data-i="' + i + '"] img');
        if (img) waiting.push(img);
        return img ? { img: img, url: old.url } : null;
      }
      return old.cell && old.cell.bg ? { hex: old.cell.bg } : null;
    });
    return { cells: cells, waiting: waiting };
  }

  // ===== 第 5 步：自動排好推薦版本（挑排列在 js/auto-arrange.js；使用者手動排過就不再覆蓋） =====
  // state.auto：{ key（已排過的照片組合）, before（自動排之前的順序）, manual（手動排過） }
  function autoArrange() {
    var A = state.auto || (state.auto = {});
    if (A.manual || !window.AutoArrange || !window.LayoutScore) return false;
    var order = ensureOrder();
    var key = order.filter(function (it) { return it.t === 'n'; }).map(function (it) { return it.id; }).sort().join(',') + '|' + keptOldKs().join(',');
    if (A.key === key) return false;
    var src = scoreSources();
    var stats = src.cells.map(function (c) { return window.LayoutScore.measure(c); });
    if (src.cells.some(function (c, i) { return c && !stats[i]; })) {
      // 還有圖片沒載好：載好再排
      src.waiting.forEach(function (img) {
        if (!img.complete) img.addEventListener('load', function () {
          if (img.isConnected && autoArrange()) { drawGridPreview({ keepMusic: true }); refreshStrip(); }
        }, { once: true });
      });
      return false;
    }
    var next = window.AutoArrange.best(order, stats);
    A.key = key;
    A.applied = true;
    if (window.AutoArrange.same(next, order)) { A.before = null; return false; }
    A.before = order.slice();
    applyOrder(next);
    return true;
  }
  function drawAutoNote() {
    var A = state.auto || {};
    window.AutoArrange && window.AutoArrange.showNote(document.getElementById('autoNote'),
      !!(A.applied && !A.manual && state.photos.length > 1), !!A.before, function () {
        A.manual = true;
        if (A.before) applyOrder(A.before);
        scoreCompare = true;
        drawGridPreview({ keepMusic: true });
        refreshStrip();
        toast('已改回原本順序');
      });
  }
  function markManual() { state.auto = state.auto || {}; state.auto.manual = true; }

  // ===== 第 5 步：釘選／取消釘選舊貼文 =====
  function pinOld(k) {
    var pins = pinList();
    if (pins.indexOf(k) >= 0) return;
    if (pins.length >= 3) { toast('釘選最多 3 篇'); return; }
    pins.push(k);
    pinSave(pins);
    state.order = window.Step5.syncOrder(state.order, photoIds(), keptOldKs(), pins);
    drawGridPreview();
    toast('已標成釘選。到 IG 把原第 ' + (k + 1) + ' 篇改成置頂。');
  }
  function unpinOld(k) {
    pinSave(pinList().filter(function (x) { return x !== k; }));
    state.order = window.Step5.syncOrder(state.order, photoIds(), keptOldKs(), pinList());
    drawGridPreview();
    toast('已取消釘選');
  }

  // ===== 第 5 步：下載（單張／zip） =====
  function bindDownloads() {
    var dl = document.getElementById('dlAll'), dz = document.getElementById('dlZip');
    if (dl && !dl._bound) {
      dl._bound = true;
      dl.addEventListener('click', function () {
        if (!state.photos.length) return;
        dl.disabled = true;
        var label = dl.textContent;
        Editor.downloadAll(state.photos, function (i, all) { dl.textContent = '正在輸出 ' + i + ' / ' + all + '…'; })
          .then(function (count) { dl.textContent = label; dl.disabled = false; toast('已輸出 ' + count + ' 張 JPEG'); });
      });
    }
    if (dz && !dz._bound) {
      dz._bound = true;
      dz.addEventListener('click', function () {
        if (!state.photos.length) return;
        dz.disabled = true;
        var label = dz.textContent;
        Editor.downloadZip(state.photos, function (i, all) { dz.textContent = '正在打包 ' + i + ' / ' + all + '…'; })
          .then(function (z) { dz.textContent = label; dz.disabled = false; toast('已打包 ' + z.count + ' 張：' + z.name); },
            function () { dz.textContent = label; dz.disabled = false; toast('打包失敗，請改用逐張下載'); });
      });
    }
  }

  // ===== 第 5 步：寫入新順序（釘選只保留仍在最前面連續的；拖曳與互換共用） =====
  function applyOrder(next) {
    var pins = pinList();
    var kept = [];
    var broken = false;
    next.forEach(function (it) {
      if (!broken && it.t === 'o' && pins.indexOf(it.k) >= 0) kept.push(it.k);
      else broken = true;
    });
    pinSave(kept);
    state.order = next;
    syncPhotoOrder();
    state.music.recs = null;
  }

  // ===== 第 5 步：換位置寫入（拖曳放下、鍵盤 ← →） =====
  function commitMove(from, to) {
    markManual();
    applyOrder(window.Step5.arrayMove(ensureOrder(), from, to));
    scoreCompare = true;
    drawGridPreview({ keepMusic: true });   // 跟互換一樣只重畫格子＋星數，不重建配樂區
    refreshStrip();
  }

  // ===== 第 5 步：點選互換接線（邏輯在 js/step5-swap.js；只重畫格子，不重建配樂區） =====
  function swapCtx() {
    return {
      getSel: function () { return state.swapSel; },
      setSel: function (i) { state.swapSel = i; },
      onSelect: function (i) {
        window.Step5.markSel(document.getElementById('pgrid'), i);
        if (!setHint(HINT_PICK)) toast(HINT_PICK);
      },
      onClear: function () {
        window.Step5.markSel(document.getElementById('pgrid'), null);
        setHint(HINT_TEXT);
      },
      swap: swapCells
    };
  }
  function tapCell(i) { return window.Step5.swapTap(i, swapCtx()); }
  function swapCells(a, b) {
    markManual();
    var before = { order: ensureOrder().slice(), pins: pinList() };
    applyOrder(window.Step5.arraySwap(ensureOrder(), a, b));
    scoreCompare = true;
    redrawAfterSwap(a, b);
    toast('已互換第 ' + (Math.min(a, b) + 1) + ' 和第 ' + (Math.max(a, b) + 1) + ' 格', {
      label: '復原',
      fn: function () {
        // 復原＝換回去（連釘選一起還原）
        pinSave(before.pins);
        state.order = before.order;
        syncPhotoOrder();
        state.music.recs = null;
        scoreCompare = true;
        redrawAfterSwap(a, b);
        toast('已換回來');
      }
    });
  }
  function redrawAfterSwap(a, b) {
    drawGridPreview({ keepMusic: true });
    refreshStrip();
    window.Step5.flashSwap(document.getElementById('pgrid'), a, b);
  }
  // 上方縮圖列只換順序與編號（搬動既有節點，保留監聽與畫好的 canvas）
  function refreshStrip() {
    var strip = document.getElementById('strip');
    if (!strip) return;
    var add = document.getElementById('addMore');
    state.photos.forEach(function (p, k) {
      var b = strip.querySelector('.th[data-id="' + p.id + '"]');
      if (!b) return;
      strip.insertBefore(b, add);
      var ord = b.querySelector('.ord'); if (ord) ord.textContent = pad2(k + 1);
      b.setAttribute('aria-label', '編輯第 ' + (k + 1) + ' 張');
    });
    var cur = curPhoto();
    var nm = document.querySelector('.ed-name');
    if (cur && nm) nm.textContent = pad2(state.photos.indexOf(cur) + 1) + ' · ' + cur.name;
  }

  // ===== 第 5 步：九宮格互動綁定（鍵盤、拖曳、短按 onTap；拖曳本體在 js/step5-drag.js） =====
  // 點一下選取、再點另一格互換（主要，手機也穩）；滑鼠按住就拖；觸控長按約 0.35 秒可在同一排內拖。
  // 鍵盤：Enter／Space 走同一套選取互換，Esc 取消選取，← → 仍可移動一格。
  // 編輯中的照片只由上方 .strip 切換，點格子不會切換；「拿掉」只有角落的小按鈕。
  function bindGridDrag(g) {
    qsa('.pc:not(.none)', g).forEach(function (cell) {
      cell.addEventListener('keydown', function (e) {
        if (e.target !== cell) return;   // 格子裡的按鈕自己處理 Enter／Space
        var i = Number(cell.getAttribute('data-i'));
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var r = tapCell(i);
          if (r === 'swap') { var again = qs('#pgrid .pc[data-i="' + i + '"]'); if (again) again.focus(); }
        }
        if (e.key === 'Escape' && state.swapSel != null) { e.preventDefault(); state.swapSel = null; swapCtx().onClear(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          var to = i + (e.key === 'ArrowLeft' ? -1 : 1);
          if (to < 0 || to >= ensureOrder().length) return;
          commitMove(i, to);
          var moved = qs('.pc[data-i="' + to + '"]'); if (moved) moved.focus();
        }
      });
    });
    window.Step5.bindDrag(g, {
      onCommit: commitMove,
      onTap: function (index) { tapCell(index); }
    });
  }

  // ===== 第 5 步：配樂區（#musicBox） =====
  /* ---------- 第 5 步：配這組照片的歌 ---------- */
  function currentMood() {
    return Music.moodOf(state.photos.map(function (p) { return p._thumb; }));
  }
  function updateMoodLine() {
    var el = document.getElementById('moodLine');
    var m = currentMood();
    if (el && m) el.innerHTML = moodHTML(m);
  }
  function moodHTML(m) {
    return '<span class="mood-tag">' + m.label + '</span><span>' + m.sentence + '</span>';
  }


  function renderMusicBox() {
    var box = document.getElementById('musicBox');
    if (!box) return;
    if (Preview) Preview.stop();
    var prefs = Music.load();
    var mood = currentMood();
    var lang = musicLang();
    state.music.lang = lang;
    var langSeg =
      '<div class="seg langseg" role="group" aria-label="配樂語言">' +
        '<button type="button" data-lang="all" aria-pressed="' + (lang === 'all') + '">全部</button>' +
        '<button type="button" data-lang="zh" aria-pressed="' + (lang === 'zh') + '">中文</button>' +
        '<button type="button" data-lang="en" aria-pressed="' + (lang === 'en') + '">英文</button>' +
      '</div>';
    if (!Music.hasPrefs(prefs)) {
      box.innerHTML =
        '<div class="mb-hero">' +
          '<span class="section-label">配樂</span>' +
          '<h2 class="h2 song-h">配一首歌</h2>' +
          '<p class="lead">先在這裡告訴我你喜歡聽什麼。建好之後，推薦、試聽和語言切換都留在這一步，不用再跳頁。</p>' +
          (mood ? '<p class="mood" id="moodLine">' + moodHTML(mood) + '</p>' : '') +
          langSeg +
        '</div>' +
        '<div id="setupHost"></div>';
      bindLangSeg(box);
      renderInlineSetup(document.getElementById('setupHost'));
      return;
    }
    var M = state.music;
    if (!M.recs) M.recs = Music.recommend(prefs, mood, { seed: M.seed, avoid: M.avoid, lang: lang });
    var genreNote = Music.genreConflict(prefs, lang); // 曲風與語言衝突提示（js/music-filter.js）
    box.innerHTML =
      '<div class="mb-hero">' +
        '<span class="section-label">配樂</span>' +
        '<h2 class="h2 song-h">配一首歌</h2>' +
        '<p class="lead">依這組照片的氛圍挑 3 首。試聽是 Apple 的 30 秒聲音，頁面裡沒有影片。</p>' +
        (mood ? '<p class="mood" id="moodLine">' + moodHTML(mood) + '</p>' : '') +
        langSeg +
        (genreNote ? '<p class="mf-hint" id="genreNote" role="note">' + esc(genreNote) + '</p>' : '') +
      '</div>' +
      '<ol class="songs">' + M.recs.map(function (r, k) {
        var liked = prefs.likes.indexOf(r.id) >= 0;
        return '<li class="song" data-id="' + r.id + '">' +
          '<span class="song-no">' + pad2(k + 1) + '</span>' +
          '<div class="song-body">' +
            '<div class="song-top"><div><p class="song-t">' + esc(r.title) + '</p>' +
            '<p class="song-a">' + esc(r.artist) + ' · <span class="song-g" data-genre="' + esc(r.genre) + '">' + esc(r.genre) + '</span>' +
              (r.near ? ' <span class="song-near">相近推薦</span>' : '') + '</p></div></div>' +
            '<div class="pv' + (k === 0 ? ' pv-lg' : '') + '" data-play="' + esc(r.id) + '"></div>' +
            '<p class="song-part"><span class="part">從' + r.part + '開始</span>' + r.partWhy + '</p>' +
            '<p class="song-why">' + r.why + '</p>' +
            '<div class="song-act">' +
              '<button type="button" class="pill" data-like="' + r.id + '" aria-pressed="' + liked + '">' + (liked ? '已喜歡' : '喜歡') + '</button>' +
              '<button type="button" class="pill" data-dislike="' + r.id + '">不喜歡</button>' +
            '</div>' +
          '</div>' +
        '</li>';
      }).join('') + '</ol>' +
      '<div class="mb-foot">' +
        '<button class="link swap" type="button" id="moreSongs">' + I.swap + '換一組</button>' +
        '<button class="link muted" type="button" id="openPrefs">調整我的配樂偏好</button>' +
      '</div>' +
      '<div id="prefHost" hidden></div>' +
      '<p class="small mt-8">' + I.note.replace('<svg', '<svg class="ic-inline"') + '請到 IG App 加音樂時搜尋這首歌。留格不會把歌放進 IG。</p>' +
      '<p class="small mt-8 pv-foot">試聽片段由 Apple Music 提供（約 30 秒）。同時間只播一首，按下播放鍵才會開始。</p>';

    qsa('[data-like]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-like'), p = Music.load() || Music.empty();
        var i = p.likes.indexOf(id);
        if (i >= 0) p.likes.splice(i, 1); else { p.likes.push(id); p.dislikes = p.dislikes.filter(function (x) { return x !== id; }); }
        Music.save(p);
        toast(i >= 0 ? '已取消喜歡' : '記住了：之後多推同曲風的歌');
        // 只更新這顆按鈕，不重畫（正在試聽的歌不會被打斷）
        b.setAttribute('aria-pressed', String(i < 0)); b.textContent = i < 0 ? '已喜歡' : '喜歡';
      });
    });
    qsa('[data-dislike]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-dislike'), p = Music.load() || Music.empty();
        if (p.dislikes.indexOf(id) < 0) p.dislikes.push(id);
        p.likes = p.likes.filter(function (x) { return x !== id; });
        Music.save(p);
        // 只換掉這一首，其他兩首不動
        var keep = M.recs.filter(function (r) { return r.id !== id; });
        var fresh = Music.recommend(p, currentMood(), { seed: M.seed, avoid: M.avoid.concat(M.recs.map(function (r) { return r.id; })), lang: musicLang() })
          .filter(function (r) { return !keep.some(function (k) { return k.id === r.id || k.artist === r.artist; }); });
        var idx = M.recs.map(function (r) { return r.id; }).indexOf(id);
        M.recs = M.recs.slice();
        if (fresh[0]) M.recs.splice(idx, 1, fresh[0]); else M.recs.splice(idx, 1);
        toast('不會再推這首，同一位歌手也會少推');
        renderMusicBox();
      });
    });
    // 試聽：先查好 Apple previewUrl（只查不播），點播放鍵時才能在同一個點擊裡直接播放（iPhone Safari）
    var recSongs = M.recs.map(function (r) { return Music.byId(r.id); }).filter(Boolean);
    if (Preview) {
      Preview.prefetch(recSongs);
      qsa('[data-play]', box).forEach(function (el) { Preview.mount(el, Music.byId(el.getAttribute('data-play'))); });
    }
    document.getElementById('moreSongs').addEventListener('click', function () {
      M.avoid = M.avoid.concat(M.recs.map(function (r) { return r.id; })).slice(-36);
      M.seed++; M.recs = null;
      renderMusicBox();
      var l = qs('.songs', box); if (l) { l.classList.remove('fade-swap'); void l.offsetWidth; l.classList.add('fade-swap'); }
    });
    bindLangSeg(box);
    var open = document.getElementById('openPrefs');
    if (open) open.addEventListener('click', function () {
      var host = document.getElementById('prefHost');
      if (!host) return;
      host.hidden = !host.hidden;
      if (!host.hidden) renderPrefs(host, Music.load() || prefs);
    });
    if (state.music.focus) {
      var host0 = document.getElementById('prefHost');
      if (host0) { host0.hidden = false; renderPrefs(host0, prefs); }
    }
  }

  function bindLangSeg(box) {
    qsa('[data-lang]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        setMusicLang(b.getAttribute('data-lang'));
        state.music.recs = null;
        renderMusicBox();
      });
    });
  }

  function renderInlineSetup(host) {
    if (!host) return;
    var M = state.music;
    if (!M.draft) {
      var p0 = Music.load() || Music.empty();
      M.draft = { genres: p0.genres.slice(), artists: p0.artists.slice(), songs: p0.songs.length ? p0.songs.slice() : [{ t: '', a: '' }, { t: '', a: '' }, { t: '', a: '' }] };
    }
    host.innerHTML =
      '<div class="tabs" role="tablist" aria-label="建立方式">' +
        '<button type="button" role="tab" id="tabGenre" aria-selected="' + (M.tab === 'genre') + '">我知道自己的曲風</button>' +
        '<button type="button" role="tab" id="tabSongs" aria-selected="' + (M.tab === 'songs') + '">說不上來，用歌來猜</button>' +
      '</div><div id="tabBody" class="tab-body"></div>';
    document.getElementById('tabGenre').addEventListener('click', function () { M.tab = 'genre'; renderInlineSetup(host); });
    document.getElementById('tabSongs').addEventListener('click', function () { M.tab = 'songs'; renderInlineSetup(host); });
    if (M.tab === 'genre') renderGenreTab(); else renderSongsTab();
  }

  /* =========================================================
     配樂偏好（#/music）：首次建立／設定頁
     ========================================================= */
  function viewMusic() {
    state.music.focus = true;
    state.music.returnTo = 'photos';
    go('photos');
  }

  function genreChips(selected, name) {
    return '<div class="genres" role="group" aria-label="曲風">' + window.MusicLibrary.GENRES.map(function (g) {
      return '<button type="button" class="gchip" data-g="' + esc(g) + '" data-set="' + name + '" aria-pressed="' + (selected.indexOf(g) >= 0) + '">' + I.check + '<span>' + esc(g) + '</span></button>';
    }).join('') + '</div>';
  }
  function tagInputHTML(list, id) {
    var ph = '輸入歌手名稱，按「加入」';
    return '<div class="tagin" id="' + id + '">' + list.map(function (a, i) {
      return '<span class="tag">' + esc(a) + '<button type="button" data-rm="' + i + '" aria-label="移除 ' + esc(a) + '">' + I.close + '</button></span>';
    }).join('') +
      '<div class="tagin-row"><input type="text" placeholder="' + ph + '" aria-label="' + ph + '" enterkeyhint="done" autocomplete="off">' +
      '<button type="button" class="btn tag-add">加入</button></div>' +
      '<ul class="suggest" hidden></ul><p class="suggest-note" hidden></p></div>';
  }
  function sameArtist(a, b) { return window.Fuzzy && window.Fuzzy.norm(a) === window.Fuzzy.norm(b); }
  function bindTagInput(id, list, onChange) {
    var root = document.getElementById(id);
    if (!root) return;
    var inp = qs('input', root);
    var addBtn = qs('.tag-add', root);
    var ul = qs('.suggest', root);
    var note = qs('.suggest-note', root);
    var composing = false, hi = -1, items = [], timer = 0;
    function dup(v) { return list.some(function (a) { return sameArtist(a, v); }); }
    function addRaw(v) {
      v = String(v || '').trim();
      if (!v) return;
      if (dup(v)) { toast('已經在清單裡了'); return; }
      list.push(v); inp.value = ''; closeSug(); onChange();
    }
    function addPicked(it) {
      var name = it.kind === 'song' ? it.artist : (it.name || it.artist);
      addRaw(name);
    }
    function closeSug() { ul.hidden = true; note.hidden = true; ul.innerHTML = ''; items = []; hi = -1; }
    function paint() {
      if (!items.length && !note.textContent) { ul.hidden = true; return; }
      ul.hidden = !items.length;
      ul.innerHTML = items.map(function (it, i) {
        var label = it.kind === 'song' ? esc(it.title) + ' — ' + esc(it.artist) : esc(it.name);
        var tag = it.source === 'apple' ? 'Apple Music' : '內建';
        return '<li><button type="button" data-i="' + i + '" class="' + (i === hi ? 'on' : '') + '"><span>' + label + '</span><em>' + tag + '</em></button></li>';
      }).join('');
    }
    function searchNow() {
      var q = inp.value.trim();
      if (!q || composing) { closeSug(); return; }
      items = window.Fuzzy ? window.Fuzzy.libraryHits(q, 'artist', 6) : [];
      hi = items.length ? 0 : -1;
      note.hidden = true; note.textContent = '';
      paint();
      if (window.Fuzzy) window.Fuzzy.itunes(q, 'musicArtist').then(function (rows) {
        if (inp.value.trim() !== q || composing) return;
        rows.forEach(function (r) {
          if (items.length >= 6) return;
          if (items.some(function (it) { return sameArtist(it.name, r.name); })) return;
          items.push(r);
        });
        if (!items.length) {
          note.hidden = false;
          note.textContent = '找不到這位歌手，換個寫法試試';
          items = [{ kind: 'raw', name: q, source: 'raw' }];
          ul.innerHTML = '<li><button type="button" data-i="0"><span>直接加入「' + esc(q) + '」</span><em>未比對到</em></button></li>';
          ul.hidden = false; hi = 0;
          return;
        }
        hi = 0; paint();
      });
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(searchNow, 300); }
    inp.addEventListener('compositionstart', function () { composing = true; closeSug(); });
    inp.addEventListener('compositionend', function () { composing = false; schedule(); });
    inp.addEventListener('input', function () { if (!composing) schedule(); });
    function confirmKey() {
      if (composing) return;
      if (hi >= 0 && items[hi]) {
        if (items[hi].kind === 'raw') addRaw(inp.value); else addPicked(items[hi]);
      } else addRaw(inp.value);
    }
    inp.addEventListener('keydown', function (e) {
      if (e.isComposing || composing) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        hi = (hi + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        paint();
      }
      if (e.key === 'Escape') { closeSug(); return; }
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); confirmKey(); }
      if (e.key === 'Backspace' && !inp.value && list.length) { list.pop(); onChange(); }
    });
    addBtn.addEventListener('click', function () { if (!composing) confirmKey(); });
    ul.addEventListener('mousedown', function (e) { e.preventDefault(); });
    ul.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]'); if (!b) return;
      var it = items[Number(b.getAttribute('data-i'))];
      if (!it) return;
      if (it.kind === 'raw') addRaw(inp.value); else addPicked(it);
    });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]');
      if (b) { list.splice(Number(b.getAttribute('data-rm')), 1); onChange(); return; }
    });
    document.addEventListener('pointerdown', function (e) { if (!root.contains(e.target)) closeSug(); });
  }
  function bindGenreChips(root, list, onChange) {
    qsa('.gchip', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var g = b.getAttribute('data-g'), i = list.indexOf(g);
        if (i >= 0) list.splice(i, 1); else list.push(g);
        b.setAttribute('aria-pressed', String(i < 0));
        if (onChange) onChange();
      });
    });
  }

  function musicIntro(title, lead) {
    return '<div class="stg">' +
        '<span class="eyebrow">配樂偏好</span>' +
        '<h1 class="h1">' + title + '</h1>' +
        '<p class="lead">' + lead + '</p>' +
        '<p class="privacy">' + I.device + '偏好只存在這台裝置，不會上傳。</p>' +
      '</div>';
  }

  function viewMusicSetup() {
    var M = state.music;
    if (!M.draft) {
      var p = Music.load() || Music.empty();
      M.draft = { genres: p.genres.slice(), artists: p.artists.slice(), songs: p.songs.length ? p.songs.slice() : [{ t: '', a: '' }, { t: '', a: '' }, { t: '', a: '' }] };
    }
    $main.innerHTML =
      '<div class="wrap screen"><div class="two">' +
        musicIntro('先告訴我，<br>你喜歡聽什麼。', '留格不能把歌放進 IG，但可以依照片的氛圍推薦歌，你再到 IG App 加音樂時搜尋。兩種方式選一種，之後隨時可以改。') +
        '<div class="stg">' +
          '<div class="tabs" role="tablist" aria-label="建立方式">' +
            '<button type="button" role="tab" id="tabGenre" aria-selected="' + (M.tab === 'genre') + '" aria-controls="tabBody">我知道自己的曲風</button>' +
            '<button type="button" role="tab" id="tabSongs" aria-selected="' + (M.tab === 'songs') + '" aria-controls="tabBody">說不上來，用歌來猜</button>' +
          '</div>' +
          '<div id="tabBody" role="tabpanel" class="tab-body"></div>' +
        '</div>' +
      '</div></div>';
    document.getElementById('tabGenre').addEventListener('click', function () { M.tab = 'genre'; viewMusicSetup(); });
    document.getElementById('tabSongs').addEventListener('click', function () { M.tab = 'songs'; viewMusicSetup(); });
    if (M.tab === 'genre') renderGenreTab(); else renderSongsTab();
  }

  function finishSetup(fields, msg) {
    var p = Music.load() || Music.empty();
    Object.keys(fields).forEach(function (k) { p[k] = fields[k]; });
    Music.save(p);
    state.music.draft = null; state.music.taste = null; state.music.recs = null;
    toast(msg || '已儲存配樂偏好');
    if (currentRoute() === 'photos') { renderMusicBox(); return; }
    state.music.focus = true;
    go('photos');
  }

  function renderGenreTab() {
    var d = state.music.draft, body = document.getElementById('tabBody');
    body.innerHTML =
      '<span class="field-label">曲風（可複選）</span>' +
      genreChips(d.genres, 'setup') +
      '<span class="field-label mt-32">喜歡的歌手（可不填）</span>' +
      tagInputHTML(d.artists, 'artistIn') +
      '<p class="small mt-8">例如：陳綺貞、宇多田光、Norah Jones。</p>' +
      '<div class="actions mt-32"><button class="btn" type="button" id="saveGenre">儲存偏好 ' + I.arrow + '</button></div>';
    bindGenreChips(body, d.genres);
    bindTagInput('artistIn', d.artists, renderGenreTab);
    document.getElementById('saveGenre').addEventListener('click', function () {
      var inp = qs('#artistIn input'); if (inp.value.trim()) { d.artists.push(inp.value.trim()); }
      if (!d.genres.length && !d.artists.length) { toast('至少選一種曲風，或填一位歌手'); return; }
      finishSetup({ genres: d.genres.slice(), artists: d.artists.slice() });
    });
  }

  function songRowsHTML(songs) {
    return songs.map(function (s, i) {
      return '<div class="songrow">' +
        '<span class="n">' + pad2(i + 1) + '</span>' +
        '<input type="text" data-i="' + i + '" data-f="t" value="' + esc(s.t) + '" placeholder="歌名" aria-label="第 ' + (i + 1) + ' 首歌名">' +
        '<input type="text" data-i="' + i + '" data-f="a" value="' + esc(s.a) + '" placeholder="歌手" aria-label="第 ' + (i + 1) + ' 首歌手">' +
        (songs.length > 3 ? '<button type="button" class="icon-btn" data-rmrow="' + i + '" aria-label="移除第 ' + (i + 1) + ' 首">' + I.close + '</button>' : '<span></span>') +
      '</div>';
    }).join('');
  }
  function bindSongRows(root, songs, rerender) {
    qsa('.songrow input', root).forEach(function (inp) {
      inp.addEventListener('input', function () { songs[Number(inp.getAttribute('data-i'))][inp.getAttribute('data-f')] = inp.value; });
    });
    qsa('[data-rmrow]', root).forEach(function (b) {
      b.addEventListener('click', function () { songs.splice(Number(b.getAttribute('data-rmrow')), 1); rerender(); });
    });
  }
  // 填過的歌手（(a) 分頁輸入的）保留下來；歌單裡的歌手不重複加入，計分時另外加權
  function mergeArtists(artists, songs) {
    return artists.filter(function (a, i) { return a && artists.indexOf(a) === i; });
  }
  function filledSongs(songs) {
    return songs.map(function (s) { return { t: s.t.trim(), a: s.a.trim() }; }).filter(function (s) { return s.t && s.a; });
  }

  function renderSongsTab() {
    var M = state.music, d = M.draft, body = document.getElementById('tabBody');
    body.innerHTML =
      '<span class="field-label">喜歡的 3–5 首歌</span>' +
      '<div class="songrows">' + songRowsHTML(d.songs) + '</div>' +
      (d.songs.length < 5 ? '<button class="link muted mt-16 addrow" type="button" id="addRow">' + I.plus + '再加一首</button>' : '') +
      '<div class="actions mt-32"><button class="btn" type="button" id="analyzeTaste">幫我分析</button></div>' +
      '<div id="tasteBox"></div>';
    bindSongRows(body, d.songs, renderSongsTab);
    var add = document.getElementById('addRow');
    if (add) add.addEventListener('click', function () { d.songs.push({ t: '', a: '' }); renderSongsTab(); });
    document.getElementById('analyzeTaste').addEventListener('click', function () {
      var list = filledSongs(d.songs);
      if (list.length < 3) { toast('至少填 3 首，歌名和歌手都要'); return; }
      runTaste(list, document.getElementById('tasteBox'), function (t) {
        finishSetup({ genres: t.genres.slice(), songs: list, summary: t.sentence, artists: mergeArtists(d.artists, list) });
      });
    });
    if (M.taste) drawTaste(M.taste, document.getElementById('tasteBox'), function (t) {
      var list2 = filledSongs(d.songs);
      finishSetup({ genres: t.genres.slice(), songs: list2, summary: t.sentence, artists: mergeArtists(d.artists, list2) });
    });
  }

  function runTaste(list, box, onSave) {
    box.innerHTML = '<div class="loading-inline" role="status"><div class="lbar"></div><p class="small">正在聽你的歌…</p></div>';
    AI.analyzeMusicTaste(list).then(function (t) {
      state.music.taste = { sentence: t.sentence, genres: t.genres.slice(), fallback: t.fallback };
      drawTaste(state.music.taste, box, onSave);
    });
  }

  function drawTaste(t, box, onSave) {
    if (!box) return;
    box.innerHTML =
      '<div class="taste fade-swap">' +
        '<div class="title-row"><span class="section-label" style="flex:1;margin:0">分析結果</span><span class="tag-demo">示範內容</span></div>' +
        '<p class="taste-line">' + esc(t.sentence) + '</p>' +
        '<p class="small">' + (t.fallback ? '內建歌單裡比對不到這些歌手，先給你一個常見的起點。' : '依內建歌單比對歌手與歌名推測。') + '說得對嗎？下面的曲風可以直接改。</p>' +
        genreChips(t.genres, 'taste') +
        '<div class="actions mt-24"><button class="btn" type="button" id="saveTaste">對，就這樣 ' + I.arrow + '</button></div>' +
      '</div>';
    bindGenreChips(box, t.genres);
    document.getElementById('saveTaste').addEventListener('click', function () {
      if (!t.genres.length) { toast('至少留一種曲風'); return; }
      onSave(t);
    });
  }

  function renderPrefs(host, prefs) { viewMusicSettings(prefs, host); }
  function viewMusicSettings(prefs, host) {
    var M = state.music;
    if (Preview && !host) Preview.stop();
    var likes = prefs.likes.map(Music.byId).filter(Boolean), dislikes = prefs.dislikes.map(Music.byId).filter(Boolean);
    var root = host || $main;
    root.innerHTML =
      '<div class="settings pref-panel">' +
        '<p class="small">勾曲風、歌手、喜歡的歌、喜歡與不喜歡，都存在這台裝置。</p>' +
        '<div class="actions"><button class="link muted" type="button" id="clearMusic">清除偏好</button></div>' +
        '<section><span class="section-label">曲風</span>' + genreChips(prefs.genres, 'set') + '</section>' +
        '<section><span class="section-label">喜歡的歌手</span>' + tagInputHTML(prefs.artists, 'setArtists') +
          '<p class="small mt-8">輸入時會列出建議。重複的歌手不會再加一次。</p></section>' +
        '<section><span class="section-label">喜歡的歌</span>' +
          (prefs.songs.length ? '<ul class="songlist">' + prefs.songs.map(function (s, i) {
            return '<li class="has-pv"><span><b>' + esc(s.t) + '</b><em>' + esc(s.a) + '</em></span>' +
              '<span class="sl-act">' +
              '<button type="button" class="icon-btn" data-rmsong="' + i + '" aria-label="移除 ' + esc(s.t) + '">' + I.close + '</button></span>' +
              '<div class="pv" data-uplay="' + i + '"></div></li>';
          }).join('') + '</ul>' +
          '<p class="small mt-8">試聽片段由 Apple Music 提供（約 30 秒），只用歌名＋歌手查詢；找不到時可到 YouTube 搜尋（新分頁）。</p>' : '<p class="small">還沒有填歌。</p>') +
          '<div class="addsong"><input type="text" id="newT" placeholder="歌名" aria-label="歌名" enterkeyhint="done" autocomplete="off"><input type="text" id="newA" placeholder="歌手" aria-label="歌手" enterkeyhint="done" autocomplete="off"><button class="btn" type="button" id="addSong">加入</button></div>' +
          '<ul class="suggest" id="songSuggest" hidden></ul><p class="suggest-note" id="songSuggestNote" hidden></p>' +
          '<button class="link muted mt-16" type="button" id="reTaste">用這些歌重新分析</button>' +
          '<div id="tasteBox"></div>' +
        '</section>' +
        '<section><span class="section-label">推薦紀錄</span>' +
          '<p class="small">喜歡的歌會讓同曲風多推一點；不喜歡的歌不會再出現，同一位歌手也會少推。</p>' +
          recList('喜歡', likes, 'like') + recList('不喜歡', dislikes, 'dislike') +
        '</section>' +
      '</div>';

    var p = prefs;
    function again() { viewMusicSettings(p, host || document.getElementById('prefHost') || $main); }
    function persist(msg) { Music.save(p); M.recs = null; toast(msg || '已儲存'); }
    bindGenreChips(qs('.settings', root), p.genres, function () { persist(); });
    bindTagInput('setArtists', p.artists, function () { persist(); again(); });
    bindSongFieldSuggest(root, p, again);
    if (Preview) {
      var uSongs = p.songs.map(function (sg) { return { id: 'user:' + sg.t + '|' + sg.a, t: sg.t, a: sg.a, youtubeId: null }; });
      Preview.prefetch(uSongs);
      qsa('[data-uplay]', root).forEach(function (el) {
        var u = uSongs[Number(el.getAttribute('data-uplay'))];
        if (u) Preview.mount(el, u, { user: true });
      });
    }
    qsa('[data-rmsong]', root).forEach(function (b) {
      b.addEventListener('click', function () { p.songs.splice(Number(b.getAttribute('data-rmsong')), 1); persist('已移除'); again(); });
    });
    document.getElementById('addSong').addEventListener('click', function () {
      var t = document.getElementById('newT').value.trim(), a = document.getElementById('newA').value.trim();
      if (!t || !a) { toast('歌名和歌手都要填'); return; }
      p.songs.push({ t: t, a: a }); persist('已加入'); again();
    });
    document.getElementById('reTaste').addEventListener('click', function () {
      if (p.songs.length < 3) { toast('至少要有 3 首歌才能分析'); return; }
      runTaste(p.songs, document.getElementById('tasteBox'), function (t) {
        p.genres = t.genres.slice(); p.summary = t.sentence; persist('已更新曲風'); state.music.taste = null; again();
      });
    });
    qsa('[data-unrec]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-unrec');
        p.likes = p.likes.filter(function (x) { return x !== id; });
        p.dislikes = p.dislikes.filter(function (x) { return x !== id; });
        persist('已移除這筆紀錄'); again();
      });
    });
    var clr = document.getElementById('clearMusic'), armed = false, t0;
    clr.addEventListener('click', function () {
      if (!armed) {
        armed = true; clr.textContent = '再按一次，確定清除'; clr.classList.add('danger');
        t0 = setTimeout(function () { armed = false; clr.textContent = '清除偏好'; clr.classList.remove('danger'); }, 3000);
        return;
      }
      clearTimeout(t0);
      Music.clear(); M.recs = null; M.draft = null; M.taste = null;
      toast('已清除配樂偏好');
      if (currentRoute() === 'photos') renderMusicBox(); else render();
    });
  }

  function bindSongFieldSuggest(root, prefs, again) {
    var tInp = document.getElementById('newT'), aInp = document.getElementById('newA');
    var ul = document.getElementById('songSuggest'), note = document.getElementById('songSuggestNote');
    if (!tInp || !ul || !window.Fuzzy) return;
    var composing = false, items = [], hi = -1, timer = 0;
    function close() { ul.hidden = true; if (note) note.hidden = true; items = []; hi = -1; }
    function paint() {
      ul.hidden = !items.length;
      ul.innerHTML = items.map(function (it, i) {
        var label = it.kind === 'song' ? esc(it.title) + ' — ' + esc(it.artist) : esc(it.name);
        return '<li><button type="button" data-i="' + i + '" class="' + (i === hi ? 'on' : '') + '"><span>' + label + '</span><em>' + (it.source === 'apple' ? 'Apple Music' : it.source === 'raw' ? '未比對到' : '內建') + '</em></button></li>';
      }).join('');
    }
    function fill(it) {
      if (it.kind === 'raw') return;
      if (it.title) tInp.value = it.title;
      if (it.artist && aInp) aInp.value = it.artist;
      close();
    }
    function searchNow() {
      var q = (tInp.value || aInp.value || '').trim();
      if (!q || composing) { close(); return; }
      items = window.Fuzzy.libraryHits(q, 'song', 6);
      hi = items.length ? 0 : -1;
      paint();
      window.Fuzzy.itunes(q, 'song').then(function (rows) {
        if (composing) return;
        rows.forEach(function (r) {
          if (items.length >= 6) return;
          if (items.some(function (it) { return window.Fuzzy.norm(it.title) === window.Fuzzy.norm(r.title) && window.Fuzzy.norm(it.artist) === window.Fuzzy.norm(r.artist); })) return;
          items.push(r);
        });
        if (!items.length) {
          if (note) { note.hidden = false; note.textContent = '找不到這首歌，換個寫法試試'; }
          items = [{ kind: 'raw', name: q, title: tInp.value.trim(), artist: aInp ? aInp.value.trim() : '', source: 'raw' }];
          hi = 0; paint();
          return;
        }
        if (note) note.hidden = true;
        hi = 0; paint();
      });
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(searchNow, 300); }
    [tInp, aInp].forEach(function (inp) {
      if (!inp) return;
      inp.addEventListener('compositionstart', function () { composing = true; close(); });
      inp.addEventListener('compositionend', function () { composing = false; schedule(); });
      inp.addEventListener('input', function () { if (!composing) schedule(); });
      inp.addEventListener('keydown', function (e) {
        if (e.isComposing || composing) return;
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) {
          e.preventDefault();
          hi = (hi + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
          paint();
        }
        if (e.key === 'Escape') close();
        if (e.key === 'Enter' && items[hi] && items[hi].kind !== 'raw') { e.preventDefault(); fill(items[hi]); }
      });
    });
    ul.addEventListener('mousedown', function (e) { e.preventDefault(); });
    ul.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]'); if (!b) return;
      var it = items[Number(b.getAttribute('data-i'))];
      if (it) fill(it);
    });
  }
  function recList(title, list, kind) {
    if (!list.length) return '<p class="rec-empty small">' + title + '：還沒有紀錄</p>';
    return '<p class="rec-h">' + title + '（' + list.length + '）</p><ul class="songlist">' + list.map(function (s) {
      return '<li><span><b>' + esc(s.t) + '</b><em>' + esc(s.a) + '</em></span><button type="button" class="icon-btn" data-unrec="' + s.id + '" aria-label="移除這筆' + title + '紀錄">' + I.close + '</button></li>';
    }).join('') + '</ul>';
  }

  var VIEWS = { '': viewHome, upload: viewUpload, style: viewStyle, analysis: viewAnalysis, next: viewNext, photos: viewPhotos, music: viewMusic };

  // 給截圖／測試腳本與之後的除錯用
  window.__app = {
    state: state, go: go, render: render, toast: toast,
    orderKeys: function () {
      return ensureOrder().map(function (it) { return it.t === 'n' ? 'n:' + it.id : 'o:' + it.k; });
    },
    pinList: pinList
  };

  restoreShot(); // 重新整理後：從 sessionStorage 還原縮小的截圖（有的話）
  render();
})();
