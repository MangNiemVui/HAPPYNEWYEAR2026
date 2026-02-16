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

  // chỉ gắn listener 1 lần
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
  // Không update endedAt để tránh cần quyền update (tuỳ Firestore Rules)
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

/* =========================
   REPLAY: Owner cấp / user nhận
   ========================= */
async function grantReplay(viewerKey) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");

  const k = String(viewerKey || "").trim();
  if (!k) throw new Error("Missing viewerKey");

  // doc id = viewerKey để dễ lookup
  await setDoc(doc(db, "replays", k), {
    ownerKey: window.OWNER_KEY || "",
    viewerKey: k,
    allow: true,
    createdAt: serverTimestamp()
  }, { merge: true });
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

    // người chơi tự consume (xóa) - tùy rules có thể fail
    try { await deleteDoc(ref); } catch (e) { console.warn("consumeReplay deleteDoc failed:", e); }
    return true;
  } catch (e) {
    console.warn("consumeReplay failed:", e);
    return false;
  }
}

/* =========================
   OWNER DASHBOARD: load list
   ========================= */
async function getLatestViews(n = 200) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");

  const q = query(
    collection(db, "views"),
    orderBy("startedAt", "desc"),
    limit(Math.min(500, n))
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getLatestWishes(n = 200) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");

  const q = query(
    collection(db, "wishes"),
    orderBy("createdAt", "desc"),
    limit(Math.min(500, n))
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getLatestFortunes(n = 200) {
  await initFirebaseIfNeeded();
  if (!isOwnerAuthed()) throw new Error("Not owner authed");

  const q = query(
    collection(db, "fortunes"),
    orderBy("createdAt", "desc"),
    limit(Math.min(500, n))
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* =========================
   OWNER DELETE
   ========================= */
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

/* =========================
   EMAILJS helper
   ========================= */
function emailjsInitSafe(EJ, publicKey) {
  const pk = String(publicKey || "").trim();
  if (!pk) return;
  try { EJ.init({ publicKey: pk }); return; } catch (e) {}
  try { EJ.init(pk); return; } catch (e) {}
}

/* =========================
   SEND WISH: gửi mail kèm bank + stk + tiền
   ========================= */
async function sendWish({
  viewerKey,
  viewerLabel,
  targetKey,
  targetLabel,
  message,
  fortuneAmount,
  bankName,
  bankAccount
}) {
  await initFirebaseIfNeeded();

  let savedToFirestore = false;
  let emailed = false;

  const vKey = String(viewerKey || "");
  const vLabel = String(viewerLabel || "");
  const tKey = String(targetKey || "");
  const tLabel = String(targetLabel || "");
  const msg = String(message || "");

  const amountNum = Number(fortuneAmount || 0);
  const bName = String(bankName || "");
  const bAcc = String(bankAccount || "");

  // ✅ gộp thông tin để email/template nào cũng hiện
  const extra = [
    `--- THÔNG TIN NHẬN LỘC ---`,
    `Người chơi: ${vLabel || vKey || ""} (${vKey || ""})`,
    `Trúng: ${amountNum.toLocaleString("vi-VN")}đ`,
    `Ngân hàng: ${bName}`,
    `STK: ${bAcc}`,
    `Người được chúc: ${tLabel || tKey || ""}`,
  ].join("\n");

  const mergedMessage = `${msg}\n\n${extra}`;

  // 1) Save to Firestore (lưu luôn bank + tiền để owner xem lại)
  try {
    await addDoc(collection(db, "wishes"), {
      ownerKey: window.OWNER_KEY || "",
      viewerKey: vKey,
      viewerLabel: vLabel,
      targetKey: tKey,
      targetLabel: tLabel,
      message: msg,

      // ✅ new fields
      fortuneAmount: amountNum,
      bankName: bName,
      bankAccount: bAcc,

      createdAt: serverTimestamp()
    });
    savedToFirestore = true;
  } catch (e) {
    console.warn("Firestore addDoc failed => still try EmailJS:", e);
  }

  // 2) Send EmailJS
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
      from_name: vLabel || vKey || "Ẩn danh",
      from_key: vKey,
      card_target: tLabel || tKey,
      time: new Date().toLocaleString("vi-VN"),

      // ✅ quan trọng: message đã gộp đủ info
      message: mergedMessage,

      // ✅ nếu template bạn có field thì vẫn dùng được
      fortune_amount: amountNum,
      bank_name: bName,
      bank_account: bAcc,

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

// expose to window
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
  recordFortune,
  grantReplay,
  consumeReplay,
  deleteView,
  deleteWish,
  deleteFortune,
  sendWish
};
