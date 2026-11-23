/*
 * artist-aliases.js — 歌單內歌手的常見別名（第五輪模糊搜尋）
 * ------------------------------------------------------------
 * 只收確定無誤的英文名、暱稱、原文名。鍵是歌單裡的中文慣用名（music-library.js 的 a）。
 */
(function () {
  'use strict';
  var ALIASES = {
    '周杰倫': ['Jay Chou', 'Jay'],
    '陳奕迅': ['Eason Chan', 'Eason'],
    '林俊傑': ['JJ Lin', 'Lin Jun Jie'],
    '王菲': ['Faye Wong'],
    '孫燕姿': ['Stefanie Sun', 'Yanzi Sun'],
    '田馥甄': ['Hebe', 'Hebe Tien'],
    '鄧紫棋': ['G.E.M.', 'GEM', 'Gloria Tang'],
    '張惠妹': ['A-Mei', 'Amei', '阿妹'],
    '梁靜茹': ['Fish Leong'],
    '蔡健雅': ['Tanya Chua'],
    '李宗盛': ['Jonathan Lee'],
    '王力宏': ['Leehom Wang', 'Leehom'],
    '五月天': ['Mayday'],
    '告五人': ['Accusefive'],
    '落日飛車': ['Sunset Rollercoaster'],
    '草東沒有派對': ['No Party For Cao Dong'],
    '蘇打綠': ['Sodagreen', '魚丁糸'],
    '陳綺貞': ['Cheer Chen'],
    '盧廣仲': ['Crowd Lu'],
    '方大同': ['Khalil Fong'],
    '陶喆': ['David Tao'],
    '宇多田光': ['Utada Hikaru', 'Hikaru Utada', '宇多田ヒカル'],
    '竹內瑪莉亞': ['Mariya Takeuchi', '竹内まりや'],
    '米津玄師': ['Kenshi Yonezu'],
    'YOASOBI': ['よあそび'],
    '藤井風': ['Fujii Kaze'],
    'RADWIMPS': ['ラッドウィンプス'],
    '中島美嘉': ['Mika Nakashima', 'Nakashima Mika'],
    '松原みき': ['Miki Matsubara'],
    '坂本龍一': ['Ryuichi Sakamoto'],
    '久石讓': ['Joe Hisaishi', '久石譲'],
    'IU': ['아이유', 'Lee Ji-eun'],
    'BTS': ['방탄소년단', 'Bangtan'],
    'NewJeans': ['뉴진스'],
    'AKMU': ['악동뮤지션', 'Akdong Musician'],
    'Zion.T': ['자이언티'],
    'Norah Jones': ['Nora Jones'],
    'Damien Rice': ['Damian Rice'],
    'Bon Iver': ['Justin Vernon'],
    'Cigarettes After Sex': ['Cigarettes Aftersex'],
    'Phoebe Bridgers': ['Phoebe Bridger'],
    'The Lumineers': ['Lumineers'],
    'Frank Ocean': ['Frank Oceans'],
    'Billie Eilish': ['Billie Eilish Pirate'],
    'Lana Del Rey': ['Lana DelRay'],
    'Radiohead': ['Radio Head']
  };
  window.ArtistAliases = ALIASES;
})();
