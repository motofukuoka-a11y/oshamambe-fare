import { FARES, CORRIDORS, ROUTES } from './data.js?v=1.4.0';
import { resolveStation, normalizeStation } from './station-picker.js?v=1.4.0';
import { discountRule, discountAmount, verifyDiscount, isZipang, isOtona, isMemberDiscount, zipangDate } from './discounts.js?v=1.4.0';

export class FareError extends Error {}
export const yen = n => new Intl.NumberFormat('ja-JP').format(n);
export const childAmount = n => Math.floor(n / 20) * 10;
const passenger = person => { if (!['adult','child'].includes(person)) throw new FareError('おとな・こどもを選択してください。'); };

export function fare(tenths, person = 'adult') {
  passenger(person);
  if (!Number.isInteger(tenths) || tenths < 0) throw new FareError('距離を確認してください。');
  if (!tenths) return 0;
  const row = FARES.find(([max]) => tenths <= max * 10);
  if (!row) throw new FareError('普通運賃表の対応範囲外です。');
  return person === 'child' ? childAmount(row[1]) : row[1];
}
export function expressFee(tenths, person = 'adult') {
  passenger(person);
  if (!Number.isInteger(tenths) || tenths < 0) throw new FareError('特急区間を確認してください。');
  if (!tenths) return 0;
  const row = [[25,850],[50,1160],[100,1680],[150,2360],[200,2730],[300,2950]].find(([max]) => tenths <= max * 10);
  if (!row) throw new FareError('特急料金の対応範囲外です。');
  return person === 'child' ? childAmount(row[1]) : row[1];
}
export function getStation(corridor, input) {
  const station = resolveStation(CORRIDORS[corridor] || [],input);
  if (!station) throw new FareError('駅名を候補から選択してください。漢字・ひらがな・カタカナで検索できます。');
  return station;
}
export function distance(corridor, from, to = '長万部') {
  const a = getStation(corridor,from), b = getStation(corridor,to);
  let d = Math.abs(b.pos-a.pos);
  // 第69条。砂原支線内発着には短絡を適用しない。
  if (corridor === 'sawara' && Math.min(a.pos,b.pos) <= 270 && Math.max(a.pos,b.pos) >= 623) d -= 128;
  return d;
}
const cityStations = ['札幌','苗穂','白石','平和','新札幌','上野幌'];
export function fareDistance(corridor, from, to = '長万部') {
  const a = getStation(corridor,from).name, b = getStation(corridor,to).name;
  if (['sapporo','muroran'].includes(corridor) && ((cityStations.includes(a) && b === '長万部') || (cityStations.includes(b) && a === '長万部'))) {
    const centerDistance=distance(corridor,'札幌','長万部');
    if(centerDistance>2000)return centerDistance;
  }
  return distance(corridor,a,b);
}
export function journeyFare(corridor, from, to = '長万部', person = 'adult') {
  const a = getStation(corridor,from).name, b = getStation(corridor,to).name;
  const addition = a !== b && (a === '新千歳空港' || b === '新千歳空港') ? 20 : 0;
  return fare(fareDistance(corridor,a,b),person) + (person === 'child' ? childAmount(addition) : addition);
}
export function parseAmount(value) {
  if (value === null || value === undefined || String(value).trim() === '') throw new FareError('券面金額を入力してください。');
  const text = String(value).normalize('NFKC').trim();
  if (!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(text)) throw new FareError('券面金額は円単位の整数で入力してください。');
  const n = Number(text.replaceAll(',',''));
  if (!Number.isSafeInteger(n) || n <= 0 || n % 10) throw new FareError('券面金額は10円単位の正の整数で入力してください。');
  return n;
}
export function amountOptions(corridor, from, person = 'adult', discount = 'none') {
  passenger(person);
  const station = getStation(corridor,from);
  const addition = station.name === '新千歳空港' ? (person === 'child' ? 10 : 20) : 0;
  const rule=discountRule(discount);
  if(!['none','disability_companion'].includes(discount))return [];
  return [...new Set(FARES.filter(([max]) => max <= 100).map(([,value]) => discountAmount((person === 'child' ? childAmount(value) : value)+addition,rule.percent)))];
}
export function extensionRule(originalDistance) {
  if (!Number.isInteger(originalDistance) || originalDistance <= 0) throw new FareError('原券の区間を確認してください。');
  // 営業キロの1km未満は切り上げ、100km以内／101km以上で区分。
  const roundedKm = Math.ceil(originalDistance / 10);
  return roundedKm >= 101 ? 'extension' : 'difference';
}
function assertCityLabel(corridor, input, destination) {
  if (normalizeStation(input).includes('市内') && (!['sapporo','muroran'].includes(corridor) || distance(corridor,'札幌',destination) <= 2000)) throw new FareError('札幌市内の表示と経路・着駅を確認してください。この原券区間は市内制度の条件を満たしません。');
}

