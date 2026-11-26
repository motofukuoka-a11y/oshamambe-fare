import { ROUTES, CORRIDORS, META, SOURCES, FARES } from './data.js';
import { settlement, journeyFare, expressFee, distance, yen, childAmount } from './calculator.js';
const main=document.querySelector('#main');
const state={person:'adult',route:null,corridor:null,boarding:null,type:'none',paid:'',ticketFrom:'',ticketTo:'',expressTicket:'none',expressTo:''};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=(kind='train')=>{
  const paths={train:'M8 3h8a3 3 0 0 1 3 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3Zm-3 8h14M8 15h.01M16 15h.01M8 19l-3 3m11-3 3 3',mountain:'m2 19 7-13 5 8 3-5 5 10H2Zm5-9 2 2 2-2M3 22h18',wave:'M3 5h18M6 5v8m12-8v8M3 16c3-4 5 4 9 0s6 4 9 0M3 21c3-4 5 4 9 0s6 4 9 0',express:'M3 18h17a1 1 0 0 0 1-1c-2-9-7-12-17-12M9 5v7h10M2 22h20M2 9h3M1 13h5',search:'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',ticket:'M3 6h18v5a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6Zm12 1v2m0 3v2m0 3v1',check:'M20 12a8 8 0 1 1-5-7M8 11l4 4 9-10'};
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[kind]||paths.train}"/></svg>`;
};
const personSwitch=()=>`<div class="person-switch" role="group" aria-label="おとな・こども"><button type="button" data-person="adult" aria-pressed="${state.person==='adult'}">おとな</button><button type="button" data-person="child" aria-pressed="${state.person==='child'}">こども</button></div>`;
const crumb=extra=>`<div class="breadcrumb"><a href="#/">メニュー</a>${extra}</div>`;
const routePath=(route=state.route,corridor=state.corridor)=>`#/route/${route.id}?via=${corridor}`;
const routeDescription=()=>state.corridor==='sawara'?'函館本線・砂原経由':state.corridor==='otaru'?'函館本線・小樽経由':state.corridor==='airport'?'南千歳・室蘭本線経由':state.corridor==='muroranBranch'?'室蘭支線・東室蘭経由':state.corridor==='sapporo'||state.corridor==='muroran'?'室蘭・千歳線経由':'函館本線・駒ケ岳経由';
const isExpress=()=>Boolean(state.route?.stops);
function bindPerson(onChange){document.querySelectorAll('[data-person]').forEach(b=>b.addEventListener('click',()=>{state.person=b.dataset.person;onChange();}));}
function home(){
  state.person='adult';
  document.title='長万部駅 着駅精算';
  main.innerHTML=`<section class="hero"><div><p class="eyebrow">OSHAMAMBE STATION</p><h1>長万部駅<br><span>着駅精算。</span></h1><p class="lead">ご乗車の列車と駅を選ぶだけ。<br>運賃の確認から、きっぷの乗越精算まで。</p></div><div class="destination" aria-label="降車駅は長万部駅です"><div class="dest-top"><span class="station-code">H47</span><span>降車駅</span></div><strong>長万部</strong><small>OSHAMAMBE</small></div></section>
  <section aria-labelledby="choose-train"><div class="section-heading"><h2 id="choose-train">ご乗車の列車を選択</h2><p>普通列車 3方面 ／ 特急 2方面</p></div><div class="route-grid">${ROUTES.map(r=>`<a class="route-card ${r.color}" href="#/route/${r.id}"><div class="route-card-top"><span class="route-symbol">${svg(r.icon)}</span><span class="badge">${r.badge}</span></div><h3>${r.title}</h3><p>${r.description}</p><span class="card-bottom">${r.line} ・ 乗車駅を選択</span></a>`).join('')}</div></section>
  <div class="how-strip"><div>${svg('train')}<span><b>乗車駅</b>をタップ</span></div><div>${svg('ticket')}<span>お持ちの<b>きっぷ</b>を入力</span></div><div>${svg('check')}<span>大きな表示で<b>精算額</b>を確認</span></div></div>
  <p class="fine-print">通常の片道・無割引のきっぷを対象とした精算補助です。運賃の適用範囲は<a href="#/guide">使い方・運賃データ</a>で確認できます。</p>`;
}
function variants(){
  if(state.route.id==='hakodate-local')return [['hakodate','駒ケ岳経由'],['sawara','砂原経由']];
  if(state.route.id==='muroran-local')return [['muroran','東室蘭・札幌方面'],['muroranBranch','室蘭支線'],['airport','新千歳空港・南千歳方面']];
  if(state.route.id==='sapporo-express')return [['sapporo','札幌方面'],['airport','新千歳空港（南千歳乗継）']];
  return [];
}
function stations(){
  document.title=`${state.route.title}｜長万部駅 着駅精算`;
  const options=variants();
  main.innerHTML=crumb(`<i></i><span>${state.route.title}</span>`)+`<section class="${state.route.color}"><div class="page-head"><div><p class="eyebrow">${state.route.line} ／ 長万部駅着</p><h1>乗車駅を選択</h1><p>${state.route.title} ・ ${routeDescription()}</p></div>${personSwitch()}</div><div class="toolbar"><div class="search"><label for="station-search">駅名を検索</label>${svg('search')}<input id="station-search" type="search" placeholder="駅名・ひらがなで検索" autocomplete="off"></div>${options.length?`<div class="path-control"><label for="via">経由・方面</label><select id="via">${options.map(([v,n])=>`<option value="${v}" ${state.corridor===v?'selected':''}>${n}</option>`).join('')}</select></div>`:`<span class="helper">${routeDescription()}</span>`}</div><p class="station-total-note">${isExpress()?'表示金額は運賃＋普通車指定席特急料金。':'表示金額は長万部までの片道運賃。'} ${state.person==='child'?'こども':'おとな'}1人分</p><div class="station-grid" id="station-grid"></div><p class="fine-print">${isExpress()?'停車駅は列車により異なります。新千歳空港は南千歳で北斗に乗り継ぐ場合です。':'東室蘭・小樽より先の駅は、乗継利用も含みます。'} 整理券番号ではなく、実際の乗車駅を選択してください。</p></section>`;
  paintStations('');
  document.querySelector('#station-search').addEventListener('input',e=>paintStations(e.target.value));
  document.querySelector('#via')?.addEventListener('change',e=>{location.hash=routePath(state.route,e.target.value);});
  bindPerson(stations);
}
function normalize(s){return s.normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/\s|駅$/g,'').toLowerCase();}
function paintStations(query){
  const q=normalize(query);
  const stations=CORRIDORS[state.corridor].filter(s=>s.name!=='長万部'&&(!isExpress()||state.route.stops.includes(s.name)||s.name==='新千歳空港')).slice().reverse().filter(s=>normalize(s.name).includes(q)||normalize(s.kana).includes(q));
  document.querySelector('#station-grid').innerHTML=stations.map(s=>{
    const d=distance(state.corridor,s.name),base=journeyFare(state.corridor,s.name,'長万部',state.person),fee=isExpress()?expressFee(s.name==='新千歳空港'?distance(state.corridor,'南千歳'):d,state.person):0;
    return `<button type="button" class="station-card" data-station="${esc(s.name)}" aria-label="${s.name} ${yen(base+fee)}円"><strong>${s.name}</strong><span class="station-info"><span>${s.code}</span><b>${yen(base+fee)} <em>円</em></b></span></button>`;
  }).join('')||'<p class="empty">該当する駅がありません。<br>駅名か経由・方面を確認してください。</p>';
  document.querySelectorAll('[data-station]').forEach(b=>b.addEventListener('click',()=>{location.hash=`#/fare/${state.route.id}/${encodeURIComponent(b.dataset.station)}?via=${state.corridor}`;}));
}
const stationOptions=(items,selected)=>'<option value="">駅を選択</option>'+items.map(s=>`<option value="${esc(s.name)}" ${s.name===selected?'selected':''}>${s.name}</option>`).join('');
function farePage(){
  document.title=`${state.boarding}〜長万部｜着駅精算`;
  main.innerHTML=crumb(`<i></i><a href="${routePath()}">${state.route.title}</a><i></i><span>${esc(state.boarding)}</span>`)+`<div class="page-head"><div><p class="eyebrow">FARE SETTLEMENT</p><h1>きっぷを確認して精算</h1><p>${routeDescription()}${state.boarding==='新千歳空港'?' ／ 北斗の特急区間は南千歳〜長万部':''}</p></div>${personSwitch()}</div><div class="workspace"><section class="calc-panel" aria-labelledby="ticket-heading"><div class="panel-heading"><h2 id="ticket-heading">お持ちのきっぷ</h2><p>整理券・乗車券なし、金額式きっぷ、区間の乗越から選択してください。</p></div><div class="panel-body"><div class="ticket-tabs" role="group" aria-label="乗車券の種類">${[['none','整理券・<br>乗車券なし'],['amount','金額式<br>（エド券）'],['section','区間の<br>乗越']].map(([v,n])=>`<button type="button" data-type="${v}" aria-pressed="${state.type===v}">${n}</button>`).join('')}</div><form id="ticket-form" novalidate><div id="ticket-fields"></div><div id="express-fields"></div><button class="submit" type="submit">精算額を確認</button></form><p class="fine-print">おとな・こどもは券面と合わせて選択。割引・定期・IC・企画券・グリーン車は自動計算の対象外です。</p></div></section><section class="result-panel" id="result" aria-label="精算結果" aria-live="polite" aria-atomic="true"></section></div><a class="back-action" href="${routePath()}">乗車駅を選び直す</a>`;
  paintFields();updateResult();
  document.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>{state.type=b.dataset.type;farePage();}));
  bindPerson(()=>{state.paid='';farePage();});
  document.querySelector('#ticket-form').addEventListener('submit',e=>{e.preventDefault();updateResult();document.querySelector('#result').scrollIntoView({behavior:'smooth',block:'start'});});
}
function paintFields(){
  const all=CORRIDORS[state.corridor];
  const boarding=all.find(s=>s.name===state.boarding);
  const origins=all.filter(s=>s.pos<=boarding.pos);
  const destinations=all.filter(s=>s.pos>boarding.pos);
  let html='';
  if(state.type==='none')html=`<div class="ticket-content"><p class="helper"><strong>${esc(state.boarding)}からご乗車</strong><br>整理券は乗車駅の確認に使います。長万部までの運賃を全額表示します。</p></div>`;
  if(state.type==='amount'){
    const max=journeyFare(state.corridor,state.boarding,'長万部',state.person);
    const surcharge=state.boarding==='新千歳空港'?(state.person==='child'?10:20):0;
    const allowed=[...new Set(FARES.filter(([k])=>k<=100).map(([,v])=>(state.person==='child'?childAmount(v):v)+surcharge))].filter(v=>v<=max);
    html=`<div class="field"><label for="amount-origin">券面の発駅</label><input id="amount-origin" value="${esc(state.boarding)}" readonly><small>発駅が違う場合は「乗車駅を選び直す」で変更してください。</small></div><div class="field"><label for="paid">券面に記載された金額</label><select id="paid"><option value="">金額を選択</option>${allowed.map(v=>`<option value="${v}" ${String(v)===state.paid?'selected':''}>${yen(v)}円</option>`).join('')}</select><small>100km以内・無割引の金額式乗車券が対象です。100km超は「区間の乗越」を選択してください。</small></div>`;
  }
  if(state.type==='section')html=`<div class="ticket-pair"><div class="field"><label for="ticketFrom">券面の発駅</label><select id="ticketFrom">${stationOptions(origins,state.ticketFrom)}</select></div><div class="field"><label for="ticketTo">券面の着駅</label><select id="ticketTo">${stationOptions(destinations,state.ticketTo)}</select></div></div><p class="helper">券面と同じ経路の普通片道乗車券を入力してください。原券の区間に応じて計算方法を切り替えます。</p>`;
  document.querySelector('#ticket-fields').innerHTML=html;
  let expressHtml='';
  if(isExpress()){
    const stops=destinations.filter(s=>state.route.stops.includes(s.name)||s.name==='長万部');
    expressHtml=`<div class="subsection"><h3>特急券の状態</h3><div class="field"><label for="expressTicket">普通車指定席・座席未指定</label><select id="expressTicket">${[['none','特急券なし'],['valid','長万部までの特急券あり'],['extend','同じ北斗の特急券を乗越']].map(([v,n])=>`<option value="${v}" ${state.expressTicket===v?'selected':''}>${n}</option>`).join('')}</select></div>${state.expressTicket==='extend'?`<div class="field"><label for="expressTo">特急券に記載された着駅</label><select id="expressTo">${stationOptions(stops,state.expressTo)}</select><small>特急券の発駅は${state.boarding==='新千歳空港'?'南千歳':esc(state.boarding)}として計算。同じ列車・同じ座席種別での延長が対象です。発駅が異なる場合は係員による確認が必要です。</small></div>`:''}<p class="helper">北斗は全車指定席。指定席・座席未指定の通常料金を通年で計算します。</p></div>`;
  }
  document.querySelector('#express-fields').innerHTML=expressHtml;
  ['paid','ticketFrom','ticketTo','expressTicket','expressTo'].forEach(id=>document.getElementById(id)?.addEventListener('change',e=>{state[id]=e.target.value;if(id==='expressTicket')paintFields();updateResult();}));
}
function updateResult(){
  const el=document.querySelector('#result');
  let r,error='';
  try{r=settlement({...state,express:isExpress()});}catch(e){error=e.message;}
  el.classList.toggle('result-invalid',Boolean(error));
  const person=state.person==='child'?'こども':'おとな';
  const resultLabel=state.type==='none'&&(!isExpress()||state.expressTicket==='none')?'長万部までの金額':'追加でお支払いいただく金額';
  let notes=[];
  if(r){
    if(['sapporo','muroran'].includes(state.corridor)&&['新札幌','上野幌','平和','白石','苗穂','札幌'].includes(state.boarding))notes.push('運賃は札幌市内の特例を適用（札幌中心駅から206.4km）。特急料金は実際の特急区間で計算。');
    if(state.corridor==='sawara'&&CORRIDORS.sawara.find(s=>s.name===state.boarding).pos<=270)notes.push('大沼〜森は短い22.5kmで運賃を計算。');
    if(state.boarding==='新千歳空港')notes.push(`新千歳空港の加算運賃${state.person==='child'?10:20}円を含みます。`);
    if(state.type!=='none'&&r.base===0)notes.push('追加の運賃はありません。払いもどし額は計算しません。');
  }
  el.innerHTML=`${error?`<div class="error" role="alert">${esc(error)}</div>`:''}<div class="journey-card"><p class="eyebrow">${isExpress()?'特急 北斗':'普通列車'} ・ ${person}1人分</p><div class="journey-pair"><div class="journey-station"><small>乗車駅</small><strong>${esc(state.boarding)}</strong></div><span class="rail-link" aria-hidden="true"></span><div class="journey-station journey-dest"><small>降車駅</small><strong>長万部</strong></div></div><div class="charge-label"><span>${resultLabel}</span><span class="person-tag">${person}</span></div><div class="amount">${r?`${yen(r.total)}<span>円</span>`:'入力を確認'}</div><p class="result-caption">${r?`運賃計算キロ ${(r.fareDistance/10).toFixed(1)}km${isExpress()?' ／ 運賃＋特急料金':''}`:'必要な項目を選ぶと精算額を表示します。'}</p></div>${r?`<div class="breakdown"><div class="breakdown-row"><span>${state.type==='none'?'乗車運賃':'追加運賃'}</span><strong>${yen(r.base)} 円</strong></div>${isExpress()?`<div class="breakdown-row"><span>追加の特急料金</span><strong>${yen(r.charge)} 円</strong></div>`:''}</div><div class="calculation"><h3>${r.method}</h3><p>${esc(r.explanation)}${isExpress()?`<br>${state.expressTicket==='none'?`特急券なし：${yen(r.fullCharge)}円を加算。`:state.expressTicket==='valid'?'特急券は長万部まで有効。':`特急料金：${yen(r.fullCharge)}円 − ${yen(r.oldCharge)}円 ＝ ${yen(r.charge)}円。`}`:''}${notes.length?`<br>${notes.join('<br>')}`:''}</p></div>`:''}`;
}
function guide(){
  document.title='使い方・運賃データ｜長万部駅 着駅精算';
  main.innerHTML=crumb('<i></i><span>使い方・運賃データ</span>')+`<article class="guide"><p class="eyebrow">GUIDE & DATA</p><h1>使い方・運賃データ</h1><section><h2>3つの操作で精算</h2><ol><li>メニューからご乗車の列車を選び、乗車駅をタップします。経由・方面も確認してください。</li><li>おとな・こどもと、きっぷの種類を選択します。金額式は券面金額、区間の乗越は券面の発着駅を入力します。</li><li>大きな金額表示と計算内訳を確認します。特急利用時は特急券の状態も選択してください。</li></ol></section><section><h2>計算の扱い</h2><div class="rule-line"><strong>整理券・乗車券なし</strong><p>選択した乗車駅から長万部までの運賃を全額表示します。整理券番号と駅名の対応は列車ごとに異なるため、番号では検索しません。</p></div><div class="rule-line"><strong>100km以内の乗車券</strong><p>原券の発駅から長万部までの運賃と、原券の運賃の差額を計算します。金額式は券面の金額を差し引きます。</p></div><div class="rule-line"><strong>100kmを超える乗車券</strong><p>原券の着駅から長万部までの運賃を別途計算します。原券の区間と経路が入力候補にある通常の片道乗車券が対象です。</p></div><div class="rule-line"><strong>特急 北斗</strong><p>普通車指定席・座席未指定の通常料金を通年で計算。乗越は、同じ列車・同じ座席種別・選択した発駅からの特急券に限り、新旧の料金差額を表示します。新千歳空港は南千歳乗継です。</p></div><div class="rule-line"><strong>経路・こども・特例</strong><p>小樽経由と室蘭・千歳線経由は別に計算。砂原経由の大沼〜森は両端を通る場合22.5kmを使用します。室蘭・千歳線経由で札幌市内の駅から長万部までの運賃は札幌中心駅基準。新千歳空港は加算運賃を含みます。こどもは運賃・料金をそれぞれ半額にし、10円未満を切り捨てます。</p></div></section><section><h2>対応範囲</h2><p>本アプリは精算補助ツールです。通常の片道・無割引の紙のきっぷを対象としています。割引乗車券、定期券、IC、企画券、連絡乗車券、グリーン車、経路変更、長万部以遠のきっぷ、候補にない発着駅は係員による確認が必要です。払いもどしや決済・発券は行いません。最終的な取扱いは最新の規則・現場の確認によります。</p></section><section><h2>運賃データと参照元</h2><p>バージョン ${META.version} ／ 運賃適用 ${META.fareSince}改定後 ／ 確認日 ${META.checked}。利用者提供の2026年3月更新表に掲載された運賃・料金も照合しています。原画像はサイトに掲載していません。JR北海道の公式サイトではありません。</p><ul class="source-list" style="margin-top:18px">${SOURCES.map(([t,u])=>`<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${t}</a></li>`).join('')}</ul></section><a class="back-action" href="#/">メニューに戻る</a></article>`;
}
function navigate(){
  const [raw,query='']=location.hash.replace(/^#\/?/,'').split('?');
  const parts=raw.split('/'),via=new URLSearchParams(query).get('via');
  if(parts[0]==='guide'){guide();}
  else if(['route','fare'].includes(parts[0])){
    const r=ROUTES.find(r=>r.id===parts[1]);
    if(!r){location.hash='#/';return;}
    state.route=r;
    const allowed=r.id==='hakodate-local'?['hakodate','sawara']:r.id==='muroran-local'?['muroran','muroranBranch','airport']:r.id==='sapporo-express'?['sapporo','airport']:[r.corridor];
    state.corridor=allowed.includes(via)?via:r.corridor;
    if(parts[0]==='fare'){
      let name;try{name=decodeURIComponent(parts[2]||'');}catch{name='';}
      if(!CORRIDORS[state.corridor].some(s=>s.name===name&&s.name!=='長万部')||(isExpress()&&!r.stops.includes(name)&&name!=='新千歳空港')){location.hash=routePath();return;}
      state.boarding=name;state.type='none';state.paid='';state.ticketFrom=name;state.ticketTo='';state.expressTicket='none';state.expressTo='';farePage();
    }else stations();
  }else home();
  window.scrollTo(0,0);
  main.focus({preventScroll:true});
}
document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();main.focus();main.scrollIntoView();});
window.addEventListener('hashchange',navigate);navigate();
