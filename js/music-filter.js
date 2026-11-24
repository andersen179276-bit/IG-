/* 留格 — 配樂曲風硬篩選（第五輪修 bug 第 7 節）
 * 選了曲風時先用 song.g 篩；華語類曲風同時鎖 lang='zh'。
 * 符合的湊不滿 3 首，才由 music.js 從 loose 補位並標「相近推薦」。
 * 對外：window.MusicFilter = { isZhGenre, split, conflict }
 */
(function () {
  'use strict';

  // ===== 華語類曲風判斷：名稱含「華語」，或曲庫中該曲風全部標為中文 =====
  var zhCache = null;
  function zhGenres(songs) {
    if (zhCache) return zhCache;
    var stat = {};
    songs.forEach(function (s) {
      var x = stat[s.g] || (stat[s.g] = { n: 0, zh: 0 });
      x.n++; if (s.lang === 'zh') x.zh++;
    });
    zhCache = {};
    Object.keys(stat).forEach(function (g) {
      if (g.indexOf('華語') >= 0 || stat[g].zh === stat[g].n) zhCache[g] = 1;
    });
    return zhCache;
  }
  function isZhGenre(g, songs) { return String(g).indexOf('華語') >= 0 || !!zhGenres(songs)[g]; }

  // ===== 單首是否符合使用者選的曲風（華語類要 lang=zh） =====
  function genreHit(s, genres, songs) {
    if (genres.indexOf(s.g) < 0) return false;
    return !isZhGenre(s.g, songs) || s.lang === 'zh';
  }

  // ===== 分成 strict（硬篩選結果）與 loose（放寬時的補位候選） =====
  // base：已排除不喜歡的歌與語言不符的歌
  function split(base, prefs, songs) {
    var genres = (prefs && prefs.genres) || [];
    if (!genres.length) return { strict: base.slice(), loose: [] };
    var strict = [], loose = [];
    base.forEach(function (s) { (genreHit(s, genres, songs) ? strict : loose).push(s); });
    return { strict: strict, loose: loose };
  }

  // ===== 曲風與語言切換衝突：回傳提示文字，沒衝突回傳 '' =====
  function conflict(prefs, lang, songs) {
    var genres = (prefs && prefs.genres) || [];
    if (!genres.length || (lang !== 'zh' && lang !== 'en')) return '';
    var bad = genres.filter(function (g) {
      return !songs.some(function (s) { return s.lang === lang && genreHit(s, [g], songs); });
    });
    if (!bad.length) return '';
    var langName = lang === 'zh' ? '中文' : '英文';
    var all = bad.length === genres.length;
    return '你選的「' + bad.join('、') + '」沒有' + langName + '歌' +
      (all ? '，以下是' + langName + '的相近推薦；想聽原曲風請把語言切回「全部」。' : '，這部分先略過。');
  }

  window.MusicFilter = { isZhGenre: isZhGenre, split: split, conflict: conflict };
})();
