/*
 * editor.js — 第 5 步「整理新照片」的 canvas 處理（全部在瀏覽器本地完成）
 * ------------------------------------------------------------
 * 不呼叫任何 AI、不送出網路。功能：
 *   - 讀檔並縮到長邊 2400px 以內（效能）
 *   - 裁成 4:5（平移＋縮放）
 *   - 微調水平（−10°～+10°），旋轉後自動放大避免黑邊
 *   - 亮度／對比／色溫（逐像素運算，真的改變輸出）
 *   - 輸出 1080×1350 JPEG（quality 0.92）；逐張下載，或用 vendor/jszip.min.js 打包成 zip
 */
(function () {
  'use strict';

  var MAX_SIDE = 2400;
  var RATIO = 4 / 5; // 寬 / 高
  var uid = 0;

  function defaults() {
    return { rotate: 0, zoom: 1, panX: 0, panY: 0, brightness: 0, contrast: 0, temperature: 0 };
  }

  /** 讀入一個 File，回傳 Promise<Photo> */
  function loadFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var s = Math.min(1, MAX_SIDE / Math.max(w, h));
        var src = img;
        if (s < 1) {
          var cv = document.createElement('canvas');
          cv.width = Math.round(w * s); cv.height = Math.round(h * s);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          src = cv; w = cv.width; h = cv.height;
        }
        URL.revokeObjectURL(url);
        var p = defaults();
        p.id = 'p' + (++uid);
        p.name = file.name || ('photo-' + uid);
        p.src = src; p.w = w; p.h = h;
        resolve(p);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('無法讀取：' + file.name)); };
      img.src = url;
    });
  }

  /* 計算目前設定下，影像要畫多大、能平移多少 */
  function geometry(p, W, H) {
    var th = p.rotate * Math.PI / 180;
    var cos = Math.abs(Math.cos(th)), sin = Math.abs(Math.sin(th));
    // 旋轉後的輸出框，在影像座標中需要的外接尺寸 → 確保四角都落在影像內（不出現黑邊）
    var needW = W * cos + H * sin;
    var needH = W * sin + H * cos;
    var s0 = Math.max(needW / p.w, needH / p.h);
    var s = s0 * p.zoom;
    var slackX = Math.max(0, (p.w * s - needW) / 2);
    var slackY = Math.max(0, (p.h * s - needH) / 2);
    return { th: th, s: s, slackX: slackX, slackY: slackY };
  }

  /* 逐像素調整：亮度、對比、色溫（−50～+50） */
  function adjustPixels(ctx, W, H, p) {
    if (!p.brightness && !p.contrast && !p.temperature) return;
    var img = ctx.getImageData(0, 0, W, H);
    var d = img.data;
    var b = p.brightness * 1.6;                  // 亮度：加減
    var c = p.contrast * 2.2;                    // 對比：標準對比公式
    var f = (259 * (c + 255)) / (255 * (259 - c));
    var t = p.temperature;                       // 色溫：+ 暖（R↑ B↓），− 冷
    var rT = t * 0.9, gT = t * 0.18, bT = -t * 0.9;
    for (var i = 0; i < d.length; i += 4) {
      var r = d[i] + b, g = d[i + 1] + b, bl = d[i + 2] + b;
      r = f * (r - 128) + 128; g = f * (g - 128) + 128; bl = f * (bl - 128) + 128;
      d[i] = r + rT; d[i + 1] = g + gT; d[i + 2] = bl + bT; // Uint8ClampedArray 會自動夾在 0–255
    }
    ctx.putImageData(img, 0, 0);
  }

  /** 把照片依設定畫進 canvas（寬高為 4:5） */
  function render(p, canvas, W, H) {
    W = W || canvas.width; H = H || canvas.height;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var g = geometry(p, W, H);
    ctx.save();
    ctx.fillStyle = '#EEE8DF';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(W / 2, H / 2);
    ctx.rotate(g.th);
    var dw = p.w * g.s, dh = p.h * g.s;
    ctx.drawImage(p.src, -dw / 2 + p.panX * g.slackX, -dh / 2 + p.panY * g.slackY, dw, dh);
    ctx.restore();
    adjustPixels(ctx, W, H, p);
    return canvas;
  }

  /** 拖曳平移：dx, dy 為畫面像素位移，viewW 為預覽寬度 */
  function pan(p, dx, dy, viewW) {
    var W = viewW, H = viewW / RATIO;
    var g = geometry(p, W, H);
    // 把螢幕方向的位移轉回影像座標（考慮旋轉）
    var cos = Math.cos(-g.th), sin = Math.sin(-g.th);
    var ix = dx * cos - dy * sin, iy = dx * sin + dy * cos;
    if (g.slackX > 0) p.panX = clamp(p.panX + ix / g.slackX, -1, 1);
    if (g.slackY > 0) p.panY = clamp(p.panY + iy / g.slackY, -1, 1);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /** 輸出 1080×1350 JPEG Blob */
  function exportJPEG(p) {
    var cv = document.createElement('canvas');
    render(p, cv, 1080, 1350);
    return new Promise(function (resolve) { cv.toBlob(resolve, 'image/jpeg', 0.92); });
  }

  /** 逐一觸發下載 01.jpg、02.jpg…（不打包、不依賴網路） */
  function downloadAll(photos, onProgress) {
    var i = 0;
    function next() {
      if (i >= photos.length) return Promise.resolve(photos.length);
      var p = photos[i];
      return exportJPEG(p).then(function (blob) {
        var a = document.createElement('a');
        var name = (i + 1 < 10 ? '0' : '') + (i + 1) + '.jpg';
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        i++;
        if (onProgress) onProgress(i, photos.length);
        return new Promise(function (r) { setTimeout(r, 320); }).then(next);
      });
    }
    return next();
  }

  /** 檔名用日期：留格_YYYYMMDD.zip */
  function zipName(d) {
    d = d || new Date();
    return '留格_' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.zip';
  }

  /**
   * 打包成一個 zip：內含 01.jpg、02.jpg…（依目前順序）。
   * 用 vendor/jszip.min.js（MIT，本地檔、不連網路）；JPEG 已壓縮，所以用 STORE 不再壓縮，速度最快。
   * @returns Promise<{ blob, name, count }>
   */
  function buildZip(photos, onProgress) {
    if (!window.JSZip) return Promise.reject(new Error('找不到 JSZip'));
    var zip = new window.JSZip(), i = 0;
    function next() {
      if (i >= photos.length) {
        return zip.generateAsync({ type: 'blob', compression: 'STORE', mimeType: 'application/zip' })
          .then(function (blob) { return { blob: blob, name: zipName(), count: photos.length }; });
      }
      var p = photos[i];
      return exportJPEG(p).then(function (blob) {
        zip.file((i + 1 < 10 ? '0' : '') + (i + 1) + '.jpg', blob, { binary: true, date: new Date() });
        i++;
        if (onProgress) onProgress(i, photos.length);
        return next();
      });
    }
    return next();
  }

  function downloadZip(photos, onProgress) {
    return buildZip(photos, onProgress).then(function (z) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(z.blob);
      a.download = z.name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return z;
    });
  }

  function copyTone(from, list) {
    list.forEach(function (p) {
      p.brightness = from.brightness; p.contrast = from.contrast; p.temperature = from.temperature;
    });
  }

  window.Editor = {
    RATIO: RATIO,
    defaults: defaults,
    loadFile: loadFile,
    render: render,
    pan: pan,
    exportJPEG: exportJPEG,
    downloadAll: downloadAll,
    buildZip: buildZip,
    downloadZip: downloadZip,
    zipName: zipName,
    copyTone: copyTone
  };
})();
