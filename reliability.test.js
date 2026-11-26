import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { CORRIDORS, META } from './data.js?v=1.1.0';
import {settlement,journeyFare,parseAmount,extensionRule} from './calculator.js?v=1.1.0';
import {stationMatches,resolveStation,normalizeStation} from './station-picker.js?v=1.1.0';

test('金額式の券面発駅が列車乗車駅と異なる乗継',()=>{
  const r=settlement({corridor:'hakodate',boarding:'森',type:'amount',ticketFrom:'函館',paid:'1210'});
  assert.equal(r.base,1320);assert.equal(r.calculationFrom,'函館');assert.deepEqual(r.lines.map(x=>x.value),[2530,1210]);
});
test('100km超の原券着駅での乗継は乗越区間を収受',()=>{
  const r=settlement({corridor:'hakodate',boarding:'国縫',type:'section',ticketFrom:'函館',ticketTo:'国縫'});
  assert.equal(r.rule,'extension');assert.equal(r.base,310);assert.equal(r.lines.length,1);assert.equal(r.lines[0].value,310);
  assert.equal(r.calculationFrom,'国縫');assert.equal(r.fareDistance,95);
});
test('特急券の発駅と実際の特急乗車駅を分離',()=>{
  const r=settlement({corridor:'sapporo',boarding:'新札幌',express:true,expressFrom:'新札幌',expressTicket:'extend',expressTicketFrom:'札幌',expressTo:'南千歳'});
  assert.equal(r.fullCharge,2950);assert.equal(r.oldCharge,1160);assert.equal(r.charge,1790);assert.equal(r.total,6630);
});
test('普通から途中駅で北斗に乗り継いだ特急区間',()=>{
  const r=settlement({corridor:'sapporo',boarding:'札幌',express:true,expressFrom:'南千歳'});
  assert.equal(r.base,4840);assert.equal(r.charge,2730);assert.equal(r.total,7570);
});
test('空港発の金額式きっぷで南千歳に乗継・空港加算の差引',()=>{
  const r=settlement({corridor:'airport',boarding:'南千歳',type:'amount',ticketFrom:'新千歳空港',paid:'230'});
  assert.equal(r.base,3750);assert.equal(r.lines[0].value,3980);
  const c=settlement({corridor:'airport',boarding:'南千歳',type:'amount',ticketFrom:'新千歳空港',paid:'110',person:'child'});
  assert.equal(c.base,1880);
});
test('同じ空港駅間の0kmは空港加算を収受しない',()=>{
  assert.equal(journeyFare('airport','新千歳空港','新千歳空港'),0);
  assert.equal(journeyFare('airport','新千歳空港','新千歳空港','child'),0);
});
test('手動で消した発駅・特急乗車駅を勝手に補完しない',()=>{
  for(const input of [
    {type:'amount',ticketFrom:'',paid:'310'},
    {type:'section',ticketFrom:'',ticketTo:'森'},
    {express:true,expressFrom:''},
    {express:true,expressTicket:'extend',expressTicketFrom:'',expressTo:'森'}
  ])assert.throws(()=>settlement({corridor:'hakodate',boarding:'函館',...input}));
});
test('特急停車駅以外・乗車前・逆方向の特急券は計算しない',()=>{
  for(const input of [
    {boarding:'函館',expressFrom:'桔梗'},
    {boarding:'八雲',expressFrom:'函館'},
    {boarding:'森',expressTicket:'extend',expressTicketFrom:'八雲',expressTo:'長万部'},
    {boarding:'函館',expressTicket:'extend',expressTo:'桔梗'}
  ])assert.throws(()=>settlement({corridor:'hakodate',express:true,...input}));
});
test('今回の特急区間を含まない原特急券で差額を計算しない',()=>{
  assert.throws(()=>settlement({corridor:'sapporo',boarding:'新札幌',express:true,expressTicket:'extend',expressTicketFrom:'札幌',expressTo:'新札幌'}));
  assert.throws(()=>settlement({corridor:'sapporo',boarding:'札幌',express:true,expressFrom:'札幌市内'}));
});
test('100km超の砂原原券の根拠は乗越区間を表示',()=>{
  const r=settlement({corridor:'sawara',boarding:'函館',type:'section',ticketFrom:'函館',ticketTo:'国縫'});
  assert.equal(r.calculationFrom,'国縫');assert.equal(r.fareDistance,95);assert.equal(r.base,310);assert.ok(!r.notes.some(s=>s.includes('第69条')));
});
test('現行の苗穂営業キロは過去マスタを上書き適用しない',()=>{
  // JR北海道 fare/pdf/05.pdf の札幌〜苗穂1.9km、苗穂〜白石3.9km。
  const point=name=>CORRIDORS.sapporo.find(s=>s.name===name).pos;
  assert.equal(point('苗穂')-point('札幌'),19);assert.equal(point('白石')-point('苗穂'),39);
});
test('不明・区間外・使用状況が曖昧な入力を0円として扱わない',()=>{
  for(const input of [
    {boarding:'森',type:'amount',ticketFrom:'函館',paid:'310'},
    {boarding:'森',type:'section',ticketFrom:'函館',ticketTo:'大沼'},
    {boarding:'函館',type:'section',ticketFrom:'森',ticketTo:'八雲'},
    {boarding:'函館',type:'section',ticketFrom:'函館',ticketTo:'札幌'},
    {boarding:'函館',type:'amount',ticketFrom:'函館',paid:'2,530'},
    {boarding:'函館',person:'unknown'}
  ])assert.throws(()=>settlement({corridor:'hakodate',...input}));
});
test('札幌市内の券面表記は制度条件を確認して扱う',()=>{
  const r=settlement({corridor:'sapporo',boarding:'新札幌',type:'section',ticketFrom:'札幌市内',ticketTo:'長万部'});
  assert.equal(r.base,0);
  assert.throws(()=>settlement({corridor:'sapporo',boarding:'札幌',type:'section',ticketFrom:'札幌市内',ticketTo:'東室蘭'}));
  assert.throws(()=>settlement({corridor:'otaru',boarding:'札幌',type:'section',ticketFrom:'札幌市内',ticketTo:'小樽'}));
});
test('金額の曖昧な区切り・指数・符号・小数は推測しない',()=>{
  assert.equal(parseAmount('１，２１０'),1210);assert.equal(parseAmount(' 1210 '),1210);
  for(const value of ['12,10','1,2,10','1e3','+310','310.0','0x136','-310','310円','0010','Infinity','',null])assert.throws(()=>parseAmount(value));
});
test('駅名検索：ひらがな・カタカナ・変換中・小さいヶ・駅の接尾辞',()=>{
  assert.equal(resolveStation(CORRIDORS.hakodate,'シンハコダテホクト').name,'新函館北斗');
  assert.equal(resolveStation(CORRIDORS.hakodate,'駒ヶ岳駅').name,'駒ケ岳');
  assert.equal(stationMatches(CORRIDORS.hakodate,'はこ')[0].name,'函館');
  assert.equal(stationMatches(CORRIDORS.sapporo,'しま')[0].name,'島松');
  assert.equal(resolveStation(CORRIDORS.hakodate,'はこ'),undefined);
  assert.equal(normalizeStation(' ｼﾝｻｯﾎﾟﾛ駅 '),'しんさっぽろ');
  assert.ok(stationMatches(CORRIDORS.sapporo,'').length<=8);
});
test('すべての経路・原券区間で内訳と合計が一致し乗継で運賃が変わらない',()=>{
  let count=0;
  for(const [corridor,list]of Object.entries(CORRIDORS))for(const person of ['adult','child'])
    for(let a=0;a<list.length-1;a++)for(let b=a+1;b<list.length;b++){
      const input={corridor,boarding:list[a].name,type:'section',ticketFrom:list[a].name,ticketTo:list[b].name,person};
      const r=settlement(input),transfer=list[b].name==='長万部'?r:settlement({...input,boarding:list[b].name});
      assert.equal(r.base,transfer.base);assert.equal(r.base,r.lines.reduce((s,l)=>s+(l.subtract?-l.value:l.value),0));
      assert.ok(Number.isSafeInteger(r.total)&&r.total>=0&&r.total%10===0);assert.equal(r.total,r.base+r.charge);count++;
    }
  assert.ok(count>3000);
});
test('100km境界の分類は整数0.1km単位',()=>{
  assert.equal(extensionRule(999),'difference');assert.equal(extensionRule(1000),'difference');assert.equal(extensionRule(1001),'extension');
  for(const value of [100.1,-1,NaN,Infinity])assert.throws(()=>extensionRule(value));
});
test('公開ファイルの版が一致し新旧の計算データを混在させない',()=>{
  for(const file of ['app.js','calculator.js','fare-screen.js']){
    const source=readFileSync(new URL(file,import.meta.url),'utf8');
    const imports=[...source.matchAll(/from '\.\/[^']+\?v=([^']+)'/g)];assert.ok(imports.length);
    for(const match of imports)assert.equal(match[1],META.version);
  }
  const html=readFileSync(new URL('index.html',import.meta.url),'utf8');assert.ok(html.includes(`app.js?v=${META.version}`));assert.ok(html.includes(`style.css?v=${META.version}`));
});
