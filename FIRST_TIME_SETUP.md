# First-Time Setup Guide

## Initial Login Credentials

When the application is freshly installed and no database connection is configured, use the following credentials to access the Settings page:

```
Username: admin
Password: admin
```

---

## Setup Process

### Step 1: Access the Application

After installation, navigate to:
```
http://YOUR_SERVER_IP
```

You will see the login page.

---

### Step 2: Login with Default Credentials

At the login page, enter:
- **Username:** `admin`
- **Password:** `admin`

**Note:** These credentials ONLY work when no database connection is configured. Once you configure the database, authentication will be handled via the `Trustees_tbl` table in your SQL Server database.

---

### Step 3: Configure Database Connection

After logging in with `admin/admin`, you will be automatically redirected to the **Settings** page.

Enter your SQL Server connection details:

| Field | Description | Example |
|-------|-------------|---------|
| **Server** | SQL Server hostname or IP | `192.168.1.100` |
| **Port** | SQL Server port (usually 1433) | `1433` |
| **Database** | Database name | `BackOffice` |
| **Username** | SQL Server username | `sa` |
| **Password** | SQL Server password | `YourStrongPassword` |

---

### Step 4: Test Connection

Click the **"Test Connection"** button to verify your settings.

**Expected Results:**
- ✅ **Success:** "Connection successful! Found X users in Trustees_tbl"
- ❌ **Failure:** Error message with details

**Common Issues:**
- **Cannot connect:** Check firewall rules on SQL Server
- **Login failed:** Verify username and password
- **Database not found:** Check database name spelling
- **Table not found:** Ensure `Trustees_tbl` exists in database

---

### Step 5: Save Configuration

Once the connection test succeeds, click **"Save Configuration"**.

Your settings will be saved to the local SQLite database (`/opt/bin-locations/data/config.db`).

---

### Step 6: Logout and Login with Real Credentials

After saving the configuration:

1. Click **"Logout"** in the top-right corner
2. You will be redirected back to the login page
3. The `admin/admin` credentials will **no longer work**
4. Login with your actual credentials from `Trustees_tbl`

---

## Database Requirements

### Required SQL Server Tables

The application requires the following tables in your SQL Server database:

#### 1. Trustees_tbl (Authentication)
```sql
-- User authentication table
CREATE TABLE dbo.Trustees_tbl (
    AutoID INT PRIMARY KEY IDENTITY,
    EmployeeID VARCHAR(50),
    Login_name VARCHAR(50) NOT NULL,
    Password VARCHAR(50) NOT NULL,
    acDsbld BIT DEFAULT 0  -- 0 = Active, 1 = Disabled
);
```

**Required Fields:**
- `Login_name` - Username for login
- `Password` - Password (plaintext in this version)
- `acDsbld` - Account disabled flag (0 = active, 1 = disabled)

#### 2. Items_tbl (Product Master Data)
```sql
CREATE TABLE dbo.Items_tbl (
    ProductUPC VARCHAR(50) PRIMARY KEY,
    ProductDescription VARCHAR(255),
    UnitQty2 INT  -- Quantity per case
);
```

#### 3. BinLocations_tbl (Bin Locations)
```sql
CREATE TABLE dbo.BinLocations_tbl (
    BinLocationID INT PRIMARY KEY IDENTITY,
    BinLocation VARCHAR(50) NOT NULL
);
```

#### 4. Items_BinLocations (Tracking Table)
```sql
CREATE TABLE dbo.Items_BinLocations (
    id INT PRIMARY KEY IDENTITY,
    ProductUPC VARCHAR(50) NOT NULL,
    ProductDescription VARCHAR(255),
    Qty_Cases INT NOT NULL DEFAULT 0,
    BinLocationID INT NOT NULL,
    CreatedAt DATETIME NOT NULL,
    LastUpdate DATETIME NOT NULL,
    FOREIGN KEY (ProductUPC) REFERENCES Items_tbl(ProductUPC),
    FOREIGN KEY (BinLocationID) REFERENCES BinLocations_tbl(BinLocationID)
);
```

#### 5. Items_BinLocations_History (Audit Trail)
See `setup_tables_history.sql` for complete schema.

---

## Security Considerations

### After First-Time Setup

Once you've configured the database connection, the `admin/admin` credentials will **no longer work**. This is by design for security.

