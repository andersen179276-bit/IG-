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
 *   lang    歌詞語言（第五輪）：'zh' 純中文（華語）| 'en' 純英文 | 'mix' 中英混合 | 'ja' | 'ko' | 'inst' 純音樂／演奏
 *           「中文」只推 zh、「英文」只推 en；mix／ja／ko／inst 只出現在「全部」。判斷規則見 REVIEW.md 第五輪。
 *           不確定是否夾英文句子的華語歌保守標 mix（寧可少推，不推錯）。
 *   youtubeId / ytNote / startSec / itunesPreview  試聽與外部連結用（見檔案最後）
 */
(function () {
  'use strict';

  var GENRES = ['華語抒情', '獨立樂團', 'R&B', '爵士', 'Lo-fi', '日系', '韓系', '純音樂', '民謠', '電子'];

  function s(id, t, a, g, temp, light, pace, part, lang) {
    return { id: id, t: t, a: a, g: g, temp: temp, light: light, pace: pace, part: part, lang: lang };
  }

  var SONGS = [
    // 華語抒情
    s('jay-qingtian', '晴天', '周杰倫', '華語抒情', 'warm', 'bright', 'slow', '前奏', 'zh'),
    s('jay-daoxiang', '稻香', '周杰倫', '華語抒情', 'warm', 'bright', 'up', '副歌', 'zh'),
    s('jay-qilixiang', '七里香', '周杰倫', '華語抒情', 'warm', 'bright', 'slow', '副歌', 'zh'),
    s('eason-shinian', '十年', '陳奕迅', '華語抒情', 'cool', 'dark', 'slow', '副歌', 'zh'),
    s('eason-haojiu', '好久不見', '陳奕迅', '華語抒情', 'cool', 'dark', 'slow', '主歌', 'zh'),
    s('jj-jiangnan', '江南', '林俊傑', '華語抒情', 'warm', 'bright', 'slow', '副歌', 'zh'),
    s('faye-hongdou', '紅豆', '王菲', '華語抒情', 'warm', 'dark', 'slow', '主歌', 'zh'),
    s('stefanie-yujian', '遇見', '孫燕姿', '華語抒情', 'cool', 'bright', 'slow', '副歌', 'zh'),
    s('hebe-xiaoxingyun', '小幸運', '田馥甄', '華語抒情', 'warm', 'bright', 'slow', '副歌', 'zh'),
    s('gem-guangnian', '光年之外', '鄧紫棋', '華語抒情', 'cool', 'dark', 'slow', '副歌', 'zh'),
    s('amei-tinghai', '聽海', '張惠妹', '華語抒情', 'cool', 'dark', 'slow', '副歌', 'zh'),
    s('fish-yongqi', '勇氣', '梁靜茹', '華語抒情', 'warm', 'bright', 'slow', '副歌', 'zh'),
    s('tanya-hongse', '紅色高跟鞋', '蔡健雅', '華語抒情', 'warm', 'bright', 'up', '副歌', 'zh'),
    s('jonathan-shanqiu', '山丘', '李宗盛', '華語抒情', 'warm', 'dark', 'slow', '主歌', 'zh'),
    s('maobuyi-xiaochou', '消愁', '毛不易', '華語抒情', 'warm', 'dark', 'slow', '主歌', 'zh'),
    s('leehom-weiyi', '唯一', '王力宏', 'R&B', 'warm', 'dark', 'slow', '副歌', 'zh'),

    // 獨立樂團
    s('mayday-wenrou', '溫柔', '五月天', '華語抒情', 'warm', 'dark', 'slow', '副歌', 'zh'),
    s('mayday-juejiang', '倔強', '五月天', '華語抒情', 'warm', 'bright', 'up', '副歌', 'zh'),
    s('accusefive-airen', '愛人錯過', '告五人', '獨立樂團', 'warm', 'bright', 'up', '副歌', 'zh'),
    s('sunsetrollercoaster-myjinji', 'My Jinji', '落日飛車', '獨立樂團', 'warm', 'dark', 'slow', '前奏', 'en'),
    s('nopartyforcaodong-dafengchui', '大風吹', '草東沒有派對', '獨立樂團', 'cool', 'dark', 'up', '主歌', 'zh'),
    s('sodagreen-xiaoqingge', '小情歌', '蘇打綠', '獨立樂團', 'warm', 'bright', 'slow', '副歌', 'zh'),
    s('decajoins-hailang', '海浪', 'deca joins', '獨立樂團', 'cool', 'dark', 'slow', '前奏', 'zh'),
    s('macdemarco-chamber', 'Chamber of Reflection', 'Mac DeMarco', 'Lo-fi', 'cool', 'dark', 'slow', '前奏', 'en'),

    // 民謠
    s('cheer-lvxing', '旅行的意義', '陳綺貞', '民謠', 'warm', 'bright', 'slow', '主歌', 'zh'),
    s('songdongye-dongxiaojie', '董小姐', '宋冬野', '民謠', 'warm', 'dark', 'slow', '主歌', 'zh'),
    s('zhaolei-chengdu', '成都', '趙雷', '民謠', 'warm', 'dark', 'slow', '副歌', 'zh'),
    s('lijian-beijiaer', '貝加爾湖畔', '李健', '民謠', 'cool', 'bright', 'slow', '主歌', 'zh'),
    s('crowdlu-yuzai', '魚仔', '盧廣仲', '民謠', 'warm', 'bright', 'slow', '主歌', 'zh'),
    s('crowdlu-100', '100種生活', '盧廣仲', '民謠', 'warm', 'bright', 'up', '副歌', 'zh'),
    s('damienrice-blowers', "The Blower's Daughter", 'Damien Rice', '民謠', 'cool', 'dark', 'slow', '主歌', 'en'),
    s('boniver-skinnylove', 'Skinny Love', 'Bon Iver', '民謠', 'cool', 'dark', 'slow', '主歌', 'en'),
    s('lumineers-hohey', 'Ho Hey', 'The Lumineers', '民謠', 'warm', 'bright', 'up', '副歌', 'en'),
    s('vancejoy-riptide', 'Riptide', 'Vance Joy', '民謠', 'warm', 'bright', 'up', '副歌', 'en'),
    s('simongarfunkel-silence', 'The Sound of Silence', 'Simon & Garfunkel', '民謠', 'cool', 'dark', 'slow', '主歌', 'en'),

    // R&B
    s('khalil-tebie', '特別的人', '方大同', 'R&B', 'warm', 'bright', 'slow', '副歌', 'mix'),
    s('david-aihenjiandan', '愛很簡單', '陶喆', 'R&B', 'warm', 'bright', 'slow', '副歌', 'mix'),
    s('frankocean-thinkin', 'Thinkin Bout You', 'Frank Ocean', 'R&B', 'cool', 'dark', 'slow', '副歌', 'en'),
    s('danielcaesar-bestpart', 'Best Part', 'Daniel Caesar', 'R&B', 'warm', 'dark', 'slow', '主歌', 'en'),
    s('sza-gooddays', 'Good Days', 'SZA', 'R&B', 'warm', 'bright', 'slow', '副歌', 'en'),
    s('lauv-ilikeme', 'I Like Me Better', 'Lauv', 'R&B', 'warm', 'bright', 'up', '副歌', 'en'),
    s('joji-slowdancing', 'Slow Dancing in the Dark', 'Joji', 'Lo-fi', 'cool', 'dark', 'slow', '副歌', 'en'),

    // 爵士
    s('norah-dontknowwhy', "Don't Know Why", 'Norah Jones', '爵士', 'warm', 'bright', 'slow', '主歌', 'en'),
    s('chet-funnyvalentine', 'My Funny Valentine', 'Chet Baker', '爵士', 'warm', 'dark', 'slow', '主歌', 'en'),
    s('sinatra-flyme', 'Fly Me to the Moon', 'Frank Sinatra', '爵士', 'warm', 'bright', 'up', '主歌', 'en'),
    s('armstrong-wonderful', 'What a Wonderful World', 'Louis Armstrong', '爵士', 'warm', 'bright', 'slow', '主歌', 'en'),
    s('billevans-debby', 'Waltz for Debby', 'Bill Evans', '爵士', 'cool', 'bright', 'slow', '前奏', 'inst'),
    s('brubeck-takefive', 'Take Five', 'Dave Brubeck Quartet', '爵士', 'cool', 'dark', 'up', '前奏', 'inst'),
    s('miles-sowhat', 'So What', 'Miles Davis', '爵士', 'cool', 'dark', 'slow', '前奏', 'inst'),

    // Lo-fi
    s('nujabes-aruarian', 'Aruarian Dance', 'Nujabes', 'Lo-fi', 'warm', 'dark', 'slow', '前奏', 'inst'),
    s('nujabes-feather', 'Feather', 'Nujabes', 'Lo-fi', 'warm', 'bright', 'slow', '前奏', 'en'),
    s('tommisch-south', 'South of the River', 'Tom Misch', 'Lo-fi', 'warm', 'bright', 'up', '前奏', 'en'),
    s('clairo-prettygirl', 'Pretty Girl', 'Clairo', 'Lo-fi', 'cool', 'bright', 'slow', '主歌', 'en'),

    // 日系
    s('utada-firstlove', 'First Love', '宇多田光', '日系', 'cool', 'bright', 'slow', '副歌', 'ja'),
    s('mariya-plasticlove', 'Plastic Love', '竹內瑪莉亞', '日系', 'warm', 'dark', 'up', '前奏', 'ja'),
    s('yonezu-lemon', 'Lemon', '米津玄師', '日系', 'cool', 'dark', 'slow', '副歌', 'ja'),
    s('yoasobi-yorunikakeru', '夜に駆ける', 'YOASOBI', '日系', 'cool', 'dark', 'up', '副歌', 'ja'),
    s('fujiikaze-shinunoga', '死ぬのがいいわ', '藤井風', '日系', 'warm', 'dark', 'slow', '副歌', 'ja'),
    s('radwimps-zenzenzense', '前前前世', 'RADWIMPS', '日系', 'warm', 'bright', 'up', '副歌', 'ja'),
    s('mika-yukinohana', '雪の華', '中島美嘉', '日系', 'cool', 'bright', 'slow', '副歌', 'ja'),
    s('kinggnu-hakujitsu', '白日', 'King Gnu', '日系', 'cool', 'dark', 'slow', '主歌', 'ja'),
    s('miki-mayonaka', '真夜中のドア〜stay with me', '松原みき', '日系', 'warm', 'dark', 'up', '副歌', 'ja'),

    // 韓系
    s('iu-blueming', 'Blueming', 'IU', '韓系', 'warm', 'bright', 'up', '副歌', 'ko'),
    s('iu-bampyeonji', '밤편지（夜信）', 'IU', '韓系', 'warm', 'dark', 'slow', '主歌', 'ko'),
    s('bts-springday', 'Spring Day', 'BTS', '韓系', 'cool', 'bright', 'slow', '副歌', 'ko'),
    s('newjeans-ditto', 'Ditto', 'NewJeans', '韓系', 'cool', 'bright', 'slow', '副歌', 'ko'),
    s('crush-beautiful', 'Beautiful', 'Crush', '韓系', 'warm', 'bright', 'slow', '副歌', 'ko'),
    s('dean-instagram', 'instagram', 'DEAN', '韓系', 'cool', 'dark', 'slow', '主歌', 'ko'),
    s('ziont-yanghwa', '양화대교（楊花大橋）', 'Zion.T', '韓系', 'warm', 'dark', 'slow', '副歌', 'ko'),
    s('akmu-heartbreak', "How can I love the heartbreak, you're the one I love", 'AKMU', '韓系', 'cool', 'dark', 'slow', '副歌', 'ko'),

    // 純音樂
    s('sakamoto-mclawrence', 'Merry Christmas Mr. Lawrence', '坂本龍一', '純音樂', 'cool', 'bright', 'slow', '前奏', 'inst'),
    s('sakamoto-energyflow', 'Energy Flow', '坂本龍一', '純音樂', 'cool', 'bright', 'slow', '前奏', 'inst'),
    s('hisaishi-summer', 'Summer', '久石讓', '純音樂', 'warm', 'bright', 'up', '前奏', 'inst'),
    s('einaudi-nuvole', 'Nuvole Bianche', 'Ludovico Einaudi', '純音樂', 'cool', 'bright', 'slow', '前奏', 'inst'),
    s('yiruma-river', 'River Flows in You', 'Yiruma', '純音樂', 'warm', 'bright', 'slow', '前奏', 'inst'),
    s('richter-daylight', 'On the Nature of Daylight', 'Max Richter', '純音樂', 'cool', 'dark', 'slow', '前奏', 'inst'),
    s('satie-gymnopedie', 'Gymnopédie No.1', 'Erik Satie', '純音樂', 'cool', 'bright', 'slow', '前奏', 'inst'),

    // 電子
    s('daftpunk-digitallove', 'Digital Love', 'Daft Punk', '電子', 'warm', 'bright', 'up', '前奏', 'en'),
    s('odesza-momentapart', 'A Moment Apart', 'ODESZA', '電子', 'cool', 'bright', 'up', '前奏', 'inst'),
    s('porter-shelter', 'Shelter', 'Porter Robinson & Madeon', '電子', 'warm', 'bright', 'up', '副歌', 'en'),
    s('bonobo-kerala', 'Kerala', 'Bonobo', '電子', 'cool', 'dark', 'up', '前奏', 'inst'),
    s('flume-neverbe', 'Never Be Like You', 'Flume', '電子', 'cool', 'dark', 'slow', '副歌', 'en'),
    s('disclosure-latch', 'Latch', 'Disclosure', '電子', 'cool', 'dark', 'up', '副歌', 'en'),
    s('tycho-awake', 'Awake', 'Tycho', '電子', 'cool', 'bright', 'up', '前奏', 'inst'),
    s('weeknd-blinding', 'Blinding Lights', 'The Weeknd', '電子', 'cool', 'dark', 'up', '前奏', 'en'),

    // 英文補充（第五輪）：執行方以 iTunes 實際查過、確認有 Apple 30 秒試聽（tools/music-lookup/verified_english_additions.json）
    s('en-cigarettesafte-apocalypse', 'Apocalypse', 'Cigarettes After Sex', '獨立樂團', 'cool', 'dark', 'slow', '前奏', 'en'),
    s('en-phoebebridgers-motionsickness', 'Motion Sickness', 'Phoebe Bridgers', '獨立樂團', 'cool', 'bright', 'up', '副歌', 'en'),
    s('en-novoamor-anchor', 'Anchor', 'Novo Amor', '民謠', 'cool', 'dark', 'slow', '主歌', 'en'),
    s('en-sufjanstevens-mysteryoflove', 'Mystery of Love', 'Sufjan Stevens', '民謠', 'warm', 'bright', 'slow', '主歌', 'en'),
    s('en-ironwine-suchgreatheights', 'Such Great Heights', 'Iron & Wine', '民謠', 'warm', 'dark', 'slow', '主歌', 'en'),
    s('en-nickdrake-pinkmoon', 'Pink Moon', 'Nick Drake', '民謠', 'cool', 'dark', 'slow', '前奏', 'en'),
    s('en-agnesobel-riverside', 'Riverside', 'Agnes Obel', '民謠', 'cool', 'dark', 'slow', '前奏', 'en'),
    s('en-lanadelrey-videogames', 'Video Games', 'Lana Del Rey', '獨立樂團', 'cool', 'dark', 'slow', '副歌', 'en'),
    s('en-radiohead-nosurprises', 'No Surprises', 'Radiohead', '獨立樂團', 'cool', 'dark', 'slow', '主歌', 'en'),
    s('en-billieeilish-oceaneyes', 'Ocean Eyes', 'Billie Eilish', '獨立樂團', 'cool', 'dark', 'slow', '副歌', 'en'),
    s('en-norahjones-comeawaywithme', 'Come Away with Me', 'Norah Jones', '爵士', 'warm', 'dark', 'slow', '主歌', 'en'),
    s('en-jeffbuckley-hallelujah', 'Hallelujah', 'Jeff Buckley', '民謠', 'cool', 'dark', 'slow', '主歌', 'en'),
    s('en-mazzystar-fadeintoyou', 'Fade Into You', 'Mazzy Star', '獨立樂團', 'cool', 'dark', 'slow', '前奏', 'en'),
    s('en-lordhuron-thenightwemet', 'The Night We Met', 'Lord Huron', '民謠', 'cool', 'dark', 'slow', '前奏', 'en'),
    s('en-hozier-cherrywine', 'Cherry Wine', 'Hozier', '民謠', 'warm', 'dark', 'slow', '主歌', 'en'),
    s('en-damienrice-cannonball', 'Cannonball', 'Damien Rice', '民謠', 'warm', 'bright', 'slow', '主歌', 'en'),
    s('en-sufjanstevens-deathwithdignity', 'Death with Dignity', 'Sufjan Stevens', '民謠', 'cool', 'bright', 'slow', '前奏', 'en'),
    s('en-boniver-restacks', 'Re: Stacks', 'Bon Iver', '民謠', 'warm', 'dark', 'slow', '主歌', 'en'),
    s('en-lorde-liability', 'Liability', 'Lorde', '獨立樂團', 'cool', 'dark', 'slow', '主歌', 'en'),
    s('en-daughter-youth', 'Youth', 'Daughter', '獨立樂團', 'cool', 'dark', 'slow', '主歌', 'en'),
    s('en-stateless-bloodstream', 'Bloodstream', 'Stateless', '電子', 'cool', 'dark', 'slow', '副歌', 'en'),
    s('en-fleetwoodmac-landslide', 'Landslide', 'Fleetwood Mac', '民謠', 'warm', 'bright', 'slow', '主歌', 'en'),
    s('en-neilyoung-harvestmoon', 'Harvest Moon', 'Neil Young', '民謠', 'warm', 'dark', 'slow', '前奏', 'en')
  ];


  /* ---------- 試聽與外部連結 ----------
   * 第四輪起頁面內只播 Apple 試聽（js/preview.js），不嵌入 YouTube；youtubeId 只用來產生「到 YouTube 聽 ↗」外部連結。
   * YT：YouTube 影片 ID，由執行方以腳本查詢並驗證（tools/music-lookup/verified.json），這裡原樣寫入，不可自行修改或補上。
   *     null ＝ 查不到可驗證的官方版本 → 需要外部連結時改用「到 YouTube 搜尋 ↗」，不編造 ID。
   * YT_NOTE：該影片不是錄音室 MV 時的說明（Live、節目版…）。
   * START：外部連結的 t= 秒數，依 part（前奏／主歌／副歌／橋段）人工估計，可能不精準；畫面上標「從建議段落開始（人工估計）」。
   * NO_ITUNES：verified.json 中 itunesPreview=false 的歌（執行方實測 country=tw 查不到相符試聽），一開始就顯示外部連結。
   *     其餘皆為 itunesPreview=true。照 verified.json 寫入，不可自行判斷修改。 */
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
    'weeknd-blinding': '4NRXx6U8ABQ',
    // 英文補充：照 verified_english_additions.json 原樣（null 就是 null）
    'en-cigarettesafte-apocalypse': null,
    'en-phoebebridgers-motionsickness': '9sfYpolGCu8',
    'en-novoamor-anchor': null,
    'en-sufjanstevens-mysteryoflove': 'gNDuNpxpRkY',
    'en-ironwine-suchgreatheights': null,
    'en-nickdrake-pinkmoon': 'xqe6TF2y8i4',
    'en-agnesobel-riverside': 'JKR8dX1qQ4U',
    'en-lanadelrey-videogames': 'cE6wxDqdOV0',
    'en-radiohead-nosurprises': 'u5CVsCnxyXg',
    'en-billieeilish-oceaneyes': 'viimfQi_pUw',
    'en-norahjones-comeawaywithme': 'lbjZPFBD6JU',
    'en-jeffbuckley-hallelujah': 'y8AWFf7EAc4',
    'en-mazzystar-fadeintoyou': null,
    'en-lordhuron-thenightwemet': 'KtlgYxa6BMU',
    'en-hozier-cherrywine': null,
    'en-damienrice-cannonball': '3yqM--IMkX4',
    'en-sufjanstevens-deathwithdignity': '9YTAKmNN1kc',
    'en-boniver-restacks': '3w68krri0bw',
    'en-lorde-liability': 'BtvJaNeELic',
    'en-daughter-youth': '2QT5eGHCJdE',
    'en-stateless-bloodstream': 'yM9Xhps3w1g',
    'en-fleetwoodmac-landslide': null,
    'en-neilyoung-harvestmoon': 'n2MtEsrcTTs'
  };
  var YT_NOTE = {
    'fish-yongqi': 'Live 版（20 週年）',
    'david-aihenjiandan': 'Live 版',
    'simongarfunkel-silence': 'Live 版（Central Park）',
    'lijian-beijiaer': '節目版（我是歌手 3）',
    'sakamoto-mclawrence': '鋼琴獨奏版（2022）',
    'en-sufjanstevens-mysteryoflove': 'YouTube 為 Demo 版',
    'en-agnesobel-riverside': 'YouTube 為 Piano Sessions 版',
    'en-jeffbuckley-hallelujah': 'YouTube 為 Live 版',
    'en-sufjanstevens-deathwithdignity': 'YouTube 為 Demo 版',
    'en-stateless-bloodstream': 'YouTube 為 Quartet Session 版'
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
  var NO_ITUNES = ['sinatra-flyme', 'mariya-plasticlove', 'bts-springday'];
  SONGS.forEach(function (x) {
    x.itunesPreview = NO_ITUNES.indexOf(x.id) < 0;
    x.youtubeId = YT.hasOwnProperty(x.id) ? YT[x.id] : null;
    if (YT_NOTE[x.id]) x.ytNote = YT_NOTE[x.id];
    x.startSec = START[x.id] || 0;
  });

  var LANGS = ['zh', 'en', 'mix', 'ja', 'ko', 'inst'];
  window.MusicLibrary = { GENRES: GENRES, SONGS: SONGS, LANGS: LANGS };
})();
