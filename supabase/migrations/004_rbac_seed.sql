-- 1. Create default  role
insert into roles (id, name) values
    ('00000000-0000-0000-0000-000000000001', 'owner'),
    ('00000000-0000-0000-0000-000000000002', 'assistant');

-- 2. Create permissions
insert into permissions (id, key, name) values
    ('10000000-0000-0000-0000-000000000001', 'sessions:create',        '建立開單'),
    ('10000000-0000-0000-0000-000000000002', 'sessions:edit',          '編輯開單'),
    ('10000000-0000-0000-0000-000000000003', 'orders:accept',          '接受訂單'),
    ('10000000-0000-0000-0000-000000000004', 'orders:reject',          '拒絕訂單'),
    ('10000000-0000-0000-0000-000000000005', 'orders:mark_ready',      '標記製作完成'),
    ('10000000-0000-0000-0000-000000000006', 'orders:cancel',          '取消訂單'),
    ('10000000-0000-0000-0000-000000000007', 'orders:confirm_payment', '確認付款'),
    ('10000000-0000-0000-0000-000000000008', 'stats:view',             '查看報表'),
    ('10000000-0000-0000-0000-000000000009', 'staff:manage',           '管理人員'),
    ('10000000-0000-0000-0000-000000000010', 'roles:manage',           '管理角色權限'),
    ('10000000-0000-0000-0000-000000000011', 'pickup_options:manage',  '管理取貨方式'),
    ('10000000-0000-0000-0000-000000000012', 'restocks:manage',        '管理追加庫存排程');

-- 3. Set owner permissons
insert into role_permissions (role_id, permission_id) 
select '00000000-0000-0000-0000-000000000001', id from permissions;

-- 4. Set assistant permissions
insert into role_permissions (role_id, permission_id)
select '00000000-0000-0000-0000-000000000002', id
from permissions
where key in (
  'orders:accept',
  'orders:reject',
  'orders:mark_ready',
  'orders:confirm_payment',
  'stats:view'  
);