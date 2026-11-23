const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function getTabs(){const tabs=await chrome.tabs.query({});const host=t=>{try{return new URL(t.url).hostname.replace(/^www\./,'')}catch{return ''}};const newer=tabs.find(t=>host(t)==='tienda.mercadona.es');const older=tabs.find(t=>host(t)==='telecompra.mercadona.es');if(!newer||!older)throw Error('Open both Mercadona websites (new='+!!newer+', old='+!!older+').');return {newer,older}}
async function exec(tabId,fn,args=[]){const out=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:fn,args});return out[0]?.result}
async function readCart(){
 const raw=localStorage.getItem('MO-cart');if(!raw)throw Error('MO-cart not found');
 const data=JSON.parse(raw),lines=data.lines||data.items||[],grouped=new Map();
 const label=(x)=>{const options=[x.product?.display_name,x.product?.name,x.product?.description,x.product?.title,x.product?.details?.name,x.product?.details?.description,x.display_name,x.name,x.description,x.title,x.product_name,x.product?.packaging,x.product?.details?.packaging];for(const v of options){if(typeof v==='string'&&v.trim())return v.trim();if(v&&typeof v==='object'){for(const k of ['es','name','description','title','display_name'])if(typeof v[k]==='string'&&v[k].trim())return v[k].trim()}}return null};
 for(const x of lines){const id=String(x.product_id??x.product?.id??'');const qty=Number(x.quantity);if(!/^\d+$/.test(id)||!Number.isInteger(qty)||qty<=0)continue;const name=label(x);const old=grouped.get(id);if(old){old.quantity+=qty;if(!old.name&&name)old.name=name}else grouped.set(id,{id,quantity:qty,name})}
 const items=[...grouped.values()];
 // Mercadona's own product-details endpoint resolves names by the exact ID.
 // Read-only: does not alter either basket. Limit parallel requests.
 const productName=product=>{
  const candidates=[product?.display_name,product?.name,product?.description,product?.title,product?.details?.display_name,product?.details?.name];
  for(const v of candidates){if(typeof v==='string'&&v.trim())return v.trim();if(v&&typeof v==='object'){for(const k of ['es','name','description','title','display_name'])if(typeof v[k]==='string'&&v[k].trim())return v[k].trim()}}
  return null;
 };
 // Names are not stored in MO-cart. Mercadona's product API is warehouse-aware:
 // a regional product may be missing from the default catalogue even though
 // the user's current shop can display it. Do not change any basket data.
 const productNameFromResponse=payload=>{
  const product=payload?.product||payload;
  if(!product||typeof product!=='object')return null;
  const receivedId=String(product.id??product.product_id??'');
  return {id:receivedId,name:productName(product)};
 };
 const validName=value=>typeof value==='string'&&value.trim().length>3&&value.trim().length<200&&!/^(product|producto|añadir|add to basket)$/i.test(value.trim());
 const visibleNameById=new Map();
 const addVisible=(id,el)=>{
  if(visibleNameById.has(id))return;
  const nodes=[el,el.closest('[data-testid*="product"], [class*="product-card"], [class*="productCard"], article')].filter(Boolean);
  for(const node of nodes){
   const candidates=[node.getAttribute('aria-label'),node.getAttribute('title'),node.querySelector('img[alt]')?.getAttribute('alt'),node.querySelector('[class*="display-name"], [class*="product-name"], [class*="productName"], [class*="title"], h3, h2')?.textContent];
   for(const value of candidates){if(validName(value)){visibleNameById.set(id,value.replace(/\s+/g,' ').trim());return}}
  }
 };
 try{
  for(const anchor of document.querySelectorAll('a[href*="/product/"]')){
   const id=anchor.getAttribute('href')?.match(/\/product\/(\d+)(?:\/|[?#]|$)/)?.[1];
   if(id)addVisible(id,anchor);
  }
 }catch{}
 for(const item of items)if(!item.name&&visibleNameById.has(item.id))item.name=visibleNameById.get(item.id);
 // The current store's product endpoint is tried first, followed by explicit
 // warehouse and versioned API variants only for products whose names are missing.
 // svq1 is Mercadona's Seville warehouse; other fallbacks cover other regions.
 const lookup=async(item,url)=>{
  try{
   const response=await fetch(url,{credentials:'same-origin',headers:{Accept:'application/json'},signal:AbortSignal.timeout(6500)});
   if(!response.ok)return false;
   const parsed=productNameFromResponse(await response.json());
   if(parsed&&(!parsed.id||parsed.id===item.id)&&validName(parsed.name)){
    item.name=parsed.name.trim();return true;
   }
  }catch{}
  return false;
 };
 for(let i=0;i<items.length;i+=4){
  await Promise.all(items.slice(i,i+4).map(async item=>{
   if(item.name)return;
   const id=encodeURIComponent(item.id);
   const urls=[
    '/api/products/'+id+'/?lang=es',
    '/api/products/'+id+'/?lang=es&wh=svq1',
    '/api/v1_1/products/'+id+'?lang=es&wh=svq1',
    '/api/products/'+id+'/?lang=es&wh=mad1',
    '/api/products/'+id+'/?lang=es&wh=vlc1'
   ];
   for(const url of urls){if(await lookup(item,url))break}
  }));
 }
 // Last resort: use a matching product card if the page rendered during lookup.
 for(const item of items){
  if(item.name)continue;
  for(const a of document.querySelectorAll('a[href*="/product/"]')){
   if(new RegExp('/product/'+item.id+'(?:/|[?#]|$)').test(a.getAttribute('href')||''))addVisible(item.id,a);
  }
  if(visibleNameById.has(item.id))item.name=visibleNameById.get(item.id);
 }
 return items;
}
function basketSnapshot(){const f=window.frames['rightFrame'];if(!f?.document)throw Error('Telecompra rightFrame unavailable');const name=f.NAME_COOKIE;if(name!=='cesta')throw Error('Unexpected basket cookie: '+name);const m=f.document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));const cookie=m?decodeURIComponent(m.slice(name.length+1)):'';const codes=[...f.document.querySelectorAll('#tblTicket input[type="hidden"][id^="xc"]')].map(x=>x.id);return {cookie,codes,ready:!!f.document.getElementById('tblTicket'),url:f.location.href}}
function setOne(id,quantity){const f=window.frames['rightFrame'];if(!f?.document||typeof f.SetCookie!=='function')throw Error('Telecompra basket unavailable');const name=f.NAME_COOKIE;if(name!=='cesta')throw Error('Unexpected basket cookie name');const m=f.document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));const original=m?decodeURIComponent(m.slice(name.length+1)):'';const segments=original.split('b').filter(Boolean);const pattern=/^(xc\d+)a(\d+)a$/;if(segments.some(s=>!pattern.test(s)))throw Error('Unrecognised basket format; stopped to protect existing basket');const code='xc'+id;let previous=0;const next=segments.map(s=>{const [,c,q]=s.match(pattern);if(c===code){previous=Number(q);return c+'a'+Math.max(previous,quantity)+'a'}return s});if(!previous)next.unshift(code+'a'+quantity+'a');const written=next.map(s=>s+'b').join('');f.SetCookie(name,written);return {previous,original,written}}
function reloadBasket(){const f=window.frames['rightFrame'];if(!f)throw Error('rightFrame missing');f.location.reload();return true}
async function waitBasket(tabId,id,timeout=12000){const end=Date.now()+timeout;let last=null;while(Date.now()<end){await pause(450);try{last=await exec(tabId,basketSnapshot);if(last?.ready&&last.codes?.includes('xc'+id))return {found:true,snapshot:last};if(last?.ready&&last.cookie&&!last.cookie.includes('xc'+id+'a'))return {found:false,snapshot:last}}catch{}}return {found:false,snapshot:last,timeout:true}}
// A dedicated DelProductoTachado link is the old site's explicit marker
// for an unavailable item. Do not rely on a CSS class or blank price cell.
function inspectUnavailable(){
 const f=window.frames['rightFrame'],doc=f?.document;
 if(!doc?.getElementById('tblTicket'))throw Error('Old basket is not ready');
 const hits=[];
 for(const row of doc.querySelectorAll('#tblTicket tr')){
  const cell=row.querySelector('td[id^="hiddenxc"]');
  if(!cell)continue;
  const match=/^hiddenxc(\d+)$/.exec(cell.id);
  if(!match)continue;
  const id=match[1];
  const links=[...row.querySelectorAll('a[href]')].filter(a=>{
   const href=(a.getAttribute('href')||'').replace(/\s/g,'');
   return href==="javascript:DelProductoTachado('xc"+id+"')" || href==='javascript:DelProductoTachado("xc'+id+'")';
  });
  if(links.length!==1)continue;
  hits.push({id,name:(cell.textContent||'').trim().slice(0,220)});
 }
 return {ready:true,unavailable:hits};
}
function removeOldUnavailable(id){
 const f=window.frames['rightFrame'],doc=f?.document;
 if(!doc?.getElementById('tblTicket'))throw Error('Old basket not ready');
 const cell=doc.getElementById('hiddenxc'+id);
 const row=cell?.closest('tr');
 if(!row || !row.closest('#tblTicket'))return {triggered:false,reason:'Product row not found'};
 const link=[...row.querySelectorAll('a[href]')].find(a=>{
  const href=(a.getAttribute('href')||'').replace(/\s/g,'');
  return href==="javascript:DelProductoTachado('xc"+id+"')" || href==='javascript:DelProductoTachado("xc'+id+'")';
 });
 if(!link)return {triggered:false,reason:'Exact unavailable-product removal link not found'};
 // Execute the site's own removal handler in the page's frame context.
 f.DelProductoTachado('xc'+id);
 return {triggered:true};
}
async function cleanOldUnavailable(tabId,items){
 const wanted=new Map(items.map(x=>[String(x.id),x]));const removed=[],warnings=[];
 let found;
 try{found=await exec(tabId,inspectUnavailable)}catch(e){return {removed,warnings:[{name:'Availability check',reason:e.message}]}}
 for(const hit of found.unavailable){
  const item=wanted.get(String(hit.id));if(!item)continue;
  try{
   const r=await exec(tabId,removeOldUnavailable,[String(hit.id)]);
   if(!r?.triggered){warnings.push({...item,reason:r?.reason||'Native removal not triggered'});continue}
   // The site's native delete action may reload asynchronously. Verify the ID
   // is gone from BOTH its cookie and the rendered ticket before reporting removal.
   const end=Date.now()+12000;let verified=false;
   while(Date.now()<end){
    await pause(500);
    try{
     const state=await exec(tabId,function(id){
      const f=window.frames['rightFrame'],d=f?.document;
      if(!d?.getElementById('tblTicket'))return {ready:false};
      const cookie=d.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('cesta='));
      const val=cookie?decodeURIComponent(cookie.slice(6)):'';
      return {ready:true,inCookie:val.split('b').some(x=>x.startsWith('xc'+id+'a')),inTicket:!!d.getElementById('hiddenxc'+id)};
     },[String(hit.id)]);
     if(state?.ready&&!state.inCookie&&!state.inTicket){verified=true;break}
    }catch{}
   }
   if(verified)removed.push({...item,oldName:hit.name,reason:'Unavailable on old Mercadona — removed from old basket only'});
   else warnings.push({...item,reason:'Mercadona removal was triggered but not verified; check old basket'});
  }catch(e){warnings.push({...item,reason:'Native removal failed: '+e.message})}
 }
 return {removed,warnings};
}
let busy=false;
chrome.runtime.onMessage.addListener((m,s,reply)=>{if(!['TRANSFER','STATUS','STOP'].includes(m.type))return;if(m.type==='STATUS'){chrome.storage.local.get('progress').then(x=>reply(x.progress||{status:'idle'}));return true}if(m.type==='STOP'){chrome.storage.local.set({stopRequested:true}).then(()=>reply({status:'stop_requested'}));return true}if(busy){reply({error:'Transfer already running'});return true}busy=true;(async()=>{const {newer,older}=await getTabs();const sourceItems=await exec(newer.id,readCart);if(!sourceItems?.length)throw Error('No products in new basket');
// Apply saved ID substitutions before the existing cookie-based transfer logic.
const savedRules=(await chrome.storage.local.get('substitutes')).substitutes||{};
const targetItems=new Map();
for(const source of sourceItems){
 const rule=savedRules[source.id]?.enabled===false?null:savedRules[source.id];
 const targetId=rule&&/^\d+$/.test(String(rule.target||''))?String(rule.target):source.id;
 const existing=targetItems.get(targetId);
 const original={id:source.id,name:source.name,quantity:source.quantity};
 if(existing){existing.quantity+=source.quantity;existing.sources.push(original);if(targetId!==source.id)existing.substituted=true}
 else targetItems.set(targetId,{id:targetId,quantity:source.quantity,name:targetId===source.id?source.name:(rule?.label||source.name),substituted:targetId!==source.id,sources:[original],substituteLabel:rule?.label||''});
}
const items=[...targetItems.values()];const before=await exec(older.id,basketSnapshot);if(!before?.ready)throw Error('Old basket is not ready; open Telecompra and wait for it to load');await chrome.storage.local.set({stopRequested:false,basketBackup:{value:before.cookie,tabUrl:new URL(older.url).hostname},progress:{status:'running',total:items.length,sourceTotal:sourceItems.length,processed:0,added:[],notFound:[],errors:[]}});const added=[],notFound=[],errors=[];let stopped=false;for(let i=0;i<items.length;i++){const {stopRequested}=await chrome.storage.local.get('stopRequested');if(stopRequested){stopped=true;break}const item=items[i];try{const result=await exec(older.id,setOne,[item.id,item.quantity]);if(!result)throw Error('Could not write basket cookie');await exec(older.id,reloadBasket);const check=await waitBasket(older.id,item.id);if(check.found)added.push(item);else notFound.push({...item,reason:check.timeout?'Basket reload timed out — verify manually (not confirmed missing)':'Not restored by Telecompra'});}catch(e){errors.push({...item,error:e.message});break}await chrome.storage.local.set({progress:{status:'running',total:items.length,sourceTotal:sourceItems.length,processed:i+1,current:item.id,added,notFound,errors}})}// A slow frame reload is not proof a product is unavailable. Recheck all timeouts once.
 if(!stopped&&!errors.length&&notFound.some(x=>x.reason.startsWith('Basket reload timed out'))){
  try{const finalBasket=await exec(older.id,basketSnapshot);if(finalBasket?.ready){for(let i=notFound.length-1;i>=0;i--){const x=notFound[i];if(x.reason.startsWith('Basket reload timed out')&&finalBasket.codes?.includes('xc'+x.id)){added.push({...x,recoveredAfterTimeout:true});notFound.splice(i,1)}}}}catch{}
 }
 // Final read-only check: distinguish a product absent from BOTH the old
 // basket ticket and its cookie from an inconclusive timeout. Never delete it.
 if(!stopped&&!errors.length&&notFound.length){
  try{
   const finalBasket=await exec(older.id,basketSnapshot);
   if(finalBasket?.ready){
    const cookieIds=new Set(String(finalBasket.cookie||'').split('b').map(s=>/^(xc\d+)a\d+a$/.exec(s)?.[1]).filter(Boolean));
    for(let i=notFound.length-1;i>=0;i--){
     const x=notFound[i],code='xc'+x.id;
     if(finalBasket.codes?.includes(code)||cookieIds.has(code)){
      // Present in old-site data: do not call it missing.
      if(finalBasket.codes?.includes(code)){added.push({...x,recoveredAfterTimeout:true});notFound.splice(i,1)}
      else x.reason='Stored in old basket cookie but not visible in ticket — check manually';
     }else{
      x.notTransferred=true;
      x.reason='Not present in old basket or basket cookie after final check — product ID may be unavailable or different';
     }
    }
   }
  }catch(e){/* Leave unverified on any failed final inspection. */}
 }
 let unavailable=[],availabilityWarnings=[];
 if(!stopped&&!errors.length){
  try{
   const cleanup=await cleanOldUnavailable(older.id,items);
   unavailable=cleanup.removed;availabilityWarnings=cleanup.warnings;
   for(const x of unavailable){const i=added.findIndex(y=>y.id===x.id);if(i>=0)added.splice(i,1);
    const j=notFound.findIndex(y=>y.id===x.id);if(j>=0)notFound.splice(j,1)}
  }catch(e){availabilityWarnings.push({reason:'Availability check could not complete: '+e.message})}
 }
 // v5.18: final visible-ticket verification after unavailable-item cleanup.
 // Cookie entries alone do not prove that Telecompra accepted an item.
 if(!stopped&&!errors.length){
  try{
   const finalVisible=await exec(older.id,basketSnapshot);
   if(finalVisible?.ready){
    const visible=new Set(finalVisible.codes||[]);
    for(let i=added.length-1;i>=0;i--){
     const x=added[i];if(!visible.has('xc'+x.id)){
      added.splice(i,1);
      notFound.push({...x,notTransferred:true,reason:'Not visible in old Mercadona basket after final verification — find a substitute'});
     }
    }
    for(const x of notFound){
     if(!visible.has('xc'+x.id)){
      x.notTransferred=true;
      x.reason='Not visible in old Mercadona basket after final verification — find a substitute';
     }
    }
   }
  }catch(e){availabilityWarnings.push({reason:'Final visible-basket verification could not complete: '+e.message})}
 }
 const result={status:stopped?'stopped':errors.length?'stopped_on_error':'complete',total:items.length,sourceTotal:sourceItems.length,processed:added.length+notFound.length+errors.length+unavailable.length,added,notFound,errors,unavailable,availabilityWarnings,note:'Only confirmed unavailable items are removed from the old basket. The new basket is never changed. Check prices before checkout.'};await chrome.storage.local.set({progress:result});return result})().then(reply,e=>reply({error:e.message})).finally(()=>{busy=false});return true});

