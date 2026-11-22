import {api} from './App.jsx';
let port=null;const enc=new TextEncoder();
export const serialReady=()=>!!port;
export async function connectSerial(p){port=p||await navigator.serial.requestPort();await port.open({baudRate:9600})}
export async function loadCfg(){try{const c=await api('/printer');localStorage.setItem('c:cfg',JSON.stringify(c));return c}catch{return JSON.parse(localStorage.getItem('c:cfg')||'null')}}
export async function printBytes(b,cfg){
 if(port){const w=port.writable.getWriter();try{await w.write(b)}finally{w.releaseLock()}return}
 if(cfg?.network){await api('/print/raw',{method:'POST',body:{data:btoa(String.fromCharCode(...b))}});return}
 throw new Error('no printer')}
const asc=s=>String(s??'').replace(/[^\x20-\x7E]/g,'').replace(/\s+/g,' ').trim();
const pad=(l,r,w)=>String(l).slice(0,Math.max(0,w-String(r).length-1)).padEnd(w-String(r).length)+r;
export function build(cfg,L,drawer){const w=cfg?.cols||42,sh=cfg?.shop||{name:'SHOP'},ln='-'.repeat(w),m=x=>Number(x).toFixed(2),o=[];
 const t=s=>o.push(...enc.encode(s+'\n')),c=(...a)=>o.push(...a);
 c(0x1b,0x40);if(drawer)c(0x1b,0x70,0,25,250);
 c(0x1b,0x61,1,0x1b,0x45,1,0x1d,0x21,0x11);t(asc(sh.name)||'SHOP');c(0x1d,0x21,0,0x1b,0x45,0);if(sh.addr)t(asc(sh.addr));if(sh.phone)t('Tel: '+asc(sh.phone));
 c(0x1b,0x61,0);t(ln);t('Inv: '+L.r.invoice);t(new Date().toLocaleString('en-GB'));t(ln);
 for(const l of L.lines){t((asc(`${l.p.name} ${l.p.size||''} ${l.p.color||''}`)||l.p.sku).slice(0,w));t(pad(`  ${l.qty} x ${l.p.price}`,m(l.p.price*l.qty),w))}
 t(ln);t(pad('Subtotal',m(L.lines.reduce((a,l)=>a+l.p.price*l.qty,0)),w));if(L.disc>0)t(pad('Discount','-'+m(L.disc),w));t(pad('VAT',m(L.vat),w));
 c(0x1b,0x45,1);t(pad('TOTAL',m(L.total),w));c(0x1b,0x45,0);t(pad('Paid ('+L.method+')',m(L.paid),w));
 if(L.r.change>0)t(pad('Change',m(L.r.change),w));if(L.r.due>0)t(pad('DUE',m(L.r.due),w));
 c(0x1b,0x61,1);t(ln);if(L.off)t('(offline sale)');t('Thank you! Visit again');t('\n\n\n');c(0x1d,0x56,0x42,0);
 return Uint8Array.from(o)}
