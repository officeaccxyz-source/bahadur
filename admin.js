import{initializeApp}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,setPersistence,browserLocalPersistence,browserSessionPersistence,sendPasswordResetEmail}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import{getFunctions,httpsCallable}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js";
import{getFirestore,collection,getDocs,query,orderBy,limit,doc,updateDoc}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import{firebaseConfig}from"./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),functions=getFunctions(app,"asia-southeast1"),db=getFirestore(app);
const callList=httpsCallable(functions,"listAppointments"),updateStatus=httpsCallable(functions,"updateAppointmentStatus");
const loginCard=document.getElementById("login-card"),dashboard=document.getElementById("dashboard"),loginError=document.getElementById("login-error"),dashError=document.getElementById("dashboard-error"),list=document.getElementById("appointments");
let rows=[],inquiries=[],filter="all",busy=false,authCheck=0;
const $=id=>document.getElementById(id),REMEMBER_KEY="bahadu_admin_email_v1";
function friendlyAuthError(err){
 const code=err?.code||"";
 const messages={
  "auth/invalid-email":"Email လိပ်စာပုံစံ မမှန်ပါ။",
  "auth/user-not-found":"ဤ Email ဖြင့် အကောင့်မတွေ့ပါ။",
  "auth/wrong-password":"Password မှားနေပါတယ်။ ပြန်စစ်ပြီး ထပ်ကြိုးစားပါ။",
  "auth/invalid-credential":"Email သို့မဟုတ် Password မမှန်ပါ။",
  "auth/too-many-requests":"Login ကြိုးစားမှုများလွန်းနေပါသည်။ ခဏစောင့်ပြီး ပြန်ကြိုးစားပါ။",
  "auth/network-request-failed":"အင်တာနက်ချိတ်ဆက်မှု မတည်ငြိမ်ပါ။",
  "auth/user-disabled":"ဤအကောင့်ကို ပိတ်ထားပါသည်။ Administrator ကို ဆက်သွယ်ပါ။",
  "auth/operation-not-allowed":"Firebase Authentication တွင် Email/Password Login ကို ဖွင့်ထားခြင်းရှိမရှိ စစ်ဆေးရန်လိုပါသည်။",
  "auth/unauthorized-domain":"ဤ Website domain ကို Firebase Authentication > Authorized domains တွင် ထည့်ရန်လိုပါသည်။",
  "auth/invalid-api-key":"Firebase API Key မမှန်ပါ။ firebase-config.js ကို စစ်ဆေးရန်လိုပါသည်။"
 };
 return messages[code]||("Login မအောင်မြင်ပါ ("+(code||"unknown")+"): "+(err?.message||"အမှားအမျိုးအစား မသိရှိပါ။"));
}
function rememberEmail(){
 const email=$("admin-email").value.trim();
 try{if($("remember-account").checked&&email)localStorage.setItem(REMEMBER_KEY,email);else localStorage.removeItem(REMEMBER_KEY)}catch{}
}
try{const saved=localStorage.getItem(REMEMBER_KEY);if(saved){$("admin-email").value=saved;$("remember-account").checked=true}}catch{}
$("admin-email").addEventListener("change",rememberEmail);
$("remember-account").addEventListener("change",rememberEmail);
$("toggle-password").addEventListener("click",()=>{const p=$("admin-password"),show=p.type==="password";p.type=show?"text":"password";$("toggle-password").textContent=show?"Hide":"Show";$("toggle-password").setAttribute("aria-label",show?"Hide password":"Show password")});
$("login-form").addEventListener("submit",async e=>{
 e.preventDefault();const form=e.currentTarget,btn=form.querySelector('button[type="submit"]'),email=$("admin-email").value.trim(),password=$("admin-password").value;
 if(!email||!password){loginError.textContent="Email နှင့် Password နှစ်ခုလုံး ဖြည့်ပါ။";return}
 btn.disabled=true;loginError.textContent="အကောင့်ကို စစ်ဆေးနေပါသည်…";
 try{
  const persistence=$("remember-account").checked?browserLocalPersistence:browserSessionPersistence;
  await setPersistence(auth,persistence);
  await signInWithEmailAndPassword(auth,email,password);
  rememberEmail();loginError.textContent="Login အောင်မြင်ပါသည်။ Admin ခွင့်ပြုချက်ကို စစ်ဆေးနေပါသည်…";
 }catch(err){loginError.textContent=friendlyAuthError(err)}
 finally{btn.disabled=false}
});
$("forgot-password").addEventListener("click",async()=>{
 const email=$("admin-email").value.trim();
 if(!email){loginError.textContent="Password ပြန်သတ်မှတ်ရန် Email ကို အရင်ဖြည့်ပါ။";$("admin-email").focus();return}
 const btn=$("forgot-password");btn.disabled=true;loginError.textContent="Password ပြန်သတ်မှတ်ရန် Email ပို့နေပါသည်…";
 try{await sendPasswordResetEmail(auth,email);loginError.textContent="Password ပြန်သတ်မှတ်ရန် လင့်ခ်ကို Email သို့ ပို့ပြီးပါပြီ။ Inbox နှင့် Spam ကို စစ်ဆေးပါ။"}
 catch(err){loginError.textContent=friendlyAuthError(err)}
 finally{btn.disabled=false}
});
$("logout").addEventListener("click",async()=>{try{await signOut(auth)}catch(err){dashError.textContent="Sign out မအောင်မြင်ပါ: "+err.message}});
$("refresh").addEventListener("click",load);
document.querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("is-active",x===b));render()}));
["admin-search","date-from","date-to"].forEach(id=>$(id).addEventListener("input",render));
$("export-csv").addEventListener("click",exportCsv);
$("refresh-inquiries").addEventListener("click",loadInquiries);
$("inquiry-search").addEventListener("input",renderInquiries);
$("inquiry-filter").addEventListener("change",renderInquiries);
onAuthStateChanged(auth,async user=>{
 const check=++authCheck;
 if(!user){loginCard.hidden=false;dashboard.hidden=true;$("logout").hidden=true;$("admin-account").hidden=true;$("refresh").hidden=true;return}
 loginCard.hidden=false;dashboard.hidden=true;loginError.textContent="အကောင့် "+(user.email||"")+" ၏ Admin ခွင့်ပြုချက်ကို စစ်ဆေးနေပါသည်…";
 try{
  const token=await user.getIdTokenResult(true);
  if(check!==authCheck)return;
  if(token.claims.admin!==true){
   await signOut(auth);
   loginCard.hidden=false;dashboard.hidden=true;
   loginError.textContent="ဤအကောင့် ("+(user.email||"")+") တွင် Admin ခွင့်ပြုချက် မရှိပါ။ Firebase Admin SDK ဖြင့် ဤအကောင့်၏ UID ကို admin=true custom claim ပေးရန်လိုပါသည်။ Password မှားခြင်းမဟုတ်ပါ။";
   return;
  }
  loginCard.hidden=true;dashboard.hidden=false;$("logout").hidden=false;$("refresh").hidden=false;
  $("admin-account").hidden=false;$("admin-account").textContent="Signed in: "+(user.email||"Admin");
  await Promise.all([load(),loadInquiries()]);
 }catch(err){
  if(check!==authCheck)return;
  loginCard.hidden=false;dashboard.hidden=true;
  loginError.textContent="Admin အခွင့်ပြုချက် စစ်ဆေးရာတွင် အမှားဖြစ်နေပါသည်။ "+friendlyAuthError(err);
 }
});
async function load(){if(busy)return;busy=true;$("refresh").disabled=true;dashError.textContent="Appointments ကို ရယူနေပါသည်…";try{const res=await callList();rows=res.data.appointments||[];render();dashError.textContent=rows.length?"":"Appointment တောင်းဆိုမှု မရှိသေးပါ။"}catch(err){dashError.textContent="Appointment များကို မရယူနိုင်ပါ: "+(err.message||"Unknown error")+". Cloud Functions မဖြန့်ချိရသေးပါက Blaze plan နှင့် deploy လုပ်ရန်လိုနိုင်ပါသည်။"}finally{busy=false;$("refresh").disabled=false}}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function norm(v){return String(v??"").toLocaleLowerCase()}
function visibleRows(){const q=norm($("admin-search").value),from=$("date-from").value,to=$("date-to").value;return rows.filter(a=>{const status=a.status||"pending",date=a.preferredDate||"";const matchesStatus=filter==="all"||status===filter;const hay=[a.name,a.email,a.phone,a.service,a.id].map(norm).join(" ");return matchesStatus&&(!q||hay.includes(q))&&(!from||date>=from)&&(!to||date<=to)}).sort((a,b)=>(a.preferredDate||"").localeCompare(b.preferredDate||"")||(a.preferredTime||"").localeCompare(b.preferredTime||""))}
function renderStats(){const count=s=>rows.filter(a=>a.status===s).length;$("stat-total").textContent=rows.length;$("stat-pending").textContent=count("pending");$("stat-confirmed").textContent=count("confirmed");$("stat-closed").textContent=count("cancelled")+count("expired")}
function render(){renderStats();const shown=visibleRows();list.innerHTML=shown.length?shown.map(a=>{const status=a.status||"pending",phone=String(a.phone||"").replace(/[^\d+]/g,""),wa=phone?phone.replace(/^0/,"95").replace(/^\+/,""):"";const date=a.preferredDate||"Date not set",time=a.preferredTime||"Time not set";return '<article class="booking-row" data-status="'+esc(status)+'"><div><h3>'+esc(a.name||"Customer")+' <span class="status">· '+esc(status)+'</span></h3><p><b>'+esc(date)+' · '+esc(time)+' Yangon time</b> — '+esc(a.service||"Service not specified")+'</p><div class="booking-meta"><span>'+esc(a.appointmentMode||"Format not specified")+'</span><span>Party: '+esc(a.partySize||"1")+'</span><span>Event: '+esc(a.eventDate||"Not specified")+'</span></div><p>'+esc(a.email||"No email")+' · '+esc(a.phone||"No phone")+'</p><p>'+esc(a.message||"No additional notes")+'</p><p class="admin-muted">Request ID: '+esc(a.id)+'</p></div><div class="customer-actions">'+(wa?'<a class="admin-btn secondary" target="_blank" rel="noopener" href="https://wa.me/'+esc(wa)+'">WhatsApp</a>':'')+(a.email?'<a class="admin-btn secondary" href="mailto:'+esc(a.email)+'">Email</a>':'')+(status==="pending"?'<button class="admin-btn gold" data-action="confirmed" data-id="'+esc(a.id)+'">Confirm</button><button class="admin-btn" data-action="cancelled" data-id="'+esc(a.id)+'">Cancel</button>':'')+'</div></article>'}).join(""):'<div class="empty-state">ဤစစ်ထုတ်မှုနှင့် ကိုက်ညီသော Appointment မရှိပါ။</div>';list.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",async()=>{const action=b.dataset.action;if(!confirm(action==="confirmed"?"ဤ Appointment ကို အတည်ပြုမလား?":"ဤ Appointment ကို ပယ်ဖျက်ပြီး အချိန်ကို ပြန်ဖွင့်မလား?"))return;b.disabled=true;dashError.textContent="အခြေအနေ ပြောင်းလဲနေပါသည်…";try{await updateStatus({appointmentId:b.dataset.id,status:action});await load()}catch(err){dashError.textContent=err.message;b.disabled=false}}))}
function exportCsv(){const data=visibleRows();if(!data.length){dashError.textContent="Export လုပ်ရန် အချက်အလက်မရှိပါ။";return}const cols=["id","name","email","phone","service","appointmentMode","preferredDate","preferredTime","eventDate","partySize","status","message","createdAt"];const quote=v=>'"'+String(v??"").replace(/"/g,'""')+'"';const csv="\uFEFF"+[cols.join(","),...data.map(a=>cols.map(k=>quote(a[k])).join(","))].join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="bahadu-appointments-"+new Date().toISOString().slice(0,10)+".csv";document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);dashError.textContent="Export ပြီးပါပြီ။ "+data.length+" ခု။"}
async function loadInquiries(){
 const box=$("inquiries"),err=$("inquiry-error"),btn=$("refresh-inquiries");
 if(btn)btn.disabled=true;err.textContent="Customer messages ကို ရယူနေပါသည်…";
 try{const snap=await getDocs(query(collection(db,"inquiries"),orderBy("createdAt","desc"),limit(250)));inquiries=snap.docs.map(d=>({id:d.id,...d.data()}));renderInquiries();err.textContent=inquiries.length?"":"Website မှ Message မရရှိသေးပါ။"}
 catch(e){err.textContent="Customer messages မရယူနိုင်ပါ: "+e.message;box.innerHTML='<div class="empty-state">Firestore Rules သို့မဟုတ် Admin ခွင့်ပြုချက်ကို စစ်ဆေးရန်လိုပါသည်။</div>'}
 finally{if(btn)btn.disabled=false}
}
function renderInquiries(){
 const q=norm($("inquiry-search").value),mode=$("inquiry-filter").value,unread=inquiries.filter(x=>!x.readAt).length;$("inquiry-unread").textContent=unread+" unread";
 const shown=inquiries.filter(x=>(mode==="all"||(mode==="unread"&&!x.readAt)||(mode==="read"&&x.readAt))&&(!q||[x.name,x.email,x.phone,x.service,x.message,x.preferredDate,x.preferredTime].map(norm).join(" ").includes(q)));
 $("inquiries").innerHTML=shown.length?shown.map(x=>{const date=x.createdAt?.toDate?x.createdAt.toDate().toLocaleString():x.createdAt?new Date(x.createdAt).toLocaleString():"Date unavailable";const phone=String(x.phone||"").replace(/[^\d+]/g,"").replace(/^0/,"95").replace(/^\+/,"");return '<article class="booking-row" data-status="'+(x.readAt?"read":"unread")+'"><div><h3>'+esc(x.name||"Customer")+' <span class="status">· '+(x.type==="appointment"?"APPOINTMENT · "+(x.status||"pending").toUpperCase():(x.readAt?"Read":"UNREAD"))+'</span></h3><div class="booking-meta"><span>'+esc(x.service||"General enquiry")+'</span><span>'+esc(date)+'</span></div><p>'+esc(x.email||"No email")+' · '+esc(x.phone||"No phone")+'</p>'+(x.type==="appointment"?'<p><b>Preferred slot:</b> '+esc(x.preferredDate||"Not specified")+' · '+esc(x.preferredTime||"")+' Yangon time</p><p><b>Format:</b> '+esc(x.appointmentMode||"Not specified")+' · <b>Party:</b> '+esc(x.partySize||"1")+' · <b>Look:</b> '+esc(x.suitStyle||"Not specified")+'</p><p><b>Event date:</b> '+esc(x.eventDate||"Not specified")+'</p>':'<p><b>Preferred appointment:</b> '+esc(x.preferredDate||"Not specified")+' '+esc(x.preferredTime||"")+'</p>')+'<p style="white-space:pre-wrap">'+esc(x.message||"No message text")+'</p><p class="admin-muted">Message ID: '+esc(x.id)+'</p></div><div class="customer-actions">'+(phone?'<a class="admin-btn secondary" target="_blank" rel="noopener" href="https://wa.me/'+esc(phone)+'">WhatsApp</a>':'')+(x.email?'<a class="admin-btn secondary" href="mailto:'+esc(x.email)+'">Email</a>':'')+(x.type==="appointment"&&x.status==="pending"?'<button class="admin-btn gold" data-appt="confirmed" data-id="'+esc(x.id)+'">Confirm</button><button class="admin-btn" data-appt="cancelled" data-id="'+esc(x.id)+'">Cancel</button>':'')+(!x.readAt?'<button class="admin-btn secondary" data-read="'+esc(x.id)+'">Mark as read</button>':'')+'</div></article>'}).join(""):'<div class="empty-state">ဤစစ်ထုတ်မှုနှင့် ကိုက်ညီသော Message မရှိပါ။</div>';
 $("inquiries").querySelectorAll("[data-appt]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;const state=b.dataset.appt;if(!confirm(state==="confirmed"?"ဤ Appointment ကို အတည်ပြုမလား?":"ဤ Appointment ကို ပယ်ဖျက်မလား?")){b.disabled=false;return}try{await updateDoc(doc(db,"inquiries",b.dataset.id),{status:state,readAt:new Date()});const item=inquiries.find(x=>x.id===b.dataset.id);if(item){item.status=state;item.readAt=new Date()}renderInquiries()}catch(e){$("inquiry-error").textContent="Appointment အခြေအနေ မပြောင်းနိုင်ပါ: "+e.message;b.disabled=false}}));
 $("inquiries").querySelectorAll("[data-read]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;try{await updateDoc(doc(db,"inquiries",b.dataset.read),{readAt:new Date()});const item=inquiries.find(x=>x.id===b.dataset.read);if(item)item.readAt=new Date();renderInquiries()}catch(e){$("inquiry-error").textContent="Message ကို ပြင်ဆင်မရပါ: "+e.message;b.disabled=false}}));
}
