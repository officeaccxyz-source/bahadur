import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const ready = !Object.values(firebaseConfig).some(v => String(v).startsWith("REPLACE_"));
const form = document.getElementById("inquiry-form"), status = document.getElementById("inquiry-status");
const t=key=>window.bahaduText?.(key)||key;
if(form&&ready){
 const db=getFirestore(initializeApp(firebaseConfig));
 form.addEventListener("submit",async e=>{
  e.preventDefault();const btn=form.querySelector('button[type="submit"]');btn.disabled=true;status.textContent=t("formSending");
  const fd=new FormData(form);
  try{await addDoc(collection(db,"inquiries"),{name:String(fd.get("name")||"").trim(),email:String(fd.get("email")||"").trim(),phone:String(fd.get("phone")||"").trim(),preferredDate:String(fd.get("preferredDate")||"").trim(),preferredTime:String(fd.get("preferredTime")||"").trim(),service:String(fd.get("service")||"").trim(),message:String(fd.get("message")||"").trim(),createdAt:serverTimestamp()});form.reset();status.textContent=t("formSuccess")}
  catch(err){console.error(err);status.textContent=t("formError")}
  finally{btn.disabled=false}
 });
}else if(form&&status)status.textContent=t("formPending");
