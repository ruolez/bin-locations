# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bin Locations Management System: A Flask web application for managing warehouse inventory across bin locations with MS SQL Server backend and Material Design 3 UI. The application tracks inventory items, case quantities, and provides comprehensive audit history of all operations.

**Key Features:**
- Bin location and inventory tracking with dual-table updates (Items_BinLocations + Items_tbl.UnitQty2)
- Comprehensive audit trail (CREATE, UPDATE, ADJUST, DELETE operations)
- Authentication via Trustees_tbl
- Central Time (Chicago) timezone for all timestamps
- Material Design 3 UI with bottom-positioned, semi-transparent toast notifications

## Development Commands

### Container Management
```bash
# Start the application
docker-compose up -d --build

# Restart after backend changes
docker-compose restart

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

### Access Points
- **Application**: http://localhost:5556
- **Default Port**: 5556 (maps to internal Flask port 5000)

### Code Changes
- **Backend (Python)**: Requires `docker-compose restart`
- **Frontend (JS/CSS)**: Browser refresh only (no-cache headers enabled)
- **Templates (HTML)**: Requires `docker-compose restart`

## Architecture

### Technology Stack
- **Backend**: Python 3.11 + Flask + Flask-Session
- **Frontend**: Vanilla JavaScript (no frameworks), HTML5, CSS3
- **Databases**:
  - **SQLite**: Local configuration storage (`./data/config.db`)
  - **MS SQL Server**: Main inventory database (via pymssql + FreeTDS)
- **Deployment**: Docker + Docker Compose

### Database Architecture

**Critical Design Pattern - Dual Table Updates:**
This application updates TWO tables simultaneously for product quantities:
1. `Items_BinLocations.Qty_Cases` - Number of cases in bin
2. `Items_tbl.UnitQty2` - Quantity per case (shared across all records for same product)

Both updates must occur in the same transaction. See `database.py:create_bin_location()` and `database.py:update_bin_location()` for implementation pattern.

**MS SQL Server Tables:**
- `Items_tbl` - Product master data (ProductUPC, ProductDescription, UnitQty2)
- `BinLocations_tbl` - Warehouse bin locations
- `Items_BinLocations` - Main tracking table (Qty_Cases, CreatedAt, LastUpdate)
- `Items_BinLocations_History` - Audit trail (all operations with before/after state)
- `Trustees_tbl` - User authentication (Login_name, Password)

**SQLite Tables:**
- `config` - Database connection settings (server, port, database, username, password)

### Authentication System

**Session Management:**
- Flask-Session with filesystem backend (`/app/data/flask_session`)
- Non-permanent sessions (clear on browser close)
- User credentials validated against `Trustees_tbl` (Login_name, Password, acDsbld=0)
- `@login_required` decorator protects all main routes
- Returns 401 with `auth_required: true` for API calls when not authenticated

**User Data in Session:**
```python
session['username']      # Login_name
session['auto_id']       # Trustees_tbl.AutoID
session['employee_id']   # Trustees_tbl.EmployeeID
```

### History/Audit Trail System

**Operation Types:**
- `CREATE` - New record added (stores NewX fields only)
- `UPDATE` - Record modified (stores both PreviousX and NewX fields)
- `ADJUST` - Quantity adjustment (stores both states + AdjustmentAmount + optional Notes)
- `DELETE` - Record removed (stores PreviousX fields only)

**History Recording Pattern:**
Every CRUD operation in `database.py` calls `insert_history_record()` with:
- `record_id` - Items_BinLocations.id
- `operation_type` - One of: CREATE, UPDATE, ADJUST, DELETE
- `username` - From session (Trustees_tbl.Login_name)
- `previous_state` - Dict with before values (UPDATE/ADJUST/DELETE)
- `new_state` - Dict with after values (CREATE/UPDATE/ADJUST)
- `adjustment_amount` - Optional +/- value (ADJUST only)
- `notes` - Optional user notes (ADJUST only)

**Example:**
```python
# In adjust_quantity():
previous_state = {
    'ProductUPC': record['ProductUPC'],
    'Qty_Cases': record['Qty_Cases'],
    'UnitQty2': record['UnitQty2']
}
new_state = {
    'ProductUPC': record['ProductUPC'],
    'Qty_Cases': new_qty_cases,
    'UnitQty2': record['UnitQty2']
}
self.insert_history_record(
    record_id=record_id,
    operation_type='ADJUST',
    username=username,
    previous_state=previous_state,
    new_state=new_state,
    adjustment_amount=adjustment,
    notes=notes
)
```

### Timezone Handling (CRITICAL)

**All timestamps MUST be in Central Time (America/Chicago).**

**Correct Pattern:**
```python
from datetime import datetime
from zoneinfo import ZoneInfo

