/* 留格 — 步驟 2：參考圖複選＋自動歸納方向（9b，DIAGNOSIS 第 9 節）
 * ------------------------------------------------------------
 * 使用者一張一張看 assets/style-ref/ 的 01–06 參考圖、複選喜歡的；
 * 按「用這些喜好」後，這裡依選取歸納出「方向」清單，app.js 直接套用第一個，
 * 「換一個方向」就換清單裡的下一個（不再追問任何問題）。
 *
 * 對外：window.StylePick = { REFS, summarize, nextDirection, mixText, DIR_NAME }
 *   summarize(refIds)          → pick（寫進 state.stylePick）
 *   nextDirection(pick)        → 同一個 pick，dirIndex 前進一格（循環），回傳新的 direction
 */
(function () {
  'use strict';

  // ===== 參考圖定義 =====
  // temp：這張圖的「溫度」：warm 暖／cool 冷／bw 黑白（混搭規則用）
  // styles：對應到既有 MockData.STYLES id 的分數（越高越像）。對應理由：
  //   01 暖奶茶留白 → shop 3、life 2：暖、乾淨、留白多，像品牌小店的一致色系；其次是生活感
  //   02 冷藍電影感 → photo 3、life 1：冷色、光影與氛圍為主，攝影帳號的語言
  //   03 黑白俐落   → fashion 3、photo 2：中性、高對比、輪廓清楚，穿搭最常用；其次是攝影
  //   04 鮮豔熱鬧   → life 3、food 2：色彩飽和的日常與旅行；其次是食物的鮮豔近拍
  //   05 底片懷舊   → photo 3、life 2：顆粒、構圖講究，偏攝影；其次是懷舊生活
  //   06 文字卡說故事 → edu 3、life 1：文字卡與照片穿插，知識／說故事型
  var REFS = [
    { id: '01', file: 'assets/style-ref/01_beige.jpg', name: '暖奶茶留白', desc: '暖色奶茶調、留白多、安靜', temp: 'warm', styles: { shop: 3, life: 2 } },
    { id: '02', file: 'assets/style-ref/02_moody_blue.jpg', name: '冷藍電影感', desc: '冷色灰藍、雨天電影感', temp: 'cool', styles: { photo: 3, life: 1 } },
    { id: '03', file: 'assets/style-ref/03_bw.jpg', name: '黑白俐落', desc: '高對比黑白、俐落', temp: 'bw', styles: { fashion: 3, photo: 2 } },
    { id: '04', file: 'assets/style-ref/04_colorful.jpg', name: '鮮豔熱鬧', desc: '色彩鮮豔、熱鬧日常', temp: 'warm', styles: { life: 3, food: 2 } },
    { id: '05', file: 'assets/style-ref/05_film_composed_grid.jpg', name: '底片懷舊', desc: '底片顆粒、懷舊', temp: 'warm', styles: { photo: 3, life: 2 } },
    { id: '06', file: 'assets/style-ref/06_quotes.jpg', name: '文字卡說故事', desc: '文字卡與照片穿插、說故事', temp: 'warm', styles: { edu: 3, life: 1 } }
  ];
  var TEMP_NAME = { warm: '暖色', cool: '冷色', bw: '黑白' };

  // ===== 方向的白話名稱（畫面上用這個，不再出現「帳號類型」） =====
  var DIR_NAME = {
    shop: '暖色留白、乾淨安靜',
    photo: '光影氛圍、像電影',
    fashion: '黑白俐落、輪廓清楚',
    life: '有溫度的日常',
    food: '色彩飽滿、近拍質感',
    edu: '文字卡穿插、說故事'
  };

  function refById(id) { return REFS.filter(function (r) { return r.id === id; })[0]; }

  // ===== 混搭規則：選了多種溫度 → 約七成主色、三成點綴色，黑白當過渡 =====
  // 主色＝選取裡數量最多的溫度；平手用「先選的」。點綴色＝剩下溫度裡數量最多的（同樣平手用先選的）。
  // 只選了一種溫度 → mix 為 null（單一色系，不混搭）。
  function mixOf(refs, forceMain) {
    var count = {}, first = {};
    refs.forEach(function (r, i) {
      count[r.temp] = (count[r.temp] || 0) + 1;
      if (first[r.temp] === undefined) first[r.temp] = i;
    });
    var temps = Object.keys(count).sort(function (a, b) { return count[b] - count[a] || first[a] - first[b]; });
    if (temps.length < 2) return null;
    var main = forceMain && count[forceMain] ? forceMain : temps[0];
    var rest = temps.filter(function (t) { return t !== main; });
    return {
      main: main, accent: rest[0], bridge: 'bw',
      ratio: { main: 0.7, accent: 0.3 },
      temps: temps, counts: count
    };
  }
  function mixText(mix) {
    if (!mix) return '';
    var t = '約七成' + TEMP_NAME[mix.main] + '當主色、三成' + TEMP_NAME[mix.accent] + '點綴';
    t += mix.main === 'bw' || mix.accent === 'bw' ? '，黑白同時當兩種顏色之間的過渡' : '，中間用黑白當過渡';
    return t;
  }

  // ===== 歸納：依選取的參考圖，排出方向清單 =====
  // 1. 每個 styleId 加總分數；平手時「先被選到的參考圖」帶進來的排前面
  // 2. 方向清單＝分數 > 0 的 styleId 依序排，每個方向都用預設混搭（主色＝多數溫度）
  // 3. 有多種溫度時，再補上「改用另一種溫度當主色」的方向（styleId 用那種溫度的參考圖裡分數最高的）
  function summarize(refIds) {
    var refs = (refIds || []).map(refById).filter(Boolean);
    if (!refs.length) return null;
    var sc = {}, firstAt = {};
    refs.forEach(function (r, i) {
      Object.keys(r.styles).forEach(function (sid) {
        sc[sid] = (sc[sid] || 0) + r.styles[sid];
        if (firstAt[sid] === undefined) firstAt[sid] = i * 10 + (r.styles[sid] >= 3 ? 0 : 1);
      });
    });
    var ranked = Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a] || firstAt[a] - firstAt[b]; });
    var mix0 = mixOf(refs);
    var dirs = ranked.map(function (sid) { return { styleId: sid, mix: mix0, score: sc[sid] }; });
    if (mix0) {
      mix0.temps.slice(1).forEach(function (t) {
        var sub = refs.filter(function (r) { return r.temp === t; });
        var best = null, bestSc = -1;
        sub.forEach(function (r) { Object.keys(r.styles).forEach(function (sid) { if (r.styles[sid] > bestSc) { bestSc = r.styles[sid]; best = sid; } }); });
        if (best) dirs.push({ styleId: best, mix: mixOf(refs, t), score: sc[best] });
      });
    }
    // 去掉完全相同（styleId＋主色）的方向
    var seen = {};
    dirs = dirs.filter(function (d) {
      var k = d.styleId + '|' + (d.mix ? d.mix.main : '');
      if (seen[k]) return false; seen[k] = 1; return true;
    });
    dirs.forEach(function (d) { d.name = DIR_NAME[d.styleId] || d.styleId; d.mixText = mixText(d.mix); });
    return { refs: refs.map(function (r) { return r.id; }), scores: sc, directions: dirs, dirIndex: 0 };
  }

  // ===== 換一個方向：同樣選取下，換清單裡的下一個（循環） =====
  function nextDirection(pick) {
    if (!pick || !pick.directions.length) return null;
    pick.dirIndex = (pick.dirIndex + 1) % pick.directions.length;
    return pick.directions[pick.dirIndex];
  }
  function current(pick) { return pick && pick.directions[pick.dirIndex] || null; }

  window.StylePick = { REFS: REFS, TEMP_NAME: TEMP_NAME, DIR_NAME: DIR_NAME, refById: refById, mixOf: mixOf, mixText: mixText, summarize: summarize, nextDirection: nextDirection, current: current };
})();
