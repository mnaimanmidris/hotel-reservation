--1. USERS Table
create table users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    email text not null unique,
    phone text,
    role text not null default 'customer'
        check ( role in ('customer', 'hotel_management')),
    created_at timestamptz not null default now()
);

--2. HOTELS Table
create table hotels (
    hotel_id uuid primary key default gen_random_uuid(),
    user_id uuid references users(user_id),
    hotel_name text not null unique,
    description text,
    address text,
    contact_email text,
    contact_phone text
);

--3. ROOMS Table
create table rooms (
    room_id uuid primary key default gen_random_uuid(),
    hotel_id uuid not null references hotels(hotel_id),
    room_name text not null,
    room_type text not null,
    price_per_night numeric(10,2) not null check (price_per_night > 0),
    availability_status text not null default 'available'
      check (availability_status in ('available', 'unavailable')),
    max_guests integer not null default 2 check (max_guests >= 1),
    quantity integer not null default 1 check (quantity >= 1),
    address text,
    constraint rooms_hotel_room_unique unique (hotel_id, room_name)
);

--4. BOOKINGS Table
create table bookings (
    booking_id uuid primary key default gen_random_uuid(),
    room_id uuid not null references rooms(room_id),
    user_id uuid references users(user_id),
    guest_name text,
    guest_email text,
    guest_phone text,
    check_in date not null,
    check_out date not null,
    price_at_booking numeric(10,2) not null,
    booking_status text not null default 'pending'
        check (booking_status in ('pending', 'confirmed', 'cancelled')),
    guests integer not null default 1 check (guests >= 1),
    rooms_booked integer not null default 1 check (rooms_booked >= 1),
    discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
    discount_label text,
    created_at timestamptz not null default now(),
    check (check_out > check_in)
);

--5. PAYMENTS Table
create table payments (
    payment_id uuid primary key default gen_random_uuid(),
    booking_id uuid not null unique references bookings(booking_id),
    stripe_payment_id text unique,
    amount numeric(10,2) not null,
    payment_status text not null
        check (payment_status in ('success', 'failed', 'refunded')),
    paid_at timestamptz
);

--6. CANCELLATIONS Table
create table cancellations (
    cancellation_id uuid primary key default gen_random_uuid(),
    booking_id uuid not null unique references bookings(booking_id),
    cancelled_at timestamptz not null default now(),
    refund_status text not null default 'pending'
        check (refund_status in ('pending', 'approved', 'rejected')),
    approval_status text not null default 'pending'
        check (approval_status in ('pending', 'approved', 'rejected')),
    approved_at timestamptz
);

--7. REVIEWS Table
create table reviews (
    review_id uuid primary key default gen_random_uuid(),
    booking_id uuid not null unique references bookings(booking_id),
    user_id uuid not null references users(user_id),
    rating integer not null
        check (rating between 1 and 5),
    review_text text,
    created_at timestamptz not null default now()
);

--8. ALGORITHM Table
--a. HOTEL SCORES Table
create table hotel_scores (
    hotel_name text not null references hotels(hotel_name),
    similar_hotel_name text not null references hotels(hotel_name),
    hybrid_score real not null,
    primary key (hotel_name, similar_hotel_name)
);

--b. HOTEL OVERALL Table
create table hotel_overall (
    hotel_name text primary key references hotels(hotel_name),
    average_rating real not null
);

--SECURITY
alter table users enable row level security;
alter table hotels enable row level security;
alter table rooms enable row level security;
alter table bookings enable row level security;
alter table payments enable row level security;
alter table cancellations enable row level security;
alter table reviews enable row level security;
alter table hotel_scores enable row level security;
alter table hotel_overall enable row level security;

create policy "public read hotels" on hotels
  for select to anon, authenticated using (true);
create policy "public read rooms" on rooms
  for select to anon, authenticated using (true);
create policy "public read hotel_scores" on hotel_scores
  for select to anon, authenticated using (true);
create policy "public read hotel_overall" on hotel_overall
  for select to anon, authenticated using (true);

create policy "read own user row" on users
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own bookings" on bookings
  for select to authenticated using (user_id = (select auth.uid()));

-- PRIVILEGES: which database roles may read which tables
grant select on public.hotels, public.rooms, public.hotel_scores, public.hotel_overall to anon, authenticated;
grant select on public.users, public.bookings to authenticated;

