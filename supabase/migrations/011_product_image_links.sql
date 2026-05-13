create table if not exists product_image_links (
    id         uuid primary key default gen_random_uuid(),
    product_id uuid not null references products(id) on delete cascade,
    image_id   uuid not null references product_images(id) on delete cascade,
    position   int not null default 0,
    created_at timestamptz not null default now(),
    unique(product_id, image_id)
);

create index if not exists product_image_links_product_position
    on product_image_links(product_id, position);
