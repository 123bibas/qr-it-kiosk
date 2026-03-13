# Queensland Rail — IT Support Kiosk

A self-service IT support check-in kiosk with a live technician dashboard.
Built with React + Firebase Realtime Database.

---

## Features

- **Kiosk screen** — staff check in with new or existing ServiceNow tickets
- **Dashboard screen** — technicians see live queue, assign tickets, update status
- **Real-time** — Firebase syncs across all devices instantly
- **Two-monitor support** — open kiosk and dashboard on separate screens via URL

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Run locally
```bash
npm start
```
Opens at http://localhost:3000

### 3. View screens
| Screen | URL |
|---|---|
| Both screens (demo) | http://localhost:3000 |
| Kiosk only | http://localhost:3000?view=kiosk |
| Dashboard only | http://localhost:3000?view=dashboard |

---

## Firebase Setup (for real-time across devices)

1. Go to https://console.firebase.google.com
2. Create a new project called `qr-it-kiosk`
3. Create a Realtime Database (Singapore region, test mode)
4. Register a Web app and copy the config values
5. Open `src/App.js` and replace the `FIREBASE_CONFIG` values at the top of the file
6. Push to GitHub — Vercel will redeploy automatically

---

## Deploy to Vercel (free)

```bash
# First time
npm install -g vercel
vercel

# After that, just push to GitHub
git add .
git commit -m "your message"
git push
```

Live URLs after deploy:
- `https://qr-it-kiosk.vercel.app?view=kiosk` → Door screen
- `https://qr-it-kiosk.vercel.app?view=dashboard` → Tech desk screen

---

## Project Structure

```
qr-it-kiosk/
├── public/
│   └── index.html          # HTML entry point
├── src/
│   ├── App.js              # Entire application (kiosk + dashboard)
│   ├── index.js            # React entry point
│   └── index.css           # Global reset styles
├── .gitignore
├── package.json
└── README.md
```

---

## Tech Stack

- **React 18** — UI framework
- **Firebase Realtime Database** — live data sync
- **Vercel** — free hosting with auto-deploy from GitHub
- **No other dependencies** — no Redux, no router, no CSS framework

---

## Data Storage

| Mode | How |
|---|---|
| Firebase configured | All tickets stored in Firebase, real-time across all devices |
| Firebase NOT configured | Tickets stored in localStorage, persists on same browser only |

---

Built for Queensland Rail IT Support Team.
