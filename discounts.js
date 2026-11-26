export const DISCOUNTS = [
  {id:'none',label:'割引なし',percent:0},
  {id:'student',label:'学割（運賃2割引）',percent:20,minKm:101,adult:true},
  {id:'disability_companion',label:'身障 第1種・本人と介護者が同行',percent:50},
  {id:'disability_single',label:'身障 第1種・第2種の本人単独',percent:50,minKm:101},
  {id:'zip20',label:'ジパング 2割引',percent:20,minKm:101,adult:true,product:true},
  {id:'zip30',label:'ジパング 3割引',percent:30,minKm:101,adult:true,product:true},
  {id:'tokudane',label:'特急トクだ値（区間外は別途）',percent:0,product:true}
];
export const isZipang = id => ['zip20','zip30'].includes(id);
export function discountRule(id='none') {
  const rule=DISCOUNTS.find(r=>r.id===id);
  if(!rule)throw new Error('割引・商品の種類を確認してください。');
  return rule;
}
export function discountAmount(amount,percent) {
  if(!Number.isSafeInteger(amount)||amount<0||!Number.isInteger(percent)||percent<0||percent>100)throw new Error('割引額の条件を確認してください。');
  // 第74条の2。小児運賃等を確定してから割引し、10円未満を切り捨てる。
  return Math.floor(amount*(100-percent)/1000)*10;
}
export function zipangDate(date) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw new Error('ジパングの乗車日を入力してください。');
  const d=new Date(`${date}T12:00:00+09:00`);
  if(!Number.isFinite(d.getTime())||d.toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})!==date)throw new Error('乗車日を確認してください。');
  if(date<'2026-03-14')throw new Error('ジパングは2026年3月14日以後の片道条件に対応しています。');
  const md=date.slice(5);
  return (md>='04-27'&&md<='05-06')||(md>='08-10'&&md<='08-19')||md>='12-28'||md<='01-06';
}
export function verifyDiscount(rule,{person,distance,confirmed,date,newTicket=false}) {
  if(rule.id==='none')return;
  if(!Number.isSafeInteger(distance)||distance<=0)throw new Error('割引判定の対象区間を確認してください。');
  if(confirmed!==true)throw new Error('券面・証明書・同行など、選択した割引の適用条件を確認してください。');
  if(rule.adult && person!=='adult')throw new Error('学割・ジパングは「おとな」で入力してください。');
  if(rule.minKm && Math.ceil(distance/10)<rule.minKm)throw new Error(`${rule.label}の片道101km以上の条件を満たしません。${newTicket?'今回の乗車区間':'原券の発着駅'}・割引種別を確認してください。`);
  if(isZipang(rule.id)&&newTicket&&zipangDate(date))throw new Error('入力日はジパングの割引除外日です。割引を適用した新規発売としては計算できません。');
}
export function newDiscountState() {
  return {discount:'none',discountConfirmed:false,travelDate:new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}),overrunDiscount:'',expressDiscount:'none',expressDiscountConfirmed:false,tokudaneUse:'same'};
}
