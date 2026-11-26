import {FARES,CORRIDORS} from './data.js';
export class FareError extends Error {}
export const yen = n => new Intl.NumberFormat('ja-JP').format(n);
export const childAmount = n => Math.floor(n/20)*10;
export function fare(tenths, person='adult') {
  if (!Number.isInteger(tenths) || tenths < 0) throw new FareError('距離を確認してください。');
  if (tenths===0) return 0;
  const row=FARES.find(([max])=>tenths<=max*10);
  if(!row) throw new FareError('対応する運賃表の範囲外です。');
  return person==='child'?childAmount(row[1]):row[1];
}
export function expressFee(tenths, person='adult') {
  if (!Number.isInteger(tenths)||tenths<0) throw new FareError('特急区間を確認してください。');
  if(!tenths) return 0;
  const row=[[25,850],[50,1160],[100,1680],[150,2360],[200,2730],[300,2950]].find(([max])=>tenths<=max*10);
  if(!row) throw new FareError('特急料金の対応範囲外です。');
  return person==='child'?childAmount(row[1]):row[1];
}
export function getStation(corridor,name) {
  const s=CORRIDORS[corridor]?.find(s=>s.name===name);
  if(!s) throw new FareError('候補にある駅名を選択してください。');
  return s;
}
export function distance(corridor,from,to='長万部') {
  const a=getStation(corridor,from),b=getStation(corridor,to);
  let d=Math.abs(b.pos-a.pos);
  // 第69条：大沼〜森の両端を通過する場合、砂原経由でも22.5kmで計算。
  if(corridor==='sawara'&&Math.min(a.pos,b.pos)<=270&&Math.max(a.pos,b.pos)>=623) d-=128;
  return d;
}
export function fareDistance(corridor,from,to='長万部') {
  let d=distance(corridor,from,to);
  // 第86条：室蘭・千歳線経由は札幌中心駅〜長万部が200km超。
  const city=['札幌','苗穂','白石','平和','新札幌','上野幌'];
  if(['sapporo','muroran'].includes(corridor)&&((city.includes(from)&&to==='長万部')||(city.includes(to)&&from==='長万部')))d=2064;
  return d;
}
export function journeyFare(corridor,from,to='長万部',person='adult') {
  const d=fareDistance(corridor,from,to);
  const surcharge=(from==='新千歳空港'||to==='新千歳空港')?20:0;
  return fare(d,person)+(person==='child'?childAmount(surcharge):surcharge);
}
function amount(value,label) {
  if(value===''||value===null||value===undefined) throw new FareError(`${label}を入力してください。`);
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0||n%10!==0) throw new FareError(`${label}は10円単位の整数で入力してください。`);
  return n;
}
export function settlement({corridor,boarding,person='adult',type='none',paid='',ticketFrom='',ticketTo='',express=false,expressTicket='none',expressTo=''}) {
  if(!['adult','child'].includes(person)||!['none','amount','section'].includes(type)) throw new FareError('精算条件を確認してください。');
  const actual=getStation(corridor,boarding),end=getStation(corridor,'長万部');
  if(actual.pos>=end.pos) throw new FareError('長万部より手前の乗車駅を選択してください。');
  const fullDistance=distance(corridor,boarding),fullFare=journeyFare(corridor,boarding,'長万部',person);
  let base=fullFare,originalFare=0,originalDistance=null,method='乗車区間の運賃',explanation=`${boarding}〜長万部の運賃を収受します。`;
  if(type==='amount') {
    originalFare=amount(paid,'券面金額');
    const add=boarding==='新千歳空港'?(person==='child'?10:20):0;
    const allowed=FARES.filter(([max])=>max<=100).map(([,value])=>(person==='child'?childAmount(value):value)+add);
    if(!allowed.includes(originalFare)) throw new FareError('100km以内の普通運賃額を入力してください。100kmを超えるきっぷは「区間の乗越」で発着駅を入力してください。');
    if(originalFare>fullFare)throw new FareError('券面金額が長万部までの運賃を上回ります。発駅・金額・経路を確認してください。');
    base=Math.max(0,fullFare-originalFare);method='全区間運賃と券面金額の差額';
    explanation='100km以内・無割引の金額式乗車券として、長万部までの運賃から券面金額を差し引きます。';
  }
  if(type==='section') {
    const start=getStation(corridor,ticketFrom),last=getStation(corridor,ticketTo);
    if(start.pos>=last.pos) throw new FareError('券面の着駅は、発駅から長万部へ向かう順に選択してください。');
    if(start.pos>actual.pos||last.pos<=actual.pos) throw new FareError('入力した乗車券の有効区間内に乗車駅がありません。発着駅を確認してください。');
    originalDistance=distance(corridor,ticketFrom,ticketTo);
    originalFare=journeyFare(corridor,ticketFrom,ticketTo,person);
    if(last.pos===end.pos){base=0;method='長万部まで有効';explanation='乗車券は長万部まで有効です。追加の運賃はありません。';}
    else if(originalDistance<=1000) {
      base=Math.max(0,journeyFare(corridor,ticketFrom,'長万部',person)-originalFare);
      method='100km以内：全区間の差額';
      explanation=`${ticketFrom}〜長万部 ${yen(journeyFare(corridor,ticketFrom,'長万部',person))}円 − ${ticketFrom}〜${ticketTo} ${yen(originalFare)}円`;
    } else {base=journeyFare(corridor,ticketTo,'長万部',person);method='100km超：乗越区間の運賃';explanation=`原券の区間は${(originalDistance/10).toFixed(1)}km。${ticketTo}〜長万部の運賃を別途収受します。`;}
  }
  let charge=0,fullCharge=0,oldCharge=0;
  if(express) {
    fullCharge=expressFee(boarding==='新千歳空港'?distance(corridor,'南千歳'):fullDistance,person);
    if(expressTicket==='none')charge=fullCharge;
    else if(expressTicket==='valid')charge=0;
    else if(expressTicket==='extend') {
      const last=getStation(corridor,expressTo);
      if(last.pos<=actual.pos||last.pos>end.pos)throw new FareError('特急券の着駅を、乗車駅より先の停車駅から選択してください。');
      oldCharge=expressFee(distance(corridor,boarding==='新千歳空港'?'南千歳':boarding,expressTo),person);
      charge=Math.max(0,fullCharge-oldCharge);
    } else throw new FareError('特急券の状態を選択してください。');
  }
  return {base,charge,total:base+charge,fullFare,fullDistance,fareDistance:fareDistance(corridor,boarding),originalFare,originalDistance,method,explanation,fullCharge,oldCharge};
}
