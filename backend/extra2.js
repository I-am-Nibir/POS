const ExcelJS=require('exceljs'),crypto=require('crypto'),bcrypt=require('bcryptjs');
module.exports=({app,db,auth,wrap,parse,err,log,z})=>{
 const M=auth('admin','manager'),A=auth('admin'),r2=n=>Math.round(n*100)/100,TZ='+6 hours';
 // Products (edit / soft delete)
 app.get('/api/products/manage',M,wrap(async ()=>await db.prepare('select * from products where active=1 and (is_demo=0 or ?=1) order by name').all(await app.locals.demoOn()?1:0)));
 app.delete('/api/products/:id',M,wrap(async req=>{await db.prepare('update products set active=0 where id=?').run(+req.params.id);await log(req.user.id,'product_delete',{id:+req.params.id});return{ok:1}}));
 // Coupons
 const calc=async (code,base)=>{const c=await db.prepare('select * from coupons where code=? and active=1').get(String(code).toUpperCase());const today=(await db.prepare("select (utc_now()+?::interval)::date d").get(TZ)).d;
  if(!c||(c.expires&&c.expires<today)||(c.max_uses&&c.used>=c.max_uses)||base<c.min_total)throw err(400,'This coupon is not valid');
  return{c,disc:r2(c.type==='percent'?base*c.value/100:Math.min(c.value,base))}};
 app.locals.coupon=async (code,base)=>{const{c,disc}=await calc(code,base);await db.prepare('update coupons set used=used+1 where id=?').run(c.id);return disc};
 app.get('/api/coupons/check',auth(),wrap(async req=>({discount:(await calc(req.query.code,+req.query.base||0)).disc})));
 app.get('/api/coupons',M,wrap(async ()=>await db.prepare('select * from coupons order by id desc').all()));
 app.post('/api/coupons',M,wrap(async req=>{const d=parse(z.object({code:z.string().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/),type:z.enum(['percent','fixed']),value:z.number().positive(),min_total:z.number().min(0).default(0),expires:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),max_uses:z.number().int().min(0).default(0)}).refine(x=>x.type!=='percent'||x.value<=100),req.body);
  try{await db.prepare('insert into coupons(code,type,value,min_total,expires,max_uses) values(?,?,?,?,?,?)').run(d.code.toUpperCase(),d.type,d.value,d.min_total,d.expires||null,d.max_uses);await log(req.user.id,'coupon_create',d);return{ok:1}}catch(e){if(e.code!=='23505')throw e;throw err(409,'This code already exists')}}));
 app.put('/api/coupons/:id/toggle',M,wrap(async req=>{await db.prepare('update coupons set active=1-active where id=?').run(+req.params.id);return{ok:1}}));
 // Gift cards
 app.post('/api/giftcards',M,wrap(async req=>{const d=parse(z.object({amount:z.number().positive().max(1e6)}),req.body);const code='GC'+crypto.randomBytes(5).toString('hex').toUpperCase();
  await db.prepare('insert into gift_cards(code,balance,initial) values(?,?,?)').run(code,d.amount,d.amount);await log(req.user.id,'giftcard_issue',{code,amount:d.amount});return{code}}));
 app.get('/api/giftcards',M,wrap(async ()=>await db.prepare('select * from gift_cards order by id desc limit 200').all()));
 app.get('/api/giftcards/:code',auth(),wrap(async req=>{const g=await db.prepare('select code,balance from gift_cards where code=?').get(req.params.code.toUpperCase());if(!g)throw err(404,'Not found');return g}));
 app.locals.gift=async (code,total)=>{const g=await db.prepare('select * from gift_cards where code=?').get(String(code).toUpperCase());if(!g||g.balance<=0)throw err(400,'This gift card is not valid');
  const use=Math.min(g.balance,total);await db.prepare('update gift_cards set balance=balance-? where id=?').run(use,g.id);await log(null,'giftcard_redeem',{code:g.code,use});return r2(use)};
 // Users
 app.get('/api/users',A,wrap(async ()=>await db.prepare('select id,username,role,active from users order by id').all()));
 app.put('/api/users/:id',A,wrap(async req=>{return db.transaction(async()=>{const id=+req.params.id;const d=parse(z.object({role:z.enum(['admin','manager','cashier']).optional(),active:z.boolean().optional(),password:z.string().min(8).max(100).optional()}),req.body);
  if(id===req.user.id&&(d.active===false||(d.role&&d.role!=='admin')))throw err(400,'You cannot deactivate or demote your own account');
  const u=await db.prepare('select * from users where id=?').get(id);if(!u)throw err(404,'User not found');
  if(u.role==='admin'&&u.active&&(d.active===false||(d.role&&d.role!=='admin'))&&(await db.prepare("select count(*) c from users where role='admin' and active=1").get()).c<=1)throw err(400,'You cannot remove the last active admin');
  if(d.role)await db.prepare('update users set role=? where id=?').run(d.role,id);if(d.active!==undefined)await db.prepare('update users set active=? where id=?').run(d.active?1:0,id);
  if(d.password)await db.prepare('update users set pass_hash=? where id=?').run(bcrypt.hashSync(d.password,12),id);
  await log(req.user.id,'user_update',{id,role:d.role,active:d.active,pw:!!d.password});return{ok:1}})()}));
 app.delete('/api/users/:id',A,wrap(async req=>{return db.transaction(async()=>{const id=+req.params.id;if(id===req.user.id)throw err(400,'You cannot delete your own account');
  const u=await db.prepare('select * from users where id=?').get(id);if(!u)throw err(404,'User not found');
  if(u.role==='admin'&&u.active&&(await db.prepare("select count(*) c from users where role='admin' and active=1").get()).c<=1)throw err(400,'You cannot delete the last active admin');
  await db.prepare('delete from users where id=?').run(id);await log(req.user.id,'user_delete',{id,username:u.username});return{ok:1}})()}));
 // Reports by date + Excel export
 const rng=q=>({z:TZ,f:String(q.from||'1970-01-01'),t:String(q.to||'2999-12-31')});
 const W="s.status='completed' and (s.created_at+@z::interval)::date between @f and @t and (s.is_demo=0 or @d=1)";
 app.get('/api/sales/by-invoice/:invoice/receipt',M,wrap(async req=>{return db.snapshot(async()=>{const invoice=String(req.params.invoice||'').trim();if(!invoice||invoice.length>80)throw err(400,'Invalid invoice number');const sale=await db.prepare('select s.*,u.username cashier from sales s left join users u on u.id=s.user_id where upper(s.invoice)=upper(?) and (s.is_demo=0 or ?=1)').get(invoice,await app.locals.demoOn()?1:0);if(!sale)throw err(404,'Invoice not found');const lines=(await db.prepare('select si.product_id,si.name,si.qty,si.price,si.vat,pr.sku from sale_items si left join products pr on pr.id=si.product_id where si.sale_id=? order by si.id').all(sale.id)).map(x=>({p:{id:x.product_id,name:x.name,sku:x.sku||String(x.product_id),price:x.price},qty:x.qty,vat:x.vat}));return {sale,lines};})()}));
 app.get('/api/sales/:id/receipt',M,wrap(async req=>{return db.snapshot(async()=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)throw err(400,'Invalid sale ID');
  const sale=await db.prepare('select s.*,u.username cashier from sales s left join users u on u.id=s.user_id where s.id=? and (s.is_demo=0 or ?=1)').get(id,await app.locals.demoOn()?1:0);
  if(!sale)throw err(404,'Sale not found');
  const lines=(await db.prepare('select si.product_id,si.name,si.qty,si.price,si.vat,pr.sku from sale_items si left join products pr on pr.id=si.product_id where si.sale_id=? order by si.id').all(id)).map(x=>({p:{id:x.product_id,name:x.name,sku:x.sku||String(x.product_id),price:x.price},qty:x.qty,vat:x.vat}));
  return {sale,lines};
 })()}));
 app.get('/api/reports/detail',M,wrap(async req=>{return db.snapshot(async()=>{const p={...rng(req.query),d:await app.locals.demoOn()?1:0};
  const J='from sale_items si join sales s on s.id=si.sale_id join products pr on pr.id=si.product_id';
  return{byMethod:await db.prepare(`select s.method,count(*) n,sum(s.total) total from sales s where ${W} group by s.method order by s.method`).all(p),
   top:await db.prepare(`select min(si.name) as name,pr.size,pr.color,sum(si.qty) qty,sum(si.qty*si.price) revenue ${J} where ${W} group by si.product_id,pr.size,pr.color order by qty desc,si.product_id limit 20`).all(p),
   byCategory:await db.prepare(`select coalesce(pr.category,'Uncategorized') category,sum(si.qty) qty,sum(si.qty*si.price) revenue ${J} where ${W} group by 1 order by revenue desc,1`).all(p),
   sales:await db.prepare('select s.id,s.invoice,s.total,s.method,s.status,u.username cashier,s.created_at from sales s left join users u on u.id=s.user_id where (s.created_at+@z::interval)::date between @f and @t and (s.is_demo=0 or @d=1) order by s.id desc limit 500').all(p)}})()}));
 const EX={sales:["select invoice,(created_at+@z::interval)::date date,subtotal,discount,vat,total,method,status from sales where (created_at+@z::interval)::date between @f and @t and (is_demo=0 or @d=1) order by id",1],
  expenses:["select coalesce(exp_date,created_at::date) date,category,title,amount from expenses where coalesce(exp_date,created_at::date) between @f and @t and (is_demo=0 or @d=1) order by 1",2],
  products:["select name,sku,barcode,size,color,category,brand,price,cost,stock from products where active=1 and (is_demo=0 or @d=1) order by name",0]};
 app.get('/api/export/:type',M,async(req,res)=>{try{const e=EX[req.params.type];if(!e)return res.status(404).json({error:'Not found'});
  const q={...rng(req.query),d:await app.locals.demoOn()?1:0};const args=e[1]===1?q:e[1]===2?{f:q.f,t:q.t,d:q.d}:{d:q.d};const rows=await db.prepare(e[0]).all(args);
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet(req.params.type);const keys=rows.length?Object.keys(rows[0]):['empty'];
  ws.columns=keys.map(k=>({header:k,key:k,width:16}));ws.getRow(1).font={bold:true};rows.forEach(r=>ws.addRow(r));
  await log(req.user.id,'export',{type:req.params.type});
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="${req.params.type}.xlsx"`);
  res.send(Buffer.from(await wb.xlsx.writeBuffer()))}catch(x){console.error(x);res.status(500).json({error:'Server error'})}});
};
