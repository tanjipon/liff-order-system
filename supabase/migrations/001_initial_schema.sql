-- Enable uuid_generate_v4() function 
create extension if not exists "uuid-ossp";

-- Create sessios table 
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