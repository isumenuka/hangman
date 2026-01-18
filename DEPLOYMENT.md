# 🚀 Deployment Guide: GitHub + Vercel + Render

This guide explains how to deploy the full **Hyper Hangman 3D** application.

- **Frontend (UI)**: Deployed on **Vercel** (Free, fast global CDN).
- **Backend (Signaling)**: Deployed on **Render.com** (Free tier for Node.js services).
- **Codebase**: Hosted on **GitHub**.

---

## Phase 1: GitHub Setup

1.  **Create a Repository**: Go to [GitHub.com/new](https://github.com/new) and give it a name (e.g., `hyper-hangman`).
2.  **Push Code**:
    Run these commands in your project terminal:
    ```bash
    git init
    git add .
    git commit -m "Initial commit of Curse"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/hyper-hangman.git
    git push -u origin main
    ```

---

## Phase 2: Backend (Render.com)

This hosts your own private signaling server so you don't rely on the public PeerJS cloud (which can be slow/limit-rate).

1.  **Log in to Render**: Go to [dashboard.render.com](https://dashboard.render.com).
2.  **New Web Service**: Click **"New +"** -> **"Web Service"**.
3.  **Connect GitHub**: Select your `hyper-hangman` repo.
4.  **Configure Service**:
    - **Name**: `hangman-server`
    - **Root Directory**: `server` (Important! This tells Render to look in the server folder)
    - **Environment**: `Node`
    - **Build Command**: `npm install` (or `yarn`)
    - **Start Command**: `node index.js`
    - **Instance Type**: Free
5.  **Deploy**: Click **Create Web Service**.
6.  **Copy URL**: Once live, copy your backend URL (e.g., `https://hangman-server.onrender.com`). *You will need this for Phase 3.*

---

## Phase 3: Frontend (Vercel)

This hosts the game itself.

1.  **Log in to Vercel**: Go to [vercel.com](https://vercel.com).
2.  **Add New Project**: Import your `hyper-hangman` repo.
3.  **Configure Project**:
    - **Framework Preset**: Vite (Should auto-detect).
    - **Root Directory**: `./` (Default is fine).
4.  **Environment Variables**:
    Expand the "Environment Variables" section and add these:
    
    | Name | Value |
    |------|-------|
    | `VITE_PEER_HOST` | `your-render-url.onrender.com` (remove https://) |
    | `VITE_PEER_PORT` | `443` |
    | `VITE_PEER_PATH` | `/hangman` |
    | `VITE_PEER_SECURE` | `true` |
    | `VITE_MISTRAL_API_KEY`| `YOUR_MISTRAL_API_KEY` (Get from [console.mistral.ai](https://console.mistral.ai)) |

    *Example Host: `hangman-server.onrender.com`*

5.  **Deploy**: Click **Deploy**.

---

## 🎉 Verification

1.  Open your **Vercel domain** (e.g., `hyper-hangman.vercel.app`).
2.  Open the browser console (F12).
3.  Start a game. Look for the log:
    `Using Custom Peer Server: hangman-server.onrender.com`

**You are now fully fully deployed with your own private infrastructure!** 💀
