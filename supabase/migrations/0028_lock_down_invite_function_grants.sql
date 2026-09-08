-- Supabase's advisor flagged what 0003/0004 already document and fixed
-- once for is_org_member/is_org_admin/create_organisation/handle_new_user:
-- Postgres (and Supabase's default privileges on the public schema) grant
-- EXECUTE to anon/authenticated/service_role on every new function
-- automatically, independent of `grant ... to authenticated` actually
-- being what was intended. Migration 0024 added `grant execute on
-- invite_org_member(...) to authenticated` but never revoked the anon
-- grant that came along for free — missed replicating 0003/0004's
-- pattern for this one function.
--
-- Not a live exploit — invite_org_member's own is_org_admin(org_id) check
-- fails closed for an anon caller (auth.uid() is null, so no membership
-- row ever matches), so an anon RPC call just gets the "Only an
-- organisation admin can invite members" exception, same as any other
-- unauthorized caller. But it's callable-and-erroring, not
-- callable-and-clearly-not-yours, and it doesn't match this codebase's
-- own established pattern for every other admin-gated RPC — fixing it to
-- match rather than leaving an inconsistency.

revoke execute on function invite_org_member(uuid, text, text) from public;
revoke execute on function invite_org_member(uuid, text, text) from anon;
