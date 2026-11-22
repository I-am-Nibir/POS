import {useState,useEffect} from 'react';import {Customers,Stock,Finance} from './Extra.jsx';import SellPOS from './Sell.jsx';import {ProductsPro,Promos,Labels,Reports,Users,CameraScan} from './Extra2.jsx';
const S={font:'system-ui,sans-serif'},card={border:'1px solid #ddd',borderRadius:8,padding:12},btn={padding:'8px 14px',borderRadius:6,border:'1px solid #333',background:'#111',color:'#fff',cursor:'pointer'};
const tok=()=>sessionStorage.getItem('t');
export async function api(p,o={}){const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok()},body:o.body&&JSON.stringify(o.body)});
 const j=await r.json();if(!r.ok){if(r.status===401&&tok()){sessionStorage.clear();location.reload()}throw new Error(j.error)}return j}
export default function App(){
 const [user,setUser]=useState(()=>JSON.parse(sessionStorage.getItem('u')||'null'));const [tab,setTab]=useState('pos');
 if(!user)return <Login onLogin={u=>setUser(u)}/>;
 const mgr=user.role!=='cashier';
 return <div style={{...S,maxWidth:tab==='pos'?'none':1100,margin:'0 auto',padding:tab==='pos'?8:16}}>
  <header style={{display:'flex',gap:8,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
   <b style={{flex:1}}>POS — {user.username} ({user.role})</b>
   <button style={btn} onClick={()=>setTab('pos')}>বিক্রি</button>
   {mgr&&<button style={btn} onClick={()=>setTab('products')}>পণ্য</button>}
   <button style={btn} onClick={()=>setTab('cust')}>কাস্টমার</button>{mgr&&<button style={btn} onClick={()=>setTab('stock')}>স্টক/সাপ্লায়ার</button>}{mgr&&<button style={btn} onClick={()=>setTab('fin')}>হিসাব</button>}{mgr&&<button style={btn} onClick={()=>setTab('promo')}>কুপন/গিফট</button>}{mgr&&<button style={btn} onClick={()=>setTab('labels')}>লেবেল</button>}{mgr&&<button style={btn} onClick={()=>setTab('rep2')}>রিপোর্ট ও এক্সপোর্ট</button>}{user.role==='admin'&&<button style={btn} onClick={()=>setTab('users')}>ইউজার</button>}
   <button style={btn} onClick={()=>{sessionStorage.clear();setUser(null)}}>লগআউট</button></header>
  {tab==='pos'&&<SellPOS/>}{tab==='products'&&<ProductsPro/>}{tab==='promo'&&<Promos/>}{tab==='labels'&&<Labels/>}{tab==='rep2'&&<Reports/>}{tab==='users'&&<Users/>}{tab==='report'&&<Report/>}{tab==='cust'&&<Customers/>}{tab==='stock'&&<Stock/>}{tab==='fin'&&<Finance/>}</div>}
function Login({onLogin}){const [u,setU]=useState('');const [p,setP]=useState('');const [e,setE]=useState('');
 const go=async ev=>{ev.preventDefault();try{const r=await api('/login',{method:'POST',body:{username:u,password:p}});
  sessionStorage.setItem('t',r.token);sessionStorage.setItem('u',JSON.stringify(r.user));onLogin(r.user)}catch(x){setE(x.message)}};
 return <form onSubmit={go} style={{...S,...card,maxWidth:320,margin:'80px auto',display:'grid',gap:8}}>
  <h3>লগইন</h3><input placeholder="username" value={u} onChange={e=>setU(e.target.value)}/>
  <input type="password" placeholder="password" value={p} onChange={e=>setP(e.target.value)}/>
  <button style={btn}>প্রবেশ</button><span style={{color:'red'}}>{e}</span></form>}
function Products(){const [items,setItems]=useState([]);const [f,setF]=useState({name:'',sku:'',price:'',stock:'',vat_rate:0});const [e,setE]=useState('');
 const load=()=>api('/products').then(setItems);useEffect(()=>{load()},[]);
 const save=async()=>{try{await api('/products',{method:'POST',body:{name:f.name,sku:f.sku,price:+f.price,stock:+f.stock,vat_rate:+f.vat_rate,size:f.size||undefined,color:f.color||undefined,category:f.category||undefined}});setE('');setF({name:'',sku:'',price:'',stock:'',vat_rate:0});load()}catch(x){setE(x.message)}};
 return <div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
  {['name','sku','price','stock','vat_rate','size','color','category'].map(k=><input key={k} placeholder={k} value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/>)}
  <button style={btn} onClick={save}>যোগ করুন</button><span style={{color:'red'}}>{e}</span></div>
  <table width="100%"><thead><tr><th align="left">নাম</th><th>SKU</th><th>দাম</th><th>স্টক</th></tr></thead>
  <tbody>{items.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td>{p.price}</td><td>{p.stock}</td></tr>)}</tbody></table></div>}
function Report(){const [r,setR]=useState();useEffect(()=>{api('/reports/daily').then(setR)},[]);if(!r)return null;
 return <div style={{display:'grid',gap:12}}><div style={card}>আজকের অর্ডার: <b>{r.summary.orders}</b> | বিক্রি: <b>৳{r.summary.revenue}</b> | ভ্যাট: ৳{r.summary.vat}</div>
  <div style={card}><b>সেরা পণ্য</b>{r.top.map(t=><div key={t.name}>{t.name} — {t.qty}</div>)}</div>
  <div style={card}><b>কম স্টক</b>{r.lowStock.map(t=><div key={t.name} style={{color:'red'}}>{t.name} — {t.stock}</div>)}</div></div>}

const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function receipt(r,lines,total,vat,disc){const w=window.open('','_blank','width=320,height=600');if(!w)return;
 w.document.write(`<style>@page{size:80mm auto;margin:2mm}</style><pre style="font:12px monospace;width:76mm;margin:0">${esc(r.invoice)}\n${new Date().toLocaleString()}\n--------------------\n${lines.map(l=>esc(`${l.p.name} ${l.p.size||''} ${l.p.color||''} x${l.qty}  ${l.p.price*l.qty}`)).join('\n')}\n--------------------\nVAT ${vat.toFixed(2)}  Discount ${disc}\nTOTAL ${total}\n\nধন্যবাদ!</pre>`);w.document.close();w.print()}
