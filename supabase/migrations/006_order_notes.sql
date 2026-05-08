-- Add customer and admin note fields to orders
alter table orders
  add column customer_note text,
  add column admin_note    text;
