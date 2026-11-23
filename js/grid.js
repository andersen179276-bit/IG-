/*
 * grid.js — 九宮格與抽象色塊
 * ------------------------------------------------------------
 * 產品原則「只修不造」：所有示意圖都是純色塊與幾何線條，
 * 不含任何人像、圖庫或生成圖片。
 *
 * 每一格是一個 cell 描述：{ bg, fg, kind }
 *   kind 代表格子「像什麼」，用簡單的幾何形狀表示：
 *   plain   純色
 *   product 一件物件（小店商品）
 *   text    文字卡（一條粗標題＋兩條細字）
 *   dense   資訊很密的文字傳單
 *   full    全身尺度（高窄色塊）
 *   half    半身尺度（較寬色塊、貼底）
 *   detail  細節紋理（斜細線）
 *   plate   俯拍餐盤
 *   space   空間／建築（窗格＋地面）
 *   land    風景（地平線＋小點）
 *   minimal 極簡留白（一條細地平線）
 *   light   窗光（一塊斜光）
 *   busy    資訊量大（四小塊）
 */
(function () {
  'use strict';

  /* ---------- 共用調色盤（BRIEF 指定） ---------- */
  var EARTH = ['#D9CBB8', '#C7B39C', '#B9A48E', '#E4DACB', '#A89A8B', '#CDBFAF',
               '#8F8274', '#E9E1D6', '#BFAE98', '#D3C6B6', '#9E9182', '#B5A999'];

  function c(bg, kind, fg) { return { bg: bg, kind: kind || 'plain', fg: fg || null }; }

  /* ---------- 六種類型的迷你九宮格：每一張都要體現該類型的規則 ---------- */
  var MINI = {
    // 小店：統一暖棕＋品牌綠；商品照（單數格）與文字樣板／空間（雙數格）棋盤交錯
    shop: [
      c('#E9E1D6', 'product', '#B9A48E'), c('#6E7B6C', 'text', '#E9E1D6'), c('#E4DACB', 'product', '#8F8274'),
      c('#C7B39C', 'space', '#E9E1D6'),   c('#EFE8DD', 'product', '#6E7B6C'), c('#B9A48E', 'space', '#E4DACB'),
      c('#E4DACB', 'product', '#A89A8B'), c('#6E7B6C', 'text', '#E9E1D6'), c('#E9E1D6', 'product', '#C7B39C')
    ],
    // 穿搭：全身／半身／細節交替，明度也交替；同一欄不連續相同尺度
    fashion: [
      c('#E9E4DC', 'full', '#5E5751'),   c('#A89A8B', 'half', '#E9E1D6'),  c('#CDBFAF', 'detail', '#8F8274'),
      c('#8F8274', 'detail', '#B9A48E'), c('#D9CBB8', 'full', '#3E3935'),  c('#E4DACB', 'half', '#948B82'),
      c('#B5A999', 'half', '#2F2B28'),   c('#E9E1D6', 'detail', '#B5A999'), c('#9E9182', 'full', '#E9E1D6')
    ],
    // 生活：同一種暖窗光；遠景／空景／近景交替，資訊量大的格子被安靜的格子隔開
    life: [
      c('#DCC7AA', 'space', '#F1E8DA'),  c('#F1E8DA', 'light', '#E2D0B6'), c('#C9A888', 'detail', '#E7D9C4'),
      c('#E7D9C4', 'product', '#B89878'), c('#D3B99A', 'busy', '#F1E8DA'), c('#EFE6D8', 'light', '#DCC7AA'),
      c('#F1E8DA', 'light', '#D9C2A5'),  c('#B89878', 'space', '#E7D9C4'), c('#D9C2A5', 'detail', '#F1E8DA')
    ],
    // 攝影：低明度灰藍定調；暗格走對角線，其餘大量米白留白
    photo: [
      c('#5F656B', 'land', '#3F4448'),   c('#F2EEE8', 'minimal', '#A3A9AE'), c('#E9E6E1', 'minimal', '#7E8790'),
      c('#F2EEE8', 'plain'),             c('#7E8790', 'land', '#5F656B'),    c('#F2EEE8', 'minimal', '#A3A9AE'),
      c('#EEEAE4', 'minimal', '#7E8790'), c('#F2EEE8', 'plain'),             c('#5F656B', 'land', '#3F4448')
    ],
    // 美食：俯拍菜色與店內空間棋盤交錯，全部暖色、食材本色
    food: [
      c('#E8DCCB', 'plate', '#C9A27E'), c('#8C6A52', 'space', '#D9C2A5'), c('#F0E7DA', 'plate', '#A8805F'),
      c('#C9A888', 'space', '#F0E7DA'), c('#E8DCCB', 'plate', '#8C6A52'), c('#A8805F', 'space', '#E8DCCB'),
      c('#F0E7DA', 'plate', '#B98F6E'), c('#9C7A60', 'space', '#E8DCCB'), c('#E8DCCB', 'plate', '#C9A27E')
    ],
    // 知識圖文：淺底深字的文字卡與照片棋盤交錯，樣板固定
    edu: [
      c('#F4F0EA', 'text', '#2B2724'), c('#B9A48E', 'product', '#E9E1D6'), c('#F4F0EA', 'text', '#2B2724'),
      c('#A89A8B', 'space', '#E4DACB'), c('#3A3430', 'text', '#EFE8DD'),   c('#C7B39C', 'product', '#F4F0EA'),
      c('#F4F0EA', 'text', '#2B2724'), c('#9E9182', 'space', '#E4DACB'),   c('#F4F0EA', 'text', '#8A6F5A')
    ]
  };

  /* ---------- 示範主頁（給「先用示範截圖」與分析頁） ----------
   * 刻意放兩格「不合群」的：index 2 橘紅資訊傳單、index 6 冷藍夜景。
   */
  var DEMO_PROFILE = [
    c('#E4DACB', 'product', '#B9A48E'), c('#B9A48E', 'space', '#E9E1D6'), c('#B0613F', 'dense', '#F3E3D3'),
    c('#E9E1D6', 'plate', '#C7B39C'),   c('#EFE8DD', 'light', '#D9CBB8'), c('#C7B39C', 'product', '#8F8274'),
    c('#5E7385', 'land', '#3C4A56'),    c('#CDBFAF', 'detail', '#A89A8B'), c('#F4F0EA', 'text', '#2B2724'),
    c('#D3C6B6', 'half', '#8F8274'),    c('#E4DACB', 'busy', '#B5A999'), c('#BFAE98', 'space', '#EFE8DD')
  ];

  /* ---------- 首頁「整理前／整理後」 ---------- */
  var BEFORE = [
    c('#B0613F', 'dense', '#F3E3D3'), c('#E9E1D6', 'product', '#B9A48E'), c('#5E7385', 'land', '#3C4A56'),
    c('#C9B27A', 'busy', '#F1E8DA'),  c('#D9CBB8', 'plate', '#A89A8B'),   c('#6E7B6C', 'space', '#C7B39C'),
    c('#8F8274', 'detail', '#C7B39C'), c('#C98F6B', 'text', '#F4F0EA'),   c('#E4DACB', 'light', '#CDBFAF')
  ];
  // 整理後：同一組格子重新排序（明暗棋盤），並把色調往暖米收攏（見 afterCells）

  /* ---------- 色彩小工具 ---------- */
  function hex2rgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hex(r) {
    return '#' + r.map(function (v) {
      v = Math.max(0, Math.min(255, Math.round(v)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }
  function mix(a, b, t) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex([0, 1, 2].map(function (i) { return A[i] + (B[i] - A[i]) * t; }));
  }
  function tone(cell, t) {
    return { bg: mix(cell.bg, '#D9CBB8', t), fg: cell.fg ? mix(cell.fg, '#EFE8DD', t * 0.8) : null, kind: cell.kind };
  }
  // 整理後：同一組九格重新排序（兩張文字卡放在對角、空景與細節隔開），並把色調往暖米收攏
  var AFTER_ORDER = [1, 6, 0, 3, 4, 5, 7, 2, 8];
  function afterCells() {
    return AFTER_ORDER.map(function (i) {
      var cell = tone(BEFORE[i], 0.72);
      // 資訊密集的傳單換成固定樣板、雜亂畫面換成安靜的光
      if (cell.kind === 'dense') cell.kind = 'text';
      if (cell.kind === 'busy') cell.kind = 'light';
      return cell;
    });
  }

  /* ---------- HTML 版九宮格 ---------- */
  function cellInner(kind) {
    switch (kind) {
      case 'product': return '<i class="a"></i><i class="b"></i>';
      case 'text':    return '<i class="a"></i><i class="b"></i><i class="c"></i>';
      case 'dense':   return '<i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i><i class="e"></i>';
      case 'full':    return '<i class="a"></i>';
      case 'half':    return '<i class="a"></i>';
      case 'plate':   return '<i class="a"></i><i class="b"></i>';
      case 'space':   return '<i class="a"></i><i class="b"></i><i class="c"></i>';
      case 'land':    return '<i class="a"></i><i class="b"></i>';
      case 'minimal': return '<i class="a"></i>';
      case 'light':   return '<i class="a"></i>';
      case 'busy':    return '<i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i>';
      default: return '';
    }
  }
  function cellHTML(cell, extraClass, attrs) {
    var style = '--cbg:' + cell.bg + ';--cfg:' + (cell.fg || cell.bg) + ';';
    return '<div class="cell k-' + cell.kind + (extraClass ? ' ' + extraClass : '') + '" style="' + style + '"' +
      (attrs || '') + '>' + cellInner(cell.kind) + '</div>';
  }
  function gridHTML(cells, cls) {
    return '<div class="mgrid ' + (cls || '') + '">' + cells.map(function (x) { return cellHTML(x); }).join('') + '</div>';
  }

  /* ---------- Canvas 版（畫示範截圖、測試圖用） ---------- */
  function rect(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
  function drawCell(ctx, x, y, w, h, cell) {
    var fg = cell.fg || cell.bg;
    rect(ctx, x, y, w, h, cell.bg);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    switch (cell.kind) {
      case 'product':
        rect(ctx, x + w * 0.34, y + w * 0.36, w * 0.32, h * 0.40, fg);
        rect(ctx, x + w * 0.24, y + h * 0.76, w * 0.52, Math.max(2, h * 0.012), fg);
        break;
      case 'text':
        rect(ctx, x + w * 0.18, y + h * 0.36, w * 0.64, h * 0.06, fg);
        rect(ctx, x + w * 0.28, y + h * 0.50, w * 0.44, h * 0.02, fg);
        rect(ctx, x + w * 0.32, y + h * 0.56, w * 0.36, h * 0.02, fg);
        break;
      case 'dense':
        for (var i = 0; i < 7; i++) rect(ctx, x + w * 0.1, y + h * (0.14 + i * 0.1), w * (i === 0 ? 0.8 : 0.6 + (i % 3) * 0.1), h * (i === 0 ? 0.07 : 0.035), fg);
        break;
      case 'full':
        rect(ctx, x + w * 0.42, y + h * 0.16, w * 0.16, h * 0.74, fg);
        break;
      case 'half':
        rect(ctx, x + w * 0.28, y + h * 0.40, w * 0.44, h * 0.60, fg);
        break;
      case 'detail':
        ctx.strokeStyle = fg; ctx.lineWidth = Math.max(1, w * 0.008);
        for (var d = -h; d < w; d += w * 0.06) { ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke(); }
        break;
      case 'plate':
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = cell.bg; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w * 0.18, 0, Math.PI * 2); ctx.fill();
        break;
      case 'space':
        rect(ctx, x, y + h * 0.72, w, h * 0.28, fg);
        rect(ctx, x + w * 0.18, y + h * 0.18, w * 0.22, h * 0.34, fg);
        rect(ctx, x + w * 0.56, y + h * 0.18, w * 0.22, h * 0.34, fg);
        break;
      case 'land':
        rect(ctx, x, y + h * 0.64, w, h * 0.36, fg);
        rect(ctx, x + w * 0.62, y + h * 0.56, w * 0.04, h * 0.08, fg);
        break;
      case 'minimal':
        rect(ctx, x, y + h * 0.72, w, Math.max(1, h * 0.006), fg);
        break;
      case 'light':
        ctx.fillStyle = fg; ctx.beginPath();
        ctx.moveTo(x + w * 0.3, y); ctx.lineTo(x + w * 0.62, y); ctx.lineTo(x + w * 0.9, y + h); ctx.lineTo(x + w * 0.5, y + h);
        ctx.closePath(); ctx.fill();
        break;
      case 'busy':
        rect(ctx, x + w * 0.1, y + h * 0.1, w * 0.36, h * 0.36, fg);
        rect(ctx, x + w * 0.54, y + h * 0.1, w * 0.36, h * 0.24, fg);
        rect(ctx, x + w * 0.1, y + h * 0.54, w * 0.36, h * 0.36, fg);
        rect(ctx, x + w * 0.54, y + h * 0.42, w * 0.36, h * 0.48, fg);
        break;
    }
    ctx.restore();
  }

  /* 示範主頁截圖（抽象版 IG 主頁）。回傳 { url, width, height }
   * 格子位置不寫死：和使用者上傳的截圖一樣，交給 js/grid-detect.js 偵測。 */
  var DEMO_W = 780, DEMO_HEAD = 560;
  function makeDemoScreenshot(cells) {
    cells = cells || DEMO_PROFILE;
    var W = DEMO_W, gap = 3;
    var cw = (W - gap * 2) / 3, ch = cw * 5 / 4;
    var rows = Math.ceil(cells.length / 3);
    var H = Math.round(DEMO_HEAD + rows * ch + (rows - 1) * gap);
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    rect(ctx, 0, 0, W, H, '#FBF9F5');
    var ink = '#2B2724', soft = '#DDD5CA', mid = '#B5ADA4';
    // 頂列：帳號名
    rect(ctx, 36, 40, 180, 22, ink);
    rect(ctx, W - 116, 40, 28, 22, mid); rect(ctx, W - 66, 40, 28, 22, mid);
    // 頭像（色塊圓）
    ctx.fillStyle = '#C7B39C'; ctx.beginPath(); ctx.arc(110, 170, 70, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = soft; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(110, 170, 80, 0, Math.PI * 2); ctx.stroke();
    // 數字
    [300, 450, 600].forEach(function (x) { rect(ctx, x, 140, 70, 26, ink); rect(ctx, x - 6, 182, 82, 14, mid); });
    // 名字與簡介
    rect(ctx, 36, 280, 200, 20, ink);
    rect(ctx, 36, 318, 420, 14, mid); rect(ctx, 36, 344, 360, 14, mid);
    // 按鈕
    ctx.strokeStyle = soft; ctx.lineWidth = 2;
    ctx.strokeRect(36, 384, 340, 50); ctx.strokeRect(392, 384, 340, 50);
    // 精選動態
    for (var i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.arc(80 + i * 128, 480, 38, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = EARTH[i * 2 % EARTH.length]; ctx.beginPath(); ctx.arc(80 + i * 128, 480, 31, 0, Math.PI * 2); ctx.fill();
    }
    // 分頁線
    rect(ctx, 0, DEMO_HEAD - 14, W, 2, soft); rect(ctx, 0, DEMO_HEAD - 16, W / 3, 4, ink);
    // 九宮格
    cells.forEach(function (cell, k) {
      var col = k % 3, row = Math.floor(k / 3);
      drawCell(ctx, col * (cw + gap), DEMO_HEAD + row * (ch + gap), cw, ch, cell);
    });
    return { url: cv.toDataURL('image/png'), width: W, height: H };
  }

  /* 從主頁截圖裁出既有貼文（第 5 步九宮格預覽用）。
   * img：已載入的 HTMLImageElement；grid：GridDetect 的結果（只取真的有貼文、看得到大半的格子）。
   * 每格置中裁成 4:5，輸出 216×270。 */
  function cropExistingCells(img, grid, count) {
    var out = [];
    if (!grid || !grid.cells) return out;
    grid.cells.filter(function (c) { return c.hasPost && c.visible >= 0.6; }).slice(0, count).forEach(function (c) {
      var top = Math.max(0, c.y), bot = Math.min(img.naturalHeight, c.y + c.h * c.visible);
      var w = c.w, h = bot - top, sx = c.x, sy = top;
      if (w / h > 0.8) { var nw = h * 0.8; sx += (w - nw) / 2; w = nw; } else { var nh = w / 0.8; sy += (h - nh) / 2; h = nh; }
      var cv = document.createElement('canvas');
      cv.width = 216; cv.height = 270;
      cv.getContext('2d').drawImage(img, sx, sy, w, h, 0, 0, 216, 270);
      out.push(cv.toDataURL('image/jpeg', 0.85));
    });
    return out;
  }

  window.Grid = {
    EARTH: EARTH,
    MINI: MINI,
    DEMO_PROFILE: DEMO_PROFILE,
    BEFORE: BEFORE,
    afterCells: afterCells,
    cellHTML: cellHTML,
    gridHTML: gridHTML,
    drawCell: drawCell,
    makeDemoScreenshot: makeDemoScreenshot,
    cropExistingCells: cropExistingCells,
    mix: mix
  };
})();
