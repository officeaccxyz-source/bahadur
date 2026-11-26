const {initializeApp,applicationDefault}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const projectId=process.env.FIREBASE_PROJECT_ID;
const uid=process.argv[2];
if(!projectId||!uid){console.error("Usage: FIREBASE_PROJECT_ID=... node scripts/set-admin-claim.js FIREBASE_AUTH_UID");process.exit(1)}
initializeApp({credential:applicationDefault(),projectId});
(async()=>{const auth=getAuth();const user=await auth.getUser(uid);await auth.setCustomUserClaims(uid,{...(user.customClaims||{}),admin:true});console.log("Granted admin claim to UID:",uid)})().catch(e=>{console.error(e);process.exit(1)});
