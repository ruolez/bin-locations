# Deployment Architecture

## Production Deployment Stack

```
┌─────────────────────────────────────────────────────────────┐
│                         INTERNET                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                    Port 80 (HTTP)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    NGINX Reverse Proxy                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  • Security headers (X-Frame-Options, etc.)          │   │
│  │  • No-cache headers for dynamic content              │   │
│  │  • Static file caching (1 hour)                      │   │
│  │  • WebSocket support                                 │   │
│  │  • 10MB body size limit                              │   │
│  │  • Health check endpoint (no logging)                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Config: /etc/nginx/sites-available/bin-locations           │
│  Logs:   /var/log/nginx/bin-locations-*.log                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                Proxy to 127.0.0.1:5556
                         │
┌────────────────────────▼────────────────────────────────────┐
│                     Docker Container                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Flask Application (Python 3.11)            │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Port 5000 (Internal)                          │  │   │
│  │  │  • Health Check: /health                       │  │   │
│  │  │  • Login: /login                               │  │   │
│  │  │  • Main App: / (index.html)                    │  │   │
│  │  │  • Settings: /settings                         │  │   │
│  │  │  • History: /history                           │  │   │
│  │  │  • API Routes: /api/*                          │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                                                       │   │
│  │  Dependencies:                                        │   │
│  │  • Flask + Flask-Session                             │   │
│  │  • pymssql (SQL Server driver)                       │   │
│  │  • FreeTDS (SQL Server compatibility)               │   │
│  │  • curl (health checks)                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Port Mapping: 5556:5000                                    │
│  Volumes:                                                    │
│    • ./data → /app/data (persistent)                        │
│    • ./app  → /app/app  (live reload dev)                   │
│                                                              │
│  Health Check:                                               │
│    • Interval: 30s                                           │
│    • Timeout: 10s                                            │
│    • Retries: 3                                              │
│    • Start period: 40s                                       │
│                                                              │
│  Restart Policy: unless-stopped                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                    Data Storage
                         │
    ┌────────────────────┴────────────────────┐
    │                                         │
    │                                         │
┌───▼────────────────┐              ┌────────▼────────────────┐
│  SQLite (Local)    │              │  MS SQL Server          │
│  /app/data/        │              │  (Remote)               │
│                    │              │                         │
│  • config.db       │              │  • Items_tbl            │
│  • flask_session/  │              │  • BinLocations_tbl     │
│                    │              │  • Items_BinLocations   │
│  Config Storage    │              │  • History Table        │
│  Session Data      │              │  • Trustees_tbl (auth)  │
└────────────────────┘              └─────────────────────────┘
```

---

## Directory Structure on Server

```
/opt/bin-locations/                    ← Installation root
│
├── app/                               ← Application code
│   ├── __init__.py
│   ├── main.py                        ← Flask routes + session config
│   ├── database.py                    ← SQLite + MSSQL managers
│   │
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css              ← Material Design 3 styles
│   │   └── js/
│   │       ├── app.js                 ← Main page logic
│   │       ├── settings.js            ← Settings page logic
│   │       └── history.js             ← History page logic
│   │
│   └── templates/
│       ├── login.html                 ← Authentication
│       ├── index.html                 ← Bin locations management
│       ├── settings.html              ← Database config
│       └── history.html               ← Audit trail
│
├── data/                              ← Persistent data (preserved on updates)
│   ├── config.db                      ← SQLite database
│   └── flask_session/                 ← User sessions
│       └── [session files]
│
├── docker-compose.yml                 ← Container orchestration
├── Dockerfile                         ← Container build instructions
├── requirements.txt                   ← Python dependencies
│
├── install.sh                         ← This installer script
├── INSTALL.md                         ← Full installation guide
├── DEPLOYMENT.md                      ← Quick deployment reference
├── INSTALLER_SUMMARY.md               ← Implementation summary
├── ARCHITECTURE.md                    ← This document
│
├── README.md                          ← Project overview
├── CLAUDE.md                          ← Developer guidelines
├── dbschema.MD                        ← Database schema docs
│
└── setup_tables.sql                   ← SQL Server table creation
    setup_tables_history.sql           ← History table creation
```

