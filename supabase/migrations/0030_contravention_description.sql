-- Part 2.2 step 3 promises a plain-English case summary the moment a
-- ticket is captured: "You have a £70 PCN from Manchester City Council
-- for [contravention]. Pay £35 before 25 August, or review your appeal
-- options." Nothing built that sentence — the case page only ever showed
-- raw fields (issuer, reference, contravention_code, amounts, dates).
--
-- The missing ingredient is contravention_code alone isn't readable —
-- it's a DfT code (e.g. "01", "12"), not words. Rather than ship a
-- static code->description lookup table (risks being wrong or
-- incomplete, and this project has already drawn the line elsewhere at
-- not fabricating reference data it can't verify — see the payment-URL
-- and appeal-email-address items in the build notice), this instead
-- extracts the human-readable reason as actually printed on the notice
-- or stated in the email, alongside the code, the same "never guess,
-- only what's actually there" rule every other extraction field in this
-- schema already follows.

alter table cases
  add column if not exists contravention_description text;