# Get Central Time as naive datetime (SQL Server doesn't handle timezone-aware)
central_time = datetime.now(ZoneInfo("America/Chicago")).replace(tzinfo=None)
```

**Why `.replace(tzinfo=None)`?**
- pymssql strips timezone info from timezone-aware datetime objects
- SQL Server interprets the result as server time (usually UTC)
- This causes 8-hour discrepancies
- Solution: Convert to Central Time FIRST, then strip timezone info

**Applied in:**
- `database.py:create_bin_location()` - Line ~150
- `database.py:update_bin_location()` - Line ~208
- `database.py:adjust_quantity()` - Line ~266
- `database.py:insert_history_record()` - Line ~409

**Frontend Timestamp Parsing:**
- API returns timestamps in HTTP date format: `"Mon, 03 Nov 2025 18:58:07 GMT"` (actually Central Time, not GMT)
- `history.js:formatTimestamp()` parses this directly without Date object to avoid timezone interpretation
- Displays as: `"Nov 3, 2025, 06:58:07 PM"`

### Toast Notification System

**Location and Styling:**
- Positioned at **bottom-right** of screen (not top)
- Semi-transparent background: `rgba(255, 255, 255, 0.95)` with `backdrop-filter: blur(10px)`
- Gentle animations: fade in from bottom (0.4s), fade out to bottom (0.3s)

**Implementation:**
- CSS: `style.css` lines 459-508 (`.toast-container`, `.toast`, animations)
- JavaScript: `showToast(message, type)` in both `app.js` and `settings.js`
- Types: `success` (green), `error` (red), `warning` (yellow)
- Duration: 4.5 seconds visible + 0.3s fade out

**Pattern:**
```javascript
showToast('Record saved successfully', 'success');
showToast('Connection failed', 'error');
showToast('Please configure database', 'warning');
```

### API Response Patterns

**Standard Success Response:**
```json
{
  "success": true,
  "message": "Operation completed",
  "data": { ... }
}
```

**Standard Error Response:**
```json
{
  "success": false,
  "message": "Error description"
}
```

**Authentication Error (401):**
```json
{
  "success": false,
  "message": "Authentication required",
  "auth_required": true
}
```

Frontend checks `handleAuthError(response)` which redirects to `/login` on 401.

### No-Cache Headers

All responses include aggressive no-cache headers (see `main.py:add_no_cache_headers()`):
```
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
Pragma: no-cache
Expires: 0
```

This ensures instant updates without browser refresh issues.

### Null Value Handling

The application gracefully handles null/missing values:
- `UnitQty2`: SQL uses `ISNULL(UnitQty2, 0)`, UI displays "Not Set"
- `Total Quantity`: Shows "—" when UnitQty2 is null/zero
- Product/Bin names: Shows "N/A" for null values
- All nullable fields use `|| '-'` or similar patterns in frontend

### Database Queries (IMPORTANT)

**Always use `dbo.` schema prefix for SQL Server tables:**
```sql
-- CORRECT
SELECT * FROM dbo.Items_BinLocations_History

-- INCORRECT (causes "Invalid object name" error)
SELECT * FROM Items_BinLocations_History
```

**SQL Server ORDER BY Rule:**
TOP clause must be in the main SELECT, not in a subquery:
```sql
-- CORRECT
SELECT TOP 500 * FROM dbo.MyTable ORDER BY Timestamp DESC

