begin;

drop policy if exists "public write suppliers" on public.suppliers;
drop policy if exists "public write materials" on public.materials;
drop policy if exists "public write products" on public.products;
drop policy if exists "public write purchases" on public.purchases;

drop policy if exists "public read suppliers" on public.suppliers;
drop policy if exists "public read materials" on public.materials;
drop policy if exists "public read products" on public.products;
drop policy if exists "public read purchases" on public.purchases;

drop policy if exists "authenticated write suppliers" on public.suppliers;
drop policy if exists "authenticated write materials" on public.materials;
drop policy if exists "authenticated write products" on public.products;
drop policy if exists "authenticated write purchases" on public.purchases;

create policy "public read suppliers" on public.suppliers for select to anon, authenticated using (true);
create policy "authenticated write suppliers" on public.suppliers for all to authenticated using (true) with check (true);
create policy "public read materials" on public.materials for select to anon, authenticated using (true);
create policy "authenticated write materials" on public.materials for all to authenticated using (true) with check (true);
create policy "public read products" on public.products for select to anon, authenticated using (true);
create policy "authenticated write products" on public.products for all to authenticated using (true) with check (true);
create policy "public read purchases" on public.purchases for select to anon, authenticated using (true);
create policy "authenticated write purchases" on public.purchases for insert to authenticated with check (true);

commit;