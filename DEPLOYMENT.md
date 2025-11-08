# Deployment Guide

This guide shows you how to deploy your Inazuma Eleven GeoGuesser multiplayer game online.

## Option 1: Railway (Recommended - Easiest)

**Cost:** Free tier with $5/month credit, then pay-as-you-go (~$5-10/month for small usage)

### Steps:

1. **Create a GitHub repository** (if you haven't already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
   - Go to https://github.com and create a new repository
   - Follow the instructions to push your code

2. **Deploy to Railway**:
   - Go to https://railway.app
   - Sign up with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will automatically detect Node.js and deploy!

3. **Get your URL**:
   - Click on your deployment
   - Go to "Settings" → "Domains"
   - Click "Generate Domain"
   - You'll get a URL like: `yourapp.up.railway.app`

4. **Share with friends!**
   - Give them the URL
   - They can create/join rooms and play

---

## Option 2: Render

**Cost:** Free tier available (with limitations), paid plans from $7/month

### Steps:

1. **Push code to GitHub** (same as Railway step 1)

2. **Deploy to Render**:
   - Go to https://render.com
   - Sign up with GitHub
   - Click "New +" → "Web Service"
   - Connect your repository
   - Settings:
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
   - Click "Create Web Service"

3. **Get your URL**:
   - You'll get a URL like: `yourapp.onrender.com`

**Note:** Free tier sleeps after inactivity (takes ~30s to wake up)

---

## Option 3: Fly.io

**Cost:** Free tier with limits, paid plans from $5/month

### Steps:

1. **Install Fly CLI**:
   ```bash
   # Windows (PowerShell)
   pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

2. **Deploy**:
   ```bash
   fly launch
   # Follow the prompts
   # It will auto-detect your Node.js app

   fly deploy
   ```

3. **Get your URL**:
   - You'll get a URL like: `yourapp.fly.dev`

---

## Option 4: Heroku (Paid Only)

**Cost:** $5-7/month minimum

### Steps:

1. **Install Heroku CLI**:
   - Download from https://devcenter.heroku.com/articles/heroku-cli

2. **Create Procfile** (already done):
   ```
   web: node server.js
   ```

3. **Deploy**:
   ```bash
   heroku login
   heroku create yourapp-name
   git push heroku main
   ```

4. **Get your URL**:
   - `yourapp-name.herokuapp.com`

---

## Option 5: DigitalOcean App Platform

**Cost:** $5/month minimum

### Steps:

1. **Push to GitHub** (same as Railway)

2. **Deploy**:
   - Go to https://cloud.digitalocean.com/apps
   - Click "Create App"
   - Connect GitHub repository
   - DigitalOcean auto-detects settings
   - Deploy!

3. **Get your URL**:
   - You'll get a URL like: `yourapp.ondigitalocean.app`

---

## Quick Comparison

| Platform | Free Tier | Monthly Cost | Best For |
|----------|-----------|--------------|----------|
| **Railway** | $5 credit | ~$5-10 | Easiest setup |
| **Render** | Yes (sleeps) | Free or $7+ | Budget option |
| **Fly.io** | Limited | $5+ | Performance |
| **Heroku** | No | $5-7 | Reliability |
| **DigitalOcean** | No | $5+ | Scaling |

---

## Recommended: Railway

For your use case, **Railway** is the best option:
- Extremely easy setup (just connect GitHub)
- No sleep time (unlike Render free tier)
- Works perfectly with Socket.io
- Affordable (~$5-10/month)
- You get a domain automatically

### Quick Railway Deploy:

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Multiplayer GeoGuesser"
# Create repo on GitHub and push

# 2. Go to railway.app
# 3. Click "Deploy from GitHub"
# 4. Select your repo
# 5. Done! Get your URL from Settings → Domains
```

That's it! Your game will be online and accessible to anyone with the link.
