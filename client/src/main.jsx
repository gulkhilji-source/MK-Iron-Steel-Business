
import React,{createContext,useContext,useEffect,useState} from 'react';
import{createRoot}from'react-dom/client';
import{LayoutDashboard,Users,Truck,ClipboardList,Receipt,Wallet,FileImage,Settings,LogOut,Plus,Search,Globe,Menu,X,ArrowDownLeft,ArrowUpRight,Package,Activity,Edit3,Upload,CheckCircle2,AlertCircle,Download}from'lucide-react';
import Tesseract from'tesseract.js';
import'./style.css';
import{jsPDF}from'jspdf';
import autoTable from'jspdf-autotable';

const LanguageContext=createContext({lang:'English',t:key=>key});
function useLanguage(){return useContext(LanguageContext)}

const urduTranslations={
  'Dashboard':'ڈیش بورڈ','Customers':'گاہک','Suppliers':'سپلائرز',
  'Orders':'آرڈرز','Transactions':'لین دین','Expenses':'اخراجات',
  'Cash & Bank':'کیش اور بینک','Bills':'بل اسکینر','Activity':'سرگرمیاں',
  'Settings':'ترتیبات','WORKSPACE':'کام کا شعبہ','Administrator':'منتظم',
  'Sign out':'لاگ آؤٹ','Welcome back.':'خوش آمدید',
  'BUSINESS MANAGEMENT':'کاروباری انتظام','Email address':'ای میل ایڈریس',
  'Password':'پاس ورڈ','Sign in to workspace':'اکاؤنٹ میں داخل ہوں',
  'Signing in…':'داخل ہو رہا ہے…',
  'Secure local business workspace · MK':'محفوظ کاروباری نظام · MK',
  'Good business starts with clear records.':'اچھا کاروبار درست حساب سے شروع ہوتا ہے۔',
  'Your business overview at a glance.':'آپ کے کاروبار کی مکمل جھلک۔',
  'Order value':'آرڈرز کی مالیت','Cash in hand':'نقد رقم',
  'Customer receivable':'گاہکوں سے وصولی',
  'Supplier payable':'سپلائرز کو ادائیگی',
  'Recent transactions':'حالیہ لین دین','Financial snapshot':'مالی صورتحال',
  'Received from customers':'گاہکوں سے وصول شدہ رقم',
  'Paid to suppliers':'سپلائرز کو ادا شدہ رقم',
  'Purchases recorded':'درج شدہ خریداری',
  'Business expenses':'کاروباری اخراجات','Bank balance':'بینک بیلنس',
  'No transactions yet. Add your first customer or supplier entry.':'ابھی کوئی لین دین موجود نہیں۔ پہلے گاہک یا سپلائر کا اندراج کریں۔',
  'Add':'شامل کریں','Edit':'ترمیم','Save':'محفوظ کریں',
  'Cancel':'منسوخ کریں','Search':'تلاش کریں','Name':'نام',
  'Full name':'مکمل نام','Phone':'فون نمبر','Address':'پتہ',
  'Notes':'نوٹس','Date':'تاریخ','Amount':'رقم',
  'Description':'تفصیل','Type':'قسم','Method':'طریقہ',
  'Status':'حالت','Customer':'گاہک','Supplier':'سپلائر',
  'Account':'اکاؤنٹ','Cash':'نقد','Bank':'بینک',
  'Cash balance':'نقد بیلنس','View ledger':'کھاتہ دیکھیں',
  'Download PDF Statement':'PDF اسٹیٹمنٹ ڈاؤن لوڈ کریں',
  'No phone':'فون نمبر موجود نہیں',
  'No matching transactions.':'کوئی متعلقہ لین دین نہیں ملا۔',
  'No expenses recorded.':'ابھی کوئی خرچ درج نہیں۔',
  'No fabrication orders yet.':'ابھی کوئی فیبریکیشن آرڈر موجود نہیں۔',
  'No bills uploaded yet.':'ابھی کوئی بل اپ لوڈ نہیں کیا گیا۔',
  'No cash or bank entries yet. Add an opening balance as money in.':'ابھی نقد یا بینک کا کوئی اندراج نہیں۔ ابتدائی بیلنس رقم کی آمد کے طور پر درج کریں۔'
};

function translate(key,lang){
  if(lang!=='Urdu')return key;
  return urduTranslations[key]||key;
}

const money=n=>'Rs '+Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:2});
const date=s=>s?new Date(s).toLocaleDateString():'—';

