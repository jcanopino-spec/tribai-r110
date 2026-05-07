-- 023 · Aumentar límite de empresas por cliente de 5 a 20
-- A petición del usuario para soportar contadores con cartera más amplia.
-- La función check_max_empresas() es el único punto que enforza el límite
-- (no hay constraints adicionales). Las UI labels se actualizan en el código.

create or replace function public.check_max_empresas() returns trigger as $$
begin
  if (select count(*) from public.empresas where profile_id = new.profile_id) >= 20 then
    raise exception 'Máximo 20 empresas por cliente';
  end if;
  return new;
end;
$$ language plpgsql;
