/*
 * preview.js — 配樂試聽（第 5 步推薦歌、設定頁「喜歡的歌」）
 * ------------------------------------------------------------
 * 來源順序：
 *   1. YouTube IFrame Player（只用 js/music-library.js 裡、由 verified.json 寫入的 youtubeId）
 *      第一次按播放才動態載入 https://www.youtube.com/iframe_api；從 startSec 開始播 15 秒後自動停止。
 *   2. 備援：iTunes Search API（country=tw）找 previewUrl，用 <audio> 從 0 播 15 秒（Apple Music 30 秒試聽片段）。
 *      觸發條件：youtubeId 為 null、iframe_api 載入失敗或 8 秒逾時、YouTube onError（2／5／100／101／150）。
 *   3. 都沒有 → 只顯示「請到 IG 搜尋這首歌」。
 * 規則：同時間只播一首；換歌、換頁、換一組、頁面隱藏時立即停止。查詢結果存在記憶體快取。
 * 使用者自己加的歌（設定頁）只走 iTunes，不做 YouTube 自動搜尋、不用 AI。
 *
 * 公開介面（window.Preview）：
 *   Preview.toggle(song, slotEl, btnEl, { itunesOnly })   song = { id, t, a, youtubeId, startSec, ytNote }
 *   Preview.stop()
 *   Preview.current()  → 正在播的 song id 或 null
 *   Preview.itunesLookup(title, artist) → Promise<{ previewUrl, trackName, artistName } | null>
 */
