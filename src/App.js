import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
//  FIREBASE CONFIG
//  👉 Replace these values with your own from Firebase Console:
//     console.firebase.google.com → Project Settings → Your apps → SDK setup
// ─────────────────────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL:       "https://REPLACE_WITH_YOUR_PROJECT_ID-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     "REPLACE_WITH_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID",
};

// ── Check if Firebase is properly configured ──────────────────────────────────
const FIREBASE_CONFIGURED = !FIREBASE_CONFIG.apiKey.includes("REPLACE_WITH");

// ── Firebase SDK loader ───────────────────────────────────────────────────────
let _db = null;
let _firebaseReady = false;

async function initFirebase() {
  if (!FIREBASE_CONFIGURED) return null;
  if (_firebaseReady) return _db;
  return new Promise((resolve) => {
    const s1 = document.createElement("script");
    s1.src = "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js";
      s2.onload = () => {
        try {
          if (!window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
          _db = window.firebase.database();
          _firebaseReady = true;
          resolve(_db);
        } catch (e) { console.error("Firebase init failed:", e); resolve(null); }
      };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  });
}

// ── localStorage helpers (fallback when Firebase not configured) ──────────────
const LS_KEY = "qr_it_tickets_v2";
function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function lsSave(tickets) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(tickets)); } catch {}
}

// ── Unified ticket store ──────────────────────────────────────────────────────
// Works in two modes:
//   FIREBASE mode  → real-time across all devices (needs config above)
//   LOCAL mode     → localStorage, persists across refresh, works on same device
const ticketStore = {
  tickets: [],
  listeners: [],
  _fbRef: null,

  notify() {
    this.listeners.forEach((fn) => fn([...this.tickets]));
  },

  async load() {
    if (FIREBASE_CONFIGURED) {
      // ── Firebase mode ──
      const db = await initFirebase();
      if (!db) return;
      if (this._fbRef) return; // already listening
      this._fbRef = db.ref("tickets");
      this._fbRef.on("value", (snap) => {
        const data = snap.val();
        this.tickets = data
          ? Object.values(data).sort((a, b) => (b._createdAt || 0) - (a._createdAt || 0))
          : [];
        this.notify();
      });
    } else {
      // ── Local mode — load from localStorage then notify ──
      this.tickets = lsLoad();
      this.notify();
    }
  },

  async add(ticket) {
    if (FIREBASE_CONFIGURED) {
      const db = await initFirebase();
      if (db) {
        await db.ref("tickets/" + ticket.id).set({ ...ticket, _createdAt: Date.now() });
        return; // Firebase listener fires notify automatically
      }
    }
    // Local fallback
    this.tickets = [ticket, ...this.tickets];
    lsSave(this.tickets);
    this.notify();
  },

  async updateStatus(id, status) {
    if (FIREBASE_CONFIGURED) {
      const db = await initFirebase();
      if (db) { await db.ref("tickets/" + id + "/status").set(status); return; }
    }
    this.tickets = this.tickets.map((t) => t.id === id ? { ...t, status } : t);
    lsSave(this.tickets);
    this.notify();
  },

  async assignTechnician(id, name) {
    if (FIREBASE_CONFIGURED) {
      const db = await initFirebase();
      if (db) { await db.ref("tickets/" + id + "/assignedTo").set(name || null); return; }
    }
    this.tickets = this.tickets.map((t) => t.id === id ? { ...t, assignedTo: name } : t);
    lsSave(this.tickets);
    this.notify();
  },

  subscribe(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  },
};

const CATEGORIES = [
  { icon: "💻", label: "Hardware Issue" },
  { icon: "🌐", label: "Network / VPN" },
  { icon: "🔐", label: "Password / Access" },
  { icon: "🖨️", label: "Printer / Peripherals" },
  { icon: "📧", label: "Email / Outlook" },
  { icon: "⚙️", label: "Software / Apps" },
  { icon: "📱", label: "Mobile Device" },
  { icon: "🖥️", label: "Desktop / OS" },
];

function generateTicketId() {
  return "INC" + (Math.floor(Math.random() * 90000) + 10000);
}
function now() {
  return new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}
function nowDate() {
  return new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
}

