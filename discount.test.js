import test from 'node:test';
import assert from 'node:assert/strict';
import {settlement,amountOptions,stationChoices} from './calculator.js';
import {discountAmount,zipangDate,verifyDiscount,discountRule} from './discounts.js';

const date='2026-11-27';
const input=(extra={})=>({corridor:'hakodate',boarding:'函館',discountConfirmed:true,travelDate:date,...extra});
const section=(extra={})=>input({type:'section',ticketFrom:'函館',ticketTo:'国縫',...extra});
const otona=(extra={})=>({corridor:'sapporo',boarding:'札幌',type:'section',ticketFrom:'札幌',ticketTo:'洞爺',discount:'otona30',discountConfirmed:true,travelDate:date,express:true,expressTicket:'extend',expressTicketFrom:'札幌',expressTo:'洞爺',expressDiscount:'otona30',...extra});

test('大休ジパング新規は運賃・特急料金を個別に3割引',()=>{
  const r=settlement(input({discount:'otona30',express:true,expressDiscount:'otona30'}));
  assert.equal(r.base,1770);assert.equal(r.charge,1650);assert.equal(r.total,3420);
});
test('大休ジパングの乗車券・特急券乗越は無割引区間外を別途',()=>{
  const r=settlement(otona());assert.equal(r.base,1040);assert.equal(r.charge,1160);assert.equal(r.total,2200);
  assert.equal(r.fareRule,'otona');assert.equal(r.chargeRule,'otona');assert.equal(r.fullCharge,null);assert.equal(r.oldCharge,null);
});
test('大休乗車券と通常特急券の混在では通常料金差額を計算',()=>{
  const r=settlement(otona({expressDiscount:'none'}));assert.equal(r.base,1040);assert.equal(r.charge,220);assert.equal(r.total,1260);
  assert.equal(r.fareRule,'otona');assert.equal(r.chargeRule,'express');
});
test('大休乗車券が長万部まで有効でも大休特急券の区間外料金は1160円',()=>{
  const r=settlement(otona({ticketTo:'長万部'}));assert.equal(r.base,0);assert.equal(r.charge,1160);assert.equal(r.total,1160);
});
test('大休料金券の別購入はカード等の確認と原大休乗車券区間内が必要',()=>{
  const x=otona({ticketTo:'長万部',expressTicket:'none'});
  for(const confirmed of [undefined,false,'true'])assert.throws(()=>settlement({...x,expressDiscountConfirmed:confirmed}),/カード/);
  const r=settlement({...x,expressDiscountConfirmed:true});assert.equal(r.base,0);assert.equal(r.charge,2060);
  assert.throws(()=>settlement(otona({expressTicket:'none',expressDiscountConfirmed:true})),/全区間/);
});
test('大休料金券と全国ジパング・身障券を同制度と推測しない',()=>{
  for(const discount of ['none','zip20','zip30','disability_companion'])assert.throws(()=>settlement(otona({discount})),/別制度/);
  for(const expressDiscount of ['zip20','zip30'])assert.throws(()=>settlement(otona({expressDiscount})),/組合せ/);
  assert.throws(()=>settlement(otona({expressDiscount:undefined})),/推定しません/);
});
test('大休ジパングは本人・カード条件の確認と片道101km以上が必須',()=>{
  for(const x of [{person:'child'},{discountConfirmed:false},{discountConfirmed:'true'}])assert.throws(()=>settlement(otona(x)));
  assert.throws(()=>settlement(input({discount:'otona30',boarding:'八雲'})),/101km/);
  assert.throws(()=>settlement(input({discount:'otona30',type:'amount',paid:'310'})),/発着駅/);
});
test('大休の新規発売は除外日を判定し、有効な原券の区間外計算とは分ける',()=>{
  for(const travelDate of ['2026-12-28','2027-01-06','2026-04-27','2026-08-10'])assert.throws(()=>settlement(input({discount:'otona30',travelDate})),/除外日/);
  for(const travelDate of ['2026-12-27','2027-01-07'])assert.equal(settlement(input({discount:'otona30',travelDate})).base,1770);
  assert.equal(settlement(otona({travelDate:'2026-12-28'})).total,2200);
});
test('大休料金券自体が100km以内でも原割引乗車券の区間内なら扱える',()=>{
  const r=settlement(input({type:'section',ticketFrom:'函館',ticketTo:'長万部',discount:'otona30',express:true,expressTicket:'extend',expressTo:'森',expressDiscount:'otona30'}));
  assert.equal(r.base,0);assert.equal(r.charge,1680);assert.equal(r.chargeRule,'otona');
  assert.throws(()=>settlement(otona({expressTo:'長万部'})),/有効区間/);
});

