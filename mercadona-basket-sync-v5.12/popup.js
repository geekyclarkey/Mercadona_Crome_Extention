const result=document.getElementById('result');
function render(x){if(!x||x.status==='idle'||clearingLog)return;const {status,total,processed,added=[],notFound=[],errors=[],current,error}=x;
 const nameOf=v=>v.name||'(Name unavailable in new cart)';
 const itemText=v=>{
  const base=`${nameOf(v)} | ID: ${v.id} | Qty: ${v.quantity}`;
  if(!v.substituted)return base;
  const sources=(v.sources||[]).map(x=>`${x.name||'Product'} [${x.id}]`).join(', ');
  return `${base} | SUBSTITUTE for: ${sources}${v.substituteLabel?' | Label: '+v.substituteLabel:''}`;
 };
 document.getElementById('summary').textContent=error?error:`Status: ${status||'idle'} | Processed: ${processed||0}/${total||0} | Added: ${added.length} | Not found / unverified: ${notFound.length}`;
 const lines=[];
 if(notFound.length){lines.push('NOT FOUND / UNVERIFIED');for(const v of notFound)lines.push(`${itemText(v)} | ${v.reason||''}`)}
 if(errors.length){lines.push('\nERRORS');for(const v of errors)lines.push(`${itemText(v)} | ${v.error||''}`)}
 if(added.length){lines.push('\nADDED / CONFIRMED');for(const v of added)lines.push(`${itemText(v)}${v.recoveredAfterTimeout?' | Confirmed on final recheck':''}`)}
 result.textContent=lines.join('\n')||'No product results yet.';
 document.getElementById('copy').disabled=!lines.length;
 document.getElementById('copy').onclick=()=>navigator.clipboard.writeText(`${document.getElementById('summary').textContent}\n\n${lines.join('\n')}`);
}
async function poll(){try{render(await chrome.runtime.sendMessage({type:'STATUS'}))}catch(e){document.getElementById('summary').textContent=e.message}}
document.getElementById('go').onclick=async()=>{document.getElementById('summary').textContent='Starting...';try{render(await chrome.runtime.sendMessage({type:'TRANSFER'}))}catch(e){document.getElementById('summary').textContent=e.message}};
document.getElementById('stop').onclick=async()=>{await chrome.runtime.sendMessage({type:'STOP'});await poll()};poll();setInterval(poll,1200);


// UI-only availability checks. Do not modify the transfer service worker.
let sitesReady=false;
let lastSiteCheck=0;
let clearingLog=false;
function siteBadge(id,ok,description){
 const el=document.getElementById(id);
 el.className='site '+(ok?'ok':'bad');
 el.querySelector('small').textContent=description;
}
async function checkSites(){
 if(Date.now()-lastSiteCheck<1800)return;
 lastSiteCheck=Date.now();
 try{
  const tabs=await chrome.tabs.query({});
  const host=t=>{try{return new URL(t.url).hostname.toLowerCase().replace(/^www\./,'')}catch{return ''}};
  const newer=tabs.find(t=>host(t)==='tienda.mercadona.es');
  const older=tabs.find(t=>host(t)==='telecompra.mercadona.es');
  let newReady=false,oldReady=false;
  if(newer){
   try{
    const r=await chrome.scripting.executeScript({target:{tabId:newer.id},world:'MAIN',func:()=>{
      try{const raw=localStorage.getItem('MO-cart');return {ok:!!raw,hasCart:!!raw}}catch{return {ok:false}};
    }});
    newReady=!!r[0]?.result?.ok;
   }catch{}
  }
  if(older){
   try{
    const r=await chrome.scripting.executeScript({target:{tabId:older.id},world:'MAIN',func:()=>{
      try{const f=window.frames['rightFrame'];return {ok:!!f?.document?.getElementById('tblTicket')&&f.NAME_COOKIE==='cesta'}}catch{return {ok:false}};
    }});
    oldReady=!!r[0]?.result?.ok;
   }catch{}
  }
  siteBadge('newSite',newReady,newer?(newReady?'Open · cart accessible':'Open · cart not ready'):'Tab not open');
  siteBadge('oldSite',oldReady,older?(oldReady?'Open · basket accessible':'Open · basket not ready / sign-in may be needed'):'Tab not open');
  sitesReady=newReady&&oldReady;
  document.getElementById('go').disabled=!sitesReady;
  document.getElementById('siteWarning').textContent=!newer?'Open the new Mercadona website to transfer products.':!older?'Open Telecompra and sign in before transferring products.':!newReady?'New Mercadona cart is not accessible yet. Check the site and sign-in.':!oldReady?'Telecompra basket is not ready. Check that you are signed in.':'';
 }catch(e){
  sitesReady=false;
  document.getElementById('go').disabled=true;
  document.getElementById('siteWarning').textContent='Could not check website status: '+e.message;
 }
}
const originalTransferClick=document.getElementById('go').onclick;
document.getElementById('go').onclick=async()=>{
 await checkSites();
 if(!sitesReady)return;
 return originalTransferClick();
};
document.getElementById('clear').onclick=async()=>{
 if(!confirm('Clear the saved transfer report? This will NOT remove products from either basket.'))return;
 try{
  clearingLog=true;
  const status=await chrome.runtime.sendMessage({type:'STATUS'});
  if(status?.status==='running'){
   alert('A transfer is still running. Stop it before clearing the report.');return;
  }
  await chrome.storage.local.remove('progress');
  document.getElementById('summary').textContent='Ready — log cleared';
  document.getElementById('result').textContent='No product results yet.';
  document.getElementById('copy').disabled=true;
  document.getElementById('copy').onclick=null;
 }catch(e){alert('Could not clear log: '+e.message)}finally{clearingLog=false}
};
// The existing status polling remains unchanged; site status is independent.
checkSites();
setInterval(checkSites,3000);


