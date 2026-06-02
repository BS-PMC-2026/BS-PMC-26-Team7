-- Migration: US41 – Payment / Cart / Mock Checkout
-- Run once against the production database.
-- Safe to re-run: all DDL guarded by sys.tables / sys.columns existence checks.
-- Mock payment ONLY — no real card/PayPal processing.

-- ── CartItems ──────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CartItems' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CartItems (
        CartItemId      INT IDENTITY(1,1) PRIMARY KEY,
        UserId          INT             NOT NULL,
        ProductId       INT             NOT NULL,
        Quantity        INT             NOT NULL DEFAULT 1,
        CreatedAtUtc    DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc    DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_CartItems_Users    FOREIGN KEY (UserId)    REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_CartItems_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId),
        CONSTRAINT UQ_Cart_User_Product  UNIQUE (UserId, ProductId)
    );
END;

-- ── Orders ─────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Orders' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Orders (
        OrderId                 INT IDENTITY(1,1) PRIMARY KEY,
        UserId                  INT             NOT NULL,
        OrderNumber             NVARCHAR(50)    NOT NULL,
        Status                  NVARCHAR(20)    NOT NULL DEFAULT 'pending',
        Subtotal                DECIMAL(10,2)   NOT NULL,
        ProductDiscountTotal    DECIMAL(10,2)   NOT NULL DEFAULT 0,
        EmployeeDiscountTotal   DECIMAL(10,2)   NOT NULL DEFAULT 0,
        CouponDiscountTotal     DECIMAL(10,2)   NOT NULL DEFAULT 0,
        TotalAmount             DECIMAL(10,2)   NOT NULL,
        Currency                NVARCHAR(3)     NOT NULL DEFAULT 'ILS',
        CouponCode              NVARCHAR(50)    NULL,
        PaymentMethod           NVARCHAR(30)    NOT NULL,
        CreatedAtUtc            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        PaidAtUtc               DATETIME2       NULL,
        CancelledAtUtc          DATETIME2       NULL,
        CONSTRAINT FK_Orders_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT UQ_Orders_OrderNumber UNIQUE (OrderNumber)
    );
    CREATE INDEX IX_Orders_UserId ON dbo.Orders (UserId);
END;

-- ── OrderItems ─────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OrderItems' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.OrderItems (
        OrderItemId                     INT IDENTITY(1,1) PRIMARY KEY,
        OrderId                         INT             NOT NULL,
        ProductId                       INT             NULL,
        ProductNameSnapshot             NVARCHAR(150)   NOT NULL,
        UnitPriceOriginal               DECIMAL(10,2)   NOT NULL,
        UnitPriceAfterProductDiscount   DECIMAL(10,2)   NOT NULL,
        UnitPriceAfterEmployeeDiscount  DECIMAL(10,2)   NOT NULL,
        Quantity                        INT             NOT NULL,
        LineSubtotal                    DECIMAL(10,2)   NOT NULL,
        LineDiscountTotal               DECIMAL(10,2)   NOT NULL DEFAULT 0,
        LineTotal                       DECIMAL(10,2)   NOT NULL,
        EmployeeDiscountAppliedPercent  DECIMAL(5,2)    NULL,
        ProductDiscountAppliedPercent   DECIMAL(5,2)    NULL,
        CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId)
    );
END;

-- ── PaymentRecords ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PaymentRecords' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.PaymentRecords (
        PaymentRecordId     INT IDENTITY(1,1) PRIMARY KEY,
        OrderId             INT             NOT NULL,
        UserId              INT             NOT NULL,
        PaymentMethod       NVARCHAR(30)    NOT NULL,
        PaymentStatus       NVARCHAR(20)    NOT NULL DEFAULT 'pending',
        Amount              DECIMAL(10,2)   NOT NULL,
        Currency            NVARCHAR(3)     NOT NULL DEFAULT 'ILS',
        MockTransactionId   NVARCHAR(100)   NULL,
        CardLast4           NVARCHAR(4)     NULL,
        CardBrand           NVARCHAR(30)    NULL,
        PaypalMockAccount   NVARCHAR(200)   NULL,
        FailureReason       NVARCHAR(500)   NULL,
        InvoiceEmailStatus  NVARCHAR(20)    NOT NULL DEFAULT 'not_sent',
        CreatedAtUtc        DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        PaidAtUtc           DATETIME2       NULL,
        CONSTRAINT FK_PaymentRecords_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(OrderId),
        CONSTRAINT FK_PaymentRecords_Users  FOREIGN KEY (UserId)  REFERENCES dbo.Users(UserId)
    );
END;

-- ── Coupons ────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Coupons' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.Coupons (
        CouponId                INT IDENTITY(1,1) PRIMARY KEY,
        Code                    NVARCHAR(50)    NOT NULL,
        Description             NVARCHAR(300)   NULL,
        DiscountType            NVARCHAR(20)    NOT NULL,
        DiscountValue           DECIMAL(10,2)   NOT NULL,
        Active                  BIT             NOT NULL DEFAULT 1,
        StartsAtUtc             DATETIME2       NULL,
        EndsAtUtc               DATETIME2       NULL,
        MaxTotalUses            INT             NULL,
        MaxUsesPerUser          INT             NULL,
        CurrentUseCount         INT             NOT NULL DEFAULT 0,
        MinimumOrderAmount      DECIMAL(10,2)   NULL,
        AppliesToAllProducts    BIT             NOT NULL DEFAULT 1,
        CreatedAtUtc            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Coupons_Code UNIQUE (Code)
    );
END;

-- ── CouponRedemptions ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CouponRedemptions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CouponRedemptions (
        RedemptionId    INT IDENTITY(1,1) PRIMARY KEY,
        CouponId        INT             NOT NULL,
        UserId          INT             NOT NULL,
        OrderId         INT             NOT NULL,
        DiscountApplied DECIMAL(10,2)   NOT NULL,
        RedeemedAtUtc   DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Redemptions_Coupons FOREIGN KEY (CouponId) REFERENCES dbo.Coupons(CouponId),
        CONSTRAINT FK_Redemptions_Users   FOREIGN KEY (UserId)   REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_Redemptions_Orders  FOREIGN KEY (OrderId)  REFERENCES dbo.Orders(OrderId)
    );
END;

-- ── EmployeeDiscountSettings ───────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmployeeDiscountSettings' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.EmployeeDiscountSettings (
        SettingId               INT IDENTITY(1,1) PRIMARY KEY,
        GlobalDiscountPercent   DECIMAL(5,2)    NOT NULL DEFAULT 40,
        Active                  BIT             NOT NULL DEFAULT 1,
        UpdatedAtUtc            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedBy               INT             NULL
    );
    -- Seed default setting
    INSERT INTO dbo.EmployeeDiscountSettings (GlobalDiscountPercent, Active)
    VALUES (40, 1);
END;

-- ── EmployeeDiscountProductOverrides ──────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmployeeDiscountProductOverrides' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.EmployeeDiscountProductOverrides (
        OverrideId              INT IDENTITY(1,1) PRIMARY KEY,
        ProductId               INT             NOT NULL,
        Mode                    NVARCHAR(20)    NOT NULL DEFAULT 'use_global',
        CustomDiscountPercent   DECIMAL(5,2)    NULL,
        UpdatedAtUtc            DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedBy               INT             NULL,
        CONSTRAINT FK_EmpDiscOverrides_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId),
        CONSTRAINT UQ_EmpDiscOverrides_Product  UNIQUE (ProductId)
    );
END;
