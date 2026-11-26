import{initializeApp}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,setPersistence,browserLocalPersistence}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import{getFunctions,httpsCallable}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js";
import{getFirestore,collection,getDocs,query,orderBy,limit,doc,updateDoc}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import{firebaseConfig}from"./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),functions=getFunctions(app,"asia-southeast1"),db=getFirestore(app);
const callList=httpsCallable(functions,"listAppointments"),updateStatus=httpsCallable(functions,"updateAppointmentStatus");
const loginCard=document.getElementById("login-card"),dashboard=document.getElementById("dashboard"),loginError=document.getElementById("login-error"),dashError=document.getElementById("dashboard-error"),list=document.getElementById("appointments");
let rows=[],inquiries=[],filter="all",busy=false;
const $=id=>document.getElementById(id);
$("login-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;loginError.textContent="Signing in…";try{await setPersistence(auth,browserLocalPersistence);await signInWithEmailAndPassword(auth,f.get("email"),f.get("password"));loginError.textContent=""}catch(err){loginError.textContent=err.message}finally{btn.disabled=false}});
$("logout").addEventListener("click",()=>signOut(auth));
$("refresh").addEventListener("click",load);
document.querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.classList.toggle("is-active",x===b));render()}));
["admin-search","date-from","date-to"].forEach(id=>$(id).addEventListener("input",render));
$("export-csv").addEventListener("click",exportCsv);
$("refresh-inquiries").addEventListener("click",loadInquiries);
$("inquiry-search").addEventListener("input",renderInquiries);
$("inquiry-filter").addEventListener("change",renderInquiries);
onAuthStateChanged(auth,async user=>{
 if(!user){loginCard.hidden=false;dashboard.hidden=true;$("logout").hidden=true;$("refresh").hidden=true;return}
 try{const token=await user.getIdTokenResult(true);if(token.claims.admin!==true){await signOut(auth);loginError.textContent="This account is not authorised as an administrator.";return}
 loginCard.hidden=true;dashboard.hidden=false;$("logout").hidden=false;await Promise.all([load(),loadInquiries()])
 }catch(err){dashError.textContent=err.message}
});
async function load(){if(busy)return;busy=true;$("refresh").disabled=true;dashError.textContent="Loading appointments…";try{const res=await callList();rows=res.data.appointments||[];render();dashError.textContent=rows.length?"":"No appointment requests have been received yet."}catch(err){dashError.textContent="Unable to load appointments: "+err.message}finally{busy=false;$("refresh").disabled=false}}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function norm(v){return String(v??"").toLocaleLowerCase()}
function visibleRows(){const q=norm($("admin-search").value),from=$("date-from").value,to=$("date-to").value;return rows.filter(a=>{const status=a.status||"pending",date=a.preferredDate||"";const matchesStatus=filter==="all"||status===filter;const hay=[a.name,a.email,a.phone,a.service,a.id].map(norm).join(" ");return matchesStatus&&(!q||hay.includes(q))&&(!from||date>=from)&&(!to||date<=to)}).sort((a,b)=>(a.preferredDate||"").localeCompare(b.preferredDate||"")||(a.preferredTime||"").localeCompare(b.preferredTime||""))}
function renderStats(){const count=s=>rows.filter(a=>a.status===s).length;$("stat-total").textContent=rows.length;$("stat-pending").textContent=count("pending");$("stat-confirmed").textContent=count("confirmed");$("stat-closed").textContent=count("cancelled")+count("expired")}
function render(){renderStats();const shown=visibleRows();list.innerHTML=shown.length?shown.map(a=>{const status=a.status||"pending",phone=String(a.phone||"").replace(/[^\d+]/g,""),wa=phone?phone.replace(/^0/,"95").replace(/^\+/,""):"";const date=a.preferredDate||"Date not set",time=a.preferredTime||"Time not set";return '<article class="booking-row" data-status="'+esc(status)+'"><div><h3>'+esc(a.name||"Customer")+' <span class="status">· '+esc(status)+'</span></h3><p><b>'+esc(date)+' · '+esc(time)+' Yangon time</b> — '+esc(a.service||"Service not specified")+'</p><div class="booking-meta"><span>'+esc(a.appointmentMode||"Format not specified")+'</span><span>Party: '+esc(a.partySize||"1")+'</span><span>Event: '+esc(a.eventDate||"Not specified")+'</span></div><p>'+esc(a.email||"No email")+' · '+esc(a.phone||"No phone")+'</p><p>'+esc(a.message||"No additional notes")+'</p><p class="admin-muted">Request ID: '+esc(a.id)+'</p></div><div class="customer-actions">'+(wa?'<a class="admin-btn secondary" target="_blank" rel="noopener" href="https://wa.me/'+esc(wa)+'">WhatsApp</a>':'')+(a.email?'<a class="admin-btn secondary" href="mailto:'+esc(a.email)+'">Email</a>':'')+(status==="pending"?'<button class="admin-btn gold" data-action="confirmed" data-id="'+esc(a.id)+'">Confirm</button><button class="admin-btn" data-action="cancelled" data-id="'+esc(a.id)+'">Cancel</button>':'')+'</div></article>'}).join(""):'<div class="empty-state">No appointments match these filters.</div>';list.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",async()=>{const action=b.dataset.action;if(!confirm(action==="confirmed"?"Confirm this appointment? The customer email queue will be created if configured.":"Cancel this appointment and release its slot?"))return;b.disabled=true;dashError.textContent="Updating appointment…";try{await updateStatus({appointmentId:b.dataset.id,status:action});await load()}catch(err){dashError.textContent=err.message;b.disabled=false}}))}
function exportCsv(){const data=visibleRows();if(!data.length){dashError.textContent="There are no matching rows to export.";return}const cols=["id","name","email","phone","service","appointmentMode","preferredDate","preferredTime","eventDate","partySize","status","message","createdAt"];const quote=v=>'"'+String(v??"").replace(/"/g,'""')+'"';const csv="\uFEFF"+[cols.join(","),...data.map(a=>cols.map(k=>quote(a[k])).join(","))].join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="bahadu-appointments-"+new Date().toISOString().slice(0,10)+".csv";document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);dashError.textContent="Exported "+data.length+" appointment(s)."}

async function loadInquiries(){
 const box=$("inquiries"),err=$("inquiry-error"),btn=$("refresh-inquiries");
 if(btn)btn.disabled=true;err.textContent="Loading customer messages…";
 try{
  const snap=await getDocs(query(collection(db,"inquiries"),orderBy("createdAt","desc"),limit(250)));
  inquiries=snap.docs.map(d=>({id:d.id,...d.data()}));renderInquiries();err.textContent=inquiries.length?"":"No website messages received yet.";
 }catch(e){err.textContent="Unable to load customer messages: "+e.message;box.innerHTML='<div class="empty-state">Messages could not be loaded. Check administrator access and Firestore rules.</div>'}
 finally{if(btn)btn.disabled=false}
}
function renderInquiries(){
 const q=norm($("inquiry-search").value),mode=$("inquiry-filter").value;
 const unread=inquiries.filter(x=>!x.readAt).length;$("inquiry-unread").textContent=unread+" unread";
 const shown=inquiries.filter(x=>(mode==="all"||(mode==="unread"&&!x.readAt)||(mode==="read"&&x.readAt))&&(!q||[x.name,x.email,x.phone,x.service,x.message].map(norm).join(" ").includes(q)));
 $("inquiries").innerHTML=shown.length?shown.map(x=>{
  const date=x.createdAt?.toDate?x.createdAt.toDate().toLocaleString():x.createdAt?new Date(x.createdAt).toLocaleString():"Date unavailable";
  const phone=String(x.phone||"").replace(/[^\d+]/g,"").replace(/^0/,"95").replace(/^\+/,"");
  return '<article class="booking-row" data-status="'+(x.readAt?"read":"unread")+'"><div><h3>'+esc(x.name||"Customer")+' <span class="status">· '+(x.readAt?"Read":"UNREAD")+'</span></h3><div class="booking-meta"><span>'+esc(x.service||"General enquiry")+'</span><span>'+esc(date)+'</span></div><p>'+esc(x.email||"No email")+' · '+esc(x.phone||"No phone")+'</p><p><b>Preferred appointment:</b> '+esc(x.preferredDate||"Not specified")+' '+esc(x.preferredTime||"")+'</p><p style="white-space:pre-wrap">'+esc(x.message||"No message text")+'</p><p class="admin-muted">Message ID: '+esc(x.id)+'</p></div><div class="customer-actions">'+(phone?'<a class="admin-btn secondary" target="_blank" rel="noopener" href="https://wa.me/'+esc(phone)+'">WhatsApp</a>':'')+(x.email?'<a class="admin-btn secondary" href="mailto:'+esc(x.email)+'">Email</a>':'')+(!x.readAt?'<button class="admin-btn gold" data-read="'+esc(x.id)+'">Mark as read</button>':'')+'</div></article>'
 }).join(""):'<div class="empty-state">No messages match this filter.</div>';
 $("inquiries").querySelectorAll("[data-read]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;try{await updateDoc(doc(db,"inquiries",b.dataset.read),{readAt:new Date()});const item=inquiries.find(x=>x.id===b.dataset.read);if(item)item.readAt=new Date();renderInquiries()}catch(e){$("inquiry-error").textContent="Could not update message: "+e.message;b.disabled=false}}));
}
