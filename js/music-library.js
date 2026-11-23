/*
 * music-library.js — 內建歌單（配樂推薦用）
 * ------------------------------------------------------------
 * 只收「非常確定存在」的知名曲目與正確歌手；依知識整理，未上網逐首核對。
 * 留格不會、也不能把歌加進 IG：這裡只負責「推薦」，使用者到 IG App 加音樂時自己搜尋。
 *
 * 欄位：
 *   id      唯一代號
 *   t       歌名（保留原文）
 *   a       歌手（中文慣用名）
 *   g       曲風（見 GENRES）
 *   temp    'warm' 暖 | 'cool' 冷
 *   light   'bright' 亮 | 'dark' 暗
 *   pace    'up' 輕快 | 'slow' 慢
 *   part    建議起始段落：前奏／主歌／副歌／橋段
 *   youtubeId / ytNote / startSec  試聽用（第三輪，見檔案最後）
 */
(function () {
  'use strict';

  var GENRES = ['華語抒情', '獨立樂團', 'R&B', '爵士', 'Lo-fi', '日系', '韓系', '純音樂', '民謠', '電子'];

  function s(id, t, a, g, temp, light, pace, part) {
    return { id: id, t: t, a: a, g: g, temp: temp, light: light, pace: pace, part: part };
  }

  var SONGS = [
    // 華語抒情
    s('jay-qingtian', '晴天', '周杰倫', '華語抒情', 'warm', 'bright', 'slow', '前奏'),
    s('jay-daoxiang', '稻香', '周杰倫', '華語抒情', 'warm', 'bright', 'up', '副歌'),
    s('jay-qilixiang', '七里香', '周杰倫', '華語抒情', 'warm', 'bright', 'slow', '副歌'),
    s('eason-shinian', '十年', '陳奕迅', '華語抒情', 'cool', 'dark', 'slow', '副歌'),
    s('eason-haojiu', '好久不見', '陳奕迅', '華語抒情', 'cool', 'dark', 'slow', '主歌'),
    s('jj-jiangnan', '江南', '林俊傑', '華語抒情', 'warm', 'bright', 'slow', '副歌'),
    s('faye-hongdou', '紅豆', '王菲', '華語抒情', 'warm', 'dark', 'slow', '主歌'),
    s('stefanie-yujian', '遇見', '孫燕姿', '華語抒情', 'cool', 'bright', 'slow', '副歌'),
    s('hebe-xiaoxingyun', '小幸運', '田馥甄', '華語抒情', 'warm', 'bright', 'slow', '副歌'),
    s('gem-guangnian', '光年之外', '鄧紫棋', '華語抒情', 'cool', 'dark', 'slow', '副歌'),
    s('amei-tinghai', '聽海', '張惠妹', '華語抒情', 'cool', 'dark', 'slow', '副歌'),
    s('fish-yongqi', '勇氣', '梁靜茹', '華語抒情', 'warm', 'bright', 'slow', '副歌'),
    s('tanya-hongse', '紅色高跟鞋', '蔡健雅', '華語抒情', 'warm', 'bright', 'up', '副歌'),
    s('jonathan-shanqiu', '山丘', '李宗盛', '華語抒情', 'warm', 'dark', 'slow', '主歌'),
    s('maobuyi-xiaochou', '消愁', '毛不易', '華語抒情', 'warm', 'dark', 'slow', '主歌'),
    s('leehom-weiyi', '唯一', '王力宏', 'R&B', 'warm', 'dark', 'slow', '副歌'),

    // 獨立樂團
    s('mayday-wenrou', '溫柔', '五月天', '華語抒情', 'warm', 'dark', 'slow', '副歌'),
    s('mayday-juejiang', '倔強', '五月天', '華語抒情', 'warm', 'bright', 'up', '副歌'),
    s('accusefive-airen', '愛人錯過', '告五人', '獨立樂團', 'warm', 'bright', 'up', '副歌'),
    s('sunsetrollercoaster-myjinji', 'My Jinji', '落日飛車', '獨立樂團', 'warm', 'dark', 'slow', '前奏'),
    s('nopartyforcaodong-dafengchui', '大風吹', '草東沒有派對', '獨立樂團', 'cool', 'dark', 'up', '主歌'),
    s('sodagreen-xiaoqingge', '小情歌', '蘇打綠', '獨立樂團', 'warm', 'bright', 'slow', '副歌'),
    s('decajoins-hailang', '海浪', 'deca joins', '獨立樂團', 'cool', 'dark', 'slow', '前奏'),
    s('macdemarco-chamber', 'Chamber of Reflection', 'Mac DeMarco', 'Lo-fi', 'cool', 'dark', 'slow', '前奏'),

    // 民謠
    s('cheer-lvxing', '旅行的意義', '陳綺貞', '民謠', 'warm', 'bright', 'slow', '主歌'),
    s('songdongye-dongxiaojie', '董小姐', '宋冬野', '民謠', 'warm', 'dark', 'slow', '主歌'),
    s('zhaolei-chengdu', '成都', '趙雷', '民謠', 'warm', 'dark', 'slow', '副歌'),
    s('lijian-beijiaer', '貝加爾湖畔', '李健', '民謠', 'cool', 'bright', 'slow', '主歌'),
    s('crowdlu-yuzai', '魚仔', '盧廣仲', '民謠', 'warm', 'bright', 'slow', '主歌'),
    s('crowdlu-100', '100種生活', '盧廣仲', '民謠', 'warm', 'bright', 'up', '副歌'),
    s('damienrice-blowers', "The Blower's Daughter", 'Damien Rice', '民謠', 'cool', 'dark', 'slow', '主歌'),
    s('boniver-skinnylove', 'Skinny Love', 'Bon Iver', '民謠', 'cool', 'dark', 'slow', '主歌'),
    s('lumineers-hohey', 'Ho Hey', 'The Lumineers', '民謠', 'warm', 'bright', 'up', '副歌'),
    s('vancejoy-riptide', 'Riptide', 'Vance Joy', '民謠', 'warm', 'bright', 'up', '副歌'),
    s('simongarfunkel-silence', 'The Sound of Silence', 'Simon & Garfunkel', '民謠', 'cool', 'dark', 'slow', '主歌'),

    // R&B
    s('khalil-tebie', '特別的人', '方大同', 'R&B', 'warm', 'bright', 'slow', '副歌'),
    s('david-aihenjiandan', '愛很簡單', '陶喆', 'R&B', 'warm', 'bright', 'slow', '副歌'),
    s('frankocean-thinkin', 'Thinkin Bout You', 'Frank Ocean', 'R&B', 'cool', 'dark', 'slow', '副歌'),
    s('danielcaesar-bestpart', 'Best Part', 'Daniel Caesar', 'R&B', 'warm', 'dark', 'slow', '主歌'),
    s('sza-gooddays', 'Good Days', 'SZA', 'R&B', 'warm', 'bright', 'slow', '副歌'),
    s('lauv-ilikeme', 'I Like Me Better', 'Lauv', 'R&B', 'warm', 'bright', 'up', '副歌'),
    s('joji-slowdancing', 'Slow Dancing in the Dark', 'Joji', 'Lo-fi', 'cool', 'dark', 'slow', '副歌'),

    // 爵士
    s('norah-dontknowwhy', "Don't Know Why", 'Norah Jones', '爵士', 'warm', 'bright', 'slow', '主歌'),
    s('chet-funnyvalentine', 'My Funny Valentine', 'Chet Baker', '爵士', 'warm', 'dark', 'slow', '主歌'),
    s('sinatra-flyme', 'Fly Me to the Moon', 'Frank Sinatra', '爵士', 'warm', 'bright', 'up', '主歌'),
    s('armstrong-wonderful', 'What a Wonderful World', 'Louis Armstrong', '爵士', 'warm', 'bright', 'slow', '主歌'),
    s('billevans-debby', 'Waltz for Debby', 'Bill Evans', '爵士', 'cool', 'bright', 'slow', '前奏'),
    s('brubeck-takefive', 'Take Five', 'Dave Brubeck Quartet', '爵士', 'cool', 'dark', 'up', '前奏'),
    s('miles-sowhat', 'So What', 'Miles Davis', '爵士', 'cool', 'dark', 'slow', '前奏'),

    // Lo-fi
    s('nujabes-aruarian', 'Aruarian Dance', 'Nujabes', 'Lo-fi', 'warm', 'dark', 'slow', '前奏'),
    s('nujabes-feather', 'Feather', 'Nujabes', 'Lo-fi', 'warm', 'bright', 'slow', '前奏'),
    s('tommisch-south', 'South of the River', 'Tom Misch', 'Lo-fi', 'warm', 'bright', 'up', '前奏'),
    s('clairo-prettygirl', 'Pretty Girl', 'Clairo', 'Lo-fi', 'cool', 'bright', 'slow', '主歌'),

    // 日系
    s('utada-firstlove', 'First Love', '宇多田光', '日系', 'cool', 'bright', 'slow', '副歌'),
    s('mariya-plasticlove', 'Plastic Love', '竹內瑪莉亞', '日系', 'warm', 'dark', 'up', '前奏'),
    s('yonezu-lemon', 'Lemon', '米津玄師', '日系', 'cool', 'dark', 'slow', '副歌'),
    s('yoasobi-yorunikakeru', '夜に駆ける', 'YOASOBI', '日系', 'cool', 'dark', 'up', '副歌'),
    s('fujiikaze-shinunoga', '死ぬのがいいわ', '藤井風', '日系', 'warm', 'dark', 'slow', '副歌'),
    s('radwimps-zenzenzense', '前前前世', 'RADWIMPS', '日系', 'warm', 'bright', 'up', '副歌'),
    s('mika-yukinohana', '雪の華', '中島美嘉', '日系', 'cool', 'bright', 'slow', '副歌'),
    s('kinggnu-hakujitsu', '白日', 'King Gnu', '日系', 'cool', 'dark', 'slow', '主歌'),
    s('miki-mayonaka', '真夜中のドア〜stay with me', '松原みき', '日系', 'warm', 'dark', 'up', '副歌'),

    // 韓系
    s('iu-blueming', 'Blueming', 'IU', '韓系', 'warm', 'bright', 'up', '副歌'),
    s('iu-bampyeonji', '밤편지（夜信）', 'IU', '韓系', 'warm', 'dark', 'slow', '主歌'),
    s('bts-springday', 'Spring Day', 'BTS', '韓系', 'cool', 'bright', 'slow', '副歌'),
    s('newjeans-ditto', 'Ditto', 'NewJeans', '韓系', 'cool', 'bright', 'slow', '副歌'),
    s('crush-beautiful', 'Beautiful', 'Crush', '韓系', 'warm', 'bright', 'slow', '副歌'),
    s('dean-instagram', 'instagram', 'DEAN', '韓系', 'cool', 'dark', 'slow', '主歌'),
    s('ziont-yanghwa', '양화대교（楊花大橋）', 'Zion.T', '韓系', 'warm', 'dark', 'slow', '副歌'),
    s('akmu-heartbreak', "How can I love the heartbreak, you're the one I love", 'AKMU', '韓系', 'cool', 'dark', 'slow', '副歌'),

    // 純音樂
    s('sakamoto-mclawrence', 'Merry Christmas Mr. Lawrence', '坂本龍一', '純音樂', 'cool', 'bright', 'slow', '前奏'),
    s('sakamoto-energyflow', 'Energy Flow', '坂本龍一', '純音樂', 'cool', 'bright', 'slow', '前奏'),
    s('hisaishi-summer', 'Summer', '久石讓', '純音樂', 'warm', 'bright', 'up', '前奏'),
    s('einaudi-nuvole', 'Nuvole Bianche', 'Ludovico Einaudi', '純音樂', 'cool', 'bright', 'slow', '前奏'),
    s('yiruma-river', 'River Flows in You', 'Yiruma', '純音樂', 'warm', 'bright', 'slow', '前奏'),
    s('richter-daylight', 'On the Nature of Daylight', 'Max Richter', '純音樂', 'cool', 'dark', 'slow', '前奏'),
    s('satie-gymnopedie', 'Gymnopédie No.1', 'Erik Satie', '純音樂', 'cool', 'bright', 'slow', '前奏'),

    // 電子
    s('daftpunk-digitallove', 'Digital Love', 'Daft Punk', '電子', 'warm', 'bright', 'up', '前奏'),
    s('odesza-momentapart', 'A Moment Apart', 'ODESZA', '電子', 'cool', 'bright', 'up', '前奏'),
    s('porter-shelter', 'Shelter', 'Porter Robinson & Madeon', '電子', 'warm', 'bright', 'up', '副歌'),
    s('bonobo-kerala', 'Kerala', 'Bonobo', '電子', 'cool', 'dark', 'up', '前奏'),
    s('flume-neverbe', 'Never Be Like You', 'Flume', '電子', 'cool', 'dark', 'slow', '副歌'),
    s('disclosure-latch', 'Latch', 'Disclosure', '電子', 'cool', 'dark', 'up', '副歌'),
    s('tycho-awake', 'Awake', 'Tycho', '電子', 'cool', 'bright', 'up', '前奏'),
    s('weeknd-blinding', 'Blinding Lights', 'The Weeknd', '電子', 'cool', 'dark', 'up', '前奏')
  ];


  /* ---------- 第三輪：試聽 ----------
   * YT：YouTube 影片 ID，由執行方以腳本查詢並驗證（tools/music-lookup/verified.json），這裡原樣寫入，不可自行修改或補上。
   *     null ＝ 查不到可驗證的官方版本（只用 Apple 試聽備援）。
   * YT_NOTE：該影片不是錄音室 MV 時的說明（Live、節目版…）。
   * START：建議起始秒數，依 part（前奏／主歌／副歌／橋段）與對曲子結構的印象「人工估計」，可能不精準；畫面上會註明。 */
  var YT = {
    'jay-qingtian': 'DYptgVvkVLQ',
    'jay-daoxiang': 'sHD_z90ZKV0',
    'jay-qilixiang': 'Bbp9ZaJD_eA',
    'eason-shinian': 'JM9rx_hN1Ko',
    'eason-haojiu': 'wTIcC-OF3mk',
    'jj-jiangnan': 'G97_rOdHcnY',
    'faye-hongdou': '5wmfXve11rM',
    'stefanie-yujian': 'm4nu_F_9dWU',
    'hebe-xiaoxingyun': 'YD9r_tTtlaA',
    'gem-guangnian': 'T4SimnaiktU',
    'amei-tinghai': 'mLk61pfiHQ0',
    'fish-yongqi': 'wUh9-E6KncA',
    'tanya-hongse': 'fKcxM0kWqWc',
    'jonathan-shanqiu': 'VLR8raUcujA',
    'maobuyi-xiaochou': '9C3Nd5dRin8',
    'leehom-weiyi': 'P7Qv4AV_StM',
    'mayday-wenrou': 'nWb_X3ZJQjw',
    'mayday-juejiang': '3BdT5vWbUa0',
    'accusefive-airen': '6D79CYTxvOM',
    'sunsetrollercoaster-myjinji': '5xwFCtDc0fI',
    'nopartyforcaodong-dafengchui': 'HqmpIQ9l-uA',
    'sodagreen-xiaoqingge': 'in8NNzwFa-s',
    'decajoins-hailang': 'FonjL7DQAUQ',
    'macdemarco-chamber': 'kz9jhG963no',
    'cheer-lvxing': '0ZUo_HhB564',
    'songdongye-dongxiaojie': null,
    'zhaolei-chengdu': 'EPyFeQcDSUY',
    'lijian-beijiaer': 'G6ZS7ho5PXM',
    'crowdlu-yuzai': 'ybfWYpYhTQQ',
    'crowdlu-100': 'nPcByqGfxQo',
    'damienrice-blowers': '5YXVMCHG-Nk',
    'boniver-skinnylove': '95FyXUHv8hk',
    'lumineers-hohey': 'zvCBSSwgtg4',
    'vancejoy-riptide': 'TL_oroU9eN8',
    'simongarfunkel-silence': 'NAEppFUWLfc',
    'khalil-tebie': 'IscPlLsh6iU',
    'david-aihenjiandan': 't_eqS5mQp3U',
    'frankocean-thinkin': '6JHu3b-pbh8',
    'danielcaesar-bestpart': 'hKgl5-lkT8U',
    'sza-gooddays': '2p3zZoraK9g',
    'lauv-ilikeme': 'BcqxLCWn-CE',
    'joji-slowdancing': 'LUXu4aTnK7E',
    'norah-dontknowwhy': 'tO4dxvguQDk',
    'chet-funnyvalentine': 'QuMzUXPEPRM',
    'sinatra-flyme': 'JYuyWrkwpok',
    'armstrong-wonderful': 'rBrd_3VMC3c',
    'billevans-debby': 'wCINvavqFXk',
    'brubeck-takefive': '-DHuW1h1wHw',
    'miles-sowhat': 'zqNTltOGh5c',
    'nujabes-aruarian': 'qYcoJpqCha4',
    'nujabes-feather': 'hQ5x8pHoIPA',
    'tommisch-south': 'nEJk2FJJ18c',
    'clairo-prettygirl': 'mngtcfcaVrI',
    'utada-firstlove': 'o1sUaVJUeB0',
    'mariya-plasticlove': 'T_lC2O1oIew',
    'yonezu-lemon': 'SX_ViT4Ra7k',
    'yoasobi-yorunikakeru': 'x8VYWazR5mE',
    'fujiikaze-shinunoga': 'dawrQnvwMTY',
    'radwimps-zenzenzense': 'PDSkFeMVNFs',
    'mika-yukinohana': 'mF5Qq2YheTg',
    'kinggnu-hakujitsu': 'ony539T074w',
    'miki-mayonaka': 'nRmlLrI0OVk',
    'iu-blueming': 'D1PvIWdJ8xo',
    'iu-bampyeonji': '6744glqD6lk',
    'bts-springday': 'xEeFrLSkMm8',
    'newjeans-ditto': 'pSUydWEqKwE',
    'crush-beautiful': 'W0cs6ciCt_k',
    'dean-instagram': 'wKyMIrBClYw',
    'ziont-yanghwa': 'uLUvHUzd4UA',
    'akmu-heartbreak': 'm3DZsBw5bnE',
    'sakamoto-mclawrence': 'ELJf83TelA0',
    'sakamoto-energyflow': 'z45xGGTo3J0',
    'hisaishi-summer': 'd926ZOS84VA',
    'einaudi-nuvole': 'sR2W2scFS4Y',
    'yiruma-river': '7maJOI3QMu0',
    'richter-daylight': 'InyT9Gyoz_o',
    'satie-gymnopedie': 'TL0xzp4zzBE',
    'daftpunk-digitallove': 'FxzBvqY5PP0',
    'odesza-momentapart': 'xarC5jAiO7w',
    'porter-shelter': 'HQnC1UHBvWA',
    'bonobo-kerala': 'S0Q4gqBUs7c',
    'flume-neverbe': '-KPnyf8vwXI',
    'disclosure-latch': '93ASUImTedo',
    'tycho-awake': 'W8VdVY8diqs',
    'weeknd-blinding': '4NRXx6U8ABQ'
  };
  var YT_NOTE = {
    'fish-yongqi': 'Live 版（20 週年）',
    'david-aihenjiandan': 'Live 版',
    'simongarfunkel-silence': 'Live 版（Central Park）',
    'lijian-beijiaer': '節目版（我是歌手 3）',
    'sakamoto-mclawrence': '鋼琴獨奏版（2022）'
  };
  var START = {
    'jay-qingtian': 8,
    'jay-daoxiang': 75,
    'jay-qilixiang': 68,
    'eason-shinian': 65,
    'eason-haojiu': 18,
    'jj-jiangnan': 75,
    'faye-hongdou': 20,
    'stefanie-yujian': 62,
    'hebe-xiaoxingyun': 95,
    'gem-guangnian': 70,
    'amei-tinghai': 95,
    'fish-yongqi': 80,
    'tanya-hongse': 62,
    'jonathan-shanqiu': 30,
    'maobuyi-xiaochou': 22,
    'leehom-weiyi': 80,
    'mayday-wenrou': 85,
    'mayday-juejiang': 62,
    'accusefive-airen': 52,
    'sunsetrollercoaster-myjinji': 5,
    'nopartyforcaodong-dafengchui': 20,
    'sodagreen-xiaoqingge': 58,
    'decajoins-hailang': 3,
    'macdemarco-chamber': 2,
    'cheer-lvxing': 18,
    'songdongye-dongxiaojie': 20,
    'zhaolei-chengdu': 75,
    'lijian-beijiaer': 20,
    'crowdlu-yuzai': 20,
    'crowdlu-100': 55,
    'damienrice-blowers': 25,
    'boniver-skinnylove': 8,
    'lumineers-hohey': 40,
    'vancejoy-riptide': 48,
    'simongarfunkel-silence': 15,
    'khalil-tebie': 65,
    'david-aihenjiandan': 70,
    'frankocean-thinkin': 50,
    'danielcaesar-bestpart': 10,
    'sza-gooddays': 45,
    'lauv-ilikeme': 30,
    'joji-slowdancing': 55,
    'norah-dontknowwhy': 15,
    'chet-funnyvalentine': 10,
    'sinatra-flyme': 5,
    'armstrong-wonderful': 8,
    'billevans-debby': 2,
    'brubeck-takefive': 0,
    'miles-sowhat': 0,
    'nujabes-aruarian': 0,
    'nujabes-feather': 0,
    'tommisch-south': 3,
    'clairo-prettygirl': 10,
    'utada-firstlove': 70,
    'mariya-plasticlove': 5,
    'yonezu-lemon': 2,
    'yoasobi-yorunikakeru': 62,
    'fujiikaze-shinunoga': 58,
    'radwimps-zenzenzense': 42,
    'mika-yukinohana': 78,
    'kinggnu-hakujitsu': 2,
    'miki-mayonaka': 62,
    'iu-blueming': 48,
    'iu-bampyeonji': 15,
    'bts-springday': 70,
    'newjeans-ditto': 55,
    'crush-beautiful': 60,
    'dean-instagram': 15,
    'ziont-yanghwa': 70,
    'akmu-heartbreak': 60,
    'sakamoto-mclawrence': 3,
    'sakamoto-energyflow': 2,
    'hisaishi-summer': 0,
    'einaudi-nuvole': 0,
    'yiruma-river': 0,
    'richter-daylight': 0,
    'satie-gymnopedie': 0,
    'daftpunk-digitallove': 0,
    'odesza-momentapart': 0,
    'porter-shelter': 90,
    'bonobo-kerala': 0,
    'flume-neverbe': 50,
    'disclosure-latch': 45,
    'tycho-awake': 0,
    'weeknd-blinding': 15
  };
  SONGS.forEach(function (x) {
    x.youtubeId = YT.hasOwnProperty(x.id) ? YT[x.id] : null;
    if (YT_NOTE[x.id]) x.ytNote = YT_NOTE[x.id];
    x.startSec = START[x.id] || 0;
  });

  window.MusicLibrary = { GENRES: GENRES, SONGS: SONGS };
})();
