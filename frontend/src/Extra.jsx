import {__} from './i18n.js';
import { ph, cat } from './i18n.js';
import React, { useState, useEffect } from 'react';
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

const payLabel={cash:'ক্যাশ',bkash:'বিকাশ',nagad:'নগদ (Nagad)',card:'কার্ড',exchange:'এক্সচেঞ্জে সমন্বয়'};
function printDueReceipt(p){
  const w=window.open('','_blank','width=380,height=600');if(!w){alert(__('রসিদ খুলতে পপ-আপ অনুমতি দিন'));return}
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const row=(k,v)=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`,tk=n=>'৳'+Number(n).toFixed(2);
  api('/receipt-settings').catch(()=>({})).then(s=>{
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(p.receipt_no)}</title><style>@page{size:${s.paper==='58'?58:80}mm auto;margin:2mm}body{font:12px/1.6 Arial,sans-serif;width:${s.paper==='58'?54:76}mm;margin:0 auto}h3,p{text-align:center;margin:4px 0}div{display:flex;justify-content:space-between;gap:8px}hr{border:0;border-top:1px dashed #555}</style><h3>${esc(s.name||'Dokan POS')}</h3><p>${esc(s.address)} ${esc(s.phone)}</p><p><b>${esc(__('বাকি আদায়ের রসিদ'))}</b></p><hr>${row(__('রসিদ নম্বর'),p.receipt_no)}${row(__('তারিখ'),new Date(p.created_at.replace(' ','T')+'Z').toLocaleString('en-GB',{timeZone:'Asia/Dhaka'}))}${row(__('কাস্টমার'),p.customer)}${row(__('ফোন'),p.phone||'—')}<hr>${row(__('আগের বাকি'),tk(p.due_before))}${row(__('জমা'),tk(p.amount))}${row(__('এখন বাকি'),tk(p.due_after))}${row(__('মাধ্যম'),__(payLabel[p.method]||p.method))}${row(__('গ্রহণকারী'),p.collected_by_name||'—')}<hr>`);
    w.document.close();w.focus();w.print();
  });
}