// 券面の各項目に入力できる駅。posは全経路で長万部へ向かって増える。
// 発駅は現在地から後方へ、着駅は現在地から長万部へ向かう順で返す。
export function stationChoices({corridor,boarding,ticketFrom,expressFrom,expressTicketFrom,discount},field) {
  const list=CORRIDORS[corridor] || [],actual=resolveStation(list,boarding);
  if(!actual || actual.name==='長万部')return [];
  const productRoute=ROUTES.find(r=>r.stops && r.corridor===(corridor==='muroran'?'sapporo':corridor));
  const fareStations=discount==='tokudane'?list.filter(s=>productRoute?.stops.includes(s.name)||s.name==='長万部'):list;
  if(field==='ticketFrom')return fareStations.filter(s=>s.pos<=actual.pos).slice().reverse();
  if(field==='ticketTo') {
    const start=resolveStation(list,ticketFrom);
    if(!start || start.pos>actual.pos)return [];
    return fareStations.filter(s=>s.pos>=actual.pos && s.pos>start.pos).filter(s=>{
      try{assertCityLabel(corridor,ticketFrom,s.name);return true;}catch{return false;}
    });
  }
  const route=ROUTES.find(r=>r.stops && r.corridor===(corridor==='airport'?'sapporo':corridor));
  if(!route)return [];
  const stops=list.filter(s=>route.stops.includes(s.name)||s.name==='長万部');
  if(field==='expressFrom')return stops.filter(s=>s.pos>=actual.pos && s.name!=='長万部');
  const origin=resolveStation(list,expressFrom ?? (actual.name==='新千歳空港'?'南千歳':actual.name));
  if(!origin || !route.stops.includes(origin.name) || origin.pos<actual.pos)return [];
  if(field==='expressTicketFrom')return stops.filter(s=>s.pos<=origin.pos).slice().reverse();
  const start=resolveStation(list,expressTicketFrom ?? origin.name);
  if(field==='expressTo' && start && route.stops.includes(start.name) && start.pos<=origin.pos)return stops.filter(s=>s.pos>origin.pos);
  return [];
}

