-- =============================================
-- Items_BinLocations_History Table
-- Tracks all operations (CREATE, UPDATE, ADJUST, DELETE)
-- =============================================

CREATE TABLE [dbo].[Items_BinLocations_History] (
    -- Audit Identity
    [HistoryID] BIGINT IDENTITY(1,1) PRIMARY KEY,
    [RecordID] INT NOT NULL,  -- Foreign key to Items_BinLocations.id

    -- Operation Details
    [OperationType] VARCHAR(20) NOT NULL,  -- 'CREATE', 'UPDATE', 'ADJUST', 'DELETE'
    [Timestamp] DATETIME NOT NULL,  -- Central Time (America/Chicago)
    [Username] NVARCHAR(15) NOT NULL,  -- From Trustees_tbl.Login_Name

    -- Before State (for UPDATE/ADJUST/DELETE)
    [PreviousProductUPC] VARCHAR(255) NULL,
    [PreviousProductDescription] VARCHAR(255) NULL,
    [PreviousQty_Cases] INT NULL,
    [PreviousBinLocationID] INT NULL,
    [PreviousUnitQty2] REAL NULL,  -- From Items_tbl.UnitQty2

    -- After State (for CREATE/UPDATE/ADJUST)
    [NewProductUPC] VARCHAR(255) NULL,
    [NewProductDescription] VARCHAR(255) NULL,
    [NewQty_Cases] INT NULL,
    [NewBinLocationID] INT NULL,
    [NewUnitQty2] REAL NULL,  -- From Items_tbl.UnitQty2

    -- Adjustment-Specific
    [AdjustmentAmount] INT NULL,  -- Only for ADJUST operations (+5, -3, etc.)
    [Notes] NVARCHAR(500) NULL,  -- Optional user notes (especially for adjustments)

    -- Metadata
    [RecordCreatedAt] DATETIME NULL,  -- Original CreatedAt from Items_BinLocations
    [RecordLastUpdate] DATETIME NULL  -- Original LastUpdate before change
);

-- =============================================
-- Indexes for Performance
-- =============================================

-- Query history for specific record
CREATE INDEX IX_Items_BinLocations_History_RecordID
    ON [Items_BinLocations_History]([RecordID], [Timestamp] DESC);

-- Query all recent changes
CREATE INDEX IX_Items_BinLocations_History_Timestamp
    ON [Items_BinLocations_History]([Timestamp] DESC);

-- Filter by operation type
CREATE INDEX IX_Items_BinLocations_History_OperationType
    ON [Items_BinLocations_History]([OperationType]);

-- Filter by username
CREATE INDEX IX_Items_BinLocations_History_Username
    ON [Items_BinLocations_History]([Username], [Timestamp] DESC);

-- =============================================
-- Usage Examples
-- =============================================

-- View all history for a specific record
-- SELECT * FROM Items_BinLocations_History WHERE RecordID = 123 ORDER BY Timestamp DESC;

-- View all adjustments by a user
-- SELECT * FROM Items_BinLocations_History WHERE Username = 'john' AND OperationType = 'ADJUST' ORDER BY Timestamp DESC;

-- View all changes in the last 24 hours
-- SELECT * FROM Items_BinLocations_History WHERE Timestamp >= DATEADD(hour, -24, GETDATE()) ORDER BY Timestamp DESC;

-- View records with notes
-- SELECT * FROM Items_BinLocations_History WHERE Notes IS NOT NULL ORDER BY Timestamp DESC;