---

## Network Flow Diagram

```
┌──────────────┐
│   Browser    │
│  (User)      │
└──────┬───────┘
       │
       │ HTTP Request
       │ http://server-ip/
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  Ubuntu 24 Server                                       │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  NGINX (Port 80)                                │   │
│  │  • Receives HTTP request                        │   │
│  │  • Applies security headers                     │   │
│  │  • Proxies to Docker container                  │   │
│  └────────────────┬────────────────────────────────┘   │
│                   │                                     │
│                   │ 127.0.0.1:5556                      │
│                   ▼                                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Docker Container                               │   │
│  │  • Port mapping: 5556 → 5000                    │   │
│  │  • Flask receives request on port 5000          │   │
│  │  • Processes request                            │   │
│  │  • Queries databases                            │   │
│  │  • Returns HTML/JSON response                   │   │
│  └────────────────┬────────────────────────────────┘   │
│                   │                                     │
└───────────────────┼─────────────────────────────────────┘
                    │
                    │ SQL Queries
                    ▼
         ┌──────────────────────┐
         │  MS SQL Server       │
         │  (Remote)            │
         │  • BackOffice DB     │
         │  • Inventory data    │
         └──────────────────────┘
```

---

## Data Flow for Typical Request

### Example: User Creates New Bin Location

```
1. Browser
   └─→ POST /api/bin-locations
       Body: { productUPC, binLocationID, qtyCases, unitQty2 }

2. NGINX
   └─→ Receives request on port 80
       └─→ Adds security headers
           └─→ Proxies to 127.0.0.1:5556

3. Docker Container
   └─→ Flask receives on port 5000
       └─→ Route: @app.route('/api/bin-locations', methods=['POST'])
           └─→ Checks @login_required decorator
               └─→ Validates session (Flask-Session checks /app/data/flask_session/)
                   ├─→ NOT LOGGED IN: Return 401 + {"auth_required": true}
                   └─→ LOGGED IN: Continue
                       └─→ Extracts username from session
                           └─→ Calls mssql_manager.create_bin_location()

4. Database Operations (in transaction)
   └─→ MSSQLManager.create_bin_location()
       ├─→ INSERT INTO Items_BinLocations
       │   (ProductUPC, Qty_Cases, BinLocationID, CreatedAt, LastUpdate)
       │
       ├─→ UPDATE Items_tbl
       │   SET UnitQty2 = ? WHERE ProductUPC = ?
       │
       └─→ INSERT INTO Items_BinLocations_History
           (RecordID, OperationType, Username, Timestamp, NewState)

5. Response Flow
   └─→ Database returns success
       └─→ Flask returns JSON: {"success": true, "message": "Record created"}
           └─→ Docker forwards to NGINX (port 5556)
               └─→ NGINX forwards to browser (port 80)
                   └─→ Browser shows success toast notification

6. Frontend Updates
   └─→ app.js receives response
       └─→ Calls showToast('Record created successfully', 'success')
           └─→ Closes modal
               └─→ Refreshes table data (manual refresh button)
```

---

## Authentication Flow

```
1. User visits http://server-ip/
   │
   ├─→ Flask checks session['username']
   │   │
   │   ├─→ EXISTS: Serve index.html (main page)
   │   │
   │   └─→ NOT EXISTS: Redirect to /login
   │
2. User submits login form
   │
   └─→ POST /api/login
       Body: { username, password }
       │
       └─→ Flask queries SQL Server:
           SELECT * FROM Trustees_tbl
           WHERE Login_name = ? AND Password = ? AND acDsbld = 0
           │
           ├─→ MATCH FOUND:
           │   └─→ Store in session:
           │       session['username'] = Login_name
           │       session['auto_id'] = AutoID
           │       session['employee_id'] = EmployeeID
           │       │
           │       └─→ Return: {"success": true, "redirect": "/"}
           │           └─→ Browser redirects to main page
           │
           └─→ NO MATCH:
               └─→ Return: {"success": false, "message": "Invalid credentials"}
                   └─→ Browser shows error toast
```

