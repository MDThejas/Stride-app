# STRIDE — Activity Tracker

## Project Structure
```
stride/
├── frontend/                  # Everything the user sees
│   ├── index.html             # Landing page
│   ├── pages/
│   │   ├── auth.html          # Login / Signup page
│   │   └── dashboard.html     # Main app shell (loads all sections)
│   ├── components/
│   │   ├── sidebar.html       # Sidebar nav (included in dashboard)
│   │   └── toast.html         # Toast + achievement popup markup
│   ├── styles/
│   │   ├── global.css         # CSS variables, resets, fonts
│   │   ├── landing.css        # Landing page styles
│   │   ├── auth.css           # Auth page styles
│   │   └── dashboard.css      # App/dashboard styles
│   └── js/
│       ├── supabase.js        # Supabase client init
│       ├── auth.js            # Login, signup, logout logic
│       ├── activities.js      # Log, fetch, delete activities
│       ├── goals.js           # Add, update, delete goals
│       ├── stats.js           # Stats calculations + charts
│       ├── achievements.js    # Badge/streak logic
│       └── dashboard.js       # Dashboard render + nav
│
├── backend/                   # Node.js + Express server
│   ├── server.js              # Entry point
│   ├── config/
│   │   └── supabase.js        # Supabase admin client (service key)
│   ├── middleware/
│   │   └── auth.js            # JWT verification middleware
│   ├── routes/
│   │   ├── activities.js      # GET/POST/DELETE /api/activities
│   │   ├── goals.js           # GET/POST/PUT/DELETE /api/goals
│   │   ├── stats.js           # GET /api/stats
│   │   └── profile.js         # GET/PUT /api/profile
│   └── controllers/
│       ├── activities.js      # Business logic for activities
│       ├── goals.js           # Business logic for goals
│       ├── stats.js           # Business logic for stats
│       └── profile.js         # Business logic for profile
│
├── database/
│   └── schema.sql             # All table definitions + RLS policies
│
├── .env.example               # Environment variables template
└── package.json               # Backend dependencies
```

## Quick Start

### 1. Clone & Install
```bash
cd backend
npm install
```

### 2. Set up Supabase
- Create project at supabase.com
- Run `database/schema.sql` in the SQL editor
- Copy your URL and keys into `.env`

### 3. Run backend
```bash
cd backend
npm run dev
```

### 4. Open frontend
Open `frontend/index.html` in browser, or use Live Server in VS Code.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS + Chart.js
- **Backend**: Node.js + Express
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth (JWT)
- **Deploy**: Vercel (frontend) + Railway (backend)
