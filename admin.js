import{initializeApp}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import{getFunctions,httpsCallable}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js";
import{firebaseConfig}from"./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),functions=getFunctions(app,"asia-southeast1");
const callList=httpsCallable(functions,"listAppointments"),updateStatus=httpsCallable(functions,"updateAppointmentStatus");
const loginCard=document.getElementById("login-card"),dashboard=document.getElementById("dashboard"),loginError=document.getElementById("login-error"),dashError=document.getElementById("dashboard-error"),list=document.getElementById("appointments");
let rows=[],filter="all";
document.getElementById("login-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await signInWithEmailAndPassword(auth,f.get("email"),f.get("password"));loginError.textContent=""}catch(err){loginError.textContent=err.message}});
document.getElementById("logout").addEventListener("click",()=>signOut(auth));
document.getElementById("refresh").addEventListener("click",load);
document.querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.filter;render()}));
onAuthStateChanged(auth,async user=>{
 if(!user){loginCard.hidden=false;dashboard.hidden=true;document.getElementById("logout").hidden=true;document.getElementById("refresh").hidden=true;return}
 try{const token=await user.getIdTokenResult(true);if(token.claims.admin!==true){await signOut(auth);loginError.textContent="This account is not authorised as an administrator.";return}loginCard.hidden=true;dashboard.hidden=false;document.getElementById("logout").hidden=false;document.getElementById("refresh").hidden=false;await load()}
 catch(err){dashError.textContent=err.message}
});
async function load(){dashError.textContent="Loading appointments…";try{const res=await callList();rows=res.data.appointments||[];render();dashError.textContent=""}catch(err){dashError.textContent=err.message}}
function esc(v){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function render(){const shown=rows.filter(a=>filter==="all"||a.status===filter);list.innerHTML=shown.length?shown.map(a=>'<article class="booking-row"><div><h3>'+esc(a.name)+' <span class="status">· '+esc(a.status)+'</span></h3><p><b>'+esc(a.preferredDate)+' · '+esc(a.preferredTime)+' Yangon time</b> — '+esc(a.service)+'</p><p>'+esc(a.appointmentMode)+' · Party: '+esc(a.partySize)+'</p><p>'+esc(a.email)+' · '+esc(a.phone)+'</p><p>Event: '+esc(a.eventDate||"Not specified")+'</p><p>'+esc(a.message)+'</p><p>Request ID: '+esc(a.id)+'</p></div><div class="admin-actions">'+(a.status==="pending"?'<button class="admin-btn gold" data-action="confirmed" data-id="'+esc(a.id)+'">Confirm & email</button><button class="admin-btn" data-action="cancelled" data-id="'+esc(a.id)+'">Cancel & release slot</button>':'')+'</div></article>').join(""):'<div class="admin-card admin-muted">No appointments in this view.</div>';list.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;dashError.textContent="Updating…";try{await updateStatus({appointmentId:b.dataset.id,status:b.dataset.action});await load()}catch(err){dashError.textContent=err.message;b.disabled=false}}))}
