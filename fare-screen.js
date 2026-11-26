import { CORRIDORS, META } from './data.js?v=1.1.0';
import { settlement, yen, amountOptions } from './calculator.js?v=1.1.0';
import { mountStationPicker, resolveStation } from './station-picker.js?v=1.1.0';

const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types = [['none','整理券・乗車券なし'],['amount','金額式（エド券）'],['section','区間の乗越']];
const field = (id,label,value,hint='') => `<div class="field"><label for="${id}">${label}</label><div class="station-input"><input id="${id}" data-station-input value="${esc(value)}" placeholder="駅名・ひらがな" spellcheck="false"></div>${hint?`<small>${hint}</small>`:''}</div>`;

export function renderFareScreen(main,state,{routeDescription,onSave,onNext}) {
  const express = Boolean(state.route.stops), list = CORRIDORS[state.corridor];
  const routeUrl = `#/route/${state.route.id}?via=${state.corridor}`;
  const person = state.person === 'child' ? 'こども' : 'おとな';
  document.title = `${state.boarding}〜長万部｜着駅精算`;
  main.innerHTML = `<div class="breadcrumb"><a href="#/">メニュー</a><i></i><a href="${routeUrl}">${state.route.title}</a></div>
  <div class="page-head fare-head"><div><p class="eyebrow">${routeDescription()}</p><h1>${esc(state.boarding)} <span class="journey-separator">〜</span> 長万部</h1><p>今回の列車の乗車駅：${esc(state.boarding)}</p></div>
  <div class="person-switch" role="group" aria-label="おとな・こども">${[['adult','おとな'],['child','こども']].map(([v,n])=>`<button type="button" data-person="${v}" aria-pressed="${state.person===v}">${n}</button>`).join('')}</div></div>
  <div class="ticket-tabs modebar" role="group" aria-label="乗車券の種類">${types.map(([v,n])=>`<button type="button" data-type="${v}" aria-pressed="${state.type===v}">${n}</button>`).join('')}</div>
  <div class="workspace fare-workspace ${state.type==='none'&&!express?'quick-fare':''}">
  ${state.type!=='none'||express?`<section class="calc-panel" aria-labelledby="ticket-heading"><div class="panel-heading"><h2 id="ticket-heading">券面の内容を入力</h2><p>同じ旅行を継続して長万部まで乗り越える、通常・無割引のきっぷが対象です。</p></div>
  <div class="panel-body"><form id="ticket-form" novalidate><div id="form-error" class="error" role="alert" hidden></div><div id="ticket-fields"></div><div id="express-fields"></div><button class="submit" type="submit">精算額を表示</button><p class="helper form-note">入力を変更すると前の精算額を解除します。</p></form></div></section>`:''}
  <section class="result-panel" id="result" tabindex="-1" aria-label="精算結果"></section></div>
  <div class="fare-bottom"><button type="button" id="next-ticket" class="secondary-button">次の精算</button><a href="${routeUrl}">乗車駅を選び直す</a><a href="#/guide">対応範囲・根拠</a></div>
  <p id="result-status" class="sr-only" role="status"></p>`;

  const clearResult = () => {
    state.result = null; state.dirty = true; state.error = '';
    const error = main.querySelector('#form-error'); if(error)error.hidden = true;
    paintResult(); onSave();
  };
  const set = (id,value) => { state[id] = value; clearResult(); };
  main.querySelectorAll('[data-person]').forEach(button=>button.addEventListener('click',()=>{
    if(state.person===button.dataset.person)return;
    state.person=button.dataset.person;state.result=null;state.dirty=true;state.error='';onSave();
    if(state.type==='none'&&!express){state.result=settlement({...state,express:false});state.dirty=false;onSave();}
    renderFareScreen(main,state,{routeDescription,onSave,onNext});
    main.querySelector(`[data-person="${state.person}"]`).focus();
  }));
  main.querySelectorAll('[data-type]').forEach(button=>button.addEventListener('click',()=>{
    if(state.type===button.dataset.type)return;
    state.type=button.dataset.type;state.result=null;state.dirty=true;state.error='';
    if(state.type==='none'&&!express){state.result=settlement({...state,express:false});state.dirty=false;}
    onSave();renderFareScreen(main,state,{routeDescription,onSave,onNext});
    main.querySelector(`[data-type="${state.type}"]`).focus();
  }));
  main.querySelector('#next-ticket').addEventListener('click',onNext);

  const registerPicker = (id,stations=list) => {
    const input=main.querySelector(`#${id}`);
    if(input)mountStationPicker(input,stations,value=>set(id,value));
  };
  function paintFields() {
    const ticket = main.querySelector('#ticket-fields'); if(!ticket)return;
    if(state.type==='amount'){
      let choices=[];
      try { choices=amountOptions(state.corridor,state.ticketFrom,state.person); } catch {}
      const value=String(state.paid),known=choices.some(v=>String(v)===value);
      ticket.innerHTML=field('ticketFrom','金額式きっぷの発駅',state.ticketFrom,'乗継で乗車駅と異なる場合も、券面どおり入力してください。')+
      `<div class="field"><label for="paid">券面金額</label><select id="paid"><option value="">金額を選択</option>${value&&!known?`<option value="${esc(value)}" selected>${esc(value)}円（区分・発駅を確認）</option>`:''}${choices.map(v=>`<option value="${v}" ${value===String(v)?'selected':''}>${yen(v)}円</option>`).join('')}</select><small>100km以内の金額式きっぷ。券面の発駅・金額・おとな／こどもを確認してください。</small></div>`;
      registerPicker('ticketFrom');
      // 発駅変更で選択肢を更新するが、手入力済みの金額は上書きしない。
      main.querySelector('#ticketFrom').addEventListener('blur',()=>{
        const from=resolveStation(list,state.ticketFrom);
        if(from){const select=main.querySelector('#paid');const values=amountOptions(state.corridor,from.name,state.person);select.replaceChildren(new Option('金額を選択',''));if(state.paid&&!values.includes(Number(state.paid)))select.add(new Option(`${state.paid}円（区分・発駅を確認）`,state.paid));for(const value of values)select.add(new Option(`${yen(value)}円`,String(value)));select.value=state.paid;}
      });
      main.querySelector('#paid').addEventListener('change',e=>set('paid',e.target.value));
    } else if(state.type==='section') {
      ticket.innerHTML=field('ticketFrom','乗車券に記載された発駅',state.ticketFrom)+field('ticketTo','乗車券に記載された着駅',state.ticketTo,'乗継駅で原券が終わる場合も入力できます。');
      registerPicker('ticketFrom');registerPicker('ticketTo');
    } else ticket.innerHTML='<p class="helper">整理券・乗車券なしとして、乗車区間の運賃を表示します。</p>';
    const panel=main.querySelector('#express-fields');
    panel.innerHTML=express?`<div class="subsection"><h3>特急 北斗の利用区間</h3>${field('expressFrom','特急の乗車駅',state.expressFrom)}
    <div class="field"><label for="expressTicket">特急券の状態</label><select id="expressTicket">${[['none','特急券なし'],['valid','長万部まで有効な特急券あり'],['extend','同じ北斗の特急券を乗越']].map(([v,n])=>`<option value="${v}" ${state.expressTicket===v?'selected':''}>${n}</option>`).join('')}</select></div>
    <div id="express-ticket-interval">${state.expressTicket==='extend'?field('expressTicketFrom','特急券に記載された発駅',state.expressTicketFrom)+field('expressTo','特急券に記載された着駅',state.expressTo):''}</div>
    <p class="helper">普通車指定席・座席未指定の通常料金。同じ列車・同じ座席種別での延長が対象です。</p></div>`:'';
    if(express){
      const stops=list.filter(s=>state.route.stops.includes(s.name)||s.name==='長万部');
      registerPicker('expressFrom',stops.filter(s=>s.name!=='長万部'));
      registerPicker('expressTicketFrom',stops.filter(s=>s.name!=='長万部'));registerPicker('expressTo',stops);
      main.querySelector('#expressTicket').addEventListener('change',e=>{set('expressTicket',e.target.value);paintFields();});
    }
  }
  function paintResult() {
    const result=main.querySelector('#result'),r=state.result;
    const calculated=Boolean(r),label=state.type==='none'&&(!express||state.expressTicket==='none')?'長万部までの金額':'追加でお支払いいただく金額';
    const rows=items=>items.map(item=>`<div class="formula-row"><span>${esc(item.label)}</span><strong>${item.subtract?'− ':''}${yen(item.value)} 円</strong></div>`).join('');
    result.classList.toggle('result-pending',!calculated);
    result.innerHTML=`<div class="journey-card"><p class="eyebrow">${express?'特急 北斗':'普通列車'} ・ ${person}1人分</p>
    <div class="journey-pair"><div class="journey-station"><small>今回の乗車駅</small><strong>${esc(state.boarding)}</strong></div><span class="rail-link" aria-hidden="true"></span><div class="journey-station journey-dest"><small>降車駅</small><strong>長万部</strong></div></div>
    <div class="charge-label"><span>${label}</span><span class="person-tag">${person}</span></div><div class="amount">${calculated?`${yen(r.total)}<span>円</span>`:'<span class="pending-label">入力内容を確認</span>'}</div>
    <p class="result-caption">${calculated?`${r.total===0?'追加のお支払いはありません。':express?`運賃 ${yen(r.base)}円 ＋ 特急料金 ${yen(r.charge)}円`:state.type==='none'?'片道 ・ 通常運賃':'乗越精算'}`:state.dirty?'条件が変わりました。「精算額を表示」で再計算してください。':'必要な項目を入力してください。'}</p></div>
    ${calculated?`<div class="breakdown formula"><h2>${esc(r.method)}</h2>${rows(r.lines)}${state.type==='none'?'':`<div class="formula-row subtotal"><span>追加運賃</span><strong>${yen(r.base)} 円</strong></div>`}${r.rule==='extension'||r.rule==='covered'?`<p>${esc(r.explanation)}</p>`:''}
    ${r.originalDistance!==null&&r.rule==='difference'?`<p>原券の計算キロ：${(r.originalDistance/10).toFixed(1)}km</p>`:''}
    ${express?`<h3>特急料金</h3>${rows(r.chargeLines)}<div class="formula-row subtotal"><span>追加の特急料金</span><strong>${yen(r.charge)} 円</strong></div>`:''}
    <details><summary>適用規則・計算キロ</summary><p>運賃基準：${esc(r.calculationFrom)}〜長万部 ${(r.fareDistance/10).toFixed(1)}km。</p>${r.notes.map(n=>`<p>${esc(n)}</p>`).join('')}<p>乗越：旅客営業規則第249条。指定券変更：第252条。${state.person==='child'?'運賃・特急料金をそれぞれ半額にして10円未満切捨て。':''}</p><p>データ ${META.version} ／ 確認 ${META.checked}</p></details></div>`:''}`;
  }
  paintFields();paintResult();
  main.querySelector('#ticket-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    try {
      for(const input of main.querySelectorAll('[data-station-input]')){
        const isStop=input.id.startsWith('express'),stations=isStop?list.filter(s=>state.route.stops.includes(s.name)||s.name==='長万部'):list;
        if(!resolveStation(stations,input.value)){
          input.setAttribute('aria-invalid','true');input.focus();
          throw new Error(`${main.querySelector(`label[for="${input.id}"]`).textContent}を、候補にある駅名で入力してください。`);
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