test('割引後の10円未満は切捨て。過去の切上げ処理を流用しない',()=>{
  assert.equal(discountAmount(2530,20),2020);assert.equal(discountAmount(2530,30),1770);
  assert.equal(discountAmount(1590,50),790);assert.equal(discountAmount(1260,50),630);
  for(const args of [[2530,-1],[2530,101],[2530,20.5],[-10,20],[NaN,20]])assert.throws(()=>discountAmount(...args));
});
test('割引判定には正しい0.1km整数の対象距離が必要',()=>{
  for(const distance of [undefined,NaN,Infinity,0,-1,100.1])assert.throws(()=>verifyDiscount(discountRule('student'),{person:'adult',distance,confirmed:true}));
});
test('学割新規は運賃だけ2割引。北斗料金は通常料金',()=>{
  const r=settlement(input({discount:'student',express:true}));assert.equal(r.base,2020);assert.equal(r.charge,2360);assert.equal(r.total,4380);
});
test('学割原券の101km以上乗越は学割を自動継続せず通常運賃',()=>{
  const r=settlement(section({discount:'student'}));assert.equal(r.originalFare,2020);assert.equal(r.base,310);assert.match(r.method,/学割/);
});
test('学割券でも通常特急券は原特急券の発駅から差額',()=>{
  const r=settlement(section({discount:'student',express:true,expressTicket:'extend',expressTo:'森'}));
  assert.equal(r.base,310);assert.equal(r.charge,1200);assert.equal(r.total,1510);assert.match(r.chargeMethod,/原券発駅/);
});
test('通常特急券は原券101km以上でも発駅からの料金差額',()=>{
  const r=settlement({corridor:'sapporo',boarding:'札幌',type:'section',ticketFrom:'札幌',ticketTo:'長万部',express:true,expressTicket:'extend',expressTicketFrom:'札幌',expressTo:'洞爺'});
  assert.equal(r.base,0);assert.equal(r.fullCharge,2950);assert.equal(r.oldCharge,2730);assert.equal(r.charge,220);assert.equal(r.total,220);
  assert.deepEqual(r.chargeLines.map(l=>l.value),[2950,2730]);assert.match(r.chargeMethod,/原券発駅/);
});
test('学割の短距離・小児・証明未確認を拒否',()=>{
  for(const change of [{boarding:'八雲'},{person:'child'},{discountConfirmed:false},{discountConfirmed:'false'},{type:'amount',paid:'310'},{type:'section',ticketFrom:'函館',ticketTo:'森'}])assert.throws(()=>settlement(input({discount:'student',...change})));
});
test('身障第1種同行は1人分の運賃5割引、特急料金は通常',()=>{
  const a=settlement(input({discount:'disability_companion',express:true}));assert.equal(a.base,1260);assert.equal(a.charge,2360);assert.equal(a.total,3620);
  const c=settlement(input({discount:'disability_companion',person:'child'}));assert.equal(c.base,630);
});
test('身障同行の100km以内は新旧の各割引運賃を比較',()=>{
  const x=input({boarding:'八雲',type:'section',ticketFrom:'八雲',ticketTo:'山崎',discount:'disability_companion'});
  assert.equal(settlement(x).base,250);assert.equal(settlement({...x,person:'child'}).base,130);
});
test('身障同行の金額式は割引後券面額を控除',()=>{
  const x=input({boarding:'国縫',type:'amount',ticketFrom:'国縫',paid:'100',discount:'disability_companion'});
  assert.equal(settlement(x).base,50);
  assert.equal(settlement({...x,person:'child',paid:'50'}).base,20);
  assert.ok(amountOptions('hakodate','国縫','adult','disability_companion').includes(100));
});
test('身障同行の101km以上原券は乗越区間の5割引',()=>{
  assert.equal(settlement(section({discount:'disability_companion'})).base,150);
});
test('身障単独の短区間乗越は適用確認なしで額を出さない',()=>{
  const x=section({discount:'disability_single'});assert.throws(()=>settlement(x));
  assert.equal(settlement({...x,overrunDiscount:'apply'}).base,150);
  assert.equal(settlement({...x,overrunDiscount:'normal'}).base,310);
  assert.throws(()=>settlement(input({discount:'disability_single',boarding:'国縫'})));
});
for(const [discount,base,charge,total]of [['zip20',2020,1880,3900],['zip30',1770,1650,3420]])test(`${discount}新規発売は運賃と料金を個別に割引・端数処理`,()=>{
  const r=settlement(input({discount,express:true,expressDiscount:discount}));assert.equal(r.base,base);assert.equal(r.charge,charge);assert.equal(r.total,total);
});
test('ジパングは使用開始後の区間外運賃・料金を別途収受',()=>{
  const r=settlement({corridor:'sapporo',boarding:'札幌',type:'section',ticketFrom:'札幌',ticketTo:'洞爺',discount:'zip30',discountConfirmed:true,express:true,expressDiscount:'zip30',expressTicket:'extend',expressTo:'洞爺',travelDate:date});
  assert.equal(r.base,1040);assert.equal(r.charge,1160);assert.equal(r.total,2200);assert.match(r.chargeMethod,/別途/);
  assert.equal(r.fullCharge,null);assert.equal(r.oldCharge,null);
});
test('ジパング乗車券と通常特急券を混同せず通常券は発駅差額',()=>{
  const x={corridor:'sapporo',boarding:'札幌',type:'section',ticketFrom:'札幌',ticketTo:'洞爺',discount:'zip30',discountConfirmed:true,express:true,expressTicket:'extend',expressTo:'洞爺',travelDate:date};
  assert.throws(()=>settlement(x));
  const r=settlement({...x,expressDiscount:'none'});assert.equal(r.base,1040);assert.equal(r.charge,220);assert.equal(r.total,1260);assert.match(r.chargeMethod,/原券発駅/);
  assert.equal(settlement({...x,expressDiscount:'zip30'}).total,2200);
});
test('乗車券が長万部まで有効でもジパング特急券の区間外料金は別途',()=>{
  for(const discount of ['zip20','zip30']){
    const r=settlement({corridor:'sapporo',boarding:'札幌',type:'section',ticketFrom:'札幌',ticketTo:'長万部',discount,discountConfirmed:true,express:true,expressTicket:'extend',expressTo:'洞爺',expressDiscount:discount});
    assert.equal(r.base,0);assert.equal(r.charge,1160);assert.equal(r.total,1160);
    assert.equal(r.fullCharge,null);assert.equal(r.oldCharge,null);assert.equal(r.fareRule,'');assert.equal(r.chargeRule,'zipang');
  }
});
test('同一の原券区間でも通常券・ジパング・トクだ値を商品条件で区別する',()=>{
  const x={corridor:'sapporo',boarding:'札幌',type:'section',ticketFrom:'札幌',ticketTo:'洞爺',express:true,expressTicket:'extend',expressTo:'洞爺',discountConfirmed:true};
  for(const [discount,charge,total,fareRule,chargeRule]of [['none',220,1260,'ordinary','express'],['zip20',1160,2200,'zipang','zipang'],['zip30',1160,2200,'zipang','zipang'],['tokudane',1160,2200,'tokudane','tokudane']]){
    const r=settlement({...x,discount,expressDiscount:discount.startsWith('zip')?discount:'none',tokudaneUse:'same'});
    assert.equal(r.base,1040);assert.equal(r.charge,charge);assert.equal(r.total,total);
    assert.equal(r.fareRule,fareRule);assert.equal(r.chargeRule,chargeRule);
  }
});
test('ジパング料金券の原区間が原割引乗車券に含まれない場合は停止',()=>{
  assert.throws(()=>settlement({corridor:'sapporo',boarding:'札幌',type:'section',ticketFrom:'札幌',ticketTo:'洞爺',discount:'zip30',discountConfirmed:true,express:true,expressTicket:'extend',expressTo:'長万部',expressDiscount:'zip30'}),/有効区間/);
});
test('ジパング除外日・新条件開始日・実在日を検証',()=>{
  for(const d of ['2026-01-06','2026-04-27','2026-05-06','2026-08-10','2026-08-19','2026-12-28']){
    if(d>='2026-03-14'){assert.equal(zipangDate(d),true);assert.throws(()=>settlement(input({discount:'zip30',travelDate:d})));}
  }
  for(const d of ['2026-04-26','2026-05-07','2026-08-09','2026-08-20','2026-12-27','2027-01-07'])assert.equal(zipangDate(d),false);
  for(const d of ['','2026-02-30','2026-03-13','2026-13-01'])assert.throws(()=>zipangDate(d));
  assert.equal(zipangDate('2026-03-14'),false);
});
test('ジパング原券の有効性確認と区間外の通常収受を区別',()=>{
  const r=settlement(section({discount:'zip30',travelDate:'2026-12-28'}));assert.equal(r.base,310);
  assert.throws(()=>settlement(section({discount:'zip30',discountConfirmed:false})));
});
test('ジパング料金と学割などの不適切な組合せを拒否',()=>{
  assert.throws(()=>settlement(input({discount:'student',express:true,expressDiscount:'zip30',expressDiscountConfirmed:true})));
  assert.throws(()=>settlement(input({discount:'zip30',boarding:'八雲'})));
  assert.throws(()=>settlement(section({discount:'zip30',expressDiscount:'zip30',express:true,expressTicket:'none'})));
});
test('既存ジパング乗車券への料金券別購入は別購入証等の確認が必要',()=>{
  const x={corridor:'sapporo',boarding:'札幌',type:'section',ticketFrom:'札幌',ticketTo:'長万部',discount:'zip30',discountConfirmed:true,express:true,expressTicket:'none',expressDiscount:'zip30',travelDate:date};
  assert.throws(()=>settlement(x));assert.throws(()=>settlement({...x,expressDiscountConfirmed:'false'}));
  const r=settlement({...x,expressDiscountConfirmed:true});assert.equal(r.base,0);assert.equal(r.charge,2060);assert.equal(r.total,2060);
});
test('トクだ値100km以内も原券着駅から通常運賃・料金を別途',()=>{
  const r=settlement(section({ticketTo:'八雲',discount:'tokudane',tokudaneUse:'same',express:true}));
  assert.equal(r.base,800);assert.equal(r.charge,1160);assert.equal(r.total,1960);assert.equal(r.originalFare,null);
});
test('トクだ値101km以上は原券発売額を差し引かない',()=>{
  const r=settlement({corridor:'sapporo',boarding:'札幌',type:'section',ticketFrom:'札幌',ticketTo:'洞爺',discount:'tokudane',tokudaneUse:'same',discountConfirmed:true,express:true});
  assert.equal(r.total,2200);
  assert.equal(settlement({...section(),corridor:'sapporo',boarding:'札幌',ticketFrom:'札幌',ticketTo:'洞爺',discount:'tokudane',tokudaneUse:'same',express:true,person:'child'}).total,1100);
});
test('トクだ値の乗車券部分のみ有効の場合、別列車の特急料金を全額収受',()=>{
  const x=section({ticketTo:'森',discount:'tokudane',tokudaneUse:'fareOnly'});
  assert.equal(settlement(x).base,1590);
  assert.equal(settlement({...x,express:true}).charge,2360);
});
test('トクだ値が長万部まで有効なら同じ指定列車の追加は0円',()=>{
  assert.equal(settlement(section({ticketTo:'長万部',discount:'tokudane',tokudaneUse:'same',express:true})).total,0);
});
test('トクだ値は指定列車・券面区間・利用条件の不明から0円を出さない',()=>{
  const x=section({discount:'tokudane',tokudaneUse:'same',express:true});
  for(const change of [{discountConfirmed:false},{tokudaneUse:''},{type:'none'},{ticketTo:'黒岩'},{express:false},{boarding:'八雲',ticketTo:'八雲'}])assert.throws(()=>settlement({...x,...change}));
  assert.ok(!stationChoices(x,'ticketTo').some(s=>s.name==='黒岩'));
});
test('通常券・割引ごとに料金の内訳合計が総額と一致',()=>{
  for(const discount of ['none','student','disability_companion','disability_single','zip20','zip30']){
    const r=settlement(section({discount,expressDiscount:['zip20','zip30'].includes(discount)?discount:'none',overrunDiscount:'apply',express:true,expressTicket:'extend',expressTo:'森'}));
    const sum=rows=>rows.reduce((n,r)=>n+(r.subtract?-r.value:r.value),0);
    assert.equal(sum(r.lines),r.base);assert.equal(sum(r.chargeLines),r.charge);assert.equal(r.total,r.base+r.charge);
  }
});
test('未対応の社割・指のみ券などを通常料金として推測しない',()=>{
  assert.throws(()=>settlement(input({discount:'employee'})));
  assert.throws(()=>settlement(input({express:true,expressTicket:'seatOnly'})));
});
