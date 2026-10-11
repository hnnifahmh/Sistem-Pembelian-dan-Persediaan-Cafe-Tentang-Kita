-- Tentang Kita Cafe | Supabase / PostgreSQL
-- ERD sengaja dibatasi menjadi 3 entitas inti.
-- suppliers 1---n purchases, materials 1---n purchases (melalui items JSONB).

create extension if not exists pgcrypto;

drop table if exists purchases cascade;
drop table if exists materials cascade;
drop table if exists suppliers cascade;

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  is_pkp boolean not null default false,
  created_at timestamptz not null default now()
);

create table materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  minimum_stock numeric(14,3) not null default 0 check (minimum_stock >= 0),
  current_stock numeric(14,3) not null default 0 check (current_stock >= 0),
  fifo_layers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'minuman',
  selling_price numeric(14,2) not null default 0 check (selling_price >= 0),
  recipe jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  purchase_date date not null,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  items jsonb not null default '[]'::jsonb,
  journal jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index purchases_supplier_idx on purchases(supplier_id);
create index purchases_date_idx on purchases(purchase_date desc);
create index products_active_idx on products(is_active);

alter table suppliers enable row level security;
alter table materials enable row level security;
alter table products enable row level security;
alter table purchases enable row level security;

-- Data dapat dibaca publik; semua perubahan memerlukan akun Supabase Auth.
create policy "public read suppliers" on suppliers for select to anon, authenticated using (true);
create policy "authenticated write suppliers" on suppliers for all to authenticated using (true) with check (true);
create policy "public read materials" on materials for select to anon, authenticated using (true);
create policy "authenticated write materials" on materials for all to authenticated using (true) with check (true);
create policy "public read products" on products for select to anon, authenticated using (true);
create policy "authenticated write products" on products for all to authenticated using (true) with check (true);
create policy "public read purchases" on purchases for select to anon, authenticated using (true);
create policy "authenticated write purchases" on purchases for insert to authenticated with check (true);

insert into suppliers (name, contact, is_pkp) values ('Supplier Bahan Baku Semarang', 'Semarang', false);
insert into materials (name, unit, minimum_stock) values
  ('Biji kopi arabika', 'kg', 5),
  ('Susu full cream', 'liter', 12),
  ('Gula aren', 'kg', 4),
  ('Cup 16 oz', 'pcs', 100);
insert into products (name, category, selling_price, recipe, is_active) values
  ('Kopi Latte', 'minuman', 25000, '[{"material":"Biji kopi arabika","quantity":0.02},{"material":"Susu full cream","quantity":0.12},{"material":"Gula aren","quantity":0.01}]', true),
  ('Cappuccino', 'minuman', 28000, '[{"material":"Biji kopi arabika","quantity":0.02},{"material":"Susu full cream","quantity":0.14}]', true),
  ('Tea Lemon', 'minuman', 18000, '[{"material":"Teh hitam","quantity":0.02},{"material":"Lemon","quantity":0.05}]', true);

-- Catatan bisnis:
-- 1. Supplier default non-PKP, sehingga pembelian tidak membentuk PPN Masukan.
-- 2. Penjualan dine-in/takeaway memakai PBJT yang dikonfigurasi pada modul penjualan.
-- 3. fifo_layers menyimpan layer pembelian: [{quantity, unit_cost, received_at}].
-- 4. Pada pemakaian resep, konsumsi mengambil layer paling lama terlebih dahulu.
