-- Bug found in testing: AFTER DELETE fires once the vehicles row is
-- already gone, so inserting an audit_log row with a FK to vehicles(id)
-- fails — the very row it's trying to reference no longer exists.
--
-- An audit log is supposed to be a permanent record that outlives the
-- thing it audits (e.g. Part 4's retention/audit requirements), so the
-- fix isn't trigger timing — it's that vehicle_id/organisation_id
-- shouldn't be foreign keys at all. Drop the constraints; the columns stay
-- as plain uuids, and the vrm/status snapshot in metadata carries identity
-- forward even after the source row is deleted.
--
-- Trade-off: can_view_vehicle()/is_org_admin() checks in the SELECT policy
-- need the vehicle/org row to still exist, so a deleted vehicle's audit
-- trail becomes unreadable via RLS today. No delete UI exists yet (there's
-- no DELETE policy on vehicles), so this doesn't bite in practice — revisit
-- if/when vehicle deletion ships, by denormalizing owner identity into
-- audit_log itself rather than re-adding the FK.

alter table audit_log drop constraint if exists audit_log_vehicle_id_fkey;
alter table audit_log drop constraint if exists audit_log_organisation_id_fkey;
