const ExcelJS=require('exceljs'),crypto=require('crypto'),bcrypt=require('bcryptjs');
module.exports=({app,db,auth,wrap,parse,err,log,z})=>{
 const M=auth('admin','manager'),A=auth('admin'),r2=n=>Math.round(n*100)/100,TZ='+6 hours';
 db.exec(`create table if not exists coupons(id integer primary key,code text unique not null,type text not null,value real not null,min_total real default 0,expires text,max_uses integer default 0,used integer default 0,active integer default 1);
 create table if not exists gift_cards(id integer primary key,code text unique not null,balance real not null,initial real not null,created_at text default(datetime('now')));`);
 // Products (edit / soft delete)
 app.get('/api/products/manage',M,wrap(()=>db.prepare('select * from products where active=1 and (is_demo=0 or ?) order by name').all(app.locals.demoOn()?1:0)));
 app.delete('/api/products/:id',M,wrap(req=>{db.prepare('update products set active=0 where id=?').run(+req.params.id);log(req.user.id,'product_delete',{id:+req.params.id});return{ok:1}}));
 // Coupons
 const calc=(code,base)=>{const c=db.prepare('select * from coupons where code=? and active=1').get(String(code).toUpperCase());const today=db.prepare("select date('now',?) d").get(TZ).d;
  if(!c||(c.expires&&c.expires<today)||(c.max_uses&&c.used>=c.max_uses)||base<c.min_total)throw err(400,'This coupon is not valid');
  return{c,disc:r2(c.type==='percent'?base*c.value/100:Math.min(c.value,base))}};
 app.locals.coupon=(code,base)=>{const{c,disc}=calc(code,base);db.prepare('update coupons set used=used+1 where id=?').run(c.id);return disc};
 app.get('/api/coupons/check',auth(),wrap(req=>({discount:calc(req.query.code,+req.query.base||0).disc})));
 app.get('/api/coupons',M,wrap(()=>db.prepare('select * from coupons order by id desc').all()));
 app.post('/api/coupons',M,wrap(req=>{const d=parse(z.object({code:z.string().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/),type:z.enum(['percent','fixed']),value:z.number().positive(),min_total:z.number().min(0).default(0),expires:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),max_uses:z.number().int().min(0).default(0)}).refine(x=>x.type!=='percent'||x.value<=100),req.body);
  try{db.prepare('insert into coupons(code,type,value,min_total,expires,max_uses) values(?,?,?,?,?,?)').run(d.code.toUpperCase(),d.type,d.value,d.min_total,d.expires||null,d.max_uses);log(req.user.id,'coupon_create',d);return{ok:1}}catch{throw err(409,'This code already exists')}}));
 app.put('/api/coupons/:id/toggle',M,wrap(req=>{db.prepare('update coupons set active=1-active where id=?').run(+req.params.id);return{ok:1}}));
 // Gift cards
 app.post('/api/giftcards',M,wrap(req=>{const d=parse(z.object({amount:z.number().positive().max(1e6)}),req.body);const code='GC'+crypto.randomBytes(5).toString('hex').toUpperCase();
  db.prepare('insert into gift_cards(code,balance,initial) values(?,?,?)').run(code,d.amount,d.amount);log(req.user.id,'giftcard_issue',{code,amount:d.amount});return{code}}));
 app.get('/api/giftcards',M,wrap(()=>db.prepare('select * from gift_cards order by id desc limit 200').all()));
 app.get('/api/giftcards/:code',auth(),wrap(req=>{const g=db.prepare('select code,balance from gift_cards where code=?').get(req.params.code.toUpperCase());if(!g)throw err(404,'Not found');return g}));
 app.locals.gift=(code,total)=>{const g=db.prepare('select * from gift_cards where code=?').get(String(code).toUpperCase());if(!g||g.balance<=0)throw err(400,'This gift card is not valid');
  const use=Math.min(g.balance,total);db.prepare('update gift_cards set balance=balance-? where id=?').run(use,g.id);log(null,'giftcard_redeem',{code:g.code,use});return r2(use)};
 // Users
 app.get('/api/users',A,wrap(()=>db.prepare('select id,username,role,active from users order by id').all()));
 app.put('/api/users/:id',A,wrap(req=>{const id=+req.params.id;const d=parse(z.object({role:z.enum(['admin','manager','cashier']).optional(),active:z.boolean().optional(),password:z.string().min(8).max(100).optional()}),req.body);
  if(id===req.user.id&&(d.active===false||(d.role&&d.role!=='admin')))throw err(400,'You cannot deactivate or demote your own account');
  const u=db.prepare('select * from users where id=?').get(id);if(!u)throw err(404,'User not found');
  if(u.role==='admin'&&u.active&&(d.active===false||(d.role&&d.role!=='admin'))&&db.prepare("select count(*) c from users where role='admin' and active=1").get().c<=1)throw err(400,'You cannot remove the last active admin');
  if(d.role)db.prepare('update users set role=? where id=?').run(d.role,id);if(d.active!==undefined)db.prepare('update users set active=? where id=?').run(d.active?1:0,id);
  if(d.password)db.prepare('update users set pass_hash=? where id=?').run(bcrypt.hashSync(d.password,12),id);
  log(req.user.id,'user_update',{id,role:d.role,active:d.active,pw:!!d.password});return{ok:1}}));
 app.delete('/api/users/:id',A,wrap(req=>{const id=+req.params.id;if(id===req.user.id)throw err(400,'You cannot delete your own account');
  const u=db.prepare('select * from users where id=?').get(id);if(!u)throw err(404,'User not found');
  if(u.role==='admin'&&u.active&&db.prepare("select count(*) c from users where role='admin' and active=1").get().c<=1)throw err(400,'You cannot delete the last active admin');
  db.prepare('delete from users where id=?').run(id);log(req.user.id,'user_delete',{id,username:u.username});return{ok:1}}));
 // Reports by date + Excel export
 const rng=q=>({z:TZ,f:String(q.from||'1970-01-01'),t:String(q.to||'2999-12-31')});
 const W="s.status='completed' and date(s.created_at,@z) between @f and @t and (s.is_demo=0 or @d)";
 app.get('/api/reports/detail',M,wrap(req=>{const p={...rng(req.query),d:app.locals.demoOn()?1:0};
  const J='from sale_items si join sales s on s.id=si.sale_id join products pr on pr.id=si.product_id';
  return{byMethod:db.prepare(`select s.method,count(*) n,sum(s.total) total from sales s where ${W} group by s.method`).all(p),
   top:db.prepare(`select si.name,pr.size,pr.color,sum(si.qty) qty,sum(si.qty*si.price) revenue ${J} where ${W} group by si.product_id order by qty desc limit 20`).all(p),
   byCategory:db.prepare(`select coalesce(pr.category,'Uncategorized') category,sum(si.qty) qty,sum(si.qty*si.price) revenue ${J} where ${W} group by 1 order by revenue desc`).all(p),
   sales:db.prepare('select s.id,s.invoice,s.total,s.method,s.status,u.username cashier,s.created_at from sales s left join users u on u.id=s.user_id where date(s.created_at,@z) between @f and @t and (s.is_demo=0 or @d) order by s.id desc limit 500').all(p)}}));
 const EX={sales:["select invoice,date(created_at,@z) date,subtotal,discount,vat,total,method,status from sales where date(created_at,@z) between @f and @t and (is_demo=0 or @d) order by id",1],
  expenses:["select coalesce(exp_date,date(created_at)) date,category,title,amount from expenses where coalesce(exp_date,date(created_at)) between @f and @t and (is_demo=0 or @d) order by 1",2],
  products:["select name,sku,barcode,size,color,category,brand,price,cost,stock from products where active=1 and (is_demo=0 or @d) order by name",0]};
 app.get('/api/export/:type',M,async(req,res)=>{try{const e=EX[req.params.type];if(!e)return res.status(404).json({error:'Not found'});
  const q={...rng(req.query),d:app.locals.demoOn()?1:0};const args=e[1]===1?q:e[1]===2?{f:q.f,t:q.t,d:q.d}:{d:q.d};const rows=db.prepare(e[0]).all(args);
  const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet(req.params.type);const keys=rows.length?Object.keys(rows[0]):['empty'];
  ws.columns=keys.map(k=>({header:k,key:k,width:16}));ws.getRow(1).font={bold:true};rows.forEach(r=>ws.addRow(r));
  log(req.user.id,'export',{type:req.params.type});
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="${req.params.type}.xlsx"`);
  res.send(Buffer.from(await wb.xlsx.writeBuffer()))}catch(x){console.error(x);res.status(500).json({error:'Server error'})}});
};
