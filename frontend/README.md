# Namma Fix Grievance Frontend

React + Vite frontend for the FastAPI backend.

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

The frontend calls `/api` during development. Vite proxies `/api` to `http://127.0.0.1:8001`, so keep the FastAPI backend running on port `8001`.

JWTs are stored in `localStorage` using the key `bbmp_token`.
