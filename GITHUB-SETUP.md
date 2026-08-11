# 🔧 GitHub Setup - Step-by-Step Troubleshooting

Having trouble connecting to GitHub? Follow these steps carefully.

---

## Step 1: Check Git Installation

Open PowerShell and run:
```powershell
git --version
```

**Expected output:** `git version 2.x.x`

**If you get an error:**
- Download Git from: https://git-scm.com/download/win
- Install with default options
- Restart PowerShell
- Try again

---

## Step 2: Configure Git (First Time Setup)

Run these commands in PowerShell (replace with your info):

```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**Example:**
```powershell
git config --global user.name "John Doe"
git config --global user.email "john.doe@gmail.com"
```

**Verify it worked:**
```powershell
git config --global user.name
git config --global user.email
```

---

## Step 3: Create GitHub Repository

### Option A: Create via Website (Easiest)

1. **Go to GitHub:** https://github.com/new

2. **Fill in repository details:**
   - Repository name: `weather-dashboard`
   - Description: `Live weather dashboard for Tallapoosa County, AL`
   - Visibility: **Public** (so you can share it)
   - **DO NOT check** "Add a README file"
   - **DO NOT check** "Add .gitignore"
   - **DO NOT check** "Choose a license"

3. **Click "Create repository"**

4. **You'll see a page with setup instructions** - we'll use these in the next step

---

## Step 4: Connect Your Local Repository to GitHub

### First, navigate to your project:

```powershell
cd C:\Users\212434506\weather-dashboard
```

### Check current status:

```powershell
git status
```

**Expected output:** Should show you're on branch "master" or "main"

### If you see "On branch master", rename it to main:

```powershell
git branch -M main
```

### Now connect to GitHub:

**IMPORTANT:** Replace `YOUR_USERNAME` with your actual GitHub username!

```powershell
git remote add origin https://github.com/YOUR_USERNAME/weather-dashboard.git
```

**Example (if your username is "johndoe"):**
```powershell
git remote add origin https://github.com/johndoe/weather-dashboard.git
```

### Verify it worked:

```powershell
git remote -v
```

**Expected output:**
```
origin  https://github.com/YOUR_USERNAME/weather-dashboard.git (fetch)
origin  https://github.com/YOUR_USERNAME/weather-dashboard.git (push)
```

---

## Step 5: Push to GitHub (This is where authentication happens)

```powershell
git push -u origin main
```

### 🔐 Authentication Methods

When you run `git push`, you'll need to authenticate. GitHub has TWO options:

---

### **Option A: Personal Access Token (Recommended)**

If you see a login prompt or get an authentication error:

#### 1. Create a Personal Access Token:

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Name it: `Weather Dashboard Deployment`
4. Set expiration: **90 days** (or longer)
5. Select scopes:
   - ✅ Check **`repo`** (this selects all sub-options)
   - This gives access to your repositories
6. Scroll down and click **"Generate token"**
7. **COPY THE TOKEN NOW** - you can't see it again!
   - It looks like: `ghp_1234567890abcdefghijklmnopqrstuvwxyz`

#### 2. Use the token when pushing:

When you run `git push -u origin main`, it will ask for credentials:

```
Username for 'https://github.com': YOUR_USERNAME
Password for 'https://YOUR_USERNAME@github.com': [PASTE TOKEN HERE]
```

**IMPORTANT:** 
- Username = your GitHub username
- Password = **PASTE THE TOKEN** (not your GitHub password!)

#### 3. Save credentials (so you don't need to enter token every time):

After successful push, run:
```powershell
git config --global credential.helper wincred
```

Now Git will remember your token.

---

### **Option B: SSH Keys (Alternative - More Secure)**

If you prefer SSH authentication:

#### 1. Check if you have SSH keys:

```powershell
ls ~/.ssh
```

If you see `id_rsa.pub` or `id_ed25519.pub`, you already have a key. Skip to step 3.

#### 2. Generate SSH key:

```powershell
ssh-keygen -t ed25519 -C "your.email@example.com"
```

Press Enter 3 times (accept defaults, no passphrase needed for simplicity).

#### 3. Copy your public key:

```powershell
cat ~/.ssh/id_ed25519.pub
```

Copy the entire output (starts with `ssh-ed25519`).

#### 4. Add to GitHub:

1. Go to: https://github.com/settings/keys
2. Click **"New SSH key"**
3. Title: `Weather Dashboard PC`
4. Key: Paste the key you copied
5. Click **"Add SSH key"**

#### 5. Test connection:

```powershell
ssh -T git@github.com
```

Expected output: `Hi YOUR_USERNAME! You've successfully authenticated...`

