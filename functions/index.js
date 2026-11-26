const {onCall,HttpsError}=require("firebase-functions/v2/https");
const {setGlobalOptions}=require("firebase-functions/v2");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue,Timestamp}=require("firebase-admin/firestore");
const {createHash}=require("node:crypto");

initializeApp();
const db=getFirestore();
const REGION="asia-southeast1";
const TZ="Asia/Yangon";
const OPEN_HOUR=9, CLOSE_HOUR=17, SLOT_MINUTES=60, LEAD_HOURS=2, MAX_DAYS=90, PENDING_HOURS=24;
setGlobalOptions({region:REGION,maxInstances:10});

function requireAdmin(req){
 if(!req.auth || req.auth.token.admin!==true) throw new HttpsError("permission-denied","Administrator access required.");
}
function clean(v,max=500){return typeof v==="string"?v.trim().slice(0,max):"";}
function validDate(s){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+"T00:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;
}
function dateDiffDays(s){
 const today=new Date(new Date().toLocaleString("en-US",{timeZone:TZ}));
 const base=new Date(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()));
 return Math.floor((Date.parse(s+"T00:00:00Z")-base.getTime())/86400000);
}
function slotId(date,time){return date+"_"+time.replace(":","");}
function slotDateTime(date,time){return new Date(date+"T"+time+":00+06:30");}
function assertSlotWindow(date,time){
 if(!validDate(date))throw new HttpsError("invalid-argument","Choose a valid appointment date.");
 const diff=dateDiffDays(date);
 if(diff<0||diff>MAX_DAYS)throw new HttpsError("failed-precondition","Appointments can be booked up to 90 days ahead.");
 const day=new Date(date+"T00:00:00Z").getUTCDay();
 if(day===0)throw new HttpsError("failed-precondition","The atelier is closed on Sundays.");
 if(!/^\d{2}:00$/.test(time))throw new HttpsError("invalid-argument","Choose an available hourly time slot.");
 const hour=Number(time.slice(0,2));
 if(hour<OPEN_HOUR||hour>=CLOSE_HOUR)throw new HttpsError("failed-precondition","That time is outside atelier opening hours.");
 if(slotDateTime(date,time).getTime()<Date.now()+LEAD_HOURS*3600000)throw new HttpsError("failed-precondition","Please choose a time at least two hours from now.");
}
async function limitBooking(req,tx){
 const ip=clean(req.rawRequest&&req.rawRequest.ip||"unknown",80);
 const key=createHash("sha256").update(ip).digest("hex");
 const ref=db.collection("bookingRateLimits").doc(key);
 const snap=await tx.get(ref),now=Date.now(),data=snap.exists?snap.data():{};
 const reset=Number(data.resetAt||0);
 if(reset>now&&Number(data.count||0)>=5)throw new HttpsError("resource-exhausted","Too many booking attempts. Please try again later.");
 tx.set(ref,reset>now?{count:FieldValue.increment(1)}:{count:1,resetAt:now+15*60*1000},{merge:true});
}
exports.getAvailableSlots=onCall({region:REGION},async(req)=>{
 const date=clean(req.data&&req.data.date,10);
 if(!validDate(date))throw new HttpsError("invalid-argument","Choose a valid date.");
 const diff=dateDiffDays(date),day=new Date(date+"T00:00:00Z").getUTCDay();
 if(diff<0||diff>MAX_DAYS||day===0)return {date,timeZone:TZ,slots:[]};
 const now=Date.now(),refs=[];
 for(let h=OPEN_HOUR;h<CLOSE_HOUR;h++)refs.push(db.collection("slotLocks").doc(slotId(date,String(h).padStart(2,"0")+":00")));
 const snaps=await db.getAll(...refs);
 const slots=snaps.map((snap,i)=>{
  const time=String(OPEN_HOUR+i).padStart(2,"0")+":00",lock=snap.exists?snap.data():null;
  const active=lock&&lock.status==="booked"&&(!lock.expiresAt||lock.expiresAt.toMillis()>now);
  const tooSoon=slotDateTime(date,time).getTime()<now+LEAD_HOURS*3600000;
  return {time,label:time,available:!active&&!tooSoon};
 }).filter(s=>s.available);
 return {date,timeZone:TZ,slots};
});
exports.createAppointment=onCall({region:REGION},async(req)=>{
 const d=req.data||{};
 const data={
  name:clean(d.name,100),email:clean(d.email,160).toLowerCase(),phone:clean(d.phone,40),
  service:clean(d.service,80),appointmentMode:clean(d.appointmentMode,60),
  preferredDate:clean(d.preferredDate,10),preferredTime:clean(d.preferredTime,5),
  eventDate:clean(d.eventDate,10),partySize:clean(d.partySize,10),message:clean(d.message,1500)
 };
 if(data.name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)||data.phone.length<6||!data.service||!["In-store consultation","Online consultation"].includes(data.appointmentMode)||!data.partySize)
  throw new HttpsError("invalid-argument","Please complete all required contact and service details.");
 assertSlotWindow(data.preferredDate,data.preferredTime);
 if(data.eventDate&&!validDate(data.eventDate))throw new HttpsError("invalid-argument","Enter a valid event date.");
 const lockRef=db.collection("slotLocks").doc(slotId(data.preferredDate,data.preferredTime));
 const apptRef=db.collection("appointments").doc();
 const rateIp=clean(req.rawRequest&&req.rawRequest.ip||"unknown",80);
 const rateRef=db.collection("bookingRateLimits").doc(createHash("sha256").update(rateIp).digest("hex"));
 await db.runTransaction(async tx=>{
  const [lockSnap,rateSnap]=await Promise.all([tx.get(lockRef),tx.get(rateRef)]);
  const now=Date.now(),rate=rateSnap.exists?rateSnap.data():{};
  if(Number(rate.resetAt||0)>now&&Number(rate.count||0)>=5)throw new HttpsError("resource-exhausted","Too many booking attempts. Please try again later.");
  if(Number(rate.resetAt||0)>now)tx.set(rateRef,{count:Number(rate.count||0)+1},{merge:true});
  else tx.set(rateRef,{count:1,resetAt:now+15*60*1000});
  if(lockSnap.exists){
   const lock=lockSnap.data(),expired=lock.status==="booked"&&lock.expiresAt&&lock.expiresAt.toMillis()<=now;
   if(lock.status==="booked"&&!expired)throw new HttpsError("already-exists","This appointment time has just been taken. Please choose another slot.");
  }
  const expiresAt=Timestamp.fromMillis(now+PENDING_HOURS*3600000);
  tx.create(apptRef,{...data,status:"pending",timeZone:TZ,slotId:lockRef.id,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),expiresAt});
  tx.set(lockRef,{status:"booked",appointmentId:apptRef.id,expiresAt,updatedAt:FieldValue.serverTimestamp()});
 });
 return {appointmentId:apptRef.id,status:"pending",message:"Your request is received. The atelier will review and confirm it."};
});
exports.listAppointments=onCall({region:REGION},async(req)=>{
 requireAdmin(req);
 const snap=await db.collection("appointments").orderBy("createdAt","desc").limit(150).get();
 return {appointments:snap.docs.map(doc=>{const x=doc.data();return {id:doc.id,name:x.name,email:x.email,phone:x.phone,service:x.service,appointmentMode:x.appointmentMode,preferredDate:x.preferredDate,preferredTime:x.preferredTime,eventDate:x.eventDate||"",partySize:x.partySize||"1",message:x.message||"",status:x.status==="pending"&&x.expiresAt&&x.expiresAt.toMillis()<=Date.now()?"expired":x.status,createdAt:x.createdAt?x.createdAt.toDate().toISOString():null,expiresAt:x.expiresAt?x.expiresAt.toDate().toISOString():null};})};
});
exports.updateAppointmentStatus=onCall({region:REGION},async(req)=>{
 requireAdmin(req);
 const id=clean(req.data&&req.data.appointmentId,100),status=clean(req.data&&req.data.status,20);
 if(!id||!["confirmed","cancelled"].includes(status))throw new HttpsError("invalid-argument","Invalid appointment update.");
 const ref=db.collection("appointments").doc(id);
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);if(!snap.exists)throw new HttpsError("not-found","Appointment not found.");
  const a=snap.data();if(a.status!=="pending")throw new HttpsError("failed-precondition","Only pending appointments can be updated.");
  const lockRef=db.collection("slotLocks").doc(a.slotId);
  const lockSnap=await tx.get(lockRef);
  if(status==="confirmed"){
   if(a.expiresAt&&a.expiresAt.toMillis()<=Date.now())throw new HttpsError("deadline-exceeded","This pending request has expired. Ask the customer to book another slot.");
   tx.update(ref,{status:"confirmed",confirmedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),expiresAt:null});
   if(lockSnap.exists&&lockSnap.data().appointmentId===id)tx.update(lockRef,{expiresAt:null,status:"booked",updatedAt:FieldValue.serverTimestamp()});
   const date=a.preferredDate,time=a.preferredTime;
   const dateLabel=date+" at "+time+" (Asia/Yangon)";
   const escapeHtml=value=>String(value||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
   tx.set(db.collection("mail").doc(),{to:[a.email],message:{subject:"Bahadu Bespoke — Appointment confirmed",text:"Dear "+a.name+", your "+a.service+" appointment is confirmed for "+dateLabel+". If you need to make a change, please contact info@bahadubespoke.com or +95 9 26788 0695.",html:"<p>Dear "+a.name.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+",</p><p>Your <b>"+escapeHtml(a.service)+"</b> appointment is confirmed for <b>"+dateLabel+"</b>.</p><p>If you need to make a change, contact <a href=\"mailto:info@bahadubespoke.com\">info@bahadubespoke.com</a> or +95 9 26788 0695.</p><p>Bahadu Bespoke</p>"} ,createdAt:FieldValue.serverTimestamp()});
  }else{
   tx.update(ref,{status:"cancelled",cancelledAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
   if(lockSnap.exists&&lockSnap.data().appointmentId===id)tx.delete(lockRef);
   tx.set(db.collection("mail").doc(),{to:[a.email],message:{subject:"Bahadu Bespoke — Appointment request cancelled",text:"Dear "+a.name+", your appointment request for "+a.preferredDate+" at "+a.preferredTime+" (Yangon time) has been cancelled. Please contact us if you would like to arrange another time.",html:"<p>Dear "+escapeHtml(a.name)+",</p><p>Your appointment request for <b>"+a.preferredDate+" at "+a.preferredTime+" (Yangon time)</b> has been cancelled.</p><p>Please contact info@bahadubespoke.com if you would like to arrange another time.</p><p>Bahadu Bespoke</p>"} ,createdAt:FieldValue.serverTimestamp()});
  }
 });
 return {success:true,status};
});
