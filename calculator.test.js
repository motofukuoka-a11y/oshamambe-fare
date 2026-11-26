import test from 'node:test';
import assert from 'node:assert/strict';
import { FARES,CORRIDORS } from './data.js';
import { fare,expressFee,childAmount,journeyFare,distance,settlement } from './calculator.js';
// 利用者提供の2026年3月更新表に記載された公示運賃・料金の照合値。
const reference={
  hakodate:{国縫:310,黒岩:470,山崎:580,八雲:800,山越:920,野田生:1040,落部:1210,石倉:1380,森:1590,駒ケ岳:1800,赤井川:2020,大沼公園:2020,大沼:2020,新函館北斗:2240,七飯:2240,大中山:2530,桔梗:2530,五稜郭:2530,函館:2530},
  sawara:{東森:1590,尾白内:1590,掛澗:1590,渡島砂原:1800,渡島沼尻:1800,鹿部:2020},
  otaru:{黒松内:470,熱郛:680,目名:1040,蘭越:1380,昆布:1380,ニセコ:1590,比羅夫:1800,倶知安:2020,小沢:2240,銀山:2530,然別:2530,仁木:2530,余市:3080,蘭島:3080,塩谷:3080,小樽:3520,南小樽:3520,小樽築港:3520,朝里:3520,銭函:3520,ほしみ:3520,星置:3960,稲穂:3960,手稲:3960,稲積公園:3960,発寒:3960,発寒中央:3960,琴似:3960,桑園:3960,札幌:3960},
  muroran:{静狩:360,小幌:470,礼文:580,大岸:680,豊浦:920,洞爺:1040,有珠:1210,長和:1380,伊達紋別:1380,北舟岡:1380,稀府:1590,黄金:1590,崎守:1590,本輪西:1800,東室蘭:1800,鷲別:1800,幌別:2020,富浦:2240,登別:2240,虎杖浜:2240,竹浦:2530,北吉原:2530,萩野:2530,白老:2530,社台:2530,錦岡:3080,糸井:3080,青葉:3080,苫小牧:3080,南千歳:3960,千歳:3960,恵み野:3960,北広島:4400,新札幌:4840,札幌:4840},
  muroranBranch:{輪西:1800,御崎:2020,母恋:2020,室蘭:2020},
  airport:{新千歳空港:3980}
};
for(const [corridor,stations] of Object.entries(reference))for(const [station,expected]of Object.entries(stations))test(`参考表：${corridor}/${station} ${expected}円`,()=>{
  assert.equal(journeyFare(corridor,station),expected);
  assert.equal(journeyFare(corridor,station,'長万部','child'),childAmount(expected));
});
const expressReference=[['hakodate','八雲',1160,1960],['hakodate','森',1680,3270],['hakodate','大沼公園',1680,3700],['hakodate','新函館北斗',1680,3920],['hakodate','五稜郭',2360,4890],['hakodate','函館',2360,4890],['sapporo','洞爺',1160,2200],['sapporo','伊達紋別',1680,3060],['sapporo','東室蘭',1680,3480],['sapporo','登別',1680,3920],['sapporo','白老',2360,4890],['sapporo','苫小牧',2360,5440],['sapporo','南千歳',2730,6690],['airport','新千歳空港',2730,6710],['sapporo','新札幌',2730,7570],['sapporo','札幌',2950,7790]];
for(const[corridor,boarding,charge,total]of expressReference)test(`特急の参考表：${boarding} ${total}円`,()=>{
  const r=settlement({corridor,boarding,express:true});assert.equal(r.charge,charge);assert.equal(r.total,total);
  const c=settlement({corridor,boarding,express:true,person:'child'});assert.equal(c.total,childAmount(total-charge)+childAmount(charge));
});
test('普通運賃の全区分境界と0.1km超過',()=>{
  FARES.forEach(([max,price],i)=>{assert.equal(fare(max*10),price);if(i<FARES.length-1)assert.equal(fare(max*10+1),FARES[i+1][1]);});assert.equal(fare(0),0);assert.throws(()=>fare(-1));assert.throws(()=>fare(3001));
});
test('特急料金の全区分境界と端数',()=>{
  const a=[[250,850],[500,1160],[1000,1680],[1500,2360],[2000,2730],[3000,2950]];
  a.forEach(([d,p],i)=>{assert.equal(expressFee(d),p);if(i<a.length-1)assert.equal(expressFee(d+1),a[i+1][1]);});
  assert.equal(expressFee(0),0);assert.equal(expressFee(2000,'child'),1360);assert.equal(expressFee(3000,'child'),1470);assert.equal(expressFee(250,'child'),420);
});
test('100km以内の原券：全区間との差額',()=>{
  const r=settlement({corridor:'hakodate',boarding:'函館',type:'section',ticketFrom:'函館',ticketTo:'黒岩'});assert.equal(r.originalDistance,944);assert.equal(r.base,290);assert.match(r.method,/100km以内/);
});
test('100km超の原券：乗越区間を別途収受',()=>{
  const r=settlement({corridor:'hakodate',boarding:'函館',type:'section',ticketFrom:'函館',ticketTo:'国縫'});assert.equal(r.originalDistance,1028);assert.equal(r.base,310);assert.match(r.method,/100km超/);
});
test('こどもは差額を出す前に各運賃を丸める',()=>{
  const r=settlement({corridor:'hakodate',boarding:'八雲',type:'section',ticketFrom:'八雲',ticketTo:'山崎',person:'child'});assert.equal(r.base,250);assert.equal(r.originalFare,150);
});
test('長万部まで有効・特急券あり',()=>{const r=settlement({corridor:'hakodate',boarding:'函館',type:'section',ticketFrom:'函館',ticketTo:'長万部',express:true,expressTicket:'valid'});assert.equal(r.total,0);});
test('金額式：発駅を基準に差し引く',()=>{assert.equal(settlement({corridor:'hakodate',boarding:'八雲',type:'amount',paid:'310'}).total,490);assert.equal(settlement({corridor:'hakodate',boarding:'八雲',type:'amount',paid:'150',person:'child'}).total,250);});
test('金額式の空欄・負数・小数・未知額・100km超・過大額を拒否',()=>{
  for(const paid of['','-10','310.5','311','2530','800'])assert.throws(()=>settlement({corridor:'hakodate',boarding:'国縫',type:'amount',paid}));
});
test('砂原経由は両端通過に特例、支線内発着には実キロ',()=>{assert.equal(distance('sawara','函館'),1123);assert.equal(distance('sawara','大沼'),853);assert.equal(distance('sawara','鹿部'),835);assert.equal(distance('sawara','鹿部','東森'),189);assert.equal(distance('sawara','大沼','森'),225);});
test('札幌市内は運賃のみに適用、小樽経由は実キロ',()=>{assert.equal(distance('sapporo','新札幌'),1955);assert.equal(journeyFare('sapporo','新札幌'),4840);assert.equal(expressFee(1955),2730);assert.equal(journeyFare('otaru','札幌'),3960);assert.equal(distance('otaru','札幌'),1740);});
test('空港加算を重複しない・原券との差額で相殺',()=>{
  const r=settlement({corridor:'airport',boarding:'新千歳空港',type:'section',ticketFrom:'新千歳空港',ticketTo:'苫小牧'});assert.equal(r.originalFare,700);assert.equal(r.base,3280);
  const c=settlement({corridor:'airport',boarding:'新千歳空港',type:'amount',paid:'700'});assert.equal(c.base,3280);
});
test('特急券の乗越は料金差額・こどもを個別丸め',()=>{
  const r=settlement({corridor:'hakodate',boarding:'函館',express:true,expressTicket:'extend',expressTo:'森'});assert.equal(r.fullCharge,2360);assert.equal(r.oldCharge,1160);assert.equal(r.charge,1200);
  const c=settlement({corridor:'sapporo',boarding:'札幌',express:true,person:'child',expressTicket:'extend',expressTo:'南千歳'});assert.equal(c.oldCharge,580);assert.equal(c.charge,890);
});
test('方向違い・乗車区間外・未知駅・長万部乗車は拒否',()=>{
  for(const p of[{ticketFrom:'森',ticketTo:'函館'},{ticketFrom:'森',ticketTo:'八雲'},{ticketFrom:'函館',ticketTo:'存在しない駅'}])assert.throws(()=>settlement({corridor:'hakodate',boarding:'函館',type:'section',...p}));
  assert.throws(()=>settlement({corridor:'hakodate',boarding:'長万部'}));
});
test('UIの候補と同様に券面着駅＝乗車駅の入力を拒否',()=>{
  assert.throws(()=>settlement({corridor:'hakodate',boarding:'大沼',type:'section',ticketFrom:'函館',ticketTo:'大沼'}));
});
test('現行駅の重複・位置順、廃駅が含まれない',()=>{
  for(const list of Object.values(CORRIDORS)){assert.equal(new Set(list.map(s=>s.name)).size,list.length);assert.equal(list.at(-1).name,'長万部');for(let i=1;i<list.length;i++)assert.ok(list[i].pos>list[i-1].pos);assert.ok(!list.some(s=>['二股','仁山','中ノ沢','姫川','池田園','流山温泉','銚子口'].includes(s.name)));}
});
test('原券100.0kmは差額、100.1kmは別途運賃',()=>{
  CORRIDORS.boundary=[{name:'発駅',pos:0},{name:'原着駅',pos:1000},{name:'長万部',pos:1500}];
  try {
    let r=settlement({corridor:'boundary',boarding:'発駅',type:'section',ticketFrom:'発駅',ticketTo:'原着駅'});assert.equal(r.base,1280);assert.match(r.method,/100km以内/);
    CORRIDORS.boundary[1].pos=1001;r=settlement({corridor:'boundary',boarding:'発駅',type:'section',ticketFrom:'発駅',ticketTo:'原着駅'});assert.equal(r.base,1210);assert.match(r.method,/100km超/);
  }finally{delete CORRIDORS.boundary;}
});
