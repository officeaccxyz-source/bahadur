import{initializeApp}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import{getFirestore,doc,getDoc,collection,getDocs}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import{firebaseConfig}from"./firebase-config.js";
if(!Object.values(firebaseConfig).some(v=>String(v).startsWith("REPLACE_"))){
 try{
  const app=initializeApp(firebaseConfig),db=getFirestore(app);
  const snap=await getDoc(doc(db,"siteContent","main"));
  if(snap.exists()){
   const c=snap.data(),set=(selector,value,html=false)=>{const el=document.querySelector(selector);if(el&&value)html?el.innerHTML=String(value).replace(/</g,"&lt;").replace(/\n/g,"<br>"):el.textContent=value};
   set(".hero .eyebrow",c.heroEyebrow);set(".hero h1",c.heroTitle);set(".hero .hero-copy",c.heroText);set(".intro-copy h2",c.introTitle);set(".intro-copy>p:not(.eyebrow)",c.introText);set(".story-content h2",c.storyTitle);set(".story-content>p:not(.eyebrow)",c.storyText);set(".collections .section-heading h2",c.collectionTitle);set(".collections .section-heading>p",c.collectionSide);set(".products .section-heading h2",c.productHeading);set(".products .section-heading>p",c.productIntro);
   if(c.heroImage)document.querySelector(".hero-image")?.style.setProperty("background-image","url("+JSON.stringify(c.heroImage)+")");
   if(c.storyImage)document.querySelector(".story-photo")?.style.setProperty("background-image","url("+JSON.stringify(c.storyImage)+")");
   ["collectionImage1","collectionImage2","collectionImage3"].forEach((k,i)=>{const el=document.querySelectorAll(".collection-image")[i];if(el&&c[k])el.style.backgroundImage="url("+JSON.stringify(c[k])+")"});
   ["journalImage1","journalImage2","journalImage3"].forEach((k,i)=>{const img=document.querySelectorAll(".portfolio-grid img")[i];if(img&&c[k])img.src=c[k]});
   if(c.pageTitle)document.title=c.pageTitle;
  }
  const products=await getDocs(collection(db,"products"));
  const published=products.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.published!==false).sort((a,b)=>(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0));
  if(published.length){
   const grid=document.querySelector(".product-grid");
   if(grid)grid.innerHTML=published.map(p=>'<article class="product-card"><div class="product-image" data-image="'+safe(p.imageUrl)+'" role="img" aria-label="'+safe(p.name)+'" style="background-image:url(&quot;'+safe(p.imageUrl)+'&quot;);background-size:cover;background-position:center"></div><div class="product-meta"><h3>'+safe(p.name)+'</h3><span>'+safe(p.category||"MADE TO MEASURE")+'</span></div><p>'+safe(p.description||"Made with care by Bahadu Bespoke.")+'</p><p class="product-price">'+safe(p.price||"Enquire for price")+'</p><div class="product-actions"><a href="booking.html?service='+encodeURIComponent(p.name)+'" class="product-link">Enquire about this piece ↗</a><button type="button" class="save-piece" data-save-piece="'+safe(p.id)+'">♡ Save piece</button><a class="product-link" href="account.html?product='+encodeURIComponent(p.name)+'">Customise ↗</a></div></article>').join("");
  }
 }catch(e){console.warn("Bahadu CMS content could not be loaded:",e)}
}
function safe(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
