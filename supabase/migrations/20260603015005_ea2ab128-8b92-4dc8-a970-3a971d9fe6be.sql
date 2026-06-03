REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_campaign_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_assignment_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_proof_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_adv_payment_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_payout_event() FROM PUBLIC, anon, authenticated;