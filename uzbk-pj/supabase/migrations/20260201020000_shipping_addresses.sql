create table if not exists public.shipping_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  receiver_name text,
  receiver_phone text,
  postal_code text,
  road_address text,
  address_detail text,
  memo text,
  is_default boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create index if not exists shipping_addresses_user_id_idx
  on public.shipping_addresses (user_id);

create unique index if not exists shipping_addresses_user_default_idx
  on public.shipping_addresses (user_id)
  where is_default;

alter table public.shipping_addresses enable row level security;

drop policy if exists "shipping_addresses_select_own" on public.shipping_addresses;
create policy "shipping_addresses_select_own"
  on public.shipping_addresses
  for select
  using (auth.uid() = user_id);

drop policy if exists "shipping_addresses_insert_own" on public.shipping_addresses;
create policy "shipping_addresses_insert_own"
  on public.shipping_addresses
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "shipping_addresses_update_own" on public.shipping_addresses;
create policy "shipping_addresses_update_own"
  on public.shipping_addresses
  for update
  using (auth.uid() = user_id);

drop policy if exists "shipping_addresses_delete_own" on public.shipping_addresses;
create policy "shipping_addresses_delete_own"
  on public.shipping_addresses
  for delete
  using (auth.uid() = user_id);

alter table public.orders
  add column if not exists shipping_address_id uuid references public.shipping_addresses(id) on delete set null,
  add column if not exists recipient_name text,
  add column if not exists recipient_phone text,
  add column if not exists shipping_label text,
  add column if not exists shipping_postal_code text,
  add column if not exists shipping_road_address text,
  add column if not exists shipping_address_detail text,
  add column if not exists shipping_memo text;

create or replace function public.create_order_and_decrement_stock(
  p_post_id uuid,
  p_quantity integer,
  p_shipping_address_id uuid,
  p_recipient_name text,
  p_recipient_phone text,
  p_label text,
  p_postal_code text,
  p_road_address text,
  p_address_detail text,
  p_memo text
)
returns table(order_id uuid, remaining_stock integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post record;
  v_buyer uuid := auth.uid();
  v_shipping_address text;
begin
  if v_buyer is null then
    raise exception 'not_authenticated';
  end if;

  select id, user_id, price, stock_quantity
  into v_post
  from posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'post_not_found';
  end if;

  if v_post.price is null then
    raise exception 'price_not_set';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  if v_post.stock_quantity is null or v_post.stock_quantity < p_quantity then
    raise exception 'insufficient_stock';
  end if;

  if v_post.user_id = v_buyer then
    raise exception 'cannot_buy_own_post';
  end if;

  update posts
  set stock_quantity = stock_quantity - p_quantity
  where id = p_post_id;

  v_shipping_address := trim(coalesce(p_road_address, '') || ' ' || coalesce(p_address_detail, ''));

  insert into orders (
    buyer_id,
    seller_id,
    post_id,
    quantity,
    unit_price,
    total_price,
    shipping_address,
    shipping_address_id,
    recipient_name,
    recipient_phone,
    shipping_label,
    shipping_postal_code,
    shipping_road_address,
    shipping_address_detail,
    shipping_memo,
    status
  )
  values (
    v_buyer,
    v_post.user_id,
    p_post_id,
    p_quantity,
    v_post.price,
    v_post.price * p_quantity,
    nullif(v_shipping_address, ''),
    p_shipping_address_id,
    p_recipient_name,
    p_recipient_phone,
    p_label,
    p_postal_code,
    p_road_address,
    p_address_detail,
    p_memo,
    'PAYMENT_COMPLETED'
  )
  returning id into order_id;

  select stock_quantity into remaining_stock from posts where id = p_post_id;

  return next;
end;
$$;

revoke all on function public.create_order_and_decrement_stock(
  uuid,
  integer,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;
grant execute on function public.create_order_and_decrement_stock(
  uuid,
  integer,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
