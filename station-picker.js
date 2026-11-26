// 払戻読取で使った、読み仮名検索・候補からの確定・手入力保持の方式。
export function normalizeStation(input) {
  return String(input || '').normalize('NFKC').trim().replace(/[ヶヵ]/g,c => c === 'ヶ' ? 'ケ' : 'カ')
    .replace(/[ァ-ヶ]/g,c => String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/\s+/g,'').replace(/駅$/,'').toLowerCase();
}
export function resolveStation(stations,input) {
  const q = normalizeStation(input);
  return stations.find(s => normalizeStation(s.name) === q || normalizeStation(s.kana) === q || (q === '札幌市内' && s.name === '札幌'));
}
export function stationMatches(stations,input,limit=8) {
  const q = normalizeStation(input);
  const score = s => [normalizeStation(s.name),normalizeStation(s.kana)].some(v => v.startsWith(q)) ? 0 : 1;
  return stations.filter(s => !q || [normalizeStation(s.name),normalizeStation(s.kana)].some(v => v.includes(q)) || q === '札幌市内' && s.name === '札幌')
    .map((s,i) => ({s,i})).sort((a,b) => score(a.s)-score(b.s) || a.i-b.i).slice(0,limit).map(x=>x.s);
}
export function mountStationPicker(input,stations,onChange) {
  const source=()=>typeof stations==='function'?stations():stations;
  const list = document.createElement('div'); list.className = 'station-options'; list.id = `${input.id}-options`; list.role = 'listbox'; list.hidden = true;
  input.parentElement.append(list); input.role = 'combobox'; input.setAttribute('aria-autocomplete','list'); input.setAttribute('aria-controls',list.id); input.setAttribute('aria-expanded','false'); input.autocomplete = 'off';
  const toggle=document.createElement('button');toggle.type='button';toggle.className='station-toggle';toggle.tabIndex=-1;
  toggle.setAttribute('aria-label',`${input.labels?.[0]?.textContent||'駅'}の候補を表示`);toggle.setAttribute('aria-controls',list.id);toggle.innerHTML='<span aria-hidden="true">⌄</span>';input.parentElement.append(toggle);
  let candidates = [], active = -1;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  const choose = s => { const name=normalizeStation(input.value)==='札幌市内'&&s.name==='札幌'?'札幌市内':s.name; input.value=name;input.removeAttribute('aria-invalid');close();onChange(name); };
  const paintActive = () => { [...list.children].forEach((option,i) => option.setAttribute('aria-selected',String(i === active))); if (active >= 0) input.setAttribute('aria-activedescendant',`${input.id}-choice-${active}`); else input.removeAttribute('aria-activedescendant'); };
  const open = (all=false) => {
    const available=source(),query=all?'':input.value;
    candidates = stationMatches(available,query,query?8:available.length); active = -1; list.replaceChildren();
    for (const [i,s] of candidates.entries()) {
      const option = document.createElement('div'); option.role = 'option'; option.id = `${input.id}-choice-${i}`; option.setAttribute('aria-selected','false');
      const name = document.createElement('strong'); name.textContent = s.name; const kana = document.createElement('span'); kana.textContent = s.kana;
      option.append(name,kana); option.addEventListener('pointerdown',e => e.preventDefault()); option.addEventListener('click',() => choose(s)); list.append(option);
    }
    list.hidden = !candidates.length; input.setAttribute('aria-expanded',String(candidates.length > 0));
  };
  toggle.addEventListener('pointerdown',e=>e.preventDefault());
  toggle.addEventListener('click',()=>{const wasOpen=!list.hidden;input.focus();if(wasOpen)close();else open(true);});
  input.addEventListener('input',() => { input.removeAttribute('aria-invalid');onChange(input.value); open(); });
  input.addEventListener('focus',()=>open(Boolean(resolveStation(source(),input.value))));input.addEventListener('blur',close);
  input.addEventListener('keydown',e => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (list.hidden) open(true); if (!candidates.length) return; active = e.key === 'ArrowDown' ? (active+1)%candidates.length : active<0?candidates.length-1:(active-1+candidates.length)%candidates.length; paintActive(); list.children[active].scrollIntoView({block:'nearest'}); }
    else if (e.key === 'Enter' && active >= 0 && !list.hidden) { e.preventDefault(); choose(candidates[active]); }
  });
}