-- The instructions: copy the new account into our users table
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (user_id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

-- The rule: run the instructions after every new login account
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ROOM WRITE RULES: only the manager or admin of a hotel can change own rooms
grant insert, update, delete on public.rooms to authenticated;

create policy "manager or admin add rooms to own hotel" on rooms
  for insert to authenticated
  with check (
    exists (
      select 1 from hotels h
      where h.hotel_id = rooms.hotel_id
        and h.user_id = (select auth.uid())
    )
  );

create policy "manager or admin edits room of own hotel" on rooms
  for update to authenticated
  using (
    exists (
      select 1 from hotels h
      where h.hotel_id = rooms.hotel_id
        and h.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from hotels h
      where h.hotel_id = rooms.hotel_id
        and h.user_id = (select auth.uid())
    )
  );

create policy "manager or admin delete rooms of own hotel" on rooms
  for delete to authenticated
  using (
    exists (
      select 1 from hotels h
      where h.hotel_id = rooms.hotel_id
        and h.user_id = (select auth.uid())
    )
  );

-- SERVER ROLE: the tables the server (secret key) may use
grant select, insert, update, delete on public.bookings, public.payments, public.cancellations to service_role;
grant select on public.rooms, public.hotels to service_role;
grant select on public.reviews to service_role;

-- CUSTOMERS: read their own cancellations (rows are limited by the policy)
grant select on public.cancellations to authenticated;

create policy "read own cancellations" on cancellations
  for select to authenticated
  using (
    exists (
      select 1 from bookings b
      where b.booking_id = cancellations.booking_id
        and b.user_id = (select auth.uid())
    )
  );

-- REVIEWS: customers read and write their own reviews (rules below)
grant select, insert on public.reviews to authenticated;

create policy "Customers read own reviews"
on public.reviews
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Customers review own completed bookings"
on public.reviews
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.bookings b
    where b.booking_id = reviews.booking_id
      and b.user_id = (select auth.uid())
      and b.booking_status = 'confirmed'
      and b.check_out < (now() at time zone 'Asia/Kuala_Lumpur')::date
  )
);

create table room_images (
    image_id uuid primary key default gen_random_uuid(),
    room_id uuid not null references rooms(room_id) on delete cascade,
    image_path text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create index room_images_room_id_idx on room_images (room_id);

alter table room_images enable row level security;

grant select on public.room_images to anon, authenticated;
grant insert, update, delete on public.room_images to authenticated;

create policy "public read room_images" on room_images
  for select using (true);

create policy "manager adds room_images to own rooms" on room_images
  for insert to authenticated
  with check (
    exists (
      select 1 from rooms r
      join hotels h on h.hotel_id = r.hotel_id
      where r.room_id = room_images.room_id
        and h.user_id = (select auth.uid())
    )
  );

create policy "manager edits room_images of own rooms" on room_images
  for update to authenticated
  using (
    exists (
      select 1 from rooms r
      join hotels h on h.hotel_id = r.hotel_id
      where r.room_id = room_images.room_id
        and h.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from rooms r
      join hotels h on h.hotel_id = r.hotel_id
      where r.room_id = room_images.room_id
        and h.user_id = (select auth.uid())
    )
  );

create policy "manager deletes room_images of own rooms" on room_images
  for delete to authenticated
  using (
    exists (
      select 1 from rooms r
      join hotels h on h.hotel_id = r.hotel_id
      where r.room_id = room_images.room_id
        and h.user_id = (select auth.uid())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'room-images', 'room-images', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "manager reads room images of own rooms" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'room-images'
    and (storage.foldername(name))[1] in (
      select r.room_id::text
      from public.rooms r
      join public.hotels h on h.hotel_id = r.hotel_id
      where h.user_id = (select auth.uid())
    )
  );

create policy "manager uploads room images to own rooms" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'room-images'
    and (storage.foldername(name))[1] in (
      select r.room_id::text
      from public.rooms r
      join public.hotels h on h.hotel_id = r.hotel_id
      where h.user_id = (select auth.uid())
    )
  );

create policy "manager deletes room images of own rooms" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'room-images'
    and (storage.foldername(name))[1] in (
      select r.room_id::text
      from public.rooms r
      join public.hotels h on h.hotel_id = r.hotel_id
      where h.user_id = (select auth.uid())
    )
  );

grant update (full_name, phone) on public.users to authenticated;

create policy "update own profile" on users
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant update (description, address, contact_email, contact_phone)
  on public.hotels to authenticated;

create policy "manager edits own hotel" on hotels
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table site_settings (
    key text primary key,
    value jsonb not null,
    updated_by uuid references users(user_id),
    updated_at timestamptz not null default now()
);

alter table site_settings enable row level security;

grant select on public.site_settings to anon, authenticated;
grant update (value, updated_by, updated_at) on public.site_settings to authenticated;

