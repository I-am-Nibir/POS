const express=require('express'),helmet=require('helmet'),rateLimit=require('express-rate-limit'),
bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),{migrate}=require('./db'),{createDb}=require('./db/client'),
{z}=require('zod'),path=require('path'),fs=require('fs'),crypto=require('crypto');
const SECRET=process.env.JWT_SECRET||crypto.randomBytes(32).toString('hex');
if(!process.env.JWT_SECRET)console.warn('WARN: JWT_SECRET is not set. All sessions will be invalidated on every restart.');
if(!process.env.DATABASE_URL){console.error('DATABASE_URL is not set. Example: postgres://user:password@localhost:5432/dokan');process.exit(1)}
const db=createDb({connectionString:process.env.DATABASE_URL,max:Number(process.env.DB_POOL_MAX)||10}); // schema: backend/db/migrations, interface: backend/db/client.js
const log=async (u,a,d)=>await db.prepare('insert into audit(user_id,action,detail) values(?,?,?)').run(u,a,JSON.stringify(d||{}));

const app=express();app.set('trust proxy',1);app.get('/healthz',(q,r)=>r.json({ok:1}));app.use(helmet({contentSecurityPolicy:{useDefaults:true,directives:{'upgrade-insecure-requests':process.env.HTTPS==='1'?[]:null}}}));app.use(express.json({limit:'1mb'}));
const err=(s,m)=>Object.assign(new Error(m),{status:s});
const auth=(...roles)=>async(req,res,next)=>{let u;try{const t=(req.headers.authorization||'').replace('Bearer ','');
 const p=jwt.verify(t,SECRET);u=await db.prepare('select id,username,role from users where id=? and active=1').get(p.id);}catch(e){if(!['JsonWebTokenError','TokenExpiredError','NotBeforeError'].includes(e.name)){console.error(e);return res.status(500).json({error:'Server error'})}}
 if(!u)return res.status(401).json({error:'Please sign in'});if(roles.length&&!roles.includes(u.role))return res.status(403).json({error:'You do not have permission to do this'});req.user=u;next();};
// database-এর পরিচিত error: ভুল মান (22xxx) -> 400, একই জিনিস দুবার (23505) -> 409
const known=e=>e.status?e:String(e.code).startsWith('22')?err(400,'Invalid input'):e.code==='23505'?err(409,'This record already exists'):null;
const wrap=f=>async(req,res)=>{try{res.json(await f(req,res))}catch(e){const k=known(e);res.status(k?.status||500).json({error:k?k.message:'Server error'});if(!k)console.error(e)}};
const parse=(sch,b)=>{const r=sch.safeParse(b);if(!r.success)throw err(400,'Invalid input');return r.data};

