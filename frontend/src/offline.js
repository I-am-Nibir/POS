import {api} from './App.jsx';
export const isNet=e=>!navigator.onLine||e instanceof TypeError||e instanceof SyntaxError;
const j=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
export const cacheGet=k=>j('c:'+k,[]);export const cacheSet=(k,v)=>{try{localStorage.setItem('c:'+k,JSON.stringify(v))}catch{}};
export const qget=()=>j('queue',[]);export const qadd=s=>localStorage.setItem('queue',JSON.stringify([...qget(),s]));
const qdel=k=>localStorage.setItem('queue',JSON.stringify(qget().filter(x=>x.key!==k)));
let running=false;
export async function syncQueue(){if(running)return{done:0,failed:[]};running=true;let done=0;const failed=[];
 try{for(const s of qget()){try{await api('/sales',{method:'POST',body:s});done++;qdel(s.key)}
  catch(e){if(isNet(e))break;failed.push({err:e.message});localStorage.setItem('failed',JSON.stringify([...j('failed',[]),{...s,err:e.message}]));qdel(s.key)}}}
 finally{running=false}return{done,failed}}
