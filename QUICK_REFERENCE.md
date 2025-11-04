# Quick Reference Card

## One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/ruolez/bin-locations/main/install.sh | sudo bash
```

---

## Access After Install

```
http://YOUR_SERVER_IP
```

---

## Common Commands

### View Logs
```bash
cd /opt/bin-locations && docker compose logs -f
```

### Restart Application
```bash
cd /opt/bin-locations && docker compose restart
```

### Update Application
```bash
sudo ./install.sh  # Select option 2
```

### Stop Application
```bash
cd /opt/bin-locations && docker compose down
```

### Start Application
```bash
cd /opt/bin-locations && docker compose up -d
```

---

## Installer Options

| # | Option | Action |
|---|--------|--------|
| 1 | Clean Install | Fresh installation |
| 2 | Update | Pull from GitHub, preserve data |
| 3 | Remove | Uninstall application |
| 4 | Exit | Exit installer |

---

## File Locations

| Item | Path |
|------|------|
| Installation | `/opt/bin-locations` |
| Data | `/opt/bin-locations/data` |
| NGINX Config | `/etc/nginx/sites-available/bin-locations` |
| NGINX Logs | `/var/log/nginx/bin-locations-*.log` |
| Backups | `/tmp/bin-locations-backup-TIMESTAMP/` |

---

## Ports

| Service | Port | Notes |
|---------|------|-------|
| NGINX | 80 | Public access |
| Docker | 5556 | Internal (block with firewall) |
| Flask | 5000 | Inside container only |

---

## Health Check

```bash
curl http://localhost:5556/health
# Expected: {"status":"ok"}
```

---

## Troubleshooting

### Check Status
```bash
cd /opt/bin-locations
docker compose ps
docker compose logs --tail=50
```

### Check NGINX
```bash
sudo systemctl status nginx
sudo nginx -t
```

### View NGINX Logs
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

## Security Setup

### Enable Firewall
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw deny 5556/tcp  # Block container port
sudo ufw enable
```

### Enable HTTPS
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Backup Data

```bash
# Manual backup
sudo cp -r /opt/bin-locations/data /tmp/backup-$(date +%Y%m%d)

# Restore
sudo cp -r /tmp/backup-YYYYMMDD/* /opt/bin-locations/data/
docker compose restart
```

---

## Documentation

| File | Purpose |
|------|---------|
| `README.md` | Project overview |
| `DEPLOYMENT.md` | Quick deployment guide |
| `INSTALL.md` | Full installation guide |
| `ARCHITECTURE.md` | System architecture |
| `CLAUDE.md` | Development guidelines |

---

## Support

**GitHub:** https://github.com/ruolez/bin-locations

**Issues:** https://github.com/ruolez/bin-locations/issues

---

## Requirements

- Ubuntu 24 LTS
- 512 MB RAM minimum (1 GB recommended)
- 2 GB disk space minimum
- Root/sudo access
- Internet connection

---

## Quick Test

```bash
# 1. Check Docker
docker --version

# 2. Check NGINX
nginx -v

# 3. Check Application
curl http://localhost:5556/health

# 4. Check NGINX Proxy
curl http://localhost/health
```

Expected: All commands return success

---

## Default Configuration

- **Installation Path:** `/opt/bin-locations`
- **Web Server:** NGINX on port 80
- **Application Port:** 5556 (mapped to 5000)
- **Auto-restart:** Enabled (`unless-stopped`)
- **Health Check:** Every 30 seconds
- **Session Storage:** Filesystem (`/app/data/flask_session`)

---

## First-Time Setup

1. Install via one-line command
2. Access `http://YOUR_SERVER_IP`
3. Login redirects to Settings (first run)
4. Configure SQL Server connection:
   - Server: SQL Server hostname/IP
   - Port: 1433 (default)
   - Database: Your database name
   - Username: SQL Server username
   - Password: SQL Server password
5. Test connection
6. Save configuration
7. Start managing bin locations

---

## Menu Option Details

### Option 1: Clean Install
- Installs Docker, NGINX, Git
- Clones from GitHub
- Configures NGINX on port 80
- Builds and starts container
- ~5 minutes

