// Presentation-only adapter. Reads the existing report; never calls the basket APIs.
(()=>{
 const original=document.getElementById('result');
 const summary=document.getElementById('summary');
 const display=document.getElementById('friendlyReport');
 function element(tag,className,text){const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e}
 function section(title,kind,rows){
  const box=element('section','reportSection '+kind);
  const header=element('header');header.append(element('h4','',title),element('span','',rows.length+' '+(rows.length===1?'product':'products')));box.append(header);
  for(const raw of rows){
   const line=raw.trim();if(!line)continue;
   const match=line.match(/^(.*?)\s\|\s(?:ID: (\d+)|New ID: (\d+) → Old ID: (\d+))\s\|\s(.*)$/);
   const name=match?match[1]:line;
   const id=match?(match[2]||match[4]):'';
   const rest=match?match[5]:'';
   const qty=rest.match(/(?:Qty|Wanted):\s*(\d+)/i)?.[1]||'';
   const originalId=match?.[3];
   const details=[];
   if(id)details.push('ID '+id);
   if(originalId)details.push('Original ID '+originalId);
   const substituted=rest.match(/SUBSTITUTE for:\s*(.*?)(?:\s\|\sLabel:|$)/i)?.[1];
   if(substituted)details.push('Substitute for '+substituted);
   const label=rest.match(/\|\sLabel:\s*(.*?)(?:\s\|\s|$)/i)?.[1];
   if(label)details.push('Label: '+label);
   const actual=rest.match(/In old:\s*(\d+)/i)?.[1];
   if(actual!==undefined)details.push('In old basket: '+actual);
   const row=element('div','reportRow');const product=element('div','reportProduct');
   product.append(element('strong','',name),element('small','',details.join(' · ')));
   const reason=rest.match(/(?:Basket reload timed out[^|]*|not restored[^|]*|Not present in old basket[^|]*|Stored in old basket cookie[^|]*|Confirmed on final recheck|\|\s*(?:[^|]*error[^|]*))$/i)?.[0];
   if(reason&&kind!=='confirmed')product.append(element('div','reportNote',reason.replace(/^\|\s*/,'')));
   let status=kind==='confirmed'?'Added':kind==='review'?'Check item':kind==='missing'?'Not found':kind==='unavailable'?'Unavailable':kind==='error'?'Error':'Review';
   if(kind==='compare')status=/\bMatched\s*$/i.test(rest)?'Matched':'Missing';
   if(kind==='review'&&/Unavailable on old Mercadona/i.test(rest))status='Unavailable';
   if(kind==='review'&&/Not visible in old Mercadona/i.test(rest))status='Not visible';
   const badge=element('span','reportState',status);
   if(kind==='compare'&&status==='Check item')badge.style.cssText='background:#fff0d6;color:#936018';
   row.append(product,element('span','reportQty',qty?'Qty '+qty:''),badge);
   if(['missing','review','unavailable','compare'].includes(kind)&&id&&status!=='Matched'){
    const action=element('button','findSubstitute','Find substitute');action.type='button';
    action.addEventListener('click',()=>{
     const subs=document.getElementById('substitutes');subs.open=true;
     document.getElementById('subFrom').value=originalId||id;
     const picker=document.getElementById('sourcePicker');if(picker&&[...picker.options].some(o=>o.value===(originalId||id)))picker.value=originalId||id;
     document.getElementById('subMessage').textContent='Enter the old Mercadona replacement ID for '+name+'.';
     subs.scrollIntoView({behavior:'smooth',block:'start'});
     document.getElementById('subTo').focus({preventScroll:true});
    });row.append(action);
   }
   box.append(row);
  }
  return box;
 }
 function refresh(){
  const raw=original.textContent||'';const head=summary.textContent||'';
  display.replaceChildren();
  if(!raw.trim()||raw==='No product results yet.'){
   const empty=element('div','reportEmpty');empty.append(element('strong','','Your shopping results will appear here'),element('span','','Transfer or compare your baskets to see product names, quantities and results.'));display.append(empty);return;
  }
  const top=element('div','reportHead');const left=element('div');
  const comparison=/^BASKET COMPARISON/m.test(raw);
  left.append(element('h3','',comparison?'Basket comparison':'Transfer results'),element('p','',comparison?'Requested products compared with the old basket':'Your latest shopping basket transfer'));
  const numbers=head.match(/(?:Matched|Added):\s*(\d+)/i);top.append(left,element('span','reportCount',numbers?numbers[1]+' '+(comparison?'matched':'confirmed'):'Results'));display.append(top);
  if(comparison){
   const lines=raw.split('\n').filter(s=>s.includes(' | ')&&/Wanted:\s*\d+/.test(s));
   const matched=lines.filter(s=>/\|\s*Matched\s*$/.test(s));const review=lines.filter(s=>!/\|\s*Matched\s*$/.test(s));
   if(review.length)display.append(section('Products needing attention','compare',review));
   if(matched.length)display.append(section('Matching products','confirmed',matched));
   return;
  }
  const buckets={missing:[],review:[],error:[],confirmed:[],unavailable:[],warning:[]};let active='';
  for(const line of raw.split('\n')){
   if(line==='UNAVAILABLE / REMOVED FROM OLD BASKET'){active='unavailable';continue}
   if(line==='AVAILABILITY CHECK WARNINGS'){active='warning';continue}
   if(line==='NOT TRANSFERRED / NOT IN OLD BASKET'){active='missing';continue}
   if(line==='NOT FOUND / UNVERIFIED'){active='review';continue}
   if(line==='ERRORS'){active='error';continue}
   if(line==='ADDED / CONFIRMED'){active='confirmed';continue}
   if(line.trim()&&active)buckets[active].push(line);
  }
  if(buckets.unavailable.length||buckets.missing.length||buckets.review.length)display.append(section('Products needing attention','review',[...buckets.unavailable,...buckets.missing,...buckets.review]));
  if(buckets.warning.length)display.append(section('Availability check warnings','review',buckets.warning));
  if(buckets.error.length)display.append(section('Errors','error',buckets.error));
  if(buckets.confirmed.length)display.append(section('Successfully transferred','confirmed',buckets.confirmed));
 }
 const observer=new MutationObserver(refresh);observer.observe(original,{childList:true,characterData:true,subtree:true});observer.observe(summary,{childList:true,characterData:true,subtree:true});refresh();
})();
