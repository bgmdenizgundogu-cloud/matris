begin;
create table public.training_courses (
 id text primary key, title_tr text not null, title_en text not null,
 dodo_product_id text, sales_enabled boolean not null default false
);
create table public.training_lessons (
 id uuid primary key default gen_random_uuid(),
 course_id text not null references public.training_courses(id),
 position integer not null check(position>0), title_tr text not null, title_en text not null,
 duration_seconds integer check(duration_seconds>0), storage_path text not null,
 published boolean not null default false, unique(course_id,position)
);
create table public.training_orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 course_id text not null references public.training_courses(id), product_id text not null,
 payment_id text unique, status text not null default 'pending' check(status in ('pending','paid','revoked')),
 created_at timestamptz not null default now()
);
create index training_orders_access on public.training_orders(user_id,course_id,status);
create table public.training_revocations(payment_id text primary key);
alter table public.training_courses enable row level security;
alter table public.training_lessons enable row level security;
alter table public.training_orders enable row level security;
alter table public.training_revocations enable row level security;
-- No browser roles may read paths or write entitlements. Access is server-only.
revoke all on public.training_courses,public.training_lessons,public.training_orders,public.training_revocations from anon,authenticated;
grant all on public.training_courses,public.training_lessons,public.training_orders,public.training_revocations to service_role;

create function public.fulfill_training_order(p_order_id uuid,p_payment_id text,p_product_ids text[])
returns void language plpgsql security definer set search_path=public as $$
declare target public.training_orders;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_payment_id,0));
 select * into target from public.training_orders where id=p_order_id for update;
 if not found or not(target.product_id=any(p_product_ids)) then raise exception 'invalid order product'; end if;
 if target.payment_id is not null and target.payment_id<>p_payment_id then raise exception 'payment mismatch'; end if;
 update public.training_orders set payment_id=p_payment_id,
 status=case when status='revoked' or exists(select 1 from public.training_revocations where payment_id=p_payment_id) then 'revoked' else 'paid' end
 where id=p_order_id;
end; $$;
create function public.revoke_training_payment(p_payment_id text)
returns void language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_payment_id,0));
 insert into public.training_revocations values(p_payment_id) on conflict do nothing;
 update public.training_orders set status='revoked' where payment_id=p_payment_id;
end; $$;
revoke all on function public.fulfill_training_order(uuid,text,text[]),public.revoke_training_payment(text) from public,anon,authenticated;
grant execute on function public.fulfill_training_order(uuid,text,text[]),public.revoke_training_payment(text) to service_role;
insert into public.training_courses(id,title_tr,title_en) values('kader-matrisi','Kader Matrisi Eğitimi','Destiny Matrix Training');
insert into storage.buckets(id,name,public) values('training-videos','training-videos',false);
-- Intentionally no storage.objects client policy. Uploads and playback signing use server/admin access.
commit;
