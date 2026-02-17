-- =====================================================
-- Add missing job types to the job_type enum
-- auto_inpaint, t2v, i2v were added in the API but not in the DB enum
-- =====================================================

ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'auto_inpaint';
ALTER TYPE job_type ADD VALUE IF NOT EXISTS 't2v';
ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'i2v';
