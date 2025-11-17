# Step-by-Step Deployment Guide for relays.social

Follow this guide **exactly** to deploy your app to DigitalOcean with **zero SSH required**.

---

## 📋 Before You Start

Make sure you have:
- ✅ GitHub account with your code pushed to a repository
- ✅ Credit card for DigitalOcean (will cost ~$25-30/month)
- ✅ Domain name `relays.social` (purchased from Namecheap, GoDaddy, etc.)

**Time required: 30-45 minutes**

---

## Part 1: DigitalOcean Setup (15 minutes)

### Step 1: Create DigitalOcean Account

1. Go to [DigitalOcean.com](https://www.digitalocean.com/)
2. Click **Sign Up**
3. Use GitHub to sign up (easiest) or email
4. Enter payment details
5. Verify your email

**💡 Tip**: New accounts often get $200 credit for 60 days!

---

### Step 2: Get Your API Token

1. Log into DigitalOcean
2. Click your profile (top right) → **API**
3. Or go directly to: https://cloud.digitalocean.com/account/api/tokens
4. Click **Generate New Token**
5. Name it: `GitHub Actions`
6. Check: **Read & Write** access
7. Click **Generate Token**
8. **IMPORTANT**: Copy the token NOW (you won't see it again!)
9. Save it somewhere safe (you'll need it in Step 7)

**Example token**: `dop_v1_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7`

---

### Step 3: Install doctl CLI

This is DigitalOcean's command-line tool.

**On macOS:**
```bash
brew install doctl
```

**On Linux:**
```bash
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.98.1/doctl-1.98.1-linux-amd64.tar.gz
tar xf doctl-*.tar.gz
sudo mv doctl /usr/local/bin
rm doctl-*.tar.gz
```

**On Windows:**
1. Download from: https://github.com/digitalocean/doctl/releases
2. Extract to `C:\Program Files\doctl\`
3. Add to PATH in System Environment Variables

**Verify installation:**
```bash
doctl version
# Should show: doctl version 1.98.1-release
```

---

### Step 4: Authenticate doctl

```bash
doctl auth init
```

When prompted, paste the API token you got in Step 2.

**Verify authentication:**
```bash
doctl account get
# Should show your DigitalOcean account info
```

---

### Step 5: Create Container Registry

This is where Docker images will be stored.

```bash
doctl registry create relays --subscription-tier basic
```

**Output:**
```
Name     Endpoint
relays   registry.digitalocean.com/relays
```

**Login to registry:**
```bash
doctl registry login
```

**Cost**: $5/month (or 500MB free tier)

---

### Step 6: Update App Configuration

Open the file `.do/app.yaml` in your project and update line 21:

**Change this:**
```yaml
repo: your-username/another-social-media-app
```

**To your actual GitHub repo:**
```yaml
repo: dsneedy/another-social-media-app
```

**Save the file.**

---

### Step 7: Deploy to App Platform

From your project root directory:

```bash
doctl apps create --spec .do/app.yaml
```

**This will:**
- ✅ Create a new app
- ✅ Set up managed PostgreSQL database
- ✅ Connect to your GitHub repo
- ✅ Configure auto-deploy on push

**Output:**
```
ID                                      Spec Name          Default Ingress  Active Deployment ID  In Progress Deployment ID  Created At           Updated At
a1b2c3d4-e5f6-7890-ab12-cd34ef567890   relays-social      example.ondigitalocean.app    <none>                    <pending>                  2024-01-15 10:30:00  2024-01-15 10:30:00
```

**SAVE THE APP ID!** (first column) - You'll need it next.

**Get your App ID:**
```bash
doctl apps list
```

Copy the ID from the first column.

---

### Step 8: Set Environment Variables in DigitalOcean

1. Go to: https://cloud.digitalocean.com/apps
2. Click on your app **relays-social**
3. Go to **Settings** tab
4. Scroll to **App-Level Environment Variables**
5. Click **Edit**
6. Add these variables by clicking **Add Variable**:

| Variable Name | Value | Type |
|--------------|-------|------|
| `JWT_SECRET` | (generate below) | Encrypted |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Encrypted |
| `AWS_ACCESS_KEY_ID` | `ad0923467f154d88fa88804fa08de476` | Encrypted |
| `AWS_SECRET_ACCESS_KEY` | `8ff0b1f9420c07e8f680b864f9483a2c48660a991a16712cb3a948354492d3ff` | Encrypted |

**Generate JWT_SECRET:**
```bash
openssl rand -base64 32
```

Copy the output and use it as `JWT_SECRET`.

7. Click **Save**

**This will trigger a redeployment.** Wait 5-10 minutes for it to complete.

---

### Step 9: Monitor First Deployment

While it's deploying:

1. Go to **Activity** tab in your app
2. Watch the deployment progress
3. You'll see:
   - Building... (~5 minutes)
   - Deploying... (~2 minutes)
   - Running migrations... (~30 seconds)
   - Health checks... (~30 seconds)

**Wait for "Deployed successfully" message.**

---

## Part 2: GitHub Setup (10 minutes)

### Step 10: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** (top menu)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret**

Add these 3 secrets one by one:

**Secret 1:**
- Name: `DIGITALOCEAN_ACCESS_TOKEN`
- Value: (Your API token from Step 2)
- Click **Add secret**

**Secret 2:**
- Name: `DIGITALOCEAN_APP_ID`
- Value: (Your App ID from Step 7)
- Click **Add secret**

**Secret 3:**
- Name: `ADMIN_TOKEN`
- Value: Generate with `openssl rand -base64 32`
- Click **Add secret**

**Verify all 3 secrets are added:**
You should see:
- ✅ DIGITALOCEAN_ACCESS_TOKEN
- ✅ DIGITALOCEAN_APP_ID
- ✅ ADMIN_TOKEN

---

### Step 11: Test Automated Deployment

Now let's test that pushing to `main` triggers auto-deployment.

**Make a small change:**
```bash
cd /home/dsneedy/Desktop/code/app_dev/another-social-media-app

# Add a comment to README
echo "" >> README.md
echo "# Deployed to relays.social 🚀" >> README.md

# Commit and push
git add README.md
git commit -m "Test automated deployment"
git push origin main
```

**Watch the deployment:**

1. **GitHub Actions**:
   - Go to your repo
   - Click **Actions** tab
   - You should see a new workflow running
   - Click on it to see live logs

2. **DigitalOcean**:
   - Go to your app
   - Click **Activity** tab
   - Watch the deployment progress

**This should take ~7-10 minutes.**

**Success looks like:**
```
✅ Build image
✅ Push to registry
✅ Deploy to App Platform
✅ Run migrations
✅ Health check passed
```

---

## Part 3: Domain Setup (10 minutes)

### Step 12: Add Domain in DigitalOcean

1. Go to your app in DigitalOcean
2. Click **Settings** tab
3. Scroll to **Domains**
4. Click **Add Domain**
5. Enter: `relays.social`
6. Click **Add Domain**
7. Click **Add Domain** again
8. Enter: `www.relays.social`
9. Choose: **Redirect to** `relays.social`
10. Click **Add Domain**

**You'll see DNS instructions like:**
```
Add these records to your domain:

CNAME record:
Name: @
Value: your-app.ondigitalocean.app
TTL: 300

CNAME record:
Name: www
Value: your-app.ondigitalocean.app
TTL: 300
```

**Copy these values** - you'll need them in the next step.

---

### Step 13: Configure DNS at Your Domain Registrar

Go to where you bought your domain (Namecheap, GoDaddy, etc.).

**For Namecheap:**
1. Log in to Namecheap
2. Go to **Domain List**
3. Click **Manage** next to relays.social
4. Go to **Advanced DNS** tab
5. Click **Add New Record**

**Add these records:**

**Record 1:**
- Type: `CNAME Record`
- Host: `@`
- Value: (the value from DigitalOcean, e.g., `your-app.ondigitalocean.app`)
- TTL: `Automatic`

**Record 2:**
- Type: `CNAME Record`
- Host: `www`
- Value: (the value from DigitalOcean, e.g., `your-app.ondigitalocean.app`)
- TTL: `Automatic`

6. Click **Save All Changes**

**For other registrars**, the process is similar - look for DNS settings.

---

### Step 14: Wait for DNS Propagation

DNS changes take time to spread worldwide.

**Check propagation:**
```bash
# Check if DNS is working
dig relays.social

# Should eventually show the DigitalOcean values
```

**Or use online tool:**
https://www.whatsmydns.net/#CNAME/relays.social

**Wait 5-30 minutes.** Get a coffee! ☕

---

### Step 15: Enable SSL Certificate

Once DNS propagates, DigitalOcean will automatically:
- ✅ Request SSL certificate from Let's Encrypt
- ✅ Install it on your domain
- ✅ Enable HTTPS

**Check in DigitalOcean:**
1. Go to your app → **Settings** → **Domains**
2. You should see a **green checkmark** next to your domains
3. SSL status should be **Active**

**This takes 5-10 minutes after DNS propagates.**

---

## Part 4: Verification (5 minutes)

### Step 16: Test Your Deployment

**Test health endpoint:**
```bash
curl https://relays.social/health
```

**Should return:**
```json
{
  "status": "healthy",
  "service": "relays.social",
  "timestamp": "2024-01-15T10:45:00Z"
}
```

**Open in browser:**
1. Go to: https://relays.social
2. You should see your login page
3. Create an account
4. Test sending a message

---

### Step 17: Verify Auto-Deploy Works

Let's make sure future pushes deploy automatically.

**Make a change:**
```bash
# Edit any file
echo "/* Test comment */" >> frontend/start.html

git add .
git commit -m "Test auto-deploy"
git push origin main
```

**Watch it deploy:**
- GitHub Actions tab - see the workflow run
- DigitalOcean Activity tab - see new deployment

**Should take ~7-10 minutes and go live automatically.**

---

## 🎉 You're Done!

Your app is now:
- ✅ Live at **https://relays.social**
- ✅ Auto-deploys on every push to `main`
- ✅ Has SSL certificate (HTTPS)
- ✅ Running on managed infrastructure
- ✅ Connected to PostgreSQL database
- ✅ Storing media on Cloudflare R2

---

## 📊 What You've Set Up

| Component | What It Does | Cost |
|-----------|-------------|------|
| **App Platform** | Runs your backend | $5/month |
| **Container Registry** | Stores Docker images | $5/month |
| **PostgreSQL** | Database | $15/month |
| **SSL Certificate** | HTTPS security | Free |
| **GitHub Actions** | CI/CD pipeline | Free |
| **Total** |  | **~$25/month** |

---

## 🔄 Daily Workflow

From now on, deploying is simple:

```bash
# Make changes to your code
git add .
git commit -m "Add new feature"
git push origin main

# That's it! It deploys automatically.
```

**No SSH, no server management, no hassle!**

---

## 📱 Useful Commands

**View app status:**
```bash
doctl apps get <YOUR_APP_ID>
```

**View live logs:**
```bash
doctl apps logs <YOUR_APP_ID> --type=run --follow
```

**List deployments:**
```bash
doctl apps list-deployments <YOUR_APP_ID>
```

**Trigger manual deployment:**
```bash
doctl apps create-deployment <YOUR_APP_ID>
```

**View build logs:**
```bash
doctl apps logs <YOUR_APP_ID> --type=build
```

---

## 🆘 Troubleshooting

**Deployment failed?**
```bash
# Check GitHub Actions logs
# Go to: Your Repo → Actions → Click on failed run

# Check DigitalOcean logs
doctl apps logs <YOUR_APP_ID> --type=build
doctl apps logs <YOUR_APP_ID> --type=deploy
```

**Domain not working?**
1. Wait longer (DNS can take up to 1 hour)
2. Check DNS with: `dig relays.social`
3. Verify records in your domain registrar
4. Check DigitalOcean domain settings

**SSL not working?**
1. Wait for DNS to fully propagate
2. Check DigitalOcean → Settings → Domains
3. SSL certificates auto-renew every 60 days

**Health check failing?**
```bash
# Check app logs
doctl apps logs <YOUR_APP_ID> --type=run --follow

# Common issues:
# - Database not connected (check DATABASE_URL)
# - Missing environment variables
# - Port mismatch (should be 3000)
```

---

## 📚 Next Steps

Now that you're deployed:

- [ ] Set up monitoring alerts in DigitalOcean
- [ ] Configure email notifications for deployments
- [ ] Add custom error pages
- [ ] Set up database backups (automatic in DO)
- [ ] Consider adding a staging environment
- [ ] Add tests to GitHub Actions workflow
- [ ] Set up error tracking (Sentry, etc.)

---

## 🎯 Key Takeaways

✅ **No SSH required** - Everything through web UI and CLI
✅ **Auto-deploy** - Push code, it goes live automatically
✅ **Managed services** - No server maintenance
✅ **Cost-effective** - $25/month for full stack
✅ **Scalable** - Upgrade resources as you grow
✅ **Secure** - Free SSL, automatic updates

**You're now a DevOps engineer! 🚀**

---

Need help? Check:
- [CI_CD_SETUP.md](./CI_CD_SETUP.md) - Detailed CI/CD guide
- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) - Quick reference
- [DigitalOcean Docs](https://docs.digitalocean.com/products/app-platform/)
