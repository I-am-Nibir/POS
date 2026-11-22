import {useState,useEffect} from 'react';import {api} from './App.jsx';
const box={border:'1px solid #ddd',borderRadius:8,padding:12,marginBottom:12},b={padding:'6px 12px',borderRadius:6,border:'1px solid #333',background:'#111',color:'#fff',cursor:'pointer'};
function Form({fields,onSubmit,label}){const [f,setF]=useState({});const [e,setE]=useState('');
 return <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>{fields.map(k=><input key={k} placeholder={k} value={f[k]||''} onChange={x=>setF({...f,[k]:x.target.value})}/>)}
  <button style={b} onClick={async()=>{try{await onSubmit(f);setF({});setE('')}catch(x){setE(x.message)}}}>{label}</button><span style={{color:'red'}}>{e}</span></div>}
export function Customers(){const [l,setL]=useState([]);const load=()=>api('/customers').then(setL);useEffect(()=>{load()},[]);
 return <div><Form label="কাস্টমার যোগ" fields={['name','phone']} onSubmit={async f=>{await api('/customers',{method:'POST',body:{name:f.name,phone:f.phone||undefined}});load()}}/>
  <table width="100%"><thead><tr><th align="left">নাম</th><th>ফোন</th><th>বাকি</th><th>পয়েন্ট</th><th></th></tr></thead><tbody>
  {l.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.phone}</td><td>{c.due}</td><td>{c.points}</td><td>{c.due>0&&<button onClick={async()=>{const a=+prompt('কত টাকা পেলেন?');if(a){try{await api(`/customers/${c.id}/pay`,{method:'POST',body:{amount:a}});load()}catch(e){alert(e.message)}}}}>বাকি আদায়</button>}</td></tr>)}</tbody></table></div>}
