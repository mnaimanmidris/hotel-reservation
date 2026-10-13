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
        check (availability_status in ('available', 'unavailable'))
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

