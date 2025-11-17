# Enable R2 Public Access for Images

Your images won't load because the R2 bucket is private. Here's how to fix it:

## Quick Fix

1. Go to https://dash.cloudflare.com/
2. Click **R2** in sidebar
3. Click your **relay** bucket
4. Click **Settings** tab
5. Scroll to **Public access**
6. Click **Allow Access**
7. Click **Enable R2.dev subdomain**
8. Copy the URL (like `https://pub-xxxxxxxxxxxxx.r2.dev`)

9. Add to your `.env`:
```
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxx.r2.dev
```

10. Restart server:
```bash
cd backend
cargo run
```

## Or Use Custom Domain (Better)

1. In R2 bucket settings → **Connect Domain**
2. Enter: `media.yourdomain.com`
3. Add DNS record:
   ```
   CNAME media.yourdomain.com → relay.r2.cloudflarestorage.com
   ```
4. Add to `.env`:
   ```
   R2_PUBLIC_URL=https://media.yourdomain.com
   ```

That's it! Images will now load.
