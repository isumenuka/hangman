---
description: Deploy Hangman to GitHub + Render.com + Vercel
---

# 🚀 Deployment Guide: Hyper Hangman 3D

This guide covers deploying the Hangman multiplayer game using GitHub for version control, Render.com for the backend server, and Vercel for the frontend client.

## Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   GitHub    │─────▶│  Render.com  │◀────▶│   Vercel    │
│ (Repository)│      │   (Server)   │      │  (Client)   │
└─────────────┘      └──────────────┘      └─────────────┘
      │                     │                      │
      │                     │                      │
      └─────────────────────┴──────────────────────┘
              Automated deployments via Git Push
```

- **GitHub**: Source code repository & version control
- **Render.com**: Hosts the Socket.IO server (backend)
- **Vercel**: Hosts the React/Vite frontend (client)
- **Supabase**: Database & authentication (already set up)

---

## Part 1: GitHub Setup

### 1.1 Initialize Repository (if not done)

```bash
cd c:\Users\Isum Enuka\Downloads\hangman
git init
git add .
git commit -m "Initial commit: Hyper Hangman 3D"
```

### 1.2 Create GitHub Repository

1. Go to [GitHub](https://github.com) and log in
2. Click the **"+"** icon → **"New repository"**
3. Set repository name: `hyper-hangman-cursed` (or your preferred name)
4. Choose **Public** or **Private**
5. **Do NOT** initialize with README (you already have one)
6. Click **"Create repository"**

### 1.3 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/hyper-hangman-cursed.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### 1.4 Update .gitignore

Ensure your `.gitignore` includes:
```
node_modules/
dist/
.env
.env.local
server/node_modules/
```

> **⚠️ CRITICAL**: Never commit `.env` files with API keys!

---

## Part 2: Render.com - Backend Server Deployment

The server handles Socket.IO connections for multiplayer functionality.

### 2.1 Prepare Server for Deployment

**Check `server/index.js` configuration:**

Your server should have:
```javascript
const port = process.env.PORT || 3001;

// CORS configuration for Render + Vercel
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://your-app.vercel.app", // Update after Vercel deployment
    ],
    methods: ["GET", "POST"]
  }
});
```

### 2.2 Create Render Account & Deploy

1. **Sign up at [Render.com](https://render.com)** (use GitHub to sign in)

2. **Create New Web Service**:
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository
   - Select the `hyper-hangman-cursed` repository

3. **Configure the service**:
   - **Name**: `hangman-server` (or your choice)
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (or choose paid for better performance)

4. **Environment Variables** (optional):
   - Click **"Advanced"** → **"Add Environment Variable"**
   - Add any required variables (e.g., `NODE_ENV=production`)

5. **Click "Create Web Service"**

6. **Wait for deployment** (usually 2-5 minutes)

7. **Copy the URL**: You'll get something like:
   ```
   https://hangman-server-xxxx.onrender.com
   ```

### 2.3 Important Notes for Render

- **Free tier**: Server spins down after 15 minutes of inactivity (cold starts take ~30s)
- **WebSocket support**: Render supports Socket.IO out of the box
- **Logs**: Check the "Logs" tab for debugging

---

## Part 3: Vercel - Frontend Client Deployment

### 3.1 Prepare Frontend for Deployment

**Update Socket.IO connection URL** in your client:

Find where you initialize the Socket.IO client (likely in `services/socketService.ts` or similar):

```typescript
// BEFORE (Development)
const SOCKET_URL = 'http://localhost:3001';

// AFTER (Production)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
```

### 3.2 Create Environment Variables File

Create `.env.example` (safe to commit):
```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Gemini API
VITE_GEMINI_API_KEY=your_gemini_api_key

# Socket.IO Server (update after Render deployment)
VITE_SOCKET_URL=https://hangman-server-xxxx.onrender.com
```

### 3.3 Deploy to Vercel

**Option A: Vercel CLI (Recommended)**

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from project root
cd c:\Users\Isum Enuka\Downloads\hangman
vercel
```

Follow the prompts:
- **Set up and deploy?** → `Y`
- **Which scope?** → Select your account
- **Link to existing project?** → `N`
- **Project name?** → `hyper-hangman-cursed`
- **Directory?** → `./` (current directory)
- **Override settings?** → `N`

