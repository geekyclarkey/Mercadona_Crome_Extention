// Read-only product pickers. Transfer and saved substitute logic remain in popup.js/background.js.
(() => {
 const $=id=>document.getElementById(id);
 const host=t=>{try{return new URL(t.url).hostname.replace(/^www\./,'')}catch{return ''}};
 const getTab=async name=>(await chrome.tabs.query({})).find(t=>host(t)===name);
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 async function loadSource(){
  const select=$('sourcePicker');select.replaceChildren(new Option('Loading products…',''));
  try{
   const tab=await getTab('tienda.mercadona.es');if(!tab)throw Error('Open the new Mercadona website first.');
   const results=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:async()=>{
    const raw=localStorage.getItem('MO-cart');if(!raw)return [];
    const cart=JSON.parse(raw),lines=cart.lines||cart.items||[],unique=new Map();
    for(const item of lines){const id=String(item.product_id??item.product?.id??'');if(/^\d+$/.test(id))unique.set(id,{id,name:item.product?.display_name||item.product?.name||item.display_name||item.name||''})}
    const list=[...unique.values()];for(let i=0;i<list.length;i+=4)await Promise.all(list.slice(i,i+4).map(async x=>{if(x.name)return;try{const r=await fetch('/api/products/'+encodeURIComponent(x.id)+'/?lang=es',{credentials:'same-origin',signal:AbortSignal.timeout(5000)});if(r.ok){const p=await r.json();x.name=p.display_name||p.name||p.description||''}}catch{}}));return list;
   }});
   const items=results[0]?.result||[];select.replaceChildren(new Option('Select a product from your basket…',''));
   for(const item of items)select.add(new Option((item.name||'Product')+' · '+item.id,item.id));
   $('lookupMessage').textContent=items.length?`${items.length} products available to select.`:'No products found in the new basket.';
  }catch(e){select.replaceChildren(new Option('Basket unavailable',''));$('lookupMessage').textContent=e.message}
 }
 $('sourcePicker').addEventListener('change',e=>{if(e.target.value)$('subFrom').value=e.target.value});
 $('refreshPicker').addEventListener('click',loadSource);
 $('quickSave').addEventListener('click',()=>{
  const from=$('sourcePicker').value, to=$('quickOldId').value.trim(), label=$('quickLabel').value.trim();
  if(!/^\d+$/.test(from)){$('lookupMessage').textContent='Choose a product from your new basket first.';return}
  if(!/^\d+$/.test(to)||from===to){$('lookupMessage').textContent='Enter a different numeric old Mercadona product ID.';return}
  $('subFrom').value=from;$('subTo').value=to;$('subLabel').value=label;
  $('saveSub').click();
  $('lookupMessage').textContent='Saving substitute… Check the confirmation below.';
 });
 loadSource();
})();
