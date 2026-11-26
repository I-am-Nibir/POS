import {__} from './i18n.js';
import { useState, useEffect, useRef } from 'react';
import { Search, Moon, Sun, X, Banknote, Pause, Percent, Trash2, Folder } from 'lucide-react';
import { api, receipt } from './App.jsx';
import { CameraScan } from './Extra2.jsx';
import { isNet, qget, qadd, syncQueue, cacheGet, cacheSet } from './offline.js';
import { build, printBytes, connectSerial, loadCfg } from './printer.js';
const r2 = n => Math.round(n * 100) / 100,
  tk = n => __("৳") + Number(n || 0).toLocaleString('en-IN');
const beep = ok => {
  try {
    const c = new AudioContext(),
      o = c.createOscillator();
    o.frequency.value = ok ? 880 : 200;
    o.connect(c.destination);
    o.start();
    o.stop(c.currentTime + (ok ? .07 : .3));
  } catch {}
};
const M = {
  cash: __("ক্যাশ"),
  card: __("কার্ড"),
  bkash: __("বিকাশ"),
  nagad: __("নগদ"),
  due: __("বাকি")
};
export default function Sell() {
  const user = JSON.parse(sessionStorage.getItem('u') || '{}');
  const isCashier = user.role === 'cashier';
  const [items, setItems] = useState([]),
    [q, setQ] = useState(''),
    [cat, setCat] = useState(''),
    [cart, setCart] = useState({}),
    [cs, setCs] = useState([]),
    [cust, setCust] = useState('');
  const [loyaltyCfg, setLoyaltyCfg] = useState({enabled:true,earnAmount:100,earnPoints:1,redeemValue:1,minRedeemPoints:10,maxRedeemPoints:500}),
    [redeemPoints, setRedeemPoints] = useState(0);
  const [disc, setDisc] = useState(0),
    [discMode, setDiscMode] = useState('amt'),
    [discIn, setDiscIn] = useState(''),
    [cq, setCq] = useState(''),
    [qtyDraft, setQtyDraft] = useState({}),
    [code, setCode] = useState(''),
    [applied, setApplied] = useState(''),
    [cd, setCd] = useState(0),
    [gcode, setGcode] = useState(''),
    [gApplied, setGApplied] = useState(''),
    [gift, setGift] = useState(0),
    [creditCode, setCreditCode] = useState(''), [creditApplied, setCreditApplied] = useState(''), [creditBalance, setCreditBalance] = useState(0),
    [voucherCode, setVoucherCode] = useState(''), [voucherApplied, setVoucherApplied] = useState(''), [voucherBalance, setVoucherBalance] = useState(0);
  const [method, setMethod] = useState('cash'),
    [tender, setTender] = useState(''),
    [key, setKey] = useState(() => crypto.randomUUID()),
    [msg, setMsg] = useState(null),
    [last, setLast] = useState(null),
    [busy, setBusy] = useState(false);
  const [held, setHeld] = useState(() => JSON.parse(localStorage.getItem('held') || '[]')),
    [showHeld, setShowHeld] = useState(false),
    [light, setLight] = useState(() => localStorage.getItem('posTheme') === 'light');
  const [sel, setSel] = useState(-1),
    [payOpen, setPayOpen] = useState(false),
    [discOpen, setDiscOpen] = useState(false);
  const sr = useRef(),
    H = useRef(),
    focus = () => sr.current && sr.current.focus();
  const [net, setNet] = useState(navigator.onLine),
    [pend, setPend] = useState(qget().length),
    [cfg, setCfg] = useState(null),
    [ser, setSer] = useState(false);
  const [receiptCfg,setReceiptCfg]=useState({paper:'80',printMode:'manual'});
  const load = () => {
    api('/products').then(x => {
      setItems(x);
      cacheSet('p', x);
    }).catch(() => setItems(cacheGet('p')));
    api('/customers').then(x => {
      setCs(x);
      cacheSet('c', x);
    }).catch(() => setCs(cacheGet('c')));
  };
  const sync = async () => {
    if (!qget().length) return;
    const r = await syncQueue();
    setPend(qget().length);
    if (r.failed.length) setMsg({
      t: __("সিঙ্ক ব্যর্থ (ম্যানেজারকে জানান): ") + r.failed.map(f => f.err).join(' | '),
      err: 1
    });else if (r.done) setMsg({
      t: __("{0}টি অফলাইন বিক্রি সিঙ্ক হয়েছে", [r.done])
    });
    if (r.done) load();
  };
  useEffect(() => {
    api('/receipt-settings').then(setReceiptCfg).catch(()=>{});
    api('/loyalty-settings').then(setLoyaltyCfg).catch(()=>{});
    load();
    focus();
    loadCfg().then(setCfg);
    sync();
    const on = () => {
        setNet(true);
        sync();
      },
      off = () => setNet(false);
    addEventListener('online', on);
    addEventListener('offline', off);
    const t = setInterval(sync, 30000);
    navigator.serial?.getPorts().then(async p => {
      if (p[0]) {
        try {
          await connectSerial(p[0]);
          setSer(true);
        } catch {}
      }
    });
    return () => {
      removeEventListener('online', on);
      removeEventListener('offline', off);
      clearInterval(t);
    };
  }, []);
  const lines = Object.entries(cart).map(([id, qty]) => ({
    p: items.find(i => i.id == id),
    qty
  })).filter(l => l.p);
  const sub = lines.reduce((a, l) => a + l.p.price * l.qty, 0),
    selectedCustomer = cs.find(c => String(c.id) === String(cust)),
    currentPoints = Number(selectedCustomer?.points || 0),
    loyaltyDiscount = Math.max(0, Number(redeemPoints)||0) * Number(loyaltyCfg.redeemValue||0),
    base = Math.max(0, sub - disc - cd - loyaltyDiscount),
    f = sub ? base / sub : 0;
  const capDisc = () => isCashier ? sub * 0.10 : sub;
  const manualCap = Math.max(0, capDisc() - cd);
  const vat = lines.reduce((a, l) => a + r2(l.p.price * l.qty * l.p.vat_rate / 100 * f), 0),
    total = r2(base + vat),
    estimatedEarnedPoints = loyaltyCfg.enabled && selectedCustomer ? Math.floor(base / Math.max(1, Number(loyaltyCfg.earnAmount)||100)) * (Number(loyaltyCfg.earnPoints)||1) : 0,
    giftUse = Math.min(gift, total),
    creditUse = Math.min(creditBalance || voucherBalance, total - giftUse),
    due = r2(total - giftUse - creditUse);
  const given = tender === '' ? 0 : Number(tender),
    change = Math.max(0, r2(given - due)),
    short = method !== 'due' && method === 'cash' && given < due;
  useEffect(() => {
    if (disc > manualCap + 0.001) setDisc(r2(manualCap));
  }, [manualCap, disc]);
  useEffect(() => {
    if (!applied) return;
    if (sub <= 0) {
      setApplied('');
      setCd(0);
      return;
    }
    api(`/coupons/check?code=${encodeURIComponent(applied)}&base=${sub - disc}`).then(r => setCd(r.discount)).catch(e => {
      setMsg({
        t: e.message,
        err: 1
      });
      setApplied('');
      setCd(0);
    });
  }, [applied, sub, disc]);
  const add = p => {
    if (p.stock <= 0) {
      beep(0);
      return setMsg({
        t: __("স্টক নেই: ") + p.name,
        err: 1
      });
    }
    if ((cart[p.id] || 0) >= p.stock) {
      beep(0);
      return;
    }
    beep(1);
    setCart(c => ({
      ...c,
      [p.id]: (c[p.id] || 0) + 1
    }));
  };
  const setQty = (p, n) => setCart(c => {
    const x = {
      ...c
    };
    if (n <= 0) delete x[p.id];else x[p.id] = Math.min(n, p.stock);
    return x;
  });
  const find = v => {
    v = v.trim().toLowerCase();
    return items.find(i => (i.barcode || '').toLowerCase() === v || i.sku.toLowerCase() === v);
  };
  const scan = c => {
    const m = find(c);
    m ? add(m) : (beep(0), setMsg({
      t: __("পণ্য পাওয়া যায়নি: ") + c,
      err: 1
    }));
  };
  const list = items.filter(i => (!cat || i.category === cat) && (!q || (i.name + i.sku + (i.barcode || '') + (i.size || '') + (i.color || '')).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.name.localeCompare(b.name) || (a.size || '').localeCompare(b.size || '')).slice(0, 300);
  const cats = [...new Set(items.map(i => i.category).filter(Boolean))];
  const clear = () => {
    setPayOpen(false);
    setDiscOpen(false);
    setCart({});
    setQtyDraft({});
    setDisc(0);
    setDiscIn('');
    setCode('');
    setApplied('');
    setCd(0);
    setGcode('');
    setGApplied('');
    setGift(0); setCreditCode(''); setCreditApplied(''); setCreditBalance(0); setVoucherCode(''); setVoucherApplied(''); setVoucherBalance(0);
    setTender('');
    setRedeemPoints(0);
    setCust('');
    setMethod('cash');
    setKey(crypto.randomUUID());
    setQ('');
    focus();
  };
  const hold = () => {
    if (!lines.length) return;
    const h = [...held, {
      cart, cust, redeemPoints, t: Date.now(), n: lines.length, total, disc, applied, cd, code, gcode, gApplied, gift, creditCode, creditApplied, creditBalance, voucherCode, voucherApplied, voucherBalance, tender, method,
      customerName: cs.find(c => String(c.id) === String(cust))?.name || __('খুচরা ক্রেতা')
    }];
    localStorage.setItem('held', JSON.stringify(h));
    setHeld(h);
    clear();
    setMsg({
      t: __("বিল হোল্ড হয়েছে (F6 দিয়ে ফিরিয়ে আনুন)")
    });
  };
  const voidBill = () => {
    if (!lines.length) return;
    if (!confirm(__('বিল বাতিল করবেন? কার্টের সব আইটেম মুছে যাবে।'))) return;
    const snapshot = { cart, cust, redeemPoints, disc, applied, cd, code, gcode, gApplied, gift, creditCode, creditApplied, creditBalance, voucherCode, voucherApplied, voucherBalance, tender, method };
    clear();
    setMsg({ t: __('বিল বাতিল হয়েছে'), undo: snapshot });
  };
  const undoVoid = snapshot => {
    setCart(snapshot.cart || {}); setCust(snapshot.cust || ''); setRedeemPoints(snapshot.redeemPoints || 0); setDisc(snapshot.disc || 0);
    setApplied(snapshot.applied || ''); setCd(snapshot.cd || 0); setCode(snapshot.code || '');
    setGcode(snapshot.gcode || ''); setGApplied(snapshot.gApplied || ''); setGift(snapshot.gift || 0); setCreditCode(snapshot.creditCode||''); setCreditApplied(snapshot.creditApplied||''); setCreditBalance(snapshot.creditBalance||0); setVoucherCode(snapshot.voucherCode||''); setVoucherApplied(snapshot.voucherApplied||''); setVoucherBalance(snapshot.voucherBalance||0);
    setTender(snapshot.tender || ''); setMethod(snapshot.method || 'cash'); setDiscIn(String(snapshot.disc || ''));
    setMsg(null); focus();
  };
  const openDiscount = () => { setDiscMode('amt'); setDiscIn(String(disc || '')); setDiscOpen(true); };
  const updateDiscount = value => {
    const n = Math.max(0, Number(value) || 0);
    if (discMode === 'pct') {
      if (value === '') { setDisc(0); setDiscIn(''); return; }
      const roleMax = isCashier ? 10 : 100;
      const maxPct = sub ? Math.min(roleMax, manualCap / sub * 100) : 0;
      const pct = Math.max(0, Math.min(maxPct, n));
      setDisc(r2(Math.min(manualCap, sub * pct / 100)));
      setDiscIn(String(pct));
    } else {
      const amount = Math.min(manualCap, n);
      setDisc(r2(amount)); setDiscIn(String(amount));
    }
  };
  const recall = i => {
    const h = held[i];
    setCart(h.cart);
    setCust(h.cust); setRedeemPoints(h.redeemPoints || 0); setDisc(h.disc || 0); setApplied(h.applied || ''); setCd(h.cd || 0);
    setCode(h.code || ''); setGcode(h.gcode || ''); setGApplied(h.gApplied || ''); setGift(h.gift || 0); setCreditCode(h.creditCode||''); setCreditApplied(h.creditApplied||''); setCreditBalance(h.creditBalance||0); setVoucherCode(h.voucherCode||''); setVoucherApplied(h.voucherApplied||''); setVoucherBalance(h.voucherBalance||0);
    setTender(h.tender || ''); setMethod(h.method || 'cash');
    const r = held.filter((_, k) => k !== i);
    localStorage.setItem('held', JSON.stringify(r));
    setHeld(r);
    setShowHeld(false);
    focus();
  };
  const pay = async () => {
    if (busy || !lines.length) return;
    if (method === 'due' && !['admin','manager'].includes(user.role)) return setMsg({t: __('বাকি বিক্রির অনুমতি নেই'), err: 1});
    if (method === 'due' && !cust) return setMsg({
      t: __("বাকির জন্য কাস্টমার বাছুন"),
      err: 1
    });
    if (method === 'due' && !navigator.onLine) return setMsg({t: __('বাকি বিক্রির জন্য ইন্টারনেট সংযোগ প্রয়োজন'), err: 1});
    const dFinal = Math.max(0, Math.min(+disc || 0, manualCap));
    if ((creditApplied || voucherApplied) && (dFinal > 0 || cd > 0 || gApplied || redeemPoints > 0)) return setMsg({t: __('Store credit or voucher cannot be combined with discounts, coupons or gift cards'), err: 1});
    if (redeemPoints > 0 && !cust) return setMsg({t: __('Select a registered customer to redeem loyalty points'), err: 1});
    if (!navigator.onLine && redeemPoints > 0) return setMsg({t: __('Loyalty point redemption requires an internet connection'), err: 1});
    if (redeemPoints > currentPoints || redeemPoints > Number(loyaltyCfg.maxRedeemPoints || 0) || (redeemPoints > 0 && redeemPoints < Number(loyaltyCfg.minRedeemPoints || 0))) return setMsg({t: __('Invalid loyalty points amount'), err: 1});
    if (creditApplied && voucherApplied) return setMsg({t: __('Use either store credit or one voucher per sale'), err: 1});
    if (short) return setMsg({
      t: tender === '' ? __('ক্রেতার দেওয়া টাকার পরিমাণ লিখুন') : __('ক্রেতার দেওয়া টাকা কম'),
      err: 1
    });
    const paid = method === 'due' ? (tender === '' ? 0 : Number(tender)) : method === 'cash' ? given : due;
    if (method === 'due' && (!Number.isFinite(paid) || paid < 0 || paid > due)) return setMsg({t: __('জমা টাকার পরিমাণ মোট বাকি টাকার বেশি হতে পারবে না'), err: 1});
    if (method === 'due') {
      const first = window.confirm(__('এই বিক্রিটি বাকিতে রাখবেন? কাস্টমারের হিসাবে বাকি যোগ হবে।'));
      if (!first) return;
      const second = window.confirm(__('দ্বিতীয়বার নিশ্চিত করুন: আপনি কি সত্যিই এই বিক্রিটি বাকিতে রাখতে চান?'));
      if (!second) return;
    }
    const body = {
      items: lines.map(l => ({
        id: l.p.id,
        qty: l.qty
      })),
      discount: dFinal,
      method,
      paid,
      key,
      customerId: cust ? +cust : undefined,
      coupon: applied || undefined,
      gift: gApplied || undefined,
      storeCreditCode: creditApplied || undefined,
      voucherCode: voucherApplied || undefined,
      redeemPoints: Number(redeemPoints)||0
    };
    const snap = {
      lines,
      total,
      vat,
      disc: dFinal + cd + loyaltyDiscount,
      paid,
      method,
      customerName: cname, customerId: cust ? Number(cust) : null, pointsRedeemed: Number(redeemPoints)||0, loyaltyDiscount
    };
    const finish = async (r, off) => {
      const L = {
        r: {...r, customer: snap.customerName, pointsRedeemed: r.pointsRedeemed ?? snap.pointsRedeemed, pointsEarned: r.pointsEarned ?? 0, pointsBalance: r.pointsBalance ?? (snap.customerId ? currentPoints : null)},
        ...snap,
        off
      };
      setLast(L);
      setMsg({
        t: off ? __("অফলাইনে সেভ: {0} (ইন্টারনেট এলে সিঙ্ক হবে)", [r.invoice]) : __("বিল সম্পন্ন {0}", [r.invoice]),
        change: r.change,
        due: r.due
      });
      beep(1);
      try {
        if(receiptCfg.printMode==='auto') receipt({...r,customer:snap.customerName,pointsRedeemed:r.pointsRedeemed||0,pointsEarned:r.pointsEarned||0,pointsBalance:r.pointsBalance??(snap.customerId?currentPoints:null)}, lines, total, vat, dFinal+cd+loyaltyDiscount, {...receiptCfg,method,paid,customer:snap.customerName,cashier:user.username});
      } catch (e) { console.warn('Receipt print failed',e); }
      clear();
    };
    setBusy(true);
    try {
      if (!navigator.onLine) throw new TypeError('offline');
      const r = await api('/sales', {
        method: 'POST',
        body
      });
      await finish(r, false);
      load();
    } catch (e) {
      if (isNet(e)) {
        if (body.coupon || body.gift || body.storeCreditCode || body.voucherCode) setMsg({
          t: __("অফলাইনে কুপন/গিফট কার্ড চলবে না — সরিয়ে আবার চেষ্টা করুন"),
          err: 1
        });else {
          qadd({
            ...body,
            at: new Date().toISOString()
          });
          setPend(qget().length);
          const sold = Object.fromEntries(lines.map(l => [l.p.id, l.qty])),
            upd = items.map(i => sold[i.id] ? {
              ...i,
              stock: i.stock - sold[i.id]
            } : i);
          setItems(upd);
          cacheSet('p', upd);
          await finish({
            invoice: 'OFF-' + Date.now().toString(36).toUpperCase(),
            change: Math.max(0, r2(given - due)),
            due: method === 'due' ? r2(due - (tender === '' ? 0 : +tender)) : 0
          }, true);
        }
      } else {
        setMsg({
          t: e.message,
          err: 1
        });
        beep(0);
      }
    }
    setBusy(false);
  };
  useEffect(() => {
    document.querySelector('.prow.sel')?.scrollIntoView({
      block: 'nearest'
    });
  }, [sel]);
  useEffect(() => setSel(-1), [q, cat]);
  H.current = {
    pay,
    hold,
    f9: () => payOpen ? pay() : lines.length && setPayOpen(true)
  };
  useEffect(() => {
    const k = e => {
      if (e.key === 'F2') {
        e.preventDefault();
        focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        H.current.hold();
      } else if (e.key === 'F6') {
        e.preventDefault();
        setShowHeld(s => !s);
      } else if (e.key === 'F9') {
        e.preventDefault();
        H.current.f9();
      }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  const shift = async a => {
    const s = prompt(a === 'open' ? __("ওপেনিং ক্যাশ (৳)") : __("ড্রয়ারে এখন মোট ক্যাশ (৳)"));
    if (s === null || isNaN(+s)) return;
    try {
      const r = await api('/shifts/' + a, {
        method: 'POST',
        body: a === 'open' ? {
          opening: +s
        } : {
          closing: +s
        }
      });
      setMsg({
        t: a === 'open' ? __("শিফট চালু হয়েছে") : __("হিসাব অনুযায়ী {0} · গুনে পাওয়া {1} · গরমিল {2}", [tk(r.expected), tk(r.counted), tk(r.difference)])
      });
    } catch (e) {
      setMsg({
        t: e.message,
        err: 1
      });
    }
  };
  const applyCode = () => code && setApplied(code.trim());
  const applyGift = async () => {
    try {
      const g = await api('/giftcards/' + encodeURIComponent(gcode.trim()));
      setGift(g.balance);
      setGApplied(g.code);
    } catch (e) {
      setMsg({
        t: e.message,
        err: 1
      });
    }
  };
  const applyStoreCredit = async () => {
    try {
      if (!cust) throw new Error('Select the linked customer account first');
      const c = await api('/credit/check/' + encodeURIComponent(creditCode.trim()) + '?customerId=' + encodeURIComponent(cust));
      setCreditApplied(c.code); setCreditBalance(Number(c.balance)||0);
      setVoucherApplied(''); setVoucherBalance(0);
      setMsg({t:`Store credit applied: ${tk(c.balance)}`});
    } catch(e) { setMsg({t:e.message,err:1}); setCreditApplied(''); setCreditBalance(0); }
  };
  const applyVoucher = async () => {
    try {
      const v = await api('/voucher/check/' + encodeURIComponent(voucherCode.trim()) + '?customerId=' + encodeURIComponent(cust||0));
      setVoucherApplied(v.code); setVoucherBalance(Number(v.balance)||0);
      setCreditApplied(''); setCreditBalance(0);
      setMsg({t:`Voucher applied: ${tk(v.balance)} (one-time use)`});
    } catch(e) { setMsg({t:e.message,err:1}); setVoucherApplied(''); setVoucherBalance(0); }
  };
  const quick = [...new Set([due, Math.ceil(due / 100) * 100, Math.ceil(due / 500) * 500, Math.ceil(due / 1000) * 1000, 2000, 5000].filter(x => x >= due && x > 0))].slice(0, 5);
  const addCust = async () => {
    const n = prompt(__("কাস্টমারের নাম"));
    if (!n) return;
    const ph = prompt(__("ফোন (ঐচ্ছিক)")) || undefined;
    try {
      const r = await api('/customers', {
        method: 'POST',
        body: {
          name: n,
          phone: ph
        }
      });
      await load();
      setCust(String(r.id));
    } catch (e) {
      setMsg({
        t: e.message,
        err: 1
      });
    }
  };
  const connect = async () => {
    try {
      await connectSerial();
      setSer(true);
      setMsg({
        t: __("প্রিন্টার সংযুক্ত")
      });
    } catch {
      setMsg({
        t: __("সংযোগ হয়নি (Chrome/Edge + HTTPS লাগবে; অথবা সার্ভারে PRINTER_HOST সেট করুন)"),
        err: 1
      });
    }
  };
  const cname = selectedCustomer?.name || __("খুচরা ক্রেতা");
  const customerOptions = cs.filter(c => !cq || `${c.name} ${c.phone || ''}`.toLowerCase().includes(cq.toLowerCase()));
  return <div className={'nx' + (light ? ' light' : '')}>
  <section className="cartp">
   <div className="tabs"><div className="tab">{__("কার্ট")}{lines.length > 0 && <span className="badge">{lines.length}</span>}</div><span style={{
          flex: 1
        }} />
    <span className={'net ' + (net ? 'on' : 'off')}>{net ? __("● অনলাইন") : __("● অফলাইন")}</span>{pend > 0 && <button className="tb" onClick={sync}>{__("⟳ সিঙ্ক (")}{pend})</button>}</div>
   <div className="cartbox">
    <div className="toolbox"><input className="customer-search" placeholder={__("নাম/ফোন খুঁজুন")} value={cq} onChange={e => setCq(e.target.value)} /><select value={cust} onChange={e => { setCust(e.target.value); setRedeemPoints(0); setCq(''); setCreditApplied(''); setCreditBalance(0); setVoucherApplied(''); setVoucherBalance(0); }}><option value="">{__("খুচরা ক্রেতা")}</option>{customerOptions.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone || ''}{c.due > 0 ? __(" (বাকি {0})", [c.due]) : ''}</option>)}</select>
     <button title={__("নতুন কাস্টমার")} onClick={addCust}>＋</button>{last && <button onClick={() => receipt({...last.r,method:last.method,paid:last.paid,customer:last.customerName||last.r.customer,cashier:user.username}, last.lines, last.total, last.vat, last.disc, receiptCfg)}>{__("🖨 রসিদ")}</button>}<button onClick={() => setShowHeld(true)}>{__("হোল্ড বিল (")}{held.length})</button><button onClick={() => shift('open')}>{__("শিফট খুলুন")}</button><button onClick={() => shift('close')}>{__("শিফট বন্ধ")}</button><button onClick={connect}>🖨 {ser ? __("সংযুক্ত") : cfg?.network ? 'LAN' : __("প্রিন্টার")}</button></div>
    {loyaltyCfg.enabled && <div className="card" style={{margin:'8px 0',padding:10,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}><b>Reward Points</b>{cust ? <><span>Available: {currentPoints}</span><label>Redeem points <input type="number" min="0" max={Math.min(currentPoints,loyaltyCfg.maxRedeemPoints)} step="1" value={redeemPoints||''} onChange={e=>setRedeemPoints(Math.max(0,Math.floor(Number(e.target.value)||0))) } style={{width:90}} /></label><span>Value: {tk(loyaltyDiscount)}</span><button type="button" onClick={()=>setRedeemPoints(0)} disabled={!redeemPoints}>Clear</button><small>Min {loyaltyCfg.minRedeemPoints}, max {loyaltyCfg.maxRedeemPoints} points per sale</small></> : <span>Select a registered customer to use points</span>}<span style={{marginLeft:'auto'}}>Estimated earn: {estimatedEarnedPoints} pts</span></div>}
    {msg && <div className={'msg' + (msg.err ? ' err' : '')} onClick={() => setMsg(null)}>{msg.t}{msg.undo && <button onClick={e => { e.stopPropagation(); undoVoid(msg.undo); }}>{__('ফিরিয়ে আনুন')}</button>}{msg.change != null && <div className="chg">{__("ফেরত দিন: ")}{tk(msg.change)}{msg.due > 0 && __(" · বাকি {0}", [tk(msg.due)])}</div>}{last && !msg.err && msg.change != null && <button onClick={e => {
            e.stopPropagation();
            receipt({...last.r,method:last.method,paid:last.paid,customer:last.customerName||last.r.customer,cashier:user.username}, last.lines, last.total, last.vat, last.disc, receiptCfg);
          }}>{__("🖨 রসিদ প্রিন্ট")}</button>}</div>}
    <div className="th"><div>{__("পণ্য")}</div><div>{__("পরিমাণ")}</div><div>{__("মোট")}</div></div>
    <div className="rows">{!lines.length && <p className="empty">{__("কার্ট খালি — পণ্য স্ক্যান করুন বা ট্যাপ করুন")}</p>}
     {lines.map(l => <div key={l.p.id} className="row"><div><b>{l.p.name}</b> <small>{l.p.size} {l.p.color} · VAT {Number(l.p.vat_rate || 0)}%</small><div className="lnk"><a className="rm" onClick={() => setQty(l.p, 0)}>{__("মুছুন")}</a><span>{tk(l.p.price)}</span></div></div>
      <div className="qty"><button onClick={() => setQty(l.p, l.qty - 1)}>−</button><input aria-label={__('পরিমাণ')} type="number" min="1" max={l.p.stock} value={qtyDraft[l.p.id] ?? l.qty} onChange={e => setQtyDraft(d => ({...d,[l.p.id]:e.target.value}))} onBlur={() => { if (qtyDraft[l.p.id] !== undefined) { setQty(l.p, Number(qtyDraft[l.p.id]) || l.qty); setQtyDraft(d => { const n={...d}; delete n[l.p.id]; return n; }); } }} /><button onClick={() => setQty(l.p, l.qty + 1)}>＋</button></div><div className="tot">{tk(l.p.price * l.qty)}</div></div>)}</div>
    <table className="sumt"><tbody>
     <tr><td>{__("কাস্টমার: ")}<b>{cname}</b></td><td>{__("সাব-টোটাল")}</td><td className="r">{tk(sub)}</td></tr>
     <tr><td>{__("কুপন: ")}<b>{applied || '—'}</b>{cd > 0 && ` (−${tk(cd)})`}</td><td><a className="dl" onClick={openDiscount}>{__("ডিসকাউন্ট")}</a></td><td className="r">{tk(disc + cd)}</td></tr>
     <tr><td>{__("গিফট কার্ড: ")}<b>{gApplied || '—'}</b></td><td>{__("ভ্যাট")}</td><td className="r">{tk(vat)}</td></tr>
     {redeemPoints>0&&<tr><td>Points redeemed: <b>{redeemPoints}</b></td><td>Reward discount</td><td className="r">{tk(loyaltyDiscount)}</td></tr>}
     <tr><td>Store Credit / Voucher: <b>{creditApplied || voucherApplied || '—'}</b></td><td>Credit Used</td><td className="r">{tk(creditUse)}</td></tr>
     <tr className="gt"><td /><td>{__("মোট")}</td><td className="r">{tk(total)}</td></tr></tbody></table>
   </div>
   <div className="bottom"><button className="b-pay" title="F9" disabled={!lines.length} onClick={() => setPayOpen(true)}><Banknote size={20} /><span>{__("পেমেন্ট করুন")}</span></button><button className="b-hold" title="F4" disabled={!lines.length} onClick={hold}><Pause size={20} /><span>{__("হোল্ড")}</span></button><button className="b-disc" disabled={!lines.length} onClick={openDiscount}><Percent size={20} /><span>{__("ডিসকাউন্ট")}</span></button><button className="b-void" disabled={!lines.length} onClick={voidBill}><Trash2 size={20} /><span>{__("বিল বাতিল")}</span></button></div>
  </section>
  <section className="gridp"><div className="gtool"><span className="ic"><Search size={16} /></span><span className="ic">▮▯▮</span>
    <input ref={sr} className="scan" placeholder={__("বার্কোড স্ক্যান করুন বা নাম/SKU লিখে Enter (F2)")} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSel(x => Math.min(x + 1, list.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSel(x => Math.max(x - 1, 0));
          } else if (e.key === 'Enter' && q) {
            const m = find(q) || sel >= 0 && list[sel] || list.length === 1 && list[0];
            m ? (add(m), setQ('')) : (beep(0), setMsg({
              t: __("পণ্য পাওয়া যায়নি"),
              err: 1
            }));
          } else if (e.key === 'Enter' && sel >= 0 && list[sel]) {
            add(list[sel]);
          } else if (e.key === 'Escape') {
            setQ('');
            setSel(-1);
          }
        }} />
    <CameraScan onCode={scan} /><button className="ic" title={__("থিম")} onClick={() => {
          localStorage.setItem('posTheme', light ? 'dark' : 'light');
          setLight(!light);
        }}>{light ? <Moon size={16} /> : <Sun size={16} />}</button></div>
   <div className="crumb"><a onClick={() => setCat('')}>{__("হোম")}</a>{cat && <> › <b>{cat}</b></>}</div>
   <div className="plist"><div className="phead"><div>{__("পণ্যের নাম")}</div><div>{__("SKU/বার্কোড")}</div><div>{__("স্টক")}</div><div>{__("দাম")}</div></div>
    <div className="pbody">{!cat && !q && cats.map(c => <div key={c} className="prow cat" onClick={() => setCat(c)}><div className="pn"><Folder size={16} /><b>{c}</b></div><div /><div /><div /></div>)}
     {list.map((p, i) => <div key={p.id} className={'prow' + (p.stock <= 0 ? ' off' : '') + (i === sel ? ' sel' : '')} onClick={() => {
            add(p);
            focus();
          }}>
      <div className="pn"><b>{p.name}</b>{(p.size || p.color) && <span className="var">{p.size} {p.color}</span>}{cart[p.id] > 0 && <i className="qb">{cart[p.id]}</i>}</div>
      <div className="ps">{p.barcode || p.sku}</div><div className={'pk' + (p.stock <= p.low_stock ? ' low' : '')}>{p.stock}</div><div className="pp">{tk(p.price)}</div></div>)}
     {!list.length && <p className="empty">{__("কোনো পণ্য নেই")}</p>}</div></div>
   </section>
  {payOpen && <div className="mdl" onClick={() => setPayOpen(false)}><div className="dlg pay" onClick={e => e.stopPropagation()}>
   <div className="dh"><b>{__("পেমেন্ট")}</b><button onClick={() => setPayOpen(false)}><X size={16} /></button></div>
   <div className="pb"><div className="pm">{Object.entries(M).filter(([k]) => k !== 'due' || ['admin','manager'].includes(user.role)).map(([k, v]) => <button key={k} className={method === k ? 'on' : ''} onClick={() => {
              setMethod(k);
              setTender('');
            }}>{v}</button>)}</div>
    <div className="pr"><div className="due"><small>{__("মোট দিতে হবে")}</small><b>{tk(due)}</b></div>
     <div className="pf"><input placeholder={__("কুপন কোড")} value={code} onChange={e => setCode(e.target.value)} /><button onClick={applyCode}>{__("প্রয়োগ")}</button><input placeholder={__("গিফট কার্ড")} value={gcode} onChange={e => setGcode(e.target.value)} /><button onClick={applyGift}>{__("প্রয়োগ")}</button><input placeholder="Store Credit Code" value={creditCode} onChange={e=>setCreditCode(e.target.value)} /><button onClick={applyStoreCredit}>Apply Credit</button><input placeholder="Exchange Voucher Code" value={voucherCode} onChange={e=>setVoucherCode(e.target.value)} /><button onClick={applyVoucher}>Apply Voucher</button></div>
     {(method === 'cash' || method === 'due') && <><input className="amt" type="number" autoFocus placeholder={method === 'due' ? __("এখন কত দিল (ঐচ্ছিক)") : __("ক্রেতার দেওয়া টাকা")} value={tender} onChange={e => setTender(e.target.value)} />
      {method === 'cash' && <div className="qk">{quick.map(x => <button key={x} onClick={() => setTender(String(x))}>{x === due ? __("ঠিক টাকা") : x}</button>)}</div>}
      {method === 'cash' && tender !== '' && given >= due && due > 0 && <div className="chg">{__("ফেরত টাকা: ")}{tk(change)}</div>}
      {method === 'due' && <div className="chg">{__('এখন জমা: ')}{tk(tender === '' ? 0 : Number(tender))} · {__('বাকি থাকবে: ')}{tk(Math.max(0, due - (tender === '' ? 0 : Number(tender))))}</div>}</>}
     {msg?.err && <div className="msg err">{msg.t}</div>}</div></div>
   <div className="df"><button onClick={() => setPayOpen(false)}>{__("বন্ধ")}</button><button className="b-pay" disabled={busy || !lines.length} onClick={pay}>{busy ? '...' : __("নিশ্চিত করুন — {0}", [tk(due)])}</button></div></div></div>}
  {discOpen && <div className="mdl" onClick={() => setDiscOpen(false)}><div className="dlg" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
   <div className="dh"><b>{__('ডিসকাউন্ট')}</b><button onClick={() => setDiscOpen(false)}><X size={16} /></button></div>
   <div className="pb" style={{ display: 'block' }}>
    <div className="pm"><button className={discMode === 'amt' ? 'on' : ''} onClick={() => { setDiscMode('amt'); setDiscIn(String(disc || '')); }}>{__('টাকা (৳)')}</button><button className={discMode === 'pct' ? 'on' : ''} onClick={() => { setDiscMode('pct'); setDiscIn(sub ? String(r2(disc / sub * 100)) : ''); }}>{__('শতাংশ (%)')}</button></div>
    <input className="amt" type="number" min={0} max={discMode === 'pct' ? (isCashier ? 10 : 100) : manualCap} step="0.01" autoFocus value={discIn} onChange={e => updateDiscount(e.target.value)} />
    <div className="qk">{(discMode === 'pct' ? [5, 10] : [50, 100, 200]).map(v => <button key={v} onClick={() => updateDiscount(v)}>{discMode === 'pct' ? `${v}%` : tk(v)}</button>)}</div>
    <p>{__('বর্তমান ডিসকাউন্ট')}: <b>{tk(disc + cd)}</b> ({sub ? r2((disc + cd) / sub * 100) : 0}%)</p>
    <p style={{ opacity: .7, fontSize: 12 }}>{isCashier ? __('ক্যাশিয়ার সর্বোচ্চ ১০% ডিসকাউন্ট দিতে পারবেন।') : __('ম্যানেজার/অ্যাডমিন সর্বোচ্চ ১০০% পর্যন্ত ডিসকাউন্ট দিতে পারবেন।')}</p>
   </div><div className="df"><button onClick={() => setDiscOpen(false)}>{__('বন্ধ')}</button><button className="b-pay" onClick={() => setDiscOpen(false)}>{__('ঠিক আছে')}</button></div></div></div>}
  {showHeld && <div className="mdl" onClick={() => setShowHeld(false)}><div className="dlg" style={{
        maxWidth: 340
      }} onClick={e => e.stopPropagation()}><div className="dh"><b>{__("হোল্ড করা বিল")}</b><button onClick={() => setShowHeld(false)}><X size={16} /></button></div><div className="pb" style={{
          display: 'grid',
          gap: 6
        }}>{!held.length && <p>{__("কোনো হোল্ড বিল নেই")}</p>}{held.map((h, i) => <button key={i} className="held-item" onClick={() => recall(i)}><b>{h.customerName || cs.find(c => String(c.id) === String(h.cust))?.name || __("খুচরা ক্রেতা")}</b><span>{new Date(h.t).toLocaleTimeString()} · {h.n || Object.keys(h.cart).length}{__(" আইটেম")} · {tk(h.total || 0)}</span></button>)}</div></div></div>}
 </div>;
}