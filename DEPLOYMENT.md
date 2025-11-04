# Quick Deployment Guide

## One-Line Install on Ubuntu 24 Server

```bash
curl -fsSL https://raw.githubusercontent.com/ruolez/bin-locations/main/install.sh | sudo bash
```

---

## What It Does

1. **Installs Dependencies:**
   - Docker Engine + Docker Compose
   - NGINX Web Server
   - Git

2. **Deploys Application:**
   - Clones repository to `/opt/bin-locations`
   - Builds Docker container (Python 3.11 + Flask + FreeTDS)
   - Configures NGINX reverse proxy on port 80
   - Starts application with auto-restart enabled

3. **Detects Configuration:**
   - Auto-detects server IP address
   - Configures NGINX server_name
   - Prompts for confirmation before proceeding

---

## Interactive Menu

The installer provides 4 options:

| Option | Action | Description |
|--------|--------|-------------|
| **1** | Clean Install | Fresh installation on clean server |
| **2** | Update from GitHub | Pull latest code, preserve data |
| **3** | Remove Installation | Uninstall application (optionally keep data) |
| **4** | Exit | Exit installer |

---

## Access Application

After installation:

```
http://YOUR_SERVER_IP
```

**First-time login credentials:**
```
Username: admin
Password: admin
```

**Important:** These credentials only work when no database connection is configured. After configuring the database, use credentials from your SQL Server `Trustees_tbl` table.

**See:** `FIRST_TIME_SETUP.md` for detailed setup instructions

---

## Data Persistence

**Data Directory:** `/opt/bin-locations/data`

**Preserved on Updates:**
- `config.db` - Database connection settings
- `flask_session/` - User session data

**Backup Location:** `/tmp/bin-locations-backup-TIMESTAMP/`

---

## Management Commands

```bash
# View logs
cd /opt/bin-locations && docker compose logs -f

# Restart application
cd /opt/bin-locations && docker compose restart

# Stop application
cd /opt/bin-locations && docker compose down

# Start application
cd /opt/bin-locations && docker compose up -d

# Update application
sudo ./install.sh  # Select option 2
```

---

## Ports

| Service | Internal | External | Description |
|---------|----------|----------|-------------|
| Flask | 5000 | - | Application (container) |
| Docker | 5556 | 5556 | Container port mapping |
| NGINX | - | 80 | Public HTTP access |

---

## Firewall Configuration

```bash
# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS (if using SSL)
sudo ufw allow 443/tcp

# Block direct container access
sudo ufw deny 5556/tcp
```

---

## Enable HTTPS (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (certbot sets up cron job automatically)
```

---

## Troubleshooting

### Check Application Status
```bash
cd /opt/bin-locations
docker compose ps
```

### Check Application Logs
```bash
cd /opt/bin-locations
docker compose logs --tail=100 -f
```

### Check NGINX Status
```bash
sudo systemctl status nginx
sudo nginx -t  # Test configuration
```

### Check NGINX Logs
```bash
sudo tail -f /var/log/nginx/bin-locations-error.log
```

### Restart Everything
```bash
cd /opt/bin-locations
docker compose restart
sudo systemctl restart nginx
```

---

## Requirements

- **OS:** Ubuntu 24 LTS (clean minimal install)
- **RAM:** 512 MB minimum, 1 GB recommended
- **Disk:** 2 GB minimum, 5 GB recommended
- **Network:** Internet connection for installation
- **Access:** Root/sudo privileges

---

## Security Checklist

- [ ] Enable firewall (`sudo ufw enable`)
- [ ] Enable HTTPS with Certbot
- [ ] Change default SQL Server passwords
- [ ] Restrict port 5556 access (internal only)
- [ ] Regular system updates (`apt update && apt upgrade`)
- [ ] Regular application updates (installer option 2)
- [ ] Monitor NGINX access logs
- [ ] Backup data directory regularly

---

## Support

**Full Documentation:** See `INSTALL.md`

**GitHub:** https://github.com/ruolez/bin-locations

**Issues:** https://github.com/ruolez/bin-locations/issues
