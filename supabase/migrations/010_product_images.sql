create table if not exists product_images (
    id         uuid primary key default gen_random_uuid(),
    url        text not null,
    name       text,
    created_at timestamptz not null default now()
);