export function Stock(){const [sup,setSup]=useState([]);const [pr,setPr]=useState([]);const [m,setM]=useState('');
 const load=()=>{api('/suppliers').then(setSup);api('/products').then(setPr)};useEffect(()=>{load()},[]);
 return <div><div style={box}><b>সাইজ × কালার ভ্যারিয়েন্ট একসাথে</b><Form label="তৈরি" fields={['name','baseSku','price','cost','sizes (M,L,XL)','colors (Red,Blue)','stock']}
   onSubmit={async f=>{const r=await api('/products/matrix',{method:'POST',body:{name:f.name,baseSku:f.baseSku,price:+f.price,cost:+f.cost||0,sizes:(f['sizes (M,L,XL)']||'').split(',').map(x=>x.trim()).filter(Boolean),colors:(f['colors (Red,Blue)']||'').split(',').map(x=>x.trim()).filter(Boolean),stock:+f.stock||0}});setM(r.created+'টি তৈরি');load()}}/>{m}</div>
  <div style={box}><b>সাপ্লায়ার</b><Form label="যোগ" fields={['name','phone']} onSubmit={async f=>{await api('/suppliers',{method:'POST',body:{name:f.name,phone:f.phone||undefined}});load()}}/>
   {sup.map(s=><div key={s.id}>{s.name} — পাওনা: {s.due} {s.due>0&&<button onClick={async()=>{const a=+prompt('কত দিলেন?');if(a){try{await api(`/suppliers/${s.id}/pay`,{method:'POST',body:{amount:a}});load()}catch(e){alert(e.message)}}}}>পরিশোধ</button>}</div>)}</div>
  <div style={box}><b>মাল গ্রহণ (পারচেজ)</b><Form label="স্টক যোগ" fields={['supplierId','productId','qty','cost','paid']}
   onSubmit={async f=>{await api('/purchases',{method:'POST',body:{supplierId:+f.supplierId,paid:+f.paid||0,items:[{id:+f.productId,qty:+f.qty,cost:+f.cost}]}});load()}}/>
   <small>সাপ্লায়ার/প্রোডাক্ট আইডি নিচের তালিকা থেকে দেখুন</small></div>
  <div style={box}><b>স্টক সমন্বয় (ড্যামেজ/গণনা)</b><Form label="সমন্বয়" fields={['productId','delta (+/-)','reason']} onSubmit={async f=>{await api(`/products/${+f.productId}/adjust`,{method:'POST',body:{delta:+f['delta (+/-)'],reason:f.reason}});load()}}/></div>
  <table width="100%"><tbody>{pr.map(p=><tr key={p.id}><td>#{p.id}</td><td>{p.name} {p.size} {p.color}</td><td>স্টক {p.stock}</td></tr>)}</tbody></table>
  <small>সাপ্লায়ার আইডি: {sup.map(s=>`${s.name}=#${s.id}`).join(', ')}</small></div>}
const tk=n=>'৳'+Number(n).toLocaleString('en-IN');
const dh=o=>new Date(Date.now()+6*3600e3+o*864e5).toISOString().slice(0,10);
export function Finance(){const role=JSON.parse(sessionStorage.getItem('u')).role;const [g,setG]=useState('day');
 const [from,setFrom]=useState(dh(-29));const [to,setTo]=useState(dh(0));const [rows,setRows]=useState([]);const [ex,setEx]=useState([]);const [f,setF]=useState({category:'Rent'});const [e,setE]=useState('');
 const load=()=>{api(`/reports/series?group=${g}&from=${from}&to=${to}`).then(setRows);api(`/expenses?from=${from}&to=${to}`).then(setEx)};useEffect(()=>{load()},[g,from,to]);
 const T=k=>rows.reduce((a,r)=>a+r[k],0);const mx=Math.max(1,...rows.map(r=>Math.abs(r.profit)));
 const card=(l,v,c)=><div style={{...box,flex:1,minWidth:130,marginBottom:0}}><small>{l}</small><div style={{fontSize:22,fontWeight:700,color:c}}>{tk(v)}</div></div>;
 return <div>
  <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
   <button style={{...b,opacity:g==='day'?1:.5}} onClick={()=>{setG('day');setFrom(dh(-29))}}>দৈনিক</button>
   <button style={{...b,opacity:g==='month'?1:.5}} onClick={()=>{setG('month');setFrom(dh(-364))}}>মাসিক</button>
   <input type="date" value={from} onChange={x=>setFrom(x.target.value)}/> থেকে <input type="date" value={to} onChange={x=>setTo(x.target.value)}/></div>
  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>{card('বিক্রি',T('revenue'),'#111')}{card('পণ্যের খরচ',T('cogs'),'#b45309')}{card('অন্যান্য খরচ',T('expenses'),'#b45309')}{card(T('profit')>=0?'নিট লাভ':'নিট ক্ষতি',Math.abs(T('profit')),T('profit')>=0?'#15803d':'#b91c1c')}</div>
  {rows.length>0&&<div style={{...box,overflowX:'auto'}}><svg width={Math.max(400,rows.length*34)} height="150">{rows.map((r,i)=>{const h=Math.abs(r.profit)/mx*60;return <g key={r.period}>
   <rect x={i*34+6} y={r.profit>=0?70-h:70} width="22" height={h||1} fill={r.profit>=0?'#16a34a':'#dc2626'}><title>{r.period}: {tk(r.profit)}</title></rect>
   <text x={i*34+17} y="145" fontSize="9" textAnchor="middle">{r.period.slice(g==='day'?8:5)}</text></g>})}<line x1="0" x2="100%" y1="70" y2="70" stroke="#999"/></svg></div>}
  <table width="100%" style={{marginBottom:16}}><thead><tr><th align="left">{g==='day'?'তারিখ':'মাস'}</th><th align="right">বিক্রি</th><th align="right">ফেরত</th><th align="right">পণ্যের খরচ</th><th align="right">খরচ</th><th align="right">লাভ/ক্ষতি</th></tr></thead><tbody>
   {[...rows].reverse().map(r=><tr key={r.period}><td>{r.period}</td><td align="right">{tk(r.revenue)}</td><td align="right">{tk(r.returns)}</td><td align="right">{tk(r.cogs)}</td><td align="right">{tk(r.expenses)}</td><td align="right" style={{color:r.profit>=0?'#15803d':'#b91c1c',fontWeight:600}}>{tk(r.profit)}</td></tr>)}</tbody></table>
  <div style={box}><b>দৈনিক খরচ যোগ</b><div style={{display:'flex',gap:6,flexWrap:'wrap',margin:'8px 0'}}>
   <select value={f.category} onChange={x=>setF({...f,category:x.target.value})}>{['Rent','Salary','Utilities','Transport','Marketing','Packaging','Other'].map(c=><option key={c}>{c}</option>)}</select>
   <input placeholder="বিবরণ" value={f.title||''} onChange={x=>setF({...f,title:x.target.value})}/><input type="number" placeholder="টাকা" value={f.amount||''} onChange={x=>setF({...f,amount:x.target.value})}/>
   <input type="date" value={f.date||dh(0)} onChange={x=>setF({...f,date:x.target.value})}/>
   <button style={b} onClick={async()=>{try{await api('/expenses',{method:'POST',body:{title:f.title,amount:+f.amount,category:f.category,date:f.date||dh(0)}});setF({category:f.category});setE('');load()}catch(x){setE(x.message)}}}>যোগ</button><span style={{color:'red'}}>{e}</span></div>
   {ex.map(x=><div key={x.id} style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #eee',padding:'4px 0'}}><span>{x.date} · {x.category} · {x.title}</span><span>{tk(x.amount)} {role==='admin'&&<button onClick={async()=>{if(confirm('মুছবেন?')){await api('/expenses/'+x.id,{method:'DELETE'});load()}}}>✕</button>}</span></div>)}</div>
  <div style={box}><b>আংশিক রিটার্ন / এক্সচেঞ্জ</b><Form label="রিটার্ন" fields={['saleId','productId','qty']} onSubmit={async f=>{const r=await api(`/sales/${+f.saleId}/return`,{method:'POST',body:{items:[{id:+f.productId,qty:+f.qty}]}});alert('ফেরত দিন: ৳'+r.refund);load()}}/><small>এক্সচেঞ্জ হলে রিটার্ন করে নতুন বিক্রি করুন।</small></div></div>}
