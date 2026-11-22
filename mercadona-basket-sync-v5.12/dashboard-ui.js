// Presentation-only dashboard: reads existing progress and site data, never writes baskets.
(()=>{
 const $=id=>document.getElementById(id);
 const number=n=>Number.isFinite(n)?n.toLocaleString(): '—';
 let latestProgress=null, latestComparison=null;
 function update(){
  const p=latestProgress;
  const saved=Object.values(typeof substituteRules==='object'?substituteRules:{});
  $('savedRules').textContent=number(saved.length);
  const processed=[...(p?.added||[]),...(p?.notFound||[]),...(p?.errors||[])];
  $('usedRules').textContent=p?.total?number(processed.filter(x=>x.substituted).length):'—';
  if(latestComparison?.rows){
   const c=latestComparison;
   $('oldProducts').textContent=number(c.rows.filter(r=>Number(r.actual)>0).length);
   $('oldUnits').textContent=number(c.rows.reduce((n,r)=>n+(Number(r.actual)||0),0));
  }
  if(p?.total){
   const done=Math.min(Number(p.processed)||0,Number(p.total)||0), total=Number(p.total);
   const pct=total?Math.round(done/total*100):0;
   const confirmed=(p.added||[]).length,check=(p.notFound||[]).length+(p.errors||[]).length;
   const running=p.status==='running';
   $('progressTitle').textContent=running?'Transfer in progress':'Last transfer';
   $('progressPercent').textContent=pct+'% processed';
   $('progressText').textContent=`${done} of ${total} products processed · ${confirmed} confirmed`;
   $('progressFill').style.width=pct+'%';
   $('progressNote').textContent=check?`${check} product${check===1?'':'s'} need checking (not necessarily missing).`:running?'Transferring your products…':'No unverified products in the report.';
  }else{
   $('progressTitle').textContent='Last transfer';$('progressPercent').textContent='—';$('progressText').textContent='No transfer results yet';$('progressFill').style.width='0%';$('progressNote').textContent='Transfer your basket to see progress.';
  }
  const ready=$('newSite').classList.contains('ok')&&$('oldSite').classList.contains('ok');
  $('dashReady').textContent=ready?'Ready to transfer':'Check websites';$('dashReady').classList.toggle('ready',ready);
 }
 // Wrap the existing dashboard renderer; the transfer engine and comparison handlers remain unchanged.
 const previous=updateDashboard;
 updateDashboard=function(progress,comparison){previous(progress,comparison);if(progress)latestProgress=progress;if(comparison)latestComparison=comparison;update()};
 async function newCart(){
  try{
   const tabs=await chrome.tabs.query({});
   const tab=tabs.find(t=>{try{return new URL(t.url).hostname.replace(/^www\./,'')==='tienda.mercadona.es'}catch{return false}});
   if(!tab)return;
   const r=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:()=>{
    try{const raw=localStorage.getItem('MO-cart');if(!raw)return null;const data=JSON.parse(raw);const cart=data.cart||data;const lines=cart.lines||cart.items||[];if(!Array.isArray(lines))return null;return {products:lines.length,units:lines.reduce((n,x)=>n+(Number(x.quantity)||0),0)}}catch{return null}
   }});
   const v=r[0]?.result;if(v){$('newProducts').textContent=number(v.products);$('newUnits').textContent=number(v.units)}
  }catch{}
 }
 const clear=$('clear');clear.addEventListener('click',()=>{setTimeout(async()=>{const p=await chrome.runtime.sendMessage({type:'STATUS'}).catch(()=>null);if(!p?.total){latestProgress=null;latestComparison=null;$('oldProducts').textContent='—';$('oldUnits').textContent='—';update()}},300)});
 const originalRenderSubs=renderSubs;
 renderSubs=function(...args){const v=originalRenderSubs(...args);update();return v};
 chrome.runtime.sendMessage({type:'STATUS'}).then(p=>{latestProgress=p;update()}).catch(()=>{});
 newCart();setInterval(newCart,3500);setInterval(update,2000);update();
})();