**Why?**
- The `admin/admin` credentials are hardcoded and publicly known
- They only work when no database connection is configured
- This prevents unauthorized access after setup is complete

### Creating Users

To add new users who can access the system:

```sql
-- Add a new user to Trustees_tbl
INSERT INTO dbo.Trustees_tbl (Login_name, Password, EmployeeID, acDsbld)
VALUES ('john.doe', 'SecurePassword123', 'EMP001', 0);
```

**Best Practices:**
- Use strong passwords
- Set `acDsbld = 1` to disable users without deleting them
- Keep track of `EmployeeID` for audit purposes

---

## Troubleshooting First-Time Setup

### "Invalid username or password" when using admin/admin

**Cause:** Database connection is already configured.

**Solution:**
1. If you need to reconfigure, delete the config database:
   ```bash
   sudo rm /opt/bin-locations/data/config.db
   docker compose restart
   ```
2. Try `admin/admin` again

### Can't access Settings page after login

**Cause:** The Settings page is accessible to all logged-in users.

**Solution:**
- Check browser console for errors
- Verify you're accessing `http://YOUR_SERVER_IP/settings`

### Connection test fails with "Invalid object name 'Trustees_tbl'"

**Cause:** The `Trustees_tbl` table doesn't exist in the database.

**Solution:**
1. Run the SQL script to create the table (see above)
2. Add at least one user to the table
3. Test connection again

### After saving config, can't login with SQL Server credentials

**Cause:**
- Wrong credentials in `Trustees_tbl`
- User account is disabled (`acDsbld = 1`)

**Solution:**
```sql
-- Check if user exists
SELECT * FROM dbo.Trustees_tbl WHERE Login_name = 'your_username';

-- Enable user if disabled
UPDATE dbo.Trustees_tbl SET acDsbld = 0 WHERE Login_name = 'your_username';
```

---

## Configuration File Location

After setup, your configuration is stored in:
```
/opt/bin-locations/data/config.db
```

**Important:**
- This file is preserved during updates
- Backup this file before uninstalling
- Contains database connection credentials (SQLite encrypted)

---

## Resetting to First-Time Setup

If you need to start over:

```bash
# Stop the application
cd /opt/bin-locations
docker compose down

# Remove configuration database
sudo rm data/config.db

# Start the application
docker compose up -d

# Access with admin/admin again
```

---

## Settings Page Access

**Important:** The Settings page (`/settings`) is accessible **without authentication** to allow first-time setup. However:

- If no config exists: `admin/admin` required to make changes
- If config exists: Regular authentication required
- API endpoints for config require valid session

This design allows first-time setup while maintaining security for normal operations.

---

## Next Steps After Setup

Once database connection is configured:

1. **Create Users:** Add users to `Trustees_tbl`
2. **Add Bin Locations:** Add warehouse bin locations to `BinLocations_tbl`
3. **Add Products:** Populate `Items_tbl` with product data
4. **Start Tracking:** Begin managing bin locations via the main page

---

## Summary

| Step | Action | Credentials |
|------|--------|-------------|
| 1 | Fresh install | Use `admin/admin` |
| 2 | Configure database | N/A |
| 3 | Test connection | N/A |
| 4 | Save configuration | N/A |
| 5 | Logout and re-login | Use SQL Server credentials |

After setup, `admin/admin` will no longer work. All authentication goes through `Trustees_tbl`.

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Fresh Installation (No config.db)                         │
│  Login with: admin/admin                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Auto-redirect
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Settings Page                                              │
│  • Enter SQL Server details                                 │
│  • Test connection                                          │
│  • Save configuration                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Config saved to config.db
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Logout                                                     │
│  admin/admin no longer works                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Login with SQL Server Credentials                          │
│  Authentication via Trustees_tbl                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Main Application                                           │
│  • Manage bin locations                                     │
│  • Track inventory                                          │
│  • View history                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Support

If you encounter issues during first-time setup:

1. Check Docker logs: `docker compose logs -f`
2. Check NGINX logs: `sudo tail -f /var/log/nginx/bin-locations-error.log`
3. Verify SQL Server connectivity: `telnet SQL_SERVER 1433`
4. Review documentation: `README.md`, `INSTALL.md`

---

**Remember:** The `admin/admin` credentials are only for initial setup. Once configured, all authentication is handled via your SQL Server database.
