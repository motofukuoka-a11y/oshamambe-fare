import { renderFareScreen } from './fare-screen.js?v=1.2.0';
import { normalizeStation } from './station-picker.js?v=1.2.0';
import { ROUTES, CORRIDORS, META, SOURCES } from './data.js?v=1.2.0';
import { settlement, journeyFare, expressFee, distance, yen } from './calculator.js?v=1.2.0';
const main=document.querySelector('#main');
const fareDrafts=new Map();
const listingSearch=new Map();
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
  state.person='adult';fareDrafts.clear();
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
  const searchKey=`${state.route.id}/${state.corridor}`;
  const query=listingSearch.get(searchKey)||'';
  document.querySelector('#station-search').value=query;paintStations(query);
  document.querySelector('#station-search').addEventListener('input',e=>{listingSearch.set(searchKey,e.target.value);paintStations(e.target.value);});
  document.querySelector('#via')?.addEventListener('change',e=>{location.hash=routePath(state.route,e.target.value);});
  bindPerson(stations);
}
function normalize(s){return normalizeStation(s);}
function paintStations(query){
  const q=normalize(query);
  const stations=CORRIDORS[state.corridor].filter(s=>s.name!=='長万部'&&(!isExpress()||state.route.stops.includes(s.name)||s.name==='新千歳空港')).slice().reverse().filter(s=>normalize(s.name).includes(q)||normalize(s.kana).includes(q));
  document.querySelector('#station-grid').innerHTML=stations.map(s=>{
    const d=distance(state.corridor,s.name),base=journeyFare(state.corridor,s.name,'長万部',state.person),fee=isExpress()?expressFee(s.name==='新千歳空港'?distance(state.corridor,'南千歳'):d,state.person):0;
    return `<button type="button" class="station-card" data-station="${esc(s.name)}" aria-label="${s.name} ${yen(base+fee)}円"><strong>${s.name}</strong><span class="station-info"><span>${s.code}</span><b>${yen(base+fee)} <em>円</em></b></span></button>`;
  }).join('')||'<p class="empty">該当する駅がありません。<br>駅名か経由・方面を確認してください。</p>';
  document.querySelectorAll('[data-station]').forEach(b=>b.addEventListener('click',()=>{location.hash=`#/fare/${state.route.id}/${encodeURIComponent(b.dataset.station)}?via=${state.corridor}`;}));
}
function fareKey(){return `${state.route.id}/${state.corridor}/${state.boarding}`;}
function farePage(){
  renderFareScreen(main,state,{routeDescription,onSave:()=>fareDrafts.set(fareKey(),{...state}),onNext:()=>{
    fareDrafts.clear();state.person='adult';listingSearch.delete(`${state.route.id}/${state.corridor}`);location.hash=routePath();
  }});
}
function guide(){
  document.title='使い方・運賃データ｜長万部駅 着駅精算';
  main.innerHTML=crumb('<i></i><span>使い方・運賃データ</span>')+`<article class="guide"><p class="eyebrow">GUIDE & DATA</p><h1>使い方・運賃データ</h1><section><h2>3つの操作で精算</h2><ol><li>メニューからご乗車の列車を選び、乗車駅をタップします。経由・方面も確認してください。</li><li>おとな・こどもと、きっぷの種類を選択します。金額式は券面発駅と金額、区間の乗越は券面の発着駅を入力します。</li><li>「精算額を表示」を押し、大きな金額表示と計算内訳を確認します。特急利用時は特急券の状態も選択してください。</li></ol></section><section><h2>計算の扱い</h2><div class="rule-line"><strong>整理券・乗車券なし</strong><p>選択した乗車駅から長万部までの運賃を全額表示します。整理券番号と駅名の対応は列車ごとに異なるため、番号では検索しません。</p></div><div class="rule-line"><strong>100km以内の乗車券</strong><p>原券の発駅から長万部までの運賃と、原券の運賃の差額を計算します。金額式は券面の金額を差し引きます。</p></div><div class="rule-line"><strong>101km以上の乗車券</strong><p>営業キロの1km未満を切り上げ、101km以上となる原券は、原券の着駅から長万部までの運賃を別途計算します。原券の区間と経路が入力候補にある通常の片道乗車券が対象です。</p></div><div class="rule-line"><strong>特急 北斗</strong><p>普通車指定席・座席未指定の通常料金を通年で計算。乗越は、同じ列車・同じ座席種別の特急券に限り、新旧の料金差額を表示します。新千歳空港は南千歳乗継です。</p></div><div class="rule-line"><strong>経路・こども・特例</strong><p>小樽経由と室蘭・千歳線経由は別に計算。砂原経由の大沼〜森は両端を通る場合22.5kmを使用します。室蘭・千歳線経由で札幌市内の駅から長万部までの運賃は札幌中心駅基準。新千歳空港は加算運賃を含みます。こどもは運賃・料金をそれぞれ半額にし、10円未満を切り捨てます。</p></div></section><section><h2>対応範囲</h2><p>本アプリは精算補助ツールです。通常の片道・無割引の紙のきっぷを対象としています。割引乗車券、定期券、IC、企画券、連絡乗車券、グリーン車、経路変更、長万部以遠のきっぷ、原券の着駅より先で列車に乗り継ぐ場合、候補にない発着駅は係員による確認が必要です。払いもどしや決済・発券は行いません。最終的な取扱いは最新の規則・現場の確認によります。</p></section><section><h2>運賃データと参照元</h2><p>バージョン ${META.version} ／ 運賃適用 ${META.fareSince}改定後 ／ 確認日 ${META.checked}。利用者提供の2026年3月更新表に掲載された運賃・料金も照合しています。原画像はサイトに掲載していません。JR北海道の公式サイトではありません。</p><ul class="source-list" style="margin-top:18px">${SOURCES.map(([t,u])=>`<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${t}</a></li>`).join('')}</ul></section><a class="back-action" href="#/">メニューに戻る</a></article>`;
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
      state.boarding=name;
      const draft=fareDrafts.get(fareKey());
      if(draft){const chosenPerson=state.person;Object.assign(state,draft);if(state.person!==chosenPerson){state.person=chosenPerson;state.result=null;state.dirty=true;if(state.type==='none'&&!isExpress()){state.result=settlement({...state,express:false});state.dirty=false;}}}
      else {
        Object.assign(state,{type:'none',paid:'',ticketFrom:name,ticketTo:'',expressTicket:'none',expressFrom:name==='新千歳空港'?'南千歳':name,expressTicketFrom:name==='新千歳空港'?'南千歳':name,expressTo:'',dirty:false,error:''});
        state.result=settlement({...state,express:isExpress()});
      }
      farePage();
    }else stations();
  }else home();
  window.scrollTo(0,0);
  main.focus({preventScroll:true});
}
document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();main.focus();main.scrollIntoView();});
window.addEventListener('hashchange',navigate);navigate();
