
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(BOOKINGS_FILE)) fs.writeFileSync(BOOKINGS_FILE, '[]');
if (!fs.existsSync(SCHEDULES_FILE)) fs.writeFileSync(SCHEDULES_FILE, '[]');
if (!fs.existsSync(CONTACTS_FILE)) fs.writeFileSync(CONTACTS_FILE, '[]');

function readJSON(f){ try{ return JSON.parse(fs.readFileSync(f)); } catch(e){ return []; } }
function writeJSON(f,d){ fs.writeFileSync(f, JSON.stringify(d, null, 2)); }

app.set('view engine','ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/images', express.static(path.join(__dirname,'public','images')));
app.use('/css', express.static(path.join(__dirname,'public','css')));
app.use('/js', express.static(path.join(__dirname,'public','js')));
app.use(express.static(path.join(__dirname,'public')));

app.use(bodyParser.urlencoded({ extended:true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ secret: process.env.SESSION_SECRET || 'tellusmove_secret', resave:false, saveUninitialized:true }));

// Home
app.get('/', (req,res)=> res.render('home'));

// Book flow: user submits request -> saved as pending and user sees request_sent page (no ID shown)
app.get('/book', (req,res)=> res.render('book'));
app.post('/book', (req,res)=>{
  const { name, email, phone, pickup, dropoff, truckType, date } = req.body;
  const bookings = readJSON(BOOKINGS_FILE);
  const id = 'REQ-' + Date.now().toString(36).toUpperCase().slice(0,8);
  const b = { id, name, email, phone, pickup, dropoff, truckType, date, status: 'pending', createdAt: new Date().toISOString() };
  bookings.push(b);
  writeJSON(BOOKINGS_FILE, bookings);
  return res.render('request_sent', { name });
});

// Preview route kept for form preview before submission
app.post('/preview', (req,res)=> { const data = req.body; res.render('preview', { data }); });

// Track - only confirmed bookings are trackable and require booking ID
app.get('/track', (req,res)=> res.render('track'));
app.post('/track', (req,res)=>{
  const { bookingId } = req.body;
  const bookings = readJSON(BOOKINGS_FILE);
  const found = bookings.find(b => b.id === bookingId && b.status === 'confirmed');
  return res.render('track', { result: found });
});

// Schedules - only show confirmed schedules and hide email/phone for privacy
app.get('/schedules', (req,res)=>{
  const schedules = readJSON(SCHEDULES_FILE);
  res.render('schedules', { schedules });
});

// Alerts, About, Contact
app.get('/alerts', (req,res)=> res.render('alerts'));
app.get('/about', (req,res)=> res.render('about'));
app.get('/contact', (req,res)=> res.render('contact'));
app.post('/contact', (req,res)=>{
  const { name, email, message } = req.body;
  const contacts = readJSON(CONTACTS_FILE);
  contacts.push({ id: 'C-'+Date.now().toString(36), name, email, message, createdAt: new Date().toISOString() });
  writeJSON(CONTACTS_FILE, contacts);
  res.render('contact', { success:true });
});

// Admin area (not in navbar)
app.get('/admin', (req,res)=>{
  const bookings = readJSON(BOOKINGS_FILE);
  res.render('admin-login', { bookings });
});
app.post('/admin/login', (req,res)=>{
  const { username, password } = req.body;
  if (username === 'gaurav' && password === 'gaurav') {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }
  return res.render('admin-login', { error: 'Invalid credentials' });
});
app.get('/admin/dashboard', (req,res)=>{
  if (!req.session.isAdmin) return res.redirect('/admin');
  const bookings = readJSON(BOOKINGS_FILE);
  res.render('admin-dashboard', { bookings });
});

// Admin confirms: move booking to schedules WITHOUT email/phone
app.post('/admin/confirm/:id', (req,res)=>{
  if (!req.session.isAdmin) return res.redirect('/admin');
  const id = req.params.id;
  const bookings = readJSON(BOOKINGS_FILE);
  const idx = bookings.findIndex(b => b.id === id);
  if (idx !== -1) {
    bookings[idx].status = 'confirmed';
    const schedules = readJSON(SCHEDULES_FILE);
    const b = bookings[idx];
    schedules.push({ id: b.id, name: b.name, pickup: b.pickup, dropoff: b.dropoff, truckType: b.truckType, date: b.date, status: 'Scheduled' });
    writeJSON(SCHEDULES_FILE, schedules);
    writeJSON(BOOKINGS_FILE, bookings);
  }
  return res.redirect('/admin/dashboard');
});

// Admin cancel: remove request completely
app.post('/admin/cancel/:id', (req,res)=>{
  if (!req.session.isAdmin) return res.redirect('/admin');
  const id = req.params.id;
  let bookings = readJSON(BOOKINGS_FILE);
  bookings = bookings.filter(b => b.id !== id);
  writeJSON(BOOKINGS_FILE, bookings);
  return res.redirect('/admin/dashboard');
});

app.get('/admin-logout', (req,res)=> { req.session.destroy(()=>res.redirect('/')); });

// Coming soon page for payments
app.get('/comingsoon', (req,res)=> res.render('coming-soon'));

// 404 fallback
app.use((req,res)=> res.status(404).render('404'));

app.listen(PORT, ()=> console.log('TellUsMove v8 running on', PORT));