(function () {
  'use strict';

  var CLIP = 15;               // 試聽秒數
  var YT_TIMEOUT = 8000;       // iframe_api 載入逾時
  var cur = null;              // { id, song, slot, btn, kind:'yt'|'audio', player, audio, elapsed, t0, paused, timer, done }
  var ytP = null;              // iframe_api 載入中的 Promise
  var itCache = {};            // iTunes 查詢快取
  var seq = 0;

  var ICON = {
    play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5v9l7-4.5z"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5v9M10.5 3.5v9"/></svg>',
    stop: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8"/></svg>'
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  /* ---------- YouTube IFrame API：第一次用到才載入 ---------- */
  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytP) return ytP;
    ytP = new Promise(function (resolve, reject) {
      var done = false;
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prev === 'function') try { prev(); } catch (e) {}
        if (!done) { done = true; resolve(window.YT); }
      };
      var s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.onerror = function () { if (!done) { done = true; reject(new Error('iframe_api 載入失敗')); } };
      document.head.appendChild(s);
      setTimeout(function () { if (!done) { done = true; reject(new Error('iframe_api 逾時')); } }, YT_TIMEOUT);
    });
    ytP.catch(function () { ytP = null; }); // 下次再試
    return ytP;
  }

  /* ---------- iTunes Search API（回應有 CORS 標頭，可直接 fetch） ---------- */
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[（(\[【].*?[）)\]】]/g, '')
      .replace(/[\s　·・.,'’"&\-–—!?！？〜~]/g, '');
  }
  function itunesLookup(title, artist) {
    var key = norm(title) + '|' + norm(artist);
    if (itCache[key] !== undefined) return Promise.resolve(itCache[key]);
    var url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(artist + ' ' + title) + '&entity=song&country=tw&limit=5';
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
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
    }, function () { return null; }); // 網路錯誤不快取，下次再試
  }

  /* ---------- 畫面 ---------- */
  function setBtn(btn, playing) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(!!playing));
    btn.setAttribute('aria-label', (playing ? '停止試聽：' : '試聽 15 秒：') + (btn.getAttribute('data-title') || ''));
    btn.innerHTML = playing ? ICON.stop : ICON.play;
    btn.classList.toggle('on', !!playing);
  }
  function shell(c, msg) {
    c.slot.innerHTML =
      '<div class="pv-box" role="group" aria-label="試聽">' +
        '<div class="pv-media" id="pvMedia' + c.n + '"></div>' +
        '<div class="pv-ctrl">' +
          '<button type="button" class="pv-pp" aria-label="暫停">' + ICON.pause + '</button>' +
          '<div class="pv-track"><span class="pv-bar"></span></div>' +
          '<span class="pv-left" aria-live="off">' + CLIP + ' 秒</span>' +
          '<button type="button" class="pv-stop" aria-label="停止">' + ICON.stop + '</button>' +
        '</div>' +
        '<p class="pv-meta"><span class="pv-src">' + esc(msg || '讀取中…') + '</span><span class="pv-clip">試聽 15 秒</span></p>' +
        '<p class="pv-note small"></p>' +
      '</div>';
    c.slot.hidden = false;
    c.slot.querySelector('.pv-pp').addEventListener('click', function () { togglePause(c); });
    c.slot.querySelector('.pv-stop').addEventListener('click', function () { stop(); });
  }
  function meta(c, src, note) {
    if (cur !== c) return;
    var s = c.slot.querySelector('.pv-src'), n = c.slot.querySelector('.pv-note');
    if (s) s.textContent = src;
    if (n) n.textContent = note || '';
  }
  function tick(c) {
    if (cur !== c) return;
    var el = c.elapsed + (c.paused || !c.t0 ? 0 : (performance.now() - c.t0) / 1000);
    var bar = c.slot.querySelector('.pv-bar'), left = c.slot.querySelector('.pv-left');
    if (bar) bar.style.width = Math.min(100, el / CLIP * 100) + '%';
    if (left) left.textContent = Math.max(0, Math.ceil(CLIP - el)) + ' 秒';
    if (el >= CLIP) { stop(); return; }
  }
  function started(c) {
    if (cur !== c || c.t0) return;
    c.t0 = performance.now(); c.paused = false;
    c.slot.classList.add('playing');
    c.timer = setInterval(function () { tick(c); }, 200);
  }
  function togglePause(c) {
    if (cur !== c) return;
    var pp = c.slot.querySelector('.pv-pp');
    if (!c.paused) {
      if (c.t0) c.elapsed += (performance.now() - c.t0) / 1000;
      c.t0 = 0; c.paused = true;
      if (c.player && c.player.pauseVideo) c.player.pauseVideo();
      if (c.audio) c.audio.pause();
      pp.innerHTML = ICON.play; pp.setAttribute('aria-label', '繼續播放');
    } else {
      c.paused = false;
      if (c.player && c.player.playVideo) c.player.playVideo();
      if (c.audio) c.audio.play().catch(function () {});
      c.t0 = performance.now();
      pp.innerHTML = ICON.pause; pp.setAttribute('aria-label', '暫停');
    }
    tick(c);
  }

  /* ---------- 播放 ---------- */
  function playYT(c) {
    var s = c.song;
    meta(c, 'YouTube · 讀取中…', '');
    return loadYT().then(function (YT) {
      if (cur !== c) return;
      var host = document.createElement('div');
      c.slot.querySelector('.pv-media').appendChild(host);
      var start = Math.max(0, Math.round(s.startSec || 0));
      var fellBack = false;
      var waitT = setTimeout(function () {
        // 準備好了卻遲遲沒開始播（多半是自動播放被擋）：提示直接點影片
        if (cur === c && !c.t0) meta(c, 'YouTube', '沒有自動開始的話，請直接點一下影片播放。');
      }, 4000);
      c.player = new YT.Player(host, {
        width: 320, height: 180, videoId: s.youtubeId,
        playerVars: { start: start, end: start + CLIP, playsinline: 1, controls: 1, modestbranding: 1, rel: 0, autoplay: 1, fs: 0, iv_load_policy: 3, origin: location.protocol === 'file:' ? undefined : location.origin },
        events: {
          onReady: function (e) { if (cur === c) { try { e.target.playVideo(); } catch (x) {} } },
          onStateChange: function (e) {
            if (cur !== c) return;
            if (e.data === YT.PlayerState.PLAYING) { clearTimeout(waitT); started(c); meta(c, 'YouTube' + (s.ytNote ? '・' + s.ytNote : ''), '從第 ' + start + ' 秒開始。起始秒數為人工判斷，可能不精準。'); }
            if (e.data === YT.PlayerState.ENDED) stop();
          },
          onError: function (e) {
            clearTimeout(waitT);
            if (cur !== c || fellBack) return;
            fellBack = true;
            // 2 參數錯誤、5 HTML5 播放器錯誤、100 影片不存在、101／150 不允許嵌入 → 都改用 Apple 試聽
            try { c.player.destroy(); } catch (x) {}
            c.player = null;
            c.slot.querySelector('.pv-media').innerHTML = '';
            playAudio(c, 'YouTube 無法播放（錯誤 ' + e.data + '），改用 Apple 試聽');
          }
        }
      });
    }, function () {
      if (cur !== c) return;
      playAudio(c, 'YouTube 載入失敗，改用 Apple 試聽');
    });
  }

  function playAudio(c, why) {
    var s = c.song;
    c.kind = 'audio';
    meta(c, 'Apple 試聽 · 查詢中…', why || '');
    return itunesLookup(s.t, s.a).then(function (hit) {
      if (cur !== c) return;
      if (!hit) { none(c); return; }
      var a = new Audio();
      a.preload = 'auto';
      a.src = hit.previewUrl;
      c.audio = a;
      a.addEventListener('playing', function () { started(c); });
      a.addEventListener('ended', function () { if (cur === c) stop(); });
      a.addEventListener('error', function () { if (cur === c) none(c); });
      meta(c, 'Apple 試聽', (why ? why + '。' : '') + 'Apple Music 30 秒試聽片段，從頭播 15 秒。');
      var p = a.play();
      if (p && p.catch) p.catch(function () {
        // 非使用者手勢的播放被擋（iOS）：給一顆按鈕讓使用者點
        if (cur !== c) return;
        var pp = c.slot.querySelector('.pv-pp');
        c.paused = true; pp.innerHTML = ICON.play; pp.setAttribute('aria-label', '播放');
        meta(c, 'Apple 試聽', '按左邊的播放鍵開始。Apple Music 30 秒試聽片段。');
      });
    });
  }

  function none(c) {
    if (cur !== c) return;
    c.slot.innerHTML = '<p class="pv-none small">這首找不到可以試聽的版本。請到 IG 加音樂時搜尋「' + esc(c.song.t) + '」。</p>';
    c.slot.hidden = false;
    setBtn(c.btn, false);
    clearInterval(c.timer);
    c.done = true;
  }

  function stop() {
    var c = cur;
    if (!c) return;
    cur = null;
    clearInterval(c.timer);
    if (c.player) { try { c.player.stopVideo(); } catch (e) {} try { c.player.destroy(); } catch (e) {} }
    if (c.audio) { try { c.audio.pause(); c.audio.removeAttribute('src'); c.audio.load(); } catch (e) {} }
    setBtn(c.btn, false);
    if (c.slot && !c.done) { c.slot.innerHTML = ''; c.slot.hidden = true; c.slot.classList.remove('playing'); }
  }

  function toggle(song, slot, btn, opts) {
    opts = opts || {};
    if (cur && cur.id === song.id && cur.slot === slot) { stop(); return; }
    stop();
    var c = { id: song.id, song: song, slot: slot, btn: btn, elapsed: 0, t0: 0, paused: false, n: ++seq };
    cur = c;
    setBtn(btn, true);
    shell(c);
    if (!opts.itunesOnly && song.youtubeId) { c.kind = 'yt'; playYT(c); }
    else playAudio(c, song.youtubeId === null && !opts.itunesOnly ? '這首沒有可驗證的 YouTube 官方版本' : '');
  }

  // 頁面被切到背景：立刻停
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);

  window.Preview = {
    CLIP: CLIP, toggle: toggle, stop: stop, itunesLookup: itunesLookup,
    current: function () { return cur ? cur.id : null; },
    // 給截圖腳本：在無頭瀏覽器無法真的播放 YouTube 時，把介面設成「播放中」的樣子
    _debugState: function () { return cur && { id: cur.id, kind: cur.kind, elapsed: cur.elapsed, t0: cur.t0, paused: cur.paused, hasAudio: !!cur.audio, hasPlayer: !!cur.player }; },
    _fakePlaying: function (sec) { if (!cur) return; cur.elapsed = sec || 0; started(cur); tick(cur); }
  };
})();
