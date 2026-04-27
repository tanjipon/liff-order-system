alter table sessions    enable row level security;
alter table products    enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;
alter table pickup_options enable row level security;

-- sessions: everyone can read active session
create policy "sessions_select_active"
    on sessions for select
    using (is_active = true);

-- products: everyone can read products
create policy "products_select_all"
    on products for select
    using (true);

-- orders: clients can only read orders belonging to their own
create policy "orders_select_own"
    on orders for select
    using (line_user_id = current_setting('app.current_line_user_id', true));

-- orders: clients can only insert orders belonging to their own
create policy "orders_insert_own"
  on orders for insert
  with check (line_user_id = current_setting('app.current_line_user_id', true));

-- orders: clients can only update orders belonging to their own
create policy "orders_update_own"
    on orders for update
    using (
        line_user_id = current_setting('app.current_line_user_id', true)
        and status = 'pending'
    );

-- order_itens: follow orders policies
create policy "order_items_select_own"
    on order_items for select
    using (
        order_id in (
            select id from orders
            where line_user_id = current_setting('app.current_line_user_id', true)
        )
    );

-- pickup_options: all users can select
create policy "pickup_options_select_all"
    on pickup_options for select
    using (true);

alter table roles            enable row level security;
alter table permissions      enable row level security;
alter table role_permissions enable row level security;
alter table user_roles       enable row level security;

-- roles / permissions / role_permissions: logined users can read
create policy "roles_select_authenticated"
  on roles for select
  using (auth.role() = 'authenticated');

create policy "permissions_select_authenticated"
on permissions for select
using (auth.role() = 'authenticated');

create policy "role_permissions_select_authenticated"
  on role_permissions for select
  using (auth.role() = 'authenticated');

-- user_roles: users can only read their own data
create policy "user_roles_select_own"
  on user_roles for select
  using (user_id = auth.uid());