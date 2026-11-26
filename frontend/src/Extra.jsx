import {__} from './i18n.js';
import { ph, cat } from './i18n.js';
import { useState, useEffect } from 'react';
import { api } from './App.jsx';
const box = {
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12
  },
  b = {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #333',
    background: '#111',
    color: '#fff',
    cursor: 'pointer'
  };
function Form({
  fields,
  onSubmit,
  label
}) {
  const [f, setF] = useState({});
  const [e, setE] = useState('');
  return <div style={{
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8
  }}>{fields.map(k => <input key={k} placeholder={ph(k)} value={f[k] || ''} onChange={x => setF({
      ...f,
      [k]: x.target.value
    })} />)}
  <button style={b} onClick={async () => {
      try {
        await onSubmit(f);
        setF({});
        setE('');
      } catch (x) {
        setE(x.message);
      }
    }}>{label}</button><span style={{
      color: 'red'
    }}>{e}</span></div>;
}
export function Customers() {
  const [l, setL] = useState([]);
  const load = () => api('/customers').then(setL);
  useEffect(() => {
    load();
  }, []);
  return <div><Form label={__("কাস্টমার যোগ")} fields={['name', 'phone']} onSubmit={async f => {
      await api('/customers', {
        method: 'POST',
        body: {
          name: f.name,
          phone: f.phone || undefined
        }
      });
      load();
    }} />
  <table width="100%"><thead><tr><th align="left">{__("নাম")}</th><th>{__("ফোন")}</th><th>{__("বাকি")}</th><th>{__("পয়েন্ট")}</th><th></th></tr></thead><tbody>
  {l.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.phone}</td><td>{c.due}</td><td>{c.points}</td><td>{c.due > 0 && <button onClick={async () => {
              const a = +prompt(__("কত টাকা পেলেন?"));
              if (a) {
                try {
                  await api(`/customers/${c.id}/pay`, {
                    method: 'POST',
                    body: {
                      amount: a
                    }
                  });
                  load();
                } catch (e) {
                  alert(e.message);
                }
              }
            }}>{__("বাকি আদায়")}</button>}</td></tr>)}</tbody></table></div>;
}
export function Stock() {
  const [sup, setSup] = useState([]);
  const [pr, setPr] = useState([]);
  const [m, setM] = useState('');
  const load = () => {
    api('/suppliers').then(setSup);
    api('/products').then(setPr);
  };
  useEffect(() => {
    load();
  }, []);
  return <div><div style={box}><b>{__("সাইজ × কালার ভ্যারিয়েন্ট একসাথে")}</b><Form label={__("তৈরি")} fields={['name', 'baseSku', 'price', 'cost', 'sizes (M,L,XL)', 'colors (Red,Blue)', 'stock']} onSubmit={async f => {
        const r = await api('/products/matrix', {
          method: 'POST',
          body: {
            name: f.name,
            baseSku: f.baseSku,
            price: +f.price,
            cost: +f.cost || 0,
            sizes: (f['sizes (M,L,XL)'] || '').split(',').map(x => x.trim()).filter(Boolean),
            colors: (f['colors (Red,Blue)'] || '').split(',').map(x => x.trim()).filter(Boolean),
            stock: +f.stock || 0
          }
        });
        setM(r.created + __("টি তৈরি"));
        load();
      }} />{m}</div>
  <div style={box}><b>{__("সাপ্লায়ার")}</b><Form label={__("যোগ")} fields={['name', 'phone']} onSubmit={async f => {
        await api('/suppliers', {
          method: 'POST',
          body: {
            name: f.name,
            phone: f.phone || undefined
          }
        });
        load();
      }} />
   {sup.map(s => <div key={s.id}>{s.name}{__(" — পাওনা: ")}{s.due} {s.due > 0 && <button onClick={async () => {
          const a = +prompt(__("কত দিলেন?"));
          if (a) {
            try {
              await api(`/suppliers/${s.id}/pay`, {
                method: 'POST',
                body: {
                  amount: a
                }
              });
              load();
            } catch (e) {
              alert(e.message);
            }
          }
        }}>{__("পরিশোধ")}</button>}</div>)}</div>
  <div style={box}><b>{__("মাল কেনা (পারচেজ)")}</b><Form label={__("স্টক যোগ")} fields={['supplierId', 'productId', 'qty', 'cost', 'paid']} onSubmit={async f => {
        await api('/purchases', {
          method: 'POST',
          body: {
            supplierId: +f.supplierId,
            paid: +f.paid || 0,
            items: [{
              id: +f.productId,
              qty: +f.qty,
              cost: +f.cost
            }]
          }
        });
        load();
      }} />
   <small>{__("সাপ্লায়ার ও পণ্যের আইডি নিচের তালিকায় দেখুন")}</small></div>
  <div style={box}><b>{__("স্টক সমন্বয় (ড্যামেজ/গণনা)")}</b><Form label={__("সমন্বয়")} fields={['productId', 'delta (+/-)', 'reason']} onSubmit={async f => {
        await api(`/products/${+f.productId}/adjust`, {
          method: 'POST',
          body: {
            delta: +f['delta (+/-)'],
            reason: f.reason
          }
        });
        load();
      }} /></div>
  <table width="100%"><tbody>{pr.map(p => <tr key={p.id}><td>#{p.id}</td><td>{p.name} {p.size} {p.color}</td><td>{__("স্টক ")}{p.stock}</td></tr>)}</tbody></table>
  <small>{__("সাপ্লায়ার আইডি: ")}{sup.map(s => `${s.name}=#${s.id}`).join(', ')}</small></div>;
}
const tk = n => __("৳") + Number(n).toLocaleString('en-IN');
const dh = o => new Date(Date.now() + 6 * 3600e3 + o * 864e5).toISOString().slice(0, 10);
function ReturnByInvoice({onDone}) {
 const [invoice,setInvoice]=useState(''),[sale,setSale]=useState(null),[lines,setLines]=useState([]),[qty,setQty]=useState({}),[busy,setBusy]=useState(false),[camera,setCamera]=useState(false),[video,setVideo]=useState(null);
 const find=async(code=invoice)=>{const value=String(code||'').trim();if(!value)return alert('Enter or scan an invoice barcode');try{const d=await api(`/sales/by-invoice/${encodeURIComponent(value)}/receipt`);setSale(d.sale);setLines(d.lines);setQty({});setInvoice(d.sale.invoice)}catch(e){setSale(null);setLines([]);alert(e.message)}};
 useEffect(()=>{if(!camera)return;let stream,stop=false;const run=async()=>{try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});if(video){video.srcObject=stream;await video.play();const detector=new BarcodeDetector({formats:['code_128','qr_code','ean_13','ean_8','code_39']});const tick=async()=>{if(stop)return;try{const found=await detector.detect(video);if(found[0]){setInvoice(found[0].rawValue);setCamera(false);find(found[0].rawValue);return}}catch{}setTimeout(tick,300)};tick()}}catch{alert('Camera scanning needs HTTPS and a supported browser');setCamera(false)}};run();return()=>{stop=true;stream?.getTracks().forEach(t=>t.stop())}},[camera,video]);
 const submit=async()=>{if(!sale)return;const items=lines.filter(x=>Number(qty[x.p.id]||0)>0).map(x=>({id:x.p.id,qty:Number(qty[x.p.id])}));if(!items.length)return alert('Choose return quantities');setBusy(true);try{const r=await api(`/sales/${sale.id}/return`,{method:'POST',body:{items}});alert(`Refund amount: ৳${r.refund}`);setSale(null);setLines([]);setInvoice('');onDone?.()}catch(e){alert(e.message)}finally{setBusy(false)}};
 return <div style={box}><b>Return / Refund by Invoice</b><div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'10px 0'}}><input placeholder="Invoice number / scan barcode" value={invoice} onChange={e=>setInvoice(e.target.value)} onKeyDown={e=>e.key==='Enter'&&find()}/><button style={b} onClick={()=>find()}>Find invoice</button><button style={b} onClick={()=>setCamera(x=>!x)}>📷 Scan</button></div>{camera&&<video ref={setVideo} muted playsInline style={{width:'100%',maxWidth:320}}/>}{sale&&<><p><b>{sale.invoice}</b> · {sale.created_at} · {sale.status} · {tk(sale.total)}</p><div style={{overflowX:'auto'}}><table width="100%"><thead><tr><th>Product</th><th>Sold</th><th>Return Qty</th></tr></thead><tbody>{lines.map(x=><tr key={x.p.id}><td>{x.p.name}</td><td>{x.qty}</td><td><input type="number" min="0" max={x.qty} value={qty[x.p.id]||''} onChange={e=>setQty(v=>({...v,[x.p.id]:Math.min(x.qty,Math.max(0,Number(e.target.value)||0))}))} style={{width:75}}/></td></tr>)}</tbody></table></div><button style={b} disabled={busy} onClick={submit}>{busy?'Processing…':'Process Return / Refund'}</button></>}</div>
}

