-- Rename default roles to Chinese display names
update roles set name = '管理員' where id = '00000000-0000-0000-0000-000000000001';
update roles set name = '助手'   where id = '00000000-0000-0000-0000-000000000002';
