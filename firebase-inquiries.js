import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const ready = !Object.values(firebaseConfig).some(v => String(v).startsWith("REPLACE_"));
const app = ready ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;
const form = document.getElementById("inquiry-form"), status = document.getElementById("inquiry-status");
const t=key=>window.bahaduText?.(key)||key;
if(form&&ready){

 form.addEventListener("submit",async e=>{
  e.preventDefault();const btn=form.querySelector('button[type="submit"]');btn.disabled=true;status.textContent=t("formSending");
  const fd=new FormData(form);
  try{await addDoc(collection(db,"inquiries"),{name:String(fd.get("name")||"").trim(),email:String(fd.get("email")||"").trim(),phone:String(fd.get("phone")||"").trim(),preferredDate:String(fd.get("preferredDate")||"").trim(),preferredTime:String(fd.get("preferredTime")||"").trim(),service:String(fd.get("service")||"").trim(),message:String(fd.get("message")||"").trim(),createdAt:serverTimestamp()});form.reset();status.textContent=t("formSuccess")}
  catch(err){console.error(err);status.textContent=t("formError")}
  finally{btn.disabled=false}
 });
}else if(form&&status)status.textContent=t("formPending");

const bookingForm=document.getElementById("appointment-form"),bookingStatus=document.getElementById("booking-status");
if(bookingForm&&ready){
 bookingForm.addEventListener("submit",async e=>{
  e.preventDefault();const submit=bookingForm.querySelector('button[type="submit"]');if(!bookingForm.reportValidity())return;
  submit.disabled=true;bookingStatus.textContent=window.bahaduText?.("formSending")||"Sending…";
  const fd=new FormData(bookingForm);
  try{
   await addDoc(collection(db,"appointmentRequests"),{
    name:String(fd.get("name")||"").trim(),email:String(fd.get("email")||"").trim(),phone:String(fd.get("phone")||"").trim(),
    service:String(fd.get("service")||""),appointmentMode:String(fd.get("appointmentMode")||""),preferredDate:String(fd.get("preferredDate")||""),
    preferredTime:String(fd.get("preferredTime")||""),eventDate:String(fd.get("eventDate")||""),partySize:String(fd.get("partySize")||"1"),
    message:String(fd.get("message")||"").trim(),status:"pending",createdAt:serverTimestamp()
   });
   bookingForm.reset();bookingForm.querySelectorAll(".booking-stage").forEach((el,i)=>el.classList.toggle("is-active",i===0));
   document.getElementById("booking-step-label").textContent="01 / 02";document.getElementById("booking-progress-fill").style.width="50%";
   bookingStatus.textContent=window.bahaduText?.("formSuccess")||"Request received. Our team will contact you.";
  }catch(err){console.error(err);bookingStatus.textContent=window.bahaduText?.("formError")||"Unable to send. Please contact us via WhatsApp.";}
  finally{submit.disabled=false;}
 });
}else if(bookingForm&&bookingStatus){bookingStatus.textContent=window.bahaduText?.("formPending")||"Booking setup pending.";}
