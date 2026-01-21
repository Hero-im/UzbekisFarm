create extension if not exists "pgcrypto";

-- Product status enum
do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'product_status'
  ) then
    create type product_status as enum ('ON_SALE', 'RESERVED', 'COMPLETED');
  end if;
end $$;

-- Order status enum
do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'order_status'
  ) then
    create type order_status as enum (
      'PAYMENT_COMPLETED',
      'SHIPPING',
      'DELIVERED',
      'CONFIRMED'
    );
  end if;
end $$;

-- Posts inventory fields + status migration
alter table if exists public.posts
  add column if not exists stock_quantity integer,
  add column if not exists unit_size numeric,
  add column if not exists unit text,
  add column if not exists delivery_type text;

-- Backfill stock from legacy quantity if present
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'quantity'
  ) then
    execute 'update public.posts set stock_quantity = quantity where stock_quantity is null';
  end if;
end $$;

-- Map legacy status values to new enum labels
update public.posts
set status = case
  when status = 'active' then 'ON_SALE'
  when status = 'reserved' then 'RESERVED'
  when status = 'sold' then 'COMPLETED'
  else status
end
where status is not null;

-- Convert status column to enum (if column exists)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'status'
  ) then
    alter table public.posts
      alter column status type product_status
      using status::product_status;
  end if;
end $$;

-- Orders table
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  unit_price numeric,
  total_price numeric,
  shipping_address text,
  status order_status not null default 'PAYMENT_COMPLETED',
  created_at timestamp with time zone not null default now()
);

create index if not exists orders_buyer_id_idx on public.orders (buyer_id);
create index if not exists orders_seller_id_idx on public.orders (seller_id);
create index if not exists orders_post_id_idx on public.orders (post_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

alter table public.orders enable row level security;

-- Orders RLS
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders
  for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "orders_insert_buyer" on public.orders;
create policy "orders_insert_buyer"
  on public.orders
  for insert
  with check (auth.uid() = buyer_id);

drop policy if exists "orders_update_parties" on public.orders;
create policy "orders_update_parties"
  on public.orders
  for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
