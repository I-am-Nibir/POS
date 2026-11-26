import {__} from './i18n.js';
import { useState, useEffect, useRef } from 'react';
import { Search, Moon, Sun, X, Banknote, Pause, Percent, Trash2, Folder } from 'lucide-react';
import { api, receipt } from './App.jsx';
import { CameraScan } from './Extra2.jsx';
import { isNet, qget, qadd, syncQueue, cacheGet, cacheSet } from './offline.js';
import { build, printBytes, connectSerial, loadCfg } from './printer.js';
const r2 = n => Math.round(n * 100) / 100,
  tk = n => __("à§³") + Number(n || 0).toLocaleString('en-IN');
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
  cash: __("à¦•à§à¦¯à¦¾à¦¶"),
  card: __("à¦•à¦¾à¦°à§à¦¡"),
  bkash: __("à¦¬à¦¿à¦•à¦¾à¦¶"),
  nagad: __("à¦¨à¦—à¦¦"),
  due: __("à¦¬à¦¾à¦•à¦¿")
};
export default function Sell() {
  const user = JSON.parse(sessionStorage.getItem('u') || '{}'),
    isCashier = user.role === 'cashier';
  const [items, setItems] = useState([]),
    [q, setQ] = useState(''),
    [cat, setCat] = useState(''),
    [cart, setCart] = useState({}),
    [cs, setCs] = useState([]),
    [cust, setCust] = useState('');
  const [disc, setDisc] = useState(0),
    [code, setCode] = useState(''),
    [applied, setApplied] = useState(''),
    [cd, setCd] = useState(0),
    [gcode, setGcode] = useState(''),
    [gApplied, setGApplied] = useState(''),
    [gift, setGift] = useState(0);
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
  const [cq, setCq] = useState(''),
    [discMode, setDiscMode] = useState('amt'),
    [discIn, setDiscIn] = useState('');
  const sr = useRef(),
    H = useRef(),
    focus = () => sr.current && sr.current.focus();
  const [net, setNet] = useState(navigator.onLine),
    [pend, setPend] = useState(qget().length),
    [cfg, setCfg] = useState(null),
    [ser, setSer] = useState(false);
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
      t: __("à¦¸à¦¿à¦™à§à¦• à¦¬à§à¦¯à¦°à§à¦¥ (à¦®à§à¦¯à¦¾à¦¨à§‡à¦œà¦¾à¦°à¦•à§‡ à¦œà¦¾à¦¨à¦¾à¦¨): ") + r.failed.map(f => f.err).join(' | '),
      err: 1
    });else if (r.done) setMsg({
      t: __("{0}à¦Ÿà¦¿ à¦…à¦«à¦²à¦¾à¦‡à¦¨ à¦¬à¦¿à¦•à§à¦°à¦¿ à¦¸à¦¿à¦™à§à¦• à¦¹à¦¯à¦¼à§‡à¦›à§‡", [r.done])
    });
    if (r.done) load();
  };
  useEffect(() => {
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
    base = Math.max(0, sub - disc - cd),
    f = sub ? base / sub : 0;
  const vat = lines.reduce((a, l) => a + r2(l.p.price * l.qty * l.p.vat_rate / 100 * f), 0),
    total = r2(base + vat),
    giftUse = Math.min(gift, total),
    due = r2(total - giftUse);
  const given = tender === '' ? due : +tender,
    change = Math.max(0, r2(given - due)),
    short = method !== 'due' && method === 'cash' && given < due;
  const capDisc = () => isCashier ? r2(sub * 0.1) : sub;
  useEffect(() => {
    if (isCashier && sub > 0 && disc > r2(sub * 0.1)) setDisc(r2(sub * 0.1));
  }, [sub, disc, isCashier]);
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
        t: __("à¦¸à§à¦Ÿà¦• à¦¨à§‡à¦‡: ") + p.name,
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
      t: __("à¦ªà¦£à§à¦¯ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿: ") + c,
      err: 1
    }));
  };
  const list = items.filter(i => (!cat || i.category === cat) && (!q || (i.name + i.sku + (i.barcode || '') + (i.size || '') + (i.color || '')).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.name.localeCompare(b.name) || (a.size || '').localeCompare(b.size || '')).slice(0, 300);
  const cats = [...new Set(items.map(i => i.category).filter(Boolean))];
  const clear = () => {
    setPayOpen(false);
    setDiscOpen(false);
    setCart({});
    setDisc(0);
    setDiscIn('');
    setCode('');
    setApplied('');
    setCd(0);
    setGcode('');
    setGApplied('');
    setGift(0);
    setTender('');
    setCust('');
    setMethod('cash');
    setKey(crypto.randomUUID());
    setQ('');
    focus();
  };
  const hold = () => {
    if (!lines.length) return;
    const h = [...held, {
      cart,
      cust,
      t: Date.now(),
      n: lines.length,
      total
    }];
    localStorage.setItem('held', JSON.stringify(h));
    setHeld(h);
    clear();
    setMsg({
      t: __("à¦¬à¦¿à¦² à¦¹à§‹à¦²à§à¦¡ à¦¹à¦¯à¦¼à§‡à¦›à§‡ (F6 à¦¦à¦¿à¦¯à¦¼à§‡ à¦«à¦¿à¦°à¦¿à¦¯à¦¼à§‡ à¦†à¦¨à§à¦¨)")
    });
  };
  const recall = i => {
    const h = held[i];
    setCart(h.cart);
    setCust(h.cust);
    const r = held.filter((_, k) => k !== i);
    localStorage.setItem('held', JSON.stringify(r));
    setHeld(r);
    setShowHeld(false);
    focus();
  };
  const voidBill = () => {
    if (!lines.length) return;
    if (!confirm(__("à¦¬à¦¿à¦² à¦¬à¦¾à¦¤à¦¿à¦² à¦•à¦°à¦¬à§‡à¦¨? à¦•à¦¾à¦°à§à¦Ÿà§‡à¦° à¦¸à¦¬ à¦†à¦‡à¦Ÿà§‡à¦® à¦®à§à¦›à§‡ à¦¯à¦¾à¦¬à§‡à¥¤"))) return;
    const snap = {
      cart,
      cust,
      disc
    };
    clear();
    setMsg({
      t: __("à¦¬à¦¿à¦² à¦¬à¦¾à¦¤à¦¿à¦² à¦¹à¦¯à¦¼à§‡à¦›à§‡"),
      undo: snap
    });
  };
  const reprint = () => last && receipt(last.r, last.lines, last.total, last.vat, last.disc);
  const pay = async () => {
    if (busy || !lines.length) return;
    if (method === 'due' && !cust) return setMsg({
      t: __("à¦¬à¦¾à¦•à¦¿à¦° à¦œà¦¨à§à¦¯ à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦° à¦¬à¦¾à¦›à§à¦¨"),
      err: 1
    });
    if (short) return setMsg({
      t: __("à¦•à§à¦°à§‡à¦¤à¦¾à¦° à¦¦à§‡à¦“à¦¯à¦¼à¦¾ à¦Ÿà¦¾à¦•à¦¾ à¦•à¦®"),
      err: 1
    });
    const dFinal = Math.max(0, Math.min(+disc || 0, capDisc()));
    const paid = method === 'due' ? tender === '' ? 0 : +tender : method === 'cash' ? given : due;
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
      gift: gApplied || undefined
    };
    const snap = {
      lines,
      total,
      vat,
      disc: dFinal + cd,
      paid,
      method
    };    const finish = async (r, off) => {
      const L = {
        r,
        ...snap,
        off
      };
      setLast(L);
      setMsg({
        t: off ? __("à¦…à¦«à¦²à¦¾à¦‡à¦¨à§‡ à¦¸à§‡à¦­: {0} (à¦‡à¦¨à§à¦Ÿà¦¾à¦°à¦¨à§‡à¦Ÿ à¦à¦²à§‡ à¦¸à¦¿à¦™à§à¦• à¦¹à¦¬à§‡)", [r.invoice]) : __("à¦¬à¦¿à¦² à¦¸à¦®à§à¦ªà¦¨à§à¦¨ {0}", [r.invoice]),
        change: r.change,
        due: r.due
      });
      beep(1);
      try {
        await printBytes(build(cfg, L, method === 'cash'), cfg);
      } catch {}
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
        if (body.coupon || body.gift) setMsg({
          t: __("à¦…à¦«à¦²à¦¾à¦‡à¦¨à§‡ à¦•à§à¦ªà¦¨/à¦—à¦¿à¦«à¦Ÿ à¦•à¦¾à¦°à§à¦¡ à¦šà¦²à¦¬à§‡ à¦¨à¦¾ â€” à¦¸à¦°à¦¿à¦¯à¦¼à§‡ à¦†à¦¬à¦¾à¦° à¦šà§‡à¦·à§à¦Ÿà¦¾ à¦•à¦°à§à¦¨"),
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
    const s = prompt(a === 'open' ? __("à¦“à¦ªà§‡à¦¨à¦¿à¦‚ à¦•à§à¦¯à¦¾à¦¶ (à§³)") : __("à¦¡à§à¦°à¦¯à¦¼à¦¾à¦°à§‡ à¦à¦–à¦¨ à¦®à§‹à¦Ÿ à¦•à§à¦¯à¦¾à¦¶ (à§³)"));
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
        t: a === 'open' ? __("à¦¶à¦¿à¦«à¦Ÿ à¦šà¦¾à¦²à§ à¦¹à¦¯à¦¼à§‡à¦›à§‡") : __("à¦¹à¦¿à¦¸à¦¾à¦¬ à¦…à¦¨à§à¦¯à¦¾à¦¯à¦¼à§€ {0} Â· à¦—à§à¦¨à§‡ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ {1} Â· à¦—à¦°à¦®à¦¿à¦² {2}", [tk(r.expected), tk(r.counted), tk(r.difference)])
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
  const quick = [...new Set([due, Math.ceil(due / 100) * 100, Math.ceil(due / 500) * 500, Math.ceil(due / 1000) * 1000, 2000, 5000].filter(x => x >= due && x > 0))].slice(0, 5);
  const addCust = async () => {
    const n = prompt(__("à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°à§‡à¦° à¦¨à¦¾à¦®"));
    if (!n) return;
    const ph = prompt(__("à¦«à§‹à¦¨ (à¦à¦šà§à¦›à¦¿à¦•)")) || undefined;
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
        t: __("à¦ªà§à¦°à¦¿à¦¨à§à¦Ÿà¦¾à¦° à¦¸à¦‚à¦¯à§à¦•à§à¦¤")
      });
    } catch {
      setMsg({
        t: __("à¦¸à¦‚à¦¯à§‹à¦— à¦¹à¦¯à¦¼à¦¨à¦¿ (Chrome/Edge + HTTPS à¦²à¦¾à¦—à¦¬à§‡; à¦…à¦¥à¦¬à¦¾ à¦¸à¦¾à¦°à§à¦­à¦¾à¦°à§‡ PRINTER_HOST à¦¸à§‡à¦Ÿ à¦•à¦°à§à¦¨)"),
        err: 1
      });
    }
  };
  const cname = cs.find(c => String(c.id) === String(cust))?.name || __("à¦–à§à¦šà¦°à¦¾ à¦•à§à¦°à§‡à¦¤à¦¾");
  const openDisc = () => {
    setDiscMode('amt');
    setDiscIn(disc ? String(disc) : '');
    setDiscOpen(true);
  };
  const switchDiscMode = m => {
    setDiscMode(m);
    setDiscIn(m === 'pct' ? (sub ? String(r2(disc / sub * 100)) : '0') : String(disc || ''));
  };
  const applyDisc = v => {
    setDiscIn(v);
    const n = +v || 0;
    if (discMode === 'pct') {
      const pct = Math.max(0, Math.min(n, isCashier ? 10 : 100));
      setDisc(r2(sub * pct / 100));
    } else setDisc(Math.max(0, Math.min(n, capDisc())));
  };
  const csl = cs.filter(c => !cq || ((c.name || '') + ' ' + (c.phone || '')).toLowerCase().includes(cq.toLowerCase()));
  return <div className={'nx' + (light ? ' light' : '')}>
  <section className="cartp">
   <div className="tabs"><div className="tab">{__("à¦•à¦¾à¦°à§à¦Ÿ")}{lines.length > 0 && <span className="badge">{lines.length}</span>}</div><span style={{
          flex: 1
        }} />
    <span className={'net ' + (net ? 'on' : 'off')}>{net ? __("â— à¦…à¦¨à¦²à¦¾à¦‡à¦¨") : __("â— à¦…à¦«à¦²à¦¾à¦‡à¦¨")}</span>{pend > 0 && <button className="tb" onClick={sync}>{__("âŸ³ à¦¸à¦¿à¦™à§à¦• (")}{pend})</button>}</div>
   <div className="cartbox">
    <div className="toolbox">
     <input className="csrch" placeholder={__("à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦° à¦–à§à¦à¦œà§à¦¨...")} value={cq} onChange={e => setCq(e.target.value)} />
     <select value={cust} onChange={e => setCust(e.target.value)}><option value="">{"à¦–à§à¦šà¦°à¦¾ à¦•à§à¦°à§‡à¦¤à¦¾".length && __("à¦–à§à¦šà¦°à¦¾ à¦•à§à¦°à§‡à¦¤à¦¾")}</option>{csl.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone || ''}{c.due > 0 ? __(" (à¦¬à¦¾à¦•à¦¿ {0})", [c.due]) : ''}</option>)}</select>
     <button title={__("à¦¨à¦¤à§à¦¨ à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°")} onClick={addCust}>ï¼‹</button><button onClick={() => setShowHeld(true)}>{__("à¦¹à§‹à¦²à§à¦¡ à¦¬à¦¿à¦² (")}{held.length})</button><button onClick={() => shift('open')}>{__("à¦¶à¦¿à¦«à¦Ÿ à¦–à§à¦²à§à¦¨")}</button><button onClick={() => shift('close')}>{__("à¦¶à¦¿à¦«à¦Ÿ à¦¬à¦¨à§à¦§")}</button><button onClick={connect}>ðŸ–¨ {ser ? __("à¦¸à¦‚à¦¯à§à¦•à§à¦¤") : cfg?.network ? 'LAN' : __("à¦ªà§à¦°à¦¿à¦¨à§à¦Ÿà¦¾à¦°")}</button><button disabled={!last} onClick={reprint}>ðŸ–¨ {__("à¦°à¦¸à¦¿à¦¦")}</button></div>
    {msg && <div className={'msg' + (msg.err ? ' err' : '')} onClick={() => setMsg(null)}>{msg.t}{msg.change != null && <div className="chg">{__("à¦«à§‡à¦°à¦¤ à¦¦à¦¿à¦¨: ")}{tk(msg.change)}{msg.due > 0 && __(" Â· à¦¬à¦¾à¦•à¦¿ {0}", [tk(msg.due)])}</div>}{last && !msg.err && msg.change != null && <button onClick={e => {
            e.stopPropagation();
            receipt(last.r, last.lines, last.total, last.vat, last.disc);
          }}>{__("ðŸ–¨ à¦°à¦¸à¦¿à¦¦ à¦ªà§à¦°à¦¿à¦¨à§à¦Ÿ")}</button>}{msg.undo && <button onClick={e => {
            e.stopPropagation();
            setCart(msg.undo.cart);
            setCust(msg.undo.cust);
            setDisc(msg.undo.disc || 0);
            setMsg(null);
          }}>{__("à¦«à¦¿à¦°à¦¿à¦¯à¦¼à§‡ à¦†à¦¨à§à¦¨")}</button>}</div>}
    <div className="th"><div>{__("à¦ªà¦£à§à¦¯")}</div><div>{__("à¦ªà¦°à¦¿à¦®à¦¾à¦£")}</div><div>{__("à¦®à§‹à¦Ÿ")}</div></div>
    <div className="rows">{!lines.length && <p className="empty">{__("à¦•à¦¾à¦°à§à¦Ÿ à¦–à¦¾à¦²à¦¿ â€” à¦ªà¦£à§à¦¯ à¦¸à§à¦•à§à¦¯à¦¾à¦¨ à¦•à¦°à§à¦¨ à¦¬à¦¾ à¦Ÿà§à¦¯à¦¾à¦ª à¦•à¦°à§à¦¨")}</p>}
     {lines.map(l => <div key={l.p.id} className="row"><div><b>{l.p.name}</b> <small>{l.p.size} {l.p.color}</small><div className="lnk"><a className="rm" onClick={() => setQty(l.p, 0)}>{__("à¦®à§à¦›à§à¦¨")}</a><span>{tk(l.p.price)}{l.p.vat_rate > 0 && <small className="lv"> Â· {__("à¦­à§à¦¯à¦¾à¦Ÿ")} {l.p.vat_rate}%</small>}</span></div></div>
      <div className="qty"><button onClick={() => setQty(l.p, l.qty - 1)}>âˆ’</button><input className="qin" type="number" min="1" value={l.qty} onChange={e => setQty(l.p, Math.round(+e.target.value || 0))} /><button onClick={() => setQty(l.p, l.qty + 1)}>ï¼‹</button></div><div className="tot">{tk(l.p.price * l.qty)}</div></div>)}</div>
    <table className="sumt"><tbody>
     <tr><td>{__("à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°: ")}<b>{cname}</b></td><td>{__("à¦¸à¦¾à¦¬-à¦Ÿà§‹à¦Ÿà¦¾à¦²")}</td><td className="r">{tk(sub)}</td></tr>
     <tr><td>{__("à¦•à§à¦ªà¦¨: ")}<b>{applied || 'â€”'}</b>{cd > 0 && ` (âˆ’${tk(cd)})`}</td><td><a className="dl" onClick={openDisc}>{__("à¦¡à¦¿à¦¸à¦•à¦¾à¦‰à¦¨à§à¦Ÿ")}</a></td><td className="r">{tk(disc)}</td></tr>
     <tr><td>{__("à¦—à¦¿à¦«à¦Ÿ à¦•à¦¾à¦°à§à¦¡: ")}<b>{gApplied || 'â€”'}</b></td><td>{__("à¦­à§à¦¯à¦¾à¦Ÿ")}</td><td className="r">{tk(vat)}</td></tr>
     <tr className="gt"><td /><td>{__("à¦®à§‹à¦Ÿ")}</td><td className="r">{tk(total)}</td></tr></tbody></table>
   </div>
   <div className="bottom"><button className="b-pay" title="F9" disabled={!lines.length} onClick={() => setPayOpen(true)}><Banknote size={20} /><span>{__("à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦•à¦°à§à¦¨")}</span></button><button className="b-hold" title="F4" disabled={!lines.length} onClick={hold}><Pause size={20} /><span>{__("à¦¹à§‹à¦²à§à¦¡")}</span></button><button className="b-disc" disabled={!lines.length} onClick={openDisc}><Percent size={20} /><span>{__("à¦¡à¦¿à¦¸à¦•à¦¾à¦‰à¦¨à§à¦Ÿ")}</span></button><button className="b-void" disabled={!lines.length} onClick={voidBill}><Trash2 size={20} /><span>{__("à¦¬à¦¿à¦² à¦¬à¦¾à¦¤à¦¿à¦²")}</span></button></div>
  </section>
  <section className="gridp"><div className="gtool"><span className="ic"><Search size={16} /></span><span className="ic">â–®â–¯â–®</span>
    <input ref={sr} className="scan" placeholder={__("à¦¬à¦¾à¦°à§à¦•à§‹à¦¡ à¦¸à§à¦•à§à¦¯à¦¾à¦¨ à¦•à¦°à§à¦¨ à¦¬à¦¾ à¦¨à¦¾à¦®/SKU à¦²à¦¿à¦–à§‡ Enter (F2)")} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSel(x => Math.min(x + 1, list.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSel(x => Math.max(x - 1, 0));
          } else if (e.key === 'Enter' && q) {
            const m = find(q) || sel >= 0 && list[sel] || list.length === 1 && list[0];
            m ? (add(m), setQ('')) : (beep(0), setMsg({
              t: __("à¦ªà¦£à§à¦¯ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¯à¦¾à¦¯à¦¼à¦¨à¦¿"),
              err: 1
            }));
          } else if (e.key === 'Enter' && sel >= 0 && list[sel]) {
            add(list[sel]);
          } else if (e.key === 'Escape') {
            setQ('');
            setSel(-1);
          }
        }} />
    <CameraScan onCode={scan} /><button className="ic" title={__("à¦¥à¦¿à¦®")} onClick={() => {
          localStorage.setItem('posTheme', light ? 'dark' : 'light');
          setLight(!light);
        }}>{light ? <Moon size={16} /> : <Sun size={16} />}</button></div>
   <div className="crumb"><a onClick={() => setCat('')}>{__("à¦¹à§‹à¦®")}</a>{cat && <> â€º <b>{cat}</b></>}</div>
   <div className="plist"><div className="phead"><div>{__("à¦ªà¦£à§à¦¯à§‡à¦° à¦¨à¦¾à¦®")}</div><div>{__("SKU/à¦¬à¦¾à¦°à§à¦•à§‹à¦¡")}</div><div>{__("à¦¸à§à¦Ÿà¦•")}</div><div>{__("à¦¦à¦¾à¦®")}</div></div>
    <div className="pbody">{!cat && !q && cats.map(c => <div key={c} className="prow cat" onClick={() => setCat(c)}><div className="pn"><Folder size={16} /><b>{c}</b></div><div /><div /><div /></div>)}
     {list.map((p, i) => <div key={p.id} className={'prow' + (p.stock <= 0 ? ' off' : '') + (i === sel ? ' sel' : '')} onClick={() => {
            add(p);
            focus();
          }}>
      <div className="pn"><b>{p.name}</b>{(p.size || p.color) && <span className="var">{p.size} {p.color}</span>}{cart[p.id] > 0 && <i className="qb">{cart[p.id]}</i>}</div>
      <div className="ps">{p.barcode || p.sku}</div><div className={'pk' + (p.stock <= p.low_stock ? ' low' : '')}>{p.stock}</div><div className="pp">{tk(p.price)}</div></div>)}
     {!list.length && <p className="empty">{__("à¦•à§‹à¦¨à§‹ à¦ªà¦£à§à¦¯ à¦¨à§‡à¦‡")}</p>}</div></div>
   </section>
  {payOpen && <div className="mdl" onClick={() => setPayOpen(false)}><div className="dlg pay" onClick={e => e.stopPropagation()}>
   <div className="dh"><b>{__("à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ")}</b><button onClick={() => setPayOpen(false)}><X size={16} /></button></div>
   <div className="pb"><div className="pm">{Object.entries(M).map(([k, v]) => <button key={k} className={method === k ? 'on' : ''} onClick={() => {
              setMethod(k);
              setTender('');
            }}>{v}</button>)}</div>
    <div className="pr"><div className="due"><small>{__("à¦®à§‹à¦Ÿ à¦¦à¦¿à¦¤à§‡ à¦¹à¦¬à§‡")}</small><b>{tk(due)}</b></div>
     <div className="pf"><input placeholder={__("à¦•à§à¦ªà¦¨ à¦•à§‹à¦¡")} value={code} onChange={e => setCode(e.target.value)} /><button onClick={applyCode}>{__("à¦ªà§à¦°à¦¯à¦¼à§‹à¦—")}</button><input placeholder={__("à¦—à¦¿à¦«à¦Ÿ à¦•à¦¾à¦°à§à¦¡")} value={gcode} onChange={e => setGcode(e.target.value)} /><button onClick={applyGift}>{__("à¦ªà§à¦°à¦¯à¦¼à§‹à¦—")}</button></div>
     {(method === 'cash' || method === 'due') && <><input className="amt" type="number" autoFocus placeholder={method === 'due' ? __("à¦à¦–à¦¨ à¦•à¦¤ à¦¦à¦¿à¦² (à¦à¦šà§à¦›à¦¿à¦•)") : __("à¦•à§à¦°à§‡à¦¤à¦¾à¦° à¦¦à§‡à¦“à¦¯à¦¼à¦¾ à¦Ÿà¦¾à¦•à¦¾")} value={tender} onChange={e => setTender(e.target.value)} />
      {method === 'cash' && <div className="qk">{quick.map(x => <button key={x} onClick={() => setTender(String(x))}>{x === due ? __("à¦ à¦¿à¦• à¦Ÿà¦¾à¦•à¦¾") : x}</button>)}</div>}
      {method === 'cash' && given >= due && due > 0 && <div className="chg">{__("à¦«à§‡à¦°à¦¤ à¦Ÿà¦¾à¦•à¦¾: ")}{tk(change)}</div>}</>}
     {msg?.err && <div className="msg err">{msg.t}</div>}</div></div>
   <div className="df"><button onClick={() => setPayOpen(false)}>{__("à¦¬à¦¨à§à¦§")}</button><button className="b-pay" disabled={busy || !lines.length} onClick={pay}>{busy ? '...' : __("à¦¨à¦¿à¦¶à§à¦šà¦¿à¦¤ à¦•à¦°à§à¦¨ â€” {0}", [tk(due)])}</button></div></div></div>}
  {discOpen && <div className="mdl" onClick={() => setDiscOpen(false)}><div className="dlg" style={{
        maxWidth: 360
      }} onClick={e => e.stopPropagation()}><div className="dh"><b>{__("à¦¡à¦¿à¦¸à¦•à¦¾à¦‰à¦¨à§à¦Ÿ")}</b><button onClick={() => setDiscOpen(false)}><X size={16} /></button></div>
   <div className="pb" style={{
          display: 'block'
        }}>
    <div className="discopt"><button className={discMode === 'amt' ? 'on' : ''} onClick={() => switchDiscMode('amt')}>{__("à¦Ÿà¦¾à¦•à¦¾ (à§³)")}</button><button className={discMode === 'pct' ? 'on' : ''} onClick={() => switchDiscMode('pct')}>{__("à¦¶à¦¤à¦¾à¦‚à¦¶ (%)")}</button></div>
    <input className="amt" type="number" min="0" autoFocus value={discIn} onChange={e => applyDisc(e.target.value)} disabled={!sub} />
    <div className="qk" style={{
          marginTop: 8
        }}>{discMode === 'pct' ? [5, 10].map(x => <button key={x} onClick={() => applyDisc(String(x))}>{x}%</button>) : [50, 100, 200].map(x => <button key={x} disabled={!sub || x > capDisc()} onClick={() => applyDisc(String(x))}>{__("à§³")}{x}</button>)}</div>
    <p style={{
          opacity: .7,
          fontSize: 12,
          margin: '10px 0 0'
        }}>{isCashier ? __("à¦•à§à¦¯à¦¾à¦¶à¦¿à¦¯à¦¼à¦¾à¦° à¦¸à¦°à§à¦¬à§‹à¦šà§à¦š à§§à§¦% (à§³{0}) à¦¦à¦¿à¦¤à§‡ à¦ªà¦¾à¦°à§‡à¦¨à¥¤", [tk(capDisc())]) : __("à¦¡à¦¿à¦¸à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦®à§‹à¦Ÿ à¦¬à¦¿à¦²à§‡à¦° à¦šà§‡à¦¯à¦¼à§‡ à¦¬à§‡à¦¶à¦¿ à¦¹à¦¤à§‡ à¦ªà¦¾à¦°à¦¬à§‡ à¦¨à¦¾à¥¤")}</p>
    <p style={{
          fontSize: 13,
          margin: '6px 0 0'
        }}>{__("à¦¬à¦°à§à¦¤à¦®à¦¾à¦¨ à¦¡à¦¿à¦¸à¦•à¦¾à¦‰à¦¨à§à¦Ÿ: à§³{0} ({1}%)", [tk(disc), sub ? r2(disc / sub * 100) : 0])}</p></div>
   <div className="df"><button onClick={() => setDiscOpen(false)}>{__("à¦¬à¦¾à¦¤à¦¿à¦²")}</button><button className="b-pay" onClick={() => setDiscOpen(false)}>{__("à¦ à¦¿à¦• à¦†à¦›à§‡")}</button></div></div></div>}
  {showHeld && <div className="mdl" onClick={() => setShowHeld(false)}><div className="dlg" style={{
        maxWidth: 380
      }} onClick={e => e.stopPropagation()}><div className="dh"><b>{__("à¦¹à§‹à¦²à§à¦¡ à¦•à¦°à¦¾ à¦¬à¦¿à¦²")}</b><button onClick={() => setShowHeld(false)}><X size={16} /></button></div><div className="pb" style={{
          display: 'grid',
          gap: 6
        }}>{!held.length && <p>{__("à¦•à§‹à¦¨à§‹ à¦¹à§‹à¦²à§à¦¡ à¦¬à¦¿à¦² à¦¨à§‡à¦‡")}</p>}{held.map((h, i) => <button key={i} onClick={() => recall(i)}>{new Date(h.t).toLocaleTimeString()} â€” {h.n ?? Object.keys(h.cart).length}{__(" à¦†à¦‡à¦Ÿà§‡à¦®")} â€” {tk(h.total ?? 0)}{h.cust && cs.find(c => String(c.id) === String(h.cust)) ? ' Â· ' + cs.find(c => String(c.id) === String(h.cust)).name : ''}</button>)}</div></div></div>}
 </div>;
}
