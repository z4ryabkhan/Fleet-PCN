-- UI review item 6: tribunal/appeal-body wording ("London Tribunals" vs
-- "the Traffic Penalty Tribunal" vs "POPLA or IAS") must come from the
-- issuer directory, not a hard-coded switch in appeal.ts keyed on
-- issuer_type. A verified issuers row can now carry the actual body that
-- issuer's appeals go to; getAdjudicatorName() in appeal.ts uses this
-- value when a directory match exists, and only falls back to the
-- issuer_type-based default while the directory doesn't yet have an
-- entry for that issuer.
alter table issuers add column if not exists tribunal_name text;
