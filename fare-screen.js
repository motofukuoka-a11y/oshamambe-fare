import { CORRIDORS, META, SETTLEMENT_RULES } from './data.js?v=1.4.0';
import { settlement, yen, amountOptions, stationChoices, distance, extensionRule } from './calculator.js?v=1.4.0';
import { mountStationPicker, resolveStation } from './station-picker.js?v=1.4.0';
import { DISCOUNTS, isOtona, isMemberDiscount } from './discounts.js?v=1.4.0';

const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types = [['none','整理券・乗車券なし'],['amount','金額式（エド券）'],['section','区間の乗越']];
const field = (id,label,value,hint='') => `<div class="field"><label for="${id}">${label}</label><div class="station-input"><input id="${id}" data-station-input value="${esc(value)}" placeholder="駅名・ひらがな" spellcheck="false"></div>${hint?`<small>${hint}</small>`:''}</div>`;

export function renderFareScreen(main,state,{routeDescription,onSave,onNext}) {
  const express = Boolean(state.route.stops), list = CORRIDORS[state.corridor];
  const stationPickers=new Map();
  const routeUrl = `#/route/${state.route.id}?via=${state.corridor}`;
  const person = state.person === 'child' ? 'こども' : 'おとな';
  const quick=state.type==='none'&&!express&&state.discount==='none';
  document.title = `${state.boarding}〜長万部｜着駅精算`;
  main.innerHTML = `<div class="breadcrumb"><a href="#/">メニュー</a><i></i><a href="${routeUrl}">${state.route.title}</a></div>
  <div class="page-head fare-head"><div><p class="eyebrow">${routeDescription()}</p><h1>${esc(state.boarding)} <span class="journey-separator">〜</span> 長万部</h1><p>今回の列車の乗車駅：${esc(state.boarding)}</p></div>
  <div class="person-switch" role="group" aria-label="おとな・こども">${[['adult','おとな'],['child','こども']].map(([v,n])=>`<button type="button" data-person="${v}" aria-pressed="${state.person===v}">${n}</button>`).join('')}</div></div>
  <div class="ticket-tabs modebar" role="group" aria-label="乗車券の種類">${types.map(([v,n])=>`<button type="button" data-type="${v}" aria-pressed="${state.type===v}">${n}</button>`).join('')}</div>
  <div class="discount-control"><label for="discount">乗車券の割引・商品</label><select id="discount">${DISCOUNTS.map(r=>`<option value="${r.id}" ${state.discount===r.id?'selected':''}>${r.label}</option>`).join('')}</select></div>
  <div class="workspace fare-workspace ${quick?'quick-fare':''}">
  ${!quick?`<section class="calc-panel" aria-labelledby="ticket-heading"><div class="panel-heading"><h2 id="ticket-heading">精算条件を入力</h2><p>乗車区間・お持ちのきっぷ・割引条件を確認してください。表示は1人分です。</p></div>
  <div class="panel-body"><form id="ticket-form" novalidate><div id="form-error" class="error" role="alert" hidden></div><div id="discount-fields"></div><div id="ticket-fields"></div><div id="express-fields"></div><button class="submit" type="submit">精算額を表示</button><p class="helper form-note">入力を変更すると前の精算額を解除します。</p></form></div></section>`:''}
  <section class="result-panel" id="result" tabindex="-1" aria-label="精算結果"></section></div>
  <div class="fare-bottom"><button type="button" id="next-ticket" class="secondary-button">次の精算</button><a href="${routeUrl}">乗車駅を選び直す</a><a href="#/guide">対応範囲・根拠</a></div>
  <p id="result-status" class="sr-only" role="status"></p>`;

  const clearResult = () => {
    state.result = null; state.dirty = true; state.error = '';
    const error = main.querySelector('#form-error'); if(error)error.hidden = true;
    main.querySelector('#result-status').textContent='';
    paintResult(); onSave();
  };
  const set = (id,value) => {
    state[id] = value;
    if(['ticketFrom','ticketTo','expressFrom','expressTicketFrom','expressTo','expressTicket','tokudaneUse'].includes(id)){
      state.discountConfirmed=false;state.expressDiscountConfirmed=false;
      for(const name of ['discountConfirmed','expressDiscountConfirmed']){const box=main.querySelector(`#${name}`);if(box)box.checked=false;}
    }
    if(['ticketFrom','ticketTo'].includes(id))state.overrunDiscount='';
    clearResult();if(id==='ticketFrom' && state.type==='amount')paintAmountChoices();if(['ticketFrom','ticketTo'].includes(id))paintDiscountFields();
    if(['ticketFrom','ticketTo','expressFrom','expressTicketFrom'].includes(id))for(const picker of stationPickers.values())picker?.refresh();
  };
  main.querySelector('#discount').addEventListener('change',e=>{
    state.discount=e.target.value;state.expressDiscount=express&&isMemberDiscount(state.discount)&&state.expressTicket!=='valid'?'':'none';state.discountConfirmed=false;state.expressDiscountConfirmed=false;state.overrunDiscount='';state.result=null;state.dirty=true;state.error='';
    if(state.discount==='tokudane'){state.type='section';state.expressTicket='none';state.tokudaneUse=express?'same':'fareOnly';}
    if(state.type==='amount'&&['student','disability_single','zip20','zip30','otona30'].includes(state.discount))state.type='section';
    if(state.discount==='none'&&state.type==='none'&&!express){state.result=settlement({...state,express:false});state.dirty=false;}
    onSave();renderFareScreen(main,state,{routeDescription,onSave,onNext});main.querySelector('#discount').focus();
  });
  main.querySelectorAll('[data-person]').forEach(button=>button.addEventListener('click',()=>{
    if(state.person===button.dataset.person)return;
    state.person=button.dataset.person;state.overrunDiscount='';state.discountConfirmed=false;state.expressDiscountConfirmed=false;state.result=null;state.dirty=true;state.error='';onSave();
    if(state.type==='none'&&!express&&state.discount==='none'){state.result=settlement({...state,express:false});state.dirty=false;onSave();}
    renderFareScreen(main,state,{routeDescription,onSave,onNext});
    main.querySelector(`[data-person="${state.person}"]`).focus();
  }));
  main.querySelectorAll('[data-type]').forEach(button=>button.addEventListener('click',()=>{
    if(state.type===button.dataset.type)return;
    state.type=button.dataset.type;state.overrunDiscount='';state.discountConfirmed=false;state.expressDiscountConfirmed=false;state.result=null;state.dirty=true;state.error='';
    if(state.type==='none'&&!express&&state.discount==='none'){state.result=settlement({...state,express:false});state.dirty=false;}
    onSave();renderFareScreen(main,state,{routeDescription,onSave,onNext});
    main.querySelector(`[data-type="${state.type}"]`).focus();
  }));
  main.querySelector('#next-ticket').addEventListener('click',onNext);

  const registerPicker = id => {
    const input=main.querySelector(`#${id}`);
    if(input)stationPickers.set(id,mountStationPicker(input,()=>stationChoices(state,id),value=>set(id,value)));
  };
  function paintAmountChoices() {
    const select=main.querySelector('#paid');if(!select)return;
    let values=[];try{values=amountOptions(state.corridor,state.ticketFrom,state.person,state.discount);}catch{}
    select.replaceChildren(new Option('金額を選択',''));
    if(state.paid && !values.some(v=>String(v)===String(state.paid)))select.add(new Option(`${state.paid}円（区分・発駅を確認）`,state.paid));
    for(const value of values)select.add(new Option(`${yen(value)}円`,String(value)));
    select.value=String(state.paid);
  }
  function paintDiscountFields(){
    const panel=main.querySelector('#discount-fields');if(!panel)return;
    const id=state.discount,hasZip=isMemberDiscount(id)||isMemberDiscount(state.expressDiscount);
    const hints={otona30:'大人の休日倶楽部カードによる東日本・北海道限定30％割引。全国ジパングの会員手帳・購入証とは別制度です。区間外は通常運賃・料金を別途計算します。',student:'学割は片道101km以上の普通運賃が2割引。学割原券の乗越区間には自動継続しません。',disability_companion:'第1種本人と介護者の同一区間同行を確認。運賃5割引、特急料金は通常料金。各1人分で計算します。',disability_single:'本人単独の普通運賃は片道101km以上が対象。短い乗越区間への適用は取扱いを確認してください。',zip20:'会員手帳・購入証による全国割引が対象。使用開始後の区間外は通常運賃・料金を別途計算。新規割引発売は片道101km以上と除外日を確認。',zip30:'会員手帳・購入証による全国割引が対象。使用開始後の区間外は通常運賃・料金を別途計算。新規割引発売は片道101km以上と除外日を確認。',tokudane:'北斗の特急トクだ値が対象。区間外は通常運賃・特急料金を別途収受し、原券発売額は控除しません。'};
    let singleOverrun=false;
    try{singleOverrun=id==='disability_single'&&state.type==='section'&&state.ticketTo!=='長万部'&&extensionRule(distance(state.corridor,state.ticketFrom,state.ticketTo))==='extension'&&extensionRule(distance(state.corridor,state.ticketTo))==='difference';}catch{}
    panel.innerHTML=`${hints[id]?`<p class="discount-note">${hints[id]}</p>`:''}${hasZip?`<div class="field"><label for="travelDate">会員割引の乗車日</label><input id="travelDate" type="date" value="${esc(state.travelDate)}"><small>新規割引発売の除外日判定に使用。原券の有効性は券面で確認します。</small></div>`:''}${id!=='none'?`<label class="check-row"><input id="discountConfirmed" type="checkbox" ${state.discountConfirmed?'checked':''}><span>${id==='otona30'?'会員本人・大人の休日倶楽部カード・券面・決済条件を確認':id==='disability_companion'?'手帳・第1種・本人と介護者の同一区間同行を確認':id==='tokudane'?'予約区間・利用日・指定列車・原券の有効性を確認':'券面・証明書・割引率・原券の有効性などの適用条件を確認'}</span></label>`:''}${id==='tokudane'?`<div class="field"><label for="tokudaneUse">トクだ値の利用状態</label><select id="tokudaneUse">${[['same','同じ指定列車に乗車中'],['fareOnly','乗車券部分のみ有効（当日・条件確認）']].map(([v,n])=>`<option value="${v}" ${state.tokudaneUse===v?'selected':''}>${n}</option>`).join('')}</select></div>`:''}${singleOverrun?`<div class="field"><label for="overrunDiscount">身障・単独の乗越区間への割引</label><select id="overrunDiscount">${[['','取扱いを確認して選択'],['apply','乗越区間も5割引（適用確認済み）'],['normal','乗越区間は無割引（取扱確認済み）']].map(([v,n])=>`<option value="${v}" ${state.overrunDiscount===v?'selected':''}>${n}</option>`).join('')}</select><small>適用を推測しません。未選択では精算額を表示しません。</small></div>`:''}`;
    panel.querySelector('#discountConfirmed')?.addEventListener('change',e=>set('discountConfirmed',e.target.checked));
    panel.querySelector('#travelDate')?.addEventListener('change',e=>{state.discountConfirmed=false;state.expressDiscountConfirmed=false;set('travelDate',e.target.value);paintFields();main.querySelector('#travelDate').focus();});
    panel.querySelector('#overrunDiscount')?.addEventListener('change',e=>set('overrunDiscount',e.target.value));
    panel.querySelector('#tokudaneUse')?.addEventListener('change',e=>{state.expressTicket='none';set('tokudaneUse',e.target.value);paintFields();});
  }
  function paintFields() {
    const ticket = main.querySelector('#ticket-fields'); if(!ticket)return;
    stationPickers.clear();
    if(state.type==='amount'){
      ticket.innerHTML=field('ticketFrom','金額式きっぷの発駅',state.ticketFrom,'乗継で乗車駅と異なる場合も、券面どおり入力してください。')+
      `<div class="field"><label for="paid">券面金額</label><select id="paid"></select><small>100km以内の金額式きっぷ。券面の発駅・金額・おとな／こどもを確認してください。</small></div>`;
      registerPicker('ticketFrom');paintAmountChoices();
      main.querySelector('#paid').addEventListener('change',e=>set('paid',e.target.value));
    } else if(state.type==='section') {
      ticket.innerHTML=field('ticketFrom','乗車券に記載された発駅',state.ticketFrom,'今回の乗車駅より前から有効な原券も入力できます。')+field('ticketTo','乗車券に記載された着駅',state.ticketTo,'候補は長万部へ向かう順です。原券が今回の乗車駅で終わる乗継も含みます。');
      registerPicker('ticketFrom');registerPicker('ticketTo');
    } else ticket.innerHTML='<p class="helper">整理券・乗車券なしとして、乗車区間の運賃を表示します。</p>';
    paintDiscountFields();const panel=main.querySelector('#express-fields'),tokSame=state.discount==='tokudane'&&state.tokudaneUse==='same';
    let feeHelp={text:'通常特急券は原券100km以内・101km以上とも、原特急券の発駅から新旧料金の差額。',url:SETTLEMENT_RULES.express.links[0][1],label:'旅客営業規則 第252条7・8項'};
    if(isMemberDiscount(state.expressDiscount)){
      const member=isOtona(state.expressDiscount)?'大休ジパング':'全国ジパング';
      feeHelp=state.expressTicket==='extend'
        ?{text:`${member}特急券の区間外は、券面着駅〜長万部の通常特急料金を別途収受します。原券の割引額は差し引きません。`,url:SETTLEMENT_RULES[isOtona(state.expressDiscount)?'otona':'zipang'].links[isOtona(state.expressDiscount)?2:1][1],label:'割引商品の区間外取扱い'}
        :{text:`${member}の新規料金券は、対応する割引乗車券の区間内に限り割引します。会員本人・日付・購入条件を確認してください。`,url:isOtona(state.expressDiscount)?'https://faq.jre-ot9.jp/faq/show/47?category_id=16&site_domain=default':SETTLEMENT_RULES.zipang.links[0][1],label:'会員割引の料金券条件'};
    }
    panel.innerHTML=express?`<div class="subsection"><h3>特急 北斗の利用区間</h3>${field('expressFrom','特急の乗車駅',state.expressFrom)}
    ${tokSame?'<p class="helper">トクだ値の予約発着駅は上欄と共通です。同じ指定列車の区間外を通常料金で別途計算します。</p>':`<div class="field"><label for="expressTicket">特急券の状態</label><select id="expressTicket">${[['none','特急券なし'],['valid','長万部まで有効な特急券あり'],['extend','同じ北斗の特急券を乗越']].map(([v,n])=>`<option value="${v}" ${state.expressTicket===v?'selected':''}>${n}</option>`).join('')}</select></div>
    <div id="express-ticket-interval">${state.expressTicket==='extend'?field('expressTicketFrom','特急券に記載された発駅',state.expressTicketFrom)+field('expressTo','特急券に記載された着駅',state.expressTo):''}</div>
    ${state.expressTicket!=='valid'&&(isMemberDiscount(state.discount)||state.discount.startsWith('disability_'))?`<div class="field"><label for="expressDiscount">特急料金の割引</label><select id="expressDiscount">${[['','料金券の割引を選択'],['none','なし・通常の特急料金'],...(isOtona(state.discount)?[['otona30','大休ジパング（東日本・北海道）3割引']]:[['zip20','ジパング（全国割引）2割引'],['zip30','ジパング（全国割引）3割引']])].map(([v,n])=>`<option value="${v}" ${state.expressDiscount===v?'selected':''}>${n}</option>`).join('')}</select></div>${isMemberDiscount(state.expressDiscount)&&(!isMemberDiscount(state.discount)||(state.expressTicket==='none'&&state.type!=='none'))?`<label class="check-row"><input id="expressDiscountConfirmed" type="checkbox" ${state.expressDiscountConfirmed?'checked':''}><span>${isOtona(state.expressDiscount)?'料金券別購入の会員本人・大休カード決済・大休割引乗車券区間内を確認':'料金券別購入の購入証・会員手帳・乗車券区間内の条件を確認'}</span></label>`:''}`:''}
    <p class="helper">${esc(feeHelp.text)} <a href="${feeHelp.url}" target="_blank" rel="noopener noreferrer">${feeHelp.label}</a></p>`}</div>`:'';
    if(express){
      registerPicker('expressFrom');registerPicker('expressTicketFrom');registerPicker('expressTo');
      main.querySelector('#expressTicket')?.addEventListener('change',e=>{if(e.target.value==='valid')state.expressDiscount='none';else if(isMemberDiscount(state.discount)||state.discount.startsWith('disability_')||isMemberDiscount(state.expressDiscount))state.expressDiscount='';set('expressTicket',e.target.value);paintFields();});
      main.querySelector('#expressDiscount')?.addEventListener('change',e=>{state.discountConfirmed=false;state.expressDiscountConfirmed=false;set('expressDiscount',e.target.value);paintFields();});
      main.querySelector('#expressDiscountConfirmed')?.addEventListener('change',e=>set('expressDiscountConfirmed',e.target.checked));
    }
  }
  function paintResult() {
    const result=main.querySelector('#result'),r=state.result;
    const calculated=Boolean(r),label=state.type==='none'&&(!express||state.expressTicket==='none')?'長万部までの金額':'追加でお支払いいただく金額';
    const appliedRules=r?[...new Set([r.fareRule,r.chargeRule].filter(Boolean))].map(id=>SETTLEMENT_RULES[id]):[];
    const rows=items=>items.map(item=>`<div class="formula-row"><span>${esc(item.label)}</span><strong>${item.subtract?'− ':''}${yen(item.value)} 円</strong></div>`).join('');
    result.classList.toggle('result-pending',!calculated);
    result.innerHTML=`<div class="journey-card"><p class="eyebrow">${express?'特急 北斗':'普通列車'} ・ ${person}1人分</p>${state.discount!=='none'?`<p class="result-policy">${esc(DISCOUNTS.find(d=>d.id===state.discount)?.label)}</p>`:''}
    <div class="journey-pair"><div class="journey-station"><small>今回の乗車駅</small><strong>${esc(state.boarding)}</strong></div><span class="rail-link" aria-hidden="true"></span><div class="journey-station journey-dest"><small>降車駅</small><strong>長万部</strong></div></div>
    <div class="charge-label"><span>${label}</span><span class="person-tag">${person}</span></div><div class="amount">${calculated?`${yen(r.total)}<span>円</span>`:'<span class="pending-label">入力内容を確認</span>'}</div>
    <p class="result-caption">${calculated?`${r.total===0?'追加のお支払いはありません。':express?`運賃 ${yen(r.base)}円 ＋ 特急料金 ${yen(r.charge)}円`:state.type==='none'?(state.discount==='none'?'片道 ・ 通常運賃':'片道 ・ 割引適用'):'乗越精算'}`:state.dirty?'条件が変わりました。「精算額を表示」で再計算してください。':'必要な項目を入力してください。'}</p></div>
    ${calculated?`<div class="breakdown formula"><h2>${esc(r.method)}</h2>${rows(r.lines)}${state.type==='none'||r.rule==='covered'?'':`<div class="formula-row subtotal"><span>追加運賃</span><strong>${yen(r.base)} 円</strong></div>`}${r.rule==='extension'||r.rule==='covered'?`<p>${esc(r.explanation)}</p>`:''}
    ${r.originalDistance!==null&&r.rule==='difference'?`<p>原券の計算キロ：${(r.originalDistance/10).toFixed(1)}km</p>`:''}
    ${express?`<h3>${esc(r.chargeMethod)}</h3>${rows(r.chargeLines)}<div class="formula-row subtotal"><span>追加の特急料金</span><strong>${yen(r.charge)} 円</strong></div>`:''}
    <details><summary>適用規則・計算キロ</summary><p>運賃基準：${esc(r.calculationFrom)}〜長万部 ${(r.fareDistance/10).toFixed(1)}km。</p>${r.notes.map(n=>`<p>${esc(n)}</p>`).join('')}${appliedRules.map(rule=>`<p>${esc(rule.text)}</p><ul>${rule.links.map(([label,url])=>`<li><a href="${url}" target="_blank" rel="noopener noreferrer">${esc(label)}</a></li>`).join('')}</ul>`).join('')}${state.person==='child'?'<p>運賃・特急料金をそれぞれ半額にして10円未満切捨て。</p>':''}<p>データ ${META.version} ／ 確認 ${META.checked}</p></details></div>`:''}`;
  }
  paintFields();paintResult();
  main.querySelector('#ticket-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    try {
      for(const input of main.querySelectorAll('[data-station-input]')){
        const stations=stationChoices(state,input.id);
        if(!resolveStation(stations,input.value)){
          input.setAttribute('aria-invalid','true');input.focus();
          const directions={ticketFrom:'発駅は、今回の乗車駅と同じか手前の駅を選択してください。',ticketTo:'着駅は、券面の発駅より先で、今回の乗車駅から長万部までの駅を選択してください。',expressFrom:'特急の乗車駅は、今回の乗車駅以後の北斗停車駅を選択してください。',expressTicketFrom:'特急券の発駅は、今回の特急乗車駅と同じか手前の停車駅を選択してください。',expressTo:'特急券の着駅は、今回の特急乗車駅より先で、長万部までの停車駅を選択してください。'};
          throw new Error(resolveStation(list,input.value)?directions[input.id]:`${main.querySelector(`label[for="${input.id}"]`).textContent}を、候補にある駅名で入力してください。`);
        }
        input.removeAttribute('aria-invalid');
      }
      state.result=settlement({...state,express});state.dirty=false;state.error='';
      main.querySelector('#form-error').hidden=true;paintResult();onSave();
      main.querySelector('#result-status').textContent=`${person}1人分、精算額${yen(state.result.total)}円。`;
      const result=main.querySelector('#result');result.focus({preventScroll:true});result.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    } catch(error){state.result=null;state.error=error.message;paintResult();onSave();const box=main.querySelector('#form-error');box.hidden=false;box.textContent=error.message;box.scrollIntoView({block:'center'});}
  });
}
