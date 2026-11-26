import { FARES, CORRIDORS, ROUTES } from './data.js?v=1.1.1';
import { resolveStation } from './station-picker.js?v=1.1.1';

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
export function amountOptions(corridor, from, person = 'adult') {
  passenger(person);
  const station = getStation(corridor,from);
  const addition = station.name === '新千歳空港' ? (person === 'child' ? 10 : 20) : 0;
  return [...new Set(FARES.filter(([max]) => max <= 100).map(([,value]) => (person === 'child' ? childAmount(value) : value)+addition))];
}
export function extensionRule(originalDistance) {
  if (!Number.isInteger(originalDistance) || originalDistance <= 0) throw new FareError('原券の区間を確認してください。');
  // 営業キロの1km未満は切り上げ、100km以内／101km以上で区分。
  const roundedKm = Math.ceil(originalDistance / 10);
  return roundedKm >= 101 ? 'extension' : 'difference';
}
function assertCityLabel(corridor, input, destination) {
  if (String(input).includes('市内') && (!['sapporo','muroran'].includes(corridor) || distance(corridor,'札幌',destination) <= 2000)) throw new FareError('札幌市内の表示と経路・着駅を確認してください。この原券区間は市内制度の条件を満たしません。');
}

export function settlement({ corridor, boarding, person = 'adult', type = 'none', paid = '', ticketFrom, ticketTo = '',
  express = false, expressFrom, expressTicket = 'none', expressTicketFrom, expressTo = '' }) {
  passenger(person);
  if (!['none','amount','section'].includes(type)) throw new FareError('乗車券の種類を選択してください。');
  const actual = getStation(corridor,boarding), end = getStation(corridor,'長万部');
  if (actual.pos >= end.pos) throw new FareError('長万部より手前の乗車駅を選択してください。');
  const fullDistance = distance(corridor,actual.name), fullFare = journeyFare(corridor,actual.name,'長万部',person);
  let base = fullFare, originalFare = 0, originalDistance = null, calculationFrom = actual.name;
  let method = '乗車区間の運賃', rule = 'full';
  let lines = [{label:`${actual.name}〜長万部`,value:fullFare}];
  let explanation = `${actual.name}〜長万部の運賃を収受します。`;
  const notes = [];
  if (type === 'amount' || type === 'section') {
    const start = getStation(corridor,ticketFrom === undefined ? actual.name : ticketFrom);
    calculationFrom = start.name;
    if (start.pos > actual.pos) throw new FareError('券面の発駅より手前から乗車しているため、この乗越計算では扱えません。');
    if (type === 'amount') {
      if (String(ticketFrom).includes('市内')) throw new FareError('金額式の発駅は具体的な駅名を選択してください。');
      originalFare = parseAmount(paid);
      if (!amountOptions(corridor,start.name,person).includes(originalFare)) throw new FareError('券面金額とおとな・こどもを確認してください。101km以上のきっぷは「区間の乗越」で発着駅を入力します。');
      const minimum = journeyFare(corridor,start.name,actual.name,person), target = journeyFare(corridor,start.name,'長万部',person);
      if (originalFare < minimum || originalFare > target) throw new FareError('券面金額と発駅・乗車駅・経路の組合せを確認してください。');
      base = target-originalFare; rule = 'amount'; method = '金額式：全区間との差額';
      lines = [{label:`${start.name}〜長万部`,value:target},{label:'券面金額',value:originalFare,subtract:true}];
      explanation = `${yen(target)}円 − ${yen(originalFare)}円 ＝ ${yen(base)}円`;
    } else {
      const last = getStation(corridor,ticketTo);
      if (last.pos <= start.pos || last.pos > end.pos) throw new FareError('券面の発着駅を、長万部へ向かう順に選択してください。');
      // 原券着駅での列車乗継も、同じ旅行の継続乗越として扱う。
      if (last.pos < actual.pos) throw new FareError('原券の着駅が今回の乗車駅より手前です。既に精算済みの区間がないか係員が確認してください。');
      assertCityLabel(corridor,ticketFrom,last.name);
      originalDistance = distance(corridor,start.name,last.name); originalFare = journeyFare(corridor,start.name,last.name,person);
      if (last.name === '長万部') {
        base = 0; rule = 'covered'; method = '長万部まで有効'; lines = [{label:'追加運賃',value:0}]; explanation = '入力した乗車券は長万部まで有効です。';
      } else if (extensionRule(originalDistance) === 'difference') {
        const target = journeyFare(corridor,start.name,'長万部',person);
        base = Math.max(0,target-originalFare); rule = 'difference'; method = '原券100km以内：全区間の差額';
        lines = [{label:`${start.name}〜長万部`,value:target},{label:`原券 ${start.name}〜${last.name}`,value:originalFare,subtract:true}];
        explanation = `${yen(target)}円 − ${yen(originalFare)}円 ＝ ${yen(base)}円`;
      } else {
        calculationFrom=last.name;
        base = journeyFare(corridor,last.name,'長万部',person); rule = 'extension'; method = '原券101km以上：乗越区間の運賃';
        lines = [{label:`乗越 ${last.name}〜長万部`,value:base}];
        explanation = `原券${(originalDistance/10).toFixed(1)}km（1km未満切上げで${Math.ceil(originalDistance/10)}km）は101km以上のため、原券運賃を差し引かず、乗越区間を別途収受します。`;
      }
    }
  }
  let charge = 0, fullCharge = 0, oldCharge = 0, chargeLines = [], expressOrigin = '';
  if (express) {
    if([expressFrom,expressTicketFrom,expressTo].some(s=>String(s??'').includes('市内')))throw new FareError('特急の区間は市内表示を使わず、具体的な駅名を入力してください。');
    const route = ROUTES.find(r => r.stops && r.corridor === (corridor === 'airport' ? 'sapporo' : corridor));
    if (!route) throw new FareError('特急北斗の対応経路を選択してください。');
    const origin = getStation(corridor,expressFrom === undefined ? (actual.name === '新千歳空港' ? '南千歳' : actual.name) : expressFrom);
    expressOrigin = origin.name;
    if (!route.stops.includes(origin.name) || origin.pos < actual.pos || origin.pos >= end.pos) throw new FareError('特急の乗車駅を、今回の乗車駅以後の北斗停車駅から選択してください。');
    fullCharge = expressFee(distance(corridor,origin.name),person);
    if (expressTicket === 'none') { charge = fullCharge; chargeLines = [{label:`${origin.name}〜長万部`,value:charge}]; }
    else if (expressTicket === 'valid') { chargeLines = [{label:'長万部までの特急券あり',value:0}]; }
    else if (expressTicket === 'extend') {
      const start = getStation(corridor,expressTicketFrom === undefined ? origin.name : expressTicketFrom), last = getStation(corridor,expressTo);
      if (!route.stops.includes(start.name) || !(route.stops.includes(last.name) || last.name === '長万部') || start.pos > origin.pos || last.pos <= origin.pos || last.pos <= start.pos || last.pos > end.pos) throw new FareError('今回乗る北斗の区間を含む、同じ列車の特急券の発着駅を入力してください。');
      fullCharge = expressFee(distance(corridor,start.name),person); oldCharge = expressFee(distance(corridor,start.name,last.name),person);
      charge = Math.max(0,fullCharge-oldCharge);
      chargeLines = [{label:`${start.name}〜長万部`,value:fullCharge},{label:`原券 ${start.name}〜${last.name}`,value:oldCharge,subtract:true}];
    } else throw new FareError('特急券の状態を選択してください。');
  }
  if (fareDistance(corridor,calculationFrom) !== distance(corridor,calculationFrom)) notes.push('運賃は札幌市内の中心駅（札幌）基準。特急料金は実際の特急区間を使用。');
  if (corridor === 'sawara' && getStation(corridor,calculationFrom).pos <= 270) notes.push('大沼〜森は第69条の短い22.5kmで運賃を計算。');
  if (calculationFrom === '新千歳空港') notes.push(`空港加算運賃${person === 'child' ? 10 : 20}円を各該当区間に含みます。`);
  return {base,charge,total:base+charge,fullFare,fullDistance,fareDistance:fareDistance(corridor,calculationFrom),originalFare,originalDistance,method,rule,explanation,fullCharge,oldCharge,lines,chargeLines,notes,boarding:actual.name,calculationFrom,expressOrigin,person,type};
}