const api=async(url,token,opts={})=>{
  const r=await fetch('/api'+url,{
    ...opts,
    headers:{
      ...(opts.body instanceof FormData?{}:{'Content-Type':'application/json'}),
      ...(token?{Authorization:'Bearer '+token}:{}),
      ...opts.headers
    }
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.error||'Request failed');
  return data;
};

function downloadPartyStatement(party,type,transactions){
  const doc=new jsPDF();
  const isCustomer=type==='customers';
  const accountType=isCustomer?'Customer':'Supplier';
  const sorted=[...transactions].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  let totalDebit=0,totalCredit=0,balance=0;

  const rows=sorted.map(x=>{
    const kind=String(x.kind||'').toLowerCase();
    let debit=0,credit=0;

    if((isCustomer&&kind==='order')||(!isCustomer&&kind==='purchase')){
      debit=Number(x.amount)||0;
    }else if((isCustomer&&kind==='received')||(!isCustomer&&kind==='paid')){
      credit=Number(x.amount)||0;
    }

    totalDebit+=debit;
    totalCredit+=credit;
    balance+=debit-credit;

    return[
      x.created_at?new Date(x.created_at).toLocaleDateString():'—',
      x.kind||'—',
      x.description||'—',
      debit?debit.toLocaleString('en-PK'):'—',
      credit?credit.toLocaleString('en-PK'):'—',
      balance.toLocaleString('en-PK')
    ];
  });

  doc.setFontSize(22);
  doc.setFont('helvetica','bold');
  doc.text('MK',14,20);
  doc.setFontSize(15);
  doc.text('Mujahid Khilji',14,30);
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  doc.text('Iron & Steel Fabrication',14,36);
  doc.setFontSize(16);
  doc.setFont('helvetica','bold');
  doc.text(`${accountType} Statement`,14,49);
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  doc.text(`Name: ${party.name||'—'}`,14,59);
  doc.text(`Phone: ${party.phone||'—'}`,14,65);
  doc.text(`Address: ${party.address||'—'}`,14,71);
  doc.text(`Statement date: ${new Date().toLocaleDateString()}`,14,77);

  autoTable(doc,{
    startY:85,
    head:[['Date','Type','Description','Debit (Rs.)','Credit (Rs.)','Balance (Rs.)']],
    body:rows.length?rows:[['—','—','No transactions recorded','—','—','0']],
    theme:'grid',
    styles:{fontSize:8,cellPadding:3,overflow:'linebreak'},
    headStyles:{fillColor:[33,6,53],textColor:255},
    columnStyles:{2:{cellWidth:48}}
  });

  const finalY=doc.lastAutoTable.finalY+12;
  doc.setFont('helvetica','bold');
  doc.setFontSize(10);
  doc.text(`Total Debit: Rs. ${totalDebit.toLocaleString('en-PK')}`,14,finalY);
  doc.text(`Total Credit: Rs. ${totalCredit.toLocaleString('en-PK')}`,14,finalY+8);
  doc.setFontSize(12);
  doc.text(`Closing Balance: Rs. ${balance.toLocaleString('en-PK')}`,14,finalY+19);

  if(sorted.some(x=>String(x.kind).toLowerCase()==='adjustment')){
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.text('Note: Adjustment entries are displayed but excluded from the calculated balance.',14,finalY+28);
  }

  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  doc.text('Generated by MK Business Manager',14,285);
  const safeName=(party.name||'account').replace(/[^a-z0-9]/gi,'_');
  doc.save(`${safeName}_statement.pdf`);
}

function App(){
  const[token,setToken]=useState(localStorage.getItem('mk-token')||'');
  const[user,setUser]=useState(null);
  const[page,setPage]=useState('Dashboard');
  const[lang,setLang]=useState(localStorage.getItem('mk-lang')||'English');
  const[nav,setNav]=useState(false);
  const[toast,setToast]=useState('');
  const[refresh,setRefresh]=useState(0);

  const notify=m=>{
    setToast(m);
    setTimeout(()=>setToast(''),3000);
  };

  const logout=()=>{
    localStorage.removeItem('mk-token');
    setToken('');
    setUser(null);
  };

  useEffect(()=>{
    if(token)api('/auth/me',token).then(x=>setUser(x.user)).catch(logout);
  },[token]);

  const t=key=>translate(key,lang);

  if(!token||!user){
    return(
      <LanguageContext.Provider value={{lang,t}}>
        <Login onLogin={x=>{
          localStorage.setItem('mk-token',x.token);
          setToken(x.token);
          setUser(x.user);
        }}/>
      </LanguageContext.Provider>
    );
  }

  const navItems=[
    ['Dashboard',LayoutDashboard],['Customers',Users],['Suppliers',Truck],
    ['Orders',Package],['Transactions',ClipboardList],['Expenses',Receipt],
    ['Cash & Bank',Wallet],['Bills',FileImage],['Activity',Activity],
    ['Settings',Settings]
  ];

  return(
    <LanguageContext.Provider value={{lang,t}}>
      <div className={lang==='Urdu'?'app rtl':'app'}>
        <aside className={nav?'sidebar open':'sidebar'}>
          <div className="brand">
            <div className="monogram">M<span>K</span></div>
            <div><b>Mujahid Khilji</b><small>Iron & Steel Fabrication</small></div>
            <button className="mobile-close" onClick={()=>setNav(false)}><X/></button>
          </div>
          <div className="nav-label">WORKSPACE</div>
          {navItems.map(([n,I])=>(
            <button key={n} className={'nav-item '+(page===n?'active':'')} onClick={()=>{setPage(n);setNav(false)}}>
              <I size={18}/><span>{t(n)}</span>
            </button>
          ))}
          <div className="sidebar-bottom">
            <div className="profile">
              <div className="avatar">{user.name?.[0]||'M'}</div>
              <div><b>{user.name}</b><small>Administrator</small></div>
            </div>
            <button className="nav-item" onClick={logout}><LogOut size={18}/>Sign out</button>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <button className="menu-btn" onClick={()=>setNav(true)}><Menu/></button>
            <div><div className="eyebrow">MK BUSINESS MANAGER</div><h1>{t(page)}</h1></div>
            <div className="top-actions">
              <button className="icon-btn" onClick={()=>{
                const next=lang==='English'?'Urdu':'English';
                setLang(next);
                localStorage.setItem('mk-lang',next);
              }}><Globe size={17}/>{lang}</button>
              <div className="avatar">{user.name?.[0]||'M'}</div>
            </div>
          </header>
          <div className="content">
            <Page page={page} token={token} refresh={refresh} bump={()=>setRefresh(x=>x+1)} notify={notify} user={user}/>
          </div>
        </main>
        {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
      </div>
    </LanguageContext.Provider>
  );
}

function Login({onLogin}){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const[busy,setBusy]=useState(false);
  const[err,setErr]=useState('');

  async function submit(e){
    e.preventDefault();
    setBusy(true);
    setErr('');
    try{onLogin(await api('/auth/login',null,{method:'POST',body:JSON.stringify({email,password})}));}
    catch(x){setErr(x.message);}
    finally{setBusy(false);}
  }

  return(
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand login-brand">
          <div className="monogram">M<span>K</span></div>
          <div><b>Mujahid Khilji</b><small>Iron & Steel Fabrication</small></div>
        </div>
        <div className="login-intro">
          <span className="pill">BUSINESS MANAGEMENT</span>
          <h1>Welcome back.</h1>
          <p>Sign in to manage your business accounts, orders and ledgers.</p>
        </div>
        <form onSubmit={submit}>
  <label>Email address</label>
  <input
    type="email"
    value={email}
    onChange={e => setEmail(e.target.value)}
    placeholder="Enter your admin email"
    autoComplete="username"
    required
  />

  <label>Password</label>
  <input
    type="password"
    value={password}
    onChange={e => setPassword(e.target.value)}
    placeholder="Enter your password"
    autoComplete="current-password"
    required
  />

  {err && <p className="error">{err}</p>}

  <button className="primary full" disabled={busy}>
    {busy ? 'Signing in…' : 'Sign in to workspace'}
  </button>
</form>
        <div className="login-foot">Secure local business workspace · MK</div>
      </div>
    </div>
  );
}

function Page({page,token,refresh,bump,notify,user}){
  const[stats,setStats]=useState(null);

  useEffect(()=>{
    api('/dashboard',token).then(setStats).catch(()=>{});
  },[token,refresh]);

  if(page==='Dashboard')return <Dashboard stats={stats}/>;
  if(page==='Customers'||page==='Suppliers'){
    return <Parties type={page==='Customers'?'customers':'suppliers'} token={token} refresh={refresh} bump={bump} notify={notify}/>;
  }
  if(page==='Transactions')return <Transactions token={token} refresh={refresh} bump={bump} notify={notify}/>;
  if(page==='Orders')return <Orders token={token} refresh={refresh} bump={bump} notify={notify}/>;
  if(page==='Expenses')return <Expenses token={token} refresh={refresh} bump={bump} notify={notify}/>;
  if(page==='Cash & Bank')return <Cash token={token} refresh={refresh} bump={bump} notify={notify}/>;
  if(page==='Bills')return <Bills token={token} refresh={refresh} bump={bump} notify={notify}/>;
  if(page==='Activity')return <ActivityPage token={token} refresh={refresh}/>;
  return <SettingsPage token={token} notify={notify}/>;
}

function Dashboard({stats:s}){
  if(!s)return <div className="loading">Loading your business overview…</div>;

  const cards=[
    ['Customers',s.customers,Users,'blue'],
    ['Suppliers',s.suppliers,Truck,'purple'],
    ['Order value',money(s.orderValue),Package,'green'],
    ['Cash in hand',money(s.cash),Wallet,'orange'],
    ['Customer receivable',money(s.receivable),ArrowDownLeft,'green'],
    ['Supplier payable',money(s.payable),ArrowUpRight,'red']
  ];

  return(
    <>
      <div className="welcome-row">
        <div><h2>Good business starts with clear records.</h2><p>Your business overview at a glance.</p></div>
        <span className="live"><i/> DATA SYNCED LOCALLY</span>
      </div>
      <div className="stats-grid">
        {cards.map(([label,value,I,color])=>(
          <div className="stat-card" key={label}>
            <div className={'stat-icon '+color}><I size={19}/></div>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>
      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <div><h3>Recent transactions</h3><p>Latest activity across your ledgers</p></div>
            <span className="subtle-tag">LATEST 8</span>
          </div>
          {s.recent.length?
            <div className="table-wrap">
              <table>
                <thead><tr><th>PARTY</th><th>TYPE</th><th>AMOUNT</th><th>DATE</th></tr></thead>
                <tbody>
                  {s.recent.map(x=>(
                    <tr key={x.id}>
                      <td><b>{x.party_name||'—'}</b><small>{x.description}</small></td>
                      <td><span className="type-tag">{x.kind}</span></td>
                      <td className="amount">{money(x.amount)}</td>
                      <td>{date(x.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            :<Empty text="No transactions yet. Add your first customer or supplier entry."/>
          }
        </section>
        <section className="panel summary-panel">
          <div className="panel-head"><div><h3>Financial snapshot</h3><p>Totals recorded so far</p></div></div>
          {[
            ['Received from customers',money(s.received),'green'],
            ['Paid to suppliers',money(s.paid),'red'],
            ['Purchases recorded',money(s.purchases),''],
            ['Business expenses',money(s.expenses),'red'],
            ['Bank balance',money(s.bank),'blue']
          ].map(([a,b,c])=>(
            <div className="summary-line" key={a}><span>{a}</span><b className={c}>{b}</b></div>
          ))}
        </section>
      </div>
      <div className="note-banner">
        <AlertCircle size={18}/>
        <div>
          <b>Important accounting note</b>
          <p>Record each customer order as an “Order” transaction and each supplier purchase as a “Purchase”. Payments are tracked separately. Cash & Bank entries are manual and are not automatically posted from ledger transactions, to prevent accidental double counting.</p>
        </div>
      </div>
    </>
  );
}

function Empty({text}){
  return <div className="empty"><div className="empty-icon"><ClipboardList/></div><p>{text}</p></div>;
}

function Modal({title,close,children}){
  return(
    <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}>
      <div className="modal">
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={close}><X size={18}/></button></div>
        {children}
      </div>
    </div>
  );
}


function Parties({type,token,refresh,bump,notify}){
  const[rows,setRows]=useState([]);
  const[q,setQ]=useState('');
  const[show,setShow]=useState(false);
  const[edit,setEdit]=useState(null);
  const[form,setForm]=useState({name:'',phone:'',address:'',notes:''});
  const[ledger,setLedger]=useState(null);
  const[tx,setTx]=useState([]);

  const title=type==='customers'?'Customer':'Supplier';

  useEffect(()=>{
    api('/'+type,token).then(setRows).catch(e=>notify(e.message));
  },[type,token,refresh]);

  const filtered=rows.filter(x=>(x.name+x.phone+x.address).toLowerCase().includes(q.toLowerCase()));

  function open(x){
    setEdit(x);
    setForm(x?{...x}:{name:'',phone:'',address:'',notes:''});
    setShow(true);
  }

  async function save(e){
    e.preventDefault();
    try{
      await api('/'+type+(edit?'/'+edit.id:''),token,{
        method:edit?'PUT':'POST',
        body:JSON.stringify(form)
      });
      setShow(false);
      bump();
      notify(title+' saved successfully');
    }catch(x){notify(x.message);}
  }

  async function openLedger(x){
    setLedger(x);
    setTx([]);
    try{
      const all=await api('/transactions',token);
      setTx(all.filter(t=>t.party_type===(type==='customers'?'customer':'supplier')&&t.party_id===x.id));
    }catch(error){
      notify(error.message);
    }
  }

  return(
    <>
      <div className="page-toolbar">
        <div><h2>{title} directory</h2><p>Maintain individual business contacts and their account history.</p></div>
        <button className="primary" onClick={()=>open(null)}><Plus size={17}/> Add {title}</button>
      </div>

      <div className="panel">
        <div className="panel-tools">
          <div className="searchbox"><Search size={17}/><input placeholder={'Search '+title.toLowerCase()+'s…'} value={q} onChange={e=>setQ(e.target.value)}/></div>
          <span className="count">{filtered.length} records</span>
        </div>
        {filtered.length?
          <div className="table-wrap">
            <table>
              <thead><tr><th>NAME</th><th>PHONE</th><th>ADDRESS</th><th>ADDED</th><th></th></tr></thead>
              <tbody>
                {filtered.map(x=>(
                  <tr key={x.id}>
                    <td><b>{x.name}</b><small>{x.notes}</small></td>
                    <td>{x.phone||'—'}</td>
                    <td>{x.address||'—'}</td>
                    <td>{date(x.created_at)}</td>
                    <td>
                      <button className="text-btn" onClick={()=>openLedger(x)}>View ledger</button>
                      <button className="icon-btn small" onClick={()=>open(x)}><Edit3 size={15}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          :<Empty text={'No '+title.toLowerCase()+' records yet. Add one to get started.'}/>
        }
      </div>

      {show&&(
        <Modal title={(edit?'Edit ':'Add ')+title} close={()=>setShow(false)}>
          <form className="form-grid" onSubmit={save}>
            <label className="span2">Full name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
            <label>Phone<input value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
            <label>Address<input value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})}/></label>
            <label className="span2">Notes<textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
            <div className="modal-actions span2">
              <button type="button" className="secondary" onClick={()=>setShow(false)}>Cancel</button>
              <button className="primary">Save {title}</button>
            </div>
          </form>
        </Modal>
      )}

      {ledger&&(
        <Modal title={ledger.name+' · Ledger'} close={()=>setLedger(null)}>
          <div className="ledger-head">
            <b>{ledger.phone||'No phone'}</b>
            <span>{ledger.address}</span>
          </div>

          <div className="modal-actions">
            <button className="primary" onClick={()=>downloadPartyStatement(ledger,type,tx)}>
              <Download size={17}/> Download PDF Statement
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr><th>DATE</th><th>TYPE</th><th>DESCRIPTION</th><th>AMOUNT</th></tr></thead>
              <tbody>
                {tx.map(x=>(
                  <tr key={x.id}>
                    <td>{date(x.created_at)}</td>
                    <td>{x.kind}</td>
                    <td>{x.description}</td>
                    <td>{money(x.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!tx.length&&<Empty text="No ledger entries for this account yet."/>}
        </Modal>
      )}
    </>
  );
}


function Transactions({token,refresh,bump,notify}){
  const[rows,setRows]=useState([]);
  const[customers,setCustomers]=useState([]);
  const[suppliers,setSuppliers]=useState([]);
  const[show,setShow]=useState(false);
  const[edit,setEdit]=useState(null);
  const[q,setQ]=useState('');
  const[f,setF]=useState({party_type:'customer',party_id:'',kind:'order',description:'',amount:'',method:'Cash'});

  const load=()=>{
    api('/transactions',token).then(setRows);
    api('/customers',token).then(setCustomers);
    api('/suppliers',token).then(setSuppliers);
  };

  useEffect(load,[token,refresh]);
  const parties=f.party_type==='customer'?customers:suppliers;

  function open(x){
    setEdit(x);
    setF(x?{...x,party_id:String(x.party_id)}:{party_type:'customer',party_id:'',kind:'order',description:'',amount:'',method:'Cash'});
    setShow(true);
  }

  async function save(e){
    e.preventDefault();
    try{
      if(edit)await api('/transactions/'+edit.id,token,{method:'PUT',body:JSON.stringify(f)});
      else await api('/transactions',token,{method:'POST',body:JSON.stringify(f)});
      setShow(false);bump();notify('Transaction saved');
    }catch(x){notify(x.message);}
  }

  async function voidTx(x){
    if(!confirm('Void this transaction? It will remain in the audit history.'))return;
    try{
      await api('/transactions/'+x.id,token,{method:'DELETE'});
      bump();notify('Transaction voided');
    }catch(e){notify(e.message);}
  }

  const filtered=rows.filter(x=>(x.party_name+x.description+x.kind).toLowerCase().includes(q.toLowerCase()));

  return(
    <>
      <div className="page-toolbar">
        <div><h2>Business logbook</h2><p>One shared record of customer and supplier transactions.</p></div>
        <button className="primary" onClick={()=>open(null)}><Plus size={17}/> Add transaction</button>
      </div>
      <div className="panel">
        <div className="panel-tools">
          <div className="searchbox"><Search size={17}/><input placeholder="Search logbook…" value={q} onChange={e=>setQ(e.target.value)}/></div>
          <span className="count">{filtered.length} entries</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>DATE</th><th>PARTY</th><th>TYPE</th><th>DESCRIPTION</th><th>METHOD</th><th>AMOUNT</th><th></th></tr></thead>
            <tbody>
              {filtered.map(x=>(
                <tr key={x.id}>
                  <td>{date(x.created_at)}</td>
                  <td><b>{x.party_name}</b><small>{x.party_type}</small></td>
                  <td><span className="type-tag">{x.kind}</span></td>
                  <td>{x.description}</td>
                  <td>{x.method}</td>
                  <td className="amount">{money(x.amount)}</td>
                  <td>
                    <button className="icon-btn small" onClick={()=>open(x)}><Edit3 size={15}/></button>
                    <button className="text-btn danger-text" onClick={()=>voidTx(x)}>Void</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length&&<Empty text="No matching transactions."/>}
      </div>

      {show&&(
        <Modal title={edit?'Edit transaction':'New transaction'} close={()=>setShow(false)}>
          <form className="form-grid" onSubmit={save}>
            <label>Account type
              <select value={f.party_type} onChange={e=>setF({...f,party_type:e.target.value,party_id:''})}>
                <option value="customer">Customer</option><option value="supplier">Supplier</option>
              </select>
            </label>
            <label>Customer / Supplier
              <select required value={f.party_id} onChange={e=>setF({...f,party_id:e.target.value})}>
                <option value="">Select account</option>
                {parties.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label>Transaction type
              <select value={f.kind} onChange={e=>setF({...f,kind:e.target.value})}>
                {(f.party_type==='customer'?[['order','Order value'],['received','Payment received'],['adjustment','Adjustment']]:[['purchase','Material purchase'],['paid','Payment sent'],['adjustment','Adjustment']]).map(([v,l])=><option value={v} key={v}>{l}</option>)}
              </select>
            </label>
            <label>Amount (Rs)<input type="number" min="0.01" step="0.01" required value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></label>
            <label className="span2">Description<input value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label>
            <label>Payment method
              <select value={f.method} onChange={e=>setF({...f,method:e.target.value})}>
                {['Cash','Bank transfer','JazzCash','Easypaisa','Other'].map(x=><option key={x}>{x}</option>)}
              </select>
            </label>
            <div className="modal-actions span2">
              <button type="button" className="secondary" onClick={()=>setShow(false)}>Cancel</button>
              <button className="primary">Save transaction</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Orders({token,refresh,bump,notify}){
  const[rows,setRows]=useState([]);
  const[customers,setCustomers]=useState([]);
  const[show,setShow]=useState(false);
  const[f,setF]=useState({customer_id:'',title:'',description:'',total:'',advance:'0',delivery_date:'',status:'Pending'});

  useEffect(()=>{
    api('/orders',token).then(setRows);
    api('/customers',token).then(setCustomers);
  },[token,refresh]);

  async function save(e){
    e.preventDefault();
    try{
      await api('/orders',token,{method:'POST',body:JSON.stringify(f)});
      setShow(false);bump();notify('Order created');
    }catch(x){notify(x.message);}
  }

  async function status(id,status){
    try{
      await api('/orders/'+id,token,{method:'PUT',body:JSON.stringify({status})});
      bump();
    }catch(e){notify(e.message);}
  }

  return(
    <>
      <div className="page-toolbar">
        <div><h2>Fabrication orders</h2><p>Track custom jobs, advances and delivery progress.</p></div>
        <button className="primary" onClick={()=>setShow(true)}><Plus size={17}/> New order</button>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>PROJECT</th><th>VALUE</th><th>ADVANCE</th><th>DELIVERY</th><th>STATUS</th></tr></thead>
            <tbody>
              {rows.map(x=>(
                <tr key={x.id}>
                  <td><b>{x.order_no}</b></td><td>{x.customer_name}</td>
                  <td><b>{x.title}</b><small>{x.description}</small></td>
                  <td>{money(x.total)}</td><td>{money(x.advance)}</td>
                  <td>{x.delivery_date||'—'}</td>
                  <td>
                    <select className="inline-select" value={x.status} onChange={e=>status(x.id,e.target.value)}>
                      {['Pending','In Progress','Completed','Delivered'].map(y=><option key={y}>{y}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length&&<Empty text="No fabrication orders yet."/>}
      </div>
      {show&&(
        <Modal title="Create fabrication order" close={()=>setShow(false)}>
          <form className="form-grid" onSubmit={save}>
            <label className="span2">Customer
              <select required value={f.customer_id} onChange={e=>setF({...f,customer_id:e.target.value})}>
                <option value="">Choose customer</option>
                {customers.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label className="span2">Project title<input required value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></label>
            <label className="span2">Work description<textarea value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label>
            <label>Total agreed price<input required type="number" min="1" value={f.total} onChange={e=>setF({...f,total:e.target.value})}/></label>
            <label>Advance received<input type="number" min="0" value={f.advance} onChange={e=>setF({...f,advance:e.target.value})}/></label>
            <label>Expected delivery<input type="date" value={f.delivery_date} onChange={e=>setF({...f,delivery_date:e.target.value})}/></label>
            <div className="modal-actions span2">
              <button type="button" className="secondary" onClick={()=>setShow(false)}>Cancel</button>
              <button className="primary">Create order</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Expenses({token,refresh,bump,notify}){
  const[rows,setRows]=useState([]);
  const[show,setShow]=useState(false);
  const[f,setF]=useState({category:'Labour',description:'',amount:'',method:'Cash',expense_date:new Date().toISOString().slice(0,10)});

  useEffect(()=>{api('/expenses',token).then(setRows)},[token,refresh]);

  async function save(e){
    e.preventDefault();
    try{
      await api('/expenses',token,{method:'POST',body:JSON.stringify(f)});
      setShow(false);bump();notify('Expense saved');
    }catch(x){notify(x.message);}
  }

  return(
    <>
      <div className="page-toolbar">
        <div><h2>Business expenses</h2><p>Record workshop and operating costs.</p></div>
        <button className="primary" onClick={()=>setShow(true)}><Plus size={17}/> Add expense</button>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>DATE</th><th>CATEGORY</th><th>DESCRIPTION</th><th>METHOD</th><th>AMOUNT</th></tr></thead>
            <tbody>
              {rows.map(x=>(
                <tr key={x.id}><td>{date(x.expense_date)}</td><td>{x.category}</td><td>{x.description}</td><td>{x.method}</td><td className="amount">{money(x.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length&&<Empty text="No expenses recorded."/>}
      </div>
      {show&&(
        <Modal title="Add business expense" close={()=>setShow(false)}>
          <form className="form-grid" onSubmit={save}>
            <label>Category
              <select value={f.category} onChange={e=>setF({...f,category:e.target.value})}>
                {['Labour','Transportation','Electricity','Workshop expenses','Maintenance','Other'].map(x=><option key={x}>{x}</option>)}
              </select>
            </label>
            <label>Amount<input type="number" min="0.01" required value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></label>
            <label className="span2">Description<input value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label>
            <label>Date<input type="date" value={f.expense_date} onChange={e=>setF({...f,expense_date:e.target.value})}/></label>
            <label>Payment method
              <select value={f.method} onChange={e=>setF({...f,method:e.target.value})}>
                {['Cash','Bank transfer','JazzCash','Easypaisa','Other'].map(x=><option key={x}>{x}</option>)}
              </select>
            </label>
            <div className="modal-actions span2">
              <button type="button" className="secondary" onClick={()=>setShow(false)}>Cancel</button>
              <button className="primary">Save expense</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Cash({token,refresh,bump,notify}){
  const[data,setData]=useState({rows:[],balances:{Cash:0,Bank:0}});
  const[show,setShow]=useState(false);
  const[f,setF]=useState({direction:'in',account:'Cash',amount:'',description:'',entry_date:new Date().toISOString().slice(0,10)});

  useEffect(()=>{api('/cash',token).then(setData)},[token,refresh]);

  async function save(e){
    e.preventDefault();
    try{
      await api('/cash',token,{method:'POST',body:JSON.stringify(f)});
      setShow(false);bump();notify('Cash / bank entry saved');
    }catch(x){notify(x.message);}
  }

  return(
    <>
      <div className="page-toolbar">
        <div><h2>Cash & bank book</h2><p>Manual balances and money movement. No bank account connection.</p></div>
        <button className="primary" onClick={()=>setShow(true)}><Plus size={17}/> Add entry</button>
      </div>
      <div className="stats-grid two">
        <div className="stat-card"><div className="stat-icon green"><Wallet/></div><div className="stat-label">Cash balance</div><div className="stat-value">{money(data.balances.Cash)}</div></div>
        <div className="stat-card"><div className="stat-icon blue"><Activity/></div><div className="stat-label">Bank balance</div><div className="stat-value">{money(data.balances.Bank)}</div></div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>DATE</th><th>ACCOUNT</th><th>DIRECTION</th><th>DESCRIPTION</th><th>AMOUNT</th></tr></thead>
            <tbody>
              {data.rows.map(x=>(
                <tr key={x.id}>
                  <td>{date(x.entry_date)}</td><td>{x.account}</td>
                  <td><span className={'type-tag '+(x.direction==='in'?'good':'bad')}>{x.direction==='in'?'Money in':'Money out'}</span></td>
                  <td>{x.description}</td><td className="amount">{money(x.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.rows.length&&<Empty text="No cash or bank entries yet. Add an opening balance as money in."/>}
      </div>
      {show&&(
        <Modal title="Cash / bank entry" close={()=>setShow(false)}>
          <form className="form-grid" onSubmit={save}>
            <label>Direction<select value={f.direction} onChange={e=>setF({...f,direction:e.target.value})}><option value="in">Money in</option><option value="out">Money out</option></select></label>
            <label>Account<select value={f.account} onChange={e=>setF({...f,account:e.target.value})}><option>Cash</option><option>Bank</option></select></label>
            <label>Amount<input type="number" min="0.01" required value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></label>
            <label>Date<input type="date" value={f.entry_date} onChange={e=>setF({...f,entry_date:e.target.value})}/></label>
            <label className="span2">Description<input value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label>
            <div className="modal-actions span2">
              <button type="button" className="secondary" onClick={()=>setShow(false)}>Cancel</button>
              <button className="primary">Save entry</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Bills({token,refresh,bump,notify}){
  const[rows,setRows]=useState([]);
  const[file,setFile]=useState(null);
  const[busy,setBusy]=useState(false);
  const[bill,setBill]=useState(null);
  const[text,setText]=useState('');
  const[total,setTotal]=useState('');
  const[billDate,setBillDate]=useState('');
  const[partyType,setPartyType]=useState('');
  const[partyId,setPartyId]=useState('');
  const[customers,setCustomers]=useState([]);
  const[suppliers,setSuppliers]=useState([]);

  const load=()=>{
    api('/bills',token).then(setRows);
    api('/customers',token).then(setCustomers);
    api('/suppliers',token).then(setSuppliers);
  };

  useEffect(load,[token,refresh]);

  async function scan(e){
    e.preventDefault();
    if(!file)return;
    setBusy(true);
    try{
      const fd=new FormData();
      fd.append('bill',file);
      const uploaded=await api('/bills/upload',token,{method:'POST',body:fd});
      setBill({...uploaded});
      const result=await Tesseract.recognize(file,'eng',{logger:()=>{}});
      setText(result.data.text);
      const match=result.data.text.match(/(?:total|grand total|net amount)[^\d]{0,15}([\d,]+(?:\.\d{1,2})?)/i);
      setTotal(match?match[1].replace(/,/g,''):'');
      setBillDate('');
      notify('Bill scanned. Please review the extracted text.');
    }catch(x){notify(x.message);}
    finally{setBusy(false);}
  }

  async function saveBill(){
    try{
      await api('/bills/'+bill.id,token,{
        method:'PUT',
        body:JSON.stringify({
          extracted_text:text,corrected_text:text,
          party_type:partyType,party_id:partyId||null,
          bill_date:billDate,total
        })
      });
      setBill(null);setFile(null);setText('');bump();notify('Reviewed bill saved');
    }catch(x){notify(x.message);}
  }

  return(
    <>
      <div className="page-toolbar">
        <div><h2>Bill scanner & archive</h2><p>Upload bill photos, extract text with OCR, then correct mistakes before saving.</p></div>
        <span className="pill">OCR POWERED</span>
      </div>
      <div className="bill-grid">
        <section className="panel upload-panel">
          <div className="upload-icon"><Upload/></div>
          <h3>Scan a bill or receipt</h3>
          <p>Upload a clear photo (JPG or PNG, up to 12 MB). English OCR is enabled.</p>
          <form onSubmit={scan}>
            <label className="file-drop">
              <FileImage size={24}/><b>{file?file.name:'Choose bill image / PDF'}</b><small>JPG or PNG</small>
              <input type="file" accept="image/*" onChange={e=>setFile(e.target.files[0])}/>
            </label>
            <button className="primary full" disabled={!file||busy}>{busy?'Scanning bill…':'Upload & scan bill'}</button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div><h3>Saved bills</h3><p>Original files remain attached to the record.</p></div>
            <span className="count">{rows.length} bills</span>
          </div>
          {rows.length?rows.map(x=>(
            <div className="bill-row" key={x.id}>
              <div className="file-mini"><FileImage/></div>
              <div className="bill-info"><b>{x.original_name}</b><small>{date(x.created_at)} · {x.party_name||'Unassigned'}</small></div>
              <a className="text-btn" href={x.url} target="_blank" rel="noreferrer">View file</a>
              <button className="icon-btn small" onClick={()=>{
                setBill(x);setText(x.corrected_text||x.extracted_text||'');
                setTotal(String(x.total||''));setBillDate(x.bill_date||'');
                setPartyType(x.party_type||'');setPartyId(String(x.party_id||''));
              }}><Edit3 size={15}/></button>
            </div>
          )):<Empty text="No bills uploaded yet."/>}
        </section>
      </div>

      {bill&&(
        <Modal title="Review and edit scanned bill" close={()=>setBill(null)}>
          <div className="scan-review">
            <div className="note-banner compact"><AlertCircle size={17}/><p>OCR can make mistakes. Check every amount and detail before saving.</p></div>
            <label>Extracted text — editable<textarea className="ocr-text" rows="12" value={text} onChange={e=>setText(e.target.value)}/></label>
            <div className="form-grid">
              <label>Bill date<input type="date" value={billDate} onChange={e=>setBillDate(e.target.value)}/></label>
              <label>Total amount (Rs)<input type="number" min="0" step="0.01" value={total} onChange={e=>setTotal(e.target.value)}/></label>
              <label>Link to account
                <select value={partyType} onChange={e=>{setPartyType(e.target.value);setPartyId('')}}>
                  <option value="">Not linked</option><option value="customer">Customer</option><option value="supplier">Supplier</option>
                </select>
              </label>
              <label>Account
                <select disabled={!partyType} value={partyId} onChange={e=>setPartyId(e.target.value)}>
                  <option value="">Choose</option>
                  {(partyType==='customer'?customers:suppliers).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={()=>setBill(null)}>Cancel</button>
              <button className="primary" onClick={saveBill}>Save corrected bill</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function ActivityPage({token,refresh}){
  const[rows,setRows]=useState([]);
  useEffect(()=>{api('/audit',token).then(setRows)},[token,refresh]);

  return(
    <>
      <div className="page-toolbar"><div><h2>Admin activity & audit trail</h2><p>Track who created, edited or voided business records.</p></div></div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>TIME</th><th>ADMIN</th><th>ACTION</th><th>RECORD</th><th>DETAILS</th></tr></thead>
            <tbody>
              {rows.map(x=>(
                <tr key={x.id}>
                  <td>{date(x.created_at)}</td><td>{x.admin_name||'System'}</td>
                  <td><span className="type-tag">{x.action}</span></td>
                  <td>{x.entity} #{x.entity_id}</td><td className="details-cell">{x.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length&&<Empty text="Activity will appear here as you use the app."/>}
      </div>
    </>
  );
}



function SettingsPage({token,notify}){
  const[name,setName]=useState('');
  const[email,setEmail]=useState('');
  const[password,setPassword]=useState('');
  const[backupLoading,setBackupLoading]=useState(false);

  async function add(e){
    e.preventDefault();
    try{
      await api('/auth/admins',token,{
        method:'POST',
        body:JSON.stringify({name,email,password})
      });
      setName('');
      setEmail('');
      setPassword('');
      notify('Admin account created');
    }catch(x){notify(x.message);}
  }

  async function downloadBackup(){
    setBackupLoading(true);

    try{
      const response=await fetch('/api/backup',{
        headers:{
          Authorization:`Bearer ${token}`
        }
      });

      if(!response.ok){
        const error=await response.json().catch(()=>({}));
        throw new Error(error.message || 'Backup download failed');
      }

      const blob=await response.blob();
      const url=window.URL.createObjectURL(blob);
      const link=document.createElement('a');

      link.href=url;
      link.download=`mk-business-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
      notify('Database backup downloaded successfully');
    }catch(x){
      notify(x.message);
    }finally{
      setBackupLoading(false);
    }
  }

  return(
    <>
      <div className="page-toolbar">
        <div>
          <h2>Workspace settings</h2>
          <p>Business identity, administrators and data protection.</p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="panel">
          <h3>Business identity</h3>
          <div className="identity-preview">
            <div className="monogram">M<span>K</span></div>
            <div>
              <b>Mujahid Khilji</b>
              <small>(Iron & Steel Fabrication)</small>
            </div>
          </div>
          <p className="muted">Your MK branding is used across the workspace.</p>
        </section>

        <section className="panel">
          <h3>Add second administrator</h3>
          <p className="muted">Both admins share the same local database on this server.</p>

          <form className="settings-form" onSubmit={add}>
            <label>
              Full name
              <input required value={name} onChange={e=>setName(e.target.value)}/>
            </label>

            <label>
              Email
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/>
            </label>

            <label>
              Temporary password
              <input type="password" minLength="8" required value={password} onChange={e=>setPassword(e.target.value)}/>
            </label>

            <button className="primary">Create administrator</button>
          </form>
        </section>

        <section className="panel">
          <h3>Database backup</h3>
          <p className="muted">
            Download a copy of your customers, suppliers, transactions,
            orders and other business records.
          </p>

          <button
            type="button"
            className="primary"
            onClick={downloadBackup}
            disabled={backupLoading}
          >
            {backupLoading ? 'Preparing backup...' : 'Download Database Backup'}
          </button>

          <p className="muted">
            Keep your downloaded backup somewhere safe.
          </p>
        </section>
      </div>
    </>
  );
}



createRoot(document.getElementById('root')).render(<App/>);
