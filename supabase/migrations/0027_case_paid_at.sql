-- Needed for the fleet reporting page (Part 2.3: "monthly summary ...
-- discount value saved") to actually compute "discount value saved"
-- correctly rather than guessing: that figure only makes sense as
-- amount_full - amount_discounted for a case that was paid AT the
-- discounted rate, which requires knowing whether payment happened on or
-- before discount_deadline. Without a timestamp for when a case was
-- actually marked paid, there's no way to tell that apart from a case
-- paid late at the full rate. markCasePaidAction sets this.

alter table cases
  add column if not exists paid_at timestamptz;
