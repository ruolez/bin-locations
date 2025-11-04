# Bin Locations Management System

Modern web application for managing warehouse bin locations and inventory tracking. Built with Python Flask backend, MS SQL Server integration, and Material Design 3 UI.

## Features

- **Bin Location Management**: Track inventory items across warehouse bin locations
- **Searchable Bin Locations**: Autocomplete search for bin locations (no dropdown scrolling)
- **Product Search**: Quick product lookup by description with autocomplete
- **Quantity Tracking**: Manage case quantities and units per case
- **Real-time Totals**: Summary bar and footer showing total cases and items
- **Central Time Timestamps**: All timestamps stored in Central Time (Chicago)
- **Manual Refresh**: Manual refresh button to keep data current without disrupting input
- **Edit Capability**: Full record editing with dual-table updates
- **Quantity Adjustments**: Quick add/remove operations for case quantities
- **Modern UI**: Professional Material Design 3 interface
- **Graceful Null Handling**: Works with incomplete data (e.g., missing UnitQty2 values)

## Technology Stack

- **Backend**: Python 3.11 + Flask
- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (no frameworks)
- **Database**:
  - SQLite: Local configuration storage
  - MS SQL Server: Main inventory database via pymssql + FreeTDS driver
- **Deployment**: Docker + Docker Compose
- **Port**: 5556 (mapped to internal 5000)

## Database Schema

### SQL Server Tables (BackOffice)

**Items_tbl** - Product master data
- ProductUPC: Product barcode/UPC
- ProductDescription: Product name
- UnitQty2: Quantity per case (managed by this app)

**BinLocations_tbl** - Warehouse bin locations
- BinLocationID: Primary key
- BinLocation: Bin location name

**Items_BinLocations** - Main tracking table
- id: Primary key
- ProductUPC: Foreign key to Items_tbl
- ProductDescription: Denormalized product name
- Qty_Cases: Number of cases in bin
- BinLocationID: Foreign key to BinLocations_tbl
- CreatedAt: Timestamp of record creation (Central Time)
- LastUpdate: Timestamp of last modification (Central Time)

### SQLite Tables (Local)

**config** - Database connection settings
- server, port, database, username, password

## Installation

### Production Deployment (Ubuntu 24 Server)

**One-line install on clean Ubuntu 24 server:**

```bash
curl -fsSL https://raw.githubusercontent.com/ruolez/bin-locations/main/install.sh | sudo bash
```

**Features:**
- Installs all dependencies (Docker, NGINX, Git)
- Configures NGINX reverse proxy on port 80
- Auto-detects server IP for configuration
- Interactive menu for install/update/remove
- Preserves data on updates
- Production-ready with auto-restart

**See:** `DEPLOYMENT.md` and `INSTALL.md` for full documentation

---

### Local Development

**Prerequisites:**
- Docker and Docker Compose installed
- MS SQL Server with BackOffice database
- Network access to SQL Server

**Quick Start:**

1. Clone or download this repository

2. Navigate to project directory:
```bash
cd bin-locations
```

3. Build and start the Docker container:
```bash
docker-compose up -d --build
```

4. Access the application at http://localhost:5556

5. Configure database connection:
   - Navigate to Settings page
   - Enter SQL Server connection details
   - Test connection
   - Save configuration

## Usage

### First Time Setup

1. Go to **Settings** page
2. Enter your SQL Server connection details:
   - Server address (IP or hostname)
   - Port (default: 1433)
   - Database name
   - Username and password
3. Click **Test Connection** to verify
4. Click **Save Configuration**

### Managing Bin Locations

**View Records:**
- Main page displays all bin location assignments
- Top summary bar shows: Total Cases, Total Items, Records Shown
- Use search box to filter by bin location or product name
- Totals update dynamically with filter
- Click refresh button (🔄) to reload data
- Bottom footer shows totals for Case Quantity and Total Quantity

**Add New Record:**
1. Click **Add New Record** button
2. **Search for bin location** by typing (autocomplete dropdown)
3. Search for product by typing description (autocomplete dropdown)
4. Enter quantity per case (updates Items_tbl.UnitQty2)
5. Enter number of cases
6. Click **Save** - timestamps stored in Central Time

**Edit Record:**
1. Click **Edit** button on any row
2. Modify any field as needed
3. Click **Save**

