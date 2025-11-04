// Global state
let allRecords = [];
let allBins = [];
let currentEditId = null;
let productSearchTimeout = null;
let binSearchTimeout = null;
let currentView = 'table'; // 'table' or 'card'
let autocompleteHighlightedIndex = -1;
let autocompleteItems = [];

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
    loadBinLocations();
    loadBins();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', loadBinLocations);
    document.getElementById('addNewBtn').addEventListener('click', openAddModal);
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Dark mode toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
        themeManager.toggle();
    });

    // Search clear button
    document.getElementById('searchClear').addEventListener('click', clearSearch);

    // View toggle buttons
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            switchView(view);
        });
    });

    // Bin location search autocomplete
    const binLocationSearch = document.getElementById('binLocationSearch');
    binLocationSearch.addEventListener('input', handleBinLocationSearch);
    binLocationSearch.addEventListener('focus', handleBinLocationSearch);
    binLocationSearch.addEventListener('keydown', handleAutocompleteKeydown);

    // Product search autocomplete
    const productSearch = document.getElementById('productSearch');
    productSearch.addEventListener('input', handleProductSearch);
    productSearch.addEventListener('focus', handleProductSearch);
    productSearch.addEventListener('keydown', handleAutocompleteKeydown);

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-wrapper')) {
            document.getElementById('productDropdown').classList.remove('active');
            document.getElementById('binLocationDropdown').classList.remove('active');
        }
    });

    // Modal close on overlay click
    document.getElementById('recordModal').addEventListener('click', (e) => {
        if (e.target.id === 'recordModal') {
            closeModal();
        }
    });

    document.getElementById('adjustModal').addEventListener('click', (e) => {
        if (e.target.id === 'adjustModal') {
            closeAdjustModal();
        }
    });

    document.getElementById('deleteModal').addEventListener('click', (e) => {
        if (e.target.id === 'deleteModal') {
            closeDeleteModal();
        }
    });

    // Form submit handlers
    document.getElementById('recordForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveRecord();
    });

    document.getElementById('adjustForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveAdjustment();
    });

    // Register keyboard shortcuts
    registerKeyboardShortcuts();
}

// Load bin locations data
async function loadBinLocations() {
    showLoading();
    try {
        const response = await fetch('/api/bin-locations');
        if (handleAuthError(response)) return;
        const result = await response.json();

        if (result.success) {
            allRecords = result.data || [];
            renderTable(allRecords);
        } else {
            if (result.needs_config) {
                showToast('Please configure database connection in Settings', 'warning');
                setTimeout(() => {
                    window.location.href = '/settings';
                }, 2000);
            } else {
                showToast(result.message || 'Failed to load data', 'error');
            }
            allRecords = [];
            renderTable([]);
        }
    } catch (error) {
        showToast('Error connecting to server: ' + error.message, 'error');
        allRecords = [];
        renderTable([]);
    } finally {
        hideLoading();
    }
}

// Load bin locations dropdown
async function loadBins() {
    try {
        const response = await fetch('/api/bins');
        const result = await response.json();

        if (result.success) {
            allBins = result.data || [];
        }
    } catch (error) {
        console.error('Error loading bins:', error);
    }
}

