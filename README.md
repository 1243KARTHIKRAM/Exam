# AI Proctored Exam

This repository contains a full‑stack starter project for an AI proctored exam system.

## Architecture

- **frontend** – React app scaffolded with Vite and styled with Tailwind CSS.
- **backend** – Node.js + Express API with MongoDB (Mongoose).

## Setup

### Frontend

```bash
cd frontend
npm install           # or yarn
npm run dev           # starts Vite development server on http://localhost:3000
```

### Backend

```bash
cd backend
npm install
# copy .env.example to .env and fill in values
npm run dev           # starts nodemon server on http://localhost:5000
```

## API

- `GET /api/test` – simple route returning `{ message: 'API is working' }`.


Feel free to extend with authentication, exam flows, proctoring logic, etc.
