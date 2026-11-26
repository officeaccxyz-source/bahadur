import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";\nimport { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
const ready=!Object.values(firebaseConfig).some(v=>String(v).startsWith("REPLACE_"));
const app=ready?initializeApp(firebaseConfig):null,db=app?getFirestore(app):null,auth=app?getAuth(app):null;
const t=key=>window.bahaduText?.(key)||key;
const bookingCopy={
 en:{loading:"Checking available times…",choose:"Choose an available time",none:"No times available — choose another date",failed:"Availability unavailable — try again",loadError:"Could not load live availability. Please retry or contact us on WhatsApp.",sending:"Checking the slot and sending your request…",received:"Request received.",held:"Your request is sent to the atelier for review. The appointment is not confirmed until the team contacts you.",slotTaken:"This time has just been taken. Please choose another available slot.",expired:"This request has expired. Please choose another available time.",fallback:"Unable to request this slot. Please refresh availability and try again."},
 my:{loading:"ရနိုင်သော အချိန်များကို စစ်ဆေးနေသည်…",choose:"ရနိုင်သော အချိန်ကို ရွေးပါ",none:"ရက်ချိန်းအချိန် မရှိတော့ပါ — အခြားရက်ရွေးပါ",failed:"ရရှိနိုင်မှုကို မစစ်ဆေးနိုင်ပါ — ထပ်ကြိုးစားပါ",loadError:"လက်ရှိရနိုင်သောအချိန်ကို မရယူနိုင်ပါ။ WhatsApp မှ ဆက်သွယ်နိုင်ပါသည်။",sending:"အချိန်ကို စစ်ဆေးပြီး တောင်းဆိုချက်ပေးပို့နေသည်…",received:"ရက်ချိန်းတောင်းဆိုမှု လက်ခံရရှိပါပြီ။",held:"သင့်တောင်းဆိုချက်ကို Atelier သို့ ပေးပို့ပြီး စစ်ဆေးပေးပါမည်။ အဖွဲ့မှ အတည်ပြုဆက်သွယ်မှသာ ရက်ချိန်းအတည်ဖြစ်ပါမည်။",slotTaken:"ဤအချိန်ကို အခြားသူက ရယူသွားပါပြီ။ အခြားအချိန်ရွေးပါ။",expired:"ဤတောင်းဆိုမှု သက်တမ်းကုန်သွားပါပြီ။ အခြားအချိန်ရွေးပါ။",fallback:"ရက်ချိန်းတောင်းဆိုမှု မအောင်မြင်ပါ။ အချိန်ရရှိမှုကို ပြန်စစ်ပြီး ထပ်ကြိုးစားပါ။"},
 th:{loading:"กำลังตรวจสอบเวลาว่าง…",choose:"เลือกเวลาที่ว่าง",none:"ไม่มีเวลาว่างในวันนี้ — กรุณาเลือกวันอื่น",failed:"ไม่สามารถตรวจสอบเวลาว่างได้ — กรุณาลองอีกครั้ง",loadError:"ไม่สามารถโหลดเวลาว่างได้ โปรดลองอีกครั้งหรือติดต่อ WhatsApp",sending:"กำลังตรวจสอบช่วงเวลาและส่งคำขอ…",received:"ได้รับคำขอนัดหมายแล้ว",held:"ส่งคำขอให้ทีมงานตรวจสอบแล้ว การนัดหมายจะยังไม่ยืนยันจนกว่าทีมงานจะติดต่อกลับ",slotTaken:"ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกเวลาอื่น",expired:"คำขอนี้หมดอายุแล้ว กรุณาเลือกเวลาใหม่",fallback:"ไม่สามารถส่งคำขอได้ กรุณาตรวจสอบเวลาว่างแล้วลองอีกครั้ง"}
};
const bm=key=>bookingCopy[window.bahaduLang?.()||"en"]?.[key]||bookingCopy.en[key];

const form=document.getElementById("inquiry-form"),status=document.getElementById("inquiry-status");
if(form&&ready)form.addEventListener("submit",async e=>{e.preventDefault();const btn=form.querySelector('button[type="submit"]');btn.disabled=true;status.textContent=t("formSending");const fd=new FormData(form);try{await addDoc(collection(db,"inquiries"),{name:String(fd.get("name")||"").trim(),email:String(fd.get("email")||"").trim(),phone:String(fd.get("phone")||"").trim(),preferredDate:String(fd.get("preferredDate")||"").trim(),preferredTime:String(fd.get("preferredTime")||"").trim(),service:String(fd.get("service")||"").trim(),message:String(fd.get("message")||"").trim(),createdAt:serverTimestamp()});form.reset();status.textContent=t("formSuccess")}catch(err){console.error(err);status.textContent=t("formError")}finally{btn.disabled=false}});
else if(form&&status)status.textContent=t("formPending");

const booking=document.getElementById("appointment-form"),bookingStatus=document.getElementById("booking-status");
if(booking&&ready){
 const date=booking.querySelector('[name="preferredDate"]'),time=booking.querySelector('[name="preferredTime"]');
 const today=()=>{const n=new Date();return new Date(n.getTime()-n.getTimezoneOffset()*60000).toISOString().slice(0,10)};
 if(date)date.min=today();
 const fillTimes=()=>{
  const selected=date.value,weekday=selected?new Date(selected+"T12:00:00").getDay():-1;
  time.innerHTML='<option value="">'+bm("choose")+'</option>';
  if(!selected){time.disabled=true;return}
  if(weekday===0){time.innerHTML='<option value="">'+bm("none")+'</option>';time.disabled=true;return}
  for(let h=9;h<17;h++){const v=String(h).padStart(2,"0")+":00";const opt=document.createElement("option");opt.value=v;opt.textContent=v+" (Yangon time)";time.append(opt)}
  time.disabled=false;
 };
 date?.addEventListener("change",fillTimes);
 booking.addEventListener("submit",async e=>{
  e.preventDefault();if(!booking.reportValidity())return;
  const submit=booking.querySelector('button[type="submit"]');submit.disabled=true;bookingStatus.textContent=bm("sending");
  const fd=new FormData(booking);
  try{
   await addDoc(collection(db,"inquiries"),{
    type:"appointment",status:"pending",readAt:null,...(auth?.currentUser?{uid:auth.currentUser.uid}:{}),
    name:String(fd.get("name")||"").trim(),email:String(fd.get("email")||"").trim(),
    phone:String(fd.get("phone")||"").trim(),service:String(fd.get("service")||"").trim(),
    appointmentMode:String(fd.get("appointmentMode")||"").trim(),
    preferredDate:String(fd.get("preferredDate")||"").trim(),preferredTime:String(fd.get("preferredTime")||"").trim(),
    eventDate:String(fd.get("eventDate")||"").trim(),partySize:String(fd.get("partySize")||"1").trim(),
    suitStyle:String(fd.get("suitStyle")||"").trim(),message:String(fd.get("message")||"").trim(),
    createdAt:serverTimestamp()
   });
   booking.reset();booking.querySelectorAll(".booking-stage").forEach((el,i)=>el.classList.toggle("is-active",i===0));
   document.getElementById("booking-step-label").textContent="01 / 02";document.getElementById("booking-progress-fill").style.width="50%";
   fillTimes();bookingStatus.textContent=bm("received")+" "+bm("held");
  }catch(err){console.error(err);bookingStatus.textContent=err.message||bm("fallback")}
  finally{submit.disabled=false}
 });
}else if(booking&&bookingStatus)bookingStatus.textContent=t("formPending");
