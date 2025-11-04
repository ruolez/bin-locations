# Bin Locations Management System - Installation Guide

## Ubuntu 24 Server Production Installation

This guide covers deploying the Bin Locations Management System on a clean Ubuntu 24 server with NGINX reverse proxy on port 80.

---

## Quick Start (One-Line Install)

```bash
curl -fsSL https://raw.githubusercontent.com/ruolez/bin-locations/main/install.sh | sudo bash
```

Or download and run manually:

```bash
wget https://raw.githubusercontent.com/ruolez/bin-locations/main/install.sh
chmod +x install.sh
sudo ./install.sh
```

---

## Interactive Menu Options

The installer provides an interactive menu with the following options:

### 1. Clean Install
- Installs all dependencies (Docker, NGINX, Git)
- Clones repository from GitHub
- Configures NGINX reverse proxy on port 80
- Auto-detects server IP for CORS configuration
- Builds and starts Docker containers
- Creates data directory for SQLite databases

**Requirements:**
- Clean Ubuntu 24 Server (minimal install)
- Root access (sudo)
- Internet connection

**Installation Steps:**
1. Select option **1** from menu
2. Confirm auto-detected server IP (or enter manually)
3. Wait for installation to complete (2-5 minutes)
4. Access application at `http://YOUR_SERVER_IP`

---

### 2. Update from GitHub
- Pulls latest code from GitHub repository
- **Preserves** local SQLite database (`data/config.db`)
- **Preserves** session data (`data/flask_session/`)
- Automatically backs up data before update
- Rebuilds and restarts Docker containers
- Reconfigures NGINX (in case config changed)

**Update Steps:**
1. Select option **2** from menu
2. Wait for update to complete (1-2 minutes)
3. Data is automatically restored after update
4. Application restarts with new code

**Data Safety:**
- Data directory is backed up to `/tmp/bin-locations-backup-TIMESTAMP/`
- Backup is restored after successful update
- Original backup preserved for rollback if needed

---

### 3. Remove Installation
- Stops Docker containers
- Removes NGINX configuration
- Removes installation directory
- **Optionally** removes data directory (asks for confirmation)
- Creates backup before removing data

**Removal Steps:**
1. Select option **3** from menu
2. Confirm removal
3. Choose whether to remove data directory
4. If data removed, backup is created at `/tmp/bin-locations-backup-TIMESTAMP/`

---

## What Gets Installed

### System Dependencies
- **Docker Engine** (latest stable)
- **Docker Compose Plugin**
- **NGINX** (latest from Ubuntu repos)
- **Git** (for repository cloning)

### Application Components
- Python 3.11 Flask application (Docker container)
- FreeTDS driver (for SQL Server connectivity)
- SQLite databases (local configuration)
- NGINX reverse proxy (port 80 → 5556 → 5000)

---

## Directory Structure After Installation

```
/opt/bin-locations/
├── app/                      # Application code
│   ├── main.py
│   ├── database.py
│   ├── static/
│   │   ├── css/
│   │   └── js/
│   └── templates/
├── data/                     # Persistent data (preserved on updates)
│   ├── config.db             # SQLite configuration database
│   └── flask_session/        # User session data
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── ...
```

---

## NGINX Configuration

The installer automatically configures NGINX as a reverse proxy:

**File:** `/etc/nginx/sites-available/bin-locations`

**Key Features:**
- Listens on port 80 (HTTP)
- Proxies to Docker container on `127.0.0.1:5556`
- Security headers (X-Frame-Options, X-XSS-Protection, etc.)
- No-cache headers for dynamic content
- 1-hour caching for static files
- WebSocket support (Connection upgrade)
- 10MB client body size limit
- Health check endpoint at `/health`

**Logs:**
- Access: `/var/log/nginx/bin-locations-access.log`
- Error: `/var/log/nginx/bin-locations-error.log`

---

## Server IP Detection

The installer automatically detects your server's IP address using:

1. Primary external IP via `ip route get 1.1.1.1`
2. Fallback to first non-loopback IP via `hostname -I`
3. Final fallback to `127.0.0.1`

**Confirm or Override:**
The installer will ask you to confirm the detected IP. If incorrect:
- Press `n` when prompted
- Enter your server's correct IP address
- This IP is used for NGINX server_name configuration

---

## Port Configuration

**Docker Container:**
- Internal: `5000` (Flask application)
- External: `5556` (mapped to host)

**NGINX:**
- Listens: `80` (HTTP)
- Proxies to: `127.0.0.1:5556`

**Firewall Rules (if enabled):**
```bash
# Allow HTTP traffic
sudo ufw allow 80/tcp

# Block direct access to container port (optional)
sudo ufw deny 5556/tcp
```

---

## Management Commands

### View Application Logs
```bash
cd /opt/bin-locations
docker compose logs -f
```

### Restart Application
```bash
cd /opt/bin-locations
docker compose restart
```

### Stop Application
```bash
cd /opt/bin-locations
docker compose down
```

### Start Application
```bash
cd /opt/bin-locations
docker compose up -d
```

### Rebuild After Code Changes
```bash
cd /opt/bin-locations
docker compose up -d --build
```

