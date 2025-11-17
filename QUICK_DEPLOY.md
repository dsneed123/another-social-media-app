# 🚀 Quick Deploy Guide - relays.social

Get your app live in **5 minutes** with no SSH required!

## Prerequisites

- [ ] GitHub account with your code pushed
- [ ] DigitalOcean account ([Sign up here](https://www.digitalocean.com/))
- [ ] Domain name pointed to DigitalOcean (relays.social)

## Step-by-Step Deploy

### 1. Install doctl CLI (2 minutes)

**macOS:**
```bash
brew install doctl
```

**Linux:**
```bash
cd /tmp
wget https://github.com/digitalocean/doctl/releases/download/v1.98.1/doctl-1.98.1-linux-amd64.tar.gz
tar xf doctl-*.tar.gz
sudo mv doctl /usr/local/bin
```

**Windows:**
Download from [GitHub Releases](https://github.com/digitalocean/doctl/releases)

### 2. Authenticate with DigitalOcean (1 minute)

```bash
# Get API token from: https://cloud.digitalocean.com/account/api/tokens
doctl auth init
# Paste your token when prompted
```

### 3. Create Container Registry (1 minute)

```bash
# Create registry
doctl registry create relays --subscription-tier basic

# Login to registry
doctl registry login
```

### 4. Deploy App (1 minute)

**First, update `.do/app.yaml`:**
- Replace `your-username/another-social-media-app` with your GitHub repo
- Set your GitHub username/organization

**Then deploy:**
```bash
# From project root
doctl apps create --spec .do/app.yaml
```

This will:
- ✅ Create managed PostgreSQL database
- ✅ Set up your app with auto-deploy from GitHub
- ✅ Configure health checks
- ✅ Set up auto-scaling

**Get your App ID:**
```bash
doctl apps list
# Save the ID - you'll need it for GitHub secrets
```

### 5. Set Environment Variables in DigitalOcean (2 minutes)

Go to DigitalOcean Dashboard > App Platform > Your App > Settings > App-Level Environment Variables

Add these:

| Variable | Value | Type |
|----------|-------|------|
| `JWT_SECRET` | Generate with `openssl rand -base64 32` | Secret |
| `REDIS_URL` | `redis://default:password@host:port` | Secret |
| `AWS_ACCESS_KEY_ID` | Your Cloudflare R2 access key | Secret |
| `AWS_SECRET_ACCESS_KEY` | Your Cloudflare R2 secret | Secret |

Click **Save** - this will trigger a redeployment.

### 6. Configure GitHub Secrets (2 minutes)

Go to GitHub: **Your Repo > Settings > Secrets and variables > Actions**

Add these secrets:

| Secret | Value | How to Get |
|--------|-------|------------|
| `DIGITALOCEAN_ACCESS_TOKEN` | Your DO API token | [Create here](https://cloud.digitalocean.com/account/api/tokens) |
| `DIGITALOCEAN_APP_ID` | Your app ID | From `doctl apps list` |
| `ADMIN_TOKEN` | Random string | `openssl rand -base64 32` |

### 7. Configure Domain (2 minutes)

**In DigitalOcean:**
1. Go to App Platform > Your App > Settings > Domains
2. Add `relays.social`
3. Add `www.relays.social`
4. Copy the DNS values shown

**In Your Domain Registrar:**
Add these DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | (from DigitalOcean) | 300 |
| CNAME | www | (from DigitalOcean) | 300 |

Wait 5-30 minutes for DNS propagation.

### 8. Trigger First Deployment

```bash
# Make a small change
echo "# relays.social" >> README.md
git add README.md
git commit -m "Initial deployment"
git push origin main
```

**Watch deployment:**
- GitHub Actions: `https://github.com/your-username/your-repo/actions`
- DigitalOcean: App Platform > Your App > Activity

### 9. Verify Deployment

```bash
# Wait a few minutes, then check
curl https://relays.social/health

# Should return:
# {"status":"healthy","service":"relays.social","timestamp":"..."}
```

**Open in browser:**
https://relays.social

---

## 🎉 You're Live!

Your app is now:
- ✅ Running on DigitalOcean App Platform
- ✅ Auto-deploys on every push to `main`
- ✅ Has SSL certificate (https)
- ✅ Connected to managed PostgreSQL
- ✅ Accessible at relays.social

---

## Common Commands

```bash
# View app status
doctl apps get <APP_ID>

# View logs
doctl apps logs <APP_ID> --type=run --follow

# View deployments
doctl apps list-deployments <APP_ID>

# Trigger manual deployment
doctl apps create-deployment <APP_ID>

# Update app spec
doctl apps update <APP_ID> --spec .do/app.yaml
```

---

## Costs Breakdown

- **App Platform Basic**: $5/month
- **Container Registry**: $5/month (or 500MB free)
- **Managed PostgreSQL**: $15/month (smallest tier)
- **Total**: ~$25/month for fully managed hosting

**No hidden costs, no surprises!**

---

## Next Steps

- [ ] Set up monitoring alerts in DigitalOcean
- [ ] Configure custom error pages
- [ ] Add staging environment
- [ ] Set up database backups
- [ ] Configure email notifications for deployments

---

## Troubleshooting

**Build fails?**
```bash
doctl apps logs <APP_ID> --type=build
```

**App won't start?**
```bash
doctl apps logs <APP_ID> --type=deploy
```

**Health check fails?**
```bash
doctl apps logs <APP_ID> --type=run --follow
```

**Need help?**
Check the full guide: [CI_CD_SETUP.md](./CI_CD_SETUP.md)

---

**Happy deploying! 🚀**
