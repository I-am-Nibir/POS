import {useState,useEffect,useRef} from 'react';import {Search,Moon,Sun,X} from 'lucide-react';import {api,receipt} from './App.jsx';import {CameraScan} from './Extra2.jsx';import {isNet,qget,qadd,syncQueue,cacheGet,cacheSet} from './offline.js';import {build,printBytes,connectSerial,loadCfg} from './printer.js';
const r2=n=>Math.round(n*100)/100,tk=n=>'৳'+Number(n||0).toLocaleString('en-IN');
const beep=ok=>{try{const c=new AudioContext(),o=c.createOscillator();o.frequency.value=ok?880:200;o.connect(c.destination);o.start();o.stop(c.currentTime+(ok?.07:.3))}catch{}};
const M={cash:'ক্যাশ',card:'কার্ড',bkash:'বিকাশ',nagad:'নগদ',due:'বাকি'};
export default function Sell(){
 const [items,setItems]=useState([]),[q,setQ]=useState(''),[cat,setCat]=useState(''),[cart,setCart]=useState({}),[cs,setCs]=useState([]),[cust,setCust]=useState('');
 const [disc,setDisc]=useState(0),[code,setCode]=useState(''),[applied,setApplied]=useState(''),[cd,setCd]=useState(0),[gcode,setGcode]=useState(''),[gApplied,setGApplied]=useState(''),[gift,setGift]=useState(0);
 const [method,setMethod]=useState('cash'),[tender,setTender]=useState(''),[key,setKey]=useState(()=>crypto.randomUUID()),[msg,setMsg]=useState(null),[last,setLast]=useState(null),[busy,setBusy]=useState(false);
 const [held,setHeld]=useState(()=>JSON.parse(localStorage.getItem('held')||'[]')),[showHeld,setShowHeld]=useState(false),[light,setLight]=useState(()=>localStorage.getItem('posTheme')==='light');
 const [payOpen,setPayOpen]=useState(false),[discOpen,setDiscOpen]=useState(false);const sr=useRef(),H=useRef(),focus=()=>sr.current&&sr.current.focus();
 const [net,setNet]=useState(navigator.onLine),[pend,setPend]=useState(qget().length),[cfg,setCfg]=useState(null),[ser,setSer]=useState(false);
 const load=()=>{api('/products').then(x=>{setItems(x);cacheSet('p',x)}).catch(()=>setItems(cacheGet('p')));api('/customers').then(x=>{setCs(x);cacheSet('c',x)}).catch(()=>setCs(cacheGet('c')))};
 const sync=async()=>{if(!qget().length)return;const r=await syncQueue();setPend(qget().length);if(r.failed.length)setMsg({t:'সিঙ্ক ব্যর্থ (ম্যানেজারকে জানান): '+r.failed.map(f=>f.err).join(' | '),err:1});else if(r.done)setMsg({t:`${r.done}টি অফলাইন বিক্রি সিঙ্ক হয়েছে`});if(r.done)load()};
 useEffect(()=>{load();focus();loadCfg().then(setCfg);sync();const on=()=>{setNet(true);sync()},off=()=>setNet(false);addEventListener('online',on);addEventListener('offline',off);const t=setInterval(sync,30000);
  navigator.serial?.getPorts().then(async p=>{if(p[0]){try{await connectSerial(p[0]);setSer(true)}catch{}}});return()=>{removeEventListener('online',on);removeEventListener('offline',off);clearInterval(t)}},[]);
 const lines=Object.entries(cart).map(([id,qty])=>({p:items.find(i=>i.id==id),qty})).filter(l=>l.p);
 const sub=lines.reduce((a,l)=>a+l.p.price*l.qty,0),base=Math.max(0,sub-disc-cd),f=sub?base/sub:0;
 const vat=lines.reduce((a,l)=>a+r2(l.p.price*l.qty*l.p.vat_rate/100*f),0),total=r2(base+vat),giftUse=Math.min(gift,total),due=r2(total-giftUse);
 const given=tender===''?due:+tender,change=Math.max(0,r2(given-due)),short=method!=='due'&&method==='cash'&&given<due;
 useEffect(()=>{if(!applied)return;if(sub<=0){setApplied('');setCd(0);return}api(`/coupons/check?code=${encodeURIComponent(applied)}&base=${sub-disc}`).then(r=>setCd(r.discount)).catch(e=>{setMsg({t:e.message,err:1});setApplied('');setCd(0)})},[applied,sub,disc]);
 const add=p=>{if(p.stock<=0){beep(0);return setMsg({t:'স্টক নেই: '+p.name,err:1})}if((cart[p.id]||0)>=p.stock){beep(0);return}beep(1);setCart(c=>({...c,[p.id]:(c[p.id]||0)+1}))};
 const setQty=(p,n)=>setCart(c=>{const x={...c};if(n<=0)delete x[p.id];else x[p.id]=Math.min(n,p.stock);return x});
 const find=v=>{v=v.trim().toLowerCase();return items.find(i=>(i.barcode||'').toLowerCase()===v||i.sku.toLowerCase()===v)};
 const scan=c=>{const m=find(c);m?add(m):(beep(0),setMsg({t:'পণ্য পাওয়া যায়নি: '+c,err:1}))};
 const list=items.filter(i=>(!cat||i.category===cat)&&(!q||(i.name+i.sku+(i.barcode||'')+(i.size||'')+(i.color||'')).toLowerCase().includes(q.toLowerCase()))).slice(0,150);
 const cats=[...new Set(items.map(i=>i.category).filter(Boolean))];
 const clear=()=>{setPayOpen(false);setDiscOpen(false);setCart({});setDisc(0);setCode('');setApplied('');setCd(0);setGcode('');setGApplied('');setGift(0);setTender('');setCust('');setMethod('cash');setKey(crypto.randomUUID());setQ('');focus()};
 const hold=()=>{if(!lines.length)return;const h=[...held,{cart,cust,t:Date.now()}];localStorage.setItem('held',JSON.stringify(h));setHeld(h);clear();setMsg({t:'বিল হোল্ড হয়েছে (F6 দিয়ে ফিরিয়ে আনুন)'})};
 const recall=i=>{const h=held[i];setCart(h.cart);setCust(h.cust);const r=held.filter((_,k)=>k!==i);localStorage.setItem('held',JSON.stringify(r));setHeld(r);setShowHeld(false);focus()};
 const pay=async()=>{if(busy||!lines.length)return;if(method==='due'&&!cust)return setMsg({t:'বাকির জন্য কাস্টমার বাছুন',err:1});if(short)return setMsg({t:'প্রাপ্ত টাকা কম',err:1});
  const paid=method==='due'?(tender===''?0:+tender):method==='cash'?given:due;
  const body={items:lines.map(l=>({id:l.p.id,qty:l.qty})),discount:+disc||0,method,paid,key,customerId:cust?+cust:undefined,coupon:applied||undefined,gift:gApplied||undefined};
  const snap={lines,total,vat,disc:(+disc||0)+cd,paid,method};
  const finish=async(r,off)=>{const L={r,...snap,off};setLast(L);setMsg({t:off?`অফলাইনে সেভ: ${r.invoice} (ইন্টারনেট এলে সিঙ্ক হবে)`:`বিল সম্পন্ন ${r.invoice}`,change:r.change,due:r.due});beep(1);try{await printBytes(build(cfg,L,method==='cash'),cfg)}catch{}clear()};
  setBusy(true);
  try{if(!navigator.onLine)throw new TypeError('offline');const r=await api('/sales',{method:'POST',body});await finish(r,false);load()}
  catch(e){if(isNet(e)){
    if(body.coupon||body.gift)setMsg({t:'অফলাইনে কুপন/গিফট কার্ড চলবে না — সরিয়ে আবার চেষ্টা করুন',err:1});
    else{qadd({...body,at:new Date().toISOString()});setPend(qget().length);const sold=Object.fromEntries(lines.map(l=>[l.p.id,l.qty])),upd=items.map(i=>sold[i.id]?{...i,stock:i.stock-sold[i.id]}:i);setItems(upd);cacheSet('p',upd);
     await finish({invoice:'OFF-'+Date.now().toString(36).toUpperCase(),change:Math.max(0,r2(given-due)),due:method==='due'?r2(due-(tender===''?0:+tender)):0},true)}}
   else{setMsg({t:e.message,err:1});beep(0)}}
  setBusy(false)};
 H.current={pay,hold,f9:()=>payOpen?pay():(lines.length&&setPayOpen(true))};
 useEffect(()=>{const k=e=>{if(e.key==='F2'){e.preventDefault();focus()}else if(e.key==='F4'){e.preventDefault();H.current.hold()}else if(e.key==='F6'){e.preventDefault();setShowHeld(s=>!s)}else if(e.key==='F9'){e.preventDefault();H.current.f9()}};addEventListener('keydown',k);return()=>removeEventListener('keydown',k)},[]);
 const shift=async a=>{const s=prompt(a==='open'?'ওপেনিং ক্যাশ (৳)':'ড্রয়ারে এখন মোট ক্যাশ (৳)');if(s===null||isNaN(+s))return;try{const r=await api('/shifts/'+a,{method:'POST',body:a==='open'?{opening:+s}:{closing:+s}});setMsg({t:a==='open'?'শিফট চালু হয়েছে':`প্রত্যাশিত ${tk(r.expected)} · গণনা ${tk(r.counted)} · গরমিল ${tk(r.difference)}`})}catch(e){setMsg({t:e.message,err:1})}};
 const applyCode=()=>code&&setApplied(code.trim());
 const applyGift=async()=>{try{const g=await api('/giftcards/'+encodeURIComponent(gcode.trim()));setGift(g.balance);setGApplied(g.code)}catch(e){setMsg({t:e.message,err:1})}};
 const quick=[...new Set([due,Math.ceil(due/100)*100,Math.ceil(due/500)*500,Math.ceil(due/1000)*1000,2000,5000].filter(x=>x>=due&&x>0))].slice(0,5);
 const addCust=async()=>{const n=prompt('কাস্টমারের নাম');if(!n)return;const ph=prompt('ফোন (ঐচ্ছিক)')||undefined;try{const r=await api('/customers',{method:'POST',body:{name:n,phone:ph}});await load();setCust(String(r.id))}catch(e){setMsg({t:e.message,err:1})}};
 const connect=async()=>{try{await connectSerial();setSer(true);setMsg({t:'প্রিন্টার সংযুক্ত'})}catch{setMsg({t:'সংযোগ হয়নি (Chrome/Edge + HTTPS লাগবে; অথবা সার্ভারে PRINTER_HOST সেট করুন)',err:1})}};
 const cname=cs.find(c=>String(c.id)===String(cust))?.name||'ওয়াক-ইন';
 return <div className={'nx'+(light?' light':'')}>
  <section className="cartp">
   <div className="tabs"><div className="tab">কার্ট{lines.length>0&&<span className="badge">{lines.length}</span>}</div><span style={{flex:1}}/>
    <span className={'net '+(net?'on':'off')}>{net?'● অনলাইন':'● অফলাইন'}</span>{pend>0&&<button className="tb" onClick={sync}>⟳ সিঙ্ক ({pend})</button>}</div>
   <div className="cartbox">
    <div className="toolbox"><select value={cust} onChange={e=>setCust(e.target.value)}><option value="">ওয়াক-ইন কাস্টমার</option>{cs.map(c=><option key={c.id} value={c.id}>{c.name} {c.phone||''}{c.due>0?` (বাকি ${c.due})`:''}</option>)}</select>
     <button title="নতুন কাস্টমার" onClick={addCust}>＋</button><button onClick={()=>setShowHeld(true)}>রিকল ({held.length})</button><button onClick={()=>shift('open')}>শিফট খুলুন</button><button onClick={()=>shift('close')}>শিফট বন্ধ</button><button onClick={connect}>🖨 {ser?'সংযুক্ত':cfg?.network?'LAN':'প্রিন্টার'}</button></div>
    {msg&&<div className={'msg'+(msg.err?' err':'')} onClick={()=>setMsg(null)}>{msg.t}{msg.change!=null&&<div className="chg">ফেরত দিন: {tk(msg.change)}{msg.due>0&&` · বাকি ${tk(msg.due)}`}</div>}{last&&!msg.err&&msg.change!=null&&<button onClick={e=>{e.stopPropagation();receipt(last.r,last.lines,last.total,last.vat,last.disc)}}>🖨 রসিদ প্রিন্ট</button>}</div>}
    <div className="th"><div>পণ্য</div><div>পরিমাণ</div><div>মোট</div></div>
    <div className="rows">{!lines.length&&<p className="empty">কার্ট খালি — পণ্য স্ক্যান করুন বা ট্যাপ করুন</p>}
     {lines.map(l=><div key={l.p.id} className="row"><div><b>{l.p.name}</b> <small>{l.p.size} {l.p.color}</small><div className="lnk"><a className="rm" onClick={()=>setQty(l.p,0)}>মুছুন</a><span>{tk(l.p.price)}</span></div></div>
      <div className="qty"><button onClick={()=>setQty(l.p,l.qty-1)}>−</button><b>{l.qty}</b><button onClick={()=>setQty(l.p,l.qty+1)}>＋</button></div><div className="tot">{tk(l.p.price*l.qty)}</div></div>)}</div>
    <table className="sumt"><tbody>
     <tr><td>কাস্টমার: <b>{cname}</b></td><td>সাব-টোটাল</td><td className="r">{tk(sub)}</td></tr>
     <tr><td>কুপন: <b>{applied||'—'}</b>{cd>0&&` (−${tk(cd)})`}</td><td><a className="dl" onClick={()=>setDiscOpen(true)}>ডিসকাউন্ট</a></td><td className="r">{tk(disc)}</td></tr>
     <tr><td>গিফট কার্ড: <b>{gApplied||'—'}</b></td><td>ভ্যাট</td><td className="r">{tk(vat)}</td></tr>
     <tr className="gt"><td/><td>মোট</td><td className="r">{tk(total)}</td></tr></tbody></table>
   </div>
   <div className="bottom"><button className="b-pay" disabled={!lines.length} onClick={()=>setPayOpen(true)}>💳 পেমেন্ট <small>F9</small></button><button className="b-hold" disabled={!lines.length} onClick={hold}>⏸ হোল্ড <small>F4</small></button><button className="b-disc" disabled={!lines.length} onClick={()=>setDiscOpen(true)}>％ ডিসকাউন্ট</button><button className="b-void" disabled={!lines.length} onClick={clear}>✕ বাতিল</button></div>
  </section>
  <section className="gridp"><div className="gtool"><span className="ic"><Search size={16}/></span><span className="ic">▮▯▮</span>
    <input ref={sr} className="scan" placeholder="বার্কোড স্ক্যান করুন বা নাম/SKU লিখে Enter (F2)" value={q} onChange={e=>setQ(e.target.value)}
     onKeyDown={e=>{if(e.key==='Enter'&&q){const m=find(q)||(list.length===1&&list[0]);m?(add(m),setQ('')):(beep(0),setMsg({t:'পণ্য পাওয়া যায়নি',err:1}))}if(e.key==='Escape')setQ('')}}/>
    <CameraScan onCode={scan}/><button className="ic" title="থিম" onClick={()=>{localStorage.setItem('posTheme',light?'dark':'light');setLight(!light)}}>{light?<Moon size={16}/>:<Sun size={16}/>}</button></div>
   <div className="crumb"><a onClick={()=>setCat('')}>হোম</a>{cat&&<> › <b>{cat}</b></>}</div>
   <div className="tiles">{!cat&&cats.map(c=><button key={c} className="tile catg" onClick={()=>setCat(c)}>📁<b>{c}</b></button>)}
    {list.map(p=><button key={p.id} className="tile" disabled={p.stock<=0} onClick={()=>{add(p);focus()}}><b>{p.name}</b><span>{p.size} {p.color}</span><em>{tk(p.price)}</em><small className={p.stock<=p.low_stock?'low':''}>স্টক {p.stock}</small>{cart[p.id]>0&&<i>{cart[p.id]}</i>}</button>)}</div></section>
  {payOpen&&<div className="mdl" onClick={()=>setPayOpen(false)}><div className="dlg pay" onClick={e=>e.stopPropagation()}>
   <div className="dh"><b>পেমেন্ট</b><button onClick={()=>setPayOpen(false)}><X size={16}/></button></div>
   <div className="pb"><div className="pm">{Object.entries(M).map(([k,v])=><button key={k} className={method===k?'on':''} onClick={()=>{setMethod(k);setTender('')}}>{v}</button>)}</div>
    <div className="pr"><div className="due"><small>পরিশোধযোগ্য</small><b>{tk(due)}</b></div>
     <div className="pf"><input placeholder="কুপন কোড" value={code} onChange={e=>setCode(e.target.value)}/><button onClick={applyCode}>প্রয়োগ</button><input placeholder="গিফট কার্ড" value={gcode} onChange={e=>setGcode(e.target.value)}/><button onClick={applyGift}>প্রয়োগ</button></div>
     {(method==='cash'||method==='due')&&<><input className="amt" type="number" autoFocus placeholder={method==='due'?'এখন কত দিল (ঐচ্ছিক)':'প্রাপ্ত টাকা'} value={tender} onChange={e=>setTender(e.target.value)}/>
      {method==='cash'&&<div className="qk">{quick.map(x=><button key={x} onClick={()=>setTender(String(x))}>{x===due?'ঠিকঠাক':x}</button>)}</div>}
      {method==='cash'&&given>=due&&due>0&&<div className="chg">ফেরত: {tk(change)}</div>}</>}
     {msg?.err&&<div className="msg err">{msg.t}</div>}</div></div>
   <div className="df"><button onClick={()=>setPayOpen(false)}>বন্ধ</button><button className="b-pay" disabled={busy||!lines.length} onClick={pay}>{busy?'...':`নিশ্চিত করুন — ${tk(due)}`}</button></div></div></div>}
  {discOpen&&<div className="mdl" onClick={()=>setDiscOpen(false)}><div className="dlg" style={{maxWidth:340}} onClick={e=>e.stopPropagation()}><div className="dh"><b>ডিসকাউন্ট (৳)</b><button onClick={()=>setDiscOpen(false)}><X size={16}/></button></div>
   <div className="pb" style={{display:'block'}}><input className="amt" type="number" min="0" autoFocus value={disc||''} onChange={e=>setDisc(+e.target.value||0)}/><p style={{opacity:.7,fontSize:12}}>ক্যাশিয়ার সর্বোচ্চ ১০% দিতে পারে।</p></div><div className="df"><button className="b-pay" onClick={()=>setDiscOpen(false)}>ঠিক আছে</button></div></div></div>}
  {showHeld&&<div className="mdl" onClick={()=>setShowHeld(false)}><div className="dlg" style={{maxWidth:340}} onClick={e=>e.stopPropagation()}><div className="dh"><b>হোল্ড করা বিল</b><button onClick={()=>setShowHeld(false)}><X size={16}/></button></div><div className="pb" style={{display:'grid',gap:6}}>{!held.length&&<p>কোনো হোল্ড বিল নেই</p>}{held.map((h,i)=><button key={i} onClick={()=>recall(i)}>{new Date(h.t).toLocaleTimeString()} — {Object.keys(h.cart).length} আইটেম</button>)}</div></div></div>}
 </div>}
