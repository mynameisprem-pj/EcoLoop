<div align="center">
  <img src="public/ecoloop-logo.svg" alt="EcoLoop Logo" width="84" height="84" />

  # EcoLoop
  **Real-Time Hyper-Local Surplus Food Rescue & Zero-Waste Routing Platform**

  [![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-Realtime_PostgreSQL-3ECF8E?logo=supabase&logoColor=black)](https://supabase.com/)
  [![PWA](https://img.shields.io/badge/PWA-Offline_Ready-10B981)](https://web.dev/progressive-web-apps/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

---

## 🌍 Overview

**EcoLoop** is a real-time, offline-resilient web platform that connects local food businesses (bakeries, grocery stores, cafes, restaurants) with nearby consumers and community kitchens to rescue unsold surplus food before it expires.

Every year, roughly one-third of all food produced globally is wasted, contributing **8–10% of global greenhouse gas emissions** as organic matter decomposes into methane in landfills. EcoLoop closes the last-mile logistics gap by broadcasting time-sensitive food drops to nearby users via WebSockets, live GPS routing, and camera-verified QR handoff passes.

---

## ✨ Key Features

- **⚡ Real-Time Multi-User Sync (Supabase WebSockets):** When a store publishes surplus inventory, it broadcasts immediately across all connected devices without page reloads.
- **📍 Live GPS Geolocation & OpenStreetMap Routing:** Uses the browser's native `navigator.geolocation` API, spherical **Haversine distance calculations**, and **OpenStreetMap Nominatim** reverse/forward geocoding to rank food drops by real-world proximity.
- **⏱️ Dynamic Expiry Countdown Engine:** Live `HH:MM:SS` timers automatically shift visual urgency tiers (`Normal` → `Warning` → `Critical`) and sweep expired inventory out of the discovery feed.
- **📷 Camera Food Capture & Client-Side Compression:** Stores can snap photos directly from their phone or webcam; images are automatically resized and compressed to lightweight WebP data streams (`< 60 KB`) on the client.
- **📲 ISO-18004 QR Handoff Pass & Hardware Camera Scanner:** Claiming an item generates a cryptographic QR pass (`ECOLOOP|<claimId>|<pickupCode>`) with optimistic concurrency locking. Store staff can scan the consumer's screen using their device camera (`html5-qrcode`) or verify via the 6-character alphanumeric backup code.
- **📶 Hybrid Offline-First Persistence (Dexie.js / IndexedDB):** Cloud state is continuously mirrored into local IndexedDB storage so consumers can view their active pickup passes and QR codes even in areas with zero cellular reception.
- **📊 Scientific Environmental Impact Ledger:** Tracks verified rescues using standard EPA/FAO conversion factors ($1\text{ kg}$ food waste prevented $\approx 2.5\text{ kg }\text{CO}_2\text{e}$ saved; $1\text{ meal} \approx 0.45\text{ kg}$), complete with passenger-car kilometer and tree-carbon equivalencies.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 + Vite + TypeScript | Strictly typed, fast component architecture |
| **Styling & UI** | Tailwind CSS v4 + Lucide Icons | Responsive dark-glassmorphism layout across Mobile, Tablet, and Desktop |
| **State Management** | Zustand | Reactive store orchestrating cloud & offline state |
| **Cloud Backend & Realtime** | Supabase (PostgreSQL + Realtime) | Multi-user persistence, optimistic concurrency locking, live WebSocket broadcasts |
| **Offline Persistence** | Dexie.js (IndexedDB) | Local offline cache & fallback storage engine |
| **Maps & Geolocation** | Leaflet + React-Leaflet + Nominatim | Interactive dark-mode street maps & real-world address geocoding |
| **QR & Camera Hardware** | `qrcode.react` + `html5-qrcode` | ISO QR code generation & live hardware camera barcode scanning |

---

## 📂 Project Architecture

```text
ecoloop/
├── public/
│   ├── ecoloop-logo.svg             # Vector brand emblem & browser tab favicon
│   └── manifest.json                # Progressive Web App (PWA) configuration
├── src/
│   ├── components/
│   │   ├── analytics/
│   │   │   └── ImpactAnalyticsView.tsx  # CO2e ledger, EPA equivalencies & store leaderboard
│   │   ├── common/
│   │   │   ├── EcoLoopLogo.tsx          # Responsive brand icon component
│   │   │   └── ExpiryActionBanner.tsx   # Live HH:MM:SS countdown & Rescue trigger
│   │   ├── dashboard/
│   │   │   ├── LiveStreetMap.tsx        # Interactive OpenStreetMap with live GPS pins
│   │   │   ├── MyClaimsView.tsx         # Active pickup passes & verified receipts queue
│   │   │   ├── PostListingForm.tsx      # Store portal with live GPS pinning & photo upload
│   │   │   └── SurplusCard.tsx          # Glassmorphic surplus food card component
│   │   └── modals/
│   │       └── QrHandoffModal.tsx       # ISO QR pass + live hardware camera scanner
│   ├── db/
│   │   └── database.ts              # Dexie.js IndexedDB schema & impact formulas
│   ├── lib/
│   │   └── supabase.ts              # Supabase client & snake_case <-> camelCase mappers
│   ├── store/
│   │   └── useEcoStore.ts           # Zustand global store with WebSocket subscriptions
│   ├── types/
│   │   └── index.ts                 # Strict TypeScript domain interfaces & constants
│   ├── utils/
│   │   ├── geoUtils.ts              # Haversine formula, browser GPS & Nominatim geocoder
│   │   ├── imageUtils.ts            # Client-side HTML5 Canvas WebP photo compressor
│   │   └── impactCalculator.ts      # Real-time countdown & aggregate CO2e calculator
│   ├── App.tsx                      # Responsive multi-device shell (Split-view Desktop / Dock Mobile)
│   ├── index.css                    # Tailwind CSS v4 & custom dark Leaflet tile filters
│   └── main.tsx                     # Application entry point
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts

```

---

## 🚀 Getting Started Locally

### 1. Clone & Install Dependencies

```bash
git clone [https://github.com/your-username/ecoloop.git](https://github.com/your-username/ecoloop.git)
cd ecoloop
npm install

```

### 2. Configure Supabase Cloud Database

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard and run the following schema setup script:

```sql
create table public.listings (
  id text primary key,
  donor_id text not null,
  donor_name text not null,
  donor_type text not null,
  title text not null,
  description text not null,
  category text not null,
  dietary_tags text[] default '{}',
  weight_kg numeric not null,
  estimated_meals integer not null,
  co2_saved_kg numeric not null,
  created_at bigint not null,
  expires_at bigint not null,
  pickup_window text not null,
  lat double precision not null,
  lng double precision not null,
  address text not null,
  neighborhood text not null,
  status text not null default 'available',
  storage_requirement text not null default 'ambient',
  image_url text,
  claimed_by_id text,
  claimed_by_name text,
  claimed_at bigint,
  pickup_code text
);

create table public.claims (
  id text primary key,
  listing_id text not null references public.listings(id) on delete cascade,
  listing_title text not null,
  donor_name text not null,
  receiver_id text not null,
  receiver_name text not null,
  claimed_at bigint not null,
  completed_at bigint,
  pickup_code text not null,
  status text not null default 'pending_pickup',
  weight_kg numeric not null,
  co2_saved_kg numeric not null,
  meals_saved integer not null
);

alter table public.listings enable row level security;
alter table public.claims enable row level security;

create policy "Allow public read and write on listings"
  on public.listings for all using (true) with check (true);

create policy "Allow public read and write on claims"
  on public.claims for all using (true) with check (true);

alter publication supabase_realtime add table public.listings;
alter publication supabase_realtime add table public.claims;

```

3. Create a `.env` file in the root of your project and add your Supabase credentials:

```env
VITE_SUPABASE_URL=[https://your-project-id.supabase.co](https://your-project-id.supabase.co)
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key

```

*(Note: If `.env` variables are omitted, EcoLoop automatically falls back to **Local Offline Mode** powered by Dexie.js IndexedDB.)*

### 3. Run the Development Server

```bash
npm run dev

```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔄 End-to-End User Workflow

1. **Detect Location:** On launch, grant browser GPS permission (or click the top location pill to search any city/street worldwide).
2. **Publish Surplus (Store Partner):** Switch to **List Surplus Food**, enter your store details, snap or upload a food photo, pin your coordinates via **Use My Live GPS**, and publish.
3. **Discover & Claim (Consumer):** Browse the live feed or interactive street map sorted by real-world kilometer distance and expiry urgency. Click **Rescue** to reserve the item and generate your **Live QR Pickup Pass** (`ECO-XXX`).
4. **Verify Pickup & Log Impact:** At the store counter, staff tap **Scan QR with Camera** (or enter the `ECO-XXX` verification code) to confirm handoff. The rescue is permanently credited to the **Impact Ledger**.

---

## 🌐 Deployment (Vercel)

1. Push your repository to **GitHub**.
2. Import the project into [Vercel](https://vercel.com).
3. In **Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Click **Deploy**. Vercel's automatic `HTTPS` provisioning enables full secure-context access for both **Browser Geolocation** and **Hardware Camera QR Scanning** across mobile and desktop devices.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
'''

