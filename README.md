# FarmConnect — Firebase Edition
### Complete Setup & Integration Guide
**PTMS Internship · Vizag Steel Plant (RINL) · Full Stack Domain**

---

## What Changed from the MongoDB Version

| Piece              | MongoDB Version          | Firebase Version               |
|--------------------|--------------------------|--------------------------------|
| Database           | MongoDB + Mongoose       | **Firestore** (NoSQL cloud DB) |
| Authentication     | bcrypt + JWT (custom)    | **Firebase Auth** (managed)    |
| Password storage   | Hashed in MongoDB        | **Firebase servers** (secure)  |
| Token verification | `jwt.verify()`           | `admin.auth().verifyIdToken()` |
| Models             | Mongoose Schema files    | **Firestore collections** (no schema files needed) |
| Backend packages   | mongoose, bcryptjs, jsonwebtoken | **firebase-admin** only |
| Frontend auth      | Custom fetch to `/login` | **Firebase SDK** `signInWithEmailAndPassword` |

---

## Complete File Structure

```
farmconnect-firebase/
│
├── firebase.json              ← Firebase CLI deploy config
├── firestore.rules            ← Security rules (who can read/write what)
├── firestore.indexes.json     ← Composite indexes for multi-field queries
│
├── client/                    ← Frontend (served by Express or Firebase Hosting)
│   ├── index.html             ← Complete SPA — all pages + Firebase SDK
│   ├── manifest.json          ← PWA manifest (makes app installable)
│   └── sw.js                  ← Service worker (offline support)
│
└── server/                    ← Node.js + Express backend
    ├── server.js              ← Entry point
    ├── package.json           ← Dependencies (firebase-admin, express, etc.)
    ├── .env.example           ← Template — copy to .env
    │
    ├── config/
    │   └── firebase.js        ← Firebase Admin SDK initialisation
    │
    ├── middleware/
    │   └── auth.js            ← Firebase token verification + role guards
    │
    ├── controllers/
    │   ├── authController.js  ← Register profile in Firestore after Firebase Auth
    │   ├── cropsController.js ← Firestore CRUD for crop listings
    │   ├── contactsController.js ← Phone reveal + interest requests (logged to Firestore)
    │   └── adminController.js ← Stats, user management, call log
    │
    └── routes/
        ├── auth.js            ← /api/auth/*
        ├── crops.js           ← /api/crops/*
        ├── contacts.js        ← /api/contacts/*
        ├── admin.js           ← /api/admin/*
        └── prices.js          ← /api/prices
```

---

## PART 1 — Firebase Project Setup (One Time)

### Step 1: Create a Firebase Project

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"**
3. Name it `farmconnect` (or anything you like)
4. Disable Google Analytics (not needed) → click **Create project**
5. Wait for it to finish → click **Continue**

---

### Step 2: Enable Firebase Authentication

1. In your Firebase project, click **Authentication** in the left sidebar
2. Click **Get started**
3. Under **Sign-in method** tab, click **Email/Password**
4. Toggle **Enable** → click **Save**

> **Why Email/Password?**
> The app uses the phone number as a fake email in the format `9876543210@farmconnect.in`
> so farmers and dealers log in with phone + password without needing SMS OTP.

---

### Step 3: Create Firestore Database

1. Click **Firestore Database** in the left sidebar
2. Click **Create database**
3. Choose **Start in production mode** → click **Next**
4. Pick the closest location: **asia-south1 (Mumbai)** → click **Enable**
5. Wait for it to provision (takes ~30 seconds)

---

### Step 4: Get the Web App Config (for the Frontend)

1. Click the **gear icon** ⚙ next to "Project Overview" → **Project settings**
2. Scroll down to **Your apps** section
3. Click the **web icon** `</>`
4. Register your app with nickname `farmconnect-web` → click **Register app**
5. You will see a `firebaseConfig` object like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "farmconnect-12345.firebaseapp.com",
  projectId: "farmconnect-12345",
  storageBucket: "farmconnect-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

6. **Copy these values** — you will paste them into `client/index.html` in Part 2.

---

### Step 5: Get the Service Account Key (for the Backend)

1. Still in **Project settings** → click the **Service accounts** tab
2. Make sure **Node.js** is selected
3. Click **Generate new private key** → click **Generate key**
4. A JSON file downloads automatically — this is `serviceAccountKey.json`
5. **Keep this file secret — never upload it to GitHub**