### Option 2: Update
- Backs up data directory
- Pulls latest code
- Restores data
- Rebuilds container
- ~2 minutes

### Option 3: Remove
- Stops containers
- Removes NGINX config
- Optionally removes data
- Creates backup before removal
- ~1 minute

---

## Environment Variables

Set in `docker-compose.yml`:

```yaml
environment:
  - FLASK_ENV=production
  - PYTHONUNBUFFERED=1
```

---

## Docker Commands Reference

```bash
# View running containers
docker compose ps

# View logs (follow)
docker compose logs -f

# View logs (last 100 lines)
docker compose logs --tail=100

# Restart container
docker compose restart

# Stop containers
docker compose down

# Start containers
docker compose up -d

# Rebuild and start
docker compose up -d --build

# View container stats
docker stats

# Execute command in container
docker compose exec web bash
```

---

## NGINX Commands Reference

```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Restart NGINX
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx

# View access logs
sudo tail -f /var/log/nginx/bin-locations-access.log

# View error logs
sudo tail -f /var/log/nginx/bin-locations-error.log

# Check configuration file
sudo cat /etc/nginx/sites-available/bin-locations
```

---

## Database Configuration

### SQLite (Local)
- **Location:** `/opt/bin-locations/data/config.db`
- **Purpose:** Connection settings, session data
- **Backup:** Included in data directory

### MS SQL Server (Remote)
- **Tables Used:**
  - `Items_tbl` - Product data
  - `BinLocations_tbl` - Bin locations
  - `Items_BinLocations` - Tracking
  - `Items_BinLocations_History` - Audit trail
  - `Trustees_tbl` - Authentication
- **Configuration:** Via Settings page

---

## Update Schedule

**Recommended:**
- Check for updates weekly
- Apply updates monthly
- Backup data before updates
- Test after updates

**Command:**
```bash
cd /opt/bin-locations
git fetch origin
git log HEAD..origin/main --oneline
# If updates available:
sudo ./install.sh  # Select option 2
```

---

## Monitoring Setup (Optional)

### Basic Monitoring
```bash
# Add to cron: /etc/cron.d/bin-locations-monitor
*/5 * * * * root curl -sf http://localhost:5556/health || systemctl restart docker
```

### Advanced Monitoring
Consider:
- Uptime monitoring (UptimeRobot, Pingdom)
- Log aggregation (ELK Stack, Graylog)
- Metrics collection (Prometheus, Grafana)
- Alerting (PagerDuty, Slack webhooks)

---

## Performance Tips

1. **Enable NGINX caching** (static files)
2. **Add more container resources** (docker-compose.yml)
3. **Use connection pooling** (SQL Server)
4. **Enable log rotation** (logrotate)
5. **Regular database maintenance** (index rebuilds)

---

## Security Checklist

- [ ] Firewall enabled (ports 22, 80, 443 only)
- [ ] HTTPS enabled with Certbot
- [ ] Direct container port blocked (5556)
- [ ] Strong SQL Server passwords
- [ ] Regular system updates
- [ ] Regular application updates
- [ ] Monitoring enabled
- [ ] Backups automated
- [ ] Access logs reviewed weekly

---

## Common Issues

### Port 80 Already in Use
```bash
# Find process
sudo netstat -tlnp | grep :80

# Stop Apache if installed
sudo systemctl stop apache2
sudo systemctl disable apache2
```

### Container Won't Start
```bash
# Check logs
docker compose logs

# Rebuild
docker compose down
docker compose up -d --build
```

### Can't Connect to SQL Server
- Check SQL Server firewall
- Verify SQL Server authentication
- Test from host: `telnet SQL_SERVER 1433`
- Update connection settings in Settings page

### Session Not Persisting
```bash
# Recreate session directory
sudo rm -rf /opt/bin-locations/data/flask_session
docker compose restart
```

---

## Useful URLs

**Application Pages:**
- Main: `http://server-ip/`
- Login: `http://server-ip/login`
- Settings: `http://server-ip/settings`
- History: `http://server-ip/history`
- Health Check: `http://server-ip/health`

---

**Print this card for quick reference during deployment!**
