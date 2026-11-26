const express=require('express'),helmet=require('helmet'),rateLimit=require('express-rate-limit'),
bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),Database=require('better-sqlite3'),
{z}=require('zod'),path=require('path'),fs=require('fs'),crypto=require('crypto');
const SECRET=process.env.JWT_SECRET||crypto.randomBytes(32).toString('hex');
if(!process.env.JWT_SECRET)console.warn('WARN: JWT_SECRET is not set. All sessions will be invalidated on every restart.');
const db=new Database(process.env.DB_FILE||'pos.db');db.pragma('journal_mode=WAL');db.pragma('foreign_keys=ON');
db.exec(`
create table if not exists users(id integer primary key,username text unique not null,pass_hash text not null,role text not null check(role in('admin','manager','cashier')),active integer default 1);
create table if not exists products(id integer primary key,name text not null,sku text unique not null,barcode text,price real not null,cost real default 0,stock integer default 0,low_stock integer default 5,vat_rate real default 0,active integer default 1);
create table if not exists sales(id integer primary key,invoice text unique,user_id integer,subtotal real,discount real,vat real,total real,paid real,method text,customer text,status text default 'completed',idem_key text unique,created_at text default(datetime('now')));
create table if not exists sale_items(id integer primary key,sale_id integer,product_id integer,name text,qty integer,price real,vat real);
create table if not exists shifts(id integer primary key,user_id integer,opening real,closing real,opened_at text default(datetime('now')),closed_at text);
create table if not exists audit(id integer primary key,user_id integer,action text,detail text,at text default(datetime('now')));
create table if not exists app_settings(key text primary key,value text not null);`);
const log=(u,a,d)=>db.prepare('insert into audit(user_id,action,detail) values(?,?,?)').run(u,a,JSON.stringify(d||{}));

const app=express();app.set('trust proxy',1);app.get('/healthz',(q,r)=>r.json({ok:1}));app.use(helmet({contentSecurityPolicy:{useDefaults:true,directives:{'upgrade-insecure-requests':process.env.HTTPS==='1'?[]:null}}}));app.use(express.json({limit:'100kb'}));
const err=(s,m)=>Object.assign(new Error(m),{status:s});
const auth=(...roles)=>(req,res,next)=>{try{const t=(req.headers.authorization||'').replace('Bearer ','');
 const p=jwt.verify(t,SECRET);const u=db.prepare('select id,username,role from users where id=? and active=1').get(p.id);
 if(!u)throw 0;if(roles.length&&!roles.includes(u.role))return res.status(403).json({error:'You do not have permission to do this'});req.user=u;next();}
 catch{res.status(401).json({error:'Please sign in'})}};
const wrap=f=>(req,res)=>{try{res.json(f(req,res))}catch(e){res.status(e.status||500).json({error:e.status?e.message:'Server error'});if(!e.status)console.error(e)}};
const parse=(sch,b)=>{const r=sch.safeParse(b);if(!r.success)throw err(400,'Invalid input');return r.data};

