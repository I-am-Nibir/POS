import {useState,useEffect} from 'react';import {ShoppingCart,Package,Users as UsersIcon,Boxes,Wallet,Tag,Printer,BarChart3,ShieldCheck,LogOut,LayoutDashboard,Moon,Sun} from 'lucide-react';import {Customers,Stock,Finance} from './Extra.jsx';import SellPOS from './Sell.jsx';import Dash from './Dash.jsx';import {ProductsPro,Promos,Labels,Reports,Users,CameraScan} from './Extra2.jsx';
const S={font:'system-ui,sans-serif'},card={border:'1px solid #ddd',borderRadius:8,padding:12},btn={padding:'8px 14px',borderRadius:6,border:'1px solid #333',background:'#111',color:'#fff',cursor:'pointer'};
const tok=()=>sessionStorage.getItem('t');
export async function api(p,o={}){const r=await fetch('/api'+p,{...o,headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok()},body:o.body&&JSON.stringify(o.body)});
 const j=await r.json();if(!r.ok){if(r.status===401&&tok()){sessionStorage.clear();location.reload()}throw new Error(j.error)}return j}
export default function App(){
 const [user,setUser]=useState(()=>JSON.parse(sessionStorage.getItem('u')||'null'));const [tab,setTab]=useState(()=>{const u=JSON.parse(sessionStorage.getItem('u')||'null');return u&&u.role!=='cashier'?'dash':'pos'});const [dark,setDark]=useState(()=>localStorage.getItem('dashTheme')==='dark');
 if(!user)return <Login onLogin={u=>{setUser(u);setTab(u.role!=='cashier'?'dash':'pos')}}/>;
 const mgr=user.role!=='cashier';
 const NAV=[['dash','ড্যাশবোর্ড',LayoutDashboard,mgr],['pos','বিক্রি',ShoppingCart,1],['products','পণ্য',Package,mgr],['cust','কাস্টমার',UsersIcon,1],['stock','স্টক/সাপ্লায়ার',Boxes,mgr],['fin','হিসাব',Wallet,mgr],['promo','কুপন/গিফট',Tag,mgr],['labels','লেবেল',Printer,mgr],['rep2','রিপোর্ট',BarChart3,mgr],['users','ইউজার',ShieldCheck,user.role==='admin']];
 const label=(NAV.find(n=>n[0]===tab)||[])[1];
 return <div className={'shell'+(tab==='pos'?' posmode':'')}>
  <aside className="aside"><div className="brand">{tab==='pos'?'D':'Dokan POS'}</div>
   {NAV.filter(n=>n[3]).map(([k,l,I])=><button key={k} className={tab===k?'on':''} title={l} onClick={()=>setTab(k)}><I size={18}/><span>{l}</span></button>)}
   <div style={{flex:1}}/><div className="who"><span>{user.username} · {user.role}</span></div>
   <button title="থিম" onClick={()=>{localStorage.setItem('dashTheme',dark?'light':'dark');setDark(!dark)}}>{dark?<Sun size={18}/>:<Moon size={18}/>}<span>{dark?'লাইট থিম':'ডার্ক থিম'}</span></button>
   <button title="লগআউট" onClick={()=>{sessionStorage.clear();setUser(null)}}><LogOut size={18}/><span>লগআউট</span></button></aside>
  <main className={'main'+(dark?' dark':'')}>{tab==='pos'?<SellPOS/>:<><h2 className="ptitle">{label}</h2><div className="page">
   {tab==='dash'&&<Dash/>}{tab==='products'&&<ProductsPro/>}{tab==='promo'&&<Promos/>}{tab==='labels'&&<Labels/>}{tab==='rep2'&&<Reports/>}{tab==='users'&&<Users/>}{tab==='cust'&&<Customers/>}{tab==='stock'&&<Stock/>}{tab==='fin'&&<Finance/>}</div></>}</main></div>}

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
