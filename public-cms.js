import{initializeApp}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import{getFirestore,doc,getDoc,collection,getDocs}from"https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import{firebaseConfig}from"./firebase-config.js";
function safe(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
let allProducts=[],activeGender="all";
function productGender(p){return String(p.gender||"men").toLowerCase()}
function renderProductCatalogue(){
 const grid=document.querySelector(".product-grid");if(!grid)return;
 const visible=allProducts.filter(p=>activeGender==="all"||productGender(p)===activeGender||activeGender==="all"&&productGender(p)==="unisex");
 grid.innerHTML=visible.map(p=>{
  const gender=productGender(p),details=[p.fitOptions&&("Fit: "+p.fitOptions),p.colourOptions&&("Colours: "+p.colourOptions),p.fabricOptions&&("Fabrics: "+p.fabricOptions),p.designOptions&&("Details: "+p.designOptions)].filter(Boolean);
  return '<article class="product-card" data-gender="'+safe(gender)+'"><div class="product-image" role="img" aria-label="'+safe(p.name)+'" style="background-image:url(&quot;'+safe(p.imageUrl)+'&quot;);background-size:cover;background-position:center"></div><div class="product-meta"><h3>'+safe(p.name)+'</h3><span>'+safe(p.category||"MADE TO MEASURE")+'</span></div><p>'+safe(p.description||"Made with care by Bahadu Bespoke.")+'</p>'+details.map(x=>'<p class="product-detail">'+safe(x)+'</p>').join("")+'<p class="product-price">'+safe(p.price||"Enquire for price")+'</p><div class="product-actions"><a href="booking.html?service='+encodeURIComponent(p.name)+'" class="product-link">Enquire about this piece ↗</a><button type="button" class="save-piece" data-save-piece="'+safe(p.id)+'">♡ Save piece</button><a class="product-link" href="account.html?product='+encodeURIComponent(p.name)+'">Customise ↗</a></div></article>'
 }).join("")||'<div class="catalogue-empty"><p class="eyebrow">'+(activeGender==="women"?"WOMENSWEAR":"COLLECTION")+'</p><h3>'+(activeGender==="women"?"A wardrobe made around you.":"New pieces are being prepared.")+'</h3><p>'+(activeGender==="women"?"Our women’s bespoke collection is curated around your silhouette, preferred fit and occasion. Contact our team to begin a custom piece.":"Please explore another collection or contact our atelier for a custom commission.")+'</p><a class="product-link" href="booking.html?service='+encodeURIComponent(activeGender==="women"?"Women's bespoke consultation":"Bespoke consultation")+'">Arrange a consultation ↗</a></div>';
 const note=document.getElementById("women-edit-note");if(note)note.hidden=activeGender!=="women";
 document.querySelectorAll("[data-product-gender]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.productGender===activeGender)));
}
document.querySelectorAll("[data-product-gender]").forEach(b=>b.addEventListener("click",()=>{activeGender=b.dataset.productGender;renderProductCatalogue()}));
if(!Object.values(firebaseConfig).some(v=>String(v).startsWith("REPLACE_"))){
 try{
  const app=initializeApp(firebaseConfig),db=getFirestore(app),snap=await getDoc(doc(db,"siteContent","main"));
  if(snap.exists()){
   const c=snap.data(),set=(selector,value)=>{const el=document.querySelector(selector);if(el&&value)el.textContent=value};
   set(".hero .eyebrow",c.heroEyebrow);set(".hero h1",c.heroTitle);set(".hero .hero-copy",c.heroText);set(".intro-copy h2",c.introTitle);set(".intro-copy>p:not(.eyebrow)",c.introText);set(".story-content h2",c.storyTitle);set(".story-content>p:not(.eyebrow)",c.storyText);set(".collections .section-heading h2",c.collectionTitle);set(".collections .section-heading>p",c.collectionSide);set(".products .section-heading h2",c.productHeading);set(".products .section-heading>p",c.productIntro);
   if(c.heroImage)document.querySelector(".hero-image")?.style.setProperty("background-image","url("+JSON.stringify(c.heroImage)+")");
   if(c.storyImage)document.querySelector(".story-photo")?.style.setProperty("background-image","url("+JSON.stringify(c.storyImage)+")");
   ["collectionImage1","collectionImage2","collectionImage3"].forEach((k,i)=>{const el=document.querySelectorAll(".collection-image")[i];if(el&&c[k])el.style.backgroundImage="url("+JSON.stringify(c[k])+")"});
   ["journalImage1","journalImage2","journalImage3"].forEach((k,i)=>{const img=document.querySelectorAll(".portfolio-grid img")[i];if(img&&c[k])img.src=c[k]});
   if(c.pageTitle)document.title=c.pageTitle;
  }
  const products=await getDocs(collection(db,"products"));
  allProducts=products.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.published!==false).sort((a,b)=>(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0));
  renderProductCatalogue();
 }catch(e){console.warn("Bahadu CMS content could not be loaded:",e)}
}