export function Customers() {
  const me=JSON.parse(sessionStorage.getItem('u')||'{}');
  const [l,setL]=useState([]);
  const [expandedCustomer,setExpandedCustomer]=useState(null);
  const [ledgerTab,setLedgerTab]=useState('credit');
  const [ledgerData,setLedgerData]=useState(null);
  const [ledgerLoading,setLedgerLoading]=useState(false);
  const [ledgerError,setLedgerError]=useState('');
  const [pay,setPay]=useState(null);
  const [paying,setPaying]=useState(false);
  const [lastPayment,setLastPayment]=useState(null);
  const [payments,setPayments]=useState([]);
  const canSeePayments=me.role!=='cashier';
  const load=()=>{api('/customers').then(setL);if(canSeePayments)api('/due-payments').then(setPayments).catch(()=>{})};
  useEffect(()=>{load()},[]);
  const collect=async()=>{const amount=Number(pay.amount);if(!(amount>0)){alert(__('সঠিক টাকার পরিমাণ লিখুন'));return}
    setPaying(true);
    try{const r=await api(`/customers/${pay.id}/pay`,{method:'POST',body:{amount,method:pay.method}});setPay(null);setLastPayment(r.payment);load()}
    catch(e){alert(e.message)}finally{setPaying(false)}};
  const showLedger=async(customer,tab='credit')=>{
    if(expandedCustomer?.id===customer.id && ledgerTab===tab){setExpandedCustomer(null);setLedgerData(null);return}
    setExpandedCustomer(customer);setLedgerTab(tab);setLedgerData(null);setLedgerError('');setLedgerLoading(true);
    try{const data=await api(`/customers/${customer.id}/${tab==='credit'?'credit':'points'}-ledger`);setLedgerData(data)}
    catch(e){setLedgerError(e.message||'Could not load ledger')}
    finally{setLedgerLoading(false)}
  };
  const money=n=>'৳'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
  const ledgerPanel=(customer)=><tr key={`ledger-${customer.id}`}><td colSpan="5" style={{padding:'10px 12px',background:'var(--panel, #f8fafc)'}}>
    <div style={{border:'1px solid var(--border, #d1d5db)',borderRadius:9,padding:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <b>{customer.name} · Customer Ledger</b>
        <button onClick={()=>{setExpandedCustomer(null);setLedgerData(null)}}>Collapse ×</button>
      </div>
      <div style={{display:'flex',gap:8,margin:'10px 0'}}>
        <button style={{...b,opacity:ledgerTab==='credit'?1:.65}} onClick={()=>showLedger(customer,'credit')}>Credit Ledger</button>
        <button style={{...b,opacity:ledgerTab==='points'?1:.65}} onClick={()=>showLedger(customer,'points')}>Points Ledger</button>
      </div>
      {ledgerLoading?<p>Loading ledger…</p>:ledgerError?<p style={{color:'#b91c1c'}}>{ledgerError}</p>:ledgerData&&<>
        <p style={{margin:'6px 0 10px'}}><b>Current {ledgerTab==='credit'?'credit balance':'points balance'}:</b> {ledgerTab==='credit'?money(ledgerData.balance):`${ledgerData.balance||0} points`}</p>
        <div style={{overflowX:'auto'}}>
          {ledgerTab==='credit'?<table width="100%"><thead><tr><th align="left">Date</th><th align="left">Type</th><th align="left">Reference</th><th align="right">Amount</th><th align="right">Balance after</th><th align="left">Description</th></tr></thead><tbody>
            {ledgerData.entries?.length?ledgerData.entries.map(x=><tr key={x.id}><td>{x.created_at}</td><td>{x.kind}</td><td>{x.code||x.source_id||'—'}</td><td align="right">{money(x.amount)}</td><td align="right">{money(x.balance_after)}</td><td>{x.description||'—'}</td></tr>):<tr><td colSpan="6">No credit ledger entries yet.</td></tr>}
          </tbody></table>:<table width="100%"><thead><tr><th align="left">Date</th><th align="left">Type</th><th align="right">Points</th><th align="right">Balance after</th><th align="left">Description</th></tr></thead><tbody>
            {ledgerData.entries?.length?ledgerData.entries.map(x=><tr key={x.id}><td>{x.created_at}</td><td>{x.kind}</td><td align="right">{['redeem','exchange_reverse'].includes(x.kind)?'-':''}{x.points}</td><td align="right">{x.balance_after}</td><td>{x.description||'—'}</td></tr>):<tr><td colSpan="5">No points ledger entries yet.</td></tr>}
          </tbody></table>}
        </div>
      </>}
    </div>
  </td></tr>;
  return <div>
    {lastPayment&&<div style={box}>{__('জমা হয়েছে')}: <b>{lastPayment.receipt_no}</b> · {money(lastPayment.amount)} <button style={b} onClick={()=>printDueReceipt(lastPayment)}>{__('রসিদ প্রিন্ট')}</button> <button onClick={()=>setLastPayment(null)}>×</button></div>}
    <Form label={__('কাস্টমার যোগ')} fields={['name','phone']} onSubmit={async f=>{await api('/customers',{method:'POST',body:{name:f.name,phone:f.phone||undefined}});load()}} />
    <div style={{overflowX:'auto'}}><table width="100%"><thead><tr><th align="left">{__('নাম')}</th><th>{__('ফোন')}</th><th>{__('বাকি')}</th><th>{__('পয়েন্ট')}</th><th></th></tr></thead><tbody>
      {l.map(c=><React.Fragment key={c.id}>
        <tr><td>{c.name}</td><td>{c.phone}</td><td>{money(c.due)}</td><td>{c.points||0}</td><td style={{whiteSpace:'nowrap'}}>
          {me.role!=='cashier'&&<button onClick={()=>showLedger(c,'credit')}>{expandedCustomer?.id===c.id?'Hide Ledger':'View Ledger'}</button>}
          {c.due>0&&<button onClick={()=>{setLastPayment(null);setPay({id:c.id,amount:'',method:'cash'})}}>{__('বাকি আদায়')}</button>}
        </td></tr>
        {pay?.id===c.id&&<tr><td colSpan="5"><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',padding:8}}>
          <b>{c.name}</b>
          <input type="number" min="0" step="0.01" autoFocus placeholder={__('কত টাকা পেলেন?')} value={pay.amount} onChange={e=>setPay({...pay,amount:e.target.value})} />
          <select value={pay.method} onChange={e=>setPay({...pay,method:e.target.value})}>{['cash','bkash','nagad','card'].map(m=><option key={m} value={m}>{__(payLabel[m])}</option>)}</select>
          <button style={b} disabled={paying} onClick={collect}>{__('জমা নিন')}</button>
          <button onClick={()=>setPay(null)}>{__('বাতিল')}</button>
        </div></td></tr>}
        {expandedCustomer?.id===c.id&&ledgerPanel(c)}
      </React.Fragment>)}
    </tbody></table></div>
    {canSeePayments&&<div style={{...box,marginTop:16}}><b>{__('বাকি জমার রেকর্ড')}</b><div style={{overflowX:'auto'}}><table width="100%"><thead><tr>{['রসিদ নম্বর','তারিখ','কাস্টমার','জমা','এখন বাকি','মাধ্যম','গ্রহণকারী'].map(h=><th key={h} align="left">{__(h)}</th>)}<th></th></tr></thead><tbody>
      {payments.length?payments.map(p=><tr key={p.id}><td>{p.receipt_no}</td><td>{new Date(p.created_at.replace(' ','T')+'Z').toLocaleString('en-GB',{timeZone:'Asia/Dhaka'})}</td><td>{p.customer}</td><td>{money(p.amount)}</td><td>{money(p.due_after)}</td><td>{__(payLabel[p.method]||p.method)}</td><td>{p.collected_by_name||'—'}</td><td><button onClick={()=>printDueReceipt(p)}>{__('রসিদ')}</button></td></tr>):<tr><td colSpan="8">{__('এখনো কোনো জমা নেই')}</td></tr>}
    </tbody></table></div></div>}
  </div>;
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