import {useState,useEffect,useRef} from 'react';import JsBarcode from 'jsbarcode';import {api} from './App.jsx';
const box={border:'1px solid #e5e7eb',borderRadius:10,padding:12,marginBottom:12,background:'#fff'},b={padding:'6px 12px',borderRadius:6,border:'1px solid #111',background:'#111',color:'#fff',cursor:'pointer'};
const tk=n=>'৳'+Number(n||0).toLocaleString('en-IN');const dh=o=>new Date(Date.now()+6*3600e3+o*864e5).toISOString().slice(0,10);
const num=v=>v===''||v==null?undefined:+v,str=v=>v===''||v==null?undefined:v;
export function CameraScan({onCode}){const [on,setOn]=useState(false);const v=useRef();
 useEffect(()=>{if(!on)return;let s,stop=false;(async()=>{try{s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});v.current.srcObject=s;await v.current.play();
  const d=new BarcodeDetector();const tick=async()=>{if(stop)return;try{const r=await d.detect(v.current);if(r[0]){onCode(r[0].rawValue);setOn(false);return}}catch{}setTimeout(tick,300)};tick()}
  catch{alert('ক্যামেরা স্ক্যান সাপোর্ট নেই (Chrome + HTTPS লাগবে)');setOn(false)}})();return()=>{stop=true;s&&s.getTracks().forEach(t=>t.stop())}},[on]);
 return <><button style={b} onClick={()=>setOn(!on)}>📷</button>{on&&<video ref={v} style={{width:'100%',maxWidth:300}} muted playsInline/>}</>}
const F=[['name','নাম'],['sku','SKU'],['barcode','বার্কোড'],['price','বিক্রয় মূল্য'],['cost','কস্ট'],['stock','স্টক'],['low_stock','লো-স্টক লেভেল'],['vat_rate','ভ্যাট %'],['size','সাইজ'],['color','কালার'],['category','ক্যাটাগরি'],['brand','ব্র্যান্ড']];
export function ProductsPro(){const [l,setL]=useState([]);const [q,setQ]=useState('');const [f,setF]=useState({});const [id,setId]=useState(null);const [e,setE]=useState('');
 const load=()=>api('/products/manage').then(setL);useEffect(()=>{load()},[]);
 const save=async()=>{try{const body={name:f.name,sku:f.sku,barcode:str(f.barcode),price:+f.price,cost:num(f.cost),stock:num(f.stock),low_stock:num(f.low_stock),vat_rate:num(f.vat_rate),size:str(f.size),color:str(f.color),category:str(f.category),brand:str(f.brand)};
  await api(id?'/products/'+id:'/products',{method:id?'PUT':'POST',body});setF({});setId(null);setE('');load()}catch(x){setE(x.message)}};
 return <div><div style={box}><b>{id?'পণ্য এডিট':'নতুন পণ্য'}</b><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:6,margin:'8px 0'}}>
  {F.map(([k,t])=><input key={k} placeholder={t} value={f[k]??''} onChange={x=>setF({...f,[k]:x.target.value})}/>)}</div>
  <button style={b} onClick={save}>{id?'আপডেট':'যোগ করুন'}</button> {id&&<button onClick={()=>{setId(null);setF({})}}>বাতিল</button>} <span style={{color:'red'}}>{e}</span></div>
  <input placeholder="সার্চ..." value={q} onChange={x=>setQ(x.target.value)} style={{marginBottom:8,width:'100%'}}/>
  <table width="100%"><thead><tr><th>নাম</th><th>SKU/বার্কোড</th><th>সাইজ/কালার</th><th>দাম</th><th>কস্ট</th><th>স্টক</th><th></th></tr></thead><tbody>
  {l.filter(p=>(p.name+p.sku+(p.barcode||'')).toLowerCase().includes(q.toLowerCase())).map(p=><tr key={p.id}><td>{p.name}</td><td>{p.sku}<br/><small>{p.barcode}</small></td><td>{p.size} {p.color}</td><td>{p.price}</td><td>{p.cost}</td><td style={{color:p.stock<=p.low_stock?'red':''}}>{p.stock}</td>
   <td><button onClick={()=>{setId(p.id);setF(p);window.scrollTo(0,0)}}>এডিট</button> <button onClick={async()=>{if(confirm('মুছবেন?')){await api('/products/'+p.id,{method:'DELETE'});load()}}}>✕</button></td></tr>)}</tbody></table></div>}