**Option B: Vercel Dashboard**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. **Import Git Repository**: Select your GitHub repo
4. **Configure Project**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `./` (leave empty)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Environment Variables**: Add all from `.env`:
   - Click **"Environment Variables"**
   - Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`, `VITE_SOCKET_URL`
6. Click **"Deploy"**

### 3.4 Get Your Vercel URL

After deployment completes, you'll receive:
```
https://hyper-hangman-cursed.vercel.app
```

---

## Part 4: Connect Everything Together

### 4.1 Update CORS on Render Server

1. Go back to Render.com dashboard
2. Open your `hangman-server` web service
3. Click **"Environment"** tab
4. Add environment variable:
   - **Key**: `ALLOWED_ORIGINS`
   - **Value**: `https://hyper-hangman-cursed.vercel.app`

**Or update `server/index.js` directly** and push changes:
```javascript
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://hyper-hangman-cursed.vercel.app", // ✅ Add your Vercel URL
    ],
    methods: ["GET", "POST"]
  }
});
```

Then commit and push:
```bash
git add server/index.js
git commit -m "Update CORS for Vercel deployment"
git push origin main
```

Render will automatically redeploy!

### 4.2 Update Socket URL in Vercel

1. Go to Vercel Dashboard → Your Project → **"Settings"** → **"Environment Variables"**
2. Update `VITE_SOCKET_URL` to your Render URL:
   ```
   https://hangman-server-xxxx.onrender.com
   ```
3. Click **"Save"**
4. Redeploy from **"Deployments"** tab → Click **"..."** → **"Redeploy"**

---

## Part 5: Testing & Verification

### 5.1 Test Checklist

- [ ] Visit your Vercel URL: `https://hyper-hangman-cursed.vercel.app`
- [ ] Game loads without errors (check browser console: F12)
- [ ] Create a lobby (tests Socket.IO connection)
- [ ] Join lobby from another device/browser
- [ ] Test multiplayer functionality:
  - [ ] Letter guesses sync between players
  - [ ] Curse powers work
  - [ ] Chat messages appear
  - [ ] Game state updates correctly
- [ ] Check Render logs for WebSocket connections

### 5.2 Debugging Common Issues

**Issue**: "Socket.IO connection failed"
- Check CORS settings in `server/index.js`
- Verify `VITE_SOCKET_URL` in Vercel env vars
- Check Render server logs for errors

**Issue**: "Cannot read properties of undefined"
- Ensure all environment variables are set in Vercel
- Check Supabase connection (URL and anon key)

**Issue**: Render server is slow/timing out
- Free tier spins down after inactivity
- Consider upgrading to paid tier or using a keep-alive service

---

## Part 6: Continuous Deployment Workflow

### 6.1 Automated Deployments

Both Render and Vercel automatically deploy when you push to GitHub:

```bash
# Make changes to your code
git add .
git commit -m "Your commit message"
git push origin main

# ✅ Render automatically redeploys server
# ✅ Vercel automatically redeploys client
```

### 6.2 Branch-Based Deployments (Optional)

**Production**: `main` branch
**Staging**: `staging` branch

Configure in Vercel:
1. Settings → Git → Production Branch → `main`
2. Every branch push creates a preview deployment

---

## Part 7: Custom Domain (Optional)

### 7.1 Add Custom Domain to Vercel

1. Vercel Dashboard → Your Project → **"Settings"** → **"Domains"**
2. Add your domain (e.g., `hangman.yourdomain.com`)
3. Update DNS records as instructed by Vercel
4. Vercel automatically provisions SSL certificate

### 7.2 Add Custom Domain to Render

1. Render Dashboard → Your Service → **"Settings"** → **"Custom Domain"**
2. Add subdomain (e.g., `api.yourdomain.com`)
3. Update DNS CNAME record
4. Update CORS in server to allow new domain

---

## 📋 Quick Reference Commands

```bash
# GitHub
git add .
git commit -m "message"
git push origin main

# Vercel CLI
vercel                    # Deploy to preview
vercel --prod            # Deploy to production
vercel logs              # View logs
vercel env ls            # List env variables

# Check Render Logs
# Visit: https://dashboard.render.com → Your Service → Logs
```

---

## 🔒 Security Best Practices

1. **Never commit `.env` files** - use `.gitignore`
2. **Use environment variables** for all API keys
3. **Keep Supabase RLS enabled** - protect your database
4. **Update CORS regularly** - only allow trusted domains
5. **Monitor Render logs** for suspicious activity
6. **Use HTTPS only** - both platforms provide SSL by default

---

## 🆘 Support Resources

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Socket.IO Docs**: https://socket.io/docs/v4/
- **Vite Deployment**: https://vitejs.dev/guide/static-deploy.html

---

**🎉 Congratulations!** Your Hyper Hangman 3D game is now live!

Share your URL: `https://hyper-hangman-cursed.vercel.app` 🚀
