-- Migration 012: Add customer/recipient contact info to orders
-- and requires_address flag to pickup_options

-- pickup_options: flag to indicate if shipping address is required
alter table pickup_options
    add column if not exists requires_address boolean not null default false;

-- orders: orderer contact info
alter table orders
    add column if not exists customer_name  text not null default '',
    add column if not exists customer_phone text not null default '';

-- orders: recipient contact info (may differ from orderer)
alter table orders
    add column if not exists recipient_name    text not null default '',
    add column if not exists recipient_phone   text not null default '',
    add column if not exists recipient_address text;  -- nullable; only required when pickup requires_address = true