// v4.4 independent comparison and retry handlers. Original TRANSFER/STATUS/STOP implementation above is preserved.
let maintenanceBusy=false;
function cookieQuantities(snapshot){
 const out={};for(const segment of String(snapshot?.cookie||'').split('b')){const m=/^(xc\d+)a(\d+)a$/.exec(segment);if(m)out[m[1].slice(2)]=Number(m[2])}return out;
}
async function basketComparison(){
 const {newer,older}=await getTabs();const source=await exec(newer.id,readCart);const basket=await exec(older.id,basketSnapshot);
 if(!basket?.ready)throw Error('Old basket is not ready');const qty=cookieQuantities(basket);
 const rules=(await chrome.storage.local.get('substitutes')).substitutes||{};const grouped=new Map();
 for(const s of source){const rule=rules[s.id]?.enabled===false?null:rules[s.id];const target=rule&&/^\d+$/.test(String(rule.target||''))?String(rule.target):s.id;
  const entry=grouped.get(target)||{targetId:target,wanted:0,source:[]};entry.wanted+=s.quantity;entry.source.push(s);grouped.set(target,entry)}
 const rows=[];for(const group of grouped.values()){const actual=basket.codes?.includes('xc'+group.targetId)?(qty[group.targetId]||0):0;const names=group.source.map(s=>s.name||'Product').join(' + ');rows.push({name:names,sourceId:group.source.map(s=>s.id).join(', '),targetId:group.targetId,wanted:group.wanted,actual,status:actual>=group.wanted?'Matched':actual===0?'Missing':'Quantity short'})}
 return {sourceProducts:source.length,sourceUnits:source.reduce((n,s)=>n+s.quantity,0),rows};
}
async function retryUnverified(){
 if(busy||maintenanceBusy)throw Error('A transfer or retry is already running');maintenanceBusy=true;
 try{
  const stored=(await chrome.storage.local.get('progress')).progress;
  if(!stored||stored.status==='running')throw Error('Finish the current transfer first');
  const retry=(stored.notFound||[]).filter(x=>/timed out|not restored/i.test(x.reason||''));
  if(!retry.length)return {confirmed:0,remaining:0};
  const {older}=await getTabs();const first=await exec(older.id,basketSnapshot);if(!first?.ready)throw Error('Old basket not ready');
  // Preserve backup of the old cookie; no existing quantity is decreased.
  await chrome.storage.local.set({basketBackup:{value:first.cookie,tabUrl:new URL(older.url).hostname}});
  const confirmed=[];const unresolved=[];
  for(const item of retry){
   try{
    const before=await exec(older.id,basketSnapshot);if(!before?.ready)throw Error('Basket not ready');
    const current=cookieQuantities(before)[item.id]||0;
    if(current>=item.quantity && before.codes?.includes('xc'+item.id)){confirmed.push({...item,recoveredAfterTimeout:true});continue}
    await exec(older.id,setOne,[item.id,item.quantity]);await exec(older.id,reloadBasket);
    const check=await waitBasket(older.id,item.id,15000);
    const after=await exec(older.id,basketSnapshot).catch(()=>null);
    const quantity=cookieQuantities(after)[item.id]||0;
    if((check.found||after?.codes?.includes('xc'+item.id))&&quantity>=item.quantity)confirmed.push({...item,recoveredAfterTimeout:true});
    else unresolved.push({...item,reason:check.timeout?'Basket reload timed out — verify manually (not confirmed missing)':'Not restored by Telecompra'});
   }catch(e){unresolved.push({...item,reason:'Retry error: '+e.message})}
  }
  const other=(stored.notFound||[]).filter(x=>!retry.some(y=>y.id===x.id));
  const next={...stored,added:[...(stored.added||[]),...confirmed],notFound:[...other,...unresolved],status:'complete'};
  await chrome.storage.local.set({progress:next});return {confirmed:confirmed.length,remaining:unresolved.length};
 }finally{maintenanceBusy=false}
}
chrome.runtime.onMessage.addListener((m,s,reply)=>{
 if(m.type==='COMPARE_BASKETS'){basketComparison().then(reply,e=>reply({error:e.message}));return true}
 if(m.type==='RETRY_UNVERIFIED'){retryUnverified().then(reply,e=>reply({error:e.message}));return true}
});
