-- Nová role AUTHOR (mezi MEMBER a ADMIN): píše vlastní články jako koncepty
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AUTHOR' BEFORE 'ADMIN';
