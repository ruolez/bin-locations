-- SQL Script to create the Items_BinLocations table
-- Run this script on your BackOffice database if the table doesn't exist
--
-- NOTE: The application explicitly sets CreatedAt and LastUpdate to Central Time (Chicago)
-- The DEFAULT constraints below are only used if records are created outside the application

-- Create Items_BinLocations table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Items_BinLocations]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Items_BinLocations] (
        [id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [CreatedAt] DATETIME NOT NULL CONSTRAINT [items_binlocations_createdat_default] DEFAULT GETDATE(),
        [ProductUPC] VARCHAR(255) NULL,
        [ProductDescription] VARCHAR(255) NULL,
        [Qty_Cases] INT NULL,
        [BinLocationID] INT NULL,
        [LastUpdate] DATETIME NOT NULL CONSTRAINT [items_binlocations_lastupdate_default] DEFAULT GETDATE(),
        [int1] INT NULL,
        [txt1] VARCHAR(255) NULL
    )

    PRINT 'Items_BinLocations table created successfully!'
    PRINT 'NOTE: Application will override default timestamps with Central Time (Chicago)'
END
ELSE
BEGIN
    PRINT 'Items_BinLocations table already exists.'
END
GO

-- Verify the table was created
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Items_BinLocations'
ORDER BY ORDINAL_POSITION
GO
