-- Comprehensive migration SQL for KapiyuGuide System
-- Generated on May 10, 2025

-- First, check if tables exist and update them if they do

-- Update for InquiryMessage table to add message status tracking fields
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inquiry_messages') THEN
        -- Check if status column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'inquiry_messages' AND column_name = 'status') THEN
            ALTER TABLE inquiry_messages ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'sending';
        END IF;
        
        -- Check if sent_at column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'inquiry_messages' AND column_name = 'sent_at') THEN
            ALTER TABLE inquiry_messages ADD COLUMN sent_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();
        END IF;
        
        -- Check if delivered_at column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'inquiry_messages' AND column_name = 'delivered_at') THEN
            ALTER TABLE inquiry_messages ADD COLUMN delivered_at TIMESTAMP WITHOUT TIME ZONE;
        END IF;
        
        -- Check if read_at column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'inquiry_messages' AND column_name = 'read_at') THEN
            ALTER TABLE inquiry_messages ADD COLUMN read_at TIMESTAMP WITHOUT TIME ZONE;
        END IF;
    END IF;
END
$$;

-- Create Message table if it doesn't exist
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create indexes for message table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_messages_inquiry_id' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_messages_inquiry_id ON messages (inquiry_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_messages_sender_id' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_messages_sender_id ON messages (sender_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_messages_timestamp' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_messages_timestamp ON messages (timestamp);
    END IF;
END
$$;

-- Create MessageStatus table if it doesn't exist
CREATE TABLE IF NOT EXISTS message_statuses (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create indexes for message_statuses table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_message_statuses_message_id' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_message_statuses_message_id ON message_statuses (message_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_message_statuses_user_id' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_message_statuses_user_id ON message_statuses (user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_message_statuses_status' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_message_statuses_status ON message_statuses (status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_message_statuses_timestamp' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_message_statuses_timestamp ON message_statuses (timestamp);
    END IF;
END
$$;

-- Check for InquiryMessageAttachment relationship
CREATE TABLE IF NOT EXISTS inquiry_message_attachments (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES inquiry_messages(id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    filename VARCHAR(100) NOT NULL,
    file_size INTEGER,
    content_type VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Create table account_lock_history if it doesn't exist
CREATE TABLE IF NOT EXISTS account_lock_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    locked_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    reason VARCHAR(255),
    lock_type VARCHAR(50) NOT NULL
);

-- Create indexes for account_lock_history table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_account_lock_history_user_id' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_account_lock_history_user_id ON account_lock_history (user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_account_lock_history_locked_by_id' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_account_lock_history_locked_by_id ON account_lock_history (locked_by_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_account_lock_history_timestamp' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_account_lock_history_timestamp ON account_lock_history (timestamp);
    END IF;
END
$$;

-- Add new account lock fields to users table if they don't exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        -- Check if account_locked column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'users' AND column_name = 'account_locked') THEN
            ALTER TABLE users ADD COLUMN account_locked BOOLEAN NOT NULL DEFAULT FALSE;
            CREATE INDEX ix_users_account_locked ON users (account_locked);
        END IF;
        
        -- Check if lock_reason column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'users' AND column_name = 'lock_reason') THEN
            ALTER TABLE users ADD COLUMN lock_reason VARCHAR(255);
        END IF;
        
        -- Check if locked_at column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'users' AND column_name = 'locked_at') THEN
            ALTER TABLE users ADD COLUMN locked_at TIMESTAMP WITHOUT TIME ZONE;
        END IF;
        
        -- Check if locked_by_id column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'users' AND column_name = 'locked_by_id') THEN
            ALTER TABLE users ADD COLUMN locked_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        
        -- Check if is_online column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'users' AND column_name = 'is_online') THEN
            ALTER TABLE users ADD COLUMN is_online BOOLEAN NOT NULL DEFAULT FALSE;
        END IF;
        
        -- Check if last_activity column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'users' AND column_name = 'last_activity') THEN
            ALTER TABLE users ADD COLUMN last_activity TIMESTAMP WITHOUT TIME ZONE;
        END IF;
    END IF;
