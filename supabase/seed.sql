-- 1. Create an ongoing session
insert into sessions (id, title, opens_at, closes_at, is_active, per_person_limit) values
    (
        'aaaaaaaa-0000-0000-0000-000000000001',
        '4月塔甜點開單',
        now() - interval '1 hour',
        now() + interval '7 days',
        true,
        5
    );

-- 2. Create products
insert into products (id, session_id, name, price, stock_qty) values
    ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '草莓塔', 150, 20),
    ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '檸檬塔', 120, 10),
    ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '巧克力塔', 130, 0);

-- 3. Create pickup options
insert into pickup_options (id, name, description, extra_fee, allowed_payment_methods, is_active, sort_order) values
    ('cccccccc-0000-0000-0000-000000000001', '自取', '至工作室自取，不需額外費用', 0, null, true, 1),
    ('cccccccc-0000-0000-0000-000000000002', '宅配', '全台宅配，運費 100 元', 100, '{"bank_transfer"}', true, 2);

