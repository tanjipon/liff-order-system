create or replace function create_order(
    p_session_id        uuid,
    p_line_user_id      text,
    p_display_name      text,
    p_items             jsonb,
    p_pickup_option_id  uuid,
    p_payment_method    payment_method_enum
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
    -- 1. Check if session is active（time criteria + is_active double-check）
    select per_person_limit into v_quota_limit
    from sessions
    where id = p_session_id
        and is_active = true
        and (opens_at is null or opens_at <= now())
        and (closes_at is null or closes_at >= now());
    if not found then
        raise exception 'SESSION_NOT_ACTIVE';
    end if;

    -- 2. quota check: NULL represents unlimited and skip
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

    -- 3. Get pickup_options and check activeness and fee
    select * into v_pickup
    from pickup_options
    where id = p_pickup_option_id and is_active = true;
    if not found then
        raise exception 'PICKUP_OPTION_NOT_FOUND';
    end if;

    -- 4. Validate payment method
    if v_pickup.allowed_payment_methods is not null then
        if not (p_payment_method::text = any(v_pickup.allowed_payment_methods)) then
            raise exception 'PAYMENT_METHOD_NOT_ALLOWED';
        end if;
    end if;

    -- 5. Lazy restock(apply restock when clients create order) 
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
        -- add restock quantity to the stock
        update products p
        set stock_qty = p.stock_qty + ri.quantity
        from restock_items ri
        where ri.restock_id = v_restock.id
        and ri.product_id = p.id;

        -- set applied
        update session_restocks
        set applied = true
        where id = v_restock.id;
    end loop;

    -- 6. Create（include pickup_fee）
    insert into orders (
        session_id, line_user_id, line_display_name,
        payment_method, pickup_option_id, pickup_fee
    )
    values (
        p_session_id, p_line_user_id, p_display_name,
        p_payment_method, p_pickup_option_id, v_pickup.extra_fee
    )
    returning id into v_order_id;

    -- 7. Process items one by one: FOR UPDATE avoids race condition
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

    -- 8. Update total price
    update orders
    set total_amount = v_total + v_pickup.extra_fee
    where id = v_order_id;

    return v_order_id;
end;
$$;

create or replace function admin_cancel_order(
  p_order_id uuid,
  p_reason   text
) returns void language plpgsql as $$
declare
  v_order record;
  v_item  record;
begin
    select * into v_order from orders where id = p_order_id for update;

    if not found then
        raise exception 'ORDER_NOT_FOUND';
    end if;

    -- 狀態守門：payment_submitted 後不可取消
    if v_order.status = 'payment_submitted' then
        raise exception 'CANNOT_CANCEL_PAYMENT_SUBMITTED';
    end if;

    if v_order.status in ('completed', 'cancelled') then
        raise exception 'ORDER_ALREADY_FINALIZED';
    end if;

    -- 釋放庫存
    for v_item in
        select product_id, quantity from order_items where order_id = p_order_id
    loop
        update products
        set stock_qty = stock_qty + v_item.quantity
        where id = v_item.product_id;
    end loop;

    -- 更新狀態
    update orders
    set status = 'cancelled',
        cancelled_by = 'admin',
        cancel_reason = p_reason
    where id = p_order_id;
end;
$$;

-- update order
create or replace function update_order(
    p_order_id      uuid,
    p_line_user_id  text,
    p_items         jsonb
) returns void language plpgsql as $$
declare
    v_order     record;
    v_item      jsonb;
    v_product   record;
    v_total     int := 0;
begin
    -- 1. lock order, validate owner and status to be pending
    select * into v_order from orders
    where id = p_order_id and line_user_id = p_line_user_id
    for update;

    if not found then
        raise exception 'ORDER_NOT_FOUND';
    end if;

    if v_order.status != 'pending' then
        raise exception 'INVALID_TRANSITION';
    end if;

    -- 2. update stock
    update products p
    set stock_qty = p.stock_qty + oi.quantity
    from order_items oi
    where oi.order_id = p_order_id
        and oi.product_id = p.id;

    -- 3. selete order items
    delete from order_items where order_id = p_order_id;

    -- check new items is not zero
    if jsonb_array_length(p_items) = 0 then
        raise exception 'ORDER_ITEMS_EMPTY';
    end if;

    -- 4. update stock and add new items
    for v_item in select * from jsonb_array_elements(p_items)
    loop    
        select * into v_product
        from products
        where id = (v_item->>'product_id')::uuid
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
            p_order_id, 
            v_product.id,
            (v_item->>'quantity')::int,
            v_product.price
        );

        v_total := v_total + v_product.price * (v_item->>'quantity')::int;
    end loop;

    -- 5. update order amount and edit history
    update orders
    set total_amount    = v_total + pickup_fee,
        edit_count      = edit_count + 1,
        last_edited_at  = now()
    where id = p_order_id; 
end;
$$;