app.post('/api/login',rateLimit({windowMs:15*60e3,max:10,standardHeaders:true}),wrap(async req=>{
 const d=parse(z.object({username:z.string().max(50),password:z.string().max(100)}),req.body);
 const u=await db.prepare('select * from users where username=? and active=1').get(d.username);
 const ok=bcrypt.compareSync(d.password,u?u.pass_hash:'$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
 if(!u||!ok){await log(null,'login_fail',{u:d.username});throw err(401,'Invalid username or password')}
 await log(u.id,'login');return{token:jwt.sign({id:u.id},SECRET,{expiresIn:'8h'}),user:{id:u.id,username:u.username,role:u.role}}}));

const receiptDefaults={paper:'80',printMode:'manual',name:'Dokan POS',address:'',phone:'',email:'',website:'',logo:'',thankYou:'Thank you for your purchase!',footer:'',showLogo:true,showName:true,showAddress:true,showPhone:true,showEmail:true,showWebsite:false,showCustomer:true,showCashier:true,showProductId:false,showTax:true,showDiscount:true,showPayment:true,showBarcode:false,showThankYou:true,showFooter:true,showExchangePolicy:true,exchangeDays:5,exchangePolicyText:'1. Exchange is allowed within {days} days of purchase.\n2. Products must be unused and in their original condition.\n3. Damaged, used or altered products are not eligible for exchange.\n4. Original purchase receipt or invoice is required.\n5. Partial and full exchanges are allowed, subject to the above conditions.',exchangeNoRefundText:'NO RETURN – NO REFUND.',exchangeClosingText:'Thank you for shopping with us.'};
const getReceiptSettings=async ()=>{const row=await db.prepare("select value from app_settings where key='receipt'").get();try{return {...receiptDefaults,...(row?JSON.parse(row.value):{})}}catch{return receiptDefaults}};
app.get('/api/receipt-settings',auth(),wrap(async ()=>await getReceiptSettings()));
app.put('/api/receipt-settings',auth('admin'),wrap(async req=>{return db.transaction(async()=>{const d={};for(const k of Object.keys(receiptDefaults)){if(req.body[k]!==undefined)d[k]=req.body[k]}if(!['58','80'].includes(String(d.paper??'80')))throw err(400,'Invalid receipt width');if(!['auto','manual'].includes(d.printMode??'manual'))throw err(400,'Invalid print mode');if(d.exchangeDays!==undefined&&(!Number.isInteger(Number(d.exchangeDays))||Number(d.exchangeDays)<0||Number(d.exchangeDays)>365))throw err(400,'Exchange period must be between 0 and 365 days');for(const k of ['exchangePolicyText','exchangeNoRefundText','exchangeClosingText'])if(d[k]!==undefined&&String(d[k]).length>2000)throw err(400,'Exchange policy text is too long');if(typeof d.logo==='string'&&d.logo.length>500000)throw err(400,'Logo is too large');const next={...await getReceiptSettings(),...d};await db.prepare("insert into app_settings(key,value) values('receipt',?) on conflict(key) do update set value=excluded.value").run(JSON.stringify(next));if(d.exchangeDays!==undefined){const er=await db.prepare("select value from app_settings where key='exchange'").get();let es={};try{es=er?JSON.parse(er.value):{}}catch{};es.days=Number(d.exchangeDays);await db.prepare("insert into app_settings(key,value) values('exchange',?) on conflict(key) do update set value=excluded.value").run(JSON.stringify(es))}await log(req.user.id,'receipt_settings_update');return next})()}));
const loyaltyDefaults={enabled:true,earnAmount:100,earnPoints:1,redeemValue:1,minRedeemPoints:10,maxRedeemPoints:500};
const getLoyaltySettings=async ()=>{const row=await db.prepare("select value from app_settings where key='loyalty'").get();try{return {...loyaltyDefaults,...(row?JSON.parse(row.value):{})}}catch{return loyaltyDefaults}};
app.get('/api/loyalty-settings',auth(),wrap(async ()=>await getLoyaltySettings()));
app.put('/api/loyalty-settings',auth('admin'),wrap(async req=>{return db.transaction(async()=>{const d=req.body||{},n={...await getLoyaltySettings(),...d};if(typeof n.enabled!=='boolean'||!Number.isFinite(Number(n.earnAmount))||Number(n.earnAmount)<=0||Number(n.earnAmount)>1000000000||!Number.isInteger(Number(n.earnPoints))||Number(n.earnPoints)<1||!Number.isFinite(Number(n.redeemValue))||Number(n.redeemValue)<=0||Number(n.redeemValue)>1000000||!Number.isInteger(Number(n.minRedeemPoints))||Number(n.minRedeemPoints)<1||!Number.isInteger(Number(n.maxRedeemPoints))||Number(n.maxRedeemPoints)<Number(n.minRedeemPoints)||Number(n.maxRedeemPoints)>100000)throw err(400,'Invalid loyalty settings');n.earnAmount=Number(n.earnAmount);n.earnPoints=Number(n.earnPoints);n.redeemValue=Number(n.redeemValue);n.minRedeemPoints=Number(n.minRedeemPoints);n.maxRedeemPoints=Number(n.maxRedeemPoints);await db.prepare("insert into app_settings(key,value) values('loyalty',?) on conflict(key) do update set value=excluded.value").run(JSON.stringify(n));await log(req.user.id,'loyalty_settings_update',n);return n})()}));
const same=(a,b)=>a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
app.get('/api/setup/status',wrap(async ()=>({needed:!await db.prepare('select 1 from users').get(),keyRequired:!!process.env.SETUP_KEY})));
app.post('/api/setup',rateLimit({windowMs:15*60e3,max:10,standardHeaders:true}),wrap(async req=>{
 const d=parse(z.object({username:z.string().trim().min(3).max(50),password:z.string().min(8).max(100),key:z.string().max(100).optional()}),req.body);
 if(process.env.SETUP_KEY&&!same(d.key||'',process.env.SETUP_KEY))throw err(403,'Invalid setup key');
 return await db.transaction(async ()=>{if(await db.prepare('select 1 from users').get())throw err(409,'Setup has already been completed');
  const id=(await db.prepare('insert into users(username,pass_hash,role) values(?,?,?)').run(d.username,bcrypt.hashSync(d.password,12),'admin')).lastInsertRowid;
  await log(id,'setup',{u:d.username});return{token:jwt.sign({id},SECRET,{expiresIn:'8h'}),user:{id,username:d.username,role:'admin'}}})()}));
app.get('/api/products',auth(),wrap(async ()=>await db.prepare('select id,name,sku,barcode,price,stock,low_stock,vat_rate,size,color,category,brand from products where active=1 and (is_demo=0 or ?=1) order by name').all(await app.locals.demoOn()?1:0)));
const P=z.object({name:z.string().min(1).max(120),sku:z.string().min(1).max(40),barcode:z.string().max(40).optional(),price:z.number().min(0),cost:z.number().min(0).default(0),stock:z.number().int().min(0).default(0),low_stock:z.number().int().min(0).default(5),vat_rate:z.number().min(0).max(100).default(0),size:z.string().max(20).optional(),color:z.string().max(20).optional(),category:z.string().max(40).optional(),brand:z.string().max(40).optional()});
app.post('/api/products',auth('admin','manager'),wrap(async req=>{const d=parse(P,req.body);
 try{const r=await db.prepare('insert into products(name,sku,barcode,price,cost,stock,low_stock,vat_rate,size,color,category,brand) values(@name,@sku,@barcode,@price,@cost,@stock,@low_stock,@vat_rate,@size,@color,@category,@brand)').run({barcode:null,size:null,color:null,category:null,brand:null,...d});
 await log(req.user.id,'product_create',d);return{id:r.lastInsertRowid}}catch(e){if(e.code!=='23505')throw e;throw err(409,'This SKU already exists')}}));
app.put('/api/products/:id',auth('admin','manager'),wrap(async req=>{return db.transaction(async()=>{
 // যে field পাঠানো হয়নি তার আগের মান থাকে; size/color-এর মতো লেখার field মুছতে null পাঠাতে হয়
 const old=await db.prepare('select * from products where id=?').get(+req.params.id);if(!old)throw err(404,'Product not found');
 const merged={...Object.fromEntries(Object.entries(old).filter(([,v])=>v!==null)),...req.body};
 for(const k of ['barcode','size','color','category','brand'])if(merged[k]===null)delete merged[k];
 const d=parse(P,merged);
 if(await db.prepare('select 1 from products where sku=? and id<>?').get(d.sku,old.id))throw err(409,'This SKU already exists');
 await db.prepare('update products set name=@name,sku=@sku,barcode=@barcode,price=@price,cost=@cost,stock=@stock,low_stock=@low_stock,vat_rate=@vat_rate,size=@size,color=@color,category=@category,brand=@brand where id=@id').run({barcode:null,size:null,color:null,category:null,brand:null,...d,id:+req.params.id});
 await log(req.user.id,'product_update',{id:req.params.id,...d});return{ok:1}})()}));

const r2=n=>Math.round(n*100)/100;
const TZ=/^[+-]\d{1,2} hours$/.test(process.env.TZ_OFFSET||'')?process.env.TZ_OFFSET:'+6 hours';
app.post('/api/sales',auth(),wrap(async req=>{return db.transaction(async()=>{
 const d=parse(z.object({items:z.array(z.object({id:z.number().int(),qty:z.number().int().positive().max(10000)})).min(1).max(200),discount:z.number().min(0).default(0),method:z.enum(['cash','card','bkash','nagad','due']),customerId:z.number().int().optional(),at:z.string().datetime().optional(),coupon:z.string().max(30).optional(),gift:z.string().max(30).optional(),storeCreditCode:z.string().max(40).optional(),voucherCode:z.string().max(40).optional(),redeemPoints:z.number().int().min(0).max(100000).default(0),paid:z.number().min(0),customer:z.string().max(100).optional(),key:z.string().min(8).max(64)}),req.body);
 const dup=await db.prepare('select id,invoice from sales where idem_key=?').get(d.key);if(dup)return{...dup,duplicate:true};
 return await db.transaction(async ()=>{let sub=0,vat=0;const lines=[];
  for(const it of d.items){const p=await db.prepare('select * from products where id=? and active=1 and (is_demo=0 or ?=1)').get(it.id,await app.locals.demoOn()?1:0);
   if(!p)throw err(400,'Product not found');if(p.stock<it.qty&&!d.at)throw err(409,`Not enough stock: ${p.name}`);
   const line=p.price*it.qty;sub+=line;lines.push({p,qty:it.qty,vat:line*p.vat_rate/100});}
  if(d.discount>sub)throw err(400,'Discount is more than the subtotal');
  if(d.coupon)d.discount=r2(d.discount+await app.locals.coupon(d.coupon,sub-d.discount));
  if(d.discount>sub)throw err(400,'Combined discount is more than the subtotal');
  const loyalty=await getLoyaltySettings();let loyaltyDiscount=0,pointsEarned=0,pointsBalance=0,customerRow=null;
  if(d.customerId){customerRow=await db.prepare('select * from customers where id=? and (is_demo=0 or ?=1)').get(d.customerId,await app.locals.demoOn()?1:0);if(!customerRow)throw err(404,'Customer not found');pointsBalance=Number(customerRow.points||0)}
  if(d.redeemPoints>0){if(!loyalty.enabled)throw err(400,'Loyalty points are disabled');if(!d.customerId||!customerRow)throw err(400,'Select a registered customer to redeem points');if(d.redeemPoints<loyalty.minRedeemPoints)throw err(400,`Minimum redemption is ${loyalty.minRedeemPoints} points`);if(d.redeemPoints>loyalty.maxRedeemPoints)throw err(400,`Maximum redemption is ${loyalty.maxRedeemPoints} points per sale`);if(d.redeemPoints>pointsBalance)throw err(409,'Customer does not have enough points');loyaltyDiscount=r2(d.redeemPoints*loyalty.redeemValue);if(loyaltyDiscount>sub-d.discount+0.000001)throw err(400,'Loyalty discount cannot exceed the remaining subtotal');}
  const combinedDiscount=r2(d.discount+loyaltyDiscount);
  if(combinedDiscount>sub)throw err(400,'Combined discount is more than the subtotal');
  if(req.user.role==='cashier'&&d.discount>sub*0.1+0.000001)throw err(403,'Cashier discount cannot exceed 10%');const f=sub?(sub-combinedDiscount)/sub:0;lines.forEach(l=>{l.vat=r2(l.vat*f);vat+=l.vat});
  const total=r2(sub-combinedDiscount+vat);
  if(loyalty.enabled&&customerRow){const eligibleSpend=Math.max(0,sub-combinedDiscount);pointsEarned=Math.floor(eligibleSpend/loyalty.earnAmount)*loyalty.earnPoints;}
  const hasCredit=!!d.storeCreditCode,hasVoucher=!!d.voucherCode;
  if(hasCredit&&hasVoucher)throw err(400,'Use either store credit or one voucher per sale');
  if((hasCredit||hasVoucher)&&(d.discount>0||d.coupon||d.gift||d.redeemPoints>0))throw err(400,'Store credit or voucher cannot be combined with discounts, coupons or gift cards');
  if(hasCredit||hasVoucher){if(!d.customerId)throw err(400,'Select the customer account linked to this credit');if(!await db.prepare('select 1 from customers where id=?').get(d.customerId))throw err(404,'Customer not found');}
  let creditUse=0,creditRow=null,voucherRow=null;
  if(hasCredit){creditRow=await db.prepare("select * from store_credits where upper(code)=upper(?) and customer_id=? and balance>0 and (expires_at is null or expires_at>utc_now())").get(d.storeCreditCode,d.customerId);if(!creditRow)throw err(400,'Store credit is invalid, expired, empty or belongs to another customer');creditUse=Math.min(creditRow.balance,total);}
  if(hasVoucher){voucherRow=await db.prepare("select v.* from exchange_vouchers v left join voucher_redemptions r on r.voucher_id=v.id where upper(v.code)=upper(?) and v.balance>0 and r.id is null and (v.expires_at is null or v.expires_at>utc_now())").get(d.voucherCode);if(!voucherRow)throw err(400,'Voucher is invalid, expired or already used');if(voucherRow.customer_id&&voucherRow.customer_id!==d.customerId)throw err(400,'Voucher belongs to another customer');creditUse=Math.min(voucherRow.balance,total);}
  const gift=d.gift?await app.locals.gift(d.gift,total):0;
  if(d.method==='due'){if(!['admin','manager'].includes(req.user.role))throw err(403,'Only an admin or manager can create a due sale');if(!d.customerId)throw err(400,'Select a customer for a due sale');if(d.paid+gift+creditUse>total+0.000001)throw err(400,'Due-sale payment cannot exceed the total');}else if(d.paid+gift+creditUse<total)throw err(400,'Amount received is less than the total');
  const paidNow=Math.min(d.paid+gift+creditUse,total);
  const inv='INV-'+Date.now().toString(36).toUpperCase()+crypto.randomInt(100,999);
  const customerName=d.customer||(d.customerId?(await db.prepare('select name from customers where id=?').get(d.customerId))?.name:null);
  const s=await db.prepare('insert into sales(invoice,user_id,subtotal,discount,vat,total,paid,method,customer,idem_key) values(?,?,?,?,?,?,?,?,?,?)').run(inv,req.user.id,r2(sub),combinedDiscount,r2(vat),total,r2(d.paid+gift+creditUse),d.method,customerName||null,d.key);
  if(creditRow){const bal=r2(creditRow.balance-creditUse);await db.prepare('update store_credits set balance=? where id=? and balance>=?').run(bal,creditRow.id,creditUse);const after=r2((await db.prepare("select coalesce(sum(balance),0) v from store_credits where customer_id=?").get(d.customerId)).v);await db.prepare("insert into credit_ledger(customer_id,kind,source_id,code,amount,balance_after,description,created_by) values(?,'spend',?,?,?,?,?,?)").run(d.customerId,s.lastInsertRowid,creditRow.code,creditUse,after,'Store credit redeemed on '+inv,req.user.id);}
  if(voucherRow){await db.prepare('insert into voucher_redemptions(voucher_id,sale_id,amount,redeemed_by) values(?,?,?,?)').run(voucherRow.id,s.lastInsertRowid,creditUse,req.user.id);await db.prepare('update exchange_vouchers set balance=0 where id=?').run(voucherRow.id);if(voucherRow.customer_id){const bal=r2((await db.prepare('select coalesce(sum(balance),0) v from store_credits where customer_id=?').get(voucherRow.customer_id)).v);await db.prepare("insert into credit_ledger(customer_id,kind,source_id,code,amount,balance_after,description,created_by) values(?,'voucher_redeem',?,?,?,?,?,?)").run(voucherRow.customer_id,s.lastInsertRowid,voucherRow.code,creditUse,bal,'Exchange voucher redeemed on '+inv,req.user.id);}}

  // ড্রয়ারে আসা নগদ: gift card, store credit, voucher ও ভাংতি বাদ
  const cashReceived=['cash','due'].includes(d.method)?r2(Math.max(0,Math.min(d.paid,total-gift-creditUse))):0;
  await db.prepare('update sales set cash_received=? where id=?').run(cashReceived,s.lastInsertRowid);
  for(const l of lines){await db.prepare('insert into sale_items(sale_id,product_id,name,qty,price,vat) values(?,?,?,?,?,?)').run(s.lastInsertRowid,l.p.id,l.p.name,l.qty,l.p.price,l.vat);
   await db.prepare('update products set stock=stock-? where id=?').run(l.qty,l.p.id);}
  if(d.customerId){const nextBalance=pointsBalance-d.redeemPoints+pointsEarned;const upd=await db.prepare('update customers set due=due+?,points=points-?+? where id=? and points>=?').run(r2(total-paidNow),d.redeemPoints,pointsEarned,d.customerId,d.redeemPoints);if(upd.changes!==1)throw err(409,'Insufficient loyalty points');await db.prepare('update sales set customer_id=? where id=?').run(d.customerId,s.lastInsertRowid);if(d.redeemPoints>0)await db.prepare("insert into points_ledger(customer_id,kind,points,balance_after,sale_id,description,created_by) values(?,'redeem',?,?,?,?,?)").run(d.customerId,d.redeemPoints,nextBalance-pointsEarned,s.lastInsertRowid,'Redeemed on '+inv,req.user.id);if(pointsEarned>0)await db.prepare("insert into points_ledger(customer_id,kind,points,balance_after,sale_id,description,created_by) values(?,'earn',?,?,?,?,?)").run(d.customerId,pointsEarned,nextBalance,s.lastInsertRowid,'Earned on '+inv,req.user.id);pointsBalance=nextBalance;}
  await db.prepare('update sales set loyalty_discount=?,points_redeemed=?,points_earned=?,points_balance=?,loyalty_accounted=?,points_earned_net=?,loyalty_earn_amount=?,loyalty_earn_points=? where id=?').run(loyaltyDiscount,d.redeemPoints,pointsEarned,d.customerId?pointsBalance:null,loyalty.enabled&&customerRow?1:0,pointsEarned,loyalty.earnAmount,loyalty.earnPoints,s.lastInsertRowid);
  if(d.at){const t=Date.parse(d.at),n=Date.now();if(!(t<=n+6e4&&t>n-7*864e5))throw err(400,'Invalid offline sale time');await db.prepare('update sales set created_at=? where id=?').run(new Date(t).toISOString().slice(0,19).replace('T',' '),s.lastInsertRowid)}
  await log(req.user.id,d.at?'sale_offline':'sale',{inv,total});return{id:s.lastInsertRowid,invoice:inv,total,loyaltyDiscount,pointsRedeemed:d.redeemPoints,pointsEarned,pointsBalance:d.customerId?pointsBalance:null,change:Math.max(0,r2(d.paid+gift+creditUse-total)),gift,creditUsed:creditUse,creditType:hasCredit?'store_credit':hasVoucher?'voucher':null,due:r2(total-paidNow)}})();})()}));

app.post('/api/sales/:id/refund',auth('admin','manager'),wrap(()=>{throw err(410,'Cash refunds are not allowed. Use the Exchange workflow instead.')}));

app.get('/api/sales',auth('admin','manager'),wrap(async ()=>await db.prepare('select id,invoice,total,method,status,created_at from sales where (is_demo=0 or ?=1) order by id desc limit 100').all(await app.locals.demoOn()?1:0)));
app.get('/api/reports/daily',auth('admin','manager'),wrap(async ()=>{return db.snapshot(async()=>{const d={d:await app.locals.demoOn()?1:0},t={...d,z:TZ};return{
 summary:await db.prepare("select count(*) orders,coalesce(sum(total),0) revenue,coalesce(sum(vat),0) vat from sales where status='completed' and (is_demo=0 or @d=1) and (created_at+@z::interval)::date=(utc_now()+@z::interval)::date").get(t),
 top:await db.prepare("select si.name,sum(si.qty) qty from sale_items si join sales s on s.id=si.sale_id where s.status='completed' and (s.is_demo=0 or @d=1) and (s.created_at+@z::interval)::date=(utc_now()+@z::interval)::date group by si.name order by qty desc,si.name limit 5").all(t),
 lowStock:await db.prepare('select name,stock from products where stock<=low_stock and active=1 and (is_demo=0 or @d=1) order by id').all(d)}})()}));

app.post('/api/shifts/open',auth(),wrap(async req=>{return db.transaction(async()=>{if(await db.prepare('select 1 from shifts where user_id=? and closed_at is null').get(req.user.id))throw err(409,'A shift is already open');
 const d=parse(z.object({opening:z.number().min(0)}),req.body);await db.prepare('insert into shifts(user_id,opening) values(?,?)').run(req.user.id,d.opening);return{ok:1}})()}));
app.post('/api/shifts/close',auth(),wrap(async req=>{return db.transaction(async()=>{const d=parse(z.object({closing:z.number().min(0)}),req.body);
 const s=await db.prepare('select * from shifts where user_id=? and closed_at is null').get(req.user.id);if(!s)throw err(409,'No open shift');
 // নগদ বিক্রি + নগদে বাকি আদায় + exchange-এ নেওয়া বাড়তি টাকা (নগদ ধরা হয়)
 const sum=async q=>(await db.prepare(q).get(req.user.id,s.opened_at)).t;
 const cash=await sum("select coalesce(sum(coalesce(cash_received,case when method='cash' then total else 0 end)),0) t from sales where user_id=? and status='completed' and created_at>=?")
  +await sum("select coalesce(sum(amount),0) t from due_payments where collected_by=? and method='cash' and created_at>=?")
  +await sum("select coalesce(sum(greatest(replacement_value-returned_value,0)),0) t from exchanges where processed_by=? and created_at>=?");
 await db.prepare("update shifts set closing=?,closed_at=utc_now() where id=?").run(d.closing,s.id);
 return{expected:r2(s.opening+cash),counted:d.closing,difference:r2(d.closing-s.opening-cash)}})()}));

app.post('/api/users',auth('admin'),wrap(async req=>{const d=parse(z.object({username:z.string().min(3).max(50),password:z.string().min(8).max(100),role:z.enum(['admin','manager','cashier'])}),req.body);
 try{await db.prepare('insert into users(username,pass_hash,role) values(?,?,?)').run(d.username,bcrypt.hashSync(d.password,12),d.role);await log(req.user.id,'user_create',{u:d.username,role:d.role});return{ok:1}}catch(e){if(e.code!=='23505')throw e;throw err(409,'This username already exists')}}));
app.get('/api/audit',auth('admin'),wrap(async ()=>await db.prepare('select * from audit order by id desc limit 200').all()));

require('./extra')({app,db,auth,wrap,parse,err,log,z});
require('./extra2')({app,db,auth,wrap,parse,err,log,z});

require('./demo')({app,db,auth,wrap,parse,err,log,z});
app.use('/api', (req,res)=>res.status(404).json({error:'API endpoint not found: '+req.method+' '+req.originalUrl}));
const dist=path.join(__dirname,'../frontend/dist');
if(fs.existsSync(dist)){app.use(express.static(dist));app.get('*',(q,r)=>r.sendFile(path.join(dist,'index.html')))}
migrate(db.pool).then(()=>app.listen(process.env.PORT||3000,()=>console.log('POS server started')))
 .catch(e=>{console.error('Startup failed:',e.message);process.exit(1)});
module.exports=app;
