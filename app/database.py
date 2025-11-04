import sqlite3
import pymssql
from contextlib import contextmanager
from threading import Lock
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from zoneinfo import ZoneInfo


class SQLiteManager:
    """Manages SQLite database for local configuration storage"""

    def __init__(self, db_path: str = '/app/data/config.db'):
        self.db_path = db_path
        self.lock = Lock()
        self._init_db()

    def _init_db(self):
        """Initialize SQLite database with config table"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS config (
                    id INTEGER PRIMARY KEY,
                    server TEXT NOT NULL,
                    port INTEGER DEFAULT 1433,
                    database TEXT NOT NULL,
                    username TEXT NOT NULL,
                    password TEXT NOT NULL
                )
            ''')
            conn.commit()

    @contextmanager
    def get_connection(self):
        """Get SQLite connection with automatic cleanup"""
        conn = sqlite3.connect(self.db_path, timeout=30)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def save_config(self, config: Dict[str, Any]) -> bool:
        """Save MSSQL connection configuration"""
        with self.lock:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM config')
                cursor.execute('''
                    INSERT INTO config (id, server, port, database, username, password)
                    VALUES (1, ?, ?, ?, ?, ?)
                ''', (
                    config['server'],
                    config.get('port', 1433),
                    config['database'],
                    config['username'],
                    config['password']
                ))
                conn.commit()
                return True

    def get_config(self) -> Optional[Dict[str, Any]]:
        """Get MSSQL connection configuration"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM config WHERE id = 1')
            row = cursor.fetchone()
            if row:
                return {
                    'server': row['server'],
                    'port': row['port'],
                    'database': row['database'],
                    'username': row['username'],
                    'password': row['password']
                }
            return None


