# Deployment — AWS EC2 (free tier)

All-in-one on a single EC2 `t3.micro`: PostgreSQL (Docker) + NestJS + Next.js,
behind nginx. The database stays portable — swap `DATABASE_URL` to RDS later for
load testing with no code change.

```
Internet ──:80/:443──► nginx ──┬─ /            → Next.js  (:3001)
                               ├─ /api/         → NestJS   (:3000)  (strips /api)
                               └─ /socket.io/   → NestJS   (:3000)  (WebSocket)
                                          │
                                     Postgres (Docker :5433)
```

---

## 1. Launch the EC2 instance (AWS Console)

1. EC2 → **Launch instance**.
2. Name: `du-support`. AMI: **Ubuntu Server 24.04 LTS**. Type: **t3.micro** (free tier).
3. **Key pair**: create/download one (e.g. `du-key.pem`) — you'll SSH with it.
4. **Network / Security group** — allow inbound:
   - SSH (22) — *My IP*
   - HTTP (80) — Anywhere
   - HTTPS (443) — Anywhere
5. Storage: 20 GB gp3 (free tier allows up to 30 GB).
6. Launch.
7. **Elastic IP**: EC2 → Elastic IPs → Allocate → Associate to this instance.
   (Free while attached; keeps the IP stable across restarts.)

## 2. Point your domain (GoDaddy)

In GoDaddy DNS for `innoprojects.in`, add an **A record**:
- Host: `du`  →  Value: *your Elastic IP*  →  TTL: 600
- Result: `du.innoprojects.in` → your instance. (DNS can take a few minutes.)

## 3. SSH in + base setup

```bash
ssh -i du-key.pem ubuntu@du.innoprojects.in

# 2 GB swap (prevents OOM on 1 GB RAM during Next build)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Node 20 + nginx + git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx git

# Docker (for PostgreSQL)
sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER && newgrp docker

# PM2 (process manager)
sudo npm install -g pm2
```

## 4. Get the code + database

```bash
git clone https://github.com/ajaykarthik-ip/Luxury-Product-Support-Chat-Application.git du
cd du/backend

# Start Postgres
docker compose up -d

# Backend env (use a STRONG secret in prod)
cat > .env <<'EOF'
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/luxury_chat?schema=public"
JWT_SECRET="REPLACE_WITH_A_LONG_RANDOM_STRING"
JWT_EXPIRES_IN="1d"
EOF
```

## 5. Build + run the backend

```bash
cd ~/du/backend
npm ci
npx prisma migrate deploy     # apply migrations (prod-safe, no prompts)
npx prisma generate
npm run seed                  # 9 demo products
npm run build                 # → dist/
pm2 start dist/main.js --name du-backend
```

## 6. Build + run the frontend

The API base is baked at **build time**, so set it before building.
Start with HTTP; we add HTTPS in step 8 (then rebuild).

```bash
cd ~/du/frontend
echo 'NEXT_PUBLIC_API_URL=http://du.innoprojects.in/api' > .env.local
npm ci
npm run build
PORT=3001 pm2 start "npm run start" --name du-frontend

pm2 save && pm2 startup    # run the printed command so PM2 restarts on reboot
```

## 7. nginx reverse proxy

```bash
sudo tee /etc/nginx/sites-available/du >/dev/null <<'EOF'
server {
    listen 80;
    server_name du.innoprojects.in;

    # REST API → backend (trailing slash strips the /api prefix)
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket → backend (Socket.IO lives at /socket.io)
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Everything else → Next.js frontend
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/du /etc/nginx/sites-enabled/du
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Now visit **http://du.innoprojects.in** — the app should load.

## 8. HTTPS (free, Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d du.innoprojects.in   # follow prompts; choose redirect

# Rebuild frontend so the API base is https (baked at build time)
cd ~/du/frontend
echo 'NEXT_PUBLIC_API_URL=https://du.innoprojects.in/api' > .env.local
npm run build
pm2 restart du-frontend
```

Visit **https://du.innoprojects.in**. Done.

---

## Redeploy after a code change

```bash
cd ~/du && git pull
cd backend  && npm ci && npx prisma migrate deploy && npm run build && pm2 restart du-backend
cd ../frontend && npm ci && npm run build && pm2 restart du-frontend
```

## Migrate the DB to RDS later (for load testing)
1. Create an RDS PostgreSQL `db.t3.micro`; allow the EC2 security group on 5432.
2. Point `backend/.env` `DATABASE_URL` at the RDS endpoint.
3. `npx prisma migrate deploy && npm run seed && pm2 restart du-backend`.
   No application code changes — the DB is just a connection string.

## Troubleshooting
- `pm2 logs du-backend` / `pm2 logs du-frontend` — app logs.
- `sudo tail -f /var/log/nginx/error.log` — proxy errors.
- Socket won't connect → check the `/socket.io/` block has the `Upgrade` headers.
- 502 Bad Gateway → the app isn't running on its port (`pm2 ls`).
