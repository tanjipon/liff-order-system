-- Add orders:note permission and grant to both roles
insert into permissions (id, key, name) values
    ('10000000-0000-0000-0000-000000000013', 'orders:note', '填寫訂單備註');

-- Grant to owner (already has all, but explicit for clarity)
insert into role_permissions (role_id, permission_id)
values ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000013');

-- Grant to assistant
insert into role_permissions (role_id, permission_id)
values ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000013');
