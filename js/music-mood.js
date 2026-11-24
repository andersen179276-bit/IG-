/* 留格 — 配樂：依照片情緒，每個曲風推一首最搭的歌（9b，DIAGNOSIS 第 9 節）
 * ------------------------------------------------------------
 * 照片情緒只在這裡算一次（moodOf，原本在 music.js，9b 搬過來；Music.moodOf 仍可呼叫，指向同一個函式）。
 * 推薦規則：
 *   1. 先用照片的冷暖（temp）、明暗（light）、節奏（pace）算每首歌的貼合度 fit（見 fit()）。
 *   2. 每個曲風各挑 fit 最高的一首（同分再看：喜歡的歌手／喜歡過的歌 → 固定雜湊），「同一個氛圍的不同曲風版本」。
 *   3. 曲風、歌手都是選填，只用來篩選：
 *        沒選曲風 → MusicLibrary.GENRES 十個曲風各一首；
 *        選了曲風 → 只從所選曲風推，沿用 js/music-filter.js 的硬篩選（華語類同時鎖 lang='zh'），不放寬、不補「相近推薦」；
 *        填了歌手 → 每個曲風裡有這些歌手的歌就只從他們的歌挑，沒有就挑同曲風最貼合的；有歌手命中的曲風排前面。
 *   4. 「換一組」：每個曲風換「還沒推過」的下一首最貼合的；整個曲風都推過一輪了才從頭再來。
 * 對外：window.MusicMood = { moodOf, fit, perGenre, moodWhy, PART_WHY }
 */
