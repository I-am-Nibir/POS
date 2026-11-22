module.exports=({app,db,auth,wrap,parse,err,log,z})=>{
 for(const c of ['size','color','category','brand'])try{db.exec(`alter table products add column ${c} text`)}catch{}
 try{db.exec('alter table sales add column customer_id integer')}catch{}
 db.exec(`create table if not exists customers(id integer primary key,name text not null,phone text unique,due real default 0,points integer default 0);
 create table if not exists suppliers(id integer primary key,name text not null,phone text,due real default 0);
 create table if not exists purchases(id integer primary key,supplier_id integer,total real,paid real,user_id integer,created_at text default(datetime('now')));
 create table if not exists purchase_items(id integer primary key,purchase_id integer,product_id integer,qty integer,cost real);
 create table if not exists expenses(id integer primary key,title text,amount real,user_id integer,created_at text default(datetime('now')));
 create table if not exists return_items(id integer primary key,sale_id integer,product_id integer,qty integer,amount real,created_at text default(datetime('now')));`);
 const M=auth('admin','manager'),r2=n=>Math.round(n*100)/100;
 // Customers
 app.get('/api/customers',auth(),wrap(()=>db.prepare('select * from customers order by name').all()));
 app.post('/api/customers',auth(),wrap(req=>{const d=parse(z.object({name:z.string().min(1).max(100),phone:z.string().max(20).optional()}),req.body);
  try{const r=db.prepare('insert into customers(name,phone) values(?,?)').run(d.name,d.phone||null);log(req.user.id,'customer_create',d);return{id:r.lastInsertRowid}}catch{throw err(409,'Phone ache')}}));
 app.post('/api/customers/:id/pay',auth(),wrap(req=>{const d=parse(z.object({amount:z.number().positive()}),req.body);
  const c=db.prepare('select * from customers where id=?').get(+req.params.id);if(!c)throw err(404,'Customer nei');if(d.amount>c.due)throw err(400,'Baki-r cheye beshi');
  db.prepare('update customers set due=due-? where id=?').run(d.amount,c.id);log(req.user.id,'due_payment',{id:c.id,...d});return{ok:1}}));
 // Suppliers + purchases (GRN)
 app.get('/api/suppliers',M,wrap(()=>db.prepare('select * from suppliers order by name').all()));
 app.post('/api/suppliers',M,wrap(req=>{const d=parse(z.object({name:z.string().min(1).max(100),phone:z.string().max(20).optional()}),req.body);
  return{id:db.prepare('insert into suppliers(name,phone) values(?,?)').run(d.name,d.phone||null).lastInsertRowid}}));
 app.post('/api/purchases',M,wrap(req=>{const d=parse(z.object({supplierId:z.number().int(),paid:z.number().min(0),items:z.array(z.object({id:z.number().int(),qty:z.number().int().positive(),cost:z.number().min(0)})).min(1)}),req.body);
  return db.transaction(()=>{const total=r2(d.items.reduce((a,i)=>a+i.qty*i.cost,0));if(d.paid>total)throw err(400,'Paid beshi');
   if(!db.prepare('select 1 from suppliers where id=?').get(d.supplierId))throw err(404,'Supplier nei');
   const p=db.prepare('insert into purchases(supplier_id,total,paid,user_id) values(?,?,?,?)').run(d.supplierId,total,d.paid,req.user.id).lastInsertRowid;
   for(const i of d.items){if(!db.prepare('select 1 from products where id=?').get(i.id))throw err(400,'Product nei');
    db.prepare('insert into purchase_items(purchase_id,product_id,qty,cost) values(?,?,?,?)').run(p,i.id,i.qty,i.cost);
    db.prepare('update products set stock=stock+?,cost=? where id=?').run(i.qty,i.cost,i.id)}
   db.prepare('update suppliers set due=due+? where id=?').run(r2(total-d.paid),d.supplierId);log(req.user.id,'purchase',{p,total});return{id:p,total}})()}));
 app.post('/api/suppliers/:id/pay',M,wrap(req=>{const d=parse(z.object({amount:z.number().positive()}),req.body);
  const s=db.prepare('select * from suppliers where id=?').get(+req.params.id);if(!s||d.amount>s.due)throw err(400,'Vul poriman');
  db.prepare('update suppliers set due=due-? where id=?').run(d.amount,s.id);log(req.user.id,'supplier_payment',{id:s.id,...d});return{ok:1}}));
 // Size x Color matrix
 app.post('/api/products/matrix',M,wrap(req=>{const d=parse(z.object({name:z.string().min(1).max(100),baseSku:z.string().min(1).max(30),price:z.number().min(0),cost:z.number().min(0).default(0),
  sizes:z.array(z.string().min(1).max(10)).min(1).max(20),colors:z.array(z.string().min(1).max(20)).min(1).max(20),stock:z.number().int().min(0).default(0),vat_rate:z.number().min(0).max(100).default(0),category:z.string().max(40).optional(),brand:z.string().max(40).optional()}),req.body);
  return db.transaction(()=>{let n=0;for(const s of d.sizes)for(const c of d.colors){
   try{db.prepare('insert into products(name,sku,barcode,price,cost,stock,vat_rate,size,color,category,brand) values(?,?,?,?,?,?,?,?,?,?,?)').run(d.name,`${d.baseSku}-${s}-${c}`.toUpperCase(),`${d.baseSku}-${s}-${c}`.toUpperCase(),d.price,d.cost,d.stock,d.vat_rate,s,c,d.category||null,d.brand||null);n++}catch{throw err(409,'SKU duplicate')}}
   log(req.user.id,'matrix_create',{name:d.name,n});return{created:n}})()}));
 // Stock adjust (damage / audit count)
 app.post('/api/products/:id/adjust',M,wrap(req=>{const d=parse(z.object({delta:z.number().int(),reason:z.string().min(3).max(100)}),req.body);
  const p=db.prepare('select stock from products where id=?').get(+req.params.id);if(!p||p.stock+d.delta<0)throw err(400,'Vul adjust');
  db.prepare('update products set stock=stock+? where id=?').run(d.delta,+req.params.id);log(req.user.id,'stock_adjust',{id:+req.params.id,...d});return{ok:1}}));
 // Partial return (exchange = return + new sale)
 app.post('/api/sales/:id/return',M,wrap(req=>{const d=parse(z.object({items:z.array(z.object({id:z.number().int(),qty:z.number().int().positive()})).min(1)}),req.body);
  return db.transaction(()=>{const s=db.prepare('select * from sales where id=?').get(+req.params.id);if(!s||s.status!=='completed')throw err(404,'Sale paoa jayni');let amt=0;
   for(const i of d.items){const si=db.prepare('select * from sale_items where sale_id=? and product_id=?').get(s.id,i.id);if(!si)throw err(400,'Item nei');
    const done=db.prepare('select coalesce(sum(qty),0) q from return_items where sale_id=? and product_id=?').get(s.id,i.id).q;if(done+i.qty>si.qty)throw err(409,'Beshi return');
    const a=r2((si.price*i.qty+si.vat/si.qty*i.qty)*(s.subtotal?1-s.discount/s.subtotal:1));amt+=a;
    db.prepare('insert into return_items(sale_id,product_id,qty,amount) values(?,?,?,?)').run(s.id,i.id,i.qty,a);db.prepare('update products set stock=stock+? where id=?').run(i.qty,i.id)}
   log(req.user.id,'partial_return',{sale:s.id,amt:r2(amt)});return{refund:r2(amt)}})()}));

 // Expenses (category + date) and daily/monthly profit series
 try{db.exec('alter table expenses add column category text')}catch{}
 try{db.exec('alter table expenses add column exp_date text')}catch{}
 const TZ=/^[+-]\d{1,2} hours$/.test(process.env.TZ_OFFSET||'')?process.env.TZ_OFFSET:'+6 hours';
 const today=()=>db.prepare("select date('now',?) d").get(TZ).d;
 app.post('/api/expenses',M,wrap(req=>{const d=parse(z.object({title:z.string().min(1).max(100),amount:z.number().positive(),category:z.string().max(40).default('Other'),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}),req.body);
  db.prepare('insert into expenses(title,amount,user_id,category,exp_date) values(?,?,?,?,?)').run(d.title,d.amount,req.user.id,d.category,d.date||today());log(req.user.id,'expense',d);return{ok:1}}));
 app.get('/api/expenses',M,wrap(req=>db.prepare('select id,title,amount,category,coalesce(exp_date,date(created_at)) date from expenses where coalesce(exp_date,date(created_at)) between ? and ? order by date desc,id desc limit 500').all(String(req.query.from||'1970-01-01'),String(req.query.to||'2999-12-31'))));
 app.delete('/api/expenses/:id',auth('admin'),wrap(req=>{const e=db.prepare('select * from expenses where id=?').get(+req.params.id);if(!e)throw err(404,'Nei');
  db.prepare('delete from expenses where id=?').run(e.id);log(req.user.id,'expense_delete',e);return{ok:1}}));
 app.get('/api/reports/series',M,wrap(req=>{const f=String(req.query.from||'1970-01-01'),t=String(req.query.to||'2999-12-31'),fmt=req.query.group==='month'?'%Y-%m':'%Y-%m-%d';
  const R={},add=(rows,k)=>rows.forEach(x=>{R[x.p]=R[x.p]||{period:x.p,revenue:0,returns:0,cogs:0,expenses:0};R[x.p][k]=r2(x.v)});
  add(db.prepare(`select strftime('${fmt}',created_at,@z) p,sum(total) v from sales where status='completed' and date(created_at,@z) between @f and @t group by p`).all({z:TZ,f,t}),'revenue');
  add(db.prepare(`select strftime('${fmt}',created_at,@z) p,sum(amount) v from return_items where date(created_at,@z) between @f and @t group by p`).all({z:TZ,f,t}),'returns');
  add(db.prepare(`select strftime('${fmt}',s.created_at,@z) p,sum(si.qty*pr.cost) v from sale_items si join sales s on s.id=si.sale_id join products pr on pr.id=si.product_id where s.status='completed' and date(s.created_at,@z) between @f and @t group by p`).all({z:TZ,f,t}),'cogs');
  add(db.prepare(`select strftime('${fmt}',coalesce(exp_date,date(created_at))) p,sum(amount) v from expenses where coalesce(exp_date,date(created_at)) between @f and @t group by p`).all({f,t}),'expenses');
  return Object.values(R).sort((a,b)=>a.period<b.period?-1:1).map(x=>({...x,profit:r2(x.revenue-x.returns-x.cogs-x.expenses)}))}));
};
