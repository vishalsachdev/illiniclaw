-- IlliniClaw WhatsApp Bot - Database Schema
-- PostgreSQL 15+
-- Schema auto-creates on first startup via initializeDatabase()
-- This file is for reference / manual setup

-- Professors (admin users)
CREATE TABLE IF NOT EXISTS professors (
  id TEXT PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  name TEXT,
  registration_code TEXT,
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  professor_id TEXT NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  registration_code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enrollments (many-to-many)
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  canvas_course_id TEXT,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(student_id, course_id)
);

-- Messages (all communication history)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_type TEXT NOT NULL,
  sender_id TEXT,
  recipient_type TEXT NOT NULL,
  recipient_id TEXT,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  clawdbot_message_id TEXT,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions (conversation context, 2-hour TTL)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  context TEXT,
  last_topic TEXT,
  assignment_context TEXT,
  message_count INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- Broadcast queue (per-student delivery tracking)
CREATE TABLE IF NOT EXISTS broadcast_queue (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT NOT NULL,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_students_phone ON students(phone_number);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
