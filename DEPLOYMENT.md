# Deployment — MongoDB Atlas + Render (one service)

About 20 minutes. The whole product (API, Socket.io and the React app) runs as **one Render web service** with one URL. The database is a free **MongoDB Atlas** cluster.

## 1. MongoDB Atlas (database)

1. Create a free **M0** cluster at https://cloud.mongodb.com (region: Mumbai `ap-south-1`).
2. **Database Access** → *Add new database user*, username and password (role: *Read and write to any database*). Use a password with only letters and numbers to avoid URL-encoding problems.
3. **Network Access** → *Add IP address* → `0.0.0.0/0` (Render's free tier has no fixed IP; access is protected by the password).
4. **Connect → Drivers** → copy the string and add the database name `maykraft` before the `?`:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/maykraft?retryWrites=true&w=majority
   ```

## 2. Load the demo data into Atlas (once)

From your laptop, in the project folder:

```bash
cd server
MONGO_URI="<your atlas string>" NODE_ENV=development npm run seed
```

It prints the demo logins. The seed refuses to run with `NODE_ENV=production` unless you pass `--force`, which protects real data.

## 3. Render (app)

1. Push the repo to GitHub (it must include `render.yaml`).
2. https://render.com → sign in with GitHub → **New → Blueprint** → choose the repo → **Apply**.
   Render reads `render.yaml` and creates the service `maykraft-studios` with:
   - Build: `npm ci --prefix server && npm ci --prefix client --include=dev && npm run build --prefix client`
   - Start: `npm start --prefix server`
   - Health check: `/api/health`
3. When it asks for the secret values:
   | Key | Value |
   |---|---|
   | `MONGO_URI` | your Atlas string |
   | `CLIENT_URL` | your Render URL, e.g. `https://maykraft-studios.onrender.com` (you can set it after the first deploy) |

   `JWT_SECRET` is generated automatically. `NODE_ENV`, `NODE_VERSION`, `JWT_EXPIRES_IN` and `VITE_SHOW_DEMO` are preset.
4. Wait for the deploy (about 3–5 minutes), then open:
   - `https://<service>.onrender.com/api/health` → `{"data":{"status":"ok",…}}`
   - `https://<service>.onrender.com` → the landing page

> **Free-tier sleep:** Render's free plan sleeps after 15 minutes idle, so the first visit after that takes about 30–50 seconds. Open the URL a minute before a demo or evaluation. To keep it awake, add a free uptime monitor (e.g. UptimeRobot) that pings `/api/health` every 10 minutes.

## 4. Check it works (in an incognito window)

- [ ] Landing page loads with the logo and three role cards
- [ ] Manager demo login → dashboard shows 3 clients with red / amber / green flags
- [ ] Top bar shows **Live** (socket connected)
- [ ] With the manager in one window and an editor (`kabir@maykraft.studio`) in another, a chat message appears instantly
- [ ] Refreshing a deep link like `/manager/clients` still works

## Troubleshooting

| Symptom | Fix |
|---|---|
| Deploy fails at "Failed to start server: bad auth" | Wrong Atlas user or password in `MONGO_URI` |
| Deploy fails with `querySrv ENOTFOUND` | Typo in the cluster host, or the `mongodb+srv://` prefix is missing |
| Server times out connecting | Atlas Network Access is missing `0.0.0.0/0` |
| Dashboard is empty | You didn't run the seed against Atlas (step 2) |
| Top bar says **Offline** | Render is still waking up; refresh after 30 seconds |
| Login gives 429 | The rate limiter (20 tries per 15 minutes per IP) is working; wait |

## Optional: frontend on Vercel instead

Only needed if you want the frontend on a separate host. Import the repo in Vercel with root directory `client`, set `VITE_API_URL=https://<service>.onrender.com`, and add the Vercel URL to `CLIENT_URL` on Render. `client/vercel.json` already handles routing for the single-page app.

Secrets live only in the Render dashboard. `.env` files are git-ignored, and only the `.env.example` templates are committed.