export function Promos(){const [c,setC]=useState([]);const [g,setG]=useState([]);const [f,setF]=useState({type:'percent'});const [amt,setAmt]=useState('');const [e,setE]=useState('');
 const load=()=>{api('/coupons').then(setC);api('/giftcards').then(setG)};useEffect(()=>{load()},[]);
 return <div><div style={box}><b>নতুন কুপন</b><div style={{display:'flex',gap:6,flexWrap:'wrap',margin:'8px 0'}}>
  <input placeholder="কোড (EID10)" value={f.code||''} onChange={x=>setF({...f,code:x.target.value})}/><select value={f.type} onChange={x=>setF({...f,type:x.target.value})}><option value="percent">শতাংশ %</option><option value="fixed">নির্দিষ্ট টাকা</option></select>
  <input type="number" placeholder="মান" value={f.value||''} onChange={x=>setF({...f,value:x.target.value})}/><input type="number" placeholder="ন্যূনতম বিল" value={f.min||''} onChange={x=>setF({...f,min:x.target.value})}/>
  <input type="number" placeholder="সর্বোচ্চ ব্যবহার (0=সীমাহীন)" value={f.max||''} onChange={x=>setF({...f,max:x.target.value})}/><input type="date" value={f.exp||''} onChange={x=>setF({...f,exp:x.target.value})}/>
  <button style={b} onClick={async()=>{try{await api('/coupons',{method:'POST',body:{code:f.code,type:f.type,value:+f.value,min_total:+f.min||0,max_uses:+f.max||0,expires:str(f.exp)}});setF({type:'percent'});setE('');load()}catch(x){setE(x.message)}}}>যোগ</button><span style={{color:'red'}}>{e}</span></div>
  {c.map(x=><div key={x.id} style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #eee',padding:4,opacity:x.active?1:.5}}><span><b>{x.code}</b> — {x.type==='percent'?x.value+'%':tk(x.value)} · ন্যূনতম {tk(x.min_total)} · ব্যবহার {x.used}/{x.max_uses||'∞'} {x.expires&&'· মেয়াদ '+x.expires}</span><button onClick={async()=>{await api(`/coupons/${x.id}/toggle`,{method:'PUT'});load()}}>{x.active?'বন্ধ':'চালু'}</button></div>)}</div>
  <div style={box}><b>গিফট কার্ড ইস্যু</b><div style={{margin:'8px 0'}}><input type="number" placeholder="টাকা" value={amt} onChange={x=>setAmt(x.target.value)}/> <button style={b} onClick={async()=>{const r=await api('/giftcards',{method:'POST',body:{amount:+amt}});alert('গিফট কার্ড কোড: '+r.code);setAmt('');load()}}>ইস্যু</button></div>
  {g.map(x=><div key={x.id} style={{borderTop:'1px solid #eee',padding:4}}><b>{x.code}</b> — ব্যালান্স {tk(x.balance)} / {tk(x.initial)}</div>)}</div></div>}
function Bar({code}){const r=useRef();useEffect(()=>{try{JsBarcode(r.current,code,{format:'CODE128',height:32,fontSize:10,margin:0,width:1.4})}catch{}},[code]);return <svg ref={r}/>}
export function Labels(){const [l,setL]=useState([]);const [sel,setSel]=useState({});useEffect(()=>{api('/products/manage').then(setL)},[]);
 const out=l.flatMap(p=>Array((+sel[p.id])||0).fill(p));
 return <div><div className="noprint" style={box}><b>বার্কোড লেবেল — কয়টা কপি লাগবে লিখুন</b><button style={{...b,float:'right'}} onClick={()=>window.print()}>প্রিন্ট</button>
  <div style={{maxHeight:260,overflow:'auto',marginTop:8}}>{l.map(p=><div key={p.id} style={{display:'flex',gap:8,padding:2}}><input type="number" min="0" style={{width:60}} value={sel[p.id]||''} onChange={x=>setSel({...sel,[p.id]:x.target.value})}/>{p.name} {p.size} {p.color} <small>({p.stock})</small></div>)}</div></div>
  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>{out.map((p,i)=><div key={i} style={{width:'50mm',height:'30mm',border:'1px dashed #bbb',padding:4,textAlign:'center',fontSize:10,pageBreakInside:'avoid',background:'#fff'}}>
   <b>{p.name}</b> {p.size} {p.color}<br/><Bar code={p.barcode||p.sku}/><br/><b>৳{p.price}</b></div>)}</div></div>}
async function dl(t,from,to){const r=await fetch(`/api/export/${t}?from=${from}&to=${to}`,{headers:{Authorization:'Bearer '+sessionStorage.getItem('t')}});if(!r.ok)return alert('এক্সপোর্ট হয়নি');
 const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download=t+'.xlsx';a.click()}
export function Reports(){const [from,setFrom]=useState(dh(-29));const [to,setTo]=useState(dh(0));const [r,setR]=useState();useEffect(()=>{api(`/reports/detail?from=${from}&to=${to}`).then(setR)},[from,to]);
 const T=({h,rows,cols})=><div style={box}><b>{h}</b><table width="100%"><tbody>{rows.map((x,i)=><tr key={i}>{cols.map(c=><td key={c}>{typeof x[c]==='number'&&c!=='qty'&&c!=='n'?tk(x[c]):x[c]}</td>)}</tr>)}</tbody></table></div>;
 return <div><div className="noprint" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12,alignItems:'center'}}><input type="date" value={from} onChange={x=>setFrom(x.target.value)}/> থেকে <input type="date" value={to} onChange={x=>setTo(x.target.value)}/>
  <button style={b} onClick={()=>dl('sales',from,to)}>Excel: বিক্রি</button><button style={b} onClick={()=>dl('expenses',from,to)}>Excel: খরচ</button><button style={b} onClick={()=>dl('products',from,to)}>Excel: পণ্য/স্টক</button><button style={b} onClick={()=>window.print()}>PDF / প্রিন্ট</button></div>
  <h3 style={{margin:'0 0 8px'}}>রিপোর্ট: {from} → {to}</h3>
  {r&&<><T h="পেমেন্ট পদ্ধতি" rows={r.byMethod} cols={['method','n','total']}/><T h="ক্যাটাগরি অনুযায়ী" rows={r.byCategory} cols={['category','qty','revenue']}/><T h="সেরা ২০ পণ্য" rows={r.top.map(x=>({...x,name:`${x.name} ${x.size||''} ${x.color||''}`}))} cols={['name','qty','revenue']}/>
  <T h={`বিক্রির তালিকা (সর্বোচ্চ ৫০০)`} rows={r.sales} cols={['invoice','created_at','cashier','method','status','total']}/></>}</div>}