// Render table
function renderTable(records) {
    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.querySelector('.table-container');
    const topSummary = document.getElementById('topSummary');
    const tableFoot = document.getElementById('tableFoot');
    const binTable = document.getElementById('binLocationsTable');

    if (records.length === 0) {
        tbody.innerHTML = '';
        tableContainer.style.display = 'none';
        emptyState.style.display = 'block';
        topSummary.style.display = 'none';
        tableFoot.style.display = 'none';
        return;
    }

    // Restore table if it was replaced by card grid
    if (!document.getElementById('binLocationsTable')) {
        tableContainer.innerHTML = `
            <table id="binLocationsTable">
                <thead>
                    <tr>
                        <th>Bin Location</th>
                        <th>Product Name</th>
                        <th>Case Quantity</th>
                        <th>Qty per Case</th>
                        <th>Total Quantity</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="tableBody">
                    <!-- Data will be populated by JavaScript -->
                </tbody>
                <tfoot id="tableFoot" style="display: none;">
                    <tr class="totals-row">
                        <td colspan="2" style="text-align: right;"><strong>Totals:</strong></td>
                        <td><strong id="footTotalCases">0</strong></td>
                        <td></td>
                        <td><strong id="footTotalItems">0</strong></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        `;
    }

    tableContainer.style.display = 'block';
    emptyState.style.display = 'none';
    topSummary.style.display = 'flex';

    // Re-get tbody reference after potential DOM recreation
    const newTbody = document.getElementById('tableBody');
    const newTableFoot = document.getElementById('tableFoot');
    newTableFoot.style.display = 'table-footer-group';

    // Calculate totals
    let totalCases = 0;
    let totalItems = 0;

    records.forEach(record => {
        totalCases += record.Qty_Cases || 0;
        totalItems += record.TotalQuantity || 0;
    });

    // Update top summary
    document.getElementById('topTotalCases').textContent = totalCases.toLocaleString();
    document.getElementById('topTotalItems').textContent = totalItems.toLocaleString();
    document.getElementById('topRecordCount').textContent = records.length.toLocaleString();

    // Update footer totals
    document.getElementById('footTotalCases').textContent = totalCases.toLocaleString();
    document.getElementById('footTotalItems').textContent = totalItems.toLocaleString();

    newTbody.innerHTML = records.map(record => {
        const binLocation = record.BinLocation || 'N/A';
        const productName = record.ProductDescription || 'N/A';
        const caseQty = record.Qty_Cases || 0;
        const qtyPerCase = record.UnitQty2 || 0;
        const totalQty = record.TotalQuantity || 0;

        // Display qty per case with indicator if not set
        const qtyPerCaseDisplay = qtyPerCase > 0
            ? qtyPerCase
            : '<span style="color: var(--text-secondary);">Not Set</span>';

        // Display total quantity
        const totalQtyDisplay = qtyPerCase > 0
            ? totalQty.toLocaleString()
            : '<span style="color: var(--text-secondary);">—</span>';

        return `
            <tr>
                <td><strong>${escapeHtml(binLocation)}</strong></td>
                <td>${escapeHtml(productName)}</td>
                <td>${caseQty.toLocaleString()}</td>
                <td>${qtyPerCaseDisplay}</td>
                <td>${totalQtyDisplay}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-secondary btn-small" onclick="openEditModal(${record.id})" title="Edit">
                            Edit
                        </button>
                        <button class="btn btn-primary btn-small" onclick="openAdjustModal(${record.id})" title="Adjust Case Quantity (Add or Remove)">
                            Adjust
                        </button>
                        <button class="btn btn-error btn-small" onclick="openDeleteModal(${record.id})" title="Delete Record">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Handle search/filter
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();

    if (!searchTerm) {
        if (currentView === 'table') {
            renderTable(allRecords);
        } else {
            renderCardView(allRecords);
        }
        return;
    }

    const filtered = allRecords.filter(record => {
        const binLocation = (record.BinLocation || '').toLowerCase();
        const productName = (record.ProductDescription || '').toLowerCase();
        return binLocation.includes(searchTerm) || productName.includes(searchTerm);
    });

    if (currentView === 'table') {
        renderTable(filtered);
    } else {
        renderCardView(filtered);
    }
}

// Open add modal
function openAddModal() {
    currentEditId = null;
    document.getElementById('modalTitle').textContent = 'Add New Record';
    document.getElementById('recordForm').reset();
    document.getElementById('recordId').value = '';
    document.getElementById('binLocationId').value = '';
    document.getElementById('productUPC').value = '';
    document.getElementById('productDescription').value = '';
    document.getElementById('productDropdown').classList.remove('active');
    document.getElementById('binLocationDropdown').classList.remove('active');
    document.getElementById('recordModal').classList.add('active');
}

// Open edit modal
async function openEditModal(recordId) {
    const record = allRecords.find(r => r.id === recordId);
    if (!record) {
        showToast('Record not found', 'error');
        return;
    }

    currentEditId = recordId;
    document.getElementById('modalTitle').textContent = 'Edit Record';
    document.getElementById('recordId').value = recordId;
    document.getElementById('binLocationSearch').value = record.BinLocation || '';
    document.getElementById('binLocationId').value = record.BinLocationID || '';
    document.getElementById('productSearch').value = record.ProductDescription || '';
    document.getElementById('productUPC').value = record.ProductUPC || '';
    document.getElementById('productDescription').value = record.ProductDescription || '';
    document.getElementById('qtyPerCase').value = record.UnitQty2 || '';
    document.getElementById('caseQuantity').value = record.Qty_Cases || 0;
    document.getElementById('recordModal').classList.add('active');
}

// Close modal
function closeModal() {
    document.getElementById('recordModal').classList.remove('active');
    document.getElementById('recordForm').reset();
    document.getElementById('productDropdown').classList.remove('active');
    document.getElementById('binLocationDropdown').classList.remove('active');
    currentEditId = null;
}

// Save record (create or update)
async function saveRecord() {
    const binLocationId = document.getElementById('binLocationId').value;
    const productUPC = document.getElementById('productUPC').value;
    const productDescription = document.getElementById('productDescription').value;
    const qtyPerCase = document.getElementById('qtyPerCase').value;
    const caseQuantity = document.getElementById('caseQuantity').value;

    if (!binLocationId) {
        showToast('Please select a bin location', 'error');
        return;
    }

    if (!productUPC) {
        showToast('Please select a product', 'error');
        return;
    }

    if (!caseQuantity) {
        showToast('Please enter case quantity', 'error');
        return;
    }

    const data = {
        bin_location_id: parseInt(binLocationId),
        product_upc: productUPC,
        product_description: productDescription,
        qty_per_case: qtyPerCase ? parseFloat(qtyPerCase) : null,
        qty_cases: parseInt(caseQuantity)
    };

    showLoading();

    try {
        const url = currentEditId
            ? `/api/bin-locations/${currentEditId}`
            : '/api/bin-locations';
        const method = currentEditId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showToast(result.message, 'success');
            closeModal();
            await loadBinLocations();
        } else {
            showToast(result.message || 'Failed to save record', 'error');
        }
    } catch (error) {
        showToast('Error saving record: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Handle bin location search
function handleBinLocationSearch(e) {
    const query = e.target.value.trim().toLowerCase();

    clearTimeout(binSearchTimeout);

    if (query.length < 1) {
        document.getElementById('binLocationDropdown').classList.remove('active');
        return;
    }

    binSearchTimeout = setTimeout(() => {
        const filtered = allBins.filter(bin => {
            const binName = (bin.BinLocation || '').toLowerCase();
            return binName.includes(query);
        });

        displayBinLocationResults(filtered);
    }, 200);
}

// Display bin location search results
function displayBinLocationResults(bins) {
    const dropdown = document.getElementById('binLocationDropdown');
    autocompleteHighlightedIndex = -1; // Reset highlight

    if (bins.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item">No bin locations found</div>';
        dropdown.classList.add('active');
        return;
    }

    dropdown.innerHTML = bins.map(bin => {
        const binName = bin.BinLocation || 'Unnamed Bin';
        const binId = bin.BinLocationID;

        return `
            <div class="autocomplete-item bin-location-item" data-bin-id="${binId}" data-bin-name="${escapeHtml(binName)}">
                <div>${escapeHtml(binName)}</div>
            </div>
        `;
    }).join('');

    dropdown.classList.add('active');

    // Attach event listeners to all bin location items
    dropdown.querySelectorAll('.bin-location-item').forEach(item => {
        item.addEventListener('click', function() {
            const binId = this.dataset.binId;
            const binName = this.dataset.binName;
            selectBinLocation(binId, binName);
        });
    });
}

// Select bin location from dropdown
function selectBinLocation(binId, binName) {
    document.getElementById('binLocationSearch').value = binName;
    document.getElementById('binLocationId').value = binId;
    document.getElementById('binLocationDropdown').classList.remove('active');
}

// Handle product search
async function handleProductSearch(e) {
    const query = e.target.value.trim();

    clearTimeout(productSearchTimeout);

    if (query.length < 2) {
        document.getElementById('productDropdown').classList.remove('active');
        return;
    }

    productSearchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
            const result = await response.json();

            if (result.success) {
                displayProductResults(result.data || []);
            }
        } catch (error) {
            console.error('Error searching products:', error);
        }
    }, 300);
}

// Display product search results
function displayProductResults(products) {
    const dropdown = document.getElementById('productDropdown');
    autocompleteHighlightedIndex = -1; // Reset highlight

    if (products.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item">No products found</div>';
        dropdown.classList.add('active');
        return;
    }

    dropdown.innerHTML = products.map(product => {
        const upc = product.ProductUPC || 'N/A';
        const description = product.ProductDescription || 'Unnamed Product';
        const qtyPerCase = product.UnitQty2 || 0;

        return `
            <div class="autocomplete-item product-item" data-upc="${escapeHtml(upc)}" data-description="${escapeHtml(description)}" data-qty-per-case="${qtyPerCase}">
                <div><strong>${escapeHtml(description)}</strong></div>
                <small>UPC: ${escapeHtml(upc)} | Qty per Case: ${qtyPerCase > 0 ? qtyPerCase : 'Not Set'}</small>
            </div>
        `;
    }).join('');

    dropdown.classList.add('active');

    // Attach event listeners to all product items
    dropdown.querySelectorAll('.product-item').forEach(item => {
        item.addEventListener('click', function() {
            const upc = this.dataset.upc;
            const description = this.dataset.description;
            const qtyPerCase = parseFloat(this.dataset.qtyPerCase) || 0;
            selectProduct(upc, description, qtyPerCase);
        });
    });
}

// Select product from dropdown
function selectProduct(upc, description, qtyPerCase) {
    document.getElementById('productSearch').value = description;
    document.getElementById('productUPC').value = upc;
    document.getElementById('productDescription').value = description;
    document.getElementById('qtyPerCase').value = qtyPerCase || '';
    document.getElementById('productDropdown').classList.remove('active');
}

// Open adjust modal
function openAdjustModal(recordId) {
    const record = allRecords.find(r => r.id === recordId);
    if (!record) {
        showToast('Record not found', 'error');
        return;
    }

    document.getElementById('adjustRecordId').value = recordId;
    document.getElementById('currentQuantity').value = record.Qty_Cases || 0;
    document.getElementById('adjustAmount').value = '';
    document.getElementById('adjustNotes').value = '';
    document.getElementById('notesCharCount').textContent = '0';
    document.getElementById('adjustModalTitle').textContent = 'Adjust Case Quantity';

    // Add character counter listener
    const notesField = document.getElementById('adjustNotes');
    notesField.addEventListener('input', () => {
        document.getElementById('notesCharCount').textContent = notesField.value.length;
    });

    document.getElementById('adjustModal').classList.add('active');
}

// Close adjust modal
function closeAdjustModal() {
    document.getElementById('adjustModal').classList.remove('active');
    document.getElementById('adjustForm').reset();
    document.getElementById('notesCharCount').textContent = '0';
}

// Save adjustment
async function saveAdjustment() {
    const recordId = document.getElementById('adjustRecordId').value;
    const adjustment = parseInt(document.getElementById('adjustAmount').value);
    const notes = document.getElementById('adjustNotes').value.trim();

    if (!adjustment || adjustment === 0) {
        showToast('Please enter a valid adjustment amount', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`/api/bin-locations/${recordId}/adjust`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adjustment: adjustment,
                notes: notes || null
            })
        });

        if (handleAuthError(response)) return;
        const result = await response.json();

        if (result.success) {
            showToast(result.message, 'success');
            closeAdjustModal();
            await loadBinLocations();
        } else {
            showToast(result.message || 'Failed to adjust quantity', 'error');
        }
    } catch (error) {
        showToast('Error adjusting quantity: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Open delete confirmation modal
function openDeleteModal(recordId) {
    const record = allRecords.find(r => r.id === recordId);
    if (!record) {
        showToast('Record not found', 'error');
        return;
    }

    document.getElementById('deleteRecordId').value = recordId;
    document.getElementById('deleteBinLocation').textContent = record.BinLocation || 'N/A';
    document.getElementById('deleteProductName').textContent = record.ProductDescription || 'N/A';
    document.getElementById('deleteCaseQty').textContent = (record.Qty_Cases || 0).toLocaleString();

    document.getElementById('deleteModal').classList.add('active');
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
}

// Confirm delete
async function confirmDelete() {
    const recordId = document.getElementById('deleteRecordId').value;

    if (!recordId) {
        showToast('No record selected', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`/api/bin-locations/${recordId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showToast(result.message, 'success');
            closeDeleteModal();
            await loadBinLocations();
        } else {
            showToast(result.message || 'Failed to delete record', 'error');
        }
    } catch (error) {
        showToast('Error deleting record: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Utility functions
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    toast.innerHTML = `
        <div class="toast-message">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    // Start fade out after 4.5 seconds, then remove after animation completes
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            toast.remove();
        }, 300); // Match fadeOut animation duration
    }, 4500);
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ============================================================================
// View Toggle Functions (Table/Card)
// ============================================================================

function switchView(view) {
    currentView = view;

    // Update button states
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Get filtered records (respect current search)
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase().trim();
    let recordsToDisplay = allRecords;

    if (searchTerm) {
        recordsToDisplay = allRecords.filter(record => {
            const binLocation = (record.BinLocation || '').toLowerCase();
            const productName = (record.ProductDescription || '').toLowerCase();
            return binLocation.includes(searchTerm) || productName.includes(searchTerm);
        });
    }

    // Re-render with current view
    if (view === 'table') {
        renderTable(recordsToDisplay);
    } else {
        renderCardView(recordsToDisplay);
    }
}

function renderCardView(records) {
    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.querySelector('.table-container');
    const topSummary = document.getElementById('topSummary');
    const tableFoot = document.getElementById('tableFoot');

    if (records.length === 0) {
        tableContainer.style.display = 'none';
        emptyState.style.display = 'block';
        topSummary.style.display = 'none';
        tableFoot.style.display = 'none';
        return;
    }

    // Calculate totals
    let totalCases = 0;
    let totalItems = 0;

    records.forEach(record => {
        totalCases += record.Qty_Cases || 0;
        totalItems += record.TotalQuantity || 0;
    });

    // Update top summary
    topSummary.style.display = 'flex';
    document.getElementById('topTotalCases').textContent = totalCases.toLocaleString();
    document.getElementById('topTotalItems').textContent = totalItems.toLocaleString();
    document.getElementById('topRecordCount').textContent = records.length.toLocaleString();

    // Hide table footer in card view
    tableFoot.style.display = 'none';

    // Replace table with card grid
    const cardGrid = document.createElement('div');
    cardGrid.className = 'card-grid';
    cardGrid.innerHTML = records.map(record => {
        const binLocation = record.BinLocation || 'N/A';
        const productName = record.ProductDescription || 'N/A';
        const caseQty = record.Qty_Cases || 0;
        const qtyPerCase = record.UnitQty2 || 0;
        const totalQty = record.TotalQuantity || 0;

        const qtyPerCaseDisplay = qtyPerCase > 0 ? qtyPerCase : 'Not Set';
        const totalQtyDisplay = qtyPerCase > 0 ? totalQty.toLocaleString() : '—';

        return `
            <div class="record-card">
                <div class="card-header">
                    <div class="card-badge">${escapeHtml(binLocation)}</div>
                </div>
                <div class="card-body">
                    <div class="card-title">
                        ${escapeHtml(productName)}
                    </div>
                    <div class="card-info">
                        <div class="card-info-row">
                            <span class="card-info-label">Case Quantity:</span>
                            <span class="card-info-value">${caseQty.toLocaleString()}</span>
                        </div>
                        <div class="card-info-row">
                            <span class="card-info-label">Qty per Case:</span>
                            <span class="card-info-value">${qtyPerCaseDisplay}</span>
                        </div>
                        <div class="card-info-row">
                            <span class="card-info-label">Total Quantity:</span>
                            <span class="card-info-value">${totalQtyDisplay}</span>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-secondary btn-small" onclick="openEditModal(${record.id})" title="Edit">
                        Edit
                    </button>
                    <button class="btn btn-primary btn-small" onclick="openAdjustModal(${record.id})" title="Adjust">
                        Adjust
                    </button>
                    <button class="btn btn-error btn-small" onclick="openDeleteModal(${record.id})" title="Delete">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Replace table container content with card grid
    tableContainer.innerHTML = '';
    tableContainer.appendChild(cardGrid);
    tableContainer.style.display = 'block';
    emptyState.style.display = 'none';
}

// ============================================================================
// Search Functions
// ============================================================================

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    searchInput.focus();
    handleSearch({ target: searchInput });
}

// ============================================================================
// Autocomplete Keyboard Navigation
// ============================================================================

function handleAutocompleteKeydown(event) {
    const dropdown = event.target.nextElementSibling;
    if (!dropdown || !dropdown.classList.contains('active')) return;

    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            autocompleteHighlightedIndex = Math.min(autocompleteHighlightedIndex + 1, items.length - 1);
            updateAutocompleteHighlight(items);
            break;

        case 'ArrowUp':
            event.preventDefault();
            autocompleteHighlightedIndex = Math.max(autocompleteHighlightedIndex - 1, 0);
            updateAutocompleteHighlight(items);
            break;

        case 'Enter':
            event.preventDefault();
            if (autocompleteHighlightedIndex >= 0 && autocompleteHighlightedIndex < items.length) {
                items[autocompleteHighlightedIndex].click();
            }
            break;

        case 'Escape':
            event.preventDefault();
            dropdown.classList.remove('active');
            autocompleteHighlightedIndex = -1;
            break;

        case 'Tab':
            // Select highlighted item and move to next field
            if (autocompleteHighlightedIndex >= 0 && autocompleteHighlightedIndex < items.length) {
                event.preventDefault();
                items[autocompleteHighlightedIndex].click();
            }
            break;
    }
}

function updateAutocompleteHighlight(items) {
    items.forEach((item, index) => {
        if (index === autocompleteHighlightedIndex) {
            item.classList.add('highlighted');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('highlighted');
        }
    });
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

function registerKeyboardShortcuts() {
    // Ctrl+N - Add new record
    keyboardManager.register('ctrl+n', () => {
        openAddModal();
    }, { description: 'Add new record' });

    // Ctrl+R - Refresh data
    keyboardManager.register('ctrl+r', () => {
        loadBinLocations();
    }, { description: 'Refresh data' });

    // Ctrl+K - Focus search
    keyboardManager.register('ctrl+k', () => {
        const searchInput = document.getElementById('searchInput');
        searchInput.focus();
        searchInput.select();
    }, { description: 'Focus search box' });

    // / - Focus search (alternative)
    keyboardManager.register('/', () => {
        const searchInput = document.getElementById('searchInput');
        searchInput.focus();
        searchInput.select();
    }, { description: 'Focus search box' });

    // Ctrl+, - Open settings
    keyboardManager.register('ctrl+,', () => {
        window.location.href = '/settings';
    }, { description: 'Open settings' });

    // Ctrl+H - View history
    keyboardManager.register('ctrl+h', () => {
        window.location.href = '/history';
    }, { description: 'View history' });
}

// ============================================================================
// Authentication Functions
// ============================================================================

async function handleLogout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Logout error:', error);
        // Redirect anyway
        window.location.href = '/login';
    }
}

function handleAuthError(response) {
    if (response.status === 401) {
        window.location.href = '/login';
        return true;
    }
    return false;
}
