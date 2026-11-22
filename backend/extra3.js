const net=require('net');
module.exports=({app,auth,wrap,parse,err,z})=>{
 app.get('/api/printer',auth(),wrap(()=>({network:!!process.env.PRINTER_HOST,cols:+process.env.PRINTER_COLS||42,
  shop:{name:process.env.SHOP_NAME||'My Shop',addr:process.env.SHOP_ADDR||'',phone:process.env.SHOP_PHONE||''}})));
 // ESC/POS bytes (built in the browser) are relayed to a LAN thermal printer (host/port fixed by env, never by client)
 app.post('/api/print/raw',auth(),(req,res)=>{try{const d=parse(z.object({data:z.string().max(16000).regex(/^[A-Za-z0-9+/=]+$/)}),req.body);
  if(!process.env.PRINTER_HOST)return res.status(501).json({error:'Server printer set kora nei'});
  let fail=false;const s=net.connect({host:process.env.PRINTER_HOST,port:+process.env.PRINTER_PORT||9100,timeout:4000},()=>s.end(Buffer.from(d.data,'base64')));
  s.on('error',()=>{fail=true});s.on('timeout',()=>{fail=true;s.destroy()});
  s.on('close',()=>res.status(fail?502:200).json(fail?{error:'Printer-e connect hoyni'}:{ok:1}))}
  catch(e){res.status(e.status||500).json({error:e.status?e.message:'Server error'})}});
};
