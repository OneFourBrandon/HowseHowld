-- Independent driveway prerequisite; safe whether household refinements ran first or not.
alter table public.households add column if not exists driveway_width integer not null default 1 check (driveway_width between 1 and 4);
alter table public.households add column if not exists garage_rows integer not null default 0 check (garage_rows between 0 and 3);
