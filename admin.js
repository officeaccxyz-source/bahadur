import{initializeApp}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,setPersistence,browserLocalPersistence,browserSessionPersistence,sendPasswordResetEmail}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import{getFirestore,collection,getDocs,doc,getDoc,setDoc,addDoc,updateDoc,deleteDoc,serverTimestamp,onSnapshot}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import{firebaseConfig}from"./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id),REMEMBER_KEY="bahadu_admin_email_v1";
let inquiries=[],products=[],fabrics=[],orders=[],expenses=[],calculations=[],measurements=[],activeTab="overview",busy=false,stopInquiryLive=null,stopAdminNoticeLive=null;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateOf=v=>v?.toDate?v.toDate():v?new Date(v):null;
const dateLabel=v=>{const d=dateOf(v);return d&&!Number.isNaN(d.getTime())?d.toLocaleString():"Date unavailable"};
const isAppt=x=>x.type==="appointment"||Boolean(x.preferredDate&&x.preferredTime)||String(x.service||"").trim().toLowerCase()==="appointment";
const waPhone=v=>{let p=String(v||"").replace(/\D/g,"");if(p.startsWith("0"))p="95"+p.slice(1);return p};
function authError(e){const m={"auth/invalid-credential":"Email သို့မဟုတ် Password မမှန်ပါ။","auth/too-many-requests":"Login ကြိုးစားမှုများလွန်းပါသည်။ ခဏစောင့်ပါ။","auth/network-request-failed":"အင်တာနက်ချိတ်ဆက်မှုကို စစ်ဆေးပါ။","auth/unauthorized-domain":"Firebase Authorized domains တွင် Website domain ထည့်ရန်လိုပါသည်。"};return m[e.code]||e.message||"Login မအောင်မြင်ပါ။"}
try{const saved=localStorage.getItem(REMEMBER_KEY);if(saved){$("admin-email").value=saved;$("remember-account").checked=true}}catch{}
$("login-form").addEventListener("submit",async e=>{e.preventDefault();const b=e.currentTarget.querySelector('[type="submit"]');b.disabled=true;$("login-error").textContent="စစ်ဆေးနေပါသည်…";try{await setPersistence(auth,$("remember-account").checked?browserLocalPersistence:browserSessionPersistence);await signInWithEmailAndPassword(auth,$("admin-email").value.trim(),$("admin-password").value);if($("remember-account").checked)localStorage.setItem(REMEMBER_KEY,$("admin-email").value.trim());else localStorage.removeItem(REMEMBER_KEY)}catch(err){$("login-error").textContent=authError(err)}finally{b.disabled=false}});
$("forgot-password").addEventListener("click",async()=>{const email=$("admin-email").value.trim();if(!email){$("login-error").textContent="Email ကို အရင်ဖြည့်ပါ။";return}try{await sendPasswordResetEmail(auth,email);$("login-error").textContent="Password reset link ကို Email ပို့ပြီးပါပြီ။"}catch(e){$("login-error").textContent=authError(e)}});
$("logout").addEventListener("click",()=>signOut(auth));
async function verifyAdminAccess(user){const token=await user.getIdTokenResult(true);if(token.claims.admin===true){$("login-error").textContent="";$("refresh-admin-access").classList.add("hidden");$("login-card").classList.add("hidden");$("app").classList.remove("hidden");$("account-label").textContent=user.email||"Admin";await refreshAll();startAdminLive();await loadOrders();return true}$("app").classList.add("hidden");$("login-card").classList.remove("hidden");$("refresh-admin-access").classList.remove("hidden");$("login-error").textContent="Login အောင်မြင်ပါပြီ၊ သို့သော် ဒီ account မှာ Admin permission မရှိသေးပါ။ Admin custom claim ကို ပြန်စစ်ရန်လိုပါသည်။\nAccount UID: "+user.uid;return false}
$("refresh-admin-access").addEventListener("click",async()=>{const user=auth.currentUser;if(!user)return;$("login-error").textContent="Admin permission ကို ပြန်စစ်နေပါသည်…";try{await verifyAdminAccess(user)}catch(e){$("login-error").textContent="စစ်ဆေးမရပါ: "+(e.message||e)}});
onAuthStateChanged(auth,async user=>{if(!user){if(stopInquiryLive){stopInquiryLive();stopInquiryLive=null}if(stopAdminNoticeLive){stopAdminNoticeLive();stopAdminNoticeLive=null}$("app").classList.add("hidden");$("login-card").classList.remove("hidden");$("refresh-admin-access").classList.add("hidden");return}try{await verifyAdminAccess(user)}catch(e){$("login-card").classList.remove("hidden");$("app").classList.add("hidden");$("login-error").textContent="Admin စစ်ဆေးမှု မအောင်မြင်ပါ ("+(e.code||"")+"): "+e.message}});
document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
function showTab(name){activeTab=name;document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));document.querySelectorAll(".tab-content").forEach(s=>s.classList.toggle("hidden",s.id!=="tab-"+name));$("page-title").textContent=({overview:"Overview",messages:"Customer messages",appointments:"Appointments",editor:"Website editor",products:"Products",fabrics:"Fabrics & options",orders:"Orders & pricing",reports:"Financial reports",measurements:"Customer measurements",measurements:"Customer measurements"})[name]||"Overview"}
$("refresh-all").addEventListener("click",refreshAll);$("refresh-messages").addEventListener("click",loadInquiries);$("refresh-appointments").addEventListener("click",loadInquiries);
$("message-search").addEventListener("input",renderMessages);$("message-filter").addEventListener("change",renderMessages);$("appointment-search").addEventListener("input",renderAppointments);$("appointment-filter").addEventListener("change",renderAppointments);
async function refreshAll(){if(busy)return;busy=true;$("refresh-all").disabled=true;try{await Promise.all([loadInquiries(),loadProducts(),loadFabrics(),loadContent(),loadExpenses(),loadCalculations(),loadMeasurements()]);renderOverview()}catch(e){console.error(e)}finally{busy=false;$("refresh-all").disabled=false}}