---

## Installer Flow Diagram

```
                    ┌──────────────┐
                    │   Run Script │
                    │ ./install.sh │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Check Root?  │
                    └──────┬───────┘
                           │ Yes
                    ┌──────▼───────────┐
                    │  Show Menu       │
                    │  1) Install      │
                    │  2) Update       │
                    │  3) Remove       │
                    │  4) Exit         │
                    └──────┬───────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼───┐   ┌───▼────┐   ┌──▼─────┐
         │ Install│   │ Update │   │ Remove │
         └────┬───┘   └───┬────┘   └──┬─────┘
              │           │            │
    ┌─────────▼──────────┐│            │
    │ Check Ubuntu 24?   ││            │
    └─────────┬──────────┘│            │
              │ Yes        │            │
    ┌─────────▼──────────┐│            │
    │ Detect Server IP   ││            │
    │ Confirm with user  ││            │
    └─────────┬──────────┘│            │
              │            │            │
    ┌─────────▼──────────┐│            │
    │ Install Docker     ││            │
    └─────────┬──────────┘│            │
              │            │            │
    ┌─────────▼──────────┐│            │
    │ Install NGINX      ││            │
    └─────────┬──────────┘│            │
              │            │            │
    ┌─────────▼──────────┐│            │
    │ Install Git        ││            │
    └─────────┬──────────┘│            │
              │            │            │
    ┌─────────▼──────────┐│   ┌────────▼────────┐
    │ Clone from GitHub  ││   │ Backup Data Dir │
    └─────────┬──────────┘│   └────────┬────────┘
              │            │            │
    ┌─────────▼──────────┐│   ┌────────▼────────┐
    │ Create Data Dir    ││   │ Stop Containers │
    └─────────┬──────────┘│   └────────┬────────┘
              │            │            │
    ┌─────────▼──────────┐│   ┌────────▼────────┐
    │ Configure NGINX    ││   │ Pull from GitHub│
    └─────────┬──────────┘│   └────────┬────────┘
              │            │            │
    ┌─────────▼──────────┐│   ┌────────▼────────┐
    │ Build Container    ││   │ Restore Data    │
    └─────────┬──────────┘│   └────────┬────────┘
              │            │            │
    ┌─────────▼──────────┐│   ┌────────▼────────┐  ┌────────────┐
    │ Start Container    ││   │ Rebuild         │  │ Stop App   │
    └─────────┬──────────┘│   └────────┬────────┘  └──────┬─────┘
              │            │            │                  │
    ┌─────────▼──────────┐│   ┌────────▼────────┐  ┌──────▼─────┐
    │ Wait for Health    ││   │ Wait for Health │  │ Remove     │
    │ Check (60s)        ││   │ Check (60s)     │  │ NGINX Cfg  │
    └─────────┬──────────┘│   └────────┬────────┘  └──────┬─────┘
              │            │            │                  │
    ┌─────────▼──────────┐│   ┌────────▼────────┐  ┌──────▼─────┐
    │ Success Message    ││   │ Success Message │  │ Ask about  │
    │ Display URLs       ││   │ Show Backup     │  │ Data Dir   │
    └────────────────────┘│   └─────────────────┘  └──────┬─────┘
                          │                               │
                          │                        ┌──────▼─────┐
                          │                        │ Remove Dir │
                          │                        │ (optional) │
                          │                        └────────────┘
                          │
                   All complete
```

---

## Port Mapping Table

