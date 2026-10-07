# SuperGold ERP — Complete React + Node Project

This is the runnable project for the existing SuperGold ERP.

## Run on Windows / macOS / Linux

Requirements:
- Node.js 18+ (Node 20 LTS recommended)
- MongoDB Atlas or local MongoDB

### 1. Configure backend

Copy `backend/.env.example` to `backend/.env` and put your MongoDB connection string there.

For the existing Atlas database, the database name must remain:

`wholesale_erp`

Do not commit `backend/.env`.

### 2. Install everything

From the project root:

```bash
npm install
```

### 3. Start frontend + backend together

```bash
npm run dev
```

Frontend:
`http://localhost:5173`

Backend:
`http://localhost:5000`

### 4. Production frontend build

```bash
npm run build
```

## Important

The ERP UI code in `frontend/src/App.jsx` is kept intact. The project files around it provide the normal React/Vite entry point, Tailwind processing, dependencies, and backend workspace so the project can be run directly.

Existing API routes, MongoDB model names, login/access-control behavior, and the 30-minute inactivity session behavior are preserved.
