-- 0005's unique indexes were partial (WHERE owner_type = ...), which
-- PostgREST's upsert(onConflict:) can't target — it emits a plain
-- ON CONFLICT (columns) with no predicate, and Postgres requires an exact
-- match to a real constraint/index. Fixed here by dropping the predicate.
--
-- This doesn't weaken the uniqueness guarantee: owner_user_id and
-- owner_organisation_id are already mutually exclusive per
-- vehicles_owner_matches_type, and Postgres never treats two NULLs as
-- equal in a unique index — an individual-owned row (owner_organisation_id
-- IS NULL) can never collide with another individual-owned row on this
-- index, so a non-partial index behaves identically in practice while
-- actually being usable as an ON CONFLICT target.

drop index if exists vehicles_individual_vrm_unique;
drop index if exists vehicles_org_vrm_unique;

create unique index if not exists vehicles_individual_vrm_unique
  on vehicles (owner_user_id, vrm);

create unique index if not exists vehicles_org_vrm_unique
  on vehicles (owner_organisation_id, vrm);