export function Finance() {
  const role = JSON.parse(sessionStorage.getItem('u')).role;
  const [g, setG] = useState('day');
  const [from, setFrom] = useState(dh(-29));
  const [to, setTo] = useState(dh(0));
  const [rows, setRows] = useState([]);
  const [ex, setEx] = useState([]);
  const [f, setF] = useState({
    category: 'Rent'
  });
  const [e, setE] = useState('');
  const load = () => {
    api(`/reports/series?group=${g}&from=${from}&to=${to}`).then(setRows);
    api(`/expenses?from=${from}&to=${to}`).then(setEx);
  };
  useEffect(() => {
    load();
  }, [g, from, to]);
  const T = k => rows.reduce((a, r) => a + r[k], 0);
  const mx = Math.max(1, ...rows.map(r => Math.abs(r.profit)));
  const card = (l, v, c) => <div style={{
    ...box,
    flex: 1,
    minWidth: 130,
    marginBottom: 0
  }}><small>{l}</small><div style={{
      fontSize: 22,
      fontWeight: 700,
      color: c
    }}>{tk(v)}</div></div>;
  return <div>
  <div style={{
      display: 'flex',
      gap: 8,
      marginBottom: 12,
      alignItems: 'center',
      flexWrap: 'wrap'
    }}>
   <button style={{
        ...b,
        opacity: g === 'day' ? 1 : .5
      }} onClick={() => {
        setG('day');
        setFrom(dh(-29));
      }}>{__("দৈনিক")}</button>
   <button style={{
        ...b,
        opacity: g === 'month' ? 1 : .5
      }} onClick={() => {
        setG('month');
        setFrom(dh(-364));
      }}>{__("মাসিক")}</button>
   <input type="date" value={from} onChange={x => setFrom(x.target.value)} />{__(" থেকে ")}<input type="date" value={to} onChange={x => setTo(x.target.value)} /></div>
  <div style={{
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 12
    }}>{card(__("বিক্রি"), T('revenue'), '#111')}{card(__("পণ্যের খরচ"), T('cogs'), '#b45309')}{card(__("অন্যান্য খরচ"), T('expenses'), '#b45309')}{card(T('profit') >= 0 ? __("নিট লাভ") : __("নিট ক্ষতি"), Math.abs(T('profit')), T('profit') >= 0 ? '#15803d' : '#b91c1c')}</div>
  {rows.length > 0 && <div style={{
      ...box,
      overflowX: 'auto'
    }}><svg width={Math.max(400, rows.length * 34)} height="150">{rows.map((r, i) => {
          const h = Math.abs(r.profit) / mx * 60;
          return <g key={r.period}>
   <rect x={i * 34 + 6} y={r.profit >= 0 ? 70 - h : 70} width="22" height={h || 1} fill={r.profit >= 0 ? '#16a34a' : '#dc2626'}><title>{r.period}: {tk(r.profit)}</title></rect>
   <text x={i * 34 + 17} y="145" fontSize="9" textAnchor="middle">{r.period.slice(g === 'day' ? 8 : 5)}</text></g>;
        })}<line x1="0" x2="100%" y1="70" y2="70" stroke="#999" /></svg></div>}
  <table width="100%" style={{
      marginBottom: 16
    }}><thead><tr><th align="left">{g === 'day' ? __("তারিখ") : __("মাস")}</th><th align="right">{__("বিক্রি")}</th><th align="right">{__("পণ্য ফেরত")}</th><th align="right">{__("পণ্যের খরচ")}</th><th align="right">{__("খরচ")}</th><th align="right">{__("লাভ/ক্ষতি")}</th></tr></thead><tbody>
   {[...rows].reverse().map(r => <tr key={r.period}><td>{r.period}</td><td align="right">{tk(r.revenue)}</td><td align="right">{tk(r.returns)}</td><td align="right">{tk(r.cogs)}</td><td align="right">{tk(r.expenses)}</td><td align="right" style={{
            color: r.profit >= 0 ? '#15803d' : '#b91c1c',
            fontWeight: 600
          }}>{tk(r.profit)}</td></tr>)}</tbody></table>
  <div style={box}><b>{__("দৈনিক খরচ যোগ")}</b><div style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        margin: '8px 0'
      }}>
   <select value={f.category} onChange={x => setF({
          ...f,
          category: x.target.value
        })}>{['Rent', 'Salary', 'Utilities', 'Transport', 'Marketing', 'Packaging', 'Other'].map(c => <option key={c} value={c}>{cat(c)}</option>)}</select>
   <input placeholder={__("বিবরণ")} value={f.title || ''} onChange={x => setF({
          ...f,
          title: x.target.value
        })} /><input type="number" placeholder={__("টাকা")} value={f.amount || ''} onChange={x => setF({
          ...f,
          amount: x.target.value
        })} />
   <input type="date" value={f.date || dh(0)} onChange={x => setF({
          ...f,
          date: x.target.value
        })} />
   <button style={b} onClick={async () => {
          try {
            await api('/expenses', {
              method: 'POST',
              body: {
                title: f.title,
                amount: +f.amount,
                category: f.category,
                date: f.date || dh(0)
              }
            });
            setF({
              category: f.category
            });
            setE('');
            load();
          } catch (x) {
            setE(x.message);
          }
        }}>{__("যোগ")}</button><span style={{
          color: 'red'
        }}>{e}</span></div>
   {ex.map(x => <div key={x.id} style={{
        display: 'flex',
        justifyContent: 'space-between',
        borderTop: '1px solid #eee',
        padding: '4px 0'
      }}><span>{x.date} · {cat(x.category)} · {x.title}</span><span>{tk(x.amount)} {role === 'admin' && <button onClick={async () => {
            if (confirm(__("মুছবেন?"))) {
              await api('/expenses/' + x.id, {
                method: 'DELETE'
              });
              load();
            }
          }}>✕</button>}</span></div>)}</div>
  </div>;
}