#### 6. Change remote URL to SSH:

```powershell
git remote set-url origin git@github.com:YOUR_USERNAME/weather-dashboard.git
```

#### 7. Now push:

```powershell
git push -u origin main
```

---

## Common Errors & Solutions

### Error: "remote origin already exists"

**Solution:**
```powershell
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/weather-dashboard.git
```

---

### Error: "failed to push some refs"

**Cause:** GitHub repo might have files that don't exist locally.

**Solution:**
```powershell
git pull origin main --allow-unrelated-histories
git push -u origin main
```

---

### Error: "Support for password authentication was removed"

**Cause:** GitHub no longer accepts passwords via HTTPS.

**Solution:** You MUST use a Personal Access Token (see Option A above) or SSH keys (see Option B above).

---

### Error: "Permission denied (publickey)"

**Cause:** SSH key not set up correctly.

**Solution:** Use HTTPS with Personal Access Token instead (Option A above), or follow SSH setup more carefully.

---

### Error: "repository not found"

**Causes:**
1. Username is wrong in the URL
2. Repository name is wrong
3. Repository doesn't exist yet

**Solution:**
```powershell
# Check your current remote
git remote -v

# If wrong, remove and re-add with correct URL
git remote remove origin
git remote add origin https://github.com/CORRECT_USERNAME/weather-dashboard.git
```

---

### Error: "fatal: not a git repository"

**Cause:** You're not in the right directory.

**Solution:**
```powershell
cd C:\Users\212434506\weather-dashboard
git status
# Should show "On branch main" or similar
```

---

## Step 6: Verify Upload

After successful push:

1. Go to: `https://github.com/YOUR_USERNAME/weather-dashboard`
2. You should see all your files!
3. Check that these files are present:
   - ✅ server.js
   - ✅ package.json
   - ✅ Dockerfile
   - ✅ public/ folder
   - ✅ README.md
   - ✅ DEPLOYMENT.md

4. **IMPORTANT:** Check that `.env` is **NOT** there (it should be hidden by .gitignore)

---

## Complete Command Reference

Here's the complete sequence of commands (run in order):

```powershell
# 1. Navigate to your project
cd C:\Users\212434506\weather-dashboard

# 2. Check git status
git status

# 3. Make sure you're on main branch
git branch -M main

# 4. Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/weather-dashboard.git

# 5. Verify remote
git remote -v

# 6. Push to GitHub (will ask for username + token)
git push -u origin main

# 7. Save credentials for future
git config --global credential.helper wincred
```

---

## Alternative: Use GitHub Desktop (Easiest!)

If command line is too confusing:

1. **Download GitHub Desktop:** https://desktop.github.com/
2. **Install and sign in** with your GitHub account
3. **Add existing repository:**
   - File → Add Local Repository
   - Choose: `C:\Users\212434506\weather-dashboard`
4. **Publish repository:**
   - Click "Publish repository" button
   - Name: `weather-dashboard`
   - Make sure "Keep this code private" is **UNCHECKED**
   - Click "Publish Repository"
5. **Done!** Your code is now on GitHub

---

## Next Steps

Once your code is on GitHub:

1. ✅ Verify files are uploaded: https://github.com/YOUR_USERNAME/weather-dashboard
2. ✅ Continue with deployment: Open QUICKSTART.md at "Step 3: Deploy on Render"
3. ✅ Your GitHub URL is: `https://github.com/YOUR_USERNAME/weather-dashboard`

---

## Still Having Issues?

### Quick Diagnostic:

Run these commands and share the output:

```powershell
# 1. Check git version
git --version

# 2. Check git config
git config --global user.name
git config --global user.email

# 3. Check current directory
pwd

# 4. Check git status
git status

# 5. Check remote
git remote -v
```

### Get Help:

1. **GitHub Docs:** https://docs.github.com/en/get-started/quickstart/set-up-git
2. **Git Authentication:** https://docs.github.com/en/authentication
3. **GitHub Desktop:** https://docs.github.com/en/desktop

---

## Summary

**Recommended approach for beginners:**

1. ✅ Use **Personal Access Token** (not password)
2. ✅ Or use **GitHub Desktop** (easiest, no command line)

**For the command line approach:**
- Generate token at: https://github.com/settings/tokens
- Username = your GitHub username
- Password = **paste token** (not your actual password)
- Save credentials with: `git config --global credential.helper wincred`

You've got this! 🚀
