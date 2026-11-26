import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const ready = !Object.values(firebaseConfig).some(v => String(v).startsWith("REPLACE_"));
const form = document.getElementById("inquiry-form");
const status = document.getElementById("inquiry-status");
if (form && ready) {
  const db = getFirestore(initializeApp(firebaseConfig));
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn=form.querySelector('button[type="submit"]'); btn.disabled=true;
    status.textContent="Sending…";
    const fd=new FormData(form);
    try {
      await addDoc(collection(db,"inquiries"), {
        name:String(fd.get("name")||"").trim(), email:String(fd.get("email")||"").trim(),
        phone:String(fd.get("phone")||"").trim(), service:String(fd.get("service")||"").trim(),
        message:String(fd.get("message")||"").trim(), createdAt:serverTimestamp()
      });
      form.reset(); status.textContent="Thank you! We’ve received your request.";
    } catch(err) { console.error(err); status.textContent="Unable to send. Please contact us by WhatsApp or email."; }
    finally { btn.disabled=false; }
  });
} else if(form && status) status.textContent="Form setup pending — contact us via WhatsApp or email.";
