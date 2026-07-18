-- ============================================================================
-- 0005_backfill_disease_from_fingerprint.sql
--
-- cases.disease is empty right now — nothing has ever populated it. But
-- cases.fingerprint_id already encodes a disease code as its first segment
-- (e.g. 'HTN-UK-a1b2c3' -> HTN). This backfills `disease` from that code.
--
-- IMPORTANT: this mapping is my best-guess decode of standard medical
-- abbreviations, not verified against your original data-generation source.
-- Spot-check a handful of rows per disease after running this — if any
-- look wrong, just re-run the single-code UPDATE line for that code with
-- the correct name.
--
-- Only touches rows where disease IS NULL, so it's safe to re-run and safe
-- to run even if some cases already have a real disease value some other way.
-- ============================================================================

update cases set disease = case split_part(fingerprint_id, '-', 1)
  when 'AST'  then 'Asthma'
  when 'UTI'  then 'Urinary Tract Infection'
  when 'LUC'  then 'Lung Cancer'
  when 'BRC'  then 'Breast Cancer'
  when 'CRC'  then 'Colorectal Cancer'
  when 'ABR'  then 'Acute Bronchitis'
  when 'ALS'  then 'Amyotrophic Lateral Sclerosis'
  when 'PRC'  then 'Prostate Cancer'
  when 'OSA'  then 'Obstructive Sleep Apnea'
  when 'LEU'  then 'Leukemia'
  when 'COPD' then 'Chronic Obstructive Pulmonary Disease'
  when 'HTN'  then 'Hypertension'
  when 'AFIB' then 'Atrial Fibrillation'
  when 'MI'   then 'Myocardial Infarction'
  when 'EPI'  then 'Epilepsy'
  when 'CAD'  then 'Coronary Artery Disease'
  when 'PAD'  then 'Peripheral Artery Disease'
  when 'TYPH' then 'Typhoid Fever'
  when 'MIG'  then 'Migraine'
  when 'FLU'  then 'Influenza'
  when 'HF'   then 'Heart Failure'
  when 'PARK' then 'Parkinson''s Disease'
  when 'PE'   then 'Pulmonary Embolism'
  when 'ALZ'  then 'Alzheimer''s Disease'
  when 'STR'  then 'Stroke'
  when 'DVT'  then 'Deep Vein Thrombosis'
  when 'TB'   then 'Tuberculosis'
  when 'HYPR' then 'Hyperlipidemia'
  when 'IBS'  then 'Irritable Bowel Syndrome'
  when 'GERD' then 'Gastroesophageal Reflux Disease'
  when 'CHOL' then 'Hypercholesterolemia'
  when 'METS' then 'Metabolic Syndrome'
  when 'OBES' then 'Obesity'
  when 'RA'   then 'Rheumatoid Arthritis'
  when 'PSA'  then 'Psoriatic Arthritis'
  when 'PUD'  then 'Peptic Ulcer Disease'
  when 'APAN' then 'Acute Pancreatitis'
  when 'CKD'  then 'Chronic Kidney Disease'
  when 'NEPH' then 'Nephrotic Syndrome'
  when 'PSO'  then 'Psoriasis'
  when 'AKI'  then 'Acute Kidney Injury'
  when 'HYPO' then 'Hypothyroidism'
  when 'SLE'  then 'Systemic Lupus Erythematosus'
  when 'AOSD' then 'Adult-Onset Still''s Disease'
  when 'BEH'  then 'Behçet''s Disease'
  when 'NMO'  then 'Neuromyelitis Optica'
  when 'GAU'  then 'Gaucher Disease'
  when 'WIL'  then 'Wilson''s Disease'
  when 'EDS'  then 'Ehlers-Danlos Syndrome'
  when 'POM'  then 'POEMS Syndrome'
  when 'FAB'  then 'Fabry Disease'
  when 'TSC'  then 'Tuberous Sclerosis Complex'
  else null
end
where disease is null;

-- Anything that didn't match a known code (typos, new codes you've added
-- since, etc.) — check this after running, so you know what's still blank:
--
--   select distinct split_part(fingerprint_id, '-', 1), count(*)
--   from cases
--   where disease is null
--   group by 1
--   order by 2 desc;