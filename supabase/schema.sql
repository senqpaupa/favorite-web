-- Схема для Supabase. Выполнить в Supabase → SQL Editor → New query → Run.
-- Таблицы повторяют локальные записи; works/parts/flags хранятся как jsonb.

create table if not exists clients (
  id text primary key,
  name text,
  phone text,
  address text,
  notes text,
  "createdAt" text,
  deleted boolean default false,
  updated_at timestamptz default now()
);

create table if not exists orders (
  id text primary key,
  number text,
  "clientId" text,
  "clientName" text,
  "clientPhone" text,
  address text,
  "dateIn" text,
  "deviceModel" text,
  imei text,
  serial text,
  "batteryNo" text,
  "declaredFault" text,
  flags jsonb default '{}'::jsonb,
  "agreedPrice" text,
  status text,
  receiver text,
  master text,
  urgent boolean default false,
  "urgentPercent" numeric default 0,
  note text,
  "warrantyDays" numeric default 0,
  works jsonb default '[]'::jsonb,
  parts jsonb default '[]'::jsonb,
  "dateReady" text,
  "dateDone" text,
  "createdAt" text,
  deleted boolean default false,
  updated_at timestamptz default now()
);

-- Индексы под инкрементальную синхронизацию (тянем изменения по updated_at).
create index if not exists clients_updated_at_idx on clients (updated_at);
create index if not exists orders_updated_at_idx on orders (updated_at);

-- RLS. Для одного пользователя с anon-ключом проще всего разрешить полный доступ по anon-ключу.
-- ВНИМАНИЕ: это значит, что любой, у кого есть URL и anon-ключ, сможет читать/писать данные.
-- Для мастерской (низкая чувствительность, ключ не публикуется) это приемлемо.
-- Если нужен вход по паролю — включите Supabase Auth и замените политики на auth.uid()-based.
alter table clients enable row level security;
alter table orders enable row level security;

create policy "anon full access clients" on clients for all
  to anon using (true) with check (true);
create policy "anon full access orders" on orders for all
  to anon using (true) with check (true);