**Adjust Quantities:**
- Click **➕** to add cases (opens modal for positive adjustment)
- Click **➖** to remove cases (opens modal for negative adjustment)
- Enter adjustment amount and save

### Understanding the Columns

- **Bin Location**: Warehouse bin identifier
- **Product Name**: Product description
- **Case Quantity**: Number of cases in this bin
- **Qty per Case**: Units per case (from Items_tbl.UnitQty2)
  - Shows "Not Set" if null/zero
  - Can be set when adding/editing records
- **Total Quantity**: Calculated as Case Quantity × Qty per Case
  - Shows "—" if qty per case is not set

## Development

### Project Structure

```
bin-locations/
├── docker-compose.yml       # Docker configuration
├── Dockerfile              # Python 3.11 + FreeTDS
├── requirements.txt        # Python dependencies
├── app/
│   ├── __init__.py
│   ├── main.py            # Flask app + API routes
│   ├── database.py        # Database managers
│   ├── static/
│   │   ├── css/style.css  # Material Design 3 styles
│   │   └── js/
│   │       ├── app.js     # Main page logic
│   │       └── settings.js # Settings page logic
│   └── templates/
│       ├── index.html     # Main page
│       └── settings.html  # Settings page
└── data/                  # SQLite database (gitignored)
    └── config.db
```

### API Endpoints

**Configuration:**
- `GET /api/config` - Get DB config (no password)
- `POST /api/config` - Save DB config
- `POST /api/config/test` - Test connection

**Bin Locations:**
- `GET /api/bin-locations` - Get all records with JOINs
- `POST /api/bin-locations` - Create new record
- `PUT /api/bin-locations/<id>` - Update record
- `PATCH /api/bin-locations/<id>/adjust` - Adjust quantity
- `DELETE /api/bin-locations/<id>` - Delete record

**Lookup:**
- `GET /api/products/search?q=<query>` - Search products
- `GET /api/bins` - Get all bin locations

### Making Changes

**Backend Changes:**
```bash
docker-compose restart
```

**Frontend Changes:**
- JavaScript/CSS changes: Just refresh browser (no cache)
- HTML template changes: Restart container

**Database Changes:**
- SQLite (config.db) is persisted in `./data` directory
- SQL Server changes require appropriate permissions

## Configuration

### Environment Variables

Set in docker-compose.yml if needed:
- `FLASK_ENV=development` (already set)
- `PYTHONUNBUFFERED=1` (already set)

### Volumes

- `./data:/app/data` - Persists SQLite config database
- `./app:/app/app` - Live code reload during development

## Null Value Handling

The application gracefully handles null/empty values:

- **UnitQty2 (Qty per Case)**: Defaults to 0, displays as "Not Set" in UI
- **Total Quantity**: Shows "—" when qty per case is not set
- **Product Descriptions**: Shows "N/A" for missing values
- **Bin Locations**: Shows "N/A" for missing values
- **Case Quantities**: Defaults to 0 if null

## Troubleshooting

### Cannot connect to SQL Server

1. Verify SQL Server is running and accessible
2. Check firewall rules allow port 1433
3. Confirm SQL Server authentication is enabled
4. Verify username/password are correct
5. Test connection from Settings page

### FreeTDS connection issues

FreeTDS is included in Docker image for SQL Server compatibility. If issues persist:
- Check SQL Server version compatibility
- Review container logs: `docker-compose logs`

### Empty table on main page

1. Verify database configuration in Settings
2. Test connection to ensure it's successful
3. Check that Items_BinLocations table exists
4. Verify user has SELECT permissions

### Changes not reflecting

1. Click refresh button (🔄) on main page
2. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
3. Check browser console for errors (F12)

## Security Notes

- SQL Server credentials stored in local SQLite database
- Passwords not returned via API
- No password caching in browser
- Consider HTTPS for production deployments
- Restrict network access to application port

## Color Scheme

Material Design 3 palette:
- Primary: #1a73e8 (Google Blue)
- Background: #f8f9fa (Light gray)
- Surface: #ffffff (White)
- Error: #d93025 (Red)
- Success: #1e8e3e (Green)

## License

Copyright © 2025. All rights reserved.

## Support

For issues or questions, please contact your system administrator.
