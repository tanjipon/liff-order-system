-- Add auto-increment order_number to orders table
alter table orders add column order_number serial;

grant usage, select on sequence orders_order_number_seq to anon, authenticated, service_role;
