
DO $$ BEGIN
  CREATE TYPE public.doc_review_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS cnh_front_status public.doc_review_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS selfie_doc_status public.doc_review_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS address_proof_status public.doc_review_status NOT NULL DEFAULT 'pending';

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS crlv_status public.doc_review_status NOT NULL DEFAULT 'pending';
