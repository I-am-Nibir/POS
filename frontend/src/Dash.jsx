import {__} from './i18n.js';
import { useState, useEffect } from 'react';
import { TrendingUp, ShoppingBag, Wallet, AlertTriangle, Coins, Percent } from 'lucide-react';
import { api } from './App.jsx';
const tk = n => __("à§³") + Math.round(Number(n || 0)).toLocaleString('en-IN'),
  dh = o => new Date(Date.now() + 6 * 3600e3 + o * 864e5).toISOString().slice(0, 10);
const MN = {
  cash: __("à¦•à§à¦¯à¦¾à¦¶"),
  card: __("à¦•à¦¾à¦°à§à¦¡"),
  bkash: __("à¦¬à¦¿à¦•à¦¾à¦¶"),
  nagad: __("à¦¨à¦—à¦¦"),
  due: __("à¦¬à¦¾à¦•à¦¿")
};
function DemoData() {
  const [st, setSt] = useState(null),
    [e, setE] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api('/demo/status').then(setSt).catch(x => setE(x.message));
  }, []);
  const run = (path, opt) => {
    if (busy) return;
    setBusy(true);
    api(path, opt).then(() => setTimeout(() => location.reload(), 400)).catch(x => {
      setE(x.message);
      setBusy(false);
    });
  };
  if (e) return <div className="card"><h4>{__("à¦¡à§‡à¦®à§‹ à¦¡à§‡à¦Ÿà¦¾")}</h4><p style={{ color: '#ef4444' }}>{e}</p></div>;
  if (!st) return <div className="card"><h4>{__("à¦¡à§‡à¦®à§‹ à¦¡à§‡à¦Ÿà¦¾")}</h4><p className="mut">{__("à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")}</p></div>;
  return <div className="card"><h4>{__("à¦¡à§‡à¦®à§‹ à¦¡à§‡à¦Ÿà¦¾")} â€” {st.hidden ? __("à¦²à§à¦•à¦¾à¦¨à§‹") : __("à¦¦à§‡à¦–à¦¾à¦¨à§‹ à¦¹à¦šà§à¦›à§‡")}</h4>
   <p className="mut" style={{ fontSize: 12, marginTop: 0 }}>{__("à¦Ÿà§‡à¦¸à§à¦Ÿà§‡à¦° à¦œà¦¨à§à¦¯ à§«à§¦ à¦ªà¦£à§à¦¯, à§§à§¦à§¦ à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°, à¦¡à§‡à¦®à§‹ à¦¬à¦¿à¦•à§à¦°à¦¿ à¦“ à¦–à¦°à¦š à¦¯à§‹à¦— à¦¹à¦¬à§‡à¥¤")}</p>
   <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    <button disabled={busy} onClick={() => run('/demo/seed', { method: 'POST' })}>{__("à¦¡à§‡à¦®à§‹ à¦¡à§‡à¦Ÿà¦¾ à¦¯à§‹à¦— à¦•à¦°à§à¦¨")}</button>
    <button disabled={busy} onClick={() => run('/demo/visibility', { method: 'PUT', body: { hide: !st.hidden } })}>{st.hidden ? __("à¦¡à§‡à¦®à§‹ à¦¡à§‡à¦Ÿà¦¾ à¦¦à§‡à¦–à¦¾à¦¨") : __("à¦¡à§‡à¦®à§‹ à¦¡à§‡à¦Ÿà¦¾ à¦²à§à¦•à¦¾à¦¨")}</button>
    {st.seeded && <button disabled={busy} onClick={() => { if (!confirm(__("à¦¸à¦¬ à¦¡à§‡à¦®à§‹ à¦¡à§‡à¦Ÿà¦¾ à¦®à§à¦›à§‡ à¦«à§‡à¦²à¦¬à§‡à¦¨?"))) return; run('/demo/clear', { method: 'POST' }) }}>{__("à¦¡à§‡à¦®à§‹ à¦¡à§‡à¦Ÿà¦¾ à¦®à§à¦›à§à¦¨")}</button>}
   </div>
   {st.seeded && <p className="mut" style={{ fontSize: 12, marginTop: 8 }}>{__("à¦ªà¦£à§à¦¯")}: {st.counts.products} Â· {__("à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°")}: {st.counts.customers} Â· {__("à¦¬à¦¿à¦•à§à¦°à¦¿")}: {st.counts.sales}</p>}
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
  if (e) return <p style={{ color: 'red' }}>{e}</p>;
  if (!d) return <p>{__("à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...")}</p>;
  const days = Array.from({ length: 14 }, (_, i) => {
    const k = dh(i - 13);
    return d.s14.find(r => r.period === k) || { period: k, revenue: 0 };
  });
  const today = days[13],
    mx = Math.max(1, ...days.map(x => x.revenue)),
    sum = k => d.sm.reduce((a, r) => a + r[k], 0),
    pf = sum('profit');
  const due = d.cs.reduce((a, c) => a + c.due, 0),
    low = d.pr.filter(p => p.stock <= p.low_stock),
    orders = d.det.byMethod.reduce((a, m) => a + m.n, 0),
    tm = Math.max(1, ...d.det.byMethod.map(m => m.total));
  const K = [[TrendingUp, __("à¦†à¦œà¦•à§‡à¦° à¦¬à¦¿à¦•à§à¦°à¦¿"), tk(today.revenue), '#14b8a6'], [ShoppingBag, __("à¦†à¦œà¦•à§‡à¦° à¦…à¦°à§à¦¡à¦¾à¦°"), orders, '#3b82f6'], [Wallet, __("à¦ à¦®à¦¾à¦¸à§‡à¦° à¦¬à¦¿à¦•à§à¦°à¦¿"), tk(sum('revenue')), '#8b5cf6'], [Percent, pf >= 0 ? __("à¦ à¦®à¦¾à¦¸à§‡à¦° à¦¨à¦¿à¦Ÿ à¦²à¦¾à¦­") : __("à¦ à¦®à¦¾à¦¸à§‡à¦° à¦¨à¦¿à¦Ÿ à¦•à§à¦·à¦¤à¦¿"), tk(Math.abs(pf)), pf >= 0 ? '#22c55e' : '#ef4444'], [Coins, __("à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°à§‡à¦° à¦¬à¦¾à¦•à¦¿"), tk(due), '#f97316'], [AlertTriangle, __("à¦•à¦® à¦¸à§à¦Ÿà¦•à§‡à¦° à¦ªà¦£à§à¦¯"), low.length, '#ef4444']];
  return <div><div className="kpis">{K.map(([I, l, v, c]) => <div key={l} className="kpi"><span className="ic" style={{ background: c }}><I size={20} /></span><div><small>{l}</small><b>{v}</b></div></div>)}</div>
  <div className="g2"><div className="card"><h4>{__("à¦—à¦¤ à§§à§ª à¦¦à¦¿à¦¨à§‡à¦° à¦¬à¦¿à¦•à§à¦°à¦¿")}</h4><svg viewBox="0 0 560 170" width="100%">{days.map((x, i) => {
            const h = x.revenue / mx * 120;
            return <g key={x.period}><rect x={i * 40 + 8} y={135 - h} width="24" height={h || 1} rx="3" fill="#14b8a6"><title>{x.period}: {tk(x.revenue)}</title></rect><text x={i * 40 + 20} y="152" fontSize="10" textAnchor="middle" fill="currentColor">{x.period.slice(8)}</text></g>;
          })}</svg></div>
   <div className="card"><h4>{__("à¦†à¦œà¦•à§‡à¦° à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦ªà¦¦à§à¦§à¦¤à¦¿")}</h4>{!d.det.byMethod.length && <p className="mut">{"à¦†à¦œ à¦à¦–à¦¨à§‹ à¦¬à¦¿à¦•à§à¦°à¦¿ à¦¨à§‡à¦‡".length && __("à¦†à¦œ à¦à¦–à¦¨à§‹ à¦¬à¦¿à¦•à§à¦°à¦¿ à¦¨à§‡à¦‡")}</p>}{d.det.byMethod.map(m => <div key={m.method} style={{ marginBottom: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{MN[m.method] || m.method} ({m.n})</span><b>{tk(m.total)}</b></div><div className="bar"><i style={{ width: m.total / tm * 100 + '%' }} /></div></div>)}</div></div>
  <div className="g3"><div className="card"><h4>{__("à¦†à¦œà¦•à§‡à¦° à¦¸à§‡à¦°à¦¾ à¦ªà¦£à§à¦¯")}</h4>{!d.det.top.length && <p className="mut">{__("à¦¤à¦¥à§à¦¯ à¦¨à§‡à¦‡")}</p>}{d.det.top.slice(0, 6).map((t, i) => <div key={i} className="li"><span>{t.name} {t.size} {t.color}</span><b>{t.qty}{__(" à¦ªà¦¿à¦¸")}</b></div>)}</div>
   <div className="card"><h4>{__("à¦•à¦® à¦¸à§à¦Ÿà¦•")}</h4>{!low.length && <p className="mut">{__("à¦¸à¦¬ à¦ªà¦£à§à¦¯à§‡à¦° à¦¸à§à¦Ÿà¦• à¦ à¦¿à¦• à¦†à¦›à§‡")}</p>}{low.slice(0, 8).map(p => <div key={p.id} className="li"><span>{p.name} {p.size} {p.color}</span><b style={{ color: '#ef4444' }}>{p.stock}</b></div>)}</div>
   <div className="card"><h4>{__("à¦¸à¦¾à¦®à§à¦ªà§à¦°à¦¤à¦¿à¦• à¦¬à¦¿à¦•à§à¦°à¦¿")}</h4>{!d.sales.length && <p className="mut">{__("à¦¤à¦¥à§à¦¯ à¦¨à§‡à¦‡")}</p>}{d.sales.slice(0, 8).map(s => <div key={s.id} className="li"><span>{s.invoice}<br /><small className="mut">{new Date(s.created_at.replace(' ', 'T') + 'Z').toLocaleString('en-GB')} Â· {MN[s.method] || s.method}</small></span><b style={{ textDecoration: s.status === 'refunded' ? 'line-through' : 'none' }}>{tk(s.total)}</b></div>)}</div></div>
  <DemoData /></div>;
}
