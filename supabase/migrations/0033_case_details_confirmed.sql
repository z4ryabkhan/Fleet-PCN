-- Build brief (photo-to-appeal flow) section 3 step 3 / section 7 screen 3:
-- the case timeline needs a distinct "Details confirmed" stage between
-- "Uploaded" and "Appeal ready for approval" — the moment the user has
-- reviewed the OCR-extracted fields (each tagged Read/Please check) and
-- said "Looks right, continue", separate from upload time and separate
-- from whether an appeal draft exists yet. Nothing already on `cases`
-- captures that distinctly, so add one nullable timestamp for it.

alter table cases
  add column if not exists details_confirmed_at timestamptz;