// ─────────────────────────────────────────────────────────────────────────────
//  RAIL SVG BACKGROUND — animated track lines
// ─────────────────────────────────────────────────────────────────────────────
function RailBackground() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      {/* Deep dark base */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #0a0a0f 0%, #0d1117 40%, #0a0f14 70%, #0d0a0a 100%)" }} />

      {/* Rail track SVG - perspective lines */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18 }} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        {/* Converging rail lines from bottom center */}
        <defs>
          <linearGradient id="railGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#C8102E" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#C8102E" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#C8102E" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tieGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#888" stopOpacity="0" />
            <stop offset="30%" stopColor="#888" stopOpacity="0.6" />
            <stop offset="70%" stopColor="#888" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#888" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Left rail */}
        <path d="M 720 900 L 580 600 L 320 0" stroke="url(#railGrad)" strokeWidth="3" fill="none" filter="url(#glow)" />
        {/* Right rail */}
        <path d="M 720 900 L 860 600 L 1120 0" stroke="url(#railGrad)" strokeWidth="3" fill="none" filter="url(#glow)" />

        {/* Rail sleepers / ties */}
        {[900, 830, 760, 700, 645, 595, 548, 504, 463, 425, 390, 356, 325, 296, 269, 244, 221, 200, 180, 162, 145, 130, 116, 103, 91, 80, 70, 61, 53, 46].map((y, i) => {
          const progress = 1 - (y / 900);
          const leftX = 720 - (140 * (1 - progress)) - (260 * progress);
          const rightX = 720 + (140 * (1 - progress)) + (260 * progress);
          const opacity = Math.max(0, 0.7 - progress * 0.65);
          return (
            <line key={i} x1={leftX} y1={y} x2={rightX} y2={y}
              stroke="url(#tieGrad)" strokeWidth={Math.max(1, 3 - progress * 2.5)}
              opacity={opacity} />
          );
        })}

        {/* Speed lines on sides */}
        {[-200, -100, 0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1440, 1540].map((x, i) => (
          <line key={`s${i}`} x1={x} y1={0} x2={x + 60} y2={900}
            stroke="#C8102E" strokeWidth="0.5" opacity="0.06" />
        ))}
      </svg>

      {/* Animated moving light sweep */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 60% 40% at 50% 110%, rgba(200,16,46,0.12) 0%, transparent 70%)",
        animation: "breathe 4s ease-in-out infinite",
      }} />

      {/* Red accent glow bottom */}
      <div style={{
        position: "absolute", bottom: -100, left: "50%", transform: "translateX(-50%)",
        width: 600, height: 300,
        background: "radial-gradient(ellipse, rgba(200,16,46,0.15) 0%, transparent 70%)",
        filter: "blur(40px)",
      }} />

      {/* Subtle grain texture overlay */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        opacity: 0.4,
      }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  KIOSK SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function KioskScreen({ goHome }) {
  const [step, setStep] = useState("welcome");
  const [flow, setFlow] = useState("none"); // "none" | "existing" | "new"
  const [form, setForm] = useState({ name: "", email: "", serviceNumber: "", category: "", issue: "", assetTag: "", ticketId: "" });
  const [createdTicket, setCreatedTicket] = useState(null);
  const [clock, setClock] = useState(now());
  const [date, setDate] = useState(nowDate());


  useEffect(() => {
    ticketStore.load();
    const t = setInterval(() => { setClock(now()); setDate(nowDate()); }, 30000);
    return () => clearInterval(t);
  }, []); // kiosk doesn't need to listen — it only writes tickets

  const reset = () => {
    setStep("welcome");
    setFlow("none");
    setForm({ name: "", email: "", serviceNumber: "", category: "", issue: "", assetTag: "", ticketId: "" });
    setCreatedTicket(null);
  };

  const handleLookup = () => {
    if (!form.ticketId.trim()) return;
    setFlow("existing");
    setStep("existing-name");
  };

  const handleExistingCheckIn = async () => {
    const ticket = {
      id: form.ticketId.trim().toUpperCase(),
      name: form.name.trim() || "Walk-in",
      email: "",
      serviceNumber: "", // existing tickets don't capture service number
      category: "Existing Incident",
      issue: "Customer checked in with existing ticket",
      assetTag: null,
      status: "In Progress",
      assignedTo: null,
      time: now(),
      priority: "Medium",
      checkedIn: true,
      arrivalTime: now(),
      isExisting: true,
    };
    await ticketStore.add(ticket);
    setCreatedTicket(ticket);
    setStep("done");
  };

  const handleNewTicket = async () => {
    const ticket = {
      id: generateTicketId(),
      name: form.name.trim(),
      email: form.email.trim(),
      serviceNumber: form.serviceNumber.trim(),
      category: form.category,
      issue: form.issue.trim(),
      assetTag: form.assetTag.trim() || null,
      status: "Open",
      assignedTo: null,
      time: now(),
      priority: "Medium",
      checkedIn: true,
      arrivalTime: now(),
    };
    await ticketStore.add(ticket);
    setCreatedTicket(ticket);
    setStep("done");
  };

  const isExistingFlow = flow === "existing";
  const stepNum = { "existing-name": 1, "new-name": 1, "new-category": 2, "new-issue": 3, "new-asset": 4 }[step];
  const totalStepCount = isExistingFlow ? 2 : 4;

  return (
    <div className="kiosk-root">
      <RailBackground />

      {/* Header */}
      <div className="kiosk-header">
        <button className="kiosk-brand-btn" onClick={() => goHome && goHome()}>
          <span className="brand-dot" />
          <span className="brand-qr">Queensland Rail</span>
          <span className="brand-sep">·</span>
          <span className="brand-it">IT Support</span>
        </button>
        <div className="kiosk-clock-wrap">
          <div className="kiosk-clock">{clock}</div>
          <div className="kiosk-date">{date}</div>
        </div>
      </div>

      {/* Progress bar for new ticket flow */}
      {stepNum && (
        <div className="progress-bar-wrap">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${(stepNum / totalStepCount) * 100}%` }} />
          </div>
          <span className="progress-label">Step {stepNum} of {totalStepCount}</span>
        </div>
      )}

      {/* Card */}
      <div className="kiosk-card-wrap">
        <div className="kiosk-card">

          {step === "welcome" && (
            <SlideIn key="welcome">
              <div className="welcome-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="19" stroke="#C8102E" strokeWidth="1.5" opacity="0.4"/>
                  <circle cx="20" cy="20" r="13" stroke="#C8102E" strokeWidth="1.5" opacity="0.6"/>
                  <circle cx="20" cy="20" r="6" fill="#C8102E"/>
                </svg>
              </div>
              <p className="eyebrow">WELCOME</p>
              <h1 className="card-title">IT Support<br />Check-In</h1>
              <p className="card-sub">Our team is ready to help. Check in below and you'll be seen as soon as possible.</p>
              <div className="btn-group">
                <KioskBtn primary onClick={() => setStep("ask-existing")}>
                  <span>Check In Now</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </KioskBtn>
              </div>
            </SlideIn>
          )}

          {step === "ask-existing" && (
            <SlideIn key="ask">
              <p className="eyebrow">GET STARTED</p>
              <h2 className="card-title">Do you have an existing ticket?</h2>
              <p className="card-sub">Already raised a ticket with IT? Enter your incident number. Otherwise we'll create one for you.</p>
              <div className="btn-group">
                <KioskBtn primary onClick={() => setStep("lookup")}>Yes — I have a ticket number</KioskBtn>
                <KioskBtn onClick={() => { setFlow("new"); setStep("new-name"); }}>No — Create a new ticket</KioskBtn>
                <KioskBtn ghost onClick={reset}>← Back</KioskBtn>
              </div>
            </SlideIn>
          )}

          {step === "lookup" && (
            <SlideIn key="lookup">
              <p className="eyebrow">EXISTING TICKET · STEP 1 OF 2</p>
              <h2 className="card-title">Enter your incident number</h2>
              <p className="card-sub">Enter your ServiceNow incident number, e.g. <span className="highlight-text">INC0041872</span></p>
              <div className="fancy-input-wrap">
                <span className="input-icon">🎫</span>
                <input
                  className="fancy-input mono"
                  placeholder="INC0000000"
                  value={form.ticketId}
                  onChange={(e) => setForm({ ...form, ticketId: e.target.value.toUpperCase() })}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  autoFocus
                />
              </div>
              <div className="btn-group">
                <KioskBtn primary disabled={!form.ticketId.trim()} onClick={handleLookup}>Continue →</KioskBtn>
                <KioskBtn ghost onClick={() => setStep("ask-existing")}>← Back</KioskBtn>
              </div>
            </SlideIn>
          )}

          {step === "existing-name" && (
            <SlideIn key="existing-name">
              <p className="eyebrow">EXISTING TICKET · STEP 2 OF 2</p>
              <h2 className="card-title">Your details</h2>
              <p className="card-sub">So our team knows who has arrived.</p>
              <div className="fancy-input-wrap">
                <span className="input-icon">👤</span>
                <input className="fancy-input" placeholder="Full name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div className="fancy-input-wrap" style={{ marginTop: 10 }}>
                <span className="input-icon">🪪</span>
                <input className="fancy-input mono" placeholder="Service number (e.g. 12345678)" value={form.serviceNumber}
                  onChange={(e) => setForm({ ...form, serviceNumber: e.target.value })} />
              </div>
              <div className="btn-group">
                <KioskBtn primary disabled={!form.name.trim()} onClick={() => setStep("confirm")}>Continue →</KioskBtn>
                <KioskBtn ghost onClick={() => setStep("lookup")}>← Back</KioskBtn>
              </div>
            </SlideIn>
          )}

          {step === "new-name" && (
            <SlideIn key="name">
              <p className="eyebrow">NEW TICKET · STEP 1 OF 4</p>
              <h2 className="card-title">Your details</h2>
              <div className="fancy-input-wrap">
                <span className="input-icon">👤</span>
                <input className="fancy-input" placeholder="Full name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div className="fancy-input-wrap" style={{ marginTop: 10 }}>
                <span className="input-icon">📧</span>
                <input className="fancy-input" placeholder="Work email (optional)" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="fancy-input-wrap" style={{ marginTop: 10 }}>
                <span className="input-icon">🪪</span>
                <input className="fancy-input mono" placeholder="Service number (e.g. 12345678)" value={form.serviceNumber}
                  onChange={(e) => setForm({ ...form, serviceNumber: e.target.value })} />
              </div>
              <div className="btn-group">
                <KioskBtn primary disabled={!form.name.trim()} onClick={() => setStep("new-category")}>
                  Continue <span>→</span>
                </KioskBtn>
                <KioskBtn ghost onClick={() => setStep("ask-existing")}>← Back</KioskBtn>
              </div>
            </SlideIn>
          )}

          {step === "new-category" && (
            <SlideIn key="cat">
              <p className="eyebrow">NEW TICKET · STEP 2 OF 4</p>
              <h2 className="card-title">What type of issue?</h2>
              <div className="cat-grid">
                {CATEGORIES.map((c) => (
                  <button key={c.label} className={`cat-btn${form.category === c.label ? " cat-btn-active" : ""}`}
                    onClick={() => setForm({ ...form, category: c.label })}>
                    <span className="cat-icon">{c.icon}</span>
                    <span className="cat-label">{c.label}</span>
                  </button>
                ))}
              </div>
              <div className="btn-group">
                <KioskBtn primary disabled={!form.category} onClick={() => setStep("new-issue")}>Continue →</KioskBtn>
                <KioskBtn ghost onClick={() => setStep("new-name")}>← Back</KioskBtn>
              </div>
            </SlideIn>
          )}

          {step === "new-issue" && (
            <SlideIn key="issue">
              <p className="eyebrow">NEW TICKET · STEP 3 OF 4</p>
              <h2 className="card-title">Describe your issue</h2>
              <p className="card-sub">Be specific so our team can prepare before you sit down.</p>
              <textarea className="fancy-textarea" rows={4} autoFocus
                placeholder="e.g. My laptop won't connect to the office Wi-Fi since yesterday..."
                value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} />
              <div className="char-count">{form.issue.length} characters</div>
              <div className="btn-group">
                <KioskBtn primary disabled={form.issue.trim().length < 5} onClick={() => setStep("new-asset")}>Continue →</KioskBtn>
                <KioskBtn ghost onClick={() => setStep("new-category")}>← Back</KioskBtn>
              </div>
            </SlideIn>
          )}

          {step === "new-asset" && (
            <SlideIn key="asset">
              <p className="eyebrow">NEW TICKET · STEP 4 OF 4</p>
              <h2 className="card-title">Asset tag?</h2>
              <p className="card-sub">The sticker on your device — usually starts with <span className="highlight-text">SL</span> followed by 8 characters.</p>
              <div className="asset-hint-box">
                <span>💡</span>
                <span>Check the bottom of your laptop or back of your monitor. It usually starts with <strong>SL</strong> e.g. <span style={{fontFamily:"'JetBrains Mono',monospace",color:"#ff4d6d"}}>SLABCD1234</span></span>
              </div>
              <div className="fancy-input-wrap">
                <span className="input-icon">🏷</span>
                <input className="fancy-input mono" placeholder="e.g. SLABCD1234"
                  value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value.toUpperCase() })} autoFocus />
              </div>
              <div className="btn-group">
                <KioskBtn primary onClick={() => setStep("confirm")}>Continue →</KioskBtn>
                <KioskBtn ghost onClick={() => setStep("new-issue")}>← Back</KioskBtn>
                <button className="skip-btn" onClick={() => { setForm({ ...form, assetTag: "" }); setStep("confirm"); }}>
                  Skip — I don't know my asset tag
                </button>
              </div>
            </SlideIn>
          )}

          {step === "confirm" && (
            <SlideIn key="confirm">
              <p className="eyebrow">CONFIRM CHECK-IN</p>
              <h2 className="card-title">{isExistingFlow ? "Almost done!" : "Review your details"}</h2>
              <div className="review-card">
                {isExistingFlow ? (
                  <>
                    <ReviewRow label="Incident Number" value={form.ticketId.trim().toUpperCase()} highlight />
                    <ReviewRow label="Name" value={form.name || "—"} />
                    {form.serviceNumber && <ReviewRow label="Service Number" value={form.serviceNumber} highlight />}
                    <div className="review-note">Your incident has been located in ServiceNow. Confirming will notify the IT team that you have arrived.</div>
                  </>
                ) : (
                  <>
                    <ReviewRow label="Name" value={form.name} />
                    {form.serviceNumber && <ReviewRow label="Service Number" value={form.serviceNumber} />}
                    {form.email && <ReviewRow label="Email" value={form.email} />}
                    <ReviewRow label="Category" value={form.category} />
                    <ReviewRow label="Issue" value={form.issue.slice(0, 80) + (form.issue.length > 80 ? "…" : "")} />
                    {form.assetTag
                      ? <ReviewRow label="Asset Tag" value={form.assetTag} highlight />
                      : <ReviewRow label="Asset Tag" value="Not provided" dim />}
                  </>
                )}
              </div>
              <div className="btn-group">
                <KioskBtn primary onClick={() => isExistingFlow ? handleExistingCheckIn() : handleNewTicket()}>
                  ✓ Confirm Check-In
                </KioskBtn>
                <KioskBtn ghost onClick={() => setStep(isExistingFlow ? "existing-name" : "new-asset")}>← Edit</KioskBtn>
              </div>
            </SlideIn>
          )}

          {step === "done" && createdTicket && (
            <SlideIn key="done">
              <div className="success-ring">
                <div className="success-icon">✓</div>
              </div>
              <h2 className="card-title" style={{ textAlign: "center" }}>You're checked in!</h2>
              <div className="ticket-badge">
                <div className="ticket-badge-label">YOUR TICKET NUMBER</div>
                <div className="ticket-badge-id">{createdTicket.id}</div>
                <div className="ticket-badge-time">Checked in at {createdTicket.arrivalTime}</div>
              </div>
              <p className="card-sub" style={{ textAlign: "center" }}>
                {createdTicket.isExisting
                  ? "A technician has been notified. Please take a seat."
                  : <>A technician will call <strong style={{ color: "#f1f5f9" }}>{createdTicket.name}</strong> shortly. Please take a seat.</>}
              </p>
              <div className="btn-group">
                <KioskBtn primary onClick={reset}>New Check-In</KioskBtn>
              </div>
            </SlideIn>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="kiosk-footer">
        <span className="footer-brand">Queensland Rail</span>
        <span className="footer-sep">·</span>
        <span className="footer-sub">IT Support Kiosk · Powered by ServiceNow</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  DASHBOARD SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function DashboardScreen({ goHome }) {
  const [tickets, setTickets] = useState([...ticketStore.tickets]);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [clock, setClock] = useState(now());
  const [newTicketId, setNewTicketId] = useState(null);
  const prevLen = useRef(tickets.length);

  useEffect(() => {
    // Subscribe FIRST so we catch the notify() call inside load()
    const unsub = ticketStore.subscribe((t) => {
      setTickets([...t]);
      // Keep detail panel in sync when ticket is updated from another device
      setSelected((prev) => {
        if (!prev) return prev;
        const updated = t.find((x) => x.id === prev.id);
        return updated ? { ...updated } : prev;
      });
    });
    ticketStore.load(); // triggers notify() which calls our subscriber above
    const t = setInterval(() => setClock(now()), 30000);
    return () => { unsub(); clearInterval(t); };
  }, []);

  useEffect(() => {
    if (tickets.length > prevLen.current) {
      setNewTicketId(tickets[0]?.id);
      setTimeout(() => setNewTicketId(null), 3000);
      prevLen.current = tickets.length;
    }
  }, [tickets]);

  const statuses = ["All", "Open", "In Progress", "Resolved"];
  const shown = filter === "All" ? tickets : tickets.filter((t) => t.status === filter);
  const checkedInCount = tickets.filter((t) => t.checkedIn).length;
  const openCount = tickets.filter((t) => t.status === "Open").length;
  const inProgressCount = tickets.filter((t) => t.status === "In Progress").length;

  const updateStatus = async (id, status) => {
    await ticketStore.updateStatus(id, status);
    if (selected?.id === id) setSelected((s) => ({ ...s, status }));
  };

  const assignToMe = async (id, name) => {
    await ticketStore.assignTechnician(id, name);
    if (selected?.id === id) setSelected((s) => ({ ...s, assignedTo: name }));
  };

  return (
    <div className="dash-root">
      <RailBackground />

      {/* Sidebar */}
      <div className="dash-sidebar">
        <div className="dash-sidebar-inner">
          <div className="dash-brand-wrap">
            <button className="dash-brand-btn" onClick={() => goHome && goHome()} title="← Home">
              <span className="dash-brand-dot" />
              <div>
                <div className="dash-brand-name">Queensland Rail</div>
                <div className="dash-brand-sub">IT Support</div>
              </div>
            </button>
          </div>

          <div className="dash-live-badge">
            <span className="live-pulse" />
            <span>LIVE DASHBOARD</span>
          </div>

          <div className="dash-clock">{clock}</div>
          <div className="dash-date">{nowDate()}</div>

          <div className="stat-grid">
            <StatCard label="Checked In" value={checkedInCount} color="#22d3ee" icon="👥" />
            <StatCard label="Open" value={openCount} color="#f59e0b" icon="📋" />
            <StatCard label="In Progress" value={inProgressCount} color="#a78bfa" icon="⚡" />
            <StatCard label="Total Today" value={tickets.length} color="#34d399" icon="📊" />
          </div>

          <div className="filter-section-label">FILTER STATUS</div>
          <div className="filter-btns">
            {statuses.map((s) => {
              const count = s === "All" ? tickets.length : tickets.filter((t) => t.status === s).length;
              return (
                <button key={s} className={`filter-btn${filter === s ? " filter-btn-active" : ""}`}
                  onClick={() => setFilter(s)}>
                  <span>{s}</span>
                  <span className="filter-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="dash-main">
        <div className="dash-main-header">
          <div>
            <h1 className="dash-main-title">Live Queue</h1>
            <p className="dash-main-sub">Real-time · Firebase · Updates instantly across all devices</p>
          </div>
          <div className="dash-header-right">
            {newTicketId && (
              <div className="new-ticket-toast">
                🔔 New check-in: {newTicketId}
              </div>
            )}
            <FirebaseStatusBadge />
          </div>
        </div>

        <div className="ticket-list">
          {shown.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🎫</div>
              <div className="empty-text">No tickets yet</div>
              <div className="empty-sub">Check-ins will appear here in real time</div>
            </div>
          )}
          {shown.map((t, i) => (
            <DashTicketRow key={t.id} ticket={t} selected={selected?.id === t.id}
              isNew={t.id === newTicketId} index={i}
              onClick={() => setSelected(t.id === selected?.id ? null : t)} />
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="dash-detail">
          <button className="detail-close" onClick={() => setSelected(null)}>✕</button>
          <div className="detail-header">
            <div className="detail-id">{selected.id}</div>
            <StatusPill status={selected.status} />
          </div>
          <div className="detail-name">{selected.name}</div>
          {selected.serviceNumber && <div className="detail-service-num">🪪 {selected.serviceNumber}</div>}
          {selected.email && <div className="detail-email">{selected.email}</div>}
          {selected.checkedIn && <div className="detail-present">✓ Present · {selected.arrivalTime || selected.time}</div>}

          <div className="detail-divider" />

          <DetailRow label="Category" value={selected.category} />
          <DetailRow label="Issue" value={selected.issue} />
          {selected.assetTag && <DetailRow label="Asset Tag" value={selected.assetTag} mono />}
          <DetailRow label="Priority" value={selected.priority} />
          {selected.isExisting && <DetailRow label="Type" value="Existing Incident 🔗" />}

          <div className="detail-divider" />

          {/* Technician Assignment */}
          <div className="detail-status-label">ASSIGNED TO</div>
          {selected.assignedTo ? (
            <div className="assigned-badge">
              <span className="assigned-avatar">{selected.assignedTo.charAt(0).toUpperCase()}</span>
              <div>
                <div className="assigned-name">{selected.assignedTo}</div>
                <button className="assigned-change" onClick={() => assignToMe(selected.id, null)}>Remove assignment</button>
              </div>
            </div>
          ) : (
            <AssignPanel ticketId={selected.id} onAssign={(name) => assignToMe(selected.id, name)} />
          )}

          <div className="detail-divider" />
          <div className="detail-status-label">UPDATE STATUS</div>
          <div className="detail-status-btns">
            {["Open", "In Progress", "Resolved"].map((s) => (
              <button key={s} className={`detail-status-btn${selected.status === s ? " active" : ""}`}
                onClick={() => updateStatus(selected.id, s)}>
                {s === "Open" ? "📋" : s === "In Progress" ? "⚡" : "✅"} {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function SlideIn({ children }) {
  return <div className="slide-in">{children}</div>;
}

function KioskBtn({ children, primary, ghost, disabled, onClick }) {
  return (
    <button className={`kiosk-btn${primary ? " kiosk-btn-primary" : ""}${ghost ? " kiosk-btn-ghost" : ""}${disabled ? " kiosk-btn-disabled" : ""}`}
      disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function ReviewRow({ label, value, highlight, dim }) {
  return (
    <div className="review-row">
      <span className="review-label">{label}</span>
      <span className={`review-value${highlight ? " review-highlight" : ""}${dim ? " review-dim" : ""}`}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    Open: "pill-open",
    "In Progress": "pill-progress",
    Resolved: "pill-resolved",
  };
  return <span className={`status-pill ${map[status] || ""}`}>{status}</span>;
}

function FirebaseStatusBadge() {
  const [status, setStatus] = useState("connecting"); // connecting | live | error

  useEffect(() => {
    const t = setTimeout(() => {
      if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
        const db = window.firebase.database();
        const ref = db.ref(".info/connected");
        ref.on("value", (snap) => {
          setStatus(snap.val() ? "live" : "offline");
        });
        return () => ref.off();
      } else {
        setStatus("error");
      }
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  const map = {
    connecting: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", dot: "#f59e0b", label: "Connecting…" },
    live:       { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.3)",  dot: "#34d399", label: "Live · Firebase" },
    offline:    { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", dot: "#f59e0b", label: "Reconnecting…" },
    error:      { color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.2)", dot: "#64748b", label: "Local · Same device only" },
  };
  const s = map[status];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, background: s.bg, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 700, color: s.color, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block", animation: status === "live" ? "pulse 1.4s ease infinite" : "none" }} />
      {s.label}
    </div>
  );
}

function AssignPanel({ ticketId, onAssign }) {
  const [techName, setTechName] = useState("");
  const [mode, setMode] = useState("idle"); // idle | input

  const handleAssign = (name) => {
    if (!name.trim()) return;
    onAssign(name.trim());
    setTechName("");
    setMode("idle");
  };

  return (
    <div className="assign-panel">
      {mode === "idle" ? (
        <>
          <button className="assign-me-btn" onClick={() => setMode("input")}>
            <span>👤</span> Assign this ticket to a technician
          </button>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, color: "#475569", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 2 }}>TECHNICIAN NAME</div>
          <div className="assign-input-row">
            <input
              className="assign-input"
              placeholder="e.g. Sarah Mitchell"
              value={techName}
              autoFocus
              onChange={(e) => setTechName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAssign(techName); if (e.key === "Escape") { setMode("idle"); setTechName(""); } }}
            />
            <button className="assign-confirm-btn" onClick={() => handleAssign(techName)}>✓</button>
            <button className="assign-cancel-btn" onClick={() => { setMode("idle"); setTechName(""); }}>✕</button>
          </div>
          <button className="assign-other-btn" onClick={() => handleAssign("Me")}>⚡ Quick assign to "Me"</button>
        </div>
      )}
    </div>
  );
}

function DashTicketRow({ ticket, selected, onClick, isNew, index }) {
  return (
    <div className={`ticket-row${selected ? " ticket-row-selected" : ""}${isNew ? " ticket-row-new" : ""}`}
      onClick={onClick} style={{ animationDelay: `${index * 0.04}s` }}>
      <div className="ticket-row-left">
        <div className="ticket-row-id">{ticket.id}</div>
        <div className="ticket-row-name">{ticket.name}</div>
        <div className="ticket-row-issue">{ticket.category} · {ticket.issue.slice(0, 55)}{ticket.issue.length > 55 ? "…" : ""}</div>
        <div className="ticket-row-tags">
          {ticket.assetTag && <span className="tag tag-asset">🏷 {ticket.assetTag}</span>}
          {ticket.isExisting && <span className="tag tag-existing">🔗 Existing</span>}
          {ticket.checkedIn && <span className="tag tag-present">✓ Present</span>}
          {ticket.serviceNumber && <span className="tag tag-service">🪪 {ticket.serviceNumber}</span>}
          {ticket.assignedTo && <span className="tag tag-assigned">👤 {ticket.assignedTo}</span>}
        </div>
      </div>
      <div className="ticket-row-right">
        <StatusPill status={ticket.status} />
        <div className="ticket-row-time">{ticket.arrivalTime || ticket.time}</div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="detail-row">
      <div className="detail-row-label">{label}</div>
      <div className={`detail-row-value${mono ? " mono" : ""}`}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  URL ROUTING + ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
function getUrlView() {
  try {
    const v = new URLSearchParams(window.location.search).get("view");
    if (v === "kiosk" || v === "dashboard") return v;
  } catch (_) {}
  return "split";
}

export default function App() {
  const urlView = getUrlView();
  const [view, setView] = useState(urlView);
  const isLocked = urlView !== "split";

  const handleSetView = (v) => {
    setView(v);
    try {
      const url = new URL(window.location.href);
      if (v === "split") url.searchParams.delete("view");
      else url.searchParams.set("view", v);
      window.history.replaceState({}, "", url.toString());
    } catch (_) {}
  };

  const goHome = () => handleSetView("split");

  return (
    <div style={{ fontFamily: "'Sora', 'DM Sans', sans-serif", minHeight: "100vh", background: "#080a0f" }}>
      <style>{STYLES}</style>

      {/* Home button — only when in locked view */}
      {isLocked && (
        <button className="floating-home-btn" onClick={goHome}>
          ← Home
        </button>
      )}

      {/* Toggle — only in split/demo mode */}
      {!isLocked && (
        <div className="view-toggle">
          {["split", "kiosk", "dashboard"].map((v) => (
            <button key={v} className={`toggle-btn${view === v ? " toggle-btn-active" : ""}`}
              onClick={() => handleSetView(v)}>
              {v === "split" ? "⊞ Both" : v === "kiosk" ? "🚪 Kiosk" : "📊 Dashboard"}
            </button>
          ))}
        </div>
      )}

      <div className={`split-wrap${view === "split" ? " split-mode" : ""}`}>
        {(view === "split" || view === "kiosk") && (
          <div className={`split-pane${view === "split" ? " split-pane-kiosk" : " split-pane-full"}`}>
            {view === "split" && <div className="split-label">🚪 KIOSK</div>}
            <KioskScreen goHome={goHome} />
          </div>
        )}
        {(view === "split" || view === "dashboard") && (
          <div className={`split-pane${view === "split" ? " split-pane-dash" : " split-pane-full"}`}>
            {view === "split" && <div className="split-label split-label-right">📊 DASHBOARD</div>}
            <DashboardScreen goHome={goHome} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ALL STYLES — premium $20k design
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { overflow-x: hidden; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2d2d3a; border-radius: 4px; }
  input, textarea, button { font-family: inherit; }
  .mono { font-family: 'JetBrains Mono', monospace !important; }

  /* ── Animations ── */
  @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes breathe { 0%,100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
  @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.6); } }
  @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
  @keyframes ringPulse { 0% { box-shadow: 0 0 0 0 rgba(200,16,46,0.4); } 70% { box-shadow: 0 0 0 20px rgba(200,16,46,0); } 100% { box-shadow: 0 0 0 0 rgba(200,16,46,0); } }
  @keyframes checkBounce { 0% { transform: scale(0) rotate(-15deg); } 60% { transform: scale(1.2) rotate(5deg); } 100% { transform: scale(1) rotate(0); } }
  @keyframes toastSlide { 0% { opacity: 0; transform: translateX(30px); } 15%,85% { opacity: 1; transform: translateX(0); } 100% { opacity: 0; transform: translateX(30px); } }
  @keyframes borderGlow { 0%,100% { border-color: rgba(200,16,46,0.3); } 50% { border-color: rgba(200,16,46,0.7); } }
  @keyframes progressFill { from { width: 0; } }
  @keyframes rowIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }

  .slide-in { animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }

  /* ── Split layout ── */
  .split-wrap { display: flex; height: 100vh; }
  .split-mode .split-pane-kiosk { flex: 0 0 420px; border-right: 1px solid rgba(255,255,255,0.06); }
  .split-mode .split-pane-dash { flex: 1; }
  .split-pane-full { flex: 1; }
  .split-label { position: absolute; top: 52px; left: 10px; font-size: 9px; color: #3d4a5c; font-weight: 700; letter-spacing: 1.5px; z-index: 10; }
  .split-label-right { left: 430px; }

  /* ── View toggle ── */
  .view-toggle { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 999; display: flex; gap: 3px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 4px; backdrop-filter: blur(20px); }
  .toggle-btn { padding: 5px 16px; border-radius: 7px; border: none; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; background: transparent; color: #64748b; letter-spacing: 0.3px; }
  .toggle-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.05); }
  .toggle-btn-active { background: #fff !important; color: #0a0a0f !important; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }

  /* ── Floating home button ── */
  .floating-home-btn { position: fixed; top: 14px; left: 16px; z-index: 999; display: flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #64748b; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; backdrop-filter: blur(16px); font-family: inherit; }
  .floating-home-btn:hover { background: rgba(200,16,46,0.15); color: #fff; border-color: rgba(200,16,46,0.4); transform: translateX(-2px); }

  /* ════════════════════════════════════════════════════
     KIOSK STYLES
  ════════════════════════════════════════════════════ */
  .kiosk-root { position: relative; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 0 16px 32px; color: #fff; overflow-y: auto; }

  /* Header */
  .kiosk-header { position: sticky; top: 0; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; background: rgba(8,10,15,0.85); backdrop-filter: blur(24px); border-bottom: 1px solid rgba(255,255,255,0.06); z-index: 100; margin-bottom: 0; }
  .kiosk-brand-btn { display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 8px; transition: all 0.2s; }
  .kiosk-brand-btn:hover { background: rgba(200,16,46,0.1); }
  .brand-dot { width: 8px; height: 8px; border-radius: 50%; background: #C8102E; box-shadow: 0 0 8px rgba(200,16,46,0.6); flex-shrink: 0; }
  .brand-qr { font-size: 14px; font-weight: 800; color: #f1f5f9; letter-spacing: 0.3px; }
  .brand-sep { color: rgba(255,255,255,0.2); font-size: 12px; }
  .brand-it { font-size: 13px; font-weight: 500; color: #64748b; }
  .kiosk-clock-wrap { text-align: right; }
  .kiosk-clock { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 600; color: #f1f5f9; }
  .kiosk-date { font-size: 10px; color: #475569; margin-top: 2px; }

  /* Progress bar */
  .progress-bar-wrap { width: 100%; max-width: 480px; display: flex; align-items: center; gap: 12px; padding: 12px 0 0; }
  .progress-bar-track { flex: 1; height: 3px; background: rgba(255,255,255,0.08); border-radius: 99px; overflow: hidden; }
  .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #C8102E, #ff4d6d); border-radius: 99px; transition: width 0.5s cubic-bezier(0.16,1,0.3,1); animation: progressFill 0.5s ease; box-shadow: 0 0 8px rgba(200,16,46,0.5); }
  .progress-label { font-size: 10px; color: #475569; font-weight: 600; white-space: nowrap; letter-spacing: 0.5px; }

  /* Card */
  .kiosk-card-wrap { width: 100%; max-width: 480px; padding: 20px 0; flex: 1; display: flex; align-items: flex-start; justify-content: center; }
  .kiosk-card { width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 40px 36px; backdrop-filter: blur(20px); position: relative; overflow: hidden; }
  .kiosk-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(200,16,46,0.4), transparent); }

  /* Welcome icon */
  .welcome-icon { display: flex; justify-content: center; margin-bottom: 20px; animation: fadeIn 0.6s ease; }

  /* Typography */
  .eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 2.5px; color: #C8102E; margin-bottom: 12px; }
  .card-title { font-size: 28px; font-weight: 800; line-height: 1.15; color: #f8fafc; margin-bottom: 12px; }
  .card-sub { font-size: 14px; color: #64748b; line-height: 1.65; margin-bottom: 24px; }
  .highlight-text { color: #ff4d6d; font-family: 'JetBrains Mono', monospace; font-size: 13px; }
  .char-count { font-size: 11px; color: #334155; text-align: right; margin-top: 6px; }

  /* Buttons */
  .btn-group { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
  .kiosk-btn { width: 100%; padding: 15px 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.2s cubic-bezier(0.16,1,0.3,1); background: rgba(255,255,255,0.05); color: #cbd5e1; display: flex; align-items: center; justify-content: center; gap: 8px; letter-spacing: 0.2px; }
  .kiosk-btn:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
  .kiosk-btn:active { transform: translateY(0); }
  .kiosk-btn-primary { background: linear-gradient(135deg, #C8102E 0%, #e8192e 50%, #ff3347 100%); border: none; color: #fff; box-shadow: 0 4px 20px rgba(200,16,46,0.4), inset 0 1px 0 rgba(255,255,255,0.15); background-size: 200% auto; }
  .kiosk-btn-primary:hover { background-position: right center; box-shadow: 0 6px 28px rgba(200,16,46,0.55); transform: translateY(-2px); }
  .kiosk-btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.06); color: #475569; }
  .kiosk-btn-ghost:hover { border-color: rgba(255,255,255,0.12); color: #64748b; background: transparent; box-shadow: none; transform: none; }
  .kiosk-btn-disabled { opacity: 0.35; cursor: not-allowed; }
  .kiosk-btn-disabled:hover { transform: none; box-shadow: none; }
  .skip-btn { background: none; border: none; color: #334155; font-size: 12px; cursor: pointer; text-decoration: underline; padding: 4px; font-family: inherit; transition: color 0.2s; }
  .skip-btn:hover { color: #64748b; }

  /* Inputs */
  .fancy-input-wrap { display: flex; align-items: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 0 16px; transition: all 0.2s; }
  .fancy-input-wrap:focus-within { border-color: rgba(200,16,46,0.5); background: rgba(200,16,46,0.05); box-shadow: 0 0 0 3px rgba(200,16,46,0.1); animation: borderGlow 2s ease infinite; }
  .input-icon { font-size: 16px; margin-right: 10px; flex-shrink: 0; }
  .fancy-input { flex: 1; padding: 14px 0; background: transparent; border: none; color: #f1f5f9; font-size: 15px; outline: none; }
  .fancy-input::placeholder { color: #334155; }
  .fancy-textarea { width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #f1f5f9; font-size: 14px; outline: none; resize: vertical; line-height: 1.6; transition: all 0.2s; }
  .fancy-textarea:focus { border-color: rgba(200,16,46,0.5); background: rgba(200,16,46,0.04); box-shadow: 0 0 0 3px rgba(200,16,46,0.1); }
  .fancy-textarea::placeholder { color: #334155; }

  /* Category grid */
  .cat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 4px; }
  .cat-btn { padding: 16px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 0.2s; color: #64748b; }
  .cat-btn:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.15); transform: translateY(-2px); color: #94a3b8; }
  .cat-btn-active { background: rgba(200,16,46,0.12) !important; border: 1px solid rgba(200,16,46,0.45) !important; color: #fca5a5 !important; box-shadow: 0 0 16px rgba(200,16,46,0.15), inset 0 0 20px rgba(200,16,46,0.05); }
  .cat-icon { font-size: 28px; }
  .cat-label { font-size: 11px; font-weight: 600; text-align: center; line-height: 1.3; }

  /* Asset hint */
  .asset-hint-box { display: flex; align-items: flex-start; gap: 10px; background: rgba(200,16,46,0.07); border: 1px solid rgba(200,16,46,0.2); border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; font-size: 13px; color: #94a3b8; line-height: 1.5; }

  /* Review card */
  .review-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 6px 20px; margin-bottom: 8px; }
  .review-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 16px; }
  .review-row:last-child { border-bottom: none; }
  .review-label { font-size: 10px; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; flex-shrink: 0; padding-top: 2px; }
  .review-value { font-size: 13px; color: #94a3b8; text-align: right; line-height: 1.4; }
  .review-highlight { color: #ff4d6d !important; font-family: 'JetBrains Mono', monospace; font-weight: 700; }
  .review-dim { color: #334155 !important; font-style: italic; }
  .review-note { font-size: 12px; color: #64748b; padding: 12px 0 6px; line-height: 1.6; }

  /* Success */
  .success-ring { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #C8102E, #ff3347); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; animation: ringPulse 1.5s ease infinite, checkBounce 0.5s cubic-bezier(0.16,1,0.3,1) both; box-shadow: 0 0 40px rgba(200,16,46,0.4); }
  .success-icon { font-size: 36px; color: #fff; font-weight: 800; }
  .ticket-badge { background: rgba(200,16,46,0.1); border: 1px solid rgba(200,16,46,0.3); border-radius: 16px; padding: 20px 28px; text-align: center; margin: 20px 0; animation: borderGlow 2s ease infinite; }
  .ticket-badge-label { font-size: 9px; color: #C8102E; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
  .ticket-badge-id { font-size: 32px; font-weight: 800; color: #f8fafc; font-family: 'JetBrains Mono', monospace; letter-spacing: 2px; }
  .ticket-badge-time { font-size: 11px; color: #475569; margin-top: 6px; font-family: 'JetBrains Mono', monospace; }

  /* Footer */
  .kiosk-footer { width: 100%; max-width: 480px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 20px 0 8px; border-top: 1px solid rgba(255,255,255,0.05); }
  .footer-brand { font-size: 13px; font-weight: 800; color: #C8102E; }
  .footer-sep { color: rgba(255,255,255,0.15); }
  .footer-sub { font-size: 11px; color: #1e293b; letter-spacing: 0.5px; }

  /* ════════════════════════════════════════════════════
     DASHBOARD STYLES
  ════════════════════════════════════════════════════ */
  .dash-root { position: relative; display: flex; height: 100vh; color: #e2e8f0; overflow: hidden; }

  /* Sidebar */
  .dash-sidebar { width: 240px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid rgba(255,255,255,0.06); z-index: 10; position: relative; background: rgba(8,10,15,0.7); backdrop-filter: blur(20px); }
  .dash-sidebar-inner { padding: 20px 16px; display: flex; flex-direction: column; gap: 4px; height: 100%; overflow-y: auto; }
  .dash-brand-wrap { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .dash-brand-btn { display: flex; align-items: center; gap: 10px; background: none; border: none; cursor: pointer; padding: 8px; border-radius: 10px; transition: all 0.2s; width: 100%; }
  .dash-brand-btn:hover { background: rgba(200,16,46,0.1); }
  .dash-brand-dot { width: 8px; height: 8px; border-radius: 50%; background: #C8102E; box-shadow: 0 0 8px rgba(200,16,46,0.6); flex-shrink: 0; }
  .dash-brand-name { font-size: 13px; font-weight: 800; color: #f1f5f9; text-align: left; letter-spacing: 0.2px; }
  .dash-brand-sub { font-size: 10px; color: #475569; text-align: left; }
  .dash-live-badge { display: flex; align-items: center; gap: 7px; font-size: 9px; font-weight: 800; color: #22d3ee; letter-spacing: 2px; margin-bottom: 4px; padding: 0 8px; }
  .live-pulse { width: 6px; height: 6px; border-radius: 50%; background: #22d3ee; animation: pulse 1.4s ease infinite; }
  .dash-clock { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; color: #1e293b; padding: 4px 8px; }
  .dash-date { font-size: 10px; color: #1e293b; padding: 0 8px 12px; }

  /* Stat cards */
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 8px 0 16px; }
  .stat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px; text-align: center; transition: all 0.2s; }
  .stat-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
  .stat-icon { font-size: 14px; margin-bottom: 4px; }
  .stat-value { font-size: 24px; font-weight: 800; line-height: 1; }
  .stat-label { font-size: 9px; color: #475569; margin-top: 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

  /* Filters */
  .filter-section-label { font-size: 9px; color: #1e293b; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 8px 8px 6px; }
  .filter-btns { display: flex; flex-direction: column; gap: 2px; margin-bottom: 12px; }
  .filter-btn { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 8px; border: none; background: transparent; color: #475569; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.15s; width: 100%; font-family: inherit; }
  .filter-btn:hover { background: rgba(255,255,255,0.05); color: #94a3b8; }
  .filter-btn-active { background: rgba(200,16,46,0.12) !important; color: #f1f5f9 !important; font-weight: 700; }
  .filter-count { background: rgba(255,255,255,0.07); border-radius: 5px; padding: 1px 8px; font-size: 10px; color: #64748b; }

  /* Main area */
  .dash-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; z-index: 5; position: relative; }
  .dash-main-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(8,10,15,0.5); backdrop-filter: blur(16px); }
  .dash-main-title { font-size: 22px; font-weight: 800; color: #f1f5f9; }
  .dash-main-sub { font-size: 11px; color: #334155; margin-top: 2px; }
  .dash-header-right { display: flex; align-items: center; gap: 12px; }
  .new-ticket-toast { background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.3); color: #22d3ee; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 8px; animation: toastSlide 3s ease forwards; white-space: nowrap; }

  /* Ticket list */
  .ticket-list { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; gap: 12px; }
  .empty-icon { font-size: 40px; opacity: 0.3; }
  .empty-text { font-size: 16px; font-weight: 700; color: #1e293b; }
  .empty-sub { font-size: 12px; color: #1e293b; }

  /* Ticket rows */
  .ticket-row { display: flex; justify-content: space-between; align-items: flex-start; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 14px 16px; cursor: pointer; transition: all 0.2s; animation: rowIn 0.35s ease both; }
  .ticket-row:hover { background: rgba(255,255,255,0.055); border-color: rgba(255,255,255,0.12); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
  .ticket-row-selected { border-color: rgba(200,16,46,0.45) !important; background: rgba(200,16,46,0.07) !important; box-shadow: 0 0 0 1px rgba(200,16,46,0.2) !important; }
  .ticket-row-new { animation: rowIn 0.35s ease both, borderGlow 0.8s ease 3 !important; border-color: rgba(34,211,238,0.4) !important; }
  .ticket-row-left { flex: 1; }
  .ticket-row-id { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #ff4d6d; font-weight: 700; margin-bottom: 3px; letter-spacing: 0.5px; }
  .ticket-row-name { font-size: 14px; font-weight: 700; color: #f1f5f9; margin-bottom: 3px; }
  .ticket-row-issue { font-size: 11px; color: #475569; line-height: 1.4; margin-bottom: 6px; }
  .ticket-row-tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .tag { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 5px; }
  .tag-asset { background: rgba(200,16,46,0.1); color: #ff4d6d; font-family: 'JetBrains Mono', monospace; }
  .tag-existing { background: rgba(34,211,238,0.1); color: #22d3ee; }
  .tag-present { background: rgba(52,211,153,0.1); color: #34d399; }
  .ticket-row-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; margin-left: 12px; }
  .ticket-row-time { font-size: 10px; color: #1e293b; font-family: 'JetBrains Mono', monospace; }

  /* Status pills */
  .status-pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; white-space: nowrap; }
  .pill-open { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
  .pill-progress { background: rgba(167,139,250,0.15); color: #a78bfa; border: 1px solid rgba(167,139,250,0.3); }
  .pill-resolved { background: rgba(52,211,153,0.15); color: #34d399; border: 1px solid rgba(52,211,153,0.3); }

  /* Detail panel */
  .dash-detail { width: 280px; flex-shrink: 0; background: rgba(8,10,15,0.85); border-left: 1px solid rgba(255,255,255,0.06); padding: 24px 20px; overflow-y: auto; position: relative; backdrop-filter: blur(20px); animation: slideUp 0.3s ease; z-index: 10; }
  .detail-close { position: absolute; top: 14px; right: 16px; background: rgba(255,255,255,0.06); border: none; color: #64748b; cursor: pointer; width: 28px; height: 28px; border-radius: 7px; font-size: 14px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
  .detail-close:hover { background: rgba(200,16,46,0.2); color: #fff; }
  .detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; margin-top: 8px; gap: 8px; }
  .detail-id { font-size: 13px; font-family: 'JetBrains Mono', monospace; color: #ff4d6d; font-weight: 700; }
  .detail-name { font-size: 20px; font-weight: 800; color: #f8fafc; margin-bottom: 4px; }
  .detail-email { font-size: 12px; color: #475569; margin-bottom: 6px; }
  .detail-present { font-size: 11px; color: #34d399; font-weight: 600; background: rgba(52,211,153,0.1); padding: 4px 10px; border-radius: 6px; display: inline-block; margin-bottom: 8px; }
  .detail-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 14px 0; }
  .detail-row { margin-bottom: 12px; }
  .detail-row-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: #334155; text-transform: uppercase; margin-bottom: 4px; }
  .detail-row-value { font-size: 13px; color: #94a3b8; line-height: 1.5; }
  .detail-status-label { font-size: 9px; font-weight: 700; letter-spacing: 1.5px; color: #334155; text-transform: uppercase; margin-bottom: 8px; }
  .detail-status-btns { display: flex; flex-direction: column; gap: 6px; }
  .detail-status-btn { padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: #64748b; cursor: pointer; font-size: 12px; font-weight: 600; text-align: left; transition: all 0.2s; font-family: inherit; }
  .detail-status-btn:hover { background: rgba(255,255,255,0.07); color: #94a3b8; border-color: rgba(255,255,255,0.14); transform: translateX(2px); }
  .detail-status-btn.active { border-color: rgba(200,16,46,0.45); color: #ff4d6d; background: rgba(200,16,46,0.1); }

  /* ══════════════════════════════════
     RESPONSIVE
  ══════════════════════════════════ */
  @media (max-width: 600px) {
    .kiosk-card { padding: 28px 20px; }
    .card-title { font-size: 22px; }
    .cat-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
    .cat-btn { padding: 12px 6px; }
    .cat-icon { font-size: 22px; }
    .split-mode .split-pane-kiosk { flex: 0 0 100%; border-right: none; }
    .dash-sidebar { width: 0; padding: 0; overflow: hidden; border: none; }
    .dash-detail { width: 100%; position: fixed; bottom: 0; left: 0; right: 0; max-height: 70vh; border-radius: 20px 20px 0 0; border-left: none; border-top: 1px solid rgba(255,255,255,0.08); z-index: 200; }
    .view-toggle { scale: 0.85; top: 8px; }
    .floating-home-btn { top: 8px; left: 10px; padding: 5px 12px; font-size: 11px; }
  }
  @media (min-width: 601px) and (max-width: 1024px) {
    .split-mode .split-pane-kiosk { flex: 0 0 360px; }
    .dash-sidebar { width: 200px; }
    .dash-detail { width: 240px; }
  }
  @media (max-width: 780px) {
    .split-wrap.split-mode { flex-direction: column; }
    .split-mode .split-pane-kiosk { flex: none; height: 55vh; overflow-y: auto; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .split-mode .split-pane-dash { height: 45vh; }
  }

  /* ── Service number + Assignment styles ── */
  .detail-service-num { font-size: 12px; color: #a78bfa; font-family: 'JetBrains Mono', monospace; font-weight: 600; margin-bottom: 4px; }
  .tag-service { background: rgba(167,139,250,0.12); color: #a78bfa; }
  .tag-assigned { background: rgba(52,211,153,0.1); color: #34d399; font-weight: 700; }

  /* Assign panel */
  .assign-panel { display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px; }
  .assign-me-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid rgba(200,16,46,0.35); background: rgba(200,16,46,0.1); color: #ff4d6d; cursor: pointer; font-size: 13px; font-weight: 700; font-family: inherit; transition: all 0.2s; text-align: left; }
  .assign-me-btn:hover { background: rgba(200,16,46,0.2); border-color: rgba(200,16,46,0.55); transform: translateX(2px); box-shadow: 0 2px 12px rgba(200,16,46,0.2); }
  .assign-other-btn { width: 100%; padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.07); background: transparent; color: #475569; cursor: pointer; font-size: 12px; font-weight: 500; font-family: inherit; transition: all 0.2s; text-align: left; }
  .assign-other-btn:hover { background: rgba(255,255,255,0.05); color: #64748b; border-color: rgba(255,255,255,0.12); }
  .assign-input-row { display: flex; gap: 4px; align-items: center; }
  .assign-input { flex: 1; padding: 8px 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #f1f5f9; font-size: 12px; outline: none; font-family: inherit; }
  .assign-input:focus { border-color: rgba(200,16,46,0.4); }
  .assign-confirm-btn { padding: 8px 10px; border-radius: 8px; background: rgba(52,211,153,0.15); border: 1px solid rgba(52,211,153,0.3); color: #34d399; cursor: pointer; font-size: 13px; font-weight: 700; transition: all 0.2s; }
  .assign-confirm-btn:hover { background: rgba(52,211,153,0.25); }
  .assign-cancel-btn { padding: 8px 10px; border-radius: 8px; background: transparent; border: 1px solid rgba(255,255,255,0.07); color: #475569; cursor: pointer; font-size: 13px; transition: all 0.2s; }
  .assign-cancel-btn:hover { border-color: rgba(255,255,255,0.14); color: #64748b; }

  /* Assigned badge */
  .assigned-badge { display: flex; align-items: center; gap: 10px; background: rgba(52,211,153,0.07); border: 1px solid rgba(52,211,153,0.2); border-radius: 10px; padding: 10px 12px; margin-bottom: 4px; }
  .assigned-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #C8102E, #ff4d6d); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; font-weight: 800; flex-shrink: 0; }
  .assigned-name { font-size: 13px; font-weight: 700; color: #34d399; }
  .assigned-change { background: none; border: none; color: #334155; font-size: 10px; cursor: pointer; padding: 0; font-family: inherit; text-decoration: underline; transition: color 0.2s; }
  .assigned-change:hover { color: #ef4444; }

  /* Firebase not-configured warning banner */
  .firebase-banner { position: fixed; top: 0; left: 0; right: 0; z-index: 9999; background: linear-gradient(90deg, #1a0a00, #2a1200); border-bottom: 1px solid rgba(245,158,11,0.4); padding: 10px 24px; display: flex; align-items: center; gap: 12px; font-size: 12px; color: #f59e0b; font-weight: 600; }
  .firebase-banner code { background: rgba(245,158,11,0.15); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #fbbf24; }
`;