### View NGINX Logs
```bash
# Access logs
sudo tail -f /var/log/nginx/bin-locations-access.log

# Error logs
sudo tail -f /var/log/nginx/bin-locations-error.log
```

### Restart NGINX
```bash
sudo systemctl restart nginx
```

---

## Backup and Restore

### Manual Backup of Data Directory
```bash
# Create backup
sudo cp -r /opt/bin-locations/data /tmp/bin-locations-backup-$(date +%Y%m%d)

# Verify backup
ls -lh /tmp/bin-locations-backup-*
```

### Restore from Backup
```bash
# Stop application
cd /opt/bin-locations
docker compose down

# Restore data
sudo cp -r /tmp/bin-locations-backup-YYYYMMDD/* /opt/bin-locations/data/

# Set permissions
sudo chown -R root:root /opt/bin-locations/data
sudo chmod -R 755 /opt/bin-locations/data

# Start application
docker compose up -d
```

---

## Troubleshooting

### Application Not Starting

**Check Docker containers:**
```bash
cd /opt/bin-locations
docker compose ps
docker compose logs --tail=50
```

**Common issues:**
- Port 5556 already in use: Change in `docker-compose.yml`
- Docker daemon not running: `sudo systemctl start docker`
- Build errors: Check Dockerfile and requirements.txt

### NGINX Not Working

**Test NGINX configuration:**
```bash
sudo nginx -t
```

**Check NGINX status:**
```bash
sudo systemctl status nginx
```

**Common issues:**
- Port 80 already in use: Check with `sudo netstat -tlnp | grep :80`
- Configuration syntax error: Run `sudo nginx -t` for details
- NGINX not running: `sudo systemctl start nginx`

### Cannot Connect to SQL Server

**Check connection from container:**
```bash
cd /opt/bin-locations
docker compose exec web python -c "import pymssql; print('pymssql installed')"
```

**Verify FreeTDS:**
```bash
docker compose exec web tsql -C
```

**Common issues:**
- SQL Server not accessible from server: Check firewall rules
- Wrong credentials: Update via Settings page
- FreeTDS driver issue: Check Dockerfile includes `freetds-dev`

### Database Locked Error (SQLite)

**Check file permissions:**
```bash
sudo ls -lh /opt/bin-locations/data/
```

**Fix permissions:**
```bash
sudo chown -R root:root /opt/bin-locations/data
sudo chmod -R 755 /opt/bin-locations/data
```

### Session Not Persisting

**Check session directory:**
```bash
sudo ls -lh /opt/bin-locations/data/flask_session/
```

**Recreate session directory:**
```bash
sudo rm -rf /opt/bin-locations/data/flask_session
docker compose restart
```

---

## Security Considerations

### Production Checklist

1. **Enable HTTPS:**
   ```bash
   # Install Certbot
   sudo apt install certbot python3-certbot-nginx

   # Obtain certificate
   sudo certbot --nginx -d yourdomain.com
   ```

2. **Enable Firewall:**
   ```bash
   sudo ufw enable
   sudo ufw allow 22/tcp   # SSH
   sudo ufw allow 80/tcp   # HTTP
   sudo ufw allow 443/tcp  # HTTPS (if using)
   ```

3. **Block Direct Container Access:**
   ```bash
   sudo ufw deny 5556/tcp
   ```

4. **Change Default Flask Secret Key:**
   - Edit `app/main.py`
   - Replace `os.urandom(24)` with fixed secure key
   - Rebuild container

5. **SQL Server Credentials:**
   - Use strong passwords
   - Use SQL Server authentication (not Windows auth)
   - Enable SQL Server encryption if possible

6. **Regular Updates:**
   ```bash
   # Update system packages
   sudo apt update && sudo apt upgrade

   # Update application (via installer)
   sudo ./install.sh  # Select option 2
   ```

---

## Performance Tuning

### NGINX Optimization

Edit `/etc/nginx/sites-available/bin-locations`:

```nginx
# Increase worker connections (in main nginx.conf)
events {
    worker_connections 2048;
}

# Enable gzip compression
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

### Docker Resource Limits

Edit `docker-compose.yml`:

```yaml
services:
  web:
    # ... existing config ...
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 512M
```

---

## Uninstallation

### Complete Removal (Including Docker)

```bash
# Run installer removal option
sudo ./install.sh  # Select option 3

# Optionally remove Docker
sudo apt purge docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo rm -rf /var/lib/docker
sudo rm -rf /var/lib/containerd

# Optionally remove NGINX
sudo apt purge nginx nginx-common
sudo rm -rf /etc/nginx
```

---

## Support

**GitHub Repository:**
https://github.com/ruolez/bin-locations

**Issue Tracker:**
https://github.com/ruolez/bin-locations/issues

**Documentation:**
See `README.md` and `CLAUDE.md` in repository

---

## Changelog

### Version 1.0 (November 2025)
- Initial release
- Ubuntu 24 server support
- Docker + NGINX deployment
- Auto-detect server IP
- Interactive installer menu
- Data preservation on updates
- Comprehensive backup system
