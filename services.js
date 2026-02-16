// services.js (ESM module)
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let app = null;
let auth = null;
let db = null;
let ownerUser = null;

function mustConfig(name) {
  if (!window[name]) throw new Error(`Missing config: window.${name}`);
}

async function initFirebaseIfNeeded() {
  mustConfig("FIREBASE_CONFIG");

  if (!getApps().length) app = initializeApp(window.FIREBASE_CONFIG);
  else app = getApps()[0];

  auth = getAuth(app);
  db = getFirestore(app);

  if (!initFirebaseIfNeeded._subscribed) {
    initFirebaseIfNeeded._subscribed = true;
    onAuthStateChanged(auth, (u) => { ownerUser = u || null; });
  }
}

function isOwnerAuthed() {
  if (!ownerUser) return false;
  return String(ownerUser.uid || "") === String(window.OWNER_UID || "");
}

async function ownerGoogleLogin() {
  await initFirebaseIfNeeded();
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  ownerUser = cred.user;
  return { uid: ownerUser.uid, email: ownerUser.email || "" };
}

async function ownerGoogleLogout() {
  await initFirebaseIfNeeded();
  await signOut(auth);
  ownerUser = null;
}

// ===== Views (optional) =====
let viewSession = null;
async function startView(viewer, target) {
  await initFirebaseIfNeeded();
  const payload = {
    ownerKey: window.OWNER_KEY || "",
    viewerKey: viewer?.key || "",
    viewerLabel: viewer?.label || "",
    targetKey: target?.key || "",
    targetLabel: target?.label || "",
    startedAt: serverTimestamp(),
    endedAt: null,
    durationSec: 0,
    userAgent: navigator.userAgent || ""
  };
  const ref = await addDoc(collection(db, "views"), payload);
  viewSession = { docId: ref.id, startedAtMs: Date.now(), viewer, target };
}
async function stopView() { viewSession = null; }

// ===== Fortunes =====
async function recordFortune({ viewerKey, viewerLabel, amount, bankName, bankAccount, targetKey, targetLabel, wishMessage }) {
  await initFirebaseIfNeeded();
  try {
    await addDoc(collection(db, "fortunes"), {
      ownerKey: window.OWNER_KEY || "",
      viewerKey: String(viewerKey || ""),
      viewerLabel: String(viewerLabel || ""),
      targetKey: String(targetKey || ""),
      targetLabel: String(targetLabel || ""),
      amount: Number(amount || 0),
      bankName: String(bankName || ""),
      bankAccount: String(bankAccount || ""),
      wishMessage: String(wishMessage || ""),
      createdAt: serverTimestamp()
    });
    return true;
  } catch (e) {
    console.warn("Firestore recordFortune failed:", e);
    return false;
  }
}

// ===== Replay =====
async function grantReplay(viewerKey) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");
  const k = String(viewerKey || "").trim();
  if (!k) throw new Error("Missing viewerKey");

  await setDoc(doc(db, "replays", k), {
    ownerKey: window.OWNER_KEY || "",
    viewerKey: k,
    allow: true,
    createdAt: serverTimestamp()
  });
}

async function consumeReplay(viewerKey) {
  await initFirebaseIfNeeded();
  const k = String(viewerKey || "").trim();
  if (!k) return false;

  try {
    const ref = doc(db, "replays", k);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() || {};
    if (!data.allow) return false;

    try { await deleteDoc(ref); } catch (e) { console.warn("consumeReplay deleteDoc failed:", e); }
    return true;
  } catch (e) {
    console.warn("consumeReplay failed:", e);
    return false;
  }
}

