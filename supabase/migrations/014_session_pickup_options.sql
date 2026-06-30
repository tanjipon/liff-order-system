-- B2: session_pickup_options junction table
-- A pickup option can be shared across multiple sessions

create table session_pickup_options (
    id                  uuid primary key default uuid_generate_v4(),
    session_id          uuid not null references sessions(id) on delete cascade,
    pickup_option_id    uuid not null references pickup_options(id) on delete cascade,
    sort_order          int not null default 0,
    created_at          timestamptz not null default now(),
    unique (session_id, pickup_option_id)
);

create index idx_session_pickup_options_session on session_pickup_options(session_id, sort_order);

-- update create_order: pickup option must be assigned to the session
create or replace function create_order(
    p_session_id        uuid,
    p_line_user_id      text,
    p_display_name      text,
    p_items             jsonb,
    p_pickup_option_id  uuid,
    p_payment_method    payment_method_enum,
    p_customer_name     text,
    p_customer_phone    text,
    p_recipient_name    text,
    p_recipient_phone   text,
    p_recipient_address text default null
) returns uuid language plpgsql as $$
declare
    v_order_id      uuid;
    v_total         int := 0;
    v_quota_used    int;
    v_quota_limit   int;
    v_new_qty       int;
    v_item          jsonb;
    v_product       record;
    v_pickup        record;
    v_restock       record;
begin
    -- 1. Check if session is active
    select per_person_limit into v_quota_limit
    from sessions
    where id = p_session_id
        and is_active = true
        and (opens_at is null or opens_at <= now())
        and (closes_at is null or closes_at >= now());
    if not found then
        raise exception 'SESSION_NOT_ACTIVE';
    end if;

    -- 2. quota check
    if v_quota_limit is not null then
        select coalesce(sum(oi.quantity), 0) into v_quota_used
        from orders o
        join order_items oi on oi.order_id = o.id
        where o.session_id = p_session_id
            and o.line_user_id = p_line_user_id
            and o.status != 'cancelled';

        select coalesce(sum((item->>'quantity')::int), 0) into v_new_qty
        from jsonb_array_elements(p_items) as item;

        if (v_quota_used + v_new_qty) > v_quota_limit then
            raise exception 'QUOTA_EXCEEDED';
        end if;
    end if;

    -- 3. Get pickup option: must be active AND assigned to this session
    select po.* into v_pickup
    from pickup_options po
    join session_pickup_options spo on spo.pickup_option_id = po.id
    where po.id = p_pickup_option_id
      and po.is_active = true
      and spo.session_id = p_session_id;
    if not found then
        raise exception 'PICKUP_OPTION_NOT_FOUND';
    end if;

    -- 4. Validate payment method
    if v_pickup.allowed_payment_methods is not null then
        if not (p_payment_method::text = any(v_pickup.allowed_payment_methods)) then
            raise exception 'PAYMENT_METHOD_NOT_ALLOWED';
        end if;
    end if;

    -- 5.1 Lazy restock
    for v_restock in
        select sr.id
        from session_restocks sr
        where sr.session_id = p_session_id
        and sr.is_active = true
        and sr.applied = false
        and sr.opens_at <= now()
        order by sr.opens_at
        for update of sr
    loop
        update products p
        set stock_qty = p.stock_qty + ri.quantity
        from restock_items ri
        where ri.restock_id = v_restock.id
        and ri.product_id = p.id;

        update session_restocks
        set applied = true
        where id = v_restock.id;
    end loop;

    -- 5.2 per-product quota check
    for v_item in select * from jsonb_array_elements(p_items)
    loop
        select * into v_product
        from products
        where id = (v_item->>'product_id')::uuid
          and session_id = p_session_id;

        if not found then
            raise exception 'PRODUCT_NOT_FOUND';
        end if;

        if v_product.max_per_person is not null then
            select coalesce(sum(oi.quantity), 0) into v_quota_used
            from orders o
            join order_items oi on oi.order_id = o.id
            where o.session_id = p_session_id
              and o.line_user_id = p_line_user_id
              and o.status != 'cancelled'
              and oi.product_id = v_product.id;

            if (v_quota_used + (v_item->>'quantity')::int) > v_product.max_per_person then
                raise exception 'PRODUCT_QUOTA_EXCEEDED:%', v_product.name;
            end if;
        end if;
    end loop;

    -- 6. Create order
    insert into orders (
        session_id, line_user_id, line_display_name,
        payment_method, pickup_option_id, pickup_fee,
        customer_name, customer_phone,
        recipient_name, recipient_phone, recipient_address
    )
    values (
        p_session_id, p_line_user_id, p_display_name,
        p_payment_method, p_pickup_option_id, v_pickup.extra_fee,
        p_customer_name, p_customer_phone,
        p_recipient_name, p_recipient_phone, p_recipient_address
    )
    returning id into v_order_id;

    -- 7. Process items with FOR UPDATE lock
    for v_item in select * from jsonb_array_elements(p_items)
    loop
        select * into v_product
        from products
        where id = (v_item->>'product_id')::uuid
        and session_id = p_session_id
        for update;

        if not found then
            raise exception 'PRODUCT_NOT_FOUND';
        end if;

        if v_product.stock_qty < (v_item->>'quantity')::int then
            raise exception 'INSUFFICIENT_STOCK:%', v_product.name;
        end if;

        update products
        set stock_qty = stock_qty - (v_item->>'quantity')::int
        where id = v_product.id;

        insert into order_items (order_id, product_id, quantity, unit_price)
        values (
            v_order_id,
            v_product.id,
            (v_item->>'quantity')::int,
            v_product.price
        );

        v_total := v_total + v_product.price * (v_item->>'quantity')::int;
    end loop;

    -- 8. Update total
    update orders
    set total_amount = v_total + v_pickup.extra_fee
    where id = v_order_id;

    return v_order_id;
end;
$$;
