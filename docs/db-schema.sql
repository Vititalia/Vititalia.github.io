-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.anagrafica_vite (
  id text NOT NULL,
  codice_varieta text NOT NULL,
  codice_clone text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT anagrafica_vite_pkey PRIMARY KEY (id)
);
CREATE TABLE public.lotti_magazzino (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipologia text CHECK (tipologia = ANY (ARRAY['Barbatelle innestate'::text, 'Barbatelle selvatiche'::text, 'Vasetti'::text, 'Barbatelloni'::text])),
  produzione text CHECK (produzione = ANY (ARRAY['Nuova produzione'::text, 'Ripiantato'::text, 'Frigoconservato'::text])),
  codice_varieta text NOT NULL,
  codice_clone text NOT NULL,
  codice_portainnesto text NOT NULL,
  produttore text,
  anno_conferimento integer,
  quantita integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lotti_magazzino_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ordini_impegni (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_magazzino uuid,
  tipologia text NOT NULL CHECK (tipologia = ANY (ARRAY['Barbatelle innestate'::text, 'Barbatelle selvatiche'::text, 'Vasetti'::text, 'Barbatelloni'::text])),
  produzione text NOT NULL CHECK (produzione = ANY (ARRAY['Nuova produzione'::text, 'Ripiantato'::text, 'Frigoconservato'::text])),
  codice_varieta text NOT NULL,
  codice_clone text NOT NULL,
  codice_portainnesto text NOT NULL,
  quantita integer NOT NULL,
  spedito boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ordini_impegni_pkey PRIMARY KEY (id)
);
CREATE TABLE public.anagrafica_portainnesto (
  codice_portainnesto text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT anagrafica_portainnesto_pkey PRIMARY KEY (codice_portainnesto)
);