The file looks like:
```json
{
  "type": "service_account",
  "project_id": "farmconnect-12345",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@farmconnect-12345.iam.gserviceaccount.com",
  "client_id": "123456789",
  ...
}
```

---

### Step 6: Deploy Firestore Security Rules and Indexes

If you have the Firebase CLI installed:
```bash
npm install -g firebase-tools
firebase login
firebase use --add   # select your project
firebase deploy --only firestore
```

If you don't have the CLI, paste the rules manually:
1. Go to **Firestore Database** → **Rules** tab
2. Replace everything with the contents of `firestore.rules`
3. Click **Publish**

---

## PART 2 — Configure the Frontend

Open `client/index.html` in any text editor.

Find this section near the bottom of the file (around line 800):

```js
// STEP 1 — PASTE YOUR FIREBASE CONFIG HERE
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};
```

Replace **every value** with what you copied from Step 4. For example:

```js
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain:        "farmconnect-12345.firebaseapp.com",
  projectId:         "farmconnect-12345",
  storageBucket:     "farmconnect-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId:             "1:123456789012:web:abcdef1234567890",
};
```

Also find this line just below it:
```js
const API_BASE = "http://localhost:5000/api";
```
Leave it as-is for local development. Change to your deployed server URL when going live.

**Save the file.**

---

## PART 3 — Configure the Backend

### Option A — Using the JSON file (easiest for local dev)

1. Move the downloaded `serviceAccountKey.json` into the `server/` folder
2. Open `server/config/firebase.js`
3. Find the comment near line 15 that says **OPTION B** and replace the `initializeApp` call:

```js
// Replace this:
admin.initializeApp({
  credential: admin.credential.cert({ ... env vars ... }),
});

// With this:
admin.initializeApp({
  credential: admin.credential.cert(
    require('./serviceAccountKey.json')
  ),
});
```

### Option B — Using environment variables (better for deployment)

1. In the `server/` folder, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open the downloaded `serviceAccountKey.json` and copy values into `.env`:

```env
PORT=5000
FIREBASE_PROJECT_ID=farmconnect-12345
FIREBASE_PRIVATE_KEY_ID=abc123def456...
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@farmconnect-12345.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789012345678901
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
```

> **Important:** Copy the `private_key` value exactly as it appears in the JSON,
> including all `\n` characters. Wrap the whole value in double quotes in `.env`.

---

## PART 4 — Install and Run

### Prerequisites
- **Node.js v18 or higher** — download from https://nodejs.org
- Check your version: `node --version`

### Install backend dependencies

```bash
# Open a terminal / command prompt
# Navigate to the server folder
cd farmconnect-firebase/server

# Install all packages
npm install
```

This installs: `express`, `cors`, `dotenv`, `firebase-admin`, `socket.io`, `express-validator`, `nodemon`

### Start the backend server

```bash
# Development mode (auto-restarts when you change code)
npm run dev

# OR production mode
npm start
```

You should see:
```
FarmConnect server running on http://localhost:5000
Database: Firebase Firestore
Auth:     Firebase Authentication
```

### Open the app

Open your browser and go to:
```
http://localhost:5000
```

The Express server serves the `client/index.html` file automatically.

---

## PART 5 — Create the First Admin Account

Firebase does not have an "admin" role by default — you need to manually promote the first user.

### Step 1: Register normally through the app
1. Open `http://localhost:5000`
2. Click **Login** → **Sign Up**
3. Select **Farmer** role and register with your phone number

### Step 2: Promote to admin in Firestore
1. Go to **https://console.firebase.google.com**
2. Click **Firestore Database** → **users** collection
3. Find your document (it will be named with your Firebase UID)
4. Click the document → click **Edit** (pencil icon) on the `role` field
5. Change `"farmer"` to `"admin"` → click **Update**

### Step 3: Log out and log back in
The app reads the role fresh on every login, so log out and back in to see the admin dashboard.

---

## PART 6 — Demo Logins (No Firebase Needed for Testing)

