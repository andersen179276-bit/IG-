/*
 * preview.js — 配樂試聽（第 5 步推薦歌、設定頁「喜歡的歌」）— 第四輪：只播聲音
 * ------------------------------------------------------------
 * 來源：Apple／iTunes Search API 的 30 秒試聽（previewUrl），用一個共用的 <audio>（preload="none"、playsinline）播放。
 *   - 不嵌入任何影片、不用 YouTube 播放器。
 *   - 查詢：https://itunes.apple.com/search?term=<歌手 歌名>&entity=song&country=tw&limit=10
 *     （回應帶 access-control-allow-origin: *，直接 fetch），以歌名＋歌手正規化比對；結果存在記憶體快取。
 *   - 從 0 開始播整段（約 30 秒），到結尾自動停止並重置。
 * 沒有 Apple 試聽：
 *   - music-library.js 標 itunesPreview=false 的歌（依 tools/music-lookup/verified.json）→ 一開始就顯示「到 YouTube 聽 ↗」外部連結。
 *   - 執行期查不到／比對不到／音檔載入錯誤 → 有已驗證 youtubeId：「到 YouTube 聽 ↗」；youtubeId 為 null：「到 YouTube 搜尋 ↗」。
 *     絕不編造 youtubeId。
 *   - 使用者自己加的歌（設定頁）：只查 Apple，沒有就顯示「沒有找到試聽」＋「到 YouTube 搜尋 ↗」。
 * iPhone Safari：
 *   - 絕不自動播放；audio.play() 只在使用者點擊播放鍵的事件處理中呼叫。
 *   - 推薦區出現時先 prefetch（只查 previewUrl、不播），點擊時就能同步 play()。
 *   - 若點擊時還沒查好：當下先 load() 共用的 <audio> 解鎖，查到後再 play()；被拒（NotAllowedError）就顯示「再按一次播放」，第二次點擊直接播。
 * 規則：同時間只播一首；按另一首、換一組、換頁、推薦區被移除、頁面隱藏（visibilitychange）、pagehide 時立刻 pause() 並重置。
 *
 * 公開介面（window.Preview）：
 *   Preview.mount(el, song, opts)   在 el 裡放播放鍵＋細進度線＋剩餘秒數（或外部連結）
 *       song = { id, t, a, youtubeId, startSec, ytNote, itunesPreview }；opts = { user: true } 表示使用者自己加的歌
 *   Preview.prefetch(list)          list = [{ t, a }]，只查不播
 *   Preview.stop()
 *   Preview.current()               正在播（或載入中）的 song id 或 null
 *   Preview.itunesLookup(title, artist) → Promise<{ previewUrl, trackName, artistName } | null>
 */
