-- Same default-privilege leak as 0003/0004: new functions get EXECUTE
-- granted to anon/authenticated automatically. log_vehicle_change and
-- log_organisation_verification_change are trigger-only, like
-- handle_new_user — never meant to be called directly via RPC.

revoke execute on function log_vehicle_change() from public, anon, authenticated;
revoke execute on function log_organisation_verification_change() from public, anon, authenticated;
