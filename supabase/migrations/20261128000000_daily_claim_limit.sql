create or replace function public.enforce_daily_claim_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  daily_claim_limit constant integer := 3;
  current_time_utc timestamptz;
  utc_day_start_ms bigint;
  counted_claims bigint;
begin
  if new.status not in ('pending_pickup', 'verified_complete', 'completed') then
    return new;
  end if;

  if auth.uid() is not null and new.receiver_id <> auth.uid()::text then
    raise exception 'Claims must belong to the authenticated user.'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(new.receiver_id));

  current_time_utc := clock_timestamp();
  new.claimed_at := floor(extract(epoch from current_time_utc) * 1000)::bigint;
  utc_day_start_ms := floor(
    extract(
      epoch from (
        (current_time_utc at time zone 'UTC')::date::timestamp at time zone 'UTC'
      )
    ) * 1000
  )::bigint;

  select count(*)
    into counted_claims
    from public.claims
   where receiver_id = new.receiver_id
     and status in ('pending_pickup', 'verified_complete', 'completed')
     and claimed_at >= utc_day_start_ms
     and claimed_at < utc_day_start_ms + 86400000;

  if counted_claims >= daily_claim_limit then
    raise exception 'You have reached your daily claim limit of % items. Come back tomorrow!',
      daily_claim_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create index if not exists claims_receiver_claimed_at_success_idx
  on public.claims (receiver_id, claimed_at)
  where status in ('pending_pickup', 'verified_complete', 'completed');

drop trigger if exists claims_daily_limit on public.claims;
create trigger claims_daily_limit
before insert on public.claims
for each row
execute function public.enforce_daily_claim_limit();

create or replace function public.claim_surplus_listing(
  p_claim_id text,
  p_listing_id text,
  p_receiver_id text,
  p_receiver_name text,
  p_pickup_code text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  listing_row public.listings%rowtype;
  claim_time_ms bigint;
begin
  if auth.uid() is not null and p_receiver_id <> auth.uid()::text then
    raise exception 'Claims must belong to the authenticated user.'
      using errcode = '42501';
  end if;

  select *
    into listing_row
    from public.listings
   where id = p_listing_id
   for update;

  if not found or listing_row.status <> 'available' then
    raise exception 'Listing was just claimed by another user.';
  end if;

  claim_time_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;

  update public.listings
     set status = 'claimed',
         claimed_by_id = p_receiver_id,
         claimed_by_name = p_receiver_name,
         claimed_at = claim_time_ms,
         pickup_code = p_pickup_code
   where id = p_listing_id;

  insert into public.claims (
    id,
    listing_id,
    listing_title,
    donor_name,
    receiver_id,
    receiver_name,
    claimed_at,
    completed_at,
    pickup_code,
    status,
    weight_kg,
    co2_saved_kg,
    meals_saved
  )
  values (
    p_claim_id,
    listing_row.id,
    listing_row.title,
    listing_row.donor_name,
    p_receiver_id,
    p_receiver_name,
    claim_time_ms,
    null,
    p_pickup_code,
    'pending_pickup',
    listing_row.weight_kg,
    listing_row.co2_saved_kg,
    listing_row.estimated_meals
  );
end;
$$;

revoke all on function public.claim_surplus_listing(text, text, text, text, text)
  from public;
grant execute on function public.claim_surplus_listing(text, text, text, text, text)
  to anon, authenticated;
