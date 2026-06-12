-- Reposiciona o QR gerado para encaixar no quadro do template "kit-traseiro-sua-marca"
-- (slot branco do QR no painel azul à direita). Frações relativas à arte:
--   x/y = canto superior-esquerdo (x sobre largura, y sobre altura);
--   size = lado do QR sobre a menor dimensão.
alter table public.campaign_qr_codes
  alter column qr_position set default '{"x": 0.71, "y": 0.39, "size": 0.33}'::jsonb;

-- Corrige os registros que ainda estavam no default antigo (nenhum foi ajustado manualmente).
update public.campaign_qr_codes
set qr_position = '{"x": 0.71, "y": 0.39, "size": 0.33}'::jsonb
where qr_position = '{"x": 0.76, "y": 0.68, "size": 0.18}'::jsonb;
