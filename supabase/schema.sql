-- Earthkeeper schema
-- Run this in your Supabase SQL editor

create table if not exists locations (
  id           text primary key,
  name         text not null,
  type         text not null,        -- 'school' | 'hospital' | 'university'
  sub_type     text,                 -- e.g. 'Primary', 'Secondary', 'NHS Trust'
  address      text,
  postcode     text,
  lat          numeric,
  lng          numeric,
  region       text,                 -- 'London' | 'Somerset' | 'Hertfordshire' | etc
  nation       text default 'england',
  source       text,                 -- 'gias' | 'cqc' | 'hesa'
  source_id    text,                 -- original ID from source
  active       boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(source, source_id)
);

create table if not exists progress (
  id           bigint generated always as identity primary key,
  location_id  text references locations(id) on delete cascade,
  cleared      boolean default false,
  cleared_date date,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(location_id)
);

-- Indexes for fast map queries
create index if not exists idx_locations_region  on locations(region);
create index if not exists idx_locations_type    on locations(type);
create index if not exists idx_locations_active  on locations(active);
create index if not exists idx_locations_nation  on locations(nation);
create index if not exists idx_locations_latlng  on locations(lat, lng);

-- Row level security
alter table locations enable row level security;
alter table progress  enable row level security;

create policy "public read locations"  on locations for select using (true);
create policy "public read progress"   on progress  for select using (true);
create policy "public write progress"  on progress  for insert with check (true);
create policy "public update progress" on progress  for update using (true);
