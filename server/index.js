import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './db.js';

const app=express(), PORT=process.env.PORT||4000, SECRET=process.env.JWT_SECRET||'dev-only-change-me';
app.use(cors()); app.use(express.json({limit:'8mb'}));
const uploadDir=path.resolve('server/uploads'); fs.mkdirSync(uploadDir,{recursive:true});
app.use('/uploads',express.static(uploadDir));
const storage=multer.diskStorage({destination:uploadDir,filename:(req,file,cb)=>cb(null,Date.now()+'-'+file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_'))});
const upload=multer({storage,limits:{fileSize:12*1024*1024},fileFilter:(req,file,cb)=>cb(null,/image\/|application\/pdf/.test(file.mimetype))});
const auth=(req,res,next)=>{try{const token=(req.headers.authorization||'').replace('Bearer ','');req.user=jwt.verify(token,SECRET);next()}catch{res.status(401).json({error:'Please sign in again.'})}};
const audit=(admin,action,entity,id,details='')=>db.prepare('INSERT INTO audit_log(admin_id,action,entity,entity_id,details) VALUES(?,?,?,?,?)').run(admin,action,entity,id,details);
const num=v=>Number(v||0);
// Save a customer's WhatsApp messaging consent
app.patch('/api/customers/:id/whatsapp-consent', auth, (req, res) => {
  try {
    const customerId = Number(req.params.id);
    const optedIn = req.body.whatsapp_opt_in ? 1 : 0;

    const customer = db.prepare(
      'SELECT id FROM customers WHERE id = ?'
    ).get(customerId);

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    db.prepare(
      'UPDATE customers SET whatsapp_opt_in = ? WHERE id = ?'
    ).run(optedIn, customerId);

    audit(
      req.user.id,
      'UPDATE',
      'customer_whatsapp_consent',
      customerId,
      optedIn ? 'WhatsApp consent enabled' : 'WhatsApp consent withdrawn'
    );

    res.json({ ok: true, whatsapp_opt_in: optedIn });
  } catch (error) {
    res.status(500).json({ error: 'Could not update WhatsApp consent.' });
  }
});
app.get('/api/health',(req,res)=>res.json({ok:true,app:'MK Business Manager'}));
app.post('/api/auth/login',(req,res)=>{const {email,password}=req.body;const user=db.prepare('SELECT * FROM admins WHERE lower(email)=lower(?)').get(email||'');if(!user||!bcrypt.compareSync(password||'',user.password_hash))return res.status(401).json({error:'Incorrect email or password.'});const token=jwt.sign({id:user.id,name:user.name,email:user.email},SECRET,{expiresIn:'7d'});res.json({token,user:{id:user.id,name:user.name,email:user.email}})});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:req.user}));
app.post('/api/auth/admins',auth,(req,res)=>{const {name,email,password}=req.body;if(!name||!email||!password||password.length<8)return res.status(400).json({error:'Name, email and password (8+ characters) are required.'});try{const r=db.prepare('INSERT INTO admins(name,email,password_hash) VALUES(?,?,?)').run(name,email,bcrypt.hashSync(password,10));audit(req.user.id,'created','admin',r.lastInsertRowid,email);res.json({id:r.lastInsertRowid,name,email})}catch{res.status(409).json({error:'That email is already registered.'})}});

