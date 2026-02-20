# AI Proctored Exam System

A full-stack web application for conducting AI-proctored online examinations with real-time violation detection.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** MongoDB (Atlas for production)
- **Deployment:** Vercel (frontend) + Render (backend)

---

## Local Development

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your values
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
cp .env.example .env
# Edit .env with your values
npm install
npm run dev
```

---

## Deployment Guide

### 1. MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/) and create a free account
2. Create a new cluster (free tier M0)
3. Under **Database Access**, create a database user with read/write permissions
4. Under **Network Access**, add `0.0.0.0/0` to allow connections from anywhere (required for Render)
5. Click **Connect** → **Connect your application** → Copy the connection string
6. Replace `<username>`, `<password>`, and `<dbname>` in the connection string

### 2. Deploy Backend on Render

1. Push your code to GitHub
2. Go to [Render](https://render.com/) and sign in with GitHub
3. Click **New** → **Web Service**
4. Connect your GitHub repository
5. Configure the service:
   - **Name:** `ai-proctored-exam-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. Add **Environment Variables:**
   | Key | Value |
   |-----|-------|
   | `MONGO_URI` | Your MongoDB Atlas connection string |
   | `JWT_SECRET` | A strong random string (32+ chars) |
   | `NODE_ENV` | `production` |
   | `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |
7. Click **Create Web Service**
8. Note the deployed URL (e.g., `https://ai-proctored-exam-backend.onrender.com`)

### 3. Deploy Frontend on Vercel

1. Go to [Vercel](https://vercel.com/) and sign in with GitHub
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Add **Environment Variables:**
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | Your Render backend URL (e.g., `https://ai-proctored-exam-backend.onrender.com`) |
6. Click **Deploy**

### 4. Post-Deployment

After both services are deployed:

1. **Update CORS:** Go to Render → your backend service → Environment Variables → Update `ALLOWED_ORIGINS` with your actual Vercel frontend URL
2. **Verify health:** Visit `https://your-backend.onrender.com/health` — should return `{"status":"ok"}`
3. **Test the app:** Open your Vercel frontend URL and test registration/login

---

## Environment Variables Reference

### Backend (`backend/.env`)
| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URI` | MongoDB connection string | ✅ |
| `JWT_SECRET` | Secret key for JWT tokens | ✅ |
| `NODE_ENV` | `development` or `production` | ✅ |
| `PORT` | Server port (default: 5000) | ❌ |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | ✅ |

### Frontend (`frontend/.env`)
| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API base URL | ✅ |

---

## Security Features

- **Helmet.js** — Sets secure HTTP headers
- **Rate Limiting** — 100 req/15min (API), 20 req/15min (auth)
- **CORS** — Restricted to allowed origins only
- **JWT Authentication** — Token-based auth on all protected routes
- **Role-based Authorization** — Admin/student role separation
- **Input Size Limit** — 10MB max request body

---

## Project Structure

```
├── backend/
│   ├── config/         # Database configuration
│   ├── controllers/    # Route handlers
│   ├── middleware/      # Auth & authorization
│   ├── models/         # Mongoose schemas
│   ├── routes/         # API routes
│   └── server.js       # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/ # Reusable components
│   │   ├── context/    # React context providers
│   │   ├── pages/      # Page components
│   │   └── utils/      # API utilities
│   ├── vercel.json     # Vercel config
│   └── vite.config.js  # Vite config
├── render.yaml         # Render deployment config
└── .gitignore
```