app.post('/api/login',rateLimit({windowMs:15*60e3,max:10,standardHeaders:true}),wrap(req=>{
 const d=parse(z.object({username:z.string().max(50),password:z.string().max(100)}),req.body);
 const u=db.prepare('select * from users where username=? and active=1').get(d.username);
 const ok=bcrypt.compareSync(d.password,u?u.pass_hash:'$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
 if(!u||!ok){log(null,'login_fail',{u:d.username});throw err(401,'Invalid username or password')}
 log(u.id,'login');return{token:jwt.sign({id:u.id},SECRET,{expiresIn:'8h'}),user:{id:u.id,username:u.username,role:u.role}}}));

const receiptDefaults={paper:'80',printMode:'manual',name:'Dokan POS',address:'',phone:'',email:'',website:'',logo:'',thankYou:'Thank you for your purchase!',footer:'',showLogo:true,showName:true,showAddress:true,showPhone:true,showEmail:true,showWebsite:false,showCustomer:true,showCashier:true,showProductId:false,showTax:true,showDiscount:true,showPayment:true,showBarcode:false,showThankYou:true,showFooter:true};
const getReceiptSettings=()=>{const row=db.prepare("select value from app_settings where key='receipt'").get();try{return {...receiptDefaults,...(row?JSON.parse(row.value):{})}}catch{return receiptDefaults}};
app.get('/api/receipt-settings',auth(),wrap(()=>getReceiptSettings()));
app.put('/api/receipt-settings',auth('admin'),wrap(req=>{const d={};for(const k of Object.keys(receiptDefaults)){if(req.body[k]!==undefined)d[k]=req.body[k]}if(!['58','80'].includes(String(d.paper??'80')))throw err(400,'Invalid receipt width');if(!['auto','manual'].includes(d.printMode??'manual'))throw err(400,'Invalid print mode');if(typeof d.logo==='string'&&d.logo.length>500000)throw err(400,'Logo is too large');const next={...getReceiptSettings(),...d};db.prepare("insert into app_settings(key,value) values('receipt',?) on conflict(key) do update set value=excluded.value").run(JSON.stringify(next));log(req.user.id,'receipt_settings_update');return next}));
const same=(a,b)=>a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
app.get('/api/setup/status',wrap(()=>({needed:!db.prepare('select 1 from users').get(),keyRequired:!!process.env.SETUP_KEY})));
app.post('/api/setup',rateLimit({windowMs:15*60e3,max:10,standardHeaders:true}),wrap(req=>{
 const d=parse(z.object({username:z.string().trim().min(3).max(50),password:z.string().min(8).max(100),key:z.string().max(100).optional()}),req.body);
 if(process.env.SETUP_KEY&&!same(d.key||'',process.env.SETUP_KEY))throw err(403,'Invalid setup key');
 return db.transaction(()=>{if(db.prepare('select 1 from users').get())throw err(409,'Setup has already been completed');
  const id=db.prepare('insert into users(username,pass_hash,role) values(?,?,?)').run(d.username,bcrypt.hashSync(d.password,12),'admin').lastInsertRowid;
  log(id,'setup',{u:d.username});return{token:jwt.sign({id},SECRET,{expiresIn:'8h'}),user:{id,username:d.username,role:'admin'}}})()}));
app.get('/api/products',auth(),wrap(()=>db.prepare('select id,name,sku,barcode,price,stock,low_stock,vat_rate,size,color,category,brand from products where active=1 and (is_demo=0 or ?) order by name').all(app.locals.demoOn()?1:0)));
const P=z.object({name:z.string().min(1).max(120),sku:z.string().min(1).max(40),barcode:z.string().max(40).optional(),price:z.number().min(0),cost:z.number().min(0).default(0),stock:z.number().int().min(0).default(0),low_stock:z.number().int().min(0).default(5),vat_rate:z.number().min(0).max(100).default(0),size:z.string().max(20).optional(),color:z.string().max(20).optional(),category:z.string().max(40).optional(),brand:z.string().max(40).optional()});
app.post('/api/products',auth('admin','manager'),wrap(req=>{const d=parse(P,req.body);
 try{const r=db.prepare('insert into products(name,sku,barcode,price,cost,stock,low_stock,vat_rate,size,color,category,brand) values(@name,@sku,@barcode,@price,@cost,@stock,@low_stock,@vat_rate,@size,@color,@category,@brand)').run({barcode:null,size:null,color:null,category:null,brand:null,...d});
 log(req.user.id,'product_create',d);return{id:r.lastInsertRowid}}catch(e){throw err(409,'This SKU already exists')}}));
app.put('/api/products/:id',auth('admin','manager'),wrap(req=>{const d=parse(P,req.body);
 db.prepare('update products set name=@name,sku=@sku,barcode=@barcode,price=@price,cost=@cost,stock=@stock,low_stock=@low_stock,vat_rate=@vat_rate,size=@size,color=@color,category=@category,brand=@brand where id=@id').run({barcode:null,size:null,color:null,category:null,brand:null,...d,id:+req.params.id});
 log(req.user.id,'product_update',{id:req.params.id,...d});return{ok:1}}));

const r2=n=>Math.round(n*100)/100;
app.post('/api/sales',auth(),wrap(req=>{
 const d=parse(z.object({items:z.array(z.object({id:z.number().int(),qty:z.number().int().positive().max(10000)})).min(1).max(200),discount:z.number().min(0).default(0),method:z.enum(['cash','card','bkash','nagad','due']),customerId:z.number().int().optional(),at:z.string().datetime().optional(),coupon:z.string().max(30).optional(),gift:z.string().max(30).optional(),paid:z.number().min(0),customer:z.string().max(100).optional(),key:z.string().min(8).max(64)}),req.body);
 const dup=db.prepare('select id,invoice from sales where idem_key=?').get(d.key);if(dup)return{...dup,duplicate:true};
 return db.transaction(()=>{let sub=0,vat=0;const lines=[];
  for(const it of d.items){const p=db.prepare('select * from products where id=? and active=1 and (is_demo=0 or ?)').get(it.id,app.locals.demoOn()?1:0);
   if(!p)throw err(400,'Product not found');if(p.stock<it.qty&&!d.at)throw err(409,`Not enough stock: ${p.name}`);
   const line=p.price*it.qty;sub+=line;lines.push({p,qty:it.qty,vat:line*p.vat_rate/100});}
  if(d.discount>sub)throw err(400,'Discount is more than the subtotal');
  if(d.coupon)d.discount=r2(d.discount+app.locals.coupon(d.coupon,sub-d.discount));
  if(d.discount>sub)throw err(400,'Combined discount is more than the subtotal');
  if(req.user.role==='cashier'&&d.discount>sub*0.1+0.000001)throw err(403,'Cashier discount cannot exceed 10%');const f=sub?(sub-d.discount)/sub:0;lines.forEach(l=>{l.vat=r2(l.vat*f);vat+=l.vat});
  const total=r2(sub-d.discount+vat);const gift=d.gift?app.locals.gift(d.gift,total):0;if(d.method==='due'){if(!d.customerId)throw err(400,'Select a customer for a due sale')}else if(d.paid+gift<total)throw err(400,'Amount received is less than the total');
  const paidNow=Math.min(d.paid+gift,total);
  const inv='INV-'+Date.now().toString(36).toUpperCase()+crypto.randomInt(100,999);
  const s=db.prepare('insert into sales(invoice,user_id,subtotal,discount,vat,total,paid,method,customer,idem_key) values(?,?,?,?,?,?,?,?,?,?)').run(inv,req.user.id,r2(sub),d.discount,r2(vat),total,d.paid,d.method,d.customer||null,d.key);
  for(const l of lines){db.prepare('insert into sale_items(sale_id,product_id,name,qty,price,vat) values(?,?,?,?,?,?)').run(s.lastInsertRowid,l.p.id,l.p.name,l.qty,l.p.price,l.vat);
   db.prepare('update products set stock=stock-? where id=?').run(l.qty,l.p.id);}
  if(d.customerId){if(!db.prepare('select 1 from customers where id=? and (is_demo=0 or ?)').get(d.customerId,app.locals.demoOn()?1:0))throw err(400,'Customer not found');
  db.prepare('update customers set due=due+?,points=points+? where id=?').run(r2(total-paidNow),Math.floor(total/100),d.customerId);db.prepare('update sales set customer_id=? where id=?').run(d.customerId,s.lastInsertRowid)}
  if(d.at){const t=Date.parse(d.at),n=Date.now();if(!(t<=n+6e4&&t>n-7*864e5))throw err(400,'Invalid offline sale time');db.prepare('update sales set created_at=? where id=?').run(new Date(t).toISOString().slice(0,19).replace('T',' '),s.lastInsertRowid)}
  log(req.user.id,d.at?'sale_offline':'sale',{inv,total});return{id:s.lastInsertRowid,invoice:inv,total,change:Math.max(0,r2(d.paid+gift-total)),gift,due:r2(total-paidNow)}})();}));

app.post('/api/sales/:id/refund',auth('admin','manager'),wrap(req=>{const id=+req.params.id;
 return db.transaction(()=>{const s=db.prepare('select * from sales where id=?').get(id);
  if(!s)throw err(404,'Sale not found');if(s.status!=='completed')throw err(409,'This sale has already been refunded');
  for(const i of db.prepare('select * from sale_items where sale_id=?').all(id))db.prepare('update products set stock=stock+? where id=?').run(i.qty,i.product_id);
  db.prepare("update sales set status='refunded' where id=?").run(id);log(req.user.id,'refund',{id,total:s.total});return{ok:1}})()}));

app.get('/api/sales',auth('admin','manager'),wrap(()=>db.prepare('select id,invoice,total,method,status,created_at from sales where (is_demo=0 or ?) order by id desc limit 100').all(app.locals.demoOn()?1:0)));
app.get('/api/reports/daily',auth('admin','manager'),wrap(()=>{const d=app.locals.demoOn()?1:0;return{
 summary:db.prepare("select count(*) orders,coalesce(sum(total),0) revenue,coalesce(sum(vat),0) vat from sales where status='completed' and (is_demo=0 or ?) and date(created_at)=date('now')").get(d),
 top:db.prepare("select si.name,sum(si.qty) qty from sale_items si join sales s on s.id=si.sale_id where s.status='completed' and (s.is_demo=0 or ?) and date(s.created_at)=date('now') group by si.name order by qty desc limit 5").all(d),
 lowStock:db.prepare('select name,stock from products where stock<=low_stock and active=1 and (is_demo=0 or ?)').all(d)}}));

app.post('/api/shifts/open',auth(),wrap(req=>{if(db.prepare('select 1 from shifts where user_id=? and closed_at is null').get(req.user.id))throw err(409,'A shift is already open');
 const d=parse(z.object({opening:z.number().min(0)}),req.body);db.prepare('insert into shifts(user_id,opening) values(?,?)').run(req.user.id,d.opening);return{ok:1}}));
app.post('/api/shifts/close',auth(),wrap(req=>{const d=parse(z.object({closing:z.number().min(0)}),req.body);
 const s=db.prepare('select * from shifts where user_id=? and closed_at is null').get(req.user.id);if(!s)throw err(409,'No open shift');
 const cash=db.prepare("select coalesce(sum(total),0) t from sales where user_id=? and method='cash' and status='completed' and created_at>=?").get(req.user.id,s.opened_at).t;
 db.prepare("update shifts set closing=?,closed_at=datetime('now') where id=?").run(d.closing,s.id);
 return{expected:r2(s.opening+cash),counted:d.closing,difference:r2(d.closing-s.opening-cash)}}));

app.post('/api/users',auth('admin'),wrap(req=>{const d=parse(z.object({username:z.string().min(3).max(50),password:z.string().min(8).max(100),role:z.enum(['admin','manager','cashier'])}),req.body);
 try{db.prepare('insert into users(username,pass_hash,role) values(?,?,?)').run(d.username,bcrypt.hashSync(d.password,12),d.role);log(req.user.id,'user_create',{u:d.username,role:d.role});return{ok:1}}catch{throw err(409,'This username already exists')}}));
app.get('/api/audit',auth('admin'),wrap(()=>db.prepare('select * from audit order by id desc limit 200').all()));

require('./extra')({app,db,auth,wrap,parse,err,log,z});
require('./extra2')({app,db,auth,wrap,parse,err,log,z});
require('./extra3')({app,auth,wrap,parse,err,z});
require('./demo')({app,db,auth,wrap,parse,err,log,z});
const dist=path.join(__dirname,'../frontend/dist');
if(fs.existsSync(dist)){app.use(express.static(dist));app.get('*',(q,r)=>r.sendFile(path.join(dist,'index.html')))}
app.listen(process.env.PORT||3000,()=>console.log('POS server started'));
module.exports=app;
