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

// View tracking
let viewSession = null; // { docId, startedAtMs, viewer, target }

function mustConfig(name) {
  if (!window[name]) throw new Error(`Missing config: window.${name}`);
}

async function initFirebaseIfNeeded() {
  mustConfig("FIREBASE_CONFIG");

  if (!getApps().length) {
    app = initializeApp(window.FIREBASE_CONFIG);
  } else {
    app = getApps()[0];
  }

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

async function stopView() {
  viewSession = null;
}

async function recordFortune({ viewerKey, viewerLabel, amount, bankName, bankAccount }) {
  await initFirebaseIfNeeded();

  try {
    await addDoc(collection(db, "fortunes"), {
      ownerKey: window.OWNER_KEY || "",
      viewerKey: String(viewerKey || ""),
      viewerLabel: String(viewerLabel || ""),
      amount: Number(amount || 0),
      bankName: String(bankName || ""),
      bankAccount: String(bankAccount || ""),
      createdAt: serverTimestamp()
    });
    return true;
  } catch (e) {
    console.warn("Firestore recordFortune failed:", e);
    return false;
  }
}

async function getLatestViews(n = 200) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");

  const qy = query(
    collection(db, "views"),
    orderBy("startedAt", "desc"),
    limit(Math.min(500, n))
  );

  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getLatestWishes(n = 200) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");

  const qy = query(
    collection(db, "wishes"),
    orderBy("createdAt", "desc"),
    limit(Math.min(500, n))
  );

  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getLatestFortunes(n = 200) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");

  const qy = query(
    collection(db, "fortunes"),
    orderBy("createdAt", "desc"),
    limit(Math.min(500, n))
  );

  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Owner delete
async function deleteView(docId) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");
  if (!docId) throw new Error("Missing docId");
  await deleteDoc(doc(db, "views", String(docId)));
}

async function deleteWish(docId) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");
  if (!docId) throw new Error("Missing docId");
  await deleteDoc(doc(db, "wishes", String(docId)));
}

async function deleteFortune(docId) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");
  if (!docId) throw new Error("Missing docId");
  await deleteDoc(doc(db, "fortunes", String(docId)));
}

// EmailJS init compatible
function emailjsInitSafe(EJ, publicKey) {
  const pk = String(publicKey || "").trim();
  if (!pk) return;
  try { EJ.init({ publicKey: pk }); return; } catch (e) {}
  try { EJ.init(pk); return; } catch (e) {}
}

/**
 * sendWish:
 * - luôn lưu Firestore (wishes)
 * - CHỈ gửi EmailJS nếu sendEmail=true
 */
async function sendWish({
  viewerKey, viewerLabel,
  targetKey, targetLabel,
  message,
  fortuneAmount = 0,
  bankName = "",
  bankAccount = "",
  sendEmail = true
}) {
  await initFirebaseIfNeeded();

  let savedToFirestore = false;
  let emailed = false;

  // 1) Save to Firestore
  try {
    await addDoc(collection(db, "wishes"), {
      ownerKey: window.OWNER_KEY || "",
      viewerKey: String(viewerKey || ""),
      viewerLabel: String(viewerLabel || ""),
      targetKey: String(targetKey || ""),
      targetLabel: String(targetLabel || ""),
      message: String(message || ""),
      fortuneAmount: Number(fortuneAmount || 0),
      bankName: String(bankName || ""),
      bankAccount: String(bankAccount || ""),
      createdAt: serverTimestamp()
    });
    savedToFirestore = true;
  } catch (e) {
    console.warn("Firestore addDoc(wishes) failed:", e);
  }

  // 2) EmailJS only when sendEmail=true
  if (!sendEmail) {
    return { savedToFirestore, emailed: false };
  }

  try {
    const EJ =
      (window.emailjs && window.emailjs.default && typeof window.emailjs.default.send === "function")
        ? window.emailjs.default
        : window.emailjs;

    if (!EJ || typeof EJ.send !== "function") {
      console.warn("EmailJS script not loaded");
      return { savedToFirestore, emailed: false };
    }

    if (window.EMAILJS_PUBLIC_KEY) {
      emailjsInitSafe(EJ, window.EMAILJS_PUBLIC_KEY);
    }

    const serviceId = String(window.EMAILJS_SERVICE_ID || "service_s5ecpfq").trim();
    const templateId = String(window.EMAILJS_TEMPLATE_ID || "template_zpr88bw").trim();

    await EJ.send(serviceId, templateId, {
      from_name: viewerLabel || viewerKey || "Ẩn danh",
      from_key: viewerKey || "",
      card_target: targetLabel || targetKey || "",
      time: new Date().toLocaleString("vi-VN"),
      message: message || "",

      // ✅ dữ liệu nhận lộc
      fortune_amount: Number(fortuneAmount || 0),
      bank_name: String(bankName || ""),
      bank_account: String(bankAccount || ""),

      to_email: "phanthu27112002@gmail.com",
    });

    emailed = true;
  } catch (e) {
    console.warn("EmailJS send failed:", e);
    console.warn("status:", e?.status);
    console.warn("text:", e?.text);
  }

  return { savedToFirestore, emailed };
}

// ✅ IMPORTANT: merge để không bị mất function (fix sendWish is not a function)
window.AppServices = Object.assign(window.AppServices || {}, {
  initFirebaseIfNeeded,
  isOwnerAuthed,
  ownerGoogleLogin,
  ownerGoogleLogout,
  startView,
  stopView,
  getLatestViews,
  getLatestWishes,
  getLatestFortunes,
  recordFortune,
  deleteView,
  deleteWish,
  deleteFortune,
  sendWish
});