function startAdminLive(){
 if(stopInquiryLive)return;
 let first=true;
 stopInquiryLive=onSnapshot(collection(db,"inquiries"),snap=>{
  if(first){
   first=false;
   snap.docs.forEach(d=>{
    const row={id:d.id,...d.data()};
    if(!row.readAt || (isAppt(row)&&(row.status||"pending")==="pending")){
     const noticeRef=doc(db,"adminNotifications",row.id);
     getDoc(noticeRef).then(existing=>{if(!existing.exists())return setDoc(noticeRef,{sourceId:row.id,type:isAppt(row)?"appointment":"message",title:isAppt(row)?"New appointment request":"New customer message",body:(row.name||"Customer")+" · "+(row.service||"General enquiry"),createdAt:serverTimestamp(),readAt:null})}).catch(console.error);
    }
   });
   return;
  }
  let changed=false;
  snap.docChanges().forEach(change=>{
   const row={id:change.doc.id,...change.doc.data()};
   if(change.type==="added"){
    if(!inquiries.some(x=>x.id===row.id)){
     inquiries.unshift(row);changed=true;
     setDoc(doc(db,"adminNotifications",row.id),{sourceId:row.id,type:isAppt(row)?"appointment":"message",title:isAppt(row)?"New appointment request":"New customer message",body:(row.name||"Customer")+" · "+(row.service||"General enquiry"),createdAt:serverTimestamp(),readAt:null},{merge:true}).catch(console.error);
    }
   }else if(change.type==="modified"){
    const i=inquiries.findIndex(x=>x.id===row.id);if(i>=0){inquiries[i]=row;changed=true}
   }else if(change.type==="removed"){inquiries=inquiries.filter(x=>x.id!==row.id);changed=true}
  });
  if(changed){inquiries.sort((a,b)=>(dateOf(b.createdAt)?.getTime()||0)-(dateOf(a.createdAt)?.getTime()||0));fillOrderCustomers();renderMessages();renderAppointments();renderOverview()}
 },err=>{$("admin-live-status").textContent="Live updates paused";console.error(err)});
 stopAdminNoticeLive=onSnapshot(collection(db,"adminNotifications"),snap=>{
  const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(dateOf(b.createdAt)?.getTime()||0)-(dateOf(a.createdAt)?.getTime()||0));
  renderAdminNotifications(rows);
 },err=>{$("admin-notice-list").textContent="Notifications unavailable: "+err.message});
}
function renderAdminNotifications(rows){
 const unread=rows.filter(x=>!x.readAt).length;
 $("admin-notice-count").textContent=unread;
 $("admin-notice-count").classList.toggle("hidden",!unread);
 $("admin-notice-list").innerHTML=rows.length?rows.slice(0,12).map(x=>'<article class="admin-notice-item"><div><b>'+esc(x.title||"New activity")+'</b><p>'+esc(x.body||"")+'</p><small>'+esc(dateLabel(x.createdAt))+'</small></div>'+(x.readAt?'':'<button class="btn" data-admin-notice-read="'+esc(x.id)+'">Read</button>')+'</article>').join(""):'<div class="empty">No new activity.</div>';
 $("admin-notice-list").querySelectorAll("[data-admin-notice-read]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;try{await updateDoc(doc(db,"adminNotifications",b.dataset.adminNoticeRead),{readAt:serverTimestamp()})}catch(e){b.disabled=false}}));
}
async function loadInquiries(){try{const snap=await getDocs(collection(db,"inquiries"));inquiries=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(dateOf(b.createdAt)?.getTime()||0)-(dateOf(a.createdAt)?.getTime()||0));fillOrderCustomers();renderMessages();renderAppointments();fillOrderCustomers();refreshCalculationSources();renderOverview();$("messages-error").textContent="";$("appointments-error").textContent=""}catch(e){$("messages-error").textContent="Messages မရယူနိုင်ပါ: "+e.message;$("appointments-error").textContent="Appointments မရယူနိုင်ပါ: "+e.message}}
$("messages-list").addEventListener("click",async e=>{const b=e.target.closest("[data-reply-send]");if(!b)return;const inquiryId=b.dataset.replySend,uid=b.dataset.uid,messageId=b.dataset.messageId,field=$("messages-list").querySelector('[data-reply-text="'+CSS.escape(inquiryId)+'"]'),reply=field?.value.trim();if(!reply){$("messages-error").textContent="Reply စာသားထည့်ပါ။";return}b.disabled=true;try{await updateDoc(doc(db,"users",uid,"messages",messageId),{reply,replyAt:serverTimestamp()});await updateDoc(doc(db,"inquiries",inquiryId),{reply,replyAt:serverTimestamp()});const item=inquiries.find(x=>x.id===inquiryId);if(item)item.reply=reply;$("messages-error").textContent="Customer ထံ Reply ပို့ပြီးပါပြီ။";}catch(err){$("messages-error").textContent="Reply မပို့နိုင်ပါ: "+err.message;b.disabled=false}});
function renderMessages(){
 const q=$("message-search").value.trim().toLowerCase(),f=$("message-filter").value;
 const list=inquiries.filter(x=>!isAppt(x)&&(f==="all"||(f==="unread"&&!x.readAt)||(f==="read"&&x.readAt))&&[x.name,x.email,x.phone,x.service,x.message].join(" ").toLowerCase().includes(q));
 const unread=inquiries.filter(x=>!isAppt(x)&&!x.readAt).length;
 $("message-summary").innerHTML='<span class="message-total">'+list.length+' messages shown</span><span class="message-unread">'+unread+' unread in inbox</span>';
 $("messages-list").innerHTML=list.length?list.map(x=>{
  const status=x.readAt?'<span class="message-status read">READ</span>':'<span class="message-status unread">NEW MESSAGE</span>';
  const message=String(x.message||"").trim();
  const contact=[x.email?'<a href="mailto:'+esc(x.email)+'">'+esc(x.email)+'</a>':'',x.phone?'<span>'+esc(x.phone)+'</span>':''].filter(Boolean).join('<span class="message-separator">·</span>');
  return '<article class="message-card"><div class="message-card-main"><div class="message-card-top"><div><h3>'+esc(x.name||"Customer")+'</h3><div class="message-meta">'+esc(x.service||"General enquiry")+' <span class="message-separator">·</span> '+esc(dateLabel(x.createdAt))+'</div></div>'+status+'</div><div class="message-contact">'+(contact||'<span>Contact details not provided</span>')+'</div><div class="message-body"><span class="message-body-label">MESSAGE</span><p>'+esc(message||"No message provided")+'</p></div>'+(x.uid&&x.clientMessageId?'<div class="message-reply"><label class="field">Reply to customer<textarea data-reply-text="'+esc(x.id)+'" rows="3" maxlength="1800">'+esc(x.reply||"")+'</textarea></label><button class="btn gold" data-reply-send="'+esc(x.id)+'" data-uid="'+esc(x.uid)+'" data-message-id="'+esc(x.clientMessageId)+'">Send reply</button></div>':'')+'</div><div class="message-card-actions">'+(x.phone?'<a class="btn" target="_blank" rel="noopener" href="https://wa.me/'+esc(waPhone(x.phone))+'">WhatsApp</a>':'')+(x.email?'<a class="btn" href="mailto:'+esc(x.email)+'">Email</a>':'')+(!x.readAt?'<button class="btn gold" data-read="'+esc(x.id)+'">Mark as read</button>':'<button class="btn danger" data-delete-message="'+esc(x.id)+'">Delete</button>')+'</div></article>'
 }).join(""):'<div class="empty"><strong>No messages found</strong><span>Try changing the search or filter.</span></div>';
 $("messages-list").querySelectorAll("[data-reply-send]").forEach(b=>b.addEventListener("click",async()=>{const inquiryId=b.dataset.replySend,uid=b.dataset.uid,messageId=b.dataset.messageId,field=$("messages-list").querySelector('[data-reply-text="'+CSS.escape(inquiryId)+'"]'),reply=field?.value.trim();if(!reply){$("messages-error").textContent="Reply စာသားထည့်ပါ။";return}b.disabled=true;try{await updateDoc(doc(db,"users",uid,"messages",messageId),{reply,replyAt:serverTimestamp()});await updateDoc(doc(db,"inquiries",inquiryId),{reply,replyAt:serverTimestamp()});const item=inquiries.find(x=>x.id===inquiryId);if(item)item.reply=reply;$("messages-error").textContent="Customer ထံ Reply ပို့ပြီးပါပြီ။"}catch(err){$("messages-error").textContent="Reply မပို့နိုင်ပါ: "+err.message;b.disabled=false}}));
 $("messages-list").querySelectorAll("[data-read]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;try{await updateDoc(doc(db,"inquiries",b.dataset.read),{readAt:new Date()});const x=inquiries.find(i=>i.id===b.dataset.read);if(x)x.readAt=new Date();renderMessages();renderOverview()}catch(e){$("messages-error").textContent=e.message;b.disabled=false}}));
 $("messages-list").querySelectorAll("[data-delete-message]").forEach(b=>b.addEventListener("click",async()=>{const item=inquiries.find(x=>x.id===b.dataset.deleteMessage);if(!item||!item.readAt){$("messages-error").textContent="ဖတ်ပြီးသား Message များကိုသာ ဖျက်နိုင်ပါသည်။";return}if(!confirm("ဤဖတ်ပြီးသား Customer Message ကို အပြီးဖျက်မလား? ပြန်ယူ၍မရပါ။"))return;b.disabled=true;try{if(item.uid&&item.clientMessageId)await deleteDoc(doc(db,"users",item.uid,"messages",item.clientMessageId));await deleteDoc(doc(db,"inquiries",item.id));inquiries=inquiries.filter(x=>x.id!==item.id);renderMessages();renderOverview();$("messages-error").textContent="ဖတ်ပြီးသား Message ကို ဖျက်ပြီးပါပြီ။"}catch(e){$("messages-error").textContent="ဖျက်၍မရပါ: "+e.message;b.disabled=false}}));
}function renderAppointments(){
 const q=$("appointment-search").value.toLowerCase(),f=$("appointment-filter").value;
 const list=inquiries.filter(x=>isAppt(x)&&(f==="all"||(x.status||"pending")===f)&&[x.name,x.email,x.phone,x.service,x.preferredDate,x.preferredTime,x.voucherCode||("AP-"+String(x.id).slice(0,8).toUpperCase())].join(" ").toLowerCase().includes(q));
 $("appointments-list").innerHTML=list.length?list.map(x=>{const st=x.status||"pending",phone=waPhone(x.phone);const voucher=x.voucherCode||("AP-"+String(x.id).slice(0,8).toUpperCase());return '<article class="item"><div><p class="eyebrow">VOUCHER · '+esc(voucher)+'</p><h3>'+esc(x.name||"Customer")+' <span class="pill '+esc(st)+'">'+esc(st)+'</span></h3><p><b>'+esc(x.preferredDate||"Date not set")+' · '+esc(x.preferredTime||"Time not set")+' Yangon time</b></p><p>'+esc(x.service||"Service")+' · '+esc(x.appointmentMode||"Format not set")+' · Party '+esc(x.partySize||"1")+'</p><p>Event: '+esc(x.eventDate||"Not specified")+' · Style: '+esc(x.suitStyle||"Not specified")+'</p><p>'+esc(x.email||"")+' · '+esc(x.phone||"")+'</p><p>'+esc(x.message||"No additional notes")+'</p><p class="muted">Received: '+esc(dateLabel(x.createdAt))+'</p></div><div class="item-actions">'+(phone?'<a class="btn" target="_blank" rel="noopener" href="https://wa.me/'+esc(phone)+'">WhatsApp</a>':'')+(x.email?'<a class="btn" href="mailto:'+esc(x.email)+'">Email</a>':'')+(st==="pending"?'<button class="btn gold" data-status="confirmed" data-id="'+esc(x.id)+'">Confirm</button><button class="btn danger" data-status="cancelled" data-id="'+esc(x.id)+'">Cancel</button>':'')+'</div></article>'}).join(""):'<div class="empty">No appointment requests found.</div>';
 $("appointments-list").querySelectorAll("[data-status]").forEach(b=>b.addEventListener("click",async()=>{
  const status=b.dataset.status,item=inquiries.find(i=>i.id===b.dataset.id);if(!item)return;
  if(!confirm(status==="confirmed"?"Appointment ကို အတည်ပြုမလား? Customer ရဲ့ History ထဲမှာလည်း မှတ်တမ်းတင်ပါမယ်။":"Appointment ကို ပယ်ဖျက်မလား? Customer ရဲ့ History ထဲမှာလည်း မှတ်တမ်းတင်ပါမယ်။"))return;
  b.disabled=true;
  try{
   await updateDoc(doc(db,"inquiries",item.id),{status,readAt:new Date(),statusUpdatedAt:serverTimestamp()});
   item.status=status;item.readAt=new Date();item.statusUpdatedAt=new Date();
   const voucher=item.voucherCode||("AP-"+String(item.id).slice(0,8).toUpperCase());
   const title=(status==="confirmed"?"Appointment confirmed":"Appointment cancelled")+" · "+voucher;
   const body="Voucher: "+voucher+" · "+(status==="confirmed"?"သင့်ရက်ချိန်းကို အတည်ပြုပြီးပါပြီ။ ":"သင့်ရက်ချိန်းတောင်းဆိုမှုကို ပယ်ဖျက်လိုက်ပါပြီ။ ") +(item.preferredDate||"")+" "+(item.preferredTime||"")+(status==="cancelled"?" အချိန်အသစ်ပြန်လည်ညှိနှိုင်းရန် Atelier ကို ဆက်သွယ်နိုင်ပါသည်။":"");
   if(item.uid){
    await addDoc(collection(db,"users",item.uid,"notifications"),{type:"appointment",title,body,relatedId:item.id,createdAt:serverTimestamp(),readAt:null});
    await addDoc(collection(db,"users",item.uid,"history"),{type:"appointment",title,description:body,relatedId:item.id,status,createdAt:serverTimestamp()});
   }
   renderAppointments();renderOverview();$("appointments-error").textContent=item.uid?"Status ပြောင်းပြီး Customer Notification နဲ့ History ထဲ ပို့ပြီးပါပြီ။":"Status ပြောင်းပြီးပါပြီ။ ဒီ Appointment ကို Account မဝင်ဘဲ ပေးပို့ထားတာကြောင့် Customer Account History သို့ မပို့နိုင်ပါ။";
  }catch(e){$("appointments-error").textContent="Status သိမ်းဆည်းပြီး Notification/History ပို့ရာတွင် ပြဿနာရှိပါသည်: "+e.message;b.disabled=false}
 }));
}

$("order-search").addEventListener("input",renderOrders);
["order-quantity","order-unit-price","order-fabric-cost","order-labour-cost","order-discount","order-deposit"].forEach(id=>$(id).addEventListener("input",calculateOrder));
async function loadExpenses(){
 try{const snap=await getDocs(collection(db,"expenses"));expenses=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.expenseDate||"").localeCompare(String(a.expenseDate||"")));renderExpenses()}
 catch(e){$("expense-notice").textContent="Expense စာရင်း မရယူနိုင်ပါ: "+e.message}
}
function renderExpenses(){
 if(!$("expenses-list"))return;
 $("expenses-list").innerHTML=expenses.slice(0,30).map(e=>'<article class="item"><div><h3>'+esc(e.category||"Expense")+' · '+money(e.amount)+'</h3><p>'+esc(e.expenseDate||"")+' · '+esc(e.vendor||"")+'</p><p>'+esc(e.note||"")+'</p></div><div class="item-actions"><button class="btn danger" data-expense-delete="'+esc(e.id)+'">Delete</button></div></article>').join("")||'<div class="empty">No expenses recorded yet.</div>';
 $("expenses-list").querySelectorAll("[data-expense-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("ဒီ Expense မှတ်တမ်းကို ဖျက်မလား?"))return;b.disabled=true;try{await deleteDoc(doc(db,"expenses",b.dataset.expenseDelete));expenses=expenses.filter(e=>e.id!==b.dataset.expenseDelete);renderExpenses()}catch(e){$("expense-notice").textContent="ဖျက်မရပါ: "+e.message;b.disabled=false}}));
}
const expenseForm=$("expense-form");
const nowForDate=new Date();expenseForm.elements.expenseDate.value=[nowForDate.getFullYear(),String(nowForDate.getMonth()+1).padStart(2,"0"),String(nowForDate.getDate()).padStart(2,"0")].join("-");
expenseForm.addEventListener("submit",async e=>{
 e.preventDefault();const b=expenseForm.querySelector('[type="submit"]'),d={expenseDate:expenseForm.elements.expenseDate.value,category:expenseForm.elements.category.value,amount:Math.max(0,Number(expenseForm.elements.amount.value)||0),vendor:expenseForm.elements.vendor.value.trim(),note:expenseForm.elements.note.value.trim(),createdAt:serverTimestamp()};
 if(!d.expenseDate||d.amount<=0){$("expense-notice").textContent="ရက်စွဲနဲ့ Amount ကို မှန်ကန်စွာ ဖြည့်ပါ။";return}
 b.disabled=true;try{const ref=await addDoc(collection(db,"expenses"),d);expenses.unshift({id:ref.id,...d,createdAt:new Date()});renderExpenses();expenseForm.elements.amount.value="";expenseForm.elements.vendor.value="";expenseForm.elements.note.value="";$("expense-notice").textContent="Expense သိမ်းဆည်းပြီးပါပြီ။"}catch(err){$("expense-notice").textContent="Expense မသိမ်းနိုင်ပါ: "+err.message}finally{b.disabled=false}
});
const measurementTemplates={
 men:{
  jacket:[["JACKET & BODY","neck","Neck","chest","Chest","waist","Waist","shoulder","Shoulder","sleeve","Sleeve length","bicep","Bicep","jacketLength","Jacket length","backLength","Back length"]],
  trousers:[["TROUSERS","waist","Waist","seat","Seat / seat circumference","thigh","Thigh","knee","Knee","hem","Hem / bottom","frontRise","Front rise","backRise","Back rise","inseam","Inseam","outseam","Outseam"]],
  shirt:[["SHIRT","neck","Neck","chest","Chest","waist","Waist","shoulder","Shoulder","sleeve","Sleeve length","cuff","Cuff","shirtLength","Shirt length"]],
  skirt:[["LOWER GARMENT","waist","Waist","seat","Seat","skirtLength","Skirt length"]],
  dress:[["GARMENT","chest","Chest","waist","Waist","seat","Seat","shoulder","Shoulder","sleeve","Sleeve","dressLength","Dress length"]],
  suit:[["JACKET","neck","Neck","chest","Chest","waist","Waist","shoulder","Shoulder","sleeve","Sleeve length","jacketLength","Jacket length"],["TROUSERS","trouserWaist","Trouser waist","seat","Seat","thigh","Thigh","frontRise","Front rise","inseam","Inseam","outseam","Outseam"]]
 },
 women:{
  jacket:[["JACKET & BODY","bust","Bust","underBust","Under bust","waist","Waist","highHip","High hip","fullHip","Full hip","shoulder","Shoulder","sleeve","Sleeve length","armhole","Armhole","jacketLength","Jacket length","frontLength","Front length","backLength","Back length"]],
  trousers:[["TROUSERS","waist","Waist","highHip","High hip","fullHip","Full hip","thigh","Thigh","knee","Knee","frontRise","Front rise","backRise","Back rise","inseam","Inseam","outseam","Outseam"]],
  shirt:[["SHIRT / BLOUSE","bust","Bust","underBust","Under bust","waist","Waist","shoulder","Shoulder","sleeve","Sleeve length","armhole","Armhole","cuff","Cuff","blouseLength","Blouse length"]],
  skirt:[["SKIRT","waist","Waist","highHip","High hip","fullHip","Full hip","skirtLength","Skirt length"]],
  dress:[["DRESS / GOWN","bust","Bust","underBust","Under bust","waist","Waist","highHip","High hip","fullHip","Full hip","shoulder","Shoulder","sleeve","Sleeve","armhole","Armhole","dressLength","Dress length"]],
  suit:[["JACKET","bust","Bust","underBust","Under bust","waist","Waist","shoulder","Shoulder","sleeve","Sleeve","jacketLength","Jacket length"],["TROUSERS / SKIRT","highHip","High hip","fullHip","Full hip","thigh","Thigh","frontRise","Front rise","inseam","Inseam","outseam","Outseam"]]
 }
};
function renderMeasurementFields(){
 const gender=$("measurement-gender").value==="women"?"women":"men",type=$("measurement-garment").value,groups=measurementTemplates[gender][type]||measurementTemplates[gender].jacket,el=$("measurement-fields");
 el.innerHTML=groups.map(g=>'<h3 class="measurement-grid-title">'+g[0]+'</h3>'+Array.from({length:(g.length-1)/2},(_,i)=>{const key=g[1+i*2],label=g[2+i*2];return '<div class="measurement-field"><label for="measure-'+key+'">'+label+'</label><input id="measure-'+key+'" type="number" min="0" max="300" step="0.1" data-measurement-key="'+key+'" inputmode="decimal" placeholder="—"></div>'}).join("")).join("");
}
function refreshMeasurementOptions(){
 const s=$("order-measurement-source");if(!s)return;const prior=s.value;
 s.innerHTML='<option value="">Select customer measurement</option>'+measurements.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.customerName)+' · '+esc(m.gender||"men")+' · '+esc(m.garmentType||"garment")+' · v'+esc(m.version||1)+'</option>').join("");
 if(prior)s.value=prior;
}
async function loadMeasurements(){
 try{const snap=await getDocs(collection(db,"measurements"));measurements=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(dateOf(b.createdAt)?.getTime()||0)-(dateOf(a.createdAt)?.getTime()||0));renderMeasurements();refreshMeasurementOptions()}
 catch(e){$("measurements-error").textContent="Measurements မရယူနိုင်ပါ: "+e.message}
}
function renderMeasurements(){
 const q=($("measurement-search")?.value||"").toLowerCase(),list=measurements.filter(m=>[m.customerName,m.phone,m.garmentType,m.gender].join(" ").toLowerCase().includes(q));
 $("measurements-list").innerHTML=list.length?list.map(m=>'<article class="item"><div><p class="eyebrow">'+esc((m.gender||"men").toUpperCase())+' · '+esc(m.garmentType||"garment")+' · VERSION '+esc(m.version||1)+'</p><h3>'+esc(m.customerName)+'</h3><p>'+esc(m.phone||"No phone")+' · '+esc(m.unit||"cm")+' · '+esc(dateLabel(m.createdAt))+'</p><div class="measurement-data">'+Object.entries(m.values||{}).map(([k,v])=>'<span>'+esc(k)+': '+esc(v)+' '+esc(m.unit||"cm")+'</span>').join("")+'</div><p>'+esc(m.notes||"")+'</p></div><div class="item-actions"><button class="btn" data-use-measurement="'+esc(m.id)+'">Use in order</button></div></article>').join(""):'<div class="empty">No measurement profiles found.</div>';
 $("measurements-list").querySelectorAll("[data-use-measurement]").forEach(b=>b.addEventListener("click",()=>useMeasurement(b.dataset.useMeasurement)));
}
function useMeasurement(id){
 const m=measurements.find(x=>x.id===id);if(!m)return;
 $("order-form").elements.customerName.value=m.customerName||"";$("order-form").elements.phone.value=m.phone||"";
 $("order-form").elements.garment.value=(m.gender==="women"?"Women's ":"")+String(m.garmentType||"").replace(/^./,x=>x.toUpperCase())+" · Made to measure";
 $("order-form").elements.notes.value=["Measurement profile v"+(m.version||1)+" ("+(m.unit||"cm")+")",...Object.entries(m.values||{}).map(([k,v])=>k+": "+v),m.notes||""].filter(Boolean).join("\n");
 $("order-measurement-notice").textContent="Loaded "+m.customerName+" · "+m.garmentType+" · version "+(m.version||1);
 showTab("orders");
}
renderMeasurementFields();
$("measurement-gender").addEventListener("change",renderMeasurementFields);
$("measurement-garment").addEventListener("change",renderMeasurementFields);
$("measurement-search").addEventListener("input",renderMeasurements);
$("refresh-measurements").addEventListener("click",loadMeasurements);
$("load-order-measurement").addEventListener("click",()=>{const id=$("order-measurement-source").value;if(id)useMeasurement(id);else $("order-measurement-notice").textContent="Measurement profile ရွေးပါ။"});
$("measurement-reset").addEventListener("click",()=>{$("measurement-form").reset();renderMeasurementFields();$("measurement-notice").textContent=""});
$("measurement-form").addEventListener("submit",async e=>{
 e.preventDefault();const f=e.currentTarget,b=f.querySelector('[type="submit"]'),customerName=f.elements.customerName.value.trim(),gender=f.elements.gender.value,garmentType=f.elements.garmentType.value,unit=f.elements.unit.value;
 const values={};document.querySelectorAll("[data-measurement-key]").forEach(el=>{if(el.value.trim()!=="")values[el.dataset.measurementKey]=Number(el.value)});
 if(!customerName||!Object.keys(values).length){$("measurement-notice").textContent="Customer name နဲ့ measurement အနည်းဆုံးတစ်ခု ဖြည့်ပါ။";return}
 const previous=measurements.filter(m=>m.customerName.toLowerCase()===customerName.toLowerCase()&&m.garmentType===garmentType&&m.gender===gender).sort((a,b)=>(Number(b.version)||1)-(Number(a.version)||1))[0];
 const d={customerName,phone:f.elements.phone.value.trim(),gender,garmentType,unit,values,notes:f.elements.notes.value.trim(),version:(Number(previous?.version)||0)+1,previousProfileId:previous?.id||null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
 b.disabled=true;try{const ref=await addDoc(collection(db,"measurements"),d);measurements.unshift({id:ref.id,...d,createdAt:new Date()});renderMeasurements();refreshMeasurementOptions();$("measurement-notice").textContent="Measurement profile v"+d.version+" သိမ်းပြီးပါပြီ။ အရင် version ကိုလည်း ထိန်းသိမ်းထားပါတယ်။";f.reset();renderMeasurementFields()}catch(err){$("measurement-notice").textContent="သိမ်းမရပါ: "+err.message}finally{b.disabled=false}
});
async function loadCalculations(){
 try{const snap=await getDocs(collection(db,"calculations"));calculations=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(dateOf(b.createdAt)?.getTime()||0)-(dateOf(a.createdAt)?.getTime()||0));renderCalculations();refreshCalculationSources()}
 catch(e){$("calculation-save-notice").textContent="Calculation register မရယူနိုင်ပါ: "+e.message}
}
function refreshCalculationSources(){
 const s=$("calculation-source");if(!s)return;const prior=s.value;
 const orderOpts=orders.map(o=>({id:o.id,type:"order",label:(o.orderNumber||"BH-"+o.id.slice(0,8).toUpperCase())+" · "+(o.customerName||"Customer")+" · "+(o.garment||"Order")}));
 const apptOpts=inquiries.filter(isAppt).map(a=>({id:a.id,type:"appointment",label:(a.voucherCode||"AP-"+a.id.slice(0,8).toUpperCase())+" · "+(a.name||"Customer")+" · "+(a.service||"Appointment")+" · "+(a.status||"pending")}));
 s.innerHTML='<option value="">Select saved customer record</option><optgroup label="ORDERS">'+orderOpts.map(x=>'<option value="order:'+esc(x.id)+'">'+esc(x.label)+'</option>').join("")+'</optgroup><optgroup label="APPOINTMENTS">'+apptOpts.map(x=>'<option value="appointment:'+esc(x.id)+'">'+esc(x.label)+'</option>').join("")+'</optgroup>';
 if(prior)s.value=prior;
}
function loadSelectedRecordIntoCalculator(){
 const v=$("calculation-source").value;if(!v){$("calculation-source-notice").textContent="Order သို့ Appointment တစ်ခုရွေးပါ။";return}
 const [type,id]=v.split(":"),f=$("order-form");let r,refCode;
 if(type==="order"){r=orders.find(x=>x.id===id);if(!r)return;refCode=r.orderNumber||"BH-"+r.id.slice(0,8).toUpperCase();f.elements.customerName.value=r.customerName||"";f.elements.customerEmail.value=r.customerEmail||"";f.elements.phone.value=r.phone||"";f.elements.gender.value=r.gender||"men";f.elements.customerUid.value=r.customerUid||"";f.elements.garment.value=r.garment||"";f.elements.notes.value=r.notes||"";$("order-quantity").value=r.quantity||1;$("order-unit-price").value=r.unitPrice||0;$("order-fabric-cost").value=r.fabricCost||0;$("order-labour-cost").value=r.labourCost||0;$("order-discount").value=r.discount||0;$("order-deposit").value=r.deposit||0}
 else{r=inquiries.find(x=>x.id===id);if(!r)return;refCode=r.voucherCode||"AP-"+r.id.slice(0,8).toUpperCase();f.elements.customerName.value=r.name||"";f.elements.customerEmail.value=r.email||"";f.elements.phone.value=r.phone||"";f.elements.gender.value=r.gender||"men";f.elements.customerUid.value=r.uid||"";f.elements.garment.value=r.service||"Bespoke consultation";f.elements.notes.value=[r.message,r.preferredDate&&("Preferred date: "+r.preferredDate),r.preferredTime&&("Preferred time: "+r.preferredTime),r.suitStyle&&("Style: "+r.suitStyle)].filter(Boolean).join("\n");$("order-quantity").value=1;["order-unit-price","order-fabric-cost","order-labour-cost","order-discount","order-deposit"].forEach(k=>$(k).value=0)}
 calculateOrder();$("calculation-source-notice").textContent="Loaded: "+refCode+" · "+(type==="order"?"Order":"Appointment")+". Amounts can now be reviewed or edited before saving.";
}
$("load-calculation-source").addEventListener("click",loadSelectedRecordIntoCalculator);
function renderCalculations(){
 const el=$("calculations-list");if(!el)return;
 el.innerHTML=calculations.slice(0,25).map(c=>'<article class="item"><div><p class="eyebrow">'+esc(c.sourceType||"manual").toUpperCase()+' · '+esc(c.voucherCode||"CALCULATION")+'</p><h3>'+esc(c.customerName||"Customer")+' · '+esc(c.garment||"Bespoke service")+'</h3><p>Total <b>'+money(c.total)+'</b> · Deposit '+money(c.deposit)+' · Balance '+money(c.balance)+'</p><p>'+esc(dateLabel(c.createdAt))+'</p></div></article>').join("")||'<div class="empty">No saved calculations yet. Load an order or appointment above, calculate, then save it here.</div>';
}
$("save-calculation").addEventListener("click",async()=>{
 const f=$("order-form"),calc=calculateOrder(),v=$("calculation-source").value,[sourceType,sourceId]=v?v.split(":"):["manual",""],source=sourceType==="order"?orders.find(x=>x.id===sourceId):sourceType==="appointment"?inquiries.find(x=>x.id===sourceId):null;
 const customerName=f.elements.customerName.value.trim(),garment=f.elements.garment.value.trim();
 if(!customerName||!garment){$("calculation-save-notice").textContent="Customer name နဲ့ Garment / Service ဖြည့်ပါ။";return}
 const d={sourceType,sourceId:sourceId||null,voucherCode:source?(sourceType==="order"?(source.orderNumber||"BH-"+source.id.slice(0,8).toUpperCase()):(source.voucherCode||"AP-"+source.id.slice(0,8).toUpperCase())):makeVoucherCode("CAL"),customerName,customerEmail:f.elements.customerEmail.value.trim(),phone:f.elements.phone.value.trim(),gender:f.elements.gender.value||"men",garment,notes:f.elements.notes.value.trim(),...calc,createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
 const b=$("save-calculation");b.disabled=true;try{const ref=await addDoc(collection(db,"calculations"),d);calculations.unshift({id:ref.id,...d,createdAt:new Date()});renderCalculations();$("calculation-save-notice").textContent="Calculation ကို register ထဲ သိမ်းဆည်းပြီးပါပြီ။"}catch(e){$("calculation-save-notice").textContent="သိမ်းမရပါ: "+e.message}finally{b.disabled=false}
});
function makeVoucherCode(prefix){
 const d=new Date(),yy=String(d.getFullYear()).slice(-2),mm=String(d.getMonth()+1).padStart(2,"0"),dd=String(d.getDate()).padStart(2,"0");
 const rand=()=>Math.random().toString(36).slice(2,6).toUpperCase();
 return prefix+"-"+yy+mm+dd+"-"+rand();
}
$("voucher-lookup-btn").addEventListener("click",()=>{
 const code=$("voucher-lookup-code").value.trim().toUpperCase(),o=orders.find(x=>String(x.orderNumber||"").toUpperCase()===code||("BH-"+String(x.id).slice(0,8).toUpperCase())===code);
 if(!code){$("voucher-lookup-result").textContent="Voucher Code ဖြည့်ပါ။";return}
 if(!o){$("voucher-lookup-result").textContent="ဒီ Voucher Code နဲ့ Order မတွေ့ပါ။";return}
 $("order-search").value=code;renderOrders();
 $("order-quantity").value=o.quantity||1;$("order-unit-price").value=o.unitPrice||0;$("order-fabric-cost").value=o.fabricCost||0;$("order-labour-cost").value=o.labourCost||0;$("order-discount").value=o.discount||0;$("order-deposit").value=o.deposit||0;calculateOrder();
 $("voucher-lookup-result").textContent="တွေ့ရှိပါပြီ · "+(o.customerName||"Customer")+" · "+(o.garment||"Order")+" · Total "+Number(o.total||0).toLocaleString()+" MMK · Balance "+Number(o.balance||0).toLocaleString()+" MMK";
});
$("voucher-lookup-code").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("voucher-lookup-btn").click()}});
let reportBlob=null,reportUrl=null,reportFilename="bahadur-report.png";
const money=v=>Number(v||0).toLocaleString("en-US")+" MMK";
function reportDateRange(){
 const raw=$("report-date").value||new Date().toISOString().slice(0,10),parts=raw.split("-").map(Number),y=parts[0],m=parts[1],d=parts[2];
 const monthly=$("report-period").value==="monthly",start=new Date(y,m-1,monthly?1:d,0,0,0,0),end=monthly?new Date(y,m,1,0,0,0,0):new Date(y,m-1,d+1,0,0,0,0);
 return {start,end,label:monthly?start.toLocaleDateString("en-GB",{month:"long",year:"numeric"}):start.toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"})};
}
async function generateFinancialReport(){
 const {start,end,label}=reportDateRange(),within=v=>{const d=dateOf(v);return d&&d>=start&&d<end};
 const os=orders.filter(o=>within(o.createdAt)),aps=inquiries.filter(isAppt).filter(a=>within(a.createdAt));const startKey=[start.getFullYear(),String(start.getMonth()+1).padStart(2,"0"),String(start.getDate()).padStart(2,"0")].join("-"),endKey=[end.getFullYear(),String(end.getMonth()+1).padStart(2,"0"),String(end.getDate()).padStart(2,"0")].join("-"),es=expenses.filter(e=>String(e.expenseDate||"")>=startKey&&String(e.expenseDate||"")<endKey),expenseTotal=es.reduce((n,e)=>n+Number(e.amount||0),0),netCash=deposit-expenseTotal;
 const menOrderTotal=os.filter(o=>(o.gender||"men")==="men").reduce((n,o)=>n+Number(o.total||0),0),womenOrderTotal=os.filter(o=>o.gender==="women").reduce((n,o)=>n+Number(o.total||0),0),total=os.reduce((n,o)=>n+Number(o.total||0),0),deposit=os.reduce((n,o)=>n+Number(o.deposit||0),0),balance=os.reduce((n,o)=>n+Number(o.balance??(Number(o.total||0)-Number(o.deposit||0))),0);
 const confirmed=aps.filter(a=>a.status==="confirmed").length,cancelled=aps.filter(a=>a.status==="cancelled").length,pending=aps.filter(a=>(a.status||"pending")==="pending").length;
 const c=document.createElement("canvas");c.width=1200;c.height=1500;const x=c.getContext("2d");
 x.fillStyle="#f5f1e9";x.fillRect(0,0,c.width,c.height);x.fillStyle="#0b2038";x.fillRect(0,0,c.width,430);
 x.strokeStyle="#c9a86a";x.lineWidth=3;x.strokeRect(42,42,1116,1416);
 x.fillStyle="#d7b875";x.font="600 25px Arial";x.textAlign="center";x.fillText("BAHADUR BESPOKE",600,125);
 x.fillStyle="#fffaf0";x.font="52px Georgia";x.fillText("ATELIER STATEMENT",600,220);
 x.fillStyle="#d7b875";x.font="28px Arial";x.fillText(label.toUpperCase(),600,300);
 x.strokeStyle="#c9a86a";x.lineWidth=2;x.beginPath();x.moveTo(160,360);x.lineTo(1040,360);x.stroke();
 const row=(label,value,y,large=false)=>{x.textAlign="left";x.fillStyle="#6f6a61";x.font="25px Arial";x.fillText(label,125,y);x.textAlign="right";x.fillStyle="#10243b";x.font=large?"bold 38px Georgia":"bold 30px Arial";x.fillText(value,1075,y)};
 x.fillStyle="#9a7843";x.font="bold 22px Arial";x.textAlign="left";x.fillText("ORDER & REVENUE",125,520);
 row("Orders recorded",String(os.length),590);row("Order value",money(total),675,true);row("Men’s orders",money(menOrderTotal),730);row("Women’s orders",money(womenOrderTotal),785);row("Deposits received",money(deposit),840);row("Outstanding balances",money(balance),895,true);
 x.strokeStyle="#d8cdbb";x.beginPath();x.moveTo(125,945);x.lineTo(1075,945);x.stroke();
 x.fillStyle="#9a7843";x.font="bold 22px Arial";x.textAlign="left";x.fillText("APPOINTMENT REGISTER",125,1015);
 row("Total requests",String(aps.length),1080);row("Confirmed",String(confirmed),1145);row("Pending",String(pending),1210);row("Cancelled",String(cancelled),1275);row("Recorded expenses",money(expenseTotal),1340);row("Net cash after recorded expenses",money(netCash),1400,true);
 x.textAlign="center";x.fillStyle="#7a7469";x.font="17px Arial";x.fillText("Prepared for internal atelier records · Currency: MMK",600,1460);
 x.fillStyle="#9a7843";x.font="18px Arial";x.fillText("BAHADUR BESPOKE  ·  YANGON",600,1420);
 reportBlob=await new Promise(resolve=>c.toBlob(resolve,"image/png"));if(!reportBlob)throw new Error("Report image could not be created");
 if(reportUrl)URL.revokeObjectURL(reportUrl);reportUrl=URL.createObjectURL(reportBlob);
 reportFilename="bahadur-"+$("report-period").value+"-report-"+$("report-date").value+".png";
 $("report-preview").innerHTML='<img alt="Bahadur premium financial report" src="'+reportUrl+'">';
 $("download-report").disabled=false;$("share-report").disabled=false;$("report-notice").textContent="စာရင်းပုံ ပြင်ဆင်ပြီးပါပြီ။ Orders "+os.length+" ခု · Appointments "+aps.length+" ခု။";
}
const today=new Date();$("report-date").value=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
$("generate-report").addEventListener("click",async()=>{const b=$("generate-report");b.disabled=true;try{await generateFinancialReport()}catch(e){$("report-notice").textContent="Report ထုတ်မရပါ: "+e.message}finally{b.disabled=false}});
$("download-report").addEventListener("click",()=>{if(!reportBlob)return;const a=document.createElement("a");a.href=reportUrl;a.download=reportFilename;a.click()});
$("share-report").addEventListener("click",async()=>{if(!reportBlob)return;try{const file=new File([reportBlob],reportFilename,{type:"image/png"});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({title:"Bahadur Bespoke report",text:"Bahadur Bespoke · "+reportFilename,files:[file]});else{$("download-report").click();$("report-notice").textContent="ဒီ Browser မှာ direct share မရတဲ့အတွက် ပုံကို Download လုပ်ပေးထားပါတယ်။ Download ပြီး Share လုပ်နိုင်ပါတယ်။"}}catch(e){if(e.name!=="AbortError")$("report-notice").textContent="Share မအောင်မြင်ပါ: "+e.message}});
function calculateOrder(){
 const n=id=>Math.max(0,Number($(id).value)||0),qty=Math.max(1,Math.floor(n("order-quantity"))),subtotal=qty*n("order-unit-price")+n("order-fabric-cost")+n("order-labour-cost"),discount=Math.min(subtotal,n("order-discount")),total=Math.max(0,subtotal-discount),deposit=Math.min(total,n("order-deposit")),balance=total-deposit;
 $("order-subtotal").textContent=subtotal.toLocaleString()+" MMK";$("order-total").textContent=total.toLocaleString()+" MMK";$("order-balance").textContent=balance.toLocaleString()+" MMK";
 return {quantity:qty,unitPrice:n("order-unit-price"),fabricCost:n("order-fabric-cost"),labourCost:n("order-labour-cost"),subtotal,discount,total,deposit,balance,currency:"MMK"};
}
async function loadOrders(){try{const snap=await getDocs(collection(db,"orders"));orders=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(dateOf(b.createdAt)?.getTime()||0)-(dateOf(a.createdAt)?.getTime()||0));renderOrders();refreshCalculationSources()}catch(e){$("orders-error").textContent="Order စာရင်း မရယူနိုင်ပါ: "+e.message}}
function renderOrders(){
 if(!$("orders-list"))return;const q=$("order-search").value.toLowerCase();
 const rows=orders.filter(o=>[o.orderNumber,o.customerName,o.garment,o.status].join(" ").toLowerCase().includes(q));
 $("orders-list").innerHTML=rows.length?rows.map(o=>'<article class="item"><div><h3>'+esc(o.orderNumber||("BH-"+String(o.id).slice(0,8).toUpperCase()))+' · '+esc(o.customerName||"Customer")+'</h3><p>'+esc(o.garment||"Bespoke order")+' · Qty '+esc(o.quantity||1)+' · <b>'+Number(o.total||0).toLocaleString()+' MMK</b></p><p>Deposit '+Number(o.deposit||0).toLocaleString()+' MMK · Balance '+Number(o.balance||0).toLocaleString()+' MMK</p><span class="pill">'+esc(o.status||"received")+'</span></div><div class="item-actions"><button class="btn" data-order-status="accepted" data-order-id="'+esc(o.id)+'">Accept</button><button class="btn" data-order-status="in_progress" data-order-id="'+esc(o.id)+'">In progress</button><button class="btn" data-order-status="ready" data-order-id="'+esc(o.id)+'">Ready</button><button class="btn" data-order-status="completed" data-order-id="'+esc(o.id)+'">Complete</button></div></article>').join(""):'<div class="empty">No orders found.</div>';
 $("orders-list").querySelectorAll("[data-order-status]").forEach(b=>b.addEventListener("click",async()=>{const o=orders.find(x=>x.id===b.dataset.orderId),status=b.dataset.orderStatus;if(!o)return;b.disabled=true;try{await updateDoc(doc(db,"orders",o.id),{status,updatedAt:serverTimestamp()});o.status=status;if(o.customerUid){const body="သင့် Order "+(o.orderNumber||"")+" အခြေအနေကို "+status.replace("_"," ")+" သို့ ပြောင်းလဲထားပါသည်။";await addDoc(collection(db,"users",o.customerUid,"notifications"),{type:"order",title:"Order update",body,relatedId:o.id,createdAt:serverTimestamp(),readAt:null});await addDoc(collection(db,"users",o.customerUid,"history"),{type:"order",title:"Order update · "+(o.orderNumber||""),description:body,relatedId:o.id,status,createdAt:serverTimestamp()})}renderOrders()}catch(e){$("orders-error").textContent=e.message;b.disabled=false}}));
}
$("order-form").addEventListener("submit",async e=>{
 e.preventDefault();const f=e.currentTarget,b=f.querySelector('[type="submit"]'),calc=calculateOrder(),d={orderNumber:f.elements.orderNumber.value.trim()||makeVoucherCode("BH"),customerName:f.elements.customerName.value.trim(),customerEmail:f.elements.customerEmail.value.trim(),customerUid:f.elements.customerUid.value,phone:f.elements.phone.value.trim(),gender:f.elements.gender.value||"men",garment:f.elements.garment.value.trim(),notes:f.elements.notes.value.trim(),...calc,status:"received",createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
 if(!d.customerName||!d.garment){$("orders-error").textContent="Customer နဲ့ Garment အမည် ဖြည့်ပါ။";return}
 b.disabled=true;try{const ref=await addDoc(collection(db,"orders"),d);if(d.customerUid){const body="သင့် "+d.garment+" Order ကို Atelier မှ လက်ခံရရှိပါပြီ။ Order No. "+d.orderNumber;await addDoc(collection(db,"users",d.customerUid,"notifications"),{type:"order",title:"Order received",body,relatedId:ref.id,createdAt:serverTimestamp(),readAt:null});await addDoc(collection(db,"users",d.customerUid,"history"),{type:"order",title:"Order received · "+d.orderNumber,description:body,relatedId:ref.id,status:"received",createdAt:serverTimestamp()})}orders.unshift({id:ref.id,...d});renderOrders();refreshCalculationSources();f.reset();$("order-quantity").value="1";["order-unit-price","order-fabric-cost","order-labour-cost","order-discount","order-deposit"].forEach(id=>$(id).value="0");calculateOrder();$("orders-error").textContent="Order သိမ်းဆည်းပြီးပါပြီ။"+(d.customerUid?" Customer ထံ Notification ပို့ပြီးပါပြီ။":" Customer Account မရွေးထားသဖြင့် Notification မပို့နိုင်ပါ။")}catch(err){$("orders-error").textContent="Order မသိမ်းနိုင်ပါ: "+err.message}finally{b.disabled=false}
});
function fillOrderCustomers(){const s=$("order-customer-uid");if(!s)return;const customers=[...new Map(inquiries.filter(x=>x.uid).map(x=>[x.uid,x])).values()];s.innerHTML='<option value="">မချိတ်ဆက်ရသေးပါ</option>'+customers.map(x=>'<option value="'+esc(x.uid)+'">'+esc(x.name||x.email||x.uid)+' · '+esc(x.email||"")+'</option>').join("")}
function renderOverview(){const messages=inquiries.filter(x=>!isAppt(x)),appts=inquiries.filter(isAppt);$("stat-messages").textContent=messages.length;$("stat-unread").textContent=messages.filter(x=>!x.readAt).length;$("stat-pending").textContent=appts.filter(x=>(x.status||"pending")==="pending").length;$("stat-products").textContent=products.filter(x=>x.published!==false).length;const recent=[...inquiries].slice(0,5);$("recent-activity").innerHTML=recent.length?recent.map(x=>'<article class="item"><div><h3>'+esc(x.name||"Customer")+' <span class="pill">'+(isAppt(x)?"Appointment":"Enquiry")+'</span></h3><p>'+esc(x.service||"General enquiry")+' · '+esc(dateLabel(x.createdAt))+'</p></div></article>').join(""):'<div class="empty">No activity yet.</div>'}
async function loadProducts(){try{let snap=await getDocs(collection(db,"products"));if(snap.empty){const marker=await getDoc(doc(db,"siteContent","catalogueMeta"));if(!marker.exists()){const seed=[["Bespoke Suit","Made-to-measure","Business, formal and occasion tailoring.","https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=700&q=85"],["Custom Shirt","Made-to-measure","Choose your collar, cuff, cloth and details.","https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=700&q=85"],["Tailored Trousers","Made-to-measure","A refined fit for work and weekends.","https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=700&q=85"],["Waistcoat & Separates","Made-to-measure","Layering pieces and coordinated separates.","https://images.unsplash.com/photo-1617127365659-c6b0d6e6d1c5?auto=format&fit=crop&w=700&q=85"]];for(let i=0;i<seed.length;i++){const p=seed[i];await addDoc(collection(db,"products"),{name:p[0],category:p[1],description:p[2],imageUrl:p[3],price:"Enquire for price",sortOrder:(i+1)*10,published:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()})}await setDoc(doc(db,"siteContent","catalogueMeta"),{seeded:true,createdAt:serverTimestamp()});snap=await getDocs(collection(db,"products"))}}products=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0));renderProducts();renderOverview()}catch(e){$("products-error").textContent="Products မရယူနိုင်ပါ: "+e.message}}
function renderProducts(){$("products-list").innerHTML=products.length?products.map(p=>'<article class="item"><div>'+(p.imageUrl?'<img class="thumb" src="'+esc(p.imageUrl)+'" alt="">':'')+'<h3>'+esc(p.name)+'</h3><p>'+esc((p.gender||"men").toUpperCase()+" · "+(p.category||"Product"))+' · '+esc(p.price||"Enquire for price")+'</p><p>'+esc(p.description||"")+'</p><span class="pill '+(p.published===false?"cancelled":"confirmed")+'">'+(p.published===false?"Hidden":"Published")+'</span></div><div class="item-actions"><button class="btn" data-edit="'+esc(p.id)+'">Edit</button><button class="btn danger" data-delete="'+esc(p.id)+'">Delete</button></div></article>').join(""):'<div class="empty">No custom products yet. Add your first product.</div>';$("products-list").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editProduct(b.dataset.edit)));$("products-list").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("ဤ Product ကို ဖျက်မလား?"))return;try{await deleteDoc(doc(db,"products",b.dataset.delete));await loadProducts()}catch(e){$("products-error").textContent=e.message}}))}
function editProduct(id){const p=products.find(x=>x.id===id);if(!p)return;const f=$("product-form");Object.keys(p).forEach(k=>{if(f.elements[k]){if(f.elements[k].type==="checkbox")f.elements[k].checked=p[k]!==false;else f.elements[k].value=p[k]??""}});f.elements.id.value=id;$("product-form-title").textContent="Edit product";showTab("products");}
$("product-reset").addEventListener("click",resetProductForm);function resetProductForm(){const f=$("product-form");f.reset();f.elements.id.value="";f.elements.sortOrder.value="10";f.elements.published.checked=true;$("product-form-title").textContent="Add a product";$("product-notice").textContent=""}
$("product-form").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('[type="submit"]'),d=Object.fromEntries(new FormData(f).entries());const id=d.id;delete d.id;d.published=f.elements.published.checked;d.gender=d.gender||"men";d.sortOrder=Number(d.sortOrder)||0;d.updatedAt=serverTimestamp();b.disabled=true;try{if(id)await setDoc(doc(db,"products",id),d,{merge:true});else{d.createdAt=serverTimestamp();await addDoc(collection(db,"products"),d)}$("product-notice").textContent="Product saved.";resetProductForm();await loadProducts()}catch(err){$("product-notice").textContent="Save failed: "+err.message}finally{b.disabled=false}});
async function loadContent(){try{const snap=await getDoc(doc(db,"siteContent","main"));if(!snap.exists())return;const d=snap.data(),f=$("content-form");Object.keys(d).forEach(k=>{if(f.elements[k])f.elements[k].value=d[k]??""})}catch(e){$("content-notice").textContent="Website content မရယူနိုင်ပါ: "+e.message}}
$("content-form").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('[type="submit"]'),d=Object.fromEntries(new FormData(f).entries());Object.keys(d).forEach(k=>d[k]=String(d[k]).trim());d.updatedAt=serverTimestamp();b.disabled=true;try{await setDoc(doc(db,"siteContent","main"),d,{merge:true});$("content-notice").textContent="Website content saved. Public website ကို refresh လုပ်ပါ။"}catch(err){$("content-notice").textContent="Save failed: "+err.message}finally{b.disabled=false}});


