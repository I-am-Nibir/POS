import {__} from './i18n.js';
import { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, Wallet, AlertTriangle, Coins, Percent } from 'lucide-react';
import { api } from './App.jsx';
const tk = n => __("৳") + Math.round(Number(n || 0)).toLocaleString('en-IN'),
  dh = o => new Date(Date.now() + 6 * 3600e3 + o * 864e5).toISOString().slice(0, 10);
const MN = {
  cash: __("ক্যাশ"),
  card: __("কার্ড"),
  bkash: __("বিকাশ"),
  nagad: __("নগদ"),
  due: __("বাকি")
};
function DemoData() {
  const [st, setSt] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = () => api('/demo/status').then(setSt).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);
  const run = async (path, options) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await api(path, options); location.reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  if (error && !st) return <div className="card"><h4>{__('ডেমো ডেটা')}</h4><p style={{color:'#ef4444'}}>{error}</p></div>;
  if (!st) return <div className="card"><h4>{__('ডেমো ডেটা')}</h4><p>{__('লোড হচ্ছে...')}</p></div>;
  return <div className="card demo-card"><h4>{__('ডেমো ডেটা')} · {st.hidden ? __('লুকানো') : __('দেখানো হচ্ছে')}</h4>
    <p className="mut">{__('পরীক্ষার জন্য ৫০টি পণ্য, ১০০ জন কাস্টমার, ৫টি সাপ্লায়ার, বিক্রি ও খরচের নমুনা ডেটা।')}</p>
    <div className="demo-actions">
      <button disabled={busy || st.seeded} onClick={() => run('/demo/seed',{method:'POST'})}>{__('ডেমো ডেটা যোগ করুন')}</button>
      {st.seeded && <button disabled={busy} onClick={() => run('/demo/visibility',{method:'PUT',body:{hide:!st.hidden}})}>{st.hidden ? __('ডেমো ডেটা দেখান') : __('ডেমো ডেটা লুকান')}</button>}
      {st.seeded && <button disabled={busy} className="demo-delete" onClick={() => { if(confirm(__('সব ডেমো ডেটা মুছে ফেলবেন?'))) run('/demo/clear',{method:'POST'}); }}>{__('ডেমো ডেটা মুছুন')}</button>}
    </div>
    {error && <p style={{color:'#ef4444'}}>{error}</p>}
    {st.seeded && <p className="mut demo-counts">{__('পণ্য')}: {st.counts.products} · {__('কাস্টমার')}: {st.counts.customers} · {__('বিক্রি')}: {st.counts.sales} · {__('সাপ্লায়ার')}: {st.counts.suppliers} · {__('খরচ')}: {st.counts.expenses}</p>}
  </div>;
}
export default function Dash() {
  const [d, setD] = useState();
  const [e, setE] = useState('');
  useEffect(() => {
    const to = dh(0),
      m0 = to.slice(0, 8) + '01';
    Promise.all([api(`/reports/series?group=day&from=${dh(-13)}&to=${to}`), api(`/reports/series?group=day&from=${m0}&to=${to}`), api(`/reports/detail?from=${to}&to=${to}`), api('/customers'), api('/products'), api('/sales')]).then(([s14, sm, det, cs, pr, sales]) => setD({
      s14,
      sm,
      det,
      cs,
      pr,
      sales
    })).catch(x => setE(x.message));
  }, []);
  if (e) return <p style={{
    color: 'red'
  }}>{e}</p>;
  if (!d) return <p>{__("লোড হচ্ছে...")}</p>;
  const days = Array.from({
    length: 14
  }, (_, i) => {
    const k = dh(i - 13);
    return d.s14.find(r => r.period === k) || {
      period: k,
      revenue: 0
    };
  });
  const today = days[13],
    mx = Math.max(1, ...days.map(x => x.revenue)),
    sum = k => d.sm.reduce((a, r) => a + r[k], 0),
    pf = sum('profit');
  const due = d.cs.reduce((a, c) => a + c.due, 0),
    low = d.pr.filter(p => p.stock <= p.low_stock),
    orders = d.det.byMethod.reduce((a, m) => a + m.n, 0),
    tm = Math.max(1, ...d.det.byMethod.map(m => m.total));
  const K = [[TrendingUp, __("আজকের বিক্রি"), tk(today.revenue), '#14b8a6'], [ShoppingBag, __("আজকের অর্ডার"), orders, '#3b82f6'], [Wallet, __("এ মাসের বিক্রি"), tk(sum('revenue')), '#8b5cf6'], [Percent, pf >= 0 ? __("এ মাসের নিট লাভ") : __("এ মাসের নিট ক্ষতি"), tk(Math.abs(pf)), pf >= 0 ? '#22c55e' : '#ef4444'], [Coins, __("কাস্টমারের বাকি"), tk(due), '#f97316'], [AlertTriangle, __("কম স্টকের পণ্য"), low.length, '#ef4444']];
  return <div><div className="kpis">{K.map(([I, l, v, c]) => <div key={l} className="kpi"><span className="ic" style={{
          background: c
        }}><I size={20} /></span><div><small>{l}</small><b>{v}</b></div></div>)}</div>
  <div className="g2"><div className="card"><h4>{__("গত ১৪ দিনের বিক্রি")}</h4><svg viewBox="0 0 560 170" width="100%">{days.map((x, i) => {
            const h = x.revenue / mx * 120;
            return <g key={x.period}><rect x={i * 40 + 8} y={135 - h} width="24" height={h || 1} rx="3" fill="#14b8a6"><title>{x.period}: {tk(x.revenue)}</title></rect><text x={i * 40 + 20} y="152" fontSize="10" textAnchor="middle" fill="currentColor">{x.period.slice(8)}</text></g>;
          })}</svg></div>
   <div className="card"><h4>{__("আজকের পেমেন্ট পদ্ধতি")}</h4>{!d.det.byMethod.length && <p className="mut">{__("আজ এখনো বিক্রি নেই")}</p>}{d.det.byMethod.map(m => <div key={m.method} style={{
          marginBottom: 10
        }}><div style={{
            display: 'flex',
            justifyContent: 'space-between'
          }}><span>{MN[m.method] || m.method} ({m.n})</span><b>{tk(m.total)}</b></div><div className="bar"><i style={{
              width: m.total / tm * 100 + '%'
            }} /></div></div>)}</div></div>
  <div className="g3"><div className="card"><h4>{__("আজকের সেরা পণ্য")}</h4>{!d.det.top.length && <p className="mut">{__("তথ্য নেই")}</p>}{d.det.top.slice(0, 6).map((t, i) => <div key={i} className="li"><span>{t.name} {t.size} {t.color}</span><b>{t.qty}{__(" পিস")}</b></div>)}</div>
   <div className="card"><h4>{__("কম স্টক")}</h4>{!low.length && <p className="mut">{__("সব পণ্যের স্টক ঠিক আছে")}</p>}{low.slice(0, 8).map(p => <div key={p.id} className="li"><span>{p.name} {p.size} {p.color}</span><b style={{
            color: '#ef4444'
          }}>{p.stock}</b></div>)}</div>
   <div className="card"><h4>{__("সাম্প্রতিক বিক্রি")}</h4>{!d.sales.length && <p className="mut">{__("তথ্য নেই")}</p>}{d.sales.slice(0, 8).map(s => <div key={s.id} className="li"><span>{s.invoice}<br /><small className="mut">{new Date(s.created_at.replace(' ', 'T') + 'Z').toLocaleString('en-GB')} · {MN[s.method] || s.method}</small></span><b style={{
            textDecoration: s.status === 'refunded' ? 'line-through' : 'none'
          }}>{tk(s.total)}</b></div>)}</div></div><DemoData /></div>;
}