for (const table of ['customers', 'suppliers']) {
  const route = table;
  const isCustomer = table === 'customers';

  app.get('/api/' + route, auth, (req, res) => {
    res.json(
      db.prepare(`SELECT * FROM ${table} ORDER BY name`).all()
    );
  });

  app.post('/api/' + route, auth, (req, res) => {
    const {
      name,
      phone = '',
      address = '',
      notes = '',
      whatsapp_opt_in = 0
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    let r;

    if (isCustomer) {
      r = db.prepare(`
        INSERT INTO customers
        (name, phone, address, notes, whatsapp_opt_in)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        phone,
        address,
        notes,
        whatsapp_opt_in ? 1 : 0
      );
    } else {
      r = db.prepare(`
        INSERT INTO suppliers (name, phone, address, notes)
        VALUES (?, ?, ?, ?)
      `).run(name.trim(), phone, address, notes);
    }

    audit(req.user.id, 'created', table, r.lastInsertRowid, name);

    res.json(
      db.prepare(`SELECT * FROM ${table} WHERE id = ?`)
        .get(r.lastInsertRowid)
    );
  });

  app.put('/api/' + route + '/:id', auth, (req, res) => {
    const {
      name,
      phone = '',
      address = '',
      notes = '',
      whatsapp_opt_in = 0
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    const old = db.prepare(
      `SELECT * FROM ${table} WHERE id = ?`
    ).get(req.params.id);

    if (!old) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    if (isCustomer) {
      db.prepare(`
        UPDATE customers
        SET name = ?, phone = ?, address = ?, notes = ?,
            whatsapp_opt_in = ?
        WHERE id = ?
      `).run(
        name.trim(),
        phone,
        address,
        notes,
        whatsapp_opt_in ? 1 : 0,
        req.params.id
      );
    } else {
      db.prepare(`
        UPDATE suppliers
        SET name = ?, phone = ?, address = ?, notes = ?
        WHERE id = ?
      `).run(
        name.trim(),
        phone,
        address,
        notes,
        req.params.id
      );
    }

    audit(
      req.user.id,
      'updated',
      table,
      req.params.id,
      JSON.stringify({ before: old, after: req.body })
    );

    res.json({ ok: true });
  });
}


// WhatsApp configuration status (never expose the access token)
app.get('/api/whatsapp/status', auth, (req, res) => {
  const configured = Boolean(
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_API_VERSION
  );

  res.json({ configured });
});

// Send a WhatsApp text message to an opted-in customer
app.post('/api/whatsapp/send', auth, async (req, res) => {
  let messageId;

  try {
    const { customer_id, message } = req.body;

    if (!customer_id || !message?.trim()) {
      return res.status(400).json({
        error: 'Customer and message are required.'
      });
    }

    if (message.length > 4096) {
      return res.status(400).json({
        error: 'Message is too long. Maximum 4096 characters.'
      });
    }

    const customer = db.prepare(
      'SELECT * FROM customers WHERE id = ?'
    ).get(customer_id);

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    if (!customer.whatsapp_opt_in) {
      return res.status(403).json({
        error: 'This customer has not agreed to WhatsApp messages.'
      });
    }

    if (!customer.phone?.trim()) {
      return res.status(400).json({
        error: 'This customer has no phone number.'
      });
    }

    if (
      !process.env.WHATSAPP_TOKEN ||
      !process.env.WHATSAPP_PHONE_NUMBER_ID ||
      !process.env.WHATSAPP_API_VERSION
    ) {
      return res.status(503).json({
        error: 'WhatsApp API credentials are not configured on the server.'
      });
    }

    // Normalize Pakistani mobile numbers and international numbers
    let phone = customer.phone.replace(/\D/g, '');

    if (phone.startsWith('03') && phone.length === 11) {
      phone = '92' + phone.slice(1);
    } else if (phone.startsWith('0')) {
      phone = phone.slice(1);
    }

    if (phone.length < 8 || phone.length > 15) {
      return res.status(400).json({
        error: 'Please check the customer phone number and country code.'
      });
    }

    const saved = db.prepare(`
      INSERT INTO whatsapp_messages
      (customer_id, phone, message, message_type, status, created_by)
      VALUES (?, ?, ?, 'text', 'pending', ?)
    `).run(customer.id, phone, message.trim(), req.user.id);

    messageId = saved.lastInsertRowid;

    const version = process.env.WHATSAPP_API_VERSION;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    const response = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: {
            preview_url: false,
            body: message.trim()
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      const errorMessage =
        result.error?.message || 'WhatsApp rejected the message.';

      db.prepare(`
        UPDATE whatsapp_messages
        SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(errorMessage, messageId);

      return res.status(502).json({ error: errorMessage });
    }

    const whatsappMessageId = result.messages?.[0]?.id || '';

    db.prepare(`
      UPDATE whatsapp_messages
      SET status = 'sent',
          whatsapp_message_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(whatsappMessageId, messageId);

    audit(
      req.user.id,
      'sent',
      'whatsapp_message',
      messageId,
      `Message sent to customer ${customer.name}`
    );

    res.json({
      ok: true,
      message: 'WhatsApp message accepted by Meta.',
      message_id: whatsappMessageId
    });

  } catch (error) {
    if (messageId) {
      db.prepare(`
        UPDATE whatsapp_messages
        SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(error.message, messageId);
    }

    res.status(500).json({
      error: 'Could not send WhatsApp message.'
    });
  }
});


app.get('/api/transactions',auth,(req,res)=>{const rows=db.prepare(`SELECT t.*,a.name admin_name,CASE WHEN t.party_type='customer' THEN c.name ELSE s.name END party_name FROM transactions t LEFT JOIN admins a ON a.id=t.created_by LEFT JOIN customers c ON t.party_type='customer' AND c.id=t.party_id LEFT JOIN suppliers s ON t.party_type='supplier' AND s.id=t.party_id WHERE t.voided=0 ORDER BY t.created_at DESC,t.id DESC`).all();res.json(rows)});
app.post('/api/transactions',auth,(req,res)=>{const {party_type,party_id,kind,description='',amount,method='Cash',reference=''}=req.body;const allowed=['customer','supplier'];if(!allowed.includes(party_type)||!party_id||!kind||!(num(amount)>0))return res.status(400).json({error:'Choose a party, transaction type and positive amount.'});const table=party_type==='customer'?'customers':'suppliers';if(!db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(party_id))return res.status(404).json({error:'Party not found.'});const r=db.prepare('INSERT INTO transactions(party_type,party_id,kind,description,amount,method,reference,created_by) VALUES(?,?,?,?,?,?,?,?)').run(party_type,party_id,kind,description,num(amount),method,reference,req.user.id);audit(req.user.id,'created','transaction',r.lastInsertRowid,JSON.stringify(req.body));res.json({id:r.lastInsertRowid})});
app.put('/api/transactions/:id',auth,(req,res)=>{const old=db.prepare('SELECT * FROM transactions WHERE id=? AND voided=0').get(req.params.id);if(!old)return res.status(404).json({error:'Transaction not found.'});const {description,amount,method,kind}=req.body;if(!(num(amount)>0))return res.status(400).json({error:'Amount must be greater than zero.'});db.prepare('UPDATE transactions SET description=?,amount=?,method=?,kind=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(description??old.description,num(amount),method??old.method,kind??old.kind,old.id);audit(req.user.id,'edited','transaction',old.id,JSON.stringify({before:old,after:req.body}));res.json({ok:true})});
app.delete('/api/transactions/:id',auth,(req,res)=>{const old=db.prepare('SELECT * FROM transactions WHERE id=?').get(req.params.id);if(!old)return res.status(404).json({error:'Not found.'});db.prepare('UPDATE transactions SET voided=1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(old.id);audit(req.user.id,'voided','transaction',old.id,JSON.stringify(old));res.json({ok:true})});
app.get('/api/orders',auth,(req,res)=>res.json(db.prepare('SELECT o.*,c.name customer_name FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.id DESC').all()));
app.post('/api/orders',auth,(req,res)=>{const {customer_id,title,description='',total,advance=0,delivery_date='',status='Pending'}=req.body;if(!customer_id||!title||num(total)<=0)return res.status(400).json({error:'Customer, title and valid total are required.'});const orderNo='MK-'+Date.now().toString().slice(-8);const r=db.prepare('INSERT INTO orders(customer_id,order_no,title,description,total,advance,delivery_date,status) VALUES(?,?,?,?,?,?,?,?)').run(customer_id,orderNo,title,description,num(total),num(advance),delivery_date,status);if(num(advance)>0)db.prepare("INSERT INTO transactions(party_type,party_id,kind,description,amount,method,created_by) VALUES('customer',?,'received',?,?, 'Cash',?)").run(customer_id,`Advance for ${orderNo}`,num(advance),req.user.id);audit(req.user.id,'created','order',r.lastInsertRowid,orderNo);res.json({id:r.lastInsertRowid,order_no:orderNo})});
app.put('/api/orders/:id',auth,(req,res)=>{const {status}=req.body;db.prepare('UPDATE orders SET status=? WHERE id=?').run(status,req.params.id);audit(req.user.id,'updated','order',req.params.id,status);res.json({ok:true})});
app.get('/api/expenses',auth,(req,res)=>res.json(db.prepare('SELECT e.*,a.name admin_name FROM expenses e LEFT JOIN admins a ON a.id=e.created_by ORDER BY expense_date DESC,e.id DESC').all()));
app.post('/api/expenses',auth,(req,res)=>{const {category,description='',amount,method='Cash',expense_date}=req.body;if(!category||num(amount)<=0)return res.status(400).json({error:'Category and positive amount required.'});const r=db.prepare('INSERT INTO expenses(category,description,amount,method,expense_date,created_by) VALUES(?,?,?,?,?,?)').run(category,description,num(amount),method,expense_date||new Date().toISOString().slice(0,10),req.user.id);audit(req.user.id,'created','expense',r.lastInsertRowid,JSON.stringify(req.body));res.json({id:r.lastInsertRowid})});
app.get('/api/cash',auth,(req,res)=>{const rows=db.prepare('SELECT * FROM cash_entries ORDER BY entry_date DESC,id DESC').all();const sums=db.prepare("SELECT account,direction,SUM(amount) total FROM cash_entries GROUP BY account,direction").all();const balances={Cash:0,Bank:0};sums.forEach(x=>balances[x.account]=(balances[x.account]||0)+(x.direction==='in'?x.total:-x.total));res.json({rows,balances})});
app.post('/api/cash',auth,(req,res)=>{const {direction,account,amount,description='',entry_date}=req.body;if(!['in','out'].includes(direction)||!['Cash','Bank'].includes(account)||num(amount)<=0)return res.status(400).json({error:'Valid direction, account and amount required.'});const r=db.prepare('INSERT INTO cash_entries(direction,account,amount,description,entry_date,created_by) VALUES(?,?,?,?,?,?)').run(direction,account,num(amount),description,entry_date||new Date().toISOString().slice(0,10),req.user.id);audit(req.user.id,'created','cash_entry',r.lastInsertRowid,JSON.stringify(req.body));res.json({id:r.lastInsertRowid})});
app.get('/api/bills',auth,(req,res)=>res.json(db.prepare('SELECT b.*, \'/uploads/\' || b.filename AS url, CASE WHEN b.party_type="customer" THEN c.name ELSE s.name END party_name FROM bills b LEFT JOIN customers c ON b.party_type="customer" AND c.id=b.party_id LEFT JOIN suppliers s ON b.party_type="supplier" AND s.id=b.party_id ORDER BY b.id DESC').all()));
app.post('/api/bills/upload',auth,upload.single('bill'),(req,res)=>{if(!req.file)return res.status(400).json({error:'Upload an image or PDF.'});const r=db.prepare('INSERT INTO bills(filename,original_name,created_by) VALUES(?,?,?)').run(req.file.filename,req.file.originalname,req.user.id);audit(req.user.id,'uploaded','bill',r.lastInsertRowid,req.file.originalname);res.json({id:r.lastInsertRowid,url:'/uploads/'+req.file.filename,original_name:req.file.originalname})});
app.put('/api/bills/:id',auth,(req,res)=>{const {extracted_text='',corrected_text='',party_type='',party_id=null,bill_date='',total=0}=req.body;db.prepare('UPDATE bills SET extracted_text=?,corrected_text=?,party_type=?,party_id=?,bill_date=?,total=? WHERE id=?').run(extracted_text,corrected_text,party_type,party_id||null,bill_date,num(total),req.params.id);audit(req.user.id,'edited','bill',req.params.id,JSON.stringify(req.body));res.json({ok:true})});
app.get('/api/dashboard',auth,(req,res)=>{const customers=db.prepare('SELECT COUNT(*) n FROM customers').get().n,suppliers=db.prepare('SELECT COUNT(*) n FROM suppliers').get().n;const orders=db.prepare('SELECT COUNT(*) n,COALESCE(SUM(total),0) total FROM orders').get();const received=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM transactions WHERE party_type='customer' AND kind='received' AND voided=0").get().n;const sales=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM transactions WHERE party_type='customer' AND kind='order' AND voided=0").get().n;const purchases=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM transactions WHERE party_type='supplier' AND kind='purchase' AND voided=0").get().n;const paid=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM transactions WHERE party_type='supplier' AND kind='paid' AND voided=0").get().n;const expenses=db.prepare('SELECT COALESCE(SUM(amount),0) n FROM expenses').get().n;const cash=db.prepare("SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) n FROM cash_entries WHERE account='Cash'").get().n;const bank=db.prepare("SELECT COALESCE(SUM(CASE WHEN direction='in' THEN amount ELSE -amount END),0) n FROM cash_entries WHERE account='Bank'").get().n;const recent=db.prepare(`SELECT t.*,CASE WHEN t.party_type='customer' THEN c.name ELSE s.name END party_name FROM transactions t LEFT JOIN customers c ON t.party_type='customer' AND c.id=t.party_id LEFT JOIN suppliers s ON t.party_type='supplier' AND s.id=t.party_id WHERE t.voided=0 ORDER BY t.id DESC LIMIT 8`).all();res.json({customers,suppliers,orders:orders.n,orderValue:orders.total,received,sales,purchases,paid,expenses,cash,bank,receivable:Math.max(0,sales-received),payable:Math.max(0,purchases-paid),recent})});
app.get('/api/audit',auth,(req,res)=>res.json(db.prepare('SELECT l.*,a.name admin_name FROM audit_log l LEFT JOIN admins a ON a.id=l.admin_id ORDER BY l.id DESC LIMIT 100').all()));

// DATABASE BACKUP
app.get('/api/backup', auth, async (req, res) => {
  try {
    const backupDir = path.resolve('server/backups');

    // Create backup folder if it doesn't exist
    await fs.promises.mkdir(backupDir, { recursive: true });

    // Generate a timestamped backup filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-');

    const filename = `mk-business-backup-${timestamp}.sqlite`;
    const backupPath = path.join(backupDir, filename);

    // Create a safe SQLite database backup
    await db.backup(backupPath);

    // Send backup to the browser
    res.download(backupPath, filename);
  } catch (error) {
    console.error('Database backup failed:', error);
    if (!res.headersSent) {
      res.status(500).json({
        message: 'Database backup failed'
      });
    }
  }
});


const distDir=path.resolve('dist');
if(fs.existsSync(distDir)){
  app.use(express.static(distDir));
  app.get('*',(req,res)=>res.sendFile(path.join(distDir,'index.html')));
}

app.listen(PORT,()=>console.log(`MK API running at http://localhost:${PORT}`));