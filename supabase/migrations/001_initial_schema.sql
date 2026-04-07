-- Enable uuid_generate_v4() function 
create extension if not exists "uuid-ossp";

-- Create sessions table 
create table sessions (
    id                  uuid primary key default uuid_generate_v4(),
    title               text not null,
    opens_at            timestamptz,
    closes_at           timestamptz,
    is_active           boolean not null default false,
    per_person_limit    int check (per_person_limit > 0),
    created_at          timestamptz not null default now()
);

-- Create products table
create table products (
    id          uuid primary key default uuid_generate_v4(),
    session_id  uuid not null references sessions(id) on delete cascade,
    name        text not null,
    price       int not null check (price >= 0),
    stock_qty   int not null check (stock_qty >= 0),
    created_at  timestamptz not null default now()
);

-- Create pickup_options table
create table pickup_options (
    id                      uuid primary key default uuid_generate_v4(),
    name                    text not null,
    description             text,
    extra_fee               int not null default 0 check (extra_fee >= 0),
    allowed_payment_methods text[],
    is_active               boolean not null default true,
    sort_order              int not null default 0,
    created_at              timestamptz not null default now()
);

create index idx_pickup_options_active on pickup_options(is_active, sort_order);

create type order_status as enum (
    'pending',
    'in_production',
    'pending_payment',
    'payment_submitted',
    'completed',
    'cancelled'
); 

create type cancelled_by_enum as enum ('customer', 'admin');
create type payment_method_enum as enum ('bank_transfer', 'cash');

-- Create orders table
create table orders (
    id  uuid            primary key default uuid_generate_v4(),
    session_id          uuid not null references sessions(id),
    line_user_id        text not null,
    line_display_name   text not null,
    status              order_status not null default 'pending',
    payment_method      payment_method_enum not null,
    total_amount        int not null default 0,
    remit_last5         text,
    pickup_option_id    uuid references pickup_options(id),
    pickup_fee          int not null default 0,
    queue_number        int,
    edit_count          int not null default 0,
    last_edited_at      timestamptz,
    cancelled_by        cancelled_by_enum,
    cancel_reason       text,
    created_at          timestamptz not null default now()
);

-- Crete oerder_items table
create table order_items (
    id          uuid primary key default uuid_generate_v4(),
    order_id    uuid not null references orders(id) on delete cascade,
    product_id  uuid not null references products(id),
    quantity    int not null check (quantity > 0),
    unit_price  int not null check (unit_price >= 0)
);

-- Create session_restocks table
create table session_restocks (
  id         uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  opens_at   timestamptz not null,
  is_active  boolean not null default true,
  applied    boolean not null default false,
  created_at timestamptz not null default now()
);

-- Create restock_items table
create table restock_items (
  restock_id uuid not null references session_restocks(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity   int not null check (quantity > 0),
  primary key (restock_id, product_id)
);

create index idx_restocks_session_pending
  on session_restocks(session_id, opens_at)
  where is_active = true and applied = false;

-- Create roles table
create table roles (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- Create permissions table
create table permissions (
  id   uuid primary key default uuid_generate_v4(),
  key  text not null unique,
  name text not null
);

-- Create role_permissions table
create table role_permissions (
  role_id       uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Create user_roles table
create table user_roles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role_id      uuid not null references roles(id),
  display_name text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index idx_user_roles_role on user_roles(role_id);

create index idx_orders_session_line on orders(session_id, line_user_id);
create index idx_orders_status on orders(status);
create index idx_orders_created_at on orders(created_at);
create index idx_order_items_order on order_items(order_id);