// Saved substitutions: independent of the existing transfer controls.
const subList=document.getElementById('subList');
const subMessage=document.getElementById('subMessage');
let substituteRules={};
const validId=v=>/^\d+$/.test(v);
async function productName(id){
 const tabs=await chrome.tabs.query({});
 const tab=tabs.find(t=>{try{return new URL(t.url).hostname.replace(/^www\./,'')==='tienda.mercadona.es'}catch{return false}});
 if(!tab)return '';
 try{
  const response=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',args:[id],func:async id=>{
   try{const r=await fetch('/api/products/'+encodeURIComponent(id)+'/?lang=es',{credentials:'same-origin',signal:AbortSignal.timeout(6000)});if(!r.ok)return '';const x=await r.json();if(String(x.id)!==id)return '';return x.display_name||x.name||x.description||x.details?.name||''}catch{return ''}
  }});
  return String(response[0]?.result||'');
 }catch{return ''}
}
function renderSubs(){
 subList.replaceChildren();
 const term=(document.getElementById('subSearch')?.value||'').toLowerCase().trim();
 const entries=Object.entries(substituteRules).filter(([id,r])=>!term||[id,r.target,r.label,r.sourceName].some(v=>String(v||'').toLowerCase().includes(term))).sort((a,b)=>Number(a[0])-Number(b[0]));
 if(!entries.length){const p=document.createElement('p');p.textContent='No substitutes saved yet.';subList.append(p);return}
 for(const [from,rule] of entries){
  const line=document.createElement('div');line.className='subRow';
  const info=document.createElement('span');info.className='subInfo';
  const title=document.createElement('strong');title.textContent=`${from} → ${rule.target}`;
  const desc=document.createElement('small');desc.textContent=[rule.sourceName||'',rule.label?rule.label:''].filter(Boolean).join(' | ')||'Product names not available';
  info.append(title,desc);
  const edit=document.createElement('button');edit.textContent='Edit';edit.className='subEdit';edit.onclick=()=>{document.getElementById('subFrom').value=from;document.getElementById('subTo').value=rule.target;document.getElementById('subLabel').value=rule.label||'';document.getElementById('subFrom').focus()};
  const del=document.createElement('button');del.textContent='Remove';del.className='subRemove';del.onclick=async()=>{delete substituteRules[from];await chrome.storage.local.set({substitutes:substituteRules});renderSubs();subMessage.textContent=`Removed substitute ${from}`};
  const toggle=document.createElement('label');toggle.className='subToggle';const check=document.createElement('input');check.type='checkbox';check.checked=rule.enabled!==false;check.onchange=async()=>{rule.enabled=check.checked;await chrome.storage.local.set({substitutes:substituteRules});renderSubs()};toggle.append(check,document.createTextNode('Enabled'));if(rule.enabled===false)line.classList.add('disabled');
  line.append(info,toggle,edit,del);subList.append(line);
 }
}
async function loadSubs(){const data=await chrome.storage.local.get('substitutes');substituteRules=data.substitutes||{};renderSubs()}
document.getElementById('saveSub').onclick=async()=>{
 const from=document.getElementById('subFrom').value.trim();
 const to=document.getElementById('subTo').value.trim();
 const label=document.getElementById('subLabel').value.trim();
 if(!validId(from)||!validId(to)||from===to){subMessage.textContent='Enter two different numeric product IDs.';return}
 const button=document.getElementById('saveSub');button.disabled=true;subMessage.textContent='Saving substitute…';
 try{
  const sourceName=await productName(from)||substituteRules[from]?.sourceName||'';
  const targetName=label||await productName(to)||substituteRules[from]?.label||'';
  substituteRules[from]={target:to,label:targetName,sourceName};
  await chrome.storage.local.set({substitutes:substituteRules});
  renderSubs();subMessage.textContent=`Saved ${from} → ${to}. This will apply on future transfers.`;
  document.getElementById('subFrom').value='';document.getElementById('subTo').value='';document.getElementById('subLabel').value='';
 }catch(e){subMessage.textContent='Could not save: '+e.message}finally{button.disabled=false}
};
loadSubs();