| Layer | Port | Access | Description |
|-------|------|--------|-------------|
| NGINX | 80 | Public | HTTP entry point |
| Docker Host | 5556 | Internal | Mapped to container |
| Container | 5000 | Internal | Flask application |
| SQLite | N/A | File | Local config storage |
| SQL Server | 1433 | Remote | Inventory database |

---

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: NGINX Security Headers                           │
│  • X-Frame-Options: SAMEORIGIN                              │
│  • X-Content-Type-Options: nosniff                          │
│  • X-XSS-Protection: 1; mode=block                          │
└─────────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────▼───────────────────────────────────┐
│  Layer 2: Flask Session Authentication                     │
│  • Flask-Session with filesystem backend                    │
│  • @login_required decorator on protected routes            │
│  • Session validation against Trustees_tbl                  │
└─────────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────▼───────────────────────────────────┐
│  Layer 3: Database Access Control                          │
│  • SQL Server authentication (username/password)            │
│  • Credentials stored in local SQLite (not in code)         │
│  • Passwords never returned in API responses                │
└─────────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────▼───────────────────────────────────┐
│  Layer 4: Docker Isolation                                 │
│  • Application runs in isolated container                   │
│  • Only port 5556 exposed to host                           │
│  • Data directory mounted as volume                          │
└─────────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────▼───────────────────────────────────┐
│  Layer 5: Firewall (Recommended)                           │
│  • UFW: Allow only 80, 443, 22                              │
│  • Block direct container port (5556)                       │
│  • Rate limiting on NGINX                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Update Process Flow

```
User runs: sudo ./install.sh → Option 2

1. Validate Installation
   ├─→ Check /opt/bin-locations exists
   └─→ Exit if not found

2. Create Backup
   ├─→ Timestamp: YYYYMMDD-HHMMSS
   ├─→ Copy: /opt/bin-locations/data
   └─→ To: /tmp/bin-locations-backup-TIMESTAMP/

3. Stop Application
   └─→ docker compose down

4. Update Code
   ├─→ cd /opt/bin-locations
   ├─→ git stash (save local changes)
   └─→ git pull origin main

5. Restore Data
   ├─→ Copy backup back to /opt/bin-locations/data/
   └─→ Set permissions: 755

6. Reconfigure NGINX
   ├─→ Detect server IP
   ├─→ Regenerate /etc/nginx/sites-available/bin-locations
   ├─→ Test: nginx -t
   └─→ Reload: systemctl reload nginx

7. Rebuild Container
   └─→ docker compose up -d --build

8. Wait for Health Check
   ├─→ Attempt 30 times
   ├─→ Every 2 seconds
   └─→ curl http://localhost:5556/health

9. Success
   ├─→ Display access URLs
   └─→ Show backup location
```

---

## Health Check Mechanism

```
┌────────────────────────────────────────────────────────┐
│  Docker Health Check (every 30 seconds)               │
│                                                        │
│  docker-compose.yml:                                  │
│    healthcheck:                                       │
│      test: ["CMD", "curl", "-f",                      │
│             "http://localhost:5000/health"]           │
│      interval: 30s                                    │
│      timeout: 10s                                     │
│      retries: 3                                       │
│      start_period: 40s                                │
└────────────────────────────────────────────────────────┘
                        │
                        │ Calls
                        ▼
┌────────────────────────────────────────────────────────┐
│  Flask Endpoint                                        │
│                                                        │
│  @app.route('/health', methods=['GET'])                │
│  def health_check():                                   │
│      return jsonify({'status': 'ok'})                  │
└────────────────────────────────────────────────────────┘
                        │
                        │ Returns
                        ▼
┌────────────────────────────────────────────────────────┐
│  Container Status                                      │
│                                                        │
│  • healthy: 200 OK response                            │
│  • unhealthy: No response or error (3 retries)        │
│  • starting: Within 40s start_period                  │
└────────────────────────────────────────────────────────┘
                        │
                        │ Monitored by
                        ▼
┌────────────────────────────────────────────────────────┐
│  Docker Engine                                         │
│                                                        │
│  • Automatic restart if unhealthy (unless-stopped)    │
│  • Visible in: docker compose ps                      │
│  • Check: docker inspect <container> | grep Health    │
└────────────────────────────────────────────────────────┘
```

