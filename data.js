// 距離は0.1km単位の整数。運賃表は2025-04-01改定後のJR北海道・幹線。
export const META = { version: '1.2.0', checked: '2026-11-27', fareSince: '2025-04-01' };
export const FARES = [[3,210],[6,270],[10,310],[15,360],[20,470],[25,580],[30,680],[35,800],[40,920],[45,1040],[50,1210],[60,1380],[70,1590],[80,1800],[90,2020],[100,2240],[120,2530],[140,3080],[160,3520],[180,3960],[200,4400],[220,4840],[240,5170],[260,5610],[280,5940],[300,6270]];
const rows = (text) => text.split('|').map(s => { const [name,kana,km,code] = s.split(','); return {name,kana,km:Number(km),code}; });
const hakodate = rows('函館,はこだて,0,H75|五稜郭,ごりょうかく,34,H74|桔梗,ききょう,83,H73|大中山,おおなかやま,104,H72|七飯,ななえ,138,H71|新函館北斗,しんはこだてほくと,179,H70|大沼,おおぬま,270,H68|大沼公園,おおぬまこうえん,280,H67|赤井川,あかいがわ,317,H66|駒ケ岳,こまがたけ,365,H65|森,もり,495,H62|石倉,いしくら,621,H59|落部,おとしべ,661,H58|野田生,のだおい,714,H57|山越,やまこし,760,H56|八雲,やくも,811,H54|山崎,やまさき,883,H52|黒岩,くろいわ,944,H51|国縫,くんぬい,1028,H49|長万部,おしゃまんべ,1123,H47');
const branch = rows('鹿部,しかべ,146,N68|渡島沼尻,おしまぬまじり,200,N67|渡島砂原,おしまさわら,253,N66|掛澗,かかりま,290,N65|尾白内,おしろない,319,N64|東森,ひがしもり,335,N63');
const otaru = rows('札幌,さっぽろ,2863,01|桑園,そうえん,2847,S02|琴似,ことに,2825,S03|発寒中央,はっさむちゅうおう,2810,S04|発寒,はっさむ,2792,S05|稲積公園,いなづみこうえん,2770,S06|手稲,ていね,2757,S07|稲穂,いなほ,2737,S08|星置,ほしおき,2726,S09|ほしみ,ほしみ,2710,S10|銭函,ぜにばこ,2681,S11|朝里,あさり,2593,S12|小樽築港,おたるちっこう,2562,S13|南小樽,みなみおたる,2541,S14|小樽,おたる,2525,S15|塩谷,しおや,2448,S16|蘭島,らんしま,2379,S17|余市,よいち,2326,S18|仁木,にき,2282,S19|然別,しかりべつ,2241,S20|銀山,ぎんざん,2134,S21|小沢,こざわ,2036,S22|倶知安,くっちゃん,1933,S23|比羅夫,ひらふ,1866,S24|ニセコ,にせこ,1796,S25|昆布,こんぶ,1703,S26|蘭越,らんこし,1634,S27|目名,めな,1558,S28|熱郛,ねっぷ,1404,S29|黒松内,くろまつない,1323,S30|長万部,おしゃまんべ,1123,H47');
const muroran = rows('長万部,おしゃまんべ,0,H47|静狩,しずかり,106,H46|小幌,こぼろ,175,H45|礼文,れぶん,236,H44|大岸,おおきし,277,H43|豊浦,とようら,361,H42|洞爺,とうや,415,H41|有珠,うす,466,H40|長和,ながわ,515,H39|伊達紋別,だてもんべつ,545,H38|北舟岡,きたふなおか,574,H37|稀府,まれっぷ,606,H36|黄金,こがね,651,H35|崎守,さきもり,673,H34|本輪西,もとわにし,727,H33|東室蘭,ひがしむろらん,772,H32|鷲別,わしべつ,791,H31|幌別,ほろべつ,868,H30|富浦,とみうら,923,H29|登別,のぼりべつ,947,H28|虎杖浜,こじょうはま,981,H27|竹浦,たけうら,1029,H26|北吉原,きたよしはら,1057,H25|萩野,はぎの,1078,H24|白老,しらおい,1136,H23|社台,しゃだい,1191,H22|錦岡,にしきおか,1254,H21|糸井,いとい,1306,H20|青葉,あおば,1328,H19|苫小牧,とまこまい,1352,H18|沼ノ端,ぬまのはた,1440,H17');
const chitose = rows('植苗,うえなえ,1504,H16|南千歳,みなみちとせ,1624,H14|千歳,ちとせ,1654,H13|長都,おさつ,1689,H12|サッポロビール庭園,さっぽろびーるていえん,1711,H11|恵庭,えにわ,1734,H10|恵み野,めぐみの,1759,H09|島松,しままつ,1781,H08|北広島,きたひろしま,1846,H07|上野幌,かみのっぽろ,1926,H06|新札幌,しんさっぽろ,1955,H05|平和,へいわ,1984,H04|白石,しろいし,2006,H03|苗穂,なえぼ,2045,H02|札幌,さっぽろ,2064,01');
// 札幌〜長万部は206.4km（室蘭・千歳線経由）。新札幌は195.5km。
export const CORRIDORS = {
  hakodate: hakodate.map(s=>({...s,pos:s.km})),
  sawara: [...hakodate.filter(s=>s.km<=270),...branch.map(s=>({...s,km:s.km+270})),...hakodate.filter(s=>s.km>=495).map(s=>({...s,km:s.km+128}))].map(s=>({...s,pos:s.km})),
  // kmは函館起点の距離程。札幌〜長万部は286.3−112.3=174.0km。
  otaru: otaru.map(s=>({...s,pos:2863-s.km})),
  muroran: [...muroran,...chitose].reverse().map(s=>({...s,pos:2064-s.km})),
  muroranBranch: [...rows('室蘭,むろらん,842,M36|母恋,ぼこい,831,M35|御崎,みさき,814,M34|輪西,わにし,795,M33'),...muroran.filter(s=>s.km<=772).reverse()].map(s=>({...s,pos:842-s.km})),
  airport: [{name:'新千歳空港',kana:'しんちとせくうこう',km:1650,code:'AP15'},...chitose.filter(s=>s.km<=1624).reverse(),...muroran.slice().reverse()].map(s=>({...s,pos:1650-s.km})),
  sapporo: [...muroran,...chitose].reverse().map(s=>({...s,pos:2064-s.km}))
};
export const ROUTES = [
  { id:'hakodate-local',title:'函館発普通列車',from:'函館方面',line:'函館本線',badge:'普通',color:'green',corridor:'hakodate',description:'函館・森・八雲方面から',icon:'train' },
  { id:'otaru-local',title:'小樽方面発普通列車',from:'小樽方面',line:'函館本線',badge:'普通',color:'orange',corridor:'otaru',description:'小樽・倶知安・黒松内方面から',icon:'mountain' },
  { id:'muroran-local',title:'東室蘭発普通列車',from:'東室蘭方面',line:'室蘭本線',badge:'普通',color:'blue',corridor:'muroran',description:'東室蘭・洞爺・静狩方面から',icon:'wave' },
  { id:'hakodate-express',title:'函館発特急列車',from:'函館方面',line:'特急 北斗',badge:'特急',color:'purple',corridor:'hakodate',stops:['函館','五稜郭','新函館北斗','大沼公園','森','八雲'],description:'北斗の着駅精算',icon:'express' },
  { id:'sapporo-express',title:'札幌発特急列車',from:'札幌方面',line:'特急 北斗',badge:'特急',color:'purple',corridor:'sapporo',stops:['札幌','新札幌','南千歳','苫小牧','白老','登別','東室蘭','伊達紋別','洞爺'],description:'北斗の着駅精算',icon:'express' }
];
export const SOURCES = [
  ['JR北海道 各駅間の営業キロ（運賃計算キロ）','https://www.jrhokkaido.co.jp/fare/pdf/05.pdf'],
  ['JR北海道 普通旅客運賃表（2025年4月1日改定）','https://www.jrhokkaido.co.jp/fare/pdf/06.pdf'],
  ['JR北海道 旅客営業規則 第3章（運賃・料金）','https://www.jrhokkaido.co.jp/network/guide/pdf/yakkan_02_03.pdf'],
  ['JR北海道 乗越精算の案内','https://www.jrhokkaido.co.jp/faq/qa0022.html'],
  ['JR北海道 旅客営業規則 第7章（乗車変更）','https://www.jrhokkaido.co.jp/network/guide/pdf/yakkan_02_07.pdf'],
  ['JR北海道 運賃計算の特例（大沼〜森）','https://www.jrhokkaido.co.jp/network/guide/pdf/rule_10.pdf'],
  ['JR北海道 特急券・急行券（通年料金）','https://www.jrhokkaido.co.jp/network/guide/pdf/rule_13.pdf'],
  ['JR北海道 2026年3月ダイヤ改正（駅廃止）','https://www.jrhokkaido.co.jp/CM/Info/press/pdf/20251212_KO_kaisei.pdf'],
  ['距離程の照合：きっぷナビ 函館本線','https://kippu-navi.com/data/lines/函館本線'],
  ['距離程の照合：きっぷナビ 室蘭本線','https://kippu-navi.com/data/lines/室蘭本線'],
  ['距離程の照合：きっぷナビ 千歳線','https://kippu-navi.com/data/lines/千歳線'],
  ['距離程の照合：きっぷナビ 砂原支線','https://kippu-navi.com/data/lines/函館本線２'],
  ['距離程の照合：きっぷナビ 室蘭支線','https://kippu-navi.com/data/lines/室蘭本線２'],
  ['距離程の照合：きっぷナビ 空港支線','https://kippu-navi.com/data/lines/千歳線２']
];