(function () {
  'use strict';

  var LIB = window.MusicLibrary;

  // ===== 照片氛圍：平均亮度、色溫（R−B）、飽和度 → temp／light／pace =====
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
    var pace = (label === '鮮明' || (label === '暖亮' && sat !== 'soft')) ? 'up' : 'slow';
    return {
      label: label, temp: temp, light: light, sat: sat, pace: pace,
      lum: Math.round(L), warmth: Math.round(RB), satv: Math.round(S * 100) / 100,
      sentence: '這組照片' + bits.join('、') + tail + '，' + (pace === 'up' ? '節奏輕快' : '節奏慢') + '。'
    };
  }

  // ===== 貼合度：歌的 temp／light／pace 和照片情緒有多接近（最高 4 分） =====
  // 冷暖：照片不是「適中」時，同溫 +1.5、反向 −0.5；明暗：照片不是「適中」時，同亮度 +1.5、反向 −0.3；節奏相同 +1。
  function fit(song, mood) {
    if (!mood) return 0;
    var f = 0;
    if (mood.temp !== 'neutral') f += song.temp === mood.temp ? 1.5 : -0.5;
    if (mood.light !== 'mid') f += song.light === mood.light ? 1.5 : -0.3;
    if (song.pace === mood.pace) f += 1;
    return Math.round(f * 10) / 10;
  }

  // ===== 小工具 =====
  function norm(s) { return String(s || '').toLowerCase().replace(/[\s　·・.,'’&]/g, ''); }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 1000) / 1000;
  }
  function byId(id) { return LIB.SONGS.filter(function (x) { return x.id === id; })[0]; }
  function artistHit(song, prefs) {
    return (prefs.artists || []).some(function (a) { var k = norm(a); return k && (norm(song.a).indexOf(k) >= 0 || k.indexOf(norm(song.a)) >= 0); });
  }
  // 同分時的次要排序（不影響 fit 最高的前提）：喜歡的歌手、填過的歌手、喜歡過的歌、不喜歡的歌手
  function tieBonus(song, prefs) {
    var b = 0;
    if (artistHit(song, prefs)) b += 4;
    if ((prefs.songs || []).some(function (q) { return norm(q.a) && norm(q.a) === norm(song.a); })) b += 2;
    if ((prefs.likes || []).indexOf(song.id) >= 0) b += 1;
    (prefs.dislikes || []).map(byId).filter(Boolean).forEach(function (x) { if (norm(x.a) === norm(song.a)) b -= 2.5; });
    return b;
  }

  // ===== 說明文字 =====
  var PART_WHY = {
    '前奏': '前奏就有畫面，封面出現時剛好鋪底。',
    '主歌': '主歌比較安靜，不搶照片，適合慢慢滑。',
    '副歌': '副歌情緒最滿，短短幾秒就讓人記住。',
    '橋段': '橋段有轉折，適合換場的輪播。'
  };
  function moodWhy(song, mood) {
    var t = song.temp === 'warm' ? '溫暖' : '清冷';
    var l = song.light === 'bright' ? '明亮' : '帶點夜色';
    var p = song.pace === 'up' ? '節奏輕快，適合一張張滑過的輪播' : '節奏慢，讓人願意停在第一張';
    var match = mood && ((mood.temp === song.temp) || (mood.light === song.light));
    return t + '、' + l + '的聲音' + (match ? '，和這組「' + mood.label + '」的照片是同一個溫度' : '，替照片補一點反差') + '；' + p + '。';
  }

  // ===== 每個曲風一首 =====
  /**
   * @param prefs  Music 偏好（genres／artists 選填；likes／dislikes／songs）
   * @param mood   moodOf() 結果（null 時 fit 全為 0，只看次要排序）
   * @param opts   { lang:'all'|'zh'|'en', seed, avoid:[id] 已推過的, current:[id] 畫面上這一組, genres:[g] 只重算這些曲風 }
   * @return [{ id, title, artist, genre, part, partWhy, why, liked, near:false, fit, artistHit }]（依曲風排列）
   */
  function perGenre(prefs, mood, opts) {
    opts = opts || {};
    prefs = prefs || {};
    var avoid = opts.avoid || [], current = opts.current || [];
    var lang = opts.lang === 'zh' || opts.lang === 'en' ? opts.lang : '';
    var own = prefs.songs || [];
    var base = LIB.SONGS.filter(function (s) {
      if ((prefs.dislikes || []).indexOf(s.id) >= 0) return false;
      if (lang && s.lang !== lang) return false;
      // 自己填過的同一首不再推（想找的是新歌）
      if (own.some(function (q) { return norm(q.t) === norm(s.t) && norm(q.a) === norm(s.a); })) return false;
      return true;
    });
    var sel = (prefs.genres || []).filter(function (g) { return LIB.GENRES.indexOf(g) >= 0; });
    // 選了曲風 → 只用硬篩選結果（js/music-filter.js 的 strict），不從 loose 補
    var pool = sel.length ? window.MusicFilter.split(base, { genres: sel }, LIB.SONGS).strict : base;
    var genres = (sel.length ? LIB.GENRES.filter(function (g) { return sel.indexOf(g) >= 0; }) : LIB.GENRES.slice());
    if (opts.genres) genres = genres.filter(function (g) { return opts.genres.indexOf(g) >= 0; });
    var hasArtists = (prefs.artists || []).length > 0;
    var seed = opts.seed || 0;

    var out = [];
    genres.forEach(function (g, gi) {
      var cand = pool.filter(function (s) { return s.g === g; });
      if (!cand.length) return;
      var hitA = hasArtists ? cand.filter(function (s) { return artistHit(s, prefs); }) : [];
      if (hitA.length) cand = hitA; // 填了歌手：這個曲風有他們的歌就只從他們的歌挑
      var ranked = cand.map(function (s) {
        return { s: s, fit: fit(s, mood), tb: tieBonus(s, prefs), h: hash(s.id + '|' + seed) };
      }).sort(function (a, b) { return b.fit - a.fit || b.tb - a.tb || b.h - a.h; });
      // 換一組：還沒推過的下一首；都推過了才從頭（但避開畫面上正在顯示的那首）
      var pick = ranked.filter(function (x) { return avoid.indexOf(x.s.id) < 0; })[0] ||
        ranked.filter(function (x) { return current.indexOf(x.s.id) < 0; })[0] || ranked[0];
      out.push({ x: pick, gi: gi, hit: hitA.length > 0 });
    });
    if (hasArtists) out.sort(function (a, b) { return (b.hit - a.hit) || (a.gi - b.gi); }); // 有喜歡歌手的曲風排前面

    return out.map(function (o) {
      var s = o.x.s;
      return {
        id: s.id, title: s.t, artist: s.a, genre: s.g, part: s.part,
        partWhy: PART_WHY[s.part],
        why: (o.hit ? '你喜歡的歌手。' : '') + moodWhy(s, mood),
        liked: (prefs.likes || []).indexOf(s.id) >= 0,
        near: false, fit: o.x.fit, artistHit: o.hit
      };
    });
  }

  window.MusicMood = { moodOf: moodOf, fit: fit, perGenre: perGenre, moodWhy: moodWhy, PART_WHY: PART_WHY };
})();
