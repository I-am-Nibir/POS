import {__} from './i18n.js';
import { rl, srv, lang, setLang } from './i18n.js';
import { useState, useEffect } from 'react';
import { ShoppingCart, Package, Users as UsersIcon, Boxes, Wallet, Tag, Printer, BarChart3, ShieldCheck, LogOut, LayoutDashboard, Moon, Sun } from 'lucide-react';
import { Customers, Stock, Finance } from './Extra.jsx';
import SellPOS from './Sell.jsx';
import Dash from './Dash.jsx';
import ReceiptSettings from './ReceiptSettings.jsx';
import { ProductsPro, Promos, Labels, Reports, Users, CameraScan } from './Extra2.jsx';
const S = {
    font: 'system-ui,sans-serif'
  },
  card = {
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: 12
  },
  btn = {
    padding: '8px 14px',
    borderRadius: 6,
    border: '1px solid #333',
    background: '#111',
    color: '#fff',
    cursor: 'pointer'
  };
const tok = () => sessionStorage.getItem('t');
export async function api(p, o = {}) {
  const r = await fetch('/api' + p, {
    ...o,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + tok()
    },
    body: o.body && JSON.stringify(o.body)
  }).catch(() => {
    throw new TypeError(__("সার্ভারের সাথে যোগাযোগ করা যায়নি"));
  });
  const j = await r.json();
  if (!r.ok) {
    if (r.status === 401 && tok()) {
      sessionStorage.clear();
      location.reload();
    }
    throw new Error(srv(j.error));
  }
  return j;
}
export default function App() {
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('u') || 'null'));
  const [tab, setTab] = useState(() => {
    const u = JSON.parse(sessionStorage.getItem('u') || 'null');
    return u && u.role !== 'cashier' ? 'dash' : 'pos';
  });
  const [dark, setDark] = useState(() => localStorage.getItem('dashTheme') === 'dark');
  if (!user) return <Auth onLogin={u => {
    setUser(u);
    setTab(u.role !== 'cashier' ? 'dash' : 'pos');
  }} />;
  const mgr = user.role !== 'cashier';
  const NAV = [['dash', __("ড্যাশবোর্ড"), LayoutDashboard, mgr], ['pos', __("বিক্রি"), ShoppingCart, 1], ['products', __("পণ্য"), Package, mgr], ['cust', __("কাস্টমার"), UsersIcon, 1], ['stock', __("স্টক/সাপ্লায়ার"), Boxes, mgr], ['fin', __("হিসাব"), Wallet, mgr], ['promo', __("কুপন/গিফট"), Tag, mgr], ['labels', __("লেবেল"), Printer, mgr], ['rep2', __("রিপোর্ট"), BarChart3, mgr], ['users', __("ইউজার"), ShieldCheck, user.role === 'admin'], ['receipt', 'Receipt Settings', Printer, user.role === 'admin']];
  const label = (NAV.find(n => n[0] === tab) || [])[1];
  return <div className={'shell' + (tab === 'pos' ? ' posmode' : '')}>
  <aside className="aside"><div className="brand">{tab === 'pos' ? 'D' : 'Dokan POS'}</div>
   {NAV.filter(n => n[3]).map(([k, l, I]) => <button key={k} className={tab === k ? 'on' : ''} title={l} onClick={() => setTab(k)}><I size={18} /><span>{l}</span></button>)}
   <div style={{
        flex: 1
      }} /><div className="who"><span>{user.username} · {rl(user.role)}</span></div>
   <LangSwitch /><button title={__("থিম")} onClick={() => {
        localStorage.setItem('dashTheme', dark ? 'light' : 'dark');
        setDark(!dark);
      }}>{dark ? <Sun size={18} /> : <Moon size={18} />}<span>{dark ? __("লাইট থিম") : __("ডার্ক থিম")}</span></button>
   <button title={__("লগআউট")} onClick={() => {
        sessionStorage.clear();
        setUser(null);
      }}><LogOut size={18} /><span>{__("লগআউট")}</span></button></aside>
  <main className={'main' + (dark ? ' dark' : '')}>{tab === 'pos' ? <SellPOS /> : <><h2 className="ptitle">{label}</h2><div className="page">
   {tab === 'dash' && <Dash />}{tab === 'products' && <ProductsPro />}{tab === 'promo' && <Promos />}{tab === 'labels' && <Labels />}{tab === 'rep2' && <Reports />}{tab === 'users' && <Users />}{tab === 'receipt' && <ReceiptSettings />}{tab === 'cust' && <Customers />}{tab === 'stock' && <Stock />}{tab === 'fin' && <Finance />}</div></>}</main></div>;
}
function LangSwitch({
  style
}) {
  return <div className="lsw" style={style}><button className={lang === 'bn' ? 'on' : ''} onClick={() => setLang('bn')}>{__("বাংলা")}</button><button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button></div>;
}
function Auth({
  onLogin
}) {
  const [st, setSt] = useState(null);
  const [f, setF] = useState({
    username: '',
    password: '',
    confirm: '',
    key: ''
  });
  const [e, setE] = useState('');
  useEffect(() => {
    fetch('/api/setup/status').then(r => r.json()).then(setSt).catch(() => setSt({
      needed: false
    }));
  }, []);
  const done = r => {
    sessionStorage.setItem('t', r.token);
    sessionStorage.setItem('u', JSON.stringify(r.user));
    onLogin(r.user);
  };
  const go = async ev => {
    ev.preventDefault();
    setE('');
    try {
      if (st.needed) {
        if (f.password.length < 8) return setE(__("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে"));
        if (f.password !== f.confirm) return setE(__("দুটি পাসওয়ার্ড মেলেনি"));
        done(await api('/setup', {
          method: 'POST',
          body: {
            username: f.username,
            password: f.password,
            key: f.key || undefined
          }
        }));
      } else done(await api('/login', {
        method: 'POST',
        body: {
          username: f.username,
          password: f.password
        }
      }));
    } catch (x) {
      setE(x.message);
    }
  };
  const set = k => x => setF({
    ...f,
    [k]: x.target.value
  });
  if (!st) return null;
  return <div className="auth"><LangSwitch style={{
      position: 'absolute',
      top: 16,
      right: 16
    }} /><form onSubmit={go} className="authc">
  <div className="brand" style={{
        fontSize: 28,
        padding: 0
      }}>Dokan POS</div>
  <h3 style={{
        margin: 0
      }}>{st.needed ? __("প্রথমবার সেটআপ") : __("লগইন")}</h3>{st.needed && <p style={{
        margin: 0,
        opacity: .7,
        fontSize: 13
      }}>{__("আপনার অ্যাডমিন অ্যাকাউন্ট তৈরি করুন। এটাই মূল অ্যাকাউন্ট হবে।")}</p>}
  <input autoFocus placeholder={__("ইউজারনেম")} value={f.username} onChange={set('username')} />
  <input type="password" placeholder={__("পাসওয়ার্ড")} value={f.password} onChange={set('password')} />
  {st.needed && <input type="password" placeholder={__("পাসওয়ার্ড আবার লিখুন")} value={f.confirm} onChange={set('confirm')} />}
  {st.needed && st.keyRequired && <input placeholder={__("সেটআপ কী")} value={f.key} onChange={set('key')} />}
  <button style={btn}>{st.needed ? __("অ্যাকাউন্ট তৈরি করুন") : __("প্রবেশ")}</button>{e && <span style={{
        color: '#f87171'
      }}>{e}</span>}</form></div>;
}
function Products() {
  const [items, setItems] = useState([]);
  const [f, setF] = useState({
    name: '',
    sku: '',
    price: '',
    stock: '',
    vat_rate: 0
  });
  const [e, setE] = useState('');
  const load = () => api('/products').then(setItems);
  useEffect(() => {
    load();
  }, []);
  const save = async () => {
    try {
      await api('/products', {
        method: 'POST',
        body: {
          name: f.name,
          sku: f.sku,
          price: +f.price,
          stock: +f.stock,
          vat_rate: +f.vat_rate,
          size: f.size || undefined,
          color: f.color || undefined,
          category: f.category || undefined
        }
      });
      setE('');
      setF({
        name: '',
        sku: '',
        price: '',
        stock: '',
        vat_rate: 0
      });
      load();
    } catch (x) {
      setE(x.message);
    }
  };
  return <div><div style={{
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 12
    }}>
  {['name', 'sku', 'price', 'stock', 'vat_rate', 'size', 'color', 'category'].map(k => <input key={k} placeholder={k} value={f[k]} onChange={e => setF({
        ...f,
        [k]: e.target.value
      })} />)}
  <button style={btn} onClick={save}>{__("যোগ করুন")}</button><span style={{
        color: 'red'
      }}>{e}</span></div>
  <table width="100%"><thead><tr><th align="left">{__("নাম")}</th><th>SKU</th><th>{__("দাম")}</th><th>{__("স্টক")}</th></tr></thead>
  <tbody>{items.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td>{p.price}</td><td>{p.stock}</td></tr>)}</tbody></table></div>;
}
function Report() {
  const [r, setR] = useState();
  useEffect(() => {
    api('/reports/daily').then(setR);
  }, []);
  if (!r) return null;
  return <div style={{
    display: 'grid',
    gap: 12
  }}><div style={card}>{__("আজকের অর্ডার: ")}<b>{r.summary.orders}</b>{__(" | বিক্রি: ")}<b>{__("৳")}{r.summary.revenue}</b>{__(" | ভ্যাট: ৳")}{r.summary.vat}</div>
  <div style={card}><b>{__("সেরা পণ্য")}</b>{r.top.map(t => <div key={t.name}>{t.name} — {t.qty}</div>)}</div>
  <div style={card}><b>{__("কম স্টক")}</b>{r.lowStock.map(t => <div key={t.name} style={{
        color: 'red'
      }}>{t.name} — {t.stock}</div>)}</div></div>;
}
const esc = x => String(x).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);
export function receipt(r, lines, total, vat, disc, settings = {}) {
  const s={paper:'80',name:'Dokan POS',showName:true,showLogo:true,showAddress:true,showPhone:true,showEmail:true,showCustomer:true,showCashier:true,showProductId:false,showTax:true,showDiscount:true,showPayment:true,showThankYou:true,thankYou:'Thank you for your purchase!',...settings};
  const width=s.paper==='58'?'54mm':'76mm'; const w=window.open('','_blank','width=380,height=700'); if(!w)return;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows=lines.map(l=>`<div class="item"><span>${esc(l.p.name)}${s.showProductId?`<small><br>${esc(l.p.sku||l.p.id)}</small>`:''}<br>${l.qty} × ${Number(l.p.price).toFixed(2)}</span><b>${(l.p.price*l.qty).toFixed(2)}</b></div>`).join('');
  w.document.write(`<!doctype html><html><head><title>Receipt ${esc(r.invoice)}</title><style>@page{size:${s.paper}mm auto;margin:2mm}*{box-sizing:border-box}body{font:12px/1.4 Arial,sans-serif;width:${width};margin:0 auto;color:#111}.c{text-align:center}.logo{max-width:65%;max-height:65px;object-fit:contain}.item,.line{display:flex;justify-content:space-between;gap:8px}.item{margin:6px 0;text-align:left}hr{border:0;border-top:1px dashed #555;margin:8px 0}.total{font-size:16px;font-weight:bold}.muted{font-size:11px}</style></head><body><div class="c">${s.showLogo&&s.logo?`<img class="logo" src="${s.logo}">`:''}${s.showName?`<h2>${esc(s.name)}</h2>`:''}${s.showAddress&&s.address?`<div>${esc(s.address)}</div>`:''}${s.showPhone&&s.phone?`<div>${esc(s.phone)}</div>`:''}${s.showEmail&&s.email?`<div>${esc(s.email)}</div>`:''}${s.showWebsite&&s.website?`<div>${esc(s.website)}</div>`:''}</div><hr><div>Invoice: ${esc(r.invoice)}</div><div>${new Date().toLocaleString()}</div>${s.showCustomer?`<div>Customer: ${esc(r.customer||'Walking customer')}</div>`:''}${s.showCashier?`<div>Cashier: ${esc(r.cashier||'')}</div>`:''}<hr><b>PRODUCT / QTY / AMOUNT</b>${rows}<hr><div class="line"><span>Subtotal</span><span>${(total+disc-vat).toFixed(2)}</span></div>${s.showDiscount?`<div class="line"><span>Discount</span><span>-${Number(disc).toFixed(2)}</span></div>`:''}${s.showTax?`<div class="line"><span>VAT / Tax</span><span>${Number(vat).toFixed(2)}</span></div>`:''}<div class="line total"><span>GRAND TOTAL</span><span>${Number(total).toFixed(2)}</span></div>${s.showPayment?`<div class="line"><span>Payment</span><span>${esc(r.method||'')}</span></div>`:''}<div class="line"><span>Paid</span><span>${Number(r.paid??total).toFixed(2)}</span></div>${r.change>0?`<div class="line"><span>Change</span><span>${Number(r.change).toFixed(2)}</span></div>`:''}${r.due>0?`<div class="line"><span>Due</span><span>${Number(r.due).toFixed(2)}</span></div>`:''}${s.showBarcode?`<div class="c" style="letter-spacing:2px;margin:10px">||| || ||| ||||</div>`:''}${s.showThankYou?`<p class="c">${esc(s.thankYou)}</p>`:''}${s.showFooter&&s.footer?`<p class="c muted">${esc(s.footer)}</p>`:''}</body></html>`);
  w.document.close();w.focus();w.print();
}