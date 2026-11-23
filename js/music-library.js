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
 *   part    建議起始段落：前奏／主歌／副歌／橋段（只寫通用段落名稱，不寫秒數）
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

  window.MusicLibrary = { GENRES: GENRES, SONGS: SONGS };
})();
