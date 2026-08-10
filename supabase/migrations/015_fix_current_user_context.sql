-- ============================================================
-- ID GESTÃO
-- Migration 015
-- Fix current_user_context RPC
--
-- Objetivo:
--   Consolidar o contexto autenticado do usuário.
--   A implementação permanece protegida no schema internal.
--   O schema public expõe apenas um wrapper controlado.
-- ============================================================


-- ============================================================
-- 1. FUNÇÃO INTERNA
-- ============================================================

CREATE OR REPLACE FUNCTION internal.current_user_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_auth_user_id uuid;
  v_profile_id uuid;
  v_member_id uuid;
  v_organization_id uuid;
  v_result jsonb;
BEGIN

  v_auth_user_id := auth.uid();

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'
      USING ERRCODE = '28000';
  END IF;


  -- ----------------------------------------------------------
  -- PROFILE ATIVO
  -- ----------------------------------------------------------

  SELECT up.id
    INTO v_profile_id
  FROM public.user_profiles up
  WHERE up.auth_user_id = v_auth_user_id
    AND up.status = 'ACTIVE'
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'USER_PROFILE_NOT_FOUND';
  END IF;


  -- ----------------------------------------------------------
  -- MEMBERSHIP ATIVO E VALIDO
  -- ----------------------------------------------------------

  IF (
    SELECT count(*)
    FROM public.organization_members om
    WHERE om.user_profile_id = v_profile_id
      AND om.status = 'ACTIVE'
      AND (
        om.ended_at IS NULL
        OR om.ended_at >= current_date
      )
  ) <> 1 THEN
    RAISE EXCEPTION 'ACTIVE_MEMBERSHIP_NOT_UNIQUE';
  END IF;


  SELECT
    om.id,
    om.organization_id
  INTO
    v_member_id,
    v_organization_id
  FROM public.organization_members om
  WHERE om.user_profile_id = v_profile_id
    AND om.status = 'ACTIVE'
    AND (
      om.ended_at IS NULL
      OR om.ended_at >= current_date
    )
  LIMIT 1;


  -- ----------------------------------------------------------
  -- CONTEXTO COMPLETO
  -- ----------------------------------------------------------

  SELECT jsonb_build_object(

    'user',
    jsonb_build_object(
      'auth_user_id', au.id,
      'profile_id', up.id,
      'person_id', up.person_id,
      'email', up.email,
      'identity_provider', up.identity_provider,
      'status', up.status
    ),

    'organization',
    jsonb_build_object(
      'id', org.id,
      'legal_name', org.legal_name,
      'trade_name', org.trade_name,
      'slug', org.slug,
      'status', org.status
    ),

    'membership',
    jsonb_build_object(
      'id', om.id,
      'status', om.status
    ),

    'roles',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'code', r.code,
            'name', r.name
          )
          ORDER BY r.code
        )
        FROM public.member_roles mr
        JOIN public.roles r
          ON r.id = mr.role_id
        WHERE mr.organization_member_id = om.id
          AND mr.starts_at <= current_date
          AND (
            mr.ends_at IS NULL
            OR mr.ends_at >= current_date
          )
          AND r.status = 'ACTIVE'
          AND r.deleted_at IS NULL
      ),
      '[]'::jsonb
    ),

    'permissions',
    COALESCE(
      (
        SELECT jsonb_agg(
          to_jsonb(perms.code)
          ORDER BY perms.code
        )
        FROM (
          SELECT DISTINCT p.code

          FROM public.member_roles mr

          JOIN public.roles r
            ON r.id = mr.role_id

          JOIN public.role_permissions rp
            ON rp.role_id = r.id

          JOIN public.permissions p
            ON p.id = rp.permission_id

          WHERE mr.organization_member_id = om.id

            AND mr.starts_at <= current_date

            AND (
              mr.ends_at IS NULL
              OR mr.ends_at >= current_date
            )

            AND r.status = 'ACTIVE'
            AND r.deleted_at IS NULL

        ) perms
      ),
      '[]'::jsonb
    ),

    'scopes',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'type', ms.scope_type,
            'unit_id', ms.unit_id,
            'project_id', ms.project_id
          )
          ORDER BY
            ms.scope_type,
            ms.unit_id,
            ms.project_id
        )
        FROM public.member_scopes ms
        WHERE ms.organization_member_id = om.id
          AND ms.starts_at <= current_date
          AND (
            ms.ends_at IS NULL
            OR ms.ends_at >= current_date
          )
      ),
      '[]'::jsonb
    )

  )
  INTO v_result

  FROM public.user_profiles up

  JOIN auth.users au
    ON au.id = up.auth_user_id

  JOIN public.organization_members om
    ON om.user_profile_id = up.id

  JOIN public.organizations org
    ON org.id = om.organization_id

  WHERE up.id = v_profile_id
    AND om.id = v_member_id
    AND org.id = v_organization_id;


  IF v_result IS NULL THEN
    RAISE EXCEPTION 'USER_CONTEXT_NOT_FOUND';
  END IF;


  RETURN v_result;

END;
$function$;


-- ============================================================
-- 2. WRAPPER PÚBLICO
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public', 'internal', 'auth', 'pg_temp'
AS $function$
  SELECT internal.current_user_context();
$function$;