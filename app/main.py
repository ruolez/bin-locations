from flask import Flask, render_template, jsonify, request, session, redirect, url_for
from flask_session import Session
from functools import wraps
from app.database import SQLiteManager, MSSQLManager
import traceback
import os

app = Flask(__name__)

# Session configuration
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = '/app/data/flask_session'
app.config['SESSION_PERMANENT'] = False
Session(app)

# Initialize database managers
sqlite_manager = SQLiteManager()
mssql_manager = MSSQLManager(sqlite_manager)


# ============================================================================
# Authentication Decorator
# ============================================================================

def login_required(f):
    """Decorator to require login for protected routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            if request.is_json:
                return jsonify({'success': False, 'message': 'Authentication required', 'auth_required': True}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


@app.after_request
def add_no_cache_headers(response):
    """Add no-cache headers to all responses"""
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


# ============================================================================
# Page Routes
# ============================================================================

@app.route('/login')
def login():
    """Login page"""
    return render_template('login.html')


@app.route('/')
@login_required
def index():
    """Main page - Bin Locations Management"""
    return render_template('index.html', username=session.get('username'))


@app.route('/history')
@login_required
def history():
    """History page - Operation History"""
    return render_template('history.html', username=session.get('username'))


@app.route('/settings')
@login_required
def settings():
    """Settings page - Database Configuration"""
    return render_template('settings.html', username=session.get('username'))


# ============================================================================
# Configuration API
# ============================================================================

@app.route('/api/config', methods=['GET'])
def get_config():
    """Get MSSQL configuration (without password)"""
    try:
        config = sqlite_manager.get_config()
        if config:
            # Don't return password
            return jsonify({
                'success': True,
                'config': {
                    'server': config['server'],
                    'port': config['port'],
                    'database': config['database'],
                    'username': config['username']
                }
            })
        return jsonify({'success': True, 'config': None})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/config', methods=['POST'])
def save_config():
    """Save MSSQL configuration"""
    try:
        data = request.json
        sqlite_manager.save_config(data)
        return jsonify({'success': True, 'message': 'Configuration saved successfully'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/config/test', methods=['POST'])
def test_connection():
    """Test MSSQL connection"""
    try:
        # Temporarily save config for testing
        data = request.json
        sqlite_manager.save_config(data)

        # Test connection
        result = mssql_manager.test_connection()
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ============================================================================
# Authentication API
# ============================================================================

@app.route('/api/login', methods=['POST'])
def api_login():
    """Authenticate user"""
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'success': False, 'message': 'Username and password required'}), 400

        user = mssql_manager.verify_user_credentials(username, password)

        if user:
            session['username'] = user['username']
            session['auto_id'] = user['auto_id']
            session['employee_id'] = user['employee_id']
            return jsonify({'success': True, 'message': 'Login successful', 'username': user['username']})
        else:
            return jsonify({'success': False, 'message': 'Invalid username or password'}), 401

    except Exception as e:
        error_msg = str(e)
        if 'configuration not found' in error_msg.lower():
            return jsonify({
                'success': False,
                'message': 'Database not configured. Please configure the connection first.',
                'needs_config': True
            }), 400
        return jsonify({'success': False, 'message': error_msg}), 500


@app.route('/api/logout', methods=['POST'])
def api_logout():
    """Logout user"""
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})


@app.route('/api/current-user', methods=['GET'])
@login_required
def get_current_user():
    """Get current logged-in user"""
    return jsonify({
        'success': True,
        'username': session.get('username'),
        'auto_id': session.get('auto_id'),
        'employee_id': session.get('employee_id')
    })


# ============================================================================
# Bin Locations API
# ============================================================================

@app.route('/api/bin-locations', methods=['GET'])
@login_required
def get_bin_locations():
    """Get all bin location records"""
    try:
        records = mssql_manager.get_bin_locations()
        return jsonify({'success': True, 'data': records})
    except Exception as e:
        error_msg = str(e)
        if 'configuration not found' in error_msg.lower():
            return jsonify({
                'success': False,
                'message': 'Database not configured. Please go to Settings to configure the connection.',
                'needs_config': True
            }), 400
        return jsonify({'success': False, 'message': error_msg}), 500


@app.route('/api/bin-locations', methods=['POST'])
@login_required
def create_bin_location():
    """Create new bin location record"""
    try:
        data = request.json

        # Validate required fields
        if not data.get('product_upc'):
            return jsonify({'success': False, 'message': 'Product is required'}), 400
        if not data.get('bin_location_id'):
            return jsonify({'success': False, 'message': 'Bin location is required'}), 400

        result = mssql_manager.create_bin_location(data, session['username'])
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/bin-locations/<int:record_id>', methods=['PUT'])
@login_required
def update_bin_location(record_id):
    """Update bin location record"""
    try:
        data = request.json

        # Validate required fields
        if not data.get('product_upc'):
            return jsonify({'success': False, 'message': 'Product is required'}), 400
        if not data.get('bin_location_id'):
            return jsonify({'success': False, 'message': 'Bin location is required'}), 400

        result = mssql_manager.update_bin_location(record_id, data, session['username'])
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/bin-locations/<int:record_id>/adjust', methods=['PATCH'])
@login_required
def adjust_quantity(record_id):
    """Adjust case quantity"""
    try:
        data = request.json
        adjustment = data.get('adjustment', 0)
        notes = data.get('notes')

        if adjustment == 0:
            return jsonify({'success': False, 'message': 'Adjustment cannot be zero'}), 400

        result = mssql_manager.adjust_quantity(record_id, adjustment, session['username'], notes)
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/bin-locations/<int:record_id>', methods=['DELETE'])
@login_required
def delete_bin_location(record_id):
    """Delete bin location record"""
    try:
        result = mssql_manager.delete_bin_location(record_id, session['username'])
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ============================================================================
# Lookup API
# ============================================================================

@app.route('/api/products/search', methods=['GET'])
@login_required
def search_products():
    """Search products by description"""
    try:
        query = request.args.get('q', '')
        if len(query) < 2:
            return jsonify({'success': True, 'data': []})

        products = mssql_manager.search_products(query)
        return jsonify({'success': True, 'data': products})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/bins', methods=['GET'])
@login_required
def get_bins():
    """Get all bin locations"""
    try:
        bins = mssql_manager.get_all_bins()
        return jsonify({'success': True, 'data': bins})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ============================================================================
# History API
# ============================================================================

@app.route('/api/history', methods=['GET'])
@login_required
def get_history():
    """Get history records with optional filtering"""
    try:
        record_id = request.args.get('record_id', type=int)
        operation_type = request.args.get('operation_type')
        username = request.args.get('username')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = request.args.get('limit', 500, type=int)

        records = mssql_manager.get_history_records(
            record_id=record_id,
            operation_type=operation_type,
            username=username,
            start_date=start_date,
            end_date=end_date,
            limit=limit
        )

        return jsonify({'success': True, 'data': records})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/history/stats', methods=['GET'])
@login_required
def get_history_stats():
    """Get history statistics"""
    try:
        stats = mssql_manager.get_history_stats()
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ============================================================================
# Health Check
# ============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})


# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors"""
    return jsonify({'success': False, 'message': 'Resource not found'}), 404


@app.errorhandler(500)
def server_error(e):
    """Handle 500 errors"""
    return jsonify({'success': False, 'message': 'Internal server error'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