(function () {
  'use strict';

  var CLIP = 30;               // Apple 試聽片段長度（實際以 audio.duration 為準）
  var LOOKUP_TIMEOUT = 8000;
  var cur = null;              // { song, el, opts, url, state:'loading'|'playing'|'paused'|'retry' }
  var audio = null;            // 共用的 <audio>
  var itCache = {};            // iTunes 查詢快取：key → hit | null
  var itPending = {};          // 查詢中的 Promise
  var watch = 0;               // 播放／載入期間檢查推薦區是否還在畫面上

  var ICON = {
    play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5v9l7-4.5z"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5v9M10.5 3.5v9"/></svg>',
    spin: '<svg class="pv-spin" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5"/></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  /* ---------- iTunes Search API ---------- */
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[（(\[【].*?[）)\]】]/g, '')
      .replace(/[\s　·・.,'’"&\-–—!?！？〜~]/g, '');
  }
  function keyOf(title, artist) { return norm(title) + '|' + norm(artist); }
  function cached(title, artist) { return itCache[keyOf(title, artist)]; }

  function itunesLookup(title, artist) {
    var key = keyOf(title, artist);
    if (itCache[key] !== undefined) return Promise.resolve(itCache[key]);
    if (itPending[key]) return itPending[key];
    var url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(artist + ' ' + title) + '&entity=song&country=tw&limit=10';
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, LOOKUP_TIMEOUT);
    var p = fetch(url, ctl ? { signal: ctl.signal } : undefined).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var nt = norm(title), na = norm(artist), hit = null;
      (j.results || []).some(function (x) {
        if (!x.previewUrl) return false;
        var t = norm(x.trackName), a = norm(x.artistName);
        var tOk = t && nt && (t === nt || t.indexOf(nt) === 0 || nt.indexOf(t) === 0);
        var aOk = a && na && (a.indexOf(na) >= 0 || na.indexOf(a) >= 0);
        if (tOk && aOk) { hit = { previewUrl: x.previewUrl, trackName: x.trackName, artistName: x.artistName }; return true; }
        return false;
      });
      itCache[key] = hit;
      return hit;
    }, function () { return null; }) // 網路錯誤／逾時不快取，下次再試
      .then(function (v) { clearTimeout(to); delete itPending[key]; return v; });
    itPending[key] = p;
    return p;
  }

  function prefetch(list) {
    (list || []).forEach(function (s) { if (s && s.t && s.a && s.itunesPreview !== false) itunesLookup(s.t, s.a); });
  }

  /* ---------- 外部連結（絕不編造 youtubeId） ---------- */
  function ytWatch(song) {
    return 'https://www.youtube.com/watch?v=' + encodeURIComponent(song.youtubeId) + '&t=' + Math.max(0, Math.round(song.startSec || 0)) + 's';
  }
  function ytSearch(song) {
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(song.t + ' ' + song.a);
  }
  // why: 'none' 一開始就知道沒有 Apple 試聽；'fail' 執行期查不到／載入失敗
  function renderLink(el, song, opts, why) {
    var watch = !opts.user && song.youtubeId;
    var href = watch ? ytWatch(song) : ytSearch(song);
    var label = watch ? '到 YouTube 聽 ↗' : '到 YouTube 搜尋 ↗';
    var note;
    if (opts.user) note = '會在新分頁開 YouTube 搜尋結果。';
    else if (why === 'none') note = '這首沒有 Apple 試聽，會在新分頁開 YouTube。';
    else note = '沒有找到 Apple 試聽，會在新分頁開 YouTube' + (watch ? '。' : ' 搜尋結果。');
    if (watch) note += '從建議段落開始（人工估計）' + (song.ytNote ? '，' + song.ytNote : '') + '。';
    el.innerHTML =
      '<div class="pv-ext">' +
        (opts.user ? '<span class="pv-none">沒有找到試聽</span>' : '') +
        '<a class="pv-link" href="' + esc(href) + '" target="_blank" rel="noopener" aria-label="' + esc(label.replace(' ↗', '') + '：' + song.t + '（另開新分頁）') + '">' + esc(label) + '</a>' +
      '</div>' +
      '<p class="pv-meta"><span class="pv-msg">' + esc(note) + '</span></p>';
    el.classList.add('is-ext');
  }

  /* ---------- 播放器畫面 ---------- */
  function renderPlayer(el, song) {
    el.classList.remove('is-ext');
    el.innerHTML =
      '<div class="pv-ctl">' +
        '<button type="button" class="pv-btn" aria-pressed="false" aria-label="播放試聽：' + esc(song.t) + '">' + ICON.play + '</button>' +
        '<div class="pv-track" aria-hidden="true"><span class="pv-bar"></span></div>' +
        '<span class="pv-left">' + CLIP + ' 秒</span>' +
      '</div>' +
      '<p class="pv-meta"><span class="pv-src">Apple Music 試聽</span><span class="pv-msg" aria-live="polite"></span></p>';
  }

  function ui(c) {
    return { btn: c.el.querySelector('.pv-btn'), bar: c.el.querySelector('.pv-bar'), left: c.el.querySelector('.pv-left'), msg: c.el.querySelector('.pv-msg') };
  }
  function setState(c, st, msg) {
    c.state = st;
    var u = ui(c);
    if (!u.btn) return;
    var t = c.song.t;
    if (st === 'loading') { u.btn.innerHTML = ICON.spin; u.btn.setAttribute('aria-label', '載入中，按一下取消：' + t); u.btn.setAttribute('aria-pressed', 'true'); }
    else if (st === 'playing') { u.btn.innerHTML = ICON.pause; u.btn.setAttribute('aria-label', '暫停試聽：' + t); u.btn.setAttribute('aria-pressed', 'true'); }
    else { u.btn.innerHTML = ICON.play; u.btn.setAttribute('aria-label', (st === 'paused' ? '繼續播放：' : '播放試聽：') + t); u.btn.setAttribute('aria-pressed', 'false'); }
    u.btn.classList.toggle('on', st !== 'idle');
    c.el.classList.toggle('is-on', st !== 'idle');
    if (u.msg) u.msg.textContent = msg || (st === 'loading' ? '讀取中…' : st === 'paused' ? '已暫停' : '');
  }
  function progress(c) {
    var u = ui(c);
    var d = audio && isFinite(audio.duration) && audio.duration > 0 ? Math.min(audio.duration, CLIP) : CLIP;
    var t = audio ? Math.min(audio.currentTime || 0, d) : 0;
    if (u.bar) u.bar.style.width = (t / d * 100) + '%';
    if (u.left) u.left.textContent = Math.max(0, Math.ceil(d - t)) + ' 秒';
  }
  function resetUI(c) {
    setState(c, 'idle');
    var u = ui(c);
    if (u.bar) u.bar.style.width = '0%';
    if (u.left) u.left.textContent = CLIP + ' 秒';
  }

  /* ---------- 共用 <audio> ---------- */
  function getAudio() {
    if (audio) return audio;
    audio = document.createElement('audio');
    audio.preload = 'none';
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.addEventListener('playing', function () { if (cur && cur.url) setState(cur, 'playing'); });
    audio.addEventListener('waiting', function () { if (cur && cur.state === 'playing') setState(cur, 'loading'); });
    audio.addEventListener('timeupdate', function () {
      if (!cur || !cur.url) return;
      if (!cur.el.isConnected) { stop(); return; }  // 推薦區被重畫或移除
      progress(cur);
      if (audio.currentTime >= CLIP) stop();
    });
    audio.addEventListener('ended', function () { if (cur) stop(); });
    audio.addEventListener('error', function () {
      if (!cur || !cur.url || !audio.getAttribute('src')) return;
      fail(cur);
    });
    return audio;
  }

  function release() {
    if (!audio) return;
    try { audio.pause(); } catch (e) {}
    if (audio.getAttribute('src')) { audio.removeAttribute('src'); try { audio.load(); } catch (e) {} }
  }

  function stop() {
    var c = cur;
    if (!c) return;
    cur = null;
    clearInterval(watch);
    release();
    resetUI(c);
  }

  // 執行期失敗：改成外部連結
  function fail(c) {
    if (cur === c) { cur = null; clearInterval(watch); release(); }
    renderLink(c.el, c.song, c.opts, 'fail');
  }

  // 在使用者點擊（或第二次點擊）的處理中呼叫
  function startWith(c, url) {
    var a = getAudio();
    c.url = url;
    a.src = url;
    try { a.currentTime = 0; } catch (e) {}
    setState(c, 'loading');
    var p;
    try { p = a.play(); } catch (e) { p = Promise.reject(e); }
    if (p && p.catch) p.catch(function (err) {
      if (cur !== c) return;
      if (err && err.name === 'NotAllowedError') setState(c, 'retry', '再按一次播放');
      else if (err && err.name === 'AbortError') { /* 被下一個動作中斷，忽略 */ }
      else fail(c);
    });
  }

  function onClick(c) {
    // 同一首：播放中 → 暫停；暫停／再按一次 → 播；載入中 → 取消
    if (cur && cur.el === c.el) {
      var a = getAudio();
      if (cur.state === 'playing') { a.pause(); setState(cur, 'paused'); return; }
      if (cur.state === 'paused' || cur.state === 'retry') {
        var cc = cur;
        setState(cc, 'loading');
        var p = a.play();
        if (p && p.catch) p.catch(function (err) { if (cur === cc) setState(cc, err && err.name === 'NotAllowedError' ? 'retry' : 'paused', err && err.name === 'NotAllowedError' ? '再按一次播放' : ''); });
        return;
      }
      stop(); return;
    }
    stop();
    cur = c;
    // 推薦區被重畫、關閉或整個移除（元素離開畫面）→ 立刻停，載入中也一樣
    watch = setInterval(function () { if (cur && !cur.el.isConnected) stop(); }, 400);
    var s = c.song, a2 = getAudio();
    var hit = cached(s.t, s.a);
    if (hit) { startWith(c, hit.previewUrl); return; }   // 已預先查好：同步 play()
    if (hit === null) { fail(c); return; }              // 已確定查不到
    // 還沒查好：在點擊當下先解鎖 <audio>，查到後再播
    setState(c, 'loading', '查詢 Apple 試聽…');
    try { a2.removeAttribute('src'); a2.load(); } catch (e) {}
    itunesLookup(s.t, s.a).then(function (h) {
      if (cur !== c) return;
      if (!h) { fail(c); return; }
      startWith(c, h.previewUrl);
    });
  }

  function mount(el, song, opts) {
    if (!el || !song) return;
    opts = opts || {};
    if (cur && cur.el === el) stop();
    if (!opts.user && song.itunesPreview === false) { renderLink(el, song, opts, 'none'); return; }
    var hit = cached(song.t, song.a);
    if (hit === null) { renderLink(el, song, opts, 'fail'); return; }
    renderPlayer(el, song);
    var c = { song: song, el: el, opts: opts, url: null, state: 'idle' };
    el.querySelector('.pv-btn').addEventListener('click', function () { onClick(c); });
  }

  // 頁面被切到背景或離開：立刻停
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);

  window.Preview = {
    CLIP: CLIP, mount: mount, prefetch: prefetch, stop: stop, itunesLookup: itunesLookup,
    current: function () { return cur ? cur.song.id : null; },
    // 給截圖／測試腳本：讀目前狀態
    _debugState: function () {
      return cur && { id: cur.song.id, state: cur.state, url: cur.url ? cur.url.slice(0, 60) + '…' : null,
        currentTime: audio ? Math.round(audio.currentTime * 10) / 10 : 0, paused: audio ? audio.paused : true };
    },
    // 給測試腳本：跳到第 t 秒（驗證播到結尾會自動停止）
    _debugSeek: function (t) { if (cur && audio) audio.currentTime = t; }
  };
})();
