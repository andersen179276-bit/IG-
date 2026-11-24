/*
 * music.js — 配樂偏好（localStorage）；照片氛圍與推薦轉呼叫 js/music-mood.js（9b）
 * ------------------------------------------------------------
 * 全部在瀏覽器本地完成，不花 token、不送網路。
 * 不能把歌加進 IG；只推薦，使用者到 IG App 加音樂時自己搜尋。
 *
 * 偏好存在 localStorage['liuge.music.v1']：
 *   { v:1, genres:[], artists:[], songs:[{t,a}], summary:'', likes:[id], dislikes:[id], updatedAt }
 */
(function () {
  'use strict';

  var KEY = 'liuge.music.v1';
  var LIB = window.MusicLibrary;

  /* ---------- 偏好存取 ---------- */
  function empty() { return { v: 1, genres: [], artists: [], songs: [], summary: '', likes: [], dislikes: [] }; }
  function load() {
    try {
      var p = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!p || p.v !== 1) return null;
      var e = empty();
      Object.keys(e).forEach(function (k) { if (p[k] === undefined) p[k] = e[k]; });
      return p;
    } catch (err) { return null; }
  }
  function save(p) {
    p.v = 1; p.updatedAt = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (err) { /* 無痕模式可能存不了，畫面照常 */ }
    return p;
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (err) {} }
  function hasPrefs(p) { return !!(p && (p.genres.length || p.artists.length || p.songs.length)); }

  function norm(s) { return String(s || '').toLowerCase().replace(/[\s　·・.,'’&]/g, ''); }
  function byId(id) { return LIB.SONGS.filter(function (x) { return x.id === id; })[0]; }

  /* ---------- 照片氛圍與推薦（9b 搬到 js/music-mood.js；這裡只轉呼叫，避免兩套不一致的情緒計算） ---------- */
  // moodOf(canvases) → { label, temp, light, sat, pace, sentence, ... }
  function moodOf(canvases) { return window.MusicMood.moodOf(canvases); }

  /**
   * 推薦：依照片情緒，每個曲風一首最搭的（曲風、歌手只做篩選；見 js/music-mood.js perGenre）
   * @param prefs  偏好（可為空的 Music.empty()）
   * @param mood   moodOf() 結果
   * @param opts   { seed, avoid:[id], current:[id], lang, genres:[g] }
   */
  function recommend(prefs, mood, opts) {
    return window.MusicMood.perGenre(prefs || empty(), mood, opts);
  }

  /* ---------- 示範：從喜歡的歌推曲風（ai.js 的 analyzeMusicTaste 會呼叫） ---------- */
  function guessTaste(songs) {
    var counts = {}, temp = 0, light = 0, pace = 0, hit = 0;
    songs.forEach(function (q) {
      var na = norm(q.a), nt = norm(q.t);
      LIB.SONGS.forEach(function (s) {
        var aHit = na && (norm(s.a) === na || norm(s.a).indexOf(na) >= 0 || (na.length > 1 && na.indexOf(norm(s.a)) >= 0));
        var tHit = nt && norm(s.t).indexOf(nt) === 0;
        if (!aHit && !tHit) return;
        hit++;
        counts[s.g] = (counts[s.g] || 0) + (aHit && tHit ? 2 : 1);
        temp += s.temp === 'warm' ? 1 : -1;
        light += s.light === 'bright' ? 1 : -1;
        pace += s.pace === 'up' ? 1 : -1;
      });
    });
    var genres = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 3);
    var fallback = !genres.length;
    if (fallback) { genres = ['華語抒情', '獨立樂團']; temp = 1; light = -1; pace = -1; }
    var w = temp >= 0 ? '溫暖' : '清冷';
    var l = light >= 0 ? '明亮' : '帶點懷舊';
    var p = pace > 0 ? '輕快節奏' : '中慢板';
    var g = genres.slice(0, 2).join('與');
    return {
      sentence: '你喜歡' + w + '、' + l + '的' + p + '，偏' + g + '。',
      genres: genres, matched: hit, fallback: fallback
    };
  }

  window.Music = {
    KEY: KEY, empty: empty, load: load, save: save, clear: clear, hasPrefs: hasPrefs,
    moodOf: moodOf, recommend: recommend, genreConflict: function (p, l) { return window.MusicFilter.conflict(p, l, LIB.SONGS); }, guessTaste: guessTaste, byId: byId, norm: norm
  };
})();
