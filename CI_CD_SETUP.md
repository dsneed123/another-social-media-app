# CI/CD Pipeline Setup for relays.social

This guide shows you how to set up automated deployments to DigitalOcean **without SSH** using GitHub Actions and DigitalOcean App Platform.

## 🚀 Quick Overview

Every time you push to the `main` branch, GitHub Actions will automatically:
1. Build your Rust backend into a Docker image
2. Push it to DigitalOcean Container Registry
3. Deploy to DigitalOcean App Platform
4. Run database migrations
5. Verify the deployment is healthy

**No SSH required! Everything happens automatically.**

---

## Option 1: DigitalOcean App Platform (Recommended - Easiest)

App Platform is like Heroku - fully managed, no servers to maintain.

### Step 1: Create a DigitalOcean Account

1. Go to [DigitalOcean](https://www.digitalocean.com/)
2. Sign up for an account
3. Add a payment method

### Step 2: Create Container Registry

1. Go to **Container Registry** in DigitalOcean dashboard
2. Click **Create**
3. Choose a plan (Basic $5/month is fine to start)
4. Name it: `relays`
5. Click **Create Container Registry**

### Step 3: Deploy App Platform

**Method A: Using the UI**

1. Go to **App Platform** in DigitalOcean
2. Click **Create App**
3. Choose **GitHub** as source
4. Authorize DigitalOcean to access your GitHub
5. Select your repository
6. Choose branch: `main`
7. DigitalOcean will auto-detect the app spec in `.do/app.yaml`
8. Review the detected configuration
9. Click through the setup
10. In the **Environment Variables** section, add these secrets:
    - `JWT_SECRET` - A random secure string (generate with `openssl rand -base64 32`)
    - `REDIS_URL` - Your Redis URL (or use DigitalOcean managed Redis)
    - `AWS_ACCESS_KEY_ID` - Your Cloudflare R2 key
    - `AWS_SECRET_ACCESS_KEY` - Your Cloudflare R2 secret
11. Add a managed PostgreSQL database (auto-configured in app.yaml)
12. Add your domain: `relays.social`
13. Click **Create Resources**

**Method B: Using doctl CLI**

```bash
# Install doctl
brew install doctl  # macOS
# or
wget https://github.com/digitalocean/doctl/releases/download/v1.98.1/doctl-1.98.1-linux-amd64.tar.gz
tar xf doctl-*.tar.gz
sudo mv doctl /usr/local/bin

# Authenticate
doctl auth init

# Create app from spec
doctl apps create --spec .do/app.yaml

# Get app ID
doctl apps list
```

### Step 4: Configure GitHub Secrets

1. Go to your GitHub repository
2. Go to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** and add these:

| Secret Name | Value | How to Get It |
|------------|-------|---------------|
| `DIGITALOCEAN_ACCESS_TOKEN` | Your DO API token | [Generate here](https://cloud.digitalocean.com/account/api/tokens) |
| `DIGITALOCEAN_APP_ID` | Your App Platform app ID | Run `doctl apps list` or check URL in DO dashboard |
| `ADMIN_TOKEN` | Random secure string | Generate with `openssl rand -base64 32` |

#### Getting DIGITALOCEAN_ACCESS_TOKEN:
1. Go to [API Tokens](https://cloud.digitalocean.com/account/api/tokens)
2. Click **Generate New Token**
3. Name: `GitHub Actions`
4. Scopes: **Read & Write**
5. Copy the token (you won't see it again!)
6. Add to GitHub secrets

#### Getting DIGITALOCEAN_APP_ID:
```bash
doctl apps list
# Copy the ID from the output
```
Or check the DigitalOcean dashboard URL: `https://cloud.digitalocean.com/apps/{APP_ID}`

### Step 5: Configure Your Domain

1. Go to your domain registrar (Namecheap, GoDaddy, etc.)
2. Add these DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | (provided by DigitalOcean) | 300 |
| CNAME | www | (provided by DigitalOcean) | 300 |

DigitalOcean will show you the exact values in the App Platform dashboard under **Settings** > **Domains**.

### Step 6: Test the Pipeline

```bash
# Make a change to your code
git add .
git commit -m "Test CI/CD pipeline"
git push origin main

# Watch the deployment in GitHub Actions
# Go to your repo > Actions tab
```

The deployment will:
- ✅ Build Docker image (~2-5 minutes)
- ✅ Push to Container Registry
- ✅ Deploy to App Platform
- ✅ Run migrations
- ✅ Health check

### Step 7: Access Your App

Once deployed, your app will be available at:
- `https://relays.social`
- `https://www.relays.social`

---

## Option 2: Deploy to Droplet with GitHub Actions

If you prefer a traditional VPS instead of App Platform:

<details>
<summary>Click to expand Droplet deployment instructions</summary>

### Create Alternative Workflow

Create `.github/workflows/deploy-droplet.yml`:

```yaml
name: Deploy to Droplet

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Droplet
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DROPLET_IP }}
          username: relay
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/relay/another-social-media-app
            git pull origin main
            cd backend
            cargo build --release
            sudo systemctl restart relays
```

### Required Secrets:
- `DROPLET_IP` - Your droplet's IP address
- `SSH_PRIVATE_KEY` - SSH private key for authentication

</details>

---

## 📊 Monitoring Your Deployments

### GitHub Actions
- Go to **Actions** tab in your GitHub repo
- See all deployment runs
- View logs for each step
- Get notified on failures

### DigitalOcean Dashboard
- Go to **App Platform** > Your App
- See deployment history
- View logs in real-time
- Monitor resource usage
- Set up alerts

### DigitalOcean CLI
```bash
# View app info
doctl apps get <APP_ID>

# View recent deployments
doctl apps list-deployments <APP_ID>

# View logs
doctl apps logs <APP_ID> --type=run

# Trigger manual deployment
doctl apps create-deployment <APP_ID>
```

---

## 🔧 Customization

### Change Deployment Trigger

Edit `.github/workflows/deploy.yml`:

```yaml
# Deploy only on tags
on:
  push:
    tags:
      - 'v*'

# Deploy on pull request merge
on:
  pull_request:
    types: [closed]
    branches: [ main ]
```

### Add Tests Before Deployment

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: |
          cd backend
          cargo test

  deploy:
    needs: test  # Only deploy if tests pass
    runs-on: ubuntu-latest
    # ... rest of deployment
```

### Add Slack/Discord Notifications

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 🐛 Troubleshooting

### Build Fails
```bash
# Check the GitHub Actions logs
# Common issues:
# - Missing dependencies in Dockerfile
# - Compilation errors
# - Wrong Rust version
```

**Fix**: Update `Dockerfile.prod` to include all needed dependencies.

### Deployment Fails
```bash
# Check DigitalOcean app logs
doctl apps logs <APP_ID> --type=build
doctl apps logs <APP_ID> --type=deploy
```

**Common issues**:
- Missing environment variables
- Database connection issues
- Health check failing

### Health Check Fails
```bash
# Test locally first
curl http://localhost:3000/health

# Should return:
# {"status":"healthy","service":"relays.social","timestamp":"..."}
```

### Database Migrations Fail
```bash
# View migration job logs
doctl apps logs <APP_ID> --type=job

# Run migrations manually
doctl apps run <APP_ID> migrate
```

### Domain Not Working
1. Check DNS propagation: `dig relays.social`
2. Verify domain in DigitalOcean dashboard
3. Wait 5-30 minutes for DNS to propagate
4. Check SSL certificate status

---

## 💰 Costs

### DigitalOcean App Platform
- **Basic (starter)**: $5/month
  - 1 GB RAM, 1 vCPU
  - Good for testing

- **Professional**: Starting at $12/month
  - 2 GB RAM, 1 vCPU
  - Recommended for production
  - Better performance

### Add-ons
- **Container Registry**: $5/month (500 MB free tier)
- **Managed PostgreSQL**: Starting at $15/month
- **Managed Redis**: Starting at $15/month

### Total Estimated Cost
- **Minimum**: $5-10/month (testing)
- **Recommended Production**: $30-50/month
  - App Platform Professional: $12/month
  - Managed Database: $15/month
  - Managed Redis: $15/month
  - Container Registry: $5/month

**Much cheaper than AWS/GCP and zero DevOps work!**

---

## 🚀 Advanced: Environment-Based Deployments

### Staging + Production

Create two apps in DigitalOcean:
- `relays-social-staging` (staging.relays.social)
- `relays-social-production` (relays.social)

Update workflow:

```yaml
jobs:
  deploy-staging:
    if: github.ref == 'refs/heads/develop'
    # ... deploy to staging

  deploy-production:
    if: github.ref == 'refs/heads/main'
    # ... deploy to production
```

---

## 📚 Resources

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [doctl CLI Reference](https://docs.digitalocean.com/reference/doctl/)
- [App Platform Spec Reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)

---

## ✅ Checklist

Before going live, make sure you have:

- [ ] Created DigitalOcean account
- [ ] Created Container Registry
- [ ] Deployed app via App Platform
- [ ] Set all environment variables in DO dashboard
- [ ] Added all GitHub secrets
- [ ] Configured domain DNS records
- [ ] Verified SSL certificate is active
- [ ] Tested a deployment (push to main)
- [ ] Checked health endpoint works
- [ ] Database migrations run successfully
- [ ] WebSocket connections working

---

**You're all set! Every push to `main` will now automatically deploy to production. No SSH needed!** 🎉