// ===== Owner dashboard fetch =====
async function getLatestViews(n = 200) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");
  const q = query(collection(db, "views"), orderBy("startedAt", "desc"), limit(Math.min(500, n)));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getLatestWishes(n = 200) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");
  const q = query(collection(db, "wishes"), orderBy("createdAt", "desc"), limit(Math.min(500, n)));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getLatestFortunes(n = 200) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");
  const q = query(collection(db, "fortunes"), orderBy("createdAt", "desc"), limit(Math.min(500, n)));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function deleteView(docId) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");
  await deleteDoc(doc(db, "views", String(docId)));
}
async function deleteWish(docId) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");
  await deleteDoc(doc(db, "wishes", String(docId)));
}
async function deleteFortune(docId) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");
  await deleteDoc(doc(db, "fortunes", String(docId)));
}

// ===== EmailJS helper =====
function emailjsInitSafe(EJ, publicKey) {
  const pk = String(publicKey || "").trim();
  if (!pk) return;
  try { EJ.init({ publicKey: pk }); return; } catch {}
  try { EJ.init(pk); return; } catch {}
}

function getEmailJS() {
  const EJ =
    (window.emailjs && window.emailjs.default && typeof window.emailjs.default.send === "function")
      ? window.emailjs.default
      : window.emailjs;

  if (!EJ || typeof EJ.send !== "function") return null;
  if (window.EMAILJS_PUBLIC_KEY) emailjsInitSafe(EJ, window.EMAILJS_PUBLIC_KEY);
  return EJ;
}

// ✅ 1) CHỈ LƯU LỜI CHÚC (KHÔNG GỬI GMAIL)
async function saveWishOnly({ viewerKey, viewerLabel, targetKey, targetLabel, message }) {
  await initFirebaseIfNeeded();
  try {
    await addDoc(collection(db, "wishes"), {
      ownerKey: window.OWNER_KEY || "",
      viewerKey: String(viewerKey || ""),
      viewerLabel: String(viewerLabel || ""),
      targetKey: String(targetKey || ""),
      targetLabel: String(targetLabel || ""),
      message: String(message || ""),
      createdAt: serverTimestamp()
    });
    return { savedToFirestore: true };
  } catch (e) {
    console.warn("saveWishOnly failed:", e);
    return { savedToFirestore: false };
  }
}

// ✅ 2) GỬI GMAIL “FINAL” SAU KHI XÁC NHẬN NHẬN LỘC
async function sendFinalEmail({
  viewerKey, viewerLabel,
  targetKey, targetLabel,
  message,
  fortuneAmount, bankName, bankAccount
}) {
  await initFirebaseIfNeeded();

  const EJ = getEmailJS();
  if (!EJ) {
    console.warn("EmailJS script not loaded");
    return { emailed: false };
  }

  const serviceId = String(window.EMAILJS_SERVICE_ID || "").trim() || "service_s5ecpfq";
  const templateId = String(window.EMAILJS_TEMPLATE_ID || "").trim() || "template_zpr88bw";

  try {
    await EJ.send(serviceId, templateId, {
      // info chung
      time: new Date().toLocaleString("vi-VN"),
      to_email: String(window.OWNER_EMAIL || "phanthu27112002@gmail.com"),

      // người gửi + người được chúc
      from_name: viewerLabel || viewerKey || "Ẩn danh",
      from_key: viewerKey || "",
      card_target: targetLabel || targetKey || "",

      // lời chúc
      message: String(message || ""),

      // nhận lộc
      fortune_amount: String(fortuneAmount || 0),
      bank_name: String(bankName || ""),
      bank_account: String(bankAccount || "")
    });

    return { emailed: true };
  } catch (e) {
    console.warn("sendFinalEmail failed:", e, e?.status, e?.text);
    return { emailed: false };
  }
}

window.AppServices = {
  initFirebaseIfNeeded,
  isOwnerAuthed,
  ownerGoogleLogin,
  ownerGoogleLogout,

  startView,
  stopView,

  getLatestViews,
  getLatestWishes,
  getLatestFortunes,
  deleteView,
  deleteWish,
  deleteFortune,

  recordFortune,
  grantReplay,
  consumeReplay,

  // ✅ new
  saveWishOnly,
  sendFinalEmail
};