---

## Backup Strategy

### Automatic Backups (by Installer)

| Event | Location | Contains | Retention |
|-------|----------|----------|-----------|
| Before Update | `/tmp/bin-locations-backup-TIMESTAMP/` | `data/` directory | Manual cleanup |
| Before Data Removal | `/tmp/bin-locations-backup-TIMESTAMP/` | `data/` directory | Manual cleanup |

### Manual Backup (Recommended Schedule)

```bash
# Daily backup script (add to cron)
#!/bin/bash
BACKUP_DIR="/backups/bin-locations/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"
cp -r /opt/bin-locations/data/* "$BACKUP_DIR/"

# Keep last 7 days
find /backups/bin-locations/ -type d -mtime +7 -exec rm -rf {} \;
```

---

## Monitoring Points

| Metric | Location | Command |
|--------|----------|---------|
| Container Status | Docker | `docker compose ps` |
| Container Health | Docker | `docker inspect --format='{{.State.Health.Status}}' <container>` |
| Application Logs | Docker | `docker compose logs -f` |
| NGINX Access | Log File | `tail -f /var/log/nginx/bin-locations-access.log` |
| NGINX Errors | Log File | `tail -f /var/log/nginx/bin-locations-error.log` |
| Disk Usage | Data Dir | `du -sh /opt/bin-locations/data` |
| Container Resources | Docker | `docker stats` |

---

## Troubleshooting Decision Tree

```
Application not accessible?
│
├─→ Can reach NGINX? (curl http://localhost:80)
│   ├─→ NO: Check NGINX status (systemctl status nginx)
│   └─→ YES: Check backend
│       │
│       └─→ Can reach container? (curl http://localhost:5556)
│           ├─→ NO: Check Docker (docker compose ps)
│           │   │
│           │   └─→ Container running?
│           │       ├─→ NO: Start it (docker compose up -d)
│           │       └─→ YES: Check health (docker compose ps)
│           │           │
│           │           └─→ Unhealthy? View logs (docker compose logs)
│           │
│           └─→ YES: Check Flask
│               │
│               └─→ Can reach /health? (curl http://localhost:5556/health)
│                   ├─→ NO: Check Flask logs
│                   └─→ YES: Check SQL Server connectivity
│
└─→ Database errors?
    └─→ Check SQL Server (test via Settings page)
```

---

## Performance Characteristics

| Component | Startup Time | Memory Usage | CPU Usage |
|-----------|--------------|--------------|-----------|
| NGINX | < 1 second | ~10 MB | < 1% |
| Docker Container | 30-40 seconds | ~100-200 MB | 1-5% |
| Flask Application | < 5 seconds | ~50-100 MB | 1-5% |
| **Total** | **~40 seconds** | **~150-300 MB** | **< 10%** |

### Scaling Recommendations

**Current Setup:** Single container, suitable for:
- Small to medium warehouses (< 100 concurrent users)
- Low to moderate traffic (< 1000 requests/hour)

**If Scaling Needed:**
1. Add load balancer (NGINX upstream with multiple containers)
2. Use external session storage (Redis instead of filesystem)
3. Add database connection pooling
4. Enable NGINX caching for static content
5. Consider horizontal scaling with Docker Swarm or Kubernetes

---

## Summary

This architecture provides:
- ✅ **Simple deployment** - One-line install
- ✅ **Production-ready** - NGINX + Docker + Health checks
- ✅ **Secure** - Multiple security layers
- ✅ **Maintainable** - Clear structure + documentation
- ✅ **Scalable** - Can expand as needed
- ✅ **Reliable** - Auto-restart + health checks
- ✅ **Monitorable** - Comprehensive logging

Perfect for warehouse inventory management deployments.