If Firebase is NOT configured yet (you haven't filled in `FIREBASE_CONFIG`), the app runs in **demo mode** automatically. Use these credentials:

| Role     | Phone      | Password  | What you can test                    |
|----------|------------|-----------|--------------------------------------|
| Farmer   | 9000000001 | demo123   | My Listings, Add Crop, Contact Requests |
| Retailer | 9000000002 | demo123   | Browse, Interest Requests, Status    |
| Admin    | 9000000003 | demo123   | Stats, User Management, Call Log     |

Demo mode uses mock data — nothing is saved to Firestore.

---

## API Reference

All endpoints go through the Express backend at `http://localhost:5000/api`

### Auth
```
POST  /api/auth/register           Register profile in Firestore (after Firebase Auth creates the user)
GET   /api/auth/me                 Get logged-in user's Firestore profile
PUT   /api/auth/updateprofile      Update name, village, district
POST  /api/auth/update-last-login  Record last login timestamp
```

### Crops
```
GET    /api/crops                  Browse listings (public, phone hidden from unverified)
GET    /api/crops/farmer/my        Farmer's own listings (requires login)
GET    /api/crops/:id              Single listing detail
POST   /api/crops                  Create listing (farmer only)
PUT    /api/crops/:id              Update listing (farmer who owns it, or admin)
DELETE /api/crops/:id              Remove listing (farmer who owns it, or admin)
```

### Contacts
```
POST /api/contacts/reveal/:cropId    Reveal farmer phone — logs to Firestore (verified retailer only)
POST /api/contacts/interest/:cropId  Send interest request (verified retailer only)
GET  /api/contacts/mycontacts        Farmer sees all contact requests on their crops
GET  /api/contacts/my-interests      Retailer sees all their sent interest requests
PUT  /api/contacts/:id/respond       Farmer accepts or declines a request
```

### Admin (requires admin role)
```
GET /api/admin/stats                 Platform summary counts from Firestore
GET /api/admin/users                 All users (?role=farmer|retailer&verified=true|false)
PUT /api/admin/users/:uid/verify     Approve or reject a retailer
PUT /api/admin/users/:uid/toggle     Activate or deactivate an account
GET /api/admin/listings              All crop listings
GET /api/admin/contacts              Full interaction log
```

### Prices
```
GET /api/prices                      Mock mandi prices (swap for data.gov.in API)
```

---

## Firestore Collections

### `users/{uid}`
```
uid, name, phone, role (farmer|retailer|admin),
district, village, businessName, govtIdNumber,
isVerified, isActive, createdAt, lastLoginAt
```

### `crops/{cropId}`
```
farmerUid, farmerName, farmerPhone,
cropName, quantity, unit, pricePerUnit,
village, district, notes, location ({lat, lng}),
status (active|sold|expired|removed),
viewCount, contactCount, expiresAt, createdAt
```

### `contacts/{contactId}`
```
type (phone_reveal|interest_sent),
retailerUid, retailerName, retailerPhone, retailerBusiness,
farmerUid, farmerName,
cropId, cropName,
status (pending|accepted|declined),
message, createdAt, respondedAt
```

---

## Deploying Online (Free)

### Backend → Render.com (free tier)

1. Push your code to GitHub (exclude `.env` and `serviceAccountKey.json` with `.gitignore`)
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo, select the `server/` folder
4. **Build command:** `npm install`
5. **Start command:** `npm start`
6. Add environment variables (all the `FIREBASE_*` ones from your `.env`)
7. Click **Deploy** — get your URL e.g. `https://farmconnect-xyz.onrender.com`

### Frontend → Update API_BASE

In `client/index.html`, change:
```js
const API_BASE = "http://localhost:5000/api";
```
to:
```js
const API_BASE = "https://farmconnect-xyz.onrender.com/api";
```

Then re-deploy or host the `client/` folder on **Netlify** (drag and drop the client folder).

---

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Firebase: Error (auth/invalid-api-key)` | Wrong apiKey in FIREBASE_CONFIG | Re-copy from Firebase Console → Project Settings |
| `Error: Failed to determine project ID` | .env not configured | Check FIREBASE_PROJECT_ID in .env |
| `FAILED_PRECONDITION: index required` | Missing Firestore index | Click the link in the error — it opens Firebase Console to create the index |
| `auth/email-already-in-use` | Phone already registered | That phone has an account — use Login tab |
| `403 Not authorised` | JWT expired or wrong role | Log out and log back in to get a fresh token |
| `Cannot GET /api/crops` | Server not running | Run `npm run dev` in the `server/` folder |
| Yellow warning bar on homepage | FIREBASE_CONFIG not filled in | Fill in the config in client/index.html (Part 2 above) |

---

## .gitignore (add this before pushing to GitHub)

Create a file named `.gitignore` in the root of the project:
```
# Never commit these
server/.env
server/serviceAccountKey.json
server/node_modules/
client/node_modules/
.DS_Store
*.log
```