END
$$;

-- Create tables for session recording functionality if they don't exist
CREATE TABLE IF NOT EXISTS session_recordings (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL UNIQUE REFERENCES counseling_sessions(id) ON DELETE CASCADE,
    recording_path VARCHAR(255) NOT NULL,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    student_consent BOOLEAN DEFAULT FALSE,
    counselor_consent BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS session_participations (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES counseling_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    left_at TIMESTAMP WITHOUT TIME ZONE,
    connection_quality VARCHAR(20),
    device_info VARCHAR(255),
    ip_address VARCHAR(45)
);

-- Create indexes for session_participations table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_session_participations_session_id' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_session_participations_session_id ON session_participations (session_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_session_participations_user_id' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_session_participations_user_id ON session_participations (user_id);
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS session_reminders (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES counseling_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_type VARCHAR(20) NOT NULL,
    scheduled_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITHOUT TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending'
);

-- Create indexes for session_reminders table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_session_reminders_session_id' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_session_reminders_session_id ON session_reminders (session_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE c.relname = 'ix_session_reminders_user_id' AND n.nspname = current_schema()) THEN
        CREATE INDEX ix_session_reminders_user_id ON session_reminders (user_id);
    END IF;
END
$$;

-- Update video session fields in counseling_sessions table if they don't exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'counseling_sessions') THEN
        -- Check if is_video_session column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'counseling_sessions' AND column_name = 'is_video_session') THEN
            ALTER TABLE counseling_sessions ADD COLUMN is_video_session BOOLEAN DEFAULT FALSE;
        END IF;
        
        -- Check if meeting_id column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'counseling_sessions' AND column_name = 'meeting_id') THEN
            ALTER TABLE counseling_sessions ADD COLUMN meeting_id VARCHAR(100) UNIQUE;
        END IF;
        
        -- Check if meeting_url column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'counseling_sessions' AND column_name = 'meeting_url') THEN
            ALTER TABLE counseling_sessions ADD COLUMN meeting_url VARCHAR(255);
        END IF;
        
        -- Check if meeting_password column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'counseling_sessions' AND column_name = 'meeting_password') THEN
            ALTER TABLE counseling_sessions ADD COLUMN meeting_password VARCHAR(50);
        END IF;
        
        -- Check if counselor_joined_at column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'counseling_sessions' AND column_name = 'counselor_joined_at') THEN
            ALTER TABLE counseling_sessions ADD COLUMN counselor_joined_at TIMESTAMP WITHOUT TIME ZONE;
        END IF;
        
        -- Check if student_joined_at column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'counseling_sessions' AND column_name = 'student_joined_at') THEN
            ALTER TABLE counseling_sessions ADD COLUMN student_joined_at TIMESTAMP WITHOUT TIME ZONE;
        END IF;
        
        -- Check if session_ended_at column exists
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'counseling_sessions' AND column_name = 'session_ended_at') THEN
            ALTER TABLE counseling_sessions ADD COLUMN session_ended_at TIMESTAMP WITHOUT TIME ZONE;
        END IF;
    END IF;
END
$$;

-- Comments to help understand the migration
COMMENT ON TABLE message_statuses IS 'Tracks delivery status of messages';
COMMENT ON COLUMN message_statuses.status IS 'Current status: sent, delivered, read';
COMMENT ON COLUMN inquiry_messages.status IS 'Message status: sending, sent, delivered, read';
COMMENT ON COLUMN inquiry_messages.sent_at IS 'When message was sent from sender';
COMMENT ON COLUMN inquiry_messages.delivered_at IS 'When message was delivered to recipient';
COMMENT ON COLUMN inquiry_messages.read_at IS 'When message was read by recipient';

-- Command to run if you want to verify the schemas
-- SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;