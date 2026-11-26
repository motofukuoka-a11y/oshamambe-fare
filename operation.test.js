import test from 'node:test';
import assert from 'node:assert/strict';
import {CORRIDORS,ROUTES,FARES} from './data.js';
import {settlement,stationChoices} from './calculator.js';

test('公式幹線運賃表の改定後の全登録区分と照合',()=>{
  // JR北海道 fare/pdf/06.pdf の「改定」欄。境界テストと独立したデータ照合値。
  assert.deepEqual(FARES,[[3,210],[6,270],[10,310],[15,360],[20,470],[25,580],[30,680],[35,800],[40,920],[45,1040],[50,1210],[60,1380],[70,1590],[80,1800],[90,2020],[100,2240],[120,2530],[140,3080],[160,3520],[180,3960],[200,4400],[220,4840],[240,5170],[260,5610],[280,5940],[300,6270]]);
});

// 公式の営業キロ・運賃表から個別に確認した、方面と100km区分の異なる実務例。
for(const [corridor,boarding,ticketFrom,ticketTo,km,adult,child,rule] of [
  ['hakodate','函館','函館','黒岩',944,290,140,'difference'],
  ['hakodate','函館','函館','国縫',1028,310,150,'extension'],
  ['hakodate','国縫','函館','国縫',1028,310,150,'extension'],
  ['otaru','小樽','小樽','目名',967,1280,640,'difference'],
  ['otaru','小樽','小樽','熱郛',1121,680,340,'extension'],
  ['muroran','富浦','富浦','幌別',55,1970,990,'difference'],
  ['muroran','富浦','札幌','富浦',1141,2240,1120,'extension'],
  ['sapporo','札幌','札幌','洞爺',1649,1040,520,'extension'],
])test(`精算照合：${boarding}乗車・原券${ticketFrom}〜${ticketTo}`,()=>{
  for(const [person,expected]of [['adult',adult],['child',child]]){
    const r=settlement({corridor,boarding,ticketFrom,ticketTo,type:'section',person});
    assert.equal(r.originalDistance,km);assert.equal(r.rule,rule);assert.equal(r.base,expected);
  }
});

test('富浦の着駅候補は幌別から長万部へ進み、登別方面を含まない',()=>{
  const state={corridor:'muroran',boarding:'富浦',ticketFrom:'富浦'};
  assert.deepEqual(stationChoices(state,'ticketTo').map(s=>s.name),['幌別','鷲別','東室蘭','本輪西','崎守','黄金','稀府','北舟岡','伊達紋別','長和','有珠','洞爺','豊浦','大岸','礼文','小幌','静狩','長万部']);
  assert.equal(stationChoices(state,'ticketFrom')[0].name,'富浦');
  assert.ok(!stationChoices(state,'ticketFrom').some(s=>s.name==='東室蘭'));
  assert.equal(stationChoices({...state,ticketFrom:'札幌'},'ticketTo')[0].name,'富浦');
});

test('全経路の着駅候補と計算の受付範囲が一致する',()=>{
  let accepted=0,rejected=0;
  for(const [corridor,list]of Object.entries(CORRIDORS))for(const actual of list.slice(0,-1)){
    for(const start of new Set([list[0],actual])){
      const input={corridor,boarding:actual.name,ticketFrom:start.name,type:'section'};
      const choices=stationChoices(input,'ticketTo');
      assert.ok(choices.length);assert.equal(choices.at(-1).name,'長万部');
      for(let i=1;i<choices.length;i++)assert.ok(choices[i].pos>choices[i-1].pos);
      const allowed=new Set(choices.map(s=>s.name));
      for(const last of list){
        if(allowed.has(last.name)){
          assert.doesNotThrow(()=>settlement({...input,ticketTo:last.name}));accepted++;
        }else{assert.throws(()=>settlement({...input,ticketTo:last.name}));rejected++;}
      }
    }
  }
  assert.ok(accepted>1000 && rejected>1000);
});

test('特急の各項目は現在地・券面発駅に合わせた方向に限定する',()=>{
  const state={corridor:'sapporo',boarding:'新札幌',expressFrom:'南千歳',expressTicketFrom:'札幌'};
  assert.deepEqual(stationChoices(state,'expressFrom').map(s=>s.name),['新札幌','南千歳','苫小牧','白老','登別','東室蘭','伊達紋別','洞爺']);
  assert.deepEqual(stationChoices(state,'expressTicketFrom').map(s=>s.name),['南千歳','新札幌','札幌']);
  assert.deepEqual(stationChoices(state,'expressTo').map(s=>s.name),['苫小牧','白老','登別','東室蘭','伊達紋別','洞爺','長万部']);
  assert.deepEqual(stationChoices({...state,expressFrom:''},'expressTo'),[]);
  assert.deepEqual(stationChoices({...state,expressTicketFrom:'洞爺'},'expressTo'),[]);
});

test('特急の全登録停車駅で、候補に現れる原券区間は精算できる',()=>{
  let count=0;
  for(const route of ROUTES.filter(r=>r.stops))for(const boarding of route.stops){
    const input={corridor:route.corridor,boarding,express:true,expressFrom:boarding,expressTicket:'extend'};
    for(const start of stationChoices(input,'expressTicketFrom'))for(const last of stationChoices({...input,expressTicketFrom:start.name},'expressTo')){
      for(const person of ['adult','child']){
        const r=settlement({...input,expressTicketFrom:start.name,expressTo:last.name,person});
        assert.equal(r.charge,r.fullCharge-r.oldCharge);assert.ok(r.charge>=0);count++;
      }
    }
  }
  assert.ok(count>200);
});

test('市内表示の空白によって条件検証をすり抜けない',()=>{
  const state={corridor:'sapporo',boarding:'札幌',type:'section',ticketFrom:'札 幌 市 内',ticketTo:'東室蘭'};
  assert.throws(()=>settlement(state));
  assert.deepEqual(stationChoices(state,'ticketTo').map(s=>s.name),['長万部']);
  assert.throws(()=>settlement({corridor:'sapporo',boarding:'札幌',express:true,expressFrom:'札幌市 内'}));
  assert.throws(()=>settlement({corridor:'sapporo',boarding:'札幌',type:'amount',ticketFrom:'札幌市 内',paid:'310'}));
});

test('不明な発駅や乗車駅から勝手に着駅候補を作らない',()=>{
  for(const ticketFrom of ['', '不明', '長万部'])assert.deepEqual(stationChoices({corridor:'hakodate',boarding:'函館',ticketFrom},'ticketTo'),[]);
  assert.deepEqual(stationChoices({corridor:'unknown',boarding:'函館'},'ticketFrom'),[]);
});
