-- 002 · Modo de carga de la declaración
-- 'manual'  → el usuario digita los renglones uno a uno
-- 'balance' → el usuario sube un Balance de Prueba que se mapea automaticamente
-- null      → aún no ha elegido (se le muestra el selector)

alter table public.declaraciones
  add column modo_carga text
  check (modo_carga in ('manual', 'balance'));
