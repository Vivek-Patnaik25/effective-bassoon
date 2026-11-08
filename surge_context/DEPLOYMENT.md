# 🚀 Production Deployment Guide (Vercel + Render)

This guide walks you through deploying the **Surgical Tool Tracking & Gesture Recognition System** live to the public internet:
* **Backend API & AI Engine:** Deployed on **Render** (FastAPI + WebSocket + SQLite + Ultralytics).
* **Frontend Telemetry UI:** Deployed on **Vercel** (React 18 + Vite SPA).

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │            Vercel (Frontend SPA)             │
                      │       https://your-app.vercel.app            │
                      └──────────────────────┬───────────────────────┘
                                             │ HTTP REST / WSS (WebSocket)
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │          Render Web Service (Backend)        │
                      │     https://your-backend.onrender.com        │
                      │   - FastAPI Server                           │
                      │   - WebSocket Live Broadcast                 │
                      │   - YOLOv8n / Replay Perception              │
                      │   - MediaPipe / Keyboard Debouncers          │
                      │   - SQLite Audit Storage & PDF Generator     │
                      └──────────────────────────────────────────────┘
```

---

## Step 1: Initialize Git and Push to GitHub

1. Open PowerShell in `s:\SEM_7\per_po`:
   ```powershell
   git init
   git add .
   git commit -m "feat: complete surgical tool tracking system ready for deployment"
   ```
2. Create a new repository on your GitHub account (e.g., `surgical-tool-tracker`).
3. Push your repository:
   ```powershell
   git remote add origin https://github.com/<your-username>/surgical-tool-tracker.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 2: Deploy Backend on Render (Free Tier)

1. Sign in to [Render.com](https://render.com) using your GitHub account.
2. Click **New +** → Select **Web Service**.
3. Choose your GitHub repository (`surgical-tool-tracker`).
4. Configure the service settings:
   * **Name:** `surgical-tool-tracking-api`
   * **Region:** *Singapore* or *Oregon* (choose nearest to you)
   * **Branch:** `main`
   * **Root Directory:** *(leave blank)*
   * **Runtime:** `Python 3`
   * **Build Command:**
     ```bash
     pip install --upgrade pip && pip install -r requirements.txt
     ```
   * **Start Command:**
     ```bash
     uvicorn api.main:app --host 0.0.0.0 --port $PORT
     ```
   * **Instance Type:** `Free`
5. Add **Environment Variables** (under *Advanced*):
   | Key | Value | Notes |
   |---|---|---|
   | `PYTHON_VERSION` | `3.10.12` | Ensures clean package builds |
   | `DETECTION_SOURCE` | `replay` | Recommended for cloud (uses sample clip when no physical camera is attached to cloud container) |
   | `DISABLE_HAND_CAMERA` | `1` | Disables secondary camera search in cloud; keyboard shortcuts `P` & `F` handle gestures |
   | `CORS_ORIGINS` | `*` | Or specify your Vercel URL once created |
6. Click **Create Web Service**.
7. Once deployed, copy your Render URL: e.g. `https://surgical-tool-tracking-api.onrender.com`.

---

## Step 3: Deploy Frontend on Vercel

1. Sign in to [Vercel.com](https://vercel.com) using your GitHub account.
2. Click **Add New...** → **Project**.
3. Import your GitHub repository (`surgical-tool-tracker`).
4. Configure Project settings:
   * **Framework Preset:** `Vite`
   * **Root Directory:** Click **Edit** and select **`web`** *(Crucial!)*
   * **Build Command:** `npm run build` *(auto-filled)*
   * **Output Directory:** `dist` *(auto-filled)*
5. Add **Environment Variables**:
   * Name: `VITE_API_URL`
   * Value: `https://your-backend-name.onrender.com` *(Paste your Render URL without trailing slash)*
6. Click **Deploy**.
7. Within ~60 seconds, your site will be live at `https://surgical-tool-tracker.vercel.app`!

---

## Step 4: Verification & Smoke Test

1. Open your live Vercel URL in your browser.
2. Log in using your clinical accounts:
   * **Nurse:** `nurse` / `nurse123`
   * **Administrator:** `admin` / `admin123`
3. Click **"Start Live Session"**:
   * Telemetry HUD will initialize.
   * Tool tracking frames will stream smoothly over WebSocket (`wss://`).
   * Press `P` on your keyboard to test touchless pause/resume.
   * Press `F` to test milestone marking.
4. End session and download the clinical sign-off audit PDF from the cloud!
