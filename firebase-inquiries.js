import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js";
import { firebaseConfig } from "./firebase-config.js";
const ready=!Object.values(firebaseConfig).some(v=>String(v).startsWith("REPLACE_"));
const app=ready?initializeApp(firebaseConfig):null,db=app?getFirestore(app):null,functions=app?getFunctions(app,"asia-southeast1"):null;
const t=key=>window.bahaduText?.(key)||key;
const form=document.getElementById("inquiry-form"),status=document.getElementById("inquiry-status");
if(form&&ready)form.addEventListener("submit",async e=>{e.preventDefault();const btn=form.querySelector('button[type="submit"]');btn.disabled=true;status.textContent=t("formSending");const fd=new FormData(form);try{await addDoc(collection(db,"inquiries"),{name:String(fd.get("name")||"").trim(),email:String(fd.get("email")||"").trim(),phone:String(fd.get("phone")||"").trim(),preferredDate:String(fd.get("preferredDate")||"").trim(),preferredTime:String(fd.get("preferredTime")||"").trim(),service:String(fd.get("service")||"").trim(),message:String(fd.get("message")||"").trim(),createdAt:serverTimestamp()});form.reset();status.textContent=t("formSuccess")}catch(err){console.error(err);status.textContent=t("formError")}finally{btn.disabled=false}});
else if(form&&status)status.textContent=t("formPending");

const booking=document.getElementById("appointment-form"),bookingStatus=document.getElementById("booking-status");
if(booking&&ready){
 const getSlots=httpsCallable(functions,"getAvailableSlots"),createBooking=httpsCallable(functions,"createAppointment");
 const date=booking.querySelector('[name="preferredDate"]'),time=booking.querySelector('[name="preferredTime"]'),mode=booking.querySelector('[name="appointmentMode"]');
 const initial=time.innerHTML;
 const localToday=()=>{const n=new Date();return new Date(n.getTime()-n.getTimezoneOffset()*60000).toISOString().slice(0,10)};
 if(date)date.min=localToday();
 async function refreshSlots(){
  time.innerHTML='<option value="">Checking available times…</option>';time.disabled=true;bookingStatus.textContent="";
  if(!date.value){time.innerHTML=initial;time.disabled=false;return}
  try{const result=await getSlots({date:date.value,appointmentMode:mode.value});const slots=result.data.slots||[];time.innerHTML='<option value="">Choose an available time</option>'+slots.map(s=>'<option value="'+s.time+'">'+s.label+' (Yangon time)</option>').join("");if(!slots.length)time.innerHTML='<option value="">No times available — choose another date</option>';}
  catch(err){console.error(err);time.innerHTML='<option value="">Availability unavailable — try again</option>';bookingStatus.textContent="Could not load live availability. Please retry or contact us on WhatsApp."}
  finally{time.disabled=false}
 }
 date?.addEventListener("change",refreshSlots);mode?.addEventListener("change",refreshSlots);
 booking.addEventListener("submit",async e=>{
  e.preventDefault();if(!booking.reportValidity())return;
  const submit=booking.querySelector('button[type="submit"]');submit.disabled=true;bookingStatus.textContent="Checking the slot and sending your request…";
  const fd=new FormData(booking);
  try{
   const result=await createBooking({name:fd.get("name"),email:fd.get("email"),phone:fd.get("phone"),service:fd.get("service"),appointmentMode:fd.get("appointmentMode"),preferredDate:fd.get("preferredDate"),preferredTime:fd.get("preferredTime"),eventDate:fd.get("eventDate"),partySize:fd.get("partySize"),message:fd.get("message")});
   booking.reset();booking.querySelectorAll(".booking-stage").forEach((el,i)=>el.classList.toggle("is-active",i===0));document.getElementById("booking-step-label").textContent="01 / 02";document.getElementById("booking-progress-fill").style.width="50%";
   time.innerHTML=initial;bookingStatus.textContent="Request received. Reference: "+result.data.appointmentId+". Your slot is held for up to 24 hours while the atelier reviews it. It is not confirmed until you receive confirmation.";
  }catch(err){console.error(err);bookingStatus.textContent=err.message||"Unable to request this slot. Please refresh availability and try again.";if(date.value)await refreshSlots();}
  finally{submit.disabled=false}
 });
}else if(booking&&bookingStatus)bookingStatus.textContent=t("formPending");
