/*
 * ai.js — AI 接口（目前是 mock）
 * ------------------------------------------------------------
 * 介面只依賴這三個函式，回傳 Promise：
 *
 *   AI.analyzeProfile(screenshot, styleId) → Promise<Analysis>
 *   AI.suggestNextShot(analysis, styleId)  → Promise<Shot[]>
 *   AI.analyzeMusicTaste(songs)            → Promise<{ sentence, genres[], matched, isMock }>
 *
 * 注意：「建議封存」的位置不由這裡決定。格子位置與貼文數由 js/grid-detect.js
 * 在本地用像素分析算出，封存格也在本地依色差挑選（見 GridDetect.pickArchive）。
 *
 * 之後在這裡接 AI：
 *   1. 把 screenshot（{ url, width, height, isDemo }）轉成 base64，
 *      連同 styleId 對應的規則（MockData.STYLES）一起送給模型。
 *   2. 要求模型回傳與下方 mock 相同結構的 JSON（summary / dims / tips / archive），
 *      畫面不需要任何修改。
 *   3. 注意：主頁截圖屬於使用者隱私，送出前要在 UI 明確告知並取得同意；
 *      原型階段完全不送出網路。
 *
 * 用一般 script（掛 window.AI）而不是 ES module，是為了讓 index.html 可以直接雙擊開啟。
 */
(function () {
  'use strict';

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }
  function jitter() { return 600 + Math.round(Math.random() * 300); } // 600–900ms 假延遲
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /**
   * 分析主頁截圖。
   * @param {{url:string,width:number,height:number,isDemo:boolean}|null} screenshot
   * @param {string} styleId  shop | fashion | life | photo | food | edu
   */
  function analyzeProfile(screenshot, styleId) {
    // 之後在這裡接 AI —— 目前回傳寫死的示範分析
    var data = window.MockData.ANALYSIS[styleId] || window.MockData.ANALYSIS.life;
    return delay(jitter()).then(function () {
      var out = clone(data);
      out.styleId = styleId;
      out.isMock = true;
      out.source = screenshot && !screenshot.isDemo ? 'upload' : 'demo';
      return out;
    });
  }

  /**
   * 依分析結果建議下一篇。
   * @param {object} analysis  analyzeProfile 的結果
   * @param {string} styleId
   * @returns {Promise<Array>} 2–3 組拍攝卡，畫面可「換一個建議」
   */
  function suggestNextShot(analysis, styleId) {
    // 之後在這裡接 AI —— 目前回傳寫死的示範拍攝卡
    var list = window.MockData.SHOTS[styleId] || window.MockData.SHOTS.life;
    return delay(jitter()).then(function () {
      return clone(list).map(function (s) { s.isMock = true; return s; });
    });
  }

  /**
   * 從使用者喜歡的 3–5 首歌推測曲風與一句話描述。
   * @param {Array<{t:string,a:string}>} songs  歌名＋歌手
   * 之後在這裡接 AI —— 目前是示範：比對內建歌單（js/music-library.js）的歌手與歌名推曲風，
   * 比不到就給預設（華語抒情＋獨立樂團）。結果在畫面上標「示範內容」。
   */
  function analyzeMusicTaste(songs) {
    return delay(900 + Math.round(Math.random() * 300)).then(function () {
      var r = window.Music.guessTaste(songs || []);
      r.isMock = true;
      return r;
    });
  }

  window.AI = { analyzeProfile: analyzeProfile, suggestNextShot: suggestNextShot, analyzeMusicTaste: analyzeMusicTaste };
})();
