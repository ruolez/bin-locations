# Changes Made to Bin Locations Management

## November 3, 2025 - Updates

### 1. Central Time (Chicago) Implementation

**Changed**: All timestamps now use Central Time (America/Chicago) instead of server time.

**Files Modified**:
- `app/database.py`
  - Added imports: `datetime`, `ZoneInfo`
  - Updated `create_bin_location()` - explicitly sets both `CreatedAt` and `LastUpdate` to Central Time
  - Updated `update_bin_location()` - uses `datetime.now(ZoneInfo("America/Chicago"))` for `LastUpdate`
  - Updated `adjust_quantity()` - uses `datetime.now(ZoneInfo("America/Chicago"))` for `LastUpdate`

**Impact**:
- All `CreatedAt` timestamps are now recorded in Central Time (was using server default)
- All `LastUpdate` timestamps are now recorded in Central Time
- Timestamps include timezone offset (-05:00 or -06:00)
- Consistent with other applications (Quotation-Scan, Picklist-Quotation)
- **Important**: New records explicitly set `CreatedAt` - overrides database default constraint

### 2. Searchable Bin Locations

**Changed**: Bin location field changed from dropdown select to searchable autocomplete input.

**Files Modified**:
- `app/templates/index.html`
  - Replaced `<select id="binLocationSelect">` with searchable input
  - Added autocomplete wrapper and dropdown
  - Added hidden field `binLocationId` to store selected ID

- `app/static/js/app.js`
  - Added `binSearchTimeout` global variable
  - Added event listeners for bin location search
  - Removed `populateBinSelect()` function (no longer needed)
  - Added `handleBinLocationSearch()` - filters bins as user types
  - Added `displayBinLocationResults()` - shows filtered results
  - Added `selectBinLocation()` - handles bin selection
  - Updated `openAddModal()` - resets bin location fields
  - Updated `openEditModal()` - pre-fills bin location search
  - Updated `closeModal()` - closes bin dropdown
  - Updated `saveRecord()` - gets value from `binLocationId` hidden field
  - Updated dropdown close handler to include bin location dropdown

**Features**:
- Client-side filtering (instant results)
- Search by bin location name
- Debounced search (200ms delay)
- Shows bin ID in dropdown
- Minimum 1 character to trigger search

### 3. SQL Table Setup Script

**Added**: `setup_tables.sql`

**Purpose**:
- Creates `Items_BinLocations` table if it doesn't exist
- Includes all required fields and constraints
- Verifies table structure after creation

**Usage**:
```sql
-- Run in your BackOffice database
sqlcmd -S your_server -d BackOffice -i setup_tables.sql
```

Or run directly in SQL Server Management Studio.

## Testing Notes

### Before Testing:
1. Restart Docker container: `docker-compose restart`
2. Create missing table: Run `setup_tables.sql` in your BackOffice database
3. Clear browser cache: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### What to Test:

**Central Time Verification**:
1. Add a new record
2. Check `LastUpdate` field in database
3. Verify timestamp shows Central Time with timezone offset

**Searchable Bin Locations**:
1. Click "Add New Record"
2. Type in "Bin Location" field
3. Should see autocomplete dropdown with matching bins
4. Select a bin - should populate the field
5. Try editing a record - bin location should be searchable

## Compatibility Notes

- **Python 3.11+**: Required for `ZoneInfo` support
- **Docker**: Changes applied after restart
- **Browser**: Modern browsers with ES6 support

## Rollback Instructions

If you need to revert these changes:

1. **Central Time**: Replace `datetime.now(ZoneInfo("America/Chicago"))` with `GETDATE()` in SQL queries
2. **Searchable Bins**: Revert to dropdown by checking git history for `app/templates/index.html` and `app/static/js/app.js`

## Database Impact

- **No schema changes** to existing tables
- **New table required**: `Items_BinLocations` (use `setup_tables.sql`)
- **Timestamps**: All new/updated records will use Central Time

## Performance Impact

- **Bin Location Search**: Client-side filtering (no API calls) - very fast
- **Central Time**: Minimal overhead (one timezone conversion per operation)

## Future Enhancements

Consider adding:
- Server-side bin location search for large datasets (>1000 bins)
- Timezone configuration in Settings page
- Audit log with Central Time timestamps
- Export functionality with timezone-aware dates
