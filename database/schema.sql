--1. USERS Table
create table users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null unique,
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
    created_at timestamptz not null default now(),
    check (check_out > check_in)
);

--5. PAYMENTS Table
create table payments (
    payment_id uuid primary key default gen_random_uuid(),
    booking_id uuid not null references bookings(booking_id),
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
    user_id uuid not null unique references users(user_id),
    rating integer not null unique
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
  for select to authenticated using (user_id = auth.uid());
create policy "read own bookings" on bookings
  for select to authenticated using (user_id = auth.uid());

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