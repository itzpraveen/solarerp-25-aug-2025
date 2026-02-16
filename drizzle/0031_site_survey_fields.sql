-- Site survey fields for jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS roof_area_sqft numeric;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS roof_condition text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS num_floors integer;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS building_height_m numeric;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS mounting_type text;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS azimuth_deg numeric;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tilt_deg numeric;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommended_capacity_kw numeric;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommended_panel_count integer;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommended_inverter text;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS shading text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS obstruction_notes text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cable_run_m numeric;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS earthing_type text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS meter_location text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS wiring_condition text;