class MSSQLManager:
    """Manages MSSQL database connections and queries"""

    def __init__(self, sqlite_manager: SQLiteManager):
        self.sqlite_manager = sqlite_manager

    @contextmanager
    def get_connection(self):
        """Get MSSQL connection with automatic cleanup"""
        config = self.sqlite_manager.get_config()
        if not config:
            raise Exception("Database configuration not found. Please configure in Settings.")

        conn = pymssql.connect(
            server=config['server'],
            port=config['port'],
            database=config['database'],
            user=config['username'],
            password=config['password'],
            timeout=30,
            login_timeout=10
        )
        try:
            yield conn
        finally:
            conn.close()

    def test_connection(self) -> Dict[str, Any]:
        """Test MSSQL connection"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT 1')
                cursor.fetchone()
                return {'success': True, 'message': 'Connection successful'}
        except Exception as e:
            return {'success': False, 'message': str(e)}

    def get_bin_locations(self) -> List[Dict[str, Any]]:
        """Get all bin location records with JOINs"""
        with self.get_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            cursor.execute('''
                SELECT
                    ibl.id,
                    ibl.ProductUPC,
                    ibl.ProductDescription,
                    ibl.Qty_Cases,
                    ibl.BinLocationID,
                    bl.BinLocation,
                    ISNULL(it.UnitQty2, 0) as UnitQty2,
                    ibl.LastUpdate
                FROM Items_BinLocations ibl
                LEFT JOIN BinLocations_tbl bl ON ibl.BinLocationID = bl.BinLocationID
                LEFT JOIN Items_tbl it ON ibl.ProductUPC = it.ProductUPC
                ORDER BY bl.BinLocation, ibl.ProductDescription
            ''')
            rows = cursor.fetchall()

            # Calculate total quantity for each row
            for row in rows:
                qty_cases = row['Qty_Cases'] or 0
                unit_qty = row['UnitQty2'] or 0
                row['TotalQuantity'] = qty_cases * unit_qty if unit_qty > 0 else 0

            return rows

    def create_bin_location(self, data: Dict[str, Any], username: str) -> Dict[str, Any]:
        """Create new bin location record and update UnitQty2 if provided"""
        # Get current Central Time (naive datetime - SQL Server doesn't handle timezone-aware datetimes)
        central_time = datetime.now(ZoneInfo("America/Chicago")).replace(tzinfo=None)

        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Update UnitQty2 in Items_tbl if provided
            if data.get('qty_per_case') is not None and data.get('product_upc'):
                cursor.execute('''
                    UPDATE Items_tbl
                    SET UnitQty2 = %s
                    WHERE ProductUPC = %s
                ''', (data['qty_per_case'], data['product_upc']))

            # Insert into Items_BinLocations with Central Time for both CreatedAt and LastUpdate
            cursor.execute('''
                INSERT INTO Items_BinLocations
                (ProductUPC, ProductDescription, Qty_Cases, BinLocationID, CreatedAt, LastUpdate)
                VALUES (%s, %s, %s, %s, %s, %s);
                SELECT SCOPE_IDENTITY() AS new_id;
            ''', (
                data['product_upc'],
                data['product_description'],
                data.get('qty_cases', 0),
                data['bin_location_id'],
                central_time,
                central_time
            ))

            # Get the new record ID
            new_id = int(cursor.fetchone()[0])

            conn.commit()

        # Record history after commit
        new_state = {
            'ProductUPC': data['product_upc'],
            'ProductDescription': data['product_description'],
            'Qty_Cases': data.get('qty_cases', 0),
            'BinLocationID': data['bin_location_id'],
            'UnitQty2': data.get('qty_per_case', 0)
        }

        self.insert_history_record(
            record_id=new_id,
            operation_type='CREATE',
            username=username,
            previous_state=None,
            new_state=new_state
        )

        return {'success': True, 'message': 'Record created successfully'}

    def update_bin_location(self, record_id: int, data: Dict[str, Any], username: str) -> Dict[str, Any]:
        """Update bin location record and UnitQty2 if provided"""
        # Get before state for history
        previous_state = self._get_record_before_state(record_id)

        # Get current Central Time (naive datetime - SQL Server doesn't handle timezone-aware datetimes)
        central_time = datetime.now(ZoneInfo("America/Chicago")).replace(tzinfo=None)

        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Update UnitQty2 in Items_tbl if provided
            if data.get('qty_per_case') is not None and data.get('product_upc'):
                cursor.execute('''
                    UPDATE Items_tbl
                    SET UnitQty2 = %s
                    WHERE ProductUPC = %s
                ''', (data['qty_per_case'], data['product_upc']))

            # Update Items_BinLocations
            cursor.execute('''
                UPDATE Items_BinLocations
                SET ProductUPC = %s,
                    ProductDescription = %s,
                    Qty_Cases = %s,
                    BinLocationID = %s,
                    LastUpdate = %s
                WHERE id = %s
            ''', (
                data['product_upc'],
                data['product_description'],
                data.get('qty_cases', 0),
                data['bin_location_id'],
                central_time,
                record_id
            ))

            conn.commit()

        # Record history after commit
        new_state = {
            'ProductUPC': data['product_upc'],
            'ProductDescription': data['product_description'],
            'Qty_Cases': data.get('qty_cases', 0),
            'BinLocationID': data['bin_location_id'],
            'UnitQty2': data.get('qty_per_case', 0)
        }

        self.insert_history_record(
            record_id=record_id,
            operation_type='UPDATE',
            username=username,
            previous_state=previous_state,
            new_state=new_state
        )

        return {'success': True, 'message': 'Record updated successfully'}

    def adjust_quantity(self, record_id: int, adjustment: int, username: str, notes: Optional[str] = None) -> Dict[str, Any]:
        """Adjust case quantity by adding or removing cases"""
        # Get before state for history
        previous_state = self._get_record_before_state(record_id)

        # Get current Central Time (naive datetime - SQL Server doesn't handle timezone-aware datetimes)
        central_time = datetime.now(ZoneInfo("America/Chicago")).replace(tzinfo=None)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE Items_BinLocations
                SET Qty_Cases = ISNULL(Qty_Cases, 0) + %s,
                    LastUpdate = %s
                WHERE id = %s
            ''', (adjustment, central_time, record_id))

            conn.commit()

        # Calculate new quantity
        new_qty_cases = (previous_state['Qty_Cases'] or 0) + adjustment

        # Record history after commit
        new_state = {
            'ProductUPC': previous_state['ProductUPC'],
            'ProductDescription': previous_state['ProductDescription'],
            'Qty_Cases': new_qty_cases,
            'BinLocationID': previous_state['BinLocationID'],
            'UnitQty2': previous_state['UnitQty2']
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

        return {'success': True, 'message': 'Quantity adjusted successfully'}

    def delete_bin_location(self, record_id: int, username: str) -> Dict[str, Any]:
        """Delete bin location record"""
        # Get before state for history
        previous_state = self._get_record_before_state(record_id)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM Items_BinLocations WHERE id = %s', (record_id,))
            conn.commit()

        # Record history after commit
        self.insert_history_record(
            record_id=record_id,
            operation_type='DELETE',
            username=username,
            previous_state=previous_state,
            new_state=None
        )

        return {'success': True, 'message': 'Record deleted successfully'}

    def search_products(self, query: str) -> List[Dict[str, Any]]:
        """Search products by description"""
        with self.get_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            cursor.execute('''
                SELECT TOP 50
                    ProductID,
                    ProductUPC,
                    ProductDescription,
                    ISNULL(UnitQty2, 0) as UnitQty2
                FROM Items_tbl
                WHERE ProductDescription LIKE %s
                AND ProductDescription IS NOT NULL
                ORDER BY ProductDescription
            ''', (f'%{query}%',))
            return cursor.fetchall()

    def get_all_bins(self) -> List[Dict[str, Any]]:
        """Get all bin locations"""
        with self.get_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            cursor.execute('''
                SELECT BinLocationID, BinLocation
                FROM BinLocations_tbl
                WHERE BinLocation IS NOT NULL
                ORDER BY BinLocation
            ''')
            return cursor.fetchall()

    # ========================================================================
    # Authentication Methods
    # ========================================================================

    def verify_user_credentials(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Verify user credentials against Trustees_tbl"""
        with self.get_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            cursor.execute('''
                SELECT AutoID, EmployeeID, Login_name
                FROM Trustees_tbl
                WHERE Login_name = %s AND Password = %s AND ISNULL(acDsbld, 0) = 0
            ''', (username, password))
            row = cursor.fetchone()
            if row:
                return {
                    'auto_id': row['AutoID'],
                    'employee_id': row['EmployeeID'],
                    'username': row['Login_name']
                }
            return None

    # ========================================================================
    # History Recording Methods
    # ========================================================================

    def _get_record_before_state(self, record_id: int) -> Optional[Dict[str, Any]]:
        """Fetch complete record state before modification (for history tracking)"""
        with self.get_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            cursor.execute('''
                SELECT
                    ibl.id,
                    ibl.ProductUPC,
                    ibl.ProductDescription,
                    ibl.Qty_Cases,
                    ibl.BinLocationID,
                    ibl.CreatedAt,
                    ibl.LastUpdate,
                    ISNULL(it.UnitQty2, 0) as UnitQty2
                FROM Items_BinLocations ibl
                LEFT JOIN Items_tbl it ON ibl.ProductUPC = it.ProductUPC
                WHERE ibl.id = %s
            ''', (record_id,))
            return cursor.fetchone()

    def insert_history_record(self,
                            record_id: int,
                            operation_type: str,
                            username: str,
                            previous_state: Optional[Dict[str, Any]] = None,
                            new_state: Optional[Dict[str, Any]] = None,
                            adjustment_amount: Optional[int] = None,
                            notes: Optional[str] = None) -> None:
        """Insert history record for audit trail"""
        # Get current Central Time (naive datetime - SQL Server doesn't handle timezone-aware datetimes)
        central_time = datetime.now(ZoneInfo("America/Chicago")).replace(tzinfo=None)

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO dbo.Items_BinLocations_History (
                    RecordID, OperationType, Timestamp, Username,
                    PreviousProductUPC, PreviousProductDescription, PreviousQty_Cases,
                    PreviousBinLocationID, PreviousUnitQty2,
                    NewProductUPC, NewProductDescription, NewQty_Cases,
                    NewBinLocationID, NewUnitQty2,
                    AdjustmentAmount, Notes,
                    RecordCreatedAt, RecordLastUpdate
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
            ''', (
                record_id,
                operation_type,
                central_time,
                username,
                # Previous state
                previous_state['ProductUPC'] if previous_state else None,
                previous_state['ProductDescription'] if previous_state else None,
                previous_state['Qty_Cases'] if previous_state else None,
                previous_state['BinLocationID'] if previous_state else None,
                previous_state['UnitQty2'] if previous_state else None,
                # New state
                new_state['ProductUPC'] if new_state else None,
                new_state['ProductDescription'] if new_state else None,
                new_state['Qty_Cases'] if new_state else None,
                new_state['BinLocationID'] if new_state else None,
                new_state['UnitQty2'] if new_state else None,
                # Adjustment & notes
                adjustment_amount,
                notes,
                # Metadata
                previous_state['CreatedAt'] if previous_state else None,
                previous_state['LastUpdate'] if previous_state else None
            ))
            conn.commit()

    def get_history_records(self,
                           record_id: Optional[int] = None,
                           operation_type: Optional[str] = None,
                           username: Optional[str] = None,
                           start_date: Optional[str] = None,
                           end_date: Optional[str] = None,
                           limit: int = 500) -> List[Dict[str, Any]]:
        """Get history records with optional filtering"""
        with self.get_connection() as conn:
            cursor = conn.cursor(as_dict=True)

            # Build dynamic WHERE clause
            where_clauses = []
            params = []

            if record_id is not None:
                where_clauses.append('h.RecordID = %s')
                params.append(record_id)

            if operation_type and operation_type != 'ALL':
                where_clauses.append('h.OperationType = %s')
                params.append(operation_type)

            if username:
                where_clauses.append('h.Username = %s')
                params.append(username)

            if start_date:
                where_clauses.append('h.Timestamp >= %s')
                params.append(start_date)

            if end_date:
                where_clauses.append('h.Timestamp <= %s')
                params.append(end_date)

            where_sql = 'WHERE ' + ' AND '.join(where_clauses) if where_clauses else ''

            # Build query with TOP clause directly (not in subquery)
            top_clause = f'TOP {limit}' if limit else ''

            query = f'''
                SELECT {top_clause}
                    h.HistoryID,
                    h.RecordID,
                    h.OperationType,
                    h.Timestamp,
                    h.Username,
                    h.PreviousProductUPC,
                    h.PreviousProductDescription,
                    h.PreviousQty_Cases,
                    h.PreviousBinLocationID,
                    prev_bl.BinLocation as PreviousBinLocation,
                    h.PreviousUnitQty2,
                    h.NewProductUPC,
                    h.NewProductDescription,
                    h.NewQty_Cases,
                    h.NewBinLocationID,
                    new_bl.BinLocation as NewBinLocation,
                    h.NewUnitQty2,
                    h.AdjustmentAmount,
                    h.Notes
                FROM dbo.Items_BinLocations_History h
                LEFT JOIN dbo.BinLocations_tbl prev_bl ON h.PreviousBinLocationID = prev_bl.BinLocationID
                LEFT JOIN dbo.BinLocations_tbl new_bl ON h.NewBinLocationID = new_bl.BinLocationID
                {where_sql}
                ORDER BY h.Timestamp DESC
            '''

            cursor.execute(query, tuple(params))
            return cursor.fetchall()

    def get_history_stats(self) -> Dict[str, Any]:
        """Get summary statistics for history"""
        with self.get_connection() as conn:
            cursor = conn.cursor(as_dict=True)
            cursor.execute('''
                SELECT
                    COUNT(*) as total_operations,
                    SUM(CASE WHEN OperationType = 'CREATE' THEN 1 ELSE 0 END) as creates,
                    SUM(CASE WHEN OperationType = 'UPDATE' THEN 1 ELSE 0 END) as updates,
                    SUM(CASE WHEN OperationType = 'ADJUST' THEN 1 ELSE 0 END) as adjustments,
                    SUM(CASE WHEN OperationType = 'DELETE' THEN 1 ELSE 0 END) as deletes,
                    COUNT(DISTINCT Username) as unique_users,
                    MIN(Timestamp) as earliest_operation,
                    MAX(Timestamp) as latest_operation
                FROM dbo.Items_BinLocations_History
            ''')
            return cursor.fetchone() or {}
