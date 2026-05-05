-- Add auto-increment order_number to orders table
alter table orders add column order_number serial;
