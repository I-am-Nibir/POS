import {__} from './i18n.js';
import { rl, srv, lang, setLang } from './i18n.js';
import { useState, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import { ShoppingCart, Package, Users as UsersIcon, Boxes, Wallet, Tag, Printer, BarChart3, ShieldCheck, LogOut, LayoutDashboard, Moon, Sun, ArrowLeftRight, Trophy, ChevronDown, UserRound, CreditCard, Maximize2, Minimize2 } from 'lucide-react';
import { Customers, Stock, Finance } from './Extra.jsx';
import SellPOS from './Sell.jsx';
import Dash from './Dash.jsx';
import ReceiptSettings from './ReceiptSettings.jsx';
import LoyaltySettings from './LoyaltySettings.jsx';
import Exchange from './Exchange.jsx';
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
  const raw = await r.text();
  let j;
  try { j = raw ? JSON.parse(raw) : {}; }
  catch {
    const hint = raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html')
      ? 'Server returned an HTML page instead of API JSON. Check that the latest backend is deployed and that /api requests reach the backend.'
      : 'Server returned an invalid response.';
    throw new Error(hint + ' (HTTP ' + r.status + ')');
  }
  if (!r.ok) {
    if (r.status === 401 && tok()) {
      sessionStorage.clear();
      location.reload();
    }
    throw new Error(srv(j.error || ('HTTP ' + r.status)));
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
  const [expanded, setExpanded] = useState(() => ({ finance: ['accounts','exchange'].includes(tab), customers: ['cust','loyalty'].includes(tab) }));
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [fullscreenError, setFullscreenError] = useState('');
  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setFullscreenError('');
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  const toggleFullscreen = async () => {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        const appShell = document.querySelector('.shell');
        if (!appShell?.requestFullscreen) throw new Error('Fullscreen API unavailable');
        await appShell.requestFullscreen();
      }
    } catch (err) {
      setFullscreenError(__('এই ব্রাউজারে Full Screen চালু করা যায়নি'));
    }
  };
  if (!user) return <Auth onLogin={u => {
    setUser(u);
    setTab(u.role !== 'cashier' ? 'dash' : 'pos');
  }} />;
  const mgr = user.role !== 'cashier';
  const NAV = [
    { id:'dash', label:__("ড্যাশবোর্ড"), icon:LayoutDashboard, show:mgr },
    { id:'pos', label:__("বিক্রি"), icon:ShoppingCart, show:true },
    { id:'products', label:__("পণ্য"), icon:Package, show:mgr },
    { id:'customers', label:__("কাস্টমার"), icon:UsersIcon, show:true, children:[{id:'cust',label:'List of Customers',icon:UserRound,show:true},{id:'loyalty',label:'Loyalty Program',icon:Trophy,show:user.role==='admin'}] },
    { id:'stock', label:__("স্টক/সাপ্লায়ার"), icon:Boxes, show:mgr },
    { id:'finance', label:'Finance', icon:Wallet, show:mgr, children:[{id:'accounts',label:'Accounts',icon:CreditCard,show:mgr},{id:'exchange',label:'Exchange',icon:ArrowLeftRight,show:mgr}] },
    { id:'promo', label:__("কুপন/গিফট"), icon:Tag, show:mgr },
    { id:'labels', label:__("লেবেল"), icon:Printer, show:mgr },
    { id:'rep2', label:__("রিপোর্ট"), icon:BarChart3, show:mgr },
    { id:'users', label:__("ইউজার"), icon:ShieldCheck, show:user.role==='admin' },
    { id:'receipt', label:'Receipt Settings', icon:Printer, show:user.role==='admin' }
  ];
  const allNav = NAV.flatMap(n => [n,...(n.children||[])]);
  const label = (allNav.find(n => n.id === tab) || {}).label;
  const renderNavItem = (item, nested=false) => <button key={item.id} className={(tab===item.id?'on ':'')+(nested?'nav-subitem':'')} title={item.label} onClick={()=>setTab(item.id)}><span className="nav-icon"><item.icon size={18} strokeWidth={2.1}/></span><span>{item.label}</span></button>;
  return <div className={'shell' + (tab === 'pos' ? ' posmode' : '')}>
  <button type="button" className="fullscreen-toggle" onClick={toggleFullscreen} title={isFullscreen ? __('ফুল স্ক্রিন বন্ধ করুন') : __('ফুল স্ক্রিন চালু করুন')} aria-label={isFullscreen ? __('ফুল স্ক্রিন বন্ধ করুন') : __('ফুল স্ক্রিন চালু করুন')}><span>{isFullscreen ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}</span><span>{isFullscreen ? __('Exit Full Screen') : __('Full Screen')}</span></button>
  {fullscreenError && <div className="fullscreen-error" role="status">{fullscreenError}</div>}
  <aside className="aside"><div className="brand">{tab === 'pos' ? 'D' : 'Dokan POS'}</div>
   {NAV.filter(n=>n.show).map(item=>item.children ? <div className="nav-group" key={item.id}><button className={'nav-parent '+(item.children.some(c=>c.id===tab)?'on':'')} title={item.label} onClick={()=>setExpanded(x=>({...x,[item.id]:!x[item.id]}))}><span className="nav-icon"><item.icon size={18} strokeWidth={2.1}/></span><span>{item.label}</span><ChevronDown className={'nav-chevron '+(expanded[item.id]?'open':'')} size={15}/></button>{expanded[item.id]&&<div className="nav-children">{item.children.filter(c=>c.show).map(c=>renderNavItem(c,true))}</div>}</div> : renderNavItem(item))}
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
   {tab === 'dash' && <Dash />}{tab === 'products' && <ProductsPro />}{tab === 'promo' && <Promos />}{tab === 'labels' && <Labels />}{tab === 'rep2' && <Reports />}{tab === 'users' && <Users />}{tab === 'receipt' && <ReceiptSettings />}{tab === 'loyalty' && <LoyaltySettings />}{tab === 'cust' && <Customers />}{tab === 'stock' && <Stock />}{tab === 'accounts' && <Finance />}{tab === 'exchange' && <Exchange />}</div></>}</main></div>;
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
export function receipt(r, lines, total, vat, disc, settings = {}, targetWindow = null) {
  const s={paper:'80',name:'Dokan POS',showName:true,showLogo:true,showAddress:true,showPhone:true,showEmail:true,showCustomer:true,showCashier:true,showProductId:false,showTax:true,showDiscount:true,showPayment:true,showThankYou:true,thankYou:'Thank you for your purchase!',showExchangePolicy:true,exchangeDays:5,exchangePolicyText:'1. Exchange is allowed within {days} days of purchase.\n2. Products must be unused and in their original condition.\n3. Damaged, used or altered products are not eligible for exchange.\n4. Original purchase receipt or invoice is required.\n5. Partial and full exchanges are allowed, subject to the above conditions.',exchangeNoRefundText:'NO RETURN – NO REFUND.',exchangeClosingText:'Thank you for shopping with us.',...settings};
  const width=s.paper==='58'?'54mm':'76mm'; const w=targetWindow||window.open('','_blank','width=380,height=700'); if(!w)return;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let barcodeSvg=''; try { const node=document.createElementNS('http://www.w3.org/2000/svg','svg'); JsBarcode(node, String(r.invoice||''), {format:'CODE128',displayValue:false,width:1,height:28,margin:0}); barcodeSvg=node.outerHTML; } catch {}
  const rows=lines.map(l=>`<div class="item"><span>${esc(l.p.name)}${s.showProductId?`<small><br>${esc(l.p.sku||l.p.id)}</small>`:''}<br>${l.qty} × ${Number(l.p.price).toFixed(2)}</span><b>${(l.p.price*l.qty).toFixed(2)}</b></div>`).join('');
  w.document.write(`<!doctype html><html><head><title>Receipt ${esc(r.invoice)}</title><style>@page{size:${s.paper}mm auto;margin:2mm}*{box-sizing:border-box}body{font:12px/1.4 Arial,sans-serif;width:${width};margin:0 auto;color:#111}.c{text-align:center}.logo{max-width:65%;max-height:65px;object-fit:contain}.item,.line{display:flex;justify-content:space-between;gap:8px}.item{margin:6px 0;text-align:left}hr{border:0;border-top:1px dashed #555;margin:8px 0}.total{font-size:16px;font-weight:bold}.muted{font-size:11px}.invoice-barcode{width:100%;max-width:100%;overflow:hidden;margin:8px 0}.invoice-barcode svg{display:block;width:100%;max-width:100%;height:28px;margin:0 auto}.exchange-policy{font-size:10px;text-align:left;white-space:normal;overflow-wrap:anywhere;line-height:1.35;margin-top:8px}.exchange-policy b{display:block;text-align:center;margin:4px 0}</style></head><body><div class="c">${s.showLogo&&s.logo?`<img class="logo" src="${s.logo}">`:''}${s.showName?`<h2>${esc(s.name)}</h2>`:''}${s.showAddress&&s.address?`<div>${esc(s.address)}</div>`:''}${s.showPhone&&s.phone?`<div>${esc(s.phone)}</div>`:''}${s.showEmail&&s.email?`<div>${esc(s.email)}</div>`:''}${s.showWebsite&&s.website?`<div>${esc(s.website)}</div>`:''}</div><hr><div>Invoice: ${esc(r.invoice)}</div><div>${esc(r.created_at?new Date(String(r.created_at).replace(' ','T')+'Z').toLocaleString():new Date().toLocaleString())}</div>${r.status&&r.status!=='completed'?`<div><b>Status: ${esc(r.status.toUpperCase())}</b></div>`:''}${s.showCustomer?`<div>Customer: ${esc(r.customer||'Walking customer')}</div>`:''}${s.showCashier?`<div>Cashier: ${esc(r.cashier||'')}</div>`:''}<hr><b>PRODUCT / QTY / AMOUNT</b>${rows}<hr><div class="line"><span>Subtotal</span><span>${(total+disc-vat).toFixed(2)}</span></div>${s.showDiscount?`<div class="line"><span>Discount</span><span>-${Number(disc).toFixed(2)}</span></div>`:''}${s.showTax?`<div class="line"><span>VAT / Tax</span><span>${Number(vat).toFixed(2)}</span></div>`:''}<div class="line total"><span>GRAND TOTAL</span><span>${Number(total).toFixed(2)}</span></div>${s.showPayment?`<div class="line"><span>Payment</span><span>${esc(r.method||'')}</span></div>`:''}<div class="line"><span>Paid</span><span>${Number(r.paid??total).toFixed(2)}</span></div>${r.change>0?`<div class="line"><span>Change</span><span>${Number(r.change).toFixed(2)}</span></div>`:''}${r.due>0?`<div class="line"><span>Due</span><span>${Number(r.due).toFixed(2)}</span></div>`:''}${Number(r.pointsRedeemed||0)>0?`<div class="line"><span>Points redeemed</span><span>${Number(r.pointsRedeemed)}</span></div>`:''}${Number(r.pointsEarned||0)>0?`<div class="line"><span>Points earned</span><span>${Number(r.pointsEarned)}</span></div>`:''}${r.pointsBalance!=null?`<div class="line"><span>Points balance</span><span>${Number(r.pointsBalance)}</span></div>`:''}${s.showBarcode?`<div class="invoice-barcode">${barcodeSvg}</div>`:''}${s.showExchangePolicy?`<section class="exchange-policy"><hr><b>EXCHANGE POLICY</b><div>${esc(String(s.exchangePolicyText||'').replaceAll('{days}',String(s.exchangeDays??5))).replace(/\n/g,'<br>')}</div><b>${esc(s.exchangeNoRefundText||'NO RETURN – NO REFUND.')}</b><div>${esc(s.exchangeClosingText||'Thank you for shopping with us.')}</div></section>`:''}${s.showThankYou?`<p class="c">${esc(s.thankYou)}</p>`:''}${s.showFooter&&s.footer?`<p class="c muted">${esc(s.footer)}</p>`:''}</body></html>`);
  w.document.close();
  // Wait for the receipt logo (and any other images) to finish loading
  // before opening the browser print dialog. Otherwise the preview can show
  // the logo while the printed memo omits it.
  const printWhenReady = async () => {
    try {
      if (w.document.fonts?.ready) await w.document.fonts.ready;
      const images = Array.from(w.document.images || []);
      await Promise.all(images.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        if (typeof img.decode === 'function') return img.decode().catch(() => {});
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));
    } catch {}
    w.focus();
    // Give the print layout one frame to recalculate after image decoding.
    await new Promise(resolve => w.requestAnimationFrame(() => w.requestAnimationFrame(resolve)));
    w.print();
  };
  printWhenReady();
}