export function settlement(input) {
  const { corridor, boarding, person = 'adult', type = 'none', paid = '', ticketFrom, ticketTo = '',
    express = false, expressFrom, expressTicket = 'none', expressTicketFrom, expressTo = '' }=input;
  passenger(person);
  if (!['none','amount','section'].includes(type)) throw new FareError('乗車券の種類を選択してください。');
  const actual = getStation(corridor,boarding), end = getStation(corridor,'長万部');
  if (actual.pos >= end.pos) throw new FareError('長万部より手前の乗車駅を選択してください。');
  const fullDistance = distance(corridor,actual.name), fullFare = journeyFare(corridor,actual.name,'長万部',person);
  const discount=discountRule(input.discount ?? 'none');
  const priced=(from,to='長万部',percent=discount.percent)=>discountAmount(journeyFare(corridor,from,to,person),percent);
  const verify=(d,newTicket=false)=>verifyDiscount(discount,{person,distance:d,confirmed:input.discountConfirmed,date:input.travelDate,newTicket});
  if(discount.id==='tokudane' && type!=='section')throw new FareError('トクだ値は「区間の乗越」で予約された発着駅を入力してください。');
  if(discount.id==='tokudane' && !['same','fareOnly'].includes(input.tokudaneUse))throw new FareError('トクだ値の利用状態を選択してください。');
  let base = fullFare, originalFare = 0, originalDistance = null, calculationFrom = actual.name;
  let method = '乗車区間の運賃', rule = 'full';
  let lines = [{label:`${actual.name}〜長万部`,value:fullFare}];
  let explanation = `${actual.name}〜長万部の運賃を収受します。`;
  const notes = [];
  let originalStart=actual,originalEnd=end;
  if(type==='none'){
    verify(fullDistance,true);base=priced(actual.name);lines=[{label:`${actual.name}〜長万部${discount.id==='none'?'':`（${discount.label}）`}`,value:base}];
  }
  if (type === 'amount' || type === 'section') {
    const start = getStation(corridor,ticketFrom === undefined ? actual.name : ticketFrom);
    originalStart=start;
    calculationFrom = start.name;
    if (start.pos > actual.pos) throw new FareError('券面の発駅より手前から乗車しているため、この乗越計算では扱えません。');
    if (type === 'amount') {
      if (normalizeStation(ticketFrom).includes('市内')) throw new FareError('金額式の発駅は具体的な駅名を選択してください。');
      originalFare = parseAmount(paid);
      if(!['none','disability_companion'].includes(discount.id))throw new FareError('この割引は金額だけでは原券条件を確認できません。「区間の乗越」で券面の発着駅を入力してください。');
      verify(distance(corridor,start.name));
      if (!amountOptions(corridor,start.name,person,discount.id).includes(originalFare)) throw new FareError('券面金額とおとな・こどもを確認してください。101km以上のきっぷは「区間の乗越」で発着駅を入力します。');
      const minimum = priced(start.name,actual.name), target = priced(start.name);
      if (originalFare < minimum || originalFare > target) throw new FareError('券面金額と発駅・乗車駅・経路の組合せを確認してください。');
      base = target-originalFare; rule = 'amount'; method = '金額式：全区間との差額';
      lines = [{label:`${start.name}〜長万部`,value:target},{label:'券面金額',value:originalFare,subtract:true}];
      explanation = `${yen(target)}円 − ${yen(originalFare)}円 ＝ ${yen(base)}円`;
    } else {
      const last = getStation(corridor,ticketTo);
      originalEnd=last;
      if (last.pos <= start.pos || last.pos > end.pos) throw new FareError('券面の発着駅を、長万部へ向かう順に選択してください。');
      // 原券着駅での列車乗継も、同じ旅行の継続乗越として扱う。
      if (last.pos < actual.pos) throw new FareError('原券の着駅が今回の乗車駅より手前です。既に精算済みの区間がないか係員が確認してください。');
      assertCityLabel(corridor,ticketFrom,last.name);
      originalDistance = distance(corridor,start.name,last.name);verify(originalDistance);
      originalFare = discount.id==='tokudane'?null:priced(start.name,last.name);
      if(discount.id==='tokudane'){
        const route=ROUTES.find(r=>r.stops && r.corridor===(corridor==='muroran'?'sapporo':corridor));
        if(!route || !route.stops.includes(start.name) || !(route.stops.includes(last.name)||last.name==='長万部'))throw new FareError('北斗のトクだ値の券面発着駅を入力してください。砂原・空港乗継を含む商品は個別確認が必要です。');
        if(input.tokudaneUse==='same'&&!express)throw new FareError('普通列車では、トクだ値の「乗車券部分のみ有効」を確認して選択してください。');
      }
      if (last.name === '長万部') {
        base = 0; rule = 'covered'; method = '長万部まで有効'; lines = [{label:'追加運賃',value:0}]; explanation = '入力した乗車券は長万部まで有効です。';
      } else if (!discount.product && extensionRule(originalDistance) === 'difference') {
        const target = priced(start.name);
        base = Math.max(0,target-originalFare); rule = 'difference'; method = '原券100km以内：全区間の差額';
        lines = [{label:`${start.name}〜長万部`,value:target},{label:`原券 ${start.name}〜${last.name}`,value:originalFare,subtract:true}];
        explanation = `${yen(target)}円 − ${yen(originalFare)}円 ＝ ${yen(base)}円`;
      } else {
        calculationFrom=last.name;
        let rate=discount.percent;
        if(discount.id==='student'||discount.product)rate=0;
        if(discount.id==='disability_single' && extensionRule(distance(corridor,last.name))==='difference'){
          if(!['apply','normal'].includes(input.overrunDiscount))throw new FareError('身障・単独の短区間乗越は、乗越区間への割引適用を確認して選択してください。');
          rate=input.overrunDiscount==='apply'?50:0;
        }
        base = priced(last.name,'長万部',rate); rule = 'extension'; method = discount.product?'割引商品の区間外：通常運賃を別途':discount.id==='student'?'学割原券の乗越：通常運賃を別途':'原券101km以上：乗越区間の運賃';
        lines = [{label:`乗越 ${last.name}〜長万部${rate?`（${rate/10}割引）`:''}`,value:base}];
        explanation = discount.product?'商品条件により区間外は無割引の運賃を別途収受します。原券の発売額は差し引きません。':discount.id==='student'?'学生割引は原券の割引を乗越区間に自動継続せず、乗越区間の通常運賃を収受します。':`原券${(originalDistance/10).toFixed(1)}km（1km未満切上げで${Math.ceil(originalDistance/10)}km）は101km以上のため、原券運賃を差し引かず、乗越区間を別途収受します。`;
      }
    }
  }
  const fareRule=type==='none'||rule==='covered'?'':isOtona(discount.id)?'otona':isZipang(discount.id)?'zipang':discount.id==='tokudane'?'tokudane':'ordinary';
  let charge = 0, fullCharge = 0, oldCharge = 0, chargeLines = [], expressOrigin = '',chargeMethod='特急料金',chargeRule='';
  if (express) {
    if([expressFrom,expressTicketFrom,expressTo].some(s=>normalizeStation(s).includes('市内')))throw new FareError('特急の区間は市内表示を使わず、具体的な駅名を入力してください。');
    const route = ROUTES.find(r => r.stops && r.corridor === (corridor === 'airport' ? 'sapporo' : corridor));
    if (!route) throw new FareError('特急北斗の対応経路を選択してください。');
    const origin = getStation(corridor,expressFrom === undefined ? (actual.name === '新千歳空港' ? '南千歳' : actual.name) : expressFrom);
    expressOrigin = origin.name;
    if (!route.stops.includes(origin.name) || origin.pos < actual.pos || origin.pos >= end.pos) throw new FareError('特急の乗車駅を、今回の乗車駅以後の北斗停車駅から選択してください。');
    if(isMemberDiscount(discount.id)&&expressTicket!=='valid'&&input.expressDiscount===undefined)throw new FareError('乗車券から特急券の割引を推定しません。特急料金の割引を券面で選択してください。');
    const feeId=input.expressDiscount===undefined?'none':input.expressDiscount;
    if(!['none','zip20','zip30','otona30'].includes(feeId))throw new FareError('特急料金の割引を選択してください。');
    const feeRule=discountRule(feeId),feePrice=d=>discountAmount(expressFee(d,person),feeRule.percent);
    let feeKind=expressTicket;
    if(discount.id==='tokudane'&&input.tokudaneUse==='same')feeKind='product';
    if(isZipang(feeId)&&!['valid','product'].includes(feeKind)){
      if(!isZipang(discount.id)&&!['disability_single','disability_companion'].includes(discount.id))throw new FareError('ジパングの特急料金は、対応する割引乗車券との組合せを確認してください。');
      if((!isZipang(discount.id)||(feeKind==='none'&&type!=='none'))&&input.expressDiscountConfirmed!==true)throw new FareError('料金券を別に購入するための購入証・会員手帳と、乗車券区間内の組合せ条件を確認してください。');
      verifyDiscount(feeRule,{person,distance:distance(corridor,originalStart.name,originalEnd.name),confirmed:isZipang(discount.id)?input.discountConfirmed:input.expressDiscountConfirmed,date:input.travelDate,newTicket:feeKind==='none'});
      if(feeKind==='none' && (type==='amount'||originalEnd.name!=='長万部'))throw new FareError('特急の全区間を含むジパング対応の乗車券を確認してください。条件を満たさない場合は特急料金の割引を「なし」にします。');
    }
    if(isOtona(feeId)&&!['valid','product'].includes(feeKind)){
      if(!isOtona(discount.id))throw new FareError('大休ジパングの料金券は、東日本・北海道限定の大休割引乗車券との組合せで入力してください。全国ジパング・身障割とは別制度です。');
      if(feeKind==='none'&&type!=='none'&&input.expressDiscountConfirmed!==true)throw new FareError('料金券別購入の会員本人・大人の休日倶楽部カード決済・大休割引乗車券区間内の条件を確認してください。');
      verifyDiscount(feeRule,{person,distance:distance(corridor,originalStart.name,originalEnd.name),confirmed:input.discountConfirmed,date:input.travelDate,newTicket:feeKind==='none'});
      if(feeKind==='none'&&(type==='amount'||originalEnd.name!=='長万部'))throw new FareError('特急の全区間を含む大休割引乗車券を確認してください。区間外の新規料金に大休割引を自動適用できません。');
    }
    fullCharge = feePrice(distance(corridor,origin.name));
    if (feeKind === 'none') { charge = fullCharge; chargeLines = [{label:`${origin.name}〜長万部${feeRule.percent?`（${feeRule.label}）`:''}`,value:charge}]; }
    else if (feeKind === 'valid') { chargeLines = [{label:'長万部までの特急券あり',value:0}]; }
    else if (feeKind==='product'){
      if(discount.id!=='tokudane'||input.tokudaneUse!=='same'||originalStart.pos>origin.pos||originalEnd.pos<=origin.pos)throw new FareError('今回の北斗の利用区間を含む、同じ指定列車のトクだ値を確認してください。');
      charge=expressFee(distance(corridor,originalEnd.name),person);chargeLines=[{label:`区間外 ${originalEnd.name}〜長万部（通常料金）`,value:charge}];chargeMethod='トクだ値の区間外：特急料金を別途';
      fullCharge=null;oldCharge=null;chargeRule='tokudane';
    }
    else if (feeKind === 'extend') {
      const start = getStation(corridor,expressTicketFrom === undefined ? origin.name : expressTicketFrom), last = getStation(corridor,expressTo);
      if (!route.stops.includes(start.name) || !(route.stops.includes(last.name) || last.name === '長万部') || start.pos > origin.pos || last.pos <= origin.pos || last.pos <= start.pos || last.pos > end.pos) throw new FareError('今回乗る北斗の区間を含む、同じ列車の特急券の発着駅を入力してください。');
      fullCharge = feePrice(distance(corridor,start.name)); oldCharge = feePrice(distance(corridor,start.name,last.name));
      if(isMemberDiscount(feeId)){
        if(start.pos<originalStart.pos||last.pos>originalEnd.pos)throw new FareError('原特急券の区間が、入力した割引乗車券の有効区間に含まれるか確認してください。');
        charge=expressFee(distance(corridor,last.name),person);chargeLines=[{label:`区間外 ${last.name}〜長万部（通常料金）`,value:charge}];chargeMethod=`${isOtona(feeId)?'大休ジパング':'全国ジパング'}の区間外：特急料金を別途`;
        fullCharge=null;oldCharge=null;chargeRule=isOtona(feeId)?'otona':'zipang';
      }else{
        // 第252条7・8項。同一列車の実乗区間料金と既収料金を比較。第249条の100km区分は適用しない。
        charge = Math.max(0,fullCharge-oldCharge);
        chargeLines = [{label:`${start.name}〜長万部`,value:fullCharge},{label:`原券 ${start.name}〜${last.name}`,value:oldCharge,subtract:true}];
        chargeMethod='通常特急券：原券発駅からの料金差額';
        chargeRule='express';
      }
    } else throw new FareError('特急券の状態を選択してください。');
  }
  if (fareDistance(corridor,calculationFrom) !== distance(corridor,calculationFrom)) notes.push('運賃は札幌市内の中心駅（札幌）基準。特急料金は実際の特急区間を使用。');
  if (corridor === 'sawara' && getStation(corridor,calculationFrom).pos <= 270) notes.push('大沼〜森は第69条の短い22.5kmで運賃を計算。');
  if (calculationFrom === '新千歳空港') notes.push(`空港加算運賃${person === 'child' ? 10 : 20}円を各該当区間に含みます。`);
  if(discount.id!=='none')notes.push(`${discount.label}。表示は選択した1人分。原券の有効性・証明書・同行等の適用条件を確認済みとして計算。`);
  if(['student','disability_single','disability_companion'].includes(discount.id))notes.push('学割・身障割は普通乗車券の割引です。北斗の特急料金には適用しません。');
  return {base,charge,total:base+charge,fullFare,fullDistance,fareDistance:fareDistance(corridor,calculationFrom),originalFare,originalDistance,method,rule,explanation,fareRule,fullCharge,oldCharge,lines,chargeLines,chargeMethod,chargeRule,notes,boarding:actual.name,calculationFrom,expressOrigin,person,type,discount:discount.id};
}
