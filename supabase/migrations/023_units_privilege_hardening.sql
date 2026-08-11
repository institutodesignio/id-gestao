begin;

-- ============================================================
-- UNITS — PRIVILEGE HARDENING
--
-- Remove privilégios amplos da role authenticated e devolve
-- somente aquilo que a API realmente precisa.
-- ============================================================

revoke all privileges
on table public.units
from authenticated;

-- ------------------------------------------------------------
-- LEITURA
-- ------------------------------------------------------------

grant select
on table public.units
to authenticated;

-- ------------------------------------------------------------
-- CRIAÇÃO
--
-- Não permitir que o cliente escreva diretamente:
-- id
-- created_at
-- deleted_at
-- deleted_by
-- ------------------------------------------------------------

grant insert (
  organization_id,
  name,
  slug,
  description,
  email,
  phone,
  postal_code,
  street,
  street_number,
  address_complement,
  neighborhood,
  city,
  state_code,
  country_code,
  is_headquarters,
  status,
  created_by,
  updated_at,
  updated_by
)
on table public.units
to authenticated;

-- ------------------------------------------------------------
-- ATUALIZAÇÃO NORMAL
--
-- Não permitir alteração direta de:
-- id
-- organization_id
-- created_at
-- created_by
-- deleted_at
-- deleted_by
-- ------------------------------------------------------------

grant update (
  name,
  slug,
  description,
  email,
  phone,
  postal_code,
  street,
  street_number,
  address_complement,
  neighborhood,
  city,
  state_code,
  country_code,
  is_headquarters,
  status,
  updated_at,
  updated_by
)
on table public.units
to authenticated;

commit;