-- INCORRECT (causes error 1033)
SELECT * FROM (SELECT * FROM dbo.MyTable ORDER BY Timestamp DESC) AS sub
```

### Slate-Cyan Professional Color Palette (2025)

**Design Philosophy:** Industrial warehouse-appropriate colors with complete light/dark mode consistency. Colors chosen for reduced eye strain, color-blind safety, and professional brand perception.

**Light Mode:**
```css
--primary: #546e7a;           /* Slate blue-gray - industrial professionalism */
--primary-hover: #455a64;
--primary-light: #eceff1;
--success: #00897b;           /* Rich teal - warehouse-appropriate */
--error: #c64a3a;             /* Terracotta-red - serious, earthy */
--warning: #f9a825;           /* Honey gold - warm, visible */
--info: #1e88e5;              /* Steel blue - vibrant, clear */
--focus: #546e7a;             /* Slate - consistent with primary */
```

**Dark Mode:**
```css
--primary: #78909c;           /* Slate blue-gray - professional, calm */
--primary-hover: #90a4ae;
--primary-light: #1e2528;
--success: #26a69a;           /* Deep teal - industrial */
--error: #d77a61;             /* Terracotta - earthy, serious */
--warning: #ffca28;           /* Honey gold - warm attention */
--info: #64b5f6;              /* Steel blue - neutral, clear */
--focus: #64b5f6;             /* Steel blue - consistent */
--background: #121314;        /* Material Design #121212 + warm undertone */
--surface: #1e1f22;           /* Warm-tinted dark gray */
```

**Color Principles:**
- **20-30% desaturated** vs standard colors (reduces optical vibration on dark backgrounds)
- **Same color families** in both modes (teal, terracotta, honey gold)
- **Material Design 3 #121212** dark background standard (not pure black)
- **Warm undertones** in all grays (reduces sterile clinical feel)
- **Color-blind safe**: Teal vs terracotta provides excellent contrast
- **WCAG AAA compliant**: All colors meet 7:1+ contrast ratios
- **Status icons included**: ✓ success, ✕ error, ⚠ warning, ℹ info

### Typography - Monospace Font for Data

**JetBrains Mono** is applied to all numerical/data columns for improved readability:

```css
font-family: "JetBrains Mono", "Consolas", "Monaco", monospace;
font-variant-numeric: tabular-nums;  /* Aligns numbers in tables */
letter-spacing: -0.02em;
```

**Applied to:**
- **Main page table**: Columns 3, 4, 5 (Case Quantity, Qty per Case, Total Quantity)
- **History page table**: Column 4 (Product UPC), Column 7 (Changes with quantities)
- **All data values**: `.data-value`, `.card-info-value`, `.summary-value` classes
- **Change details**: `.change-details` class in history

**Why:** Tabular numbers align perfectly in columns, improving scannability for warehouse workers dealing with large datasets.

## File Structure

```
bin-locations/
├── app/
│   ├── main.py              # Flask app + all routes (login, bin-locations CRUD, history, config)
│   ├── database.py          # SQLiteManager + MSSQLManager with history recording
│   ├── static/
│   │   ├── css/style.css    # Material Design 3 styles
│   │   └── js/
│   │       ├── app.js       # Main page: CRUD, autocomplete, totals calculation
│   │       ├── settings.js  # Settings page: DB config, connection test
│   │       └── history.js   # History page: filtering, timestamp formatting
│   └── templates/
│       ├── login.html       # Authentication page
│       ├── index.html       # Main bin locations page
│       ├── settings.html    # Database configuration
│       └── history.html     # Audit trail page
├── data/                    # Persistent SQLite database (gitignored)
│   ├── config.db
│   └── flask_session/
├── setup_tables.sql         # Items_BinLocations table creation
├── setup_tables_history.sql # Items_BinLocations_History table + indexes
└── docker-compose.yml       # Port 5556 mapping, volume mounts
```

## Common Patterns and Gotchas

### Adding a New CRUD Operation

1. Add route in `main.py` with `@login_required` decorator
2. Extract `username` from session: `session.get('username')`
3. Call database method with username parameter
4. In database method, record history via `insert_history_record()`
5. Return standard JSON response with `success` and `message`
6. Add frontend API call with `handleAuthError(response)` check
7. Show toast notification on success/error

### Adding a New API Endpoint

Always include authentication and error handling:
```python
@app.route('/api/my-endpoint', methods=['POST'])
@login_required
def my_endpoint():
    try:
        username = session.get('username')
        # ... operation ...
        return jsonify({'success': True, 'message': 'Success'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
```

### Database Connection Issues

**FreeTDS Driver:**
- Included in Dockerfile for SQL Server compatibility
- Required for older SQL Server versions
- Uses pymssql Python library

**Connection String Pattern (in MSSQLManager):**
```python
pymssql.connect(
    server=config['server'],
    port=config['port'],
    database=config['database'],
    user=config['username'],
    password=config['password']
)
```

### Frontend Autocomplete Pattern

Used for bin locations and products. See `app.js`:
- Debounced input (300ms for products, 200ms for bins)
- Dropdown shows on 1+ characters
- Click outside to close
- Keyboard navigation not implemented

## SQL Setup Scripts

**Initial Tables:**
```bash
# Run against SQL Server database
sqlcmd -S server -d database -U username -P password -i setup_tables.sql
```

**History Table (if not exists):**
```bash
sqlcmd -S server -d database -U username -P password -i setup_tables_history.sql
```

## Testing Authentication

**Create Test User in SQL Server:**
```sql
INSERT INTO Trustees_tbl (Login_name, Password, acDsbld)
VALUES ('testuser', 'testpass', 0);
```

**Login at:** http://localhost:5556/login

## Important Notes for Development

1. **Always update BOTH tables** when modifying product quantities (Items_BinLocations + Items_tbl)
2. **Always record history** for all CRUD operations
3. **Always use Central Time** for timestamps with `.replace(tzinfo=None)`
4. **Always use `dbo.` prefix** for SQL Server table names
5. **Always include `@login_required`** decorator on protected routes
6. **Always pass `username`** from session to database methods
7. **Toast notifications** appear at bottom-right with transparency
8. **No caching** - all responses have no-cache headers

## References

- **Database Schema**: See `dbschema.MD` for full table structures
- **History Setup**: See `setup_tables_history.sql` for audit table structure
- **README**: See `README.md` for user-facing documentation