create policy "public read site_settings" on site_settings
  for select using (true);

create policy "hotel management edits settings" on site_settings
  for update to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.user_id = (select auth.uid()) and u.role = 'hotel_management'
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.user_id = (select auth.uid()) and u.role = 'hotel_management'
    )
  );

insert into site_settings (key, value) values
  ('brand.name', '"HotelReserve"'),
  ('brand.tagline', '"Find a room, book it and pay online."'),
  ('brand.accent', '"blue"'),
  ('home.reason1_title', '"Secure online payment"'),
  ('home.reason1_text', '"Pay online when you book, through Stripe''s secure checkout."'),
  ('home.reason2_title', '"Free changes before the deadline"'),
  ('home.reason2_text', '"Registered guests can change their dates or cancel for a refund inside the free change window."'),
  ('home.reason3_title', '"Reviews from real stays"'),
  ('home.reason3_text', '"Only guests who have completed a stay can write a review."'),
  ('footer.contact_email', '""'),
  ('footer.contact_phone', '""'),
  ('brand.hero_image', '""'),
  ('rules.free_change_deadline_days', '3'),
  ('rules.member_min_stays', '3'),
  ('rules.member_discount_percent', '0'),
  ('rules.discount_stacking', '"best"');

create table audit_log (
    log_id uuid primary key default gen_random_uuid(),
    actor_id uuid references users(user_id),
    action text not null,
    target text,
    old_value jsonb,
    new_value jsonb,
    created_at timestamptz not null default now()
);

alter table audit_log enable row level security;

grant select on public.audit_log to authenticated;
grant select, insert on public.audit_log to service_role;
grant select on public.users to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-images', 'site-images', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "staff reads site images" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.users u
      where u.user_id = (select auth.uid())
        and u.role = 'hotel_management'
    )
  );

create policy "staff uploads site images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.users u
      where u.user_id = (select auth.uid())
        and u.role = 'hotel_management'
    )
  );

create policy "staff deletes site images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'site-images'
    and exists (
      select 1 from public.users u
      where u.user_id = (select auth.uid())
        and u.role = 'hotel_management'
    )
  );

-- Promo codes and member discount settings
create table promo_codes (
  promo_code_id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(hotel_id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9-]{3,20}$'),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  valid_from date,
  valid_until date,
  max_uses integer check (max_uses > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint promo_codes_percent_max
    check (discount_type <> 'percent' or discount_value <= 100),
  constraint promo_codes_dates
    check (valid_from is null or valid_until is null or valid_until >= valid_from),
  constraint promo_codes_hotel_code_unique unique (hotel_id, code)
);

alter table promo_codes enable row level security;

grant select, insert, update, delete on public.promo_codes to authenticated;
grant select on public.promo_codes to service_role;

create policy "manager reads own promo codes" on promo_codes
  for select to authenticated
  using (
    exists (
      select 1 from hotels h
      where h.hotel_id = promo_codes.hotel_id
        and h.user_id = (select auth.uid())
    )
  );

create policy "manager adds promo codes to own hotel" on promo_codes
  for insert to authenticated
  with check (
    exists (
      select 1 from hotels h
      where h.hotel_id = promo_codes.hotel_id
        and h.user_id = (select auth.uid())
    )
  );

create policy "manager edits promo codes of own hotel" on promo_codes
  for update to authenticated
  using (
    exists (
      select 1 from hotels h
      where h.hotel_id = promo_codes.hotel_id
        and h.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from hotels h
      where h.hotel_id = promo_codes.hotel_id
        and h.user_id = (select auth.uid())
    )
  );

create policy "manager deletes promo codes of own hotel" on promo_codes
  for delete to authenticated
  using (
    exists (
      select 1 from hotels h
      where h.hotel_id = promo_codes.hotel_id
        and h.user_id = (select auth.uid())
    )
  );

-- Promo codes used by a booking
create table booking_promo_codes (
  booking_id uuid not null references bookings(booking_id) on delete cascade,
  promo_code_id uuid references promo_codes(promo_code_id) on delete set null,
  code text not null,
  amount numeric(10,2) not null check (amount >= 0),
  primary key (booking_id, code)
);

create index booking_promo_codes_promo_idx on booking_promo_codes (promo_code_id);

alter table booking_promo_codes enable row level security;

grant select, insert, delete on public.booking_promo_codes to service_role;

-- LEAST PRIVILEGE: the API roles never need these table-level privileges
revoke references, trigger, truncate, maintain on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke references, trigger, truncate, maintain on tables from anon, authenticated;