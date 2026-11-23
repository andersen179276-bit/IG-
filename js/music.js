/*
 * music.js — 配樂偏好（localStorage）、照片氛圍計算、推薦計分
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

  /* ---------- 照片氛圍：平均亮度、色溫（R−B）、飽和度 ---------- */
  function moodOf(canvases) {
    var n = 0, L = 0, RB = 0, S = 0;
    canvases.forEach(function (cv) {
      if (!cv || !cv.width) return;
      var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (var i = 0; i < d.length; i += 16) {
        var r = d[i], g = d[i + 1], b = d[i + 2];
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        L += 0.299 * r + 0.587 * g + 0.114 * b; RB += r - b; S += mx ? (mx - mn) / mx : 0; n++;
      }
    });
    if (!n) return null;
    L /= n; RB /= n; S /= n;
    var temp = RB >= 14 ? 'warm' : RB <= 0 ? 'cool' : 'neutral';
    var light = L >= 150 ? 'bright' : L <= 100 ? 'dark' : 'mid';
    var sat = S >= 0.35 ? 'vivid' : S <= 0.15 ? 'soft' : 'mid';
    var label;
    if (light === 'dark') label = '暗夜';
    else if (sat === 'vivid') label = '鮮明';
    else if (temp === 'warm') label = light === 'bright' ? '暖亮' : '暖沉';
    else if (temp === 'cool') label = '冷靜';
    else label = '柔和';
    var bits = [];
    bits.push(temp === 'warm' ? '偏暖' : temp === 'cool' ? '偏冷' : '冷暖適中');
    bits.push(light === 'bright' ? '偏亮' : light === 'dark' ? '偏暗' : '亮度適中');
    var tail = sat === 'soft' ? '，顏色很淡' : sat === 'vivid' ? '，顏色飽和' : '';
    return {
      label: label, temp: temp, light: light, sat: sat,
      lum: Math.round(L), warmth: Math.round(RB), satv: Math.round(S * 100) / 100,
      sentence: '這組照片' + bits.join('、') + tail + '。',
      pace: (label === '鮮明' || (label === '暖亮' && sat !== 'soft')) ? 'up' : 'slow'
    };
  }

  /* ---------- 推薦計分 ---------- */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 1000) / 1000;
  }

  var PART_WHY = {
    '前奏': '前奏就有畫面，封面出現時剛好鋪底。',
    '主歌': '主歌比較安靜，不搶照片，適合慢慢滑。',
    '副歌': '副歌情緒最滿，短短幾秒就讓人記住。',
    '橋段': '橋段有轉折，適合換場的輪播。'
  };

  function score(song, prefs, mood, seed) {
    var sc = 0, why = [];
    var dislikedArtists = prefs.dislikes.map(byId).filter(Boolean).map(function (x) { return norm(x.a); });
    var likedSongs = prefs.likes.map(byId).filter(Boolean);
    if (prefs.genres.indexOf(song.g) >= 0) { sc += 3; why.push('你喜歡的' + song.g); }
    var artistHit = prefs.artists.some(function (a) { var k = norm(a); return k && (norm(song.a).indexOf(k) >= 0 || k.indexOf(norm(song.a)) >= 0); });
    if (artistHit) { sc += 4; why.unshift('你喜歡的歌手'); }
    // 自己填過的歌：同歌手加權；同一首就不再推（想找的是新歌）
    var own = prefs.songs || [];
    if (own.some(function (q) { return norm(q.a) && norm(q.a) === norm(song.a); })) { sc += 2; if (!artistHit) why.unshift('你填過的歌手'); }
    if (own.some(function (q) { return norm(q.t) === norm(song.t) && norm(q.a) === norm(song.a); })) sc -= 6;
    var likedSameGenre = likedSongs.filter(function (x) { return x.g === song.g && x.id !== song.id; }).length;
    sc += Math.min(2.4, likedSameGenre * 0.8);
    if (prefs.likes.indexOf(song.id) >= 0) sc += 1;
    dislikedArtists.forEach(function (a) { if (a === norm(song.a)) sc -= 2.5; });
    if (mood) {
      if (mood.temp !== 'neutral') sc += song.temp === mood.temp ? 1.5 : -0.5;
      if (mood.light !== 'mid') sc += song.light === mood.light ? 1.5 : -0.3;
      sc += song.pace === mood.pace ? 1 : 0;
    }
    sc += hash(song.id + '|' + seed) * 0.9;
    return { sc: sc, why: why };
  }

  function moodWhy(song, mood) {
    var t = song.temp === 'warm' ? '溫暖' : '清冷';
    var l = song.light === 'bright' ? '明亮' : '帶點夜色';
    var p = song.pace === 'up' ? '節奏輕快，適合一張張滑過的輪播' : '節奏慢，讓人願意停在第一張';
    var match = mood && ((mood.temp === song.temp) || (mood.light === song.light));
    return t + '、' + l + '的聲音' + (match ? '，和這組「' + mood.label + '」的照片是同一個溫度' : '，替照片補一點反差') + '；' + p + '。';
  }

  /**
   * 推薦 3 首
   * @param prefs  偏好
   * @param mood   moodOf() 結果
   * @param opts   { seed, avoid:[id] }  「換一組」時換 seed 並避開剛剛推薦過的
   */
  function recommend(prefs, mood, opts) {
    opts = opts || {};
    var avoid = opts.avoid || [];
    var list = LIB.SONGS.filter(function (s) { return prefs.dislikes.indexOf(s.id) < 0; })
      .map(function (s) { var r = score(s, prefs, mood, opts.seed || 0); return { s: s, sc: r.sc - (avoid.indexOf(s.id) >= 0 ? 6 : 0), why: r.why }; })
      .sort(function (a, b) { return b.sc - a.sc; });
    var out = [], artists = {};
    for (var i = 0; i < list.length && out.length < 3; i++) {
      var k = norm(list[i].s.a);
      if (artists[k]) continue; // 同一組不重複歌手
      artists[k] = 1;
      out.push(list[i]);
    }
    return out.map(function (x) {
      var s = x.s;
      return {
        id: s.id, title: s.t, artist: s.a, genre: s.g, part: s.part,
        partWhy: PART_WHY[s.part],
        why: (x.why.length ? x.why.join('、') + '。' : '') + moodWhy(s, mood),
        liked: prefs.likes.indexOf(s.id) >= 0
      };
    });
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
    moodOf: moodOf, recommend: recommend, guessTaste: guessTaste, byId: byId, norm: norm
  };
})();
