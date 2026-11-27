(async()=>{
  const url=chrome.runtime.getURL('popup.html');
  try{
    const windows=await chrome.windows.getAll({populate:true});
    const existing=windows.find(w=>w.type==='popup'&&w.tabs?.some(t=>t.url===url));
    if(existing){await chrome.windows.update(existing.id,{focused:true});window.close();return;}
    const width=1100,height=760;
    const left=Math.max(0,Math.round((screen.availWidth-width)/2));
    const top=Math.max(0,Math.round((screen.availHeight-height)/2));
    await chrome.windows.create({url,type:'popup',width,height,left,top,focused:true});
    window.close();
  }catch(err){document.body.textContent='Could not open report window: '+err.message;}
})();
