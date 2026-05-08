create table if not exists settings (
    key text primary key,
    value text not null
);

insert into settings (key, value) values
    ('shop_name', '甜點工作室'),
    ('bank_code', ''),
    ('bank_account', ''),
    ('bank_holder', '')
on conflict (key) do nothing;