// v4.4 additions: UI and separate read-only comparison / controlled retry.
const $=id=>document.getElementById(id);
$('subSearch').addEventListener('input',renderSubs);
$('exportSubs').onclick=async()=>{
 const rules=(await chrome.storage.local.get('substitutes')).substitutes||{};
 const data=JSON.stringify({format:'mercadona-substitutes',version:1,exportedAt:new Date().toISOString(),rules},null,2);
 const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='mercadona-substitutes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
};
$('importSubs').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>1024*1024)throw Error('File too large');
  const parsed=JSON.parse(await file.text());if(parsed.format!=='mercadona-substitutes'||parsed.version!==1||!parsed.rules||typeof parsed.rules!=='object'||Array.isArray(parsed.rules))throw Error('Not a valid substitutes backup');
  const incoming={};for(const [from,r] of Object.entries(parsed.rules)){
   if(!/^\d+$/.test(from)||!r||!/^\d+$/.test(String(r.target))||from===String(r.target))throw Error('Invalid product ID in backup');
   incoming[from]={target:String(r.target),label:String(r.label||'').slice(0,200),sourceName:String(r.sourceName||'').slice(0,200),enabled:r.enabled!==false};
  }
  const existing=(await chrome.storage.local.get('substitutes')).substitutes||{};
  const overlaps=Object.keys(incoming).filter(k=>k in existing).length;
  if(!confirm(`Import ${Object.keys(incoming).length} rules? ${overlaps} existing rules with matching IDs will be overwritten; other rules will be kept.`))return;
  substituteRules={...existing,...incoming};await chrome.storage.local.set({substitutes:substituteRules});renderSubs();subMessage.textContent='Imported '+Object.keys(incoming).length+' substitutes.';
 }catch(err){subMessage.textContent='Import failed: '+err.message}finally{e.target.value=''}
};
function updateDashboard(progress,comparison){
 if(comparison?.rows){$('statProducts').textContent=comparison.sourceProducts;$('statUnits').textContent=comparison.sourceUnits;$('statConfirmed').textContent=comparison.rows.filter(r=>r.status==='Matched').length;$('statReview').textContent=comparison.rows.filter(r=>r.status!=='Matched').length;$('dashNote').textContent='Live comparison of the new cart and old basket (substitutions included).';return}
 if(progress?.total){const rows=[...(progress.added||[]),...(progress.notFound||[]),...(progress.errors||[])];$('statProducts').textContent=progress.sourceTotal||progress.total;$('statUnits').textContent=rows.reduce((n,r)=>n+(Number(r.quantity)||0),0);$('statConfirmed').textContent=progress.added?.length||0;$('statReview').textContent=(progress.notFound?.length||0)+(progress.errors?.length||0);$('dashNote').textContent='Last transfer report. Use Compare both baskets for live quantities.'}
}
let comparisonVisible=false;
const previousRender=render;
render=function(x){if(!comparisonVisible)previousRender(x);if(x&&!clearingLog&&!comparisonVisible)updateDashboard(x,null)};
const previousTransferHandler=$('go').onclick;
$('go').onclick=async()=>{comparisonVisible=false;return previousTransferHandler()};
const previousClearHandler=$('clear').onclick;
$('clear').onclick=async()=>{comparisonVisible=false;return previousClearHandler()};
function showComparison(c){
 comparisonVisible=true;
 const matched=c.rows.filter(r=>r.status==='Matched').length;
 const lines=[`BASKET COMPARISON — ${c.sourceProducts} products / ${c.sourceUnits} units | Matched: ${matched} | To check: ${c.rows.length-matched}`,''];
 for(const r of c.rows){
  const label=r.name||'Product';
  const idInfo=r.sourceId===r.targetId?`ID: ${r.sourceId}`:`New ID: ${r.sourceId} → Old ID: ${r.targetId}`;
  lines.push(`${label} | ${idInfo} | Wanted: ${r.wanted} | In old: ${r.actual} | ${r.status}`);
 }
 lines.push('','Old basket may contain additional items not requested.');
 $('summary').textContent=`Comparison complete | Matched: ${matched} | To check: ${c.rows.length-matched}`;
 $('result').textContent=lines.join('\n');
 $('copy').disabled=false;
 $('copy').onclick=()=>navigator.clipboard.writeText(`${$('summary').textContent}\n\n${lines.join('\n')}`);
 updateDashboard(null,c);
}
$('compare').onclick=async()=>{const b=$('compare');b.disabled=true;$('toolMessage').textContent='Comparing baskets…';try{const c=await chrome.runtime.sendMessage({type:'COMPARE_BASKETS'});if(c.error)throw Error(c.error);showComparison(c);$('toolMessage').textContent='Comparison complete.'}catch(e){$('toolMessage').textContent=e.message}finally{b.disabled=false}};
// Restore dashboard after startup even if the existing report was already rendered.
chrome.runtime.sendMessage({type:'STATUS'}).then(x=>updateDashboard(x,null)).catch(()=>{});
