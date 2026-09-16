-- Widen the investments.type check constraint to support the Bonds and Cash
-- asset classes added to the redesigned Investment tab allocation legend.
alter table public.investments drop constraint investments_type_check;
alter table public.investments add constraint investments_type_check
  check (type in ('crypto','stock','etf','bond','cash','other'));
