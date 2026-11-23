/*
 * fuzzy.js — 歌手／歌名模糊比對（第五輪）
 * ------------------------------------------------------------
 * 比對順序：完全相符 > 別名 > 前綴 > 子字串 > 編輯距離。
 * 繁簡：vendor/opencc-t2cn.js（opencc-js，MIT）把字串轉成簡體再比。
 * 編輯距離：正規化後長度 ≤4 容 1、>4 容 2。
 * iTunes 查詢由呼叫端決定要不要打；這裡只負責組 URL 與整理結果，並做記憶體快取。
 */
(function () {
  'use strict';

  var toCN = null;
  function conv() {
    if (toCN) return toCN;
    try {
      if (window.OpenCC && window.OpenCC.Converter) toCN = window.OpenCC.Converter({ from: 'tw', to: 'cn' });
    } catch (e) { toCN = function (s) { return s; }; }
    if (!toCN) toCN = function (s) { return s; };
    return toCN;
  }

  function norm(s) {
    var t = String(s == null ? '' : s).toLowerCase();
    try { t = conv()(t); } catch (e) {}
    t = String(t).toLowerCase().replace(/[\s　·・.,'’"“”&\-–—!?！？〜~()（）\[\]【】「」『』:：/／+]/g, '');
    return t;
  }

  function lev(a, b) {
    if (a === b) return 0;
    var n = a.length, m = b.length;
    if (!n) return m;
    if (!m) return n;
    if (Math.abs(n - m) > 2) return 9;
    var prev = new Array(m + 1), cur = new Array(m + 1), i, j;
    for (j = 0; j <= m; j++) prev[j] = j;
    for (i = 1; i <= n; i++) {
      cur[0] = i;
      var ca = a.charCodeAt(i - 1);
      for (j = 1; j <= m; j++) {
        var cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[m];
  }

  function editOk(a, b) {
    if (!a || !b || a === b) return false;
    var n = Math.max(a.length, b.length);
    var d = lev(a, b);
    return n <= 4 ? d === 1 : d > 0 && d <= 2;
  }

  function aliasesOf(artist) {
    var map = window.ArtistAliases || {};
    return map[artist] || [];
  }

  /* 回傳 { tier, dist }。tier 越小越好：0 完全、1 別名、2 前綴、3 子字串、4 編輯、9 無 */
  function matchOne(query, text, asAlias) {
    var q = norm(query), t = norm(text);
    if (!q || !t) return null;
    if (q === t) return { tier: asAlias ? 1 : 0, dist: 0 };
    if (t.indexOf(q) === 0 || q.indexOf(t) === 0) return { tier: asAlias ? 1 : 2, dist: Math.abs(t.length - q.length) };
    if (t.indexOf(q) >= 0 || (q.length >= 2 && q.indexOf(t) >= 0 && t.length >= 2)) return { tier: 3, dist: Math.abs(t.length - q.length) };
    if (editOk(q, t)) return { tier: 4, dist: lev(q, t) };
    return null;
  }

  function better(a, b) {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.dist !== b.dist) return a.dist - b.dist;
    return 0;
  }

  /**
   * 內建歌單建議。mode: 'artist' 只出歌手；'song' 出歌（含歌手）。
   * 回傳最多 limit 筆：{ kind:'artist'|'song', name, artist, title, id, tier, source:'lib' }
   */
  function libraryHits(query, mode, limit) {
    var LIB = window.MusicLibrary;
    if (!LIB || !query || !String(query).trim()) return [];
    var songs = LIB.SONGS || [];
    var bestArtist = {};
    var songsHit = [];
    songs.forEach(function (s) {
      var m = matchOne(query, s.a, false);
      aliasesOf(s.a).forEach(function (al) {
        var am = matchOne(query, al, true);
        if (am && (!m || better(am, m) < 0)) m = am;
      });
      if (m) {
        var prev = bestArtist[s.a];
        if (!prev || better(m, prev) < 0) bestArtist[s.a] = { kind: 'artist', name: s.a, artist: s.a, title: '', id: '', tier: m.tier, dist: m.dist, source: 'lib' };
      }
      if (mode !== 'artist') {
        var tm = matchOne(query, s.t, false);
        if (tm) songsHit.push({ kind: 'song', name: s.t, artist: s.a, title: s.t, id: s.id, tier: tm.tier, dist: tm.dist, source: 'lib' });
      }
    });
    var list = Object.keys(bestArtist).map(function (k) { return bestArtist[k]; });
    if (mode === 'song') list = songsHit.concat(list);
    else if (mode !== 'artist') list = list.concat(songsHit);
    list.sort(function (a, b) {
      var d = better(a, b);
      if (d) return d;
      if (mode === 'song' && a.kind !== b.kind) return a.kind === 'song' ? -1 : 1;
      return a.name < b.name ? -1 : 1;
    });
    var out = [], seen = {};
    list.forEach(function (x) {
      var k = x.kind + '|' + norm(x.artist) + '|' + norm(x.title);
      if (seen[k]) return;
      seen[k] = 1;
      if (out.length < (limit || 6)) out.push(x);
    });
    return out;
  }

  var itCache = {};
  function itunes(term, entity) {
    var q = String(term || '').trim();
    if (!q) return Promise.resolve([]);
    var key = entity + '|' + norm(q);
    if (itCache[key]) return Promise.resolve(itCache[key]);
    var url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(q) + '&entity=' + entity + '&country=tw&limit=6';
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var rows = [];
      (j.results || []).forEach(function (x) {
        if (entity === 'musicArtist') {
          if (!x.artistName) return;
          rows.push({ kind: 'artist', name: x.artistName, artist: x.artistName, title: '', id: '', source: 'apple' });
        } else if (x.trackName && x.artistName) {
          rows.push({ kind: 'song', name: x.trackName, artist: x.artistName, title: x.trackName, id: '', source: 'apple' });
        }
      });
      // 去掉和內建完全相同的
      var libs = libraryHits(q, entity === 'musicArtist' ? 'artist' : 'song', 12);
      rows = rows.filter(function (row) {
        return !libs.some(function (h) { return norm(h.artist) === norm(row.artist) && norm(h.title) === norm(row.title) && h.kind === row.kind; });
      });
      itCache[key] = rows;
      return rows;
    }, function () { return []; });
  }

  window.Fuzzy = { norm: norm, lev: lev, editOk: editOk, libraryHits: libraryHits, itunes: itunes };
})();