export function Users(){const [l,setL]=useState([]);const [f,setF]=useState({role:'cashier'});const [e,setE]=useState('');const me=JSON.parse(sessionStorage.getItem('u')).id;
 const load=()=>api('/users').then(setL);useEffect(()=>{load()},[]);const up=async(id,body)=>{try{await api('/users/'+id,{method:'PUT',body});load()}catch(x){alert(x.message)}};
 return <div><div style={box}><b>নতুন ইউজার</b><div style={{display:'flex',gap:6,flexWrap:'wrap',margin:'8px 0'}}><input placeholder="username" value={f.username||''} onChange={x=>setF({...f,username:x.target.value})}/><input type="password" placeholder="পাসওয়ার্ড (১০+ অক্ষর)" value={f.password||''} onChange={x=>setF({...f,password:x.target.value})}/>
  <select value={f.role} onChange={x=>setF({...f,role:x.target.value})}><option>cashier</option><option>manager</option><option>admin</option></select>
  <button style={b} onClick={async()=>{try{await api('/users',{method:'POST',body:f});setF({role:'cashier'});setE('');load()}catch(x){setE(x.message)}}}>তৈরি</button><span style={{color:'red'}}>{e}</span></div></div>
  <table width="100%"><tbody>{l.map(u=><tr key={u.id} style={{opacity:u.active?1:.5}}><td>{u.username}{u.id===me&&' (আপনি)'}</td>
   <td><select value={u.role} disabled={u.id===me} onChange={x=>up(u.id,{role:x.target.value})}><option>cashier</option><option>manager</option><option>admin</option></select></td>
   <td><button disabled={u.id===me} onClick={()=>up(u.id,{active:!u.active})}>{u.active?'নিষ্ক্রিয় করুন':'সক্রিয় করুন'}</button> <button onClick={()=>{const p=prompt('নতুন পাসওয়ার্ড (১০+ অক্ষর)');if(p)up(u.id,{password:p})}}>পাসওয়ার্ড রিসেট</button></td></tr>)}</tbody></table></div>}