const cropModal=$("image-cropper"),cropCanvas=$("cropper-canvas"),cropCtx=cropCanvas.getContext("2d");let cropImage=null,cropTarget=null,cropMaxKB=0,cropRatio=1,cropObjectUrl="";
function cropRect(){const iw=cropImage.naturalWidth,ih=cropImage.naturalHeight,baseW=Math.min(iw,ih*cropRatio),baseH=baseW/cropRatio,zoom=Number($("cropper-zoom").value),w=baseW/zoom,h=baseH/zoom,rangeX=Math.max(0,(iw-w)/2),rangeY=Math.max(0,(ih-h)/2),x=(iw-w)/2+Number($("cropper-x").value)*rangeX,y=(ih-h)/2+Number($("cropper-y").value)*rangeY;return{x,y,w,h}}
function drawCropPreview(){if(!cropImage)return;const ratio=cropRatio,w=720,h=Math.round(w/ratio);cropCanvas.width=w;cropCanvas.height=h;const r=cropRect();cropCtx.clearRect(0,0,w,h);cropCtx.drawImage(cropImage,r.x,r.y,r.w,r.h,0,0,w,h)}
function closeCropper(){cropModal.classList.add("hidden");if(cropObjectUrl)URL.revokeObjectURL(cropObjectUrl);cropObjectUrl="";cropImage=null;cropTarget=null}
$("cropper-close").addEventListener("click",closeCropper);cropModal.addEventListener("click",e=>{if(e.target===cropModal)closeCropper()});["cropper-zoom","cropper-x","cropper-y"].forEach(id=>$(id).addEventListener("input",drawCropPreview));
function openCropper(file,input){const supported=["image/jpeg","image/png","image/webp","image/avif","image/gif","image/bmp"];if(!supported.includes(file.type))throw new Error("JPG, PNG, WebP, AVIF, GIF, BMP ဖိုင်များကိုသာ လက်ခံပါသည်။ HEIC ဖိုင်ကို JPG အဖြစ်ပြောင်းပြီး တင်ပါ။");if(file.size>25*1024*1024)throw new Error("မူရင်းပုံသည် 25 MB ထက်ကြီးနေပါသည်။ ပုံသေးတစ်ပုံ ရွေးပါ။");cropTarget=input;cropMaxKB=Number(input.dataset.maxKb)||300;const [rw,rh]=(input.dataset.ratio||"4:5").split(":").map(Number);cropRatio=rw/rh;$("cropper-ratio-label").textContent="Aspect ratio "+rw+":"+rh+" · WebP · automatic size optimisation";$("cropper-zoom").value=1;$("cropper-x").value=0;$("cropper-y").value=0;$("cropper-error").textContent="";cropObjectUrl=URL.createObjectURL(file);cropImage=new Image();cropImage.onload=()=>{drawCropPreview();cropModal.classList.remove("hidden")};cropImage.onerror=()=>{$("cropper-error").textContent="ဤပုံဖိုင်ကို Browser က မဖတ်နိုင်ပါ။ JPG သို့မဟုတ် PNG အဖြစ်ပြောင်းပြီး ထပ်တင်ပါ။"};cropImage.src=cropObjectUrl}
$("cropper-apply").addEventListener("click",()=>{if(!cropImage||!cropTarget)return;const r=cropRect(),maxDim=1800;let outW,outH;if(cropRatio>=1){outW=maxDim;outH=Math.round(maxDim/cropRatio)}else{outH=maxDim;outW=Math.round(maxDim*cropRatio)}const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");canvas.width=outW;canvas.height=outH;ctx.drawImage(cropImage,r.x,r.y,r.w,r.h,0,0,outW,outH);let quality=.9,data="",targetBytes=cropMaxKB*1024;for(let attempt=0;attempt<18;attempt++){data=canvas.toDataURL("image/webp",quality);if(data.length*.75<=targetBytes)break;if(quality>.48)quality-=.08;else{outW=Math.max(480,Math.round(outW*.84));outH=Math.max(480,Math.round(outH*.84));canvas.width=outW;canvas.height=outH;ctx.drawImage(cropImage,r.x,r.y,r.w,r.h,0,0,outW,outH);quality=.78}}if(!data||data.length*.75>targetBytes){$("cropper-error").textContent="ပုံကို အလိုအလျောက် ချုံ့မရပါ။ ပိုသေးသော မူရင်းပုံကို ရွေးပါ။";return}const target=cropTarget,form=target.closest("form"),field=form?.elements[target.dataset.imageUpload];if(!field){$("cropper-error").textContent="Image field ကို ရှာမတွေ့ပါ။";return}field.value=data;field.dispatchEvent(new Event("input",{bubbles:true}));const note=target.parentElement.querySelector("small");if(note)note.textContent="Ready · "+Math.round(data.length*.75/1024)+" KB · "+target.dataset.ratio+" · WebP auto-optimised";closeCropper()});
document.querySelectorAll("[data-image-upload]").forEach(input=>input.addEventListener("change",()=>{const file=input.files?.[0];if(!file)return;const note=input.parentElement.querySelector("small"),old=note?.textContent||"";try{openCropper(file,input);if(note)note.textContent="Crop အတွက် ပုံဖွင့်နေပါသည်…"}catch(e){if(note)note.textContent=old+" · "+e.message}finally{input.value=""}}));
$("show-admin-password").addEventListener("change",e=>{$("admin-password").type=e.target.checked?"text":"password"});
$("fabric-search").addEventListener("input",renderFabrics);$("fabric-filter").addEventListener("change",renderFabrics);
async function loadFabrics(){try{const snap=await getDocs(collection(db,"fabrics"));fabrics=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||"").localeCompare(b.name||""));renderFabrics()}catch(e){$("fabrics-error").textContent="Fabric စာရင်း မရယူနိုင်ပါ: "+e.message}}
function renderFabrics(){if(!$("fabrics-list"))return;const q=$("fabric-search").value.toLowerCase(),f=$("fabric-filter").value;const rows=fabrics.filter(x=>(x.name+" "+x.colour+" "+x.composition+" "+x.pattern).toLowerCase().includes(q)&&(f==="all"||(f==="hidden"&&x.published===false)||(f==="available"&&x.availability==="available"&&x.published!==false)||(f==="enquire"&&x.availability==="enquire"&&x.published!==false)));$("fabrics-list").innerHTML=rows.length?rows.map(x=>'<article class="item"><div>'+(x.imageUrl?'<img class="thumb" src="'+esc(x.imageUrl)+'" alt="">':'<span class="thumb" style="background:'+esc(x.swatchHex||"#e8e2d6")+'"></span>')+'<h3>'+esc(x.name)+'</h3><p>'+esc(x.kind||"other")+' · '+esc(x.colour||"Colour not set")+' · '+esc(x.pattern||"Plain")+'</p><p>'+esc(x.composition||"Composition to be confirmed")+' · '+esc(x.weight||"Weight not set")+'</p><span class="pill '+(x.published===false?"cancelled":"confirmed")+'">'+(x.published===false?"Hidden":esc(x.availability||"Enquire first"))+'</span></div><div class="item-actions"><button class="btn" data-fabric-edit="'+esc(x.id)+'">Edit</button><button class="btn danger" data-fabric-delete="'+esc(x.id)+'">Delete</button></div></article>').join(""):'<div class="empty">No fabric options match this filter.</div>';$("fabrics-list").querySelectorAll("[data-fabric-edit]").forEach(b=>b.addEventListener("click",()=>editFabric(b.dataset.fabricEdit)));$("fabrics-list").querySelectorAll("[data-fabric-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("ဒီ fabric option ကို ဖျက်မလား?"))return;try{await deleteDoc(doc(db,"fabrics",b.dataset.fabricDelete));await loadFabrics()}catch(e){$("fabrics-error").textContent=e.message}}))}
function editFabric(id){const x=fabrics.find(v=>v.id===id);if(!x)return;const f=$("fabric-form");Object.keys(x).forEach(k=>{if(f.elements[k]){if(f.elements[k].type==="checkbox")f.elements[k].checked=x[k]!==false;else f.elements[k].value=x[k]??""}});f.elements.id.value=id;$("fabric-form-title").textContent="Edit fabric option";showTab("fabrics")}
$("fabric-reset").addEventListener("click",resetFabric);function resetFabric(){const f=$("fabric-form");f.reset();f.elements.id.value="";f.elements.published.checked=true;$("fabric-form-title").textContent="Add fabric option";$("fabric-notice").textContent=""}
$("fabric-form").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('[type="submit"]'),d=Object.fromEntries(new FormData(f).entries()),id=d.id;delete d.id;d.published=f.elements.published.checked;d.updatedAt=serverTimestamp();b.disabled=true;try{if(id)await setDoc(doc(db,"fabrics",id),d,{merge:true});else{d.createdAt=serverTimestamp();await addDoc(collection(db,"fabrics"),d)}$("fabric-notice").textContent="Fabric option saved.";resetFabric();await loadFabrics()}catch(err){$("fabric-notice").textContent="Save failed: "+err.message}finally{b.disabled=false}});
