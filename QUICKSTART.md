# Quick Start Guide - Bin Locations Management

## Application is Running! 🎉

Your Bin Locations Management application is now running at:

**http://localhost:5556**

## First Time Setup

### Step 1: Configure Database Connection

1. Open your browser and navigate to: **http://localhost:5556/settings**

2. Enter your SQL Server connection details:
   - **Server Address**: Your SQL Server IP or hostname (e.g., `192.168.1.100` or `localhost`)
   - **Port**: Default is `1433` (leave as-is unless your SQL Server uses a different port)
   - **Database Name**: `BackOffice` (or your database name)
   - **Username**: Your SQL Server authentication username
   - **Password**: Your SQL Server authentication password

3. Click **Test Connection** to verify the connection works

4. If successful, click **Save Configuration**

### Step 2: Start Using the Application

1. Navigate to the main page: **http://localhost:5556**

2. You should see the bin locations table (empty if no data exists yet)

## Common Tasks

### Add a New Bin Location Record

1. Click **Add New Record** button
2. Select a bin location from the dropdown
3. Search for a product by typing its description
4. Enter quantity per case (optional - this updates the Items_tbl.UnitQty2 field)
5. Enter number of cases
6. Click **Save**

### Edit an Existing Record

1. Click the **Edit** button on any row
2. Modify any fields as needed
3. Click **Save**

### Adjust Case Quantities

- Click **➕** to add cases
- Click **➖** to remove cases
- Enter the adjustment amount (positive or negative)
- Click **Save**

### Search and Filter

- Use the search box at the top to filter by bin location or product name
- Click the **🔄 Refresh** button to reload data from the database

## Understanding the Table Columns

| Column | Description |
|--------|-------------|
| **Bin Location** | The warehouse bin identifier |
| **Product Name** | Product description |
| **Case Quantity** | Number of cases in this bin |
| **Qty per Case** | Units per case (from Items_tbl.UnitQty2) - shows "Not Set" if null |
| **Total Quantity** | Calculated as Case Quantity × Qty per Case - shows "—" if qty per case not set |
| **Actions** | Edit, Add, Remove buttons |

## Null Value Handling

The application gracefully handles missing or incomplete data:

- If **Qty per Case** (UnitQty2) is not set, it shows **"Not Set"**
- If qty per case is not set, **Total Quantity** shows **"—"**
- You can set qty per case when adding or editing records

## Troubleshooting

### "Database not configured" message

- Go to Settings and configure your SQL Server connection
- Make sure to test the connection before saving

### Cannot connect to SQL Server

1. Verify SQL Server is running
2. Check firewall rules allow port 1433
3. Confirm SQL Server authentication is enabled
4. Verify username and password are correct

### Changes not showing

- Click the **🔄 Refresh** button to reload data
- Hard refresh browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Application not loading

Check if the Docker container is running:
```bash
docker-compose ps
```

If not running, start it:
```bash
docker-compose up -d
```

View logs if there are issues:
```bash
docker-compose logs
```

## Docker Management

### Start the application
```bash
cd /Users/ruolez/Desktop/Dev/bin-locations
docker-compose up -d
```

### Stop the application
```bash
docker-compose down
```

### Restart the application
```bash
docker-compose restart
```

### View logs
```bash
docker-compose logs -f
```

### Rebuild after code changes
```bash
docker-compose up -d --build
```

## Data Persistence

Your database configuration is stored in:
```
/Users/ruolez/Desktop/Dev/bin-locations/data/config.db
```

This SQLite file persists your SQL Server connection settings across container restarts.

## Support

For additional information, see the full README.md file in the project directory.

For database schema details, see dbschema.md in the project directory.

## Access URLs

- **Main Application**: http://localhost:5556
- **Settings Page**: http://localhost:5556/settings
- **Health Check**: http://localhost:5556/health

---

**Enjoy using your Bin Locations Management System!** 📦
