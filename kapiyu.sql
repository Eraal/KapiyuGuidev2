PGDMP      ,                }            kapiyu    17.5    17.5 -   9           0    0    ENCODING    ENCODING        SET client_encoding = 'UTF8';
                           false            :           0    0 
   STDSTRINGS 
   STDSTRINGS     (   SET standard_conforming_strings = 'on';
                           false            ;           0    0 
   SEARCHPATH 
   SEARCHPATH     8   SELECT pg_catalog.set_config('search_path', '', false);
                           false            <           1262    16388    kapiyu    DATABASE     �   CREATE DATABASE kapiyu WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'English_United States.1252';
    DROP DATABASE kapiyu;
                     postgres    false            �            1259    16462    account_lock_history    TABLE       CREATE TABLE public.account_lock_history (
    id integer NOT NULL,
    user_id integer NOT NULL,
    locked_by_id integer,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reason character varying(255),
    lock_type character varying(50) NOT NULL
);
 (   DROP TABLE public.account_lock_history;
       public         heap r       postgres    false            =           0    0    TABLE account_lock_history    COMMENT     X   COMMENT ON TABLE public.account_lock_history IS 'History of account locks and unlocks';
          public               postgres    false    226            �            1259    16461    account_lock_history_id_seq    SEQUENCE     �   CREATE SEQUENCE public.account_lock_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 2   DROP SEQUENCE public.account_lock_history_id_seq;
       public               postgres    false    226            >           0    0    account_lock_history_id_seq    SEQUENCE OWNED BY     [   ALTER SEQUENCE public.account_lock_history_id_seq OWNED BY public.account_lock_history.id;
          public               postgres    false    225            �            1259    16744    announcement_images    TABLE     *  CREATE TABLE public.announcement_images (
    id integer NOT NULL,
    announcement_id integer NOT NULL,
    image_path character varying(255) NOT NULL,
    caption character varying(255),
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
 '   DROP TABLE public.announcement_images;
       public         heap r       postgres    false            ?           0    0    TABLE announcement_images    COMMENT     S   COMMENT ON TABLE public.announcement_images IS 'Images attached to announcements';
          public               postgres    false    252            �            1259    16743    announcement_images_id_seq    SEQUENCE     �   CREATE SEQUENCE public.announcement_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 1   DROP SEQUENCE public.announcement_images_id_seq;
       public               postgres    false    252            @           0    0    announcement_images_id_seq    SEQUENCE OWNED BY     Y   ALTER SEQUENCE public.announcement_images_id_seq OWNED BY public.announcement_images.id;
          public               postgres    false    251            �            1259    16719    announcements    TABLE     .  CREATE TABLE public.announcements (
    id integer NOT NULL,
    author_id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    target_office_id integer,
    is_public boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
 !   DROP TABLE public.announcements;
       public         heap r       postgres    false            A           0    0    TABLE announcements    COMMENT     N   COMMENT ON TABLE public.announcements IS 'System announcements from offices';
          public               postgres    false    250            �            1259    16718    announcements_id_seq    SEQUENCE     �   CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 +   DROP SEQUENCE public.announcements_id_seq;
       public               postgres    false    250            B           0    0    announcements_id_seq    SEQUENCE OWNED BY     M   ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;
          public               postgres    false    249                        1259    16800 
   audit_logs    TABLE     1  CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    actor_id integer,
    actor_role character varying(20),
    action character varying(100) NOT NULL,
    target_type character varying(50),
    inquiry_id integer,
    office_id integer,
    status_snapshot character varying(50),
    is_success boolean DEFAULT true,
    failure_reason character varying(255),
    ip_address character varying(45),
    user_agent character varying(255),
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    retention_days integer DEFAULT 365
);
    DROP TABLE public.audit_logs;
       public         heap r       postgres    false            C           0    0    TABLE audit_logs    COMMENT     U   COMMENT ON TABLE public.audit_logs IS 'System-wide audit logs for all user actions';
          public               postgres    false    256            �            1259    16799    audit_logs_id_seq    SEQUENCE     �   CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 (   DROP SEQUENCE public.audit_logs_id_seq;
       public               postgres    false    256            D           0    0    audit_logs_id_seq    SEQUENCE OWNED BY     G   ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;
          public               postgres    false    255            �            1259    16483    concern_types    TABLE     �   CREATE TABLE public.concern_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    allows_other boolean DEFAULT false
);
 !   DROP TABLE public.concern_types;
       public         heap r       postgres    false            E           0    0    TABLE concern_types    COMMENT     g   COMMENT ON TABLE public.concern_types IS 'Types of concerns that students can submit inquiries about';
          public               postgres    false    228            �            1259    16482    concern_types_id_seq    SEQUENCE     �   CREATE SEQUENCE public.concern_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 +   DROP SEQUENCE public.concern_types_id_seq;
       public               postgres    false    228            F           0    0    concern_types_id_seq    SEQUENCE OWNED BY     M   ALTER SEQUENCE public.concern_types_id_seq OWNED BY public.concern_types.id;
          public               postgres    false    227            �            1259    16627    counseling_sessions    TABLE     1  CREATE TABLE public.counseling_sessions (
    id integer NOT NULL,
    student_id integer NOT NULL,
    office_id integer NOT NULL,
    counselor_id integer,
    scheduled_at timestamp without time zone NOT NULL,
    duration_minutes integer DEFAULT 60,
    status character varying(50) DEFAULT 'pending'::character varying,
    notes text,
    is_video_session boolean DEFAULT false,
    meeting_id character varying(100),
    meeting_url character varying(255),
    meeting_password character varying(50),
    counselor_joined_at timestamp without time zone,
    student_joined_at timestamp without time zone,
    session_ended_at timestamp without time zone,
    counselor_in_waiting_room boolean DEFAULT false,
    student_in_waiting_room boolean DEFAULT false,
    call_started_at timestamp without time zone
);
 '   DROP TABLE public.counseling_sessions;
       public         heap r       postgres    false            G           0    0    TABLE counseling_sessions    COMMENT     P   COMMENT ON TABLE public.counseling_sessions IS 'Scheduled counseling sessions';
          public               postgres    false    242            �            1259    16626    counseling_sessions_id_seq    SEQUENCE     �   CREATE SEQUENCE public.counseling_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 1   DROP SEQUENCE public.counseling_sessions_id_seq;
       public               postgres    false    242            H           0    0    counseling_sessions_id_seq    SEQUENCE OWNED BY     Y   ALTER SEQUENCE public.counseling_sessions_id_seq OWNED BY public.counseling_sessions.id;
          public               postgres    false    241            �            1259    16556    file_attachments    TABLE     s  CREATE TABLE public.file_attachments (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    file_path character varying(255) NOT NULL,
    file_size integer,
    file_type character varying(100),
    uploaded_by_id integer,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    attachment_type character varying(50) NOT NULL
);
 $   DROP TABLE public.file_attachments;
       public         heap r       postgres    false            I           0    0    TABLE file_attachments    COMMENT     S   COMMENT ON TABLE public.file_attachments IS 'Base table for all file attachments';
          public               postgres    false    236            �            1259    16555    file_attachments_id_seq    SEQUENCE     �   CREATE SEQUENCE public.file_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 .   DROP SEQUENCE public.file_attachments_id_seq;
       public               postgres    false    236            J           0    0    file_attachments_id_seq    SEQUENCE OWNED BY     S   ALTER SEQUENCE public.file_attachments_id_seq OWNED BY public.file_attachments.id;
          public               postgres    false    235            �            1259    16514 	   inquiries    TABLE     6  CREATE TABLE public.inquiries (
    id integer NOT NULL,
    student_id integer NOT NULL,
    office_id integer NOT NULL,
    subject character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
    DROP TABLE public.inquiries;
       public         heap r       postgres    false            K           0    0    TABLE inquiries    COMMENT     O   COMMENT ON TABLE public.inquiries IS 'Student inquiries submitted to offices';
          public               postgres    false    232            �            1259    16513    inquiries_id_seq    SEQUENCE     �   CREATE SEQUENCE public.inquiries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 '   DROP SEQUENCE public.inquiries_id_seq;
       public               postgres    false    232            L           0    0    inquiries_id_seq    SEQUENCE OWNED BY     E   ALTER SEQUENCE public.inquiries_id_seq OWNED BY public.inquiries.id;
          public               postgres    false    231            �            1259    16571    inquiry_attachments    TABLE     f   CREATE TABLE public.inquiry_attachments (
    id integer NOT NULL,
    inquiry_id integer NOT NULL
);
 '   DROP TABLE public.inquiry_attachments;
       public         heap r       postgres    false            M           0    0    TABLE inquiry_attachments    COMMENT     N   COMMENT ON TABLE public.inquiry_attachments IS 'Files attached to inquiries';
          public               postgres    false    237            �            1259    16537    inquiry_concerns    TABLE     �   CREATE TABLE public.inquiry_concerns (
    id integer NOT NULL,
    inquiry_id integer NOT NULL,
    concern_type_id integer NOT NULL,
    other_specification character varying(255)
);
 $   DROP TABLE public.inquiry_concerns;
       public         heap r       postgres    false            N           0    0    TABLE inquiry_concerns    COMMENT     U   COMMENT ON TABLE public.inquiry_concerns IS 'Concerns associated with each inquiry';
          public               postgres    false    234            �            1259    16536    inquiry_concerns_id_seq    SEQUENCE     �   CREATE SEQUENCE public.inquiry_concerns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 .   DROP SEQUENCE public.inquiry_concerns_id_seq;
       public               postgres    false    234            O           0    0    inquiry_concerns_id_seq    SEQUENCE OWNED BY     S   ALTER SEQUENCE public.inquiry_concerns_id_seq OWNED BY public.inquiry_concerns.id;
          public               postgres    false    233            �            1259    16588    inquiry_messages    TABLE     �  CREATE TABLE public.inquiry_messages (
    id integer NOT NULL,
    inquiry_id integer NOT NULL,
    sender_id integer NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'sending'::character varying NOT NULL,
    delivered_at timestamp without time zone,
    read_at timestamp without time zone
);
 $   DROP TABLE public.inquiry_messages;
       public         heap r       postgres    false            P           0    0    TABLE inquiry_messages    COMMENT     U   COMMENT ON TABLE public.inquiry_messages IS 'Messages exchanged in inquiry threads';
          public               postgres    false    239            �            1259    16587    inquiry_messages_id_seq    SEQUENCE     �   CREATE SEQUENCE public.inquiry_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 .   DROP SEQUENCE public.inquiry_messages_id_seq;
       public               postgres    false    239            Q           0    0    inquiry_messages_id_seq    SEQUENCE OWNED BY     S   ALTER SEQUENCE public.inquiry_messages_id_seq OWNED BY public.inquiry_messages.id;
          public               postgres    false    238            �            1259    16610    message_attachments    TABLE     f   CREATE TABLE public.message_attachments (
    id integer NOT NULL,
    message_id integer NOT NULL
);
 '   DROP TABLE public.message_attachments;
       public         heap r       postgres    false            R           0    0    TABLE message_attachments    COMMENT     M   COMMENT ON TABLE public.message_attachments IS 'Files attached to messages';
          public               postgres    false    240            �            1259    16761    notifications    TABLE     �  CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notification_type character varying(50) DEFAULT 'general'::character varying,
    source_office_id integer,
    inquiry_id integer,
    announcement_id integer,
    link character varying(255)
);
 !   DROP TABLE public.notifications;
       public         heap r       postgres    false            S           0    0    TABLE notifications    COMMENT     ?   COMMENT ON TABLE public.notifications IS 'User notifications';
          public               postgres    false    254            �            1259    16760    notifications_id_seq    SEQUENCE     �   CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 +   DROP SEQUENCE public.notifications_id_seq;
       public               postgres    false    254            T           0    0    notifications_id_seq    SEQUENCE OWNED BY     M   ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;
          public               postgres    false    253            �            1259    16429    office_admins    TABLE     }   CREATE TABLE public.office_admins (
    id integer NOT NULL,
    user_id integer NOT NULL,
    office_id integer NOT NULL
);
 !   DROP TABLE public.office_admins;
       public         heap r       postgres    false            U           0    0    TABLE office_admins    COMMENT     R   COMMENT ON TABLE public.office_admins IS 'Users who administer specific offices';
          public               postgres    false    222            �            1259    16428    office_admins_id_seq    SEQUENCE     �   CREATE SEQUENCE public.office_admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 +   DROP SEQUENCE public.office_admins_id_seq;
       public               postgres    false    222            V           0    0    office_admins_id_seq    SEQUENCE OWNED BY     M   ALTER SEQUENCE public.office_admins_id_seq OWNED BY public.office_admins.id;
          public               postgres    false    221            �            1259    16495    office_concern_types    TABLE     �   CREATE TABLE public.office_concern_types (
    id integer NOT NULL,
    office_id integer NOT NULL,
    concern_type_id integer NOT NULL
);
 (   DROP TABLE public.office_concern_types;
       public         heap r       postgres    false            W           0    0    TABLE office_concern_types    COMMENT     f   COMMENT ON TABLE public.office_concern_types IS 'Mapping of which concern types each office handles';
          public               postgres    false    230            �            1259    16494    office_concern_types_id_seq    SEQUENCE     �   CREATE SEQUENCE public.office_concern_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 2   DROP SEQUENCE public.office_concern_types_id_seq;
       public               postgres    false    230            X           0    0    office_concern_types_id_seq    SEQUENCE OWNED BY     [   ALTER SEQUENCE public.office_concern_types_id_seq OWNED BY public.office_concern_types.id;
          public               postgres    false    229                       1259    16856    office_login_logs    TABLE     �  CREATE TABLE public.office_login_logs (
    id integer NOT NULL,
    office_admin_id integer,
    login_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    logout_time timestamp without time zone,
    ip_address character varying(45),
    user_agent character varying(255),
    session_duration integer,
    is_success boolean DEFAULT true,
    failure_reason character varying(255),
    retention_days integer DEFAULT 365
);
 %   DROP TABLE public.office_login_logs;
       public         heap r       postgres    false            Y           0    0    TABLE office_login_logs    COMMENT     L   COMMENT ON TABLE public.office_login_logs IS 'Logs of office admin logins';
          public               postgres    false    260                       1259    16855    office_login_logs_id_seq    SEQUENCE     �   CREATE SEQUENCE public.office_login_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 /   DROP SEQUENCE public.office_login_logs_id_seq;
       public               postgres    false    260            Z           0    0    office_login_logs_id_seq    SEQUENCE OWNED BY     U   ALTER SEQUENCE public.office_login_logs_id_seq OWNED BY public.office_login_logs.id;
          public               postgres    false    259            �            1259    16418    offices    TABLE     �   CREATE TABLE public.offices (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    supports_video boolean DEFAULT false
);
    DROP TABLE public.offices;
       public         heap r       postgres    false            [           0    0    TABLE offices    COMMENT     V   COMMENT ON TABLE public.offices IS 'Different offices that handle student inquiries';
          public               postgres    false    220            �            1259    16417    offices_id_seq    SEQUENCE     �   CREATE SEQUENCE public.offices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 %   DROP SEQUENCE public.offices_id_seq;
       public               postgres    false    220            \           0    0    offices_id_seq    SEQUENCE OWNED BY     A   ALTER SEQUENCE public.offices_id_seq OWNED BY public.offices.id;
          public               postgres    false    219            �            1259    16680    session_participations    TABLE     `  CREATE TABLE public.session_participations (
    id integer NOT NULL,
    session_id integer NOT NULL,
    user_id integer NOT NULL,
    joined_at timestamp without time zone NOT NULL,
    left_at timestamp without time zone,
    connection_quality character varying(20),
    device_info character varying(255),
    ip_address character varying(45)
);
 *   DROP TABLE public.session_participations;
       public         heap r       postgres    false            ]           0    0    TABLE session_participations    COMMENT     e   COMMENT ON TABLE public.session_participations IS 'Tracking of who joined/left counseling sessions';
          public               postgres    false    246            �            1259    16679    session_participations_id_seq    SEQUENCE     �   CREATE SEQUENCE public.session_participations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 4   DROP SEQUENCE public.session_participations_id_seq;
       public               postgres    false    246            ^           0    0    session_participations_id_seq    SEQUENCE OWNED BY     _   ALTER SEQUENCE public.session_participations_id_seq OWNED BY public.session_participations.id;
          public               postgres    false    245            �            1259    16663    session_recordings    TABLE     U  CREATE TABLE public.session_recordings (
    id integer NOT NULL,
    session_id integer NOT NULL,
    recording_path character varying(255) NOT NULL,
    duration_seconds integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    student_consent boolean DEFAULT false,
    counselor_consent boolean DEFAULT false
);
 &   DROP TABLE public.session_recordings;
       public         heap r       postgres    false            _           0    0    TABLE session_recordings    COMMENT     Y   COMMENT ON TABLE public.session_recordings IS 'Recordings of video counseling sessions';
          public               postgres    false    244            �            1259    16662    session_recordings_id_seq    SEQUENCE     �   CREATE SEQUENCE public.session_recordings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 0   DROP SEQUENCE public.session_recordings_id_seq;
       public               postgres    false    244            `           0    0    session_recordings_id_seq    SEQUENCE OWNED BY     W   ALTER SEQUENCE public.session_recordings_id_seq OWNED BY public.session_recordings.id;
          public               postgres    false    243            �            1259    16699    session_reminders    TABLE     [  CREATE TABLE public.session_reminders (
    id integer NOT NULL,
    session_id integer NOT NULL,
    user_id integer NOT NULL,
    reminder_type character varying(20) NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    sent_at timestamp without time zone,
    status character varying(20) DEFAULT 'pending'::character varying
);
 %   DROP TABLE public.session_reminders;
       public         heap r       postgres    false            a           0    0    TABLE session_reminders    COMMENT     [   COMMENT ON TABLE public.session_reminders IS 'Reminders for upcoming counseling sessions';
          public               postgres    false    248            �            1259    16698    session_reminders_id_seq    SEQUENCE     �   CREATE SEQUENCE public.session_reminders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 /   DROP SEQUENCE public.session_reminders_id_seq;
       public               postgres    false    248            b           0    0    session_reminders_id_seq    SEQUENCE OWNED BY     U   ALTER SEQUENCE public.session_reminders_id_seq OWNED BY public.session_reminders.id;
          public               postgres    false    247                       1259    16834    student_activity_logs    TABLE     �  CREATE TABLE public.student_activity_logs (
    id integer NOT NULL,
    student_id integer,
    action character varying(100) NOT NULL,
    related_id integer,
    related_type character varying(50),
    is_success boolean DEFAULT true,
    failure_reason character varying(255),
    ip_address character varying(45),
    user_agent character varying(255),
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    retention_days integer DEFAULT 365
);
 )   DROP TABLE public.student_activity_logs;
       public         heap r       postgres    false            c           0    0    TABLE student_activity_logs    COMMENT     O   COMMENT ON TABLE public.student_activity_logs IS 'Logs of student activities';
          public               postgres    false    258                       1259    16833    student_activity_logs_id_seq    SEQUENCE     �   CREATE SEQUENCE public.student_activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 3   DROP SEQUENCE public.student_activity_logs_id_seq;
       public               postgres    false    258            d           0    0    student_activity_logs_id_seq    SEQUENCE OWNED BY     ]   ALTER SEQUENCE public.student_activity_logs_id_seq OWNED BY public.student_activity_logs.id;
          public               postgres    false    257            �            1259    16448    students    TABLE     �   CREATE TABLE public.students (
    id integer NOT NULL,
    user_id integer NOT NULL,
    student_number character varying(50)
);
    DROP TABLE public.students;
       public         heap r       postgres    false            e           0    0    TABLE students    COMMENT     C   COMMENT ON TABLE public.students IS 'Student users of the system';
          public               postgres    false    224            �            1259    16447    students_id_seq    SEQUENCE     �   CREATE SEQUENCE public.students_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 &   DROP SEQUENCE public.students_id_seq;
       public               postgres    false    224            f           0    0    students_id_seq    SEQUENCE OWNED BY     C   ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;
          public               postgres    false    223                       1259    16875    super_admin_activity_logs    TABLE       CREATE TABLE public.super_admin_activity_logs (
    id integer NOT NULL,
    super_admin_id integer,
    action character varying(100) NOT NULL,
    target_type character varying(50),
    target_user_id integer,
    target_office_id integer,
    details text,
    is_success boolean DEFAULT true,
    failure_reason character varying(255),
    ip_address character varying(45),
    user_agent character varying(255),
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    retention_days integer DEFAULT 730
);
 -   DROP TABLE public.super_admin_activity_logs;
       public         heap r       postgres    false            g           0    0    TABLE super_admin_activity_logs    COMMENT     W   COMMENT ON TABLE public.super_admin_activity_logs IS 'Logs of super admin activities';
          public               postgres    false    262                       1259    16874     super_admin_activity_logs_id_seq    SEQUENCE     �   CREATE SEQUENCE public.super_admin_activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 7   DROP SEQUENCE public.super_admin_activity_logs_id_seq;
       public               postgres    false    262            h           0    0     super_admin_activity_logs_id_seq    SEQUENCE OWNED BY     e   ALTER SEQUENCE public.super_admin_activity_logs_id_seq OWNED BY public.super_admin_activity_logs.id;
          public               postgres    false    261            �            1259    16390    users    TABLE     |  CREATE TABLE public.users (
    id integer NOT NULL,
    first_name character varying(50) NOT NULL,
    middle_name character varying(50),
    last_name character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    profile_pic character varying(255),
    is_active boolean DEFAULT true,
    video_call_notifications boolean DEFAULT true,
    video_call_email_reminders boolean DEFAULT true,
    preferred_video_quality character varying(20) DEFAULT 'auto'::character varying,
    account_locked boolean DEFAULT false,
    lock_reason character varying(255),
    locked_at timestamp without time zone,
    locked_by_id integer,
    is_online boolean DEFAULT false,
    last_activity timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
    DROP TABLE public.users;
       public         heap r       postgres    false            i           0    0    TABLE users    COMMENT     l   COMMENT ON TABLE public.users IS 'Users of the system including students, office admins, and super admins';
          public               postgres    false    218            �            1259    16389    users_id_seq    SEQUENCE     �   CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 #   DROP SEQUENCE public.users_id_seq;
       public               postgres    false    218            j           0    0    users_id_seq    SEQUENCE OWNED BY     =   ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
          public               postgres    false    217            �           2604    16465    account_lock_history id    DEFAULT     �   ALTER TABLE ONLY public.account_lock_history ALTER COLUMN id SET DEFAULT nextval('public.account_lock_history_id_seq'::regclass);
 F   ALTER TABLE public.account_lock_history ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    225    226    226            �           2604    16747    announcement_images id    DEFAULT     �   ALTER TABLE ONLY public.announcement_images ALTER COLUMN id SET DEFAULT nextval('public.announcement_images_id_seq'::regclass);
 E   ALTER TABLE public.announcement_images ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    252    251    252            �           2604    16722    announcements id    DEFAULT     t   ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);
 ?   ALTER TABLE public.announcements ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    249    250    250            �           2604    16803    audit_logs id    DEFAULT     n   ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);
 <   ALTER TABLE public.audit_logs ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    256    255    256            �           2604    16486    concern_types id    DEFAULT     t   ALTER TABLE ONLY public.concern_types ALTER COLUMN id SET DEFAULT nextval('public.concern_types_id_seq'::regclass);
 ?   ALTER TABLE public.concern_types ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    227    228    228            �           2604    16630    counseling_sessions id    DEFAULT     �   ALTER TABLE ONLY public.counseling_sessions ALTER COLUMN id SET DEFAULT nextval('public.counseling_sessions_id_seq'::regclass);
 E   ALTER TABLE public.counseling_sessions ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    241    242    242            �           2604    16559    file_attachments id    DEFAULT     z   ALTER TABLE ONLY public.file_attachments ALTER COLUMN id SET DEFAULT nextval('public.file_attachments_id_seq'::regclass);
 B   ALTER TABLE public.file_attachments ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    236    235    236            �           2604    16517    inquiries id    DEFAULT     l   ALTER TABLE ONLY public.inquiries ALTER COLUMN id SET DEFAULT nextval('public.inquiries_id_seq'::regclass);
 ;   ALTER TABLE public.inquiries ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    231    232    232            �           2604    16540    inquiry_concerns id    DEFAULT     z   ALTER TABLE ONLY public.inquiry_concerns ALTER COLUMN id SET DEFAULT nextval('public.inquiry_concerns_id_seq'::regclass);
 B   ALTER TABLE public.inquiry_concerns ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    234    233    234            �           2604    16591    inquiry_messages id    DEFAULT     z   ALTER TABLE ONLY public.inquiry_messages ALTER COLUMN id SET DEFAULT nextval('public.inquiry_messages_id_seq'::regclass);
 B   ALTER TABLE public.inquiry_messages ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    239    238    239            �           2604    16764    notifications id    DEFAULT     t   ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);
 ?   ALTER TABLE public.notifications ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    254    253    254            �           2604    16432    office_admins id    DEFAULT     t   ALTER TABLE ONLY public.office_admins ALTER COLUMN id SET DEFAULT nextval('public.office_admins_id_seq'::regclass);
 ?   ALTER TABLE public.office_admins ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    222    221    222            �           2604    16498    office_concern_types id    DEFAULT     �   ALTER TABLE ONLY public.office_concern_types ALTER COLUMN id SET DEFAULT nextval('public.office_concern_types_id_seq'::regclass);
 F   ALTER TABLE public.office_concern_types ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    229    230    230            �           2604    16859    office_login_logs id    DEFAULT     |   ALTER TABLE ONLY public.office_login_logs ALTER COLUMN id SET DEFAULT nextval('public.office_login_logs_id_seq'::regclass);
 C   ALTER TABLE public.office_login_logs ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    260    259    260            �           2604    16421 
   offices id    DEFAULT     h   ALTER TABLE ONLY public.offices ALTER COLUMN id SET DEFAULT nextval('public.offices_id_seq'::regclass);
 9   ALTER TABLE public.offices ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    219    220    220            �           2604    16683    session_participations id    DEFAULT     �   ALTER TABLE ONLY public.session_participations ALTER COLUMN id SET DEFAULT nextval('public.session_participations_id_seq'::regclass);
 H   ALTER TABLE public.session_participations ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    246    245    246            �           2604    16666    session_recordings id    DEFAULT     ~   ALTER TABLE ONLY public.session_recordings ALTER COLUMN id SET DEFAULT nextval('public.session_recordings_id_seq'::regclass);
 D   ALTER TABLE public.session_recordings ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    244    243    244            �           2604    16702    session_reminders id    DEFAULT     |   ALTER TABLE ONLY public.session_reminders ALTER COLUMN id SET DEFAULT nextval('public.session_reminders_id_seq'::regclass);
 C   ALTER TABLE public.session_reminders ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    248    247    248            �           2604    16837    student_activity_logs id    DEFAULT     �   ALTER TABLE ONLY public.student_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.student_activity_logs_id_seq'::regclass);
 G   ALTER TABLE public.student_activity_logs ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    258    257    258            �           2604    16451    students id    DEFAULT     j   ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);
 :   ALTER TABLE public.students ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    224    223    224            �           2604    16878    super_admin_activity_logs id    DEFAULT     �   ALTER TABLE ONLY public.super_admin_activity_logs ALTER COLUMN id SET DEFAULT nextval('public.super_admin_activity_logs_id_seq'::regclass);
 K   ALTER TABLE public.super_admin_activity_logs ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    262    261    262            �           2604    16393    users id    DEFAULT     d   ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
 7   ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;
       public               postgres    false    218    217    218                      0    16462    account_lock_history 
   TABLE DATA           i   COPY public.account_lock_history (id, user_id, locked_by_id, "timestamp", reason, lock_type) FROM stdin;
    public               postgres    false    226   -�      ,          0    16744    announcement_images 
   TABLE DATA           r   COPY public.announcement_images (id, announcement_id, image_path, caption, display_order, created_at) FROM stdin;
    public               postgres    false    252   J�      *          0    16719    announcements 
   TABLE DATA           o   COPY public.announcements (id, author_id, title, content, target_office_id, is_public, created_at) FROM stdin;
    public               postgres    false    250   g�      0          0    16800 
   audit_logs 
   TABLE DATA           �   COPY public.audit_logs (id, actor_id, actor_role, action, target_type, inquiry_id, office_id, status_snapshot, is_success, failure_reason, ip_address, user_agent, "timestamp", retention_days) FROM stdin;
    public               postgres    false    256   ��                0    16483    concern_types 
   TABLE DATA           L   COPY public.concern_types (id, name, description, allows_other) FROM stdin;
    public               postgres    false    228   U�      "          0    16627    counseling_sessions 
   TABLE DATA           A  COPY public.counseling_sessions (id, student_id, office_id, counselor_id, scheduled_at, duration_minutes, status, notes, is_video_session, meeting_id, meeting_url, meeting_password, counselor_joined_at, student_joined_at, session_ended_at, counselor_in_waiting_room, student_in_waiting_room, call_started_at) FROM stdin;
    public               postgres    false    242   ��                0    16556    file_attachments 
   TABLE DATA           �   COPY public.file_attachments (id, filename, file_path, file_size, file_type, uploaded_by_id, uploaded_at, attachment_type) FROM stdin;
    public               postgres    false    236   ��                0    16514 	   inquiries 
   TABLE DATA           [   COPY public.inquiries (id, student_id, office_id, subject, status, created_at) FROM stdin;
    public               postgres    false    232   ɘ                0    16571    inquiry_attachments 
   TABLE DATA           =   COPY public.inquiry_attachments (id, inquiry_id) FROM stdin;
    public               postgres    false    237   �                0    16537    inquiry_concerns 
   TABLE DATA           `   COPY public.inquiry_concerns (id, inquiry_id, concern_type_id, other_specification) FROM stdin;
    public               postgres    false    234   �                0    16588    inquiry_messages 
   TABLE DATA           y   COPY public.inquiry_messages (id, inquiry_id, sender_id, content, created_at, status, delivered_at, read_at) FROM stdin;
    public               postgres    false    239    �                 0    16610    message_attachments 
   TABLE DATA           =   COPY public.message_attachments (id, message_id) FROM stdin;
    public               postgres    false    240   =�      .          0    16761    notifications 
   TABLE DATA           �   COPY public.notifications (id, user_id, title, message, is_read, created_at, notification_type, source_office_id, inquiry_id, announcement_id, link) FROM stdin;
    public               postgres    false    254   Z�                0    16429    office_admins 
   TABLE DATA           ?   COPY public.office_admins (id, user_id, office_id) FROM stdin;
    public               postgres    false    222   w�                0    16495    office_concern_types 
   TABLE DATA           N   COPY public.office_concern_types (id, office_id, concern_type_id) FROM stdin;
    public               postgres    false    230   ��      4          0    16856    office_login_logs 
   TABLE DATA           �   COPY public.office_login_logs (id, office_admin_id, login_time, logout_time, ip_address, user_agent, session_duration, is_success, failure_reason, retention_days) FROM stdin;
    public               postgres    false    260   J�                0    16418    offices 
   TABLE DATA           H   COPY public.offices (id, name, description, supports_video) FROM stdin;
    public               postgres    false    220   g�      &          0    16680    session_participations 
   TABLE DATA           �   COPY public.session_participations (id, session_id, user_id, joined_at, left_at, connection_quality, device_info, ip_address) FROM stdin;
    public               postgres    false    246   ܜ      $          0    16663    session_recordings 
   TABLE DATA           �   COPY public.session_recordings (id, session_id, recording_path, duration_seconds, created_at, student_consent, counselor_consent) FROM stdin;
    public               postgres    false    244   ��      (          0    16699    session_reminders 
   TABLE DATA           r   COPY public.session_reminders (id, session_id, user_id, reminder_type, scheduled_at, sent_at, status) FROM stdin;
    public               postgres    false    248   �      2          0    16834    student_activity_logs 
   TABLE DATA           �   COPY public.student_activity_logs (id, student_id, action, related_id, related_type, is_success, failure_reason, ip_address, user_agent, "timestamp", retention_days) FROM stdin;
    public               postgres    false    258   3�                0    16448    students 
   TABLE DATA           ?   COPY public.students (id, user_id, student_number) FROM stdin;
    public               postgres    false    224   P�      6          0    16875    super_admin_activity_logs 
   TABLE DATA           �   COPY public.super_admin_activity_logs (id, super_admin_id, action, target_type, target_user_id, target_office_id, details, is_success, failure_reason, ip_address, user_agent, "timestamp", retention_days) FROM stdin;
    public               postgres    false    262   m�      
          0    16390    users 
   TABLE DATA           &  COPY public.users (id, first_name, middle_name, last_name, email, password_hash, role, profile_pic, is_active, video_call_notifications, video_call_email_reminders, preferred_video_quality, account_locked, lock_reason, locked_at, locked_by_id, is_online, last_activity, created_at) FROM stdin;
    public               postgres    false    218   �      k           0    0    account_lock_history_id_seq    SEQUENCE SET     J   SELECT pg_catalog.setval('public.account_lock_history_id_seq', 1, false);
          public               postgres    false    225            l           0    0    announcement_images_id_seq    SEQUENCE SET     I   SELECT pg_catalog.setval('public.announcement_images_id_seq', 1, false);
          public               postgres    false    251            m           0    0    announcements_id_seq    SEQUENCE SET     C   SELECT pg_catalog.setval('public.announcements_id_seq', 1, false);
          public               postgres    false    249            n           0    0    audit_logs_id_seq    SEQUENCE SET     ?   SELECT pg_catalog.setval('public.audit_logs_id_seq', 4, true);
          public               postgres    false    255            o           0    0    concern_types_id_seq    SEQUENCE SET     C   SELECT pg_catalog.setval('public.concern_types_id_seq', 44, true);
          public               postgres    false    227            p           0    0    counseling_sessions_id_seq    SEQUENCE SET     I   SELECT pg_catalog.setval('public.counseling_sessions_id_seq', 1, false);
          public               postgres    false    241            q           0    0    file_attachments_id_seq    SEQUENCE SET     F   SELECT pg_catalog.setval('public.file_attachments_id_seq', 1, false);
          public               postgres    false    235            r           0    0    inquiries_id_seq    SEQUENCE SET     ?   SELECT pg_catalog.setval('public.inquiries_id_seq', 1, false);
          public               postgres    false    231            s           0    0    inquiry_concerns_id_seq    SEQUENCE SET     F   SELECT pg_catalog.setval('public.inquiry_concerns_id_seq', 1, false);
          public               postgres    false    233            t           0    0    inquiry_messages_id_seq    SEQUENCE SET     F   SELECT pg_catalog.setval('public.inquiry_messages_id_seq', 1, false);
          public               postgres    false    238            u           0    0    notifications_id_seq    SEQUENCE SET     C   SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);
          public               postgres    false    253            v           0    0    office_admins_id_seq    SEQUENCE SET     C   SELECT pg_catalog.setval('public.office_admins_id_seq', 1, false);
          public               postgres    false    221            w           0    0    office_concern_types_id_seq    SEQUENCE SET     J   SELECT pg_catalog.setval('public.office_concern_types_id_seq', 44, true);
          public               postgres    false    229            x           0    0    office_login_logs_id_seq    SEQUENCE SET     G   SELECT pg_catalog.setval('public.office_login_logs_id_seq', 1, false);
          public               postgres    false    259            y           0    0    offices_id_seq    SEQUENCE SET     =   SELECT pg_catalog.setval('public.offices_id_seq', 10, true);
          public               postgres    false    219            z           0    0    session_participations_id_seq    SEQUENCE SET     L   SELECT pg_catalog.setval('public.session_participations_id_seq', 1, false);
          public               postgres    false    245            {           0    0    session_recordings_id_seq    SEQUENCE SET     H   SELECT pg_catalog.setval('public.session_recordings_id_seq', 1, false);
          public               postgres    false    243            |           0    0    session_reminders_id_seq    SEQUENCE SET     G   SELECT pg_catalog.setval('public.session_reminders_id_seq', 1, false);
          public               postgres    false    247            }           0    0    student_activity_logs_id_seq    SEQUENCE SET     K   SELECT pg_catalog.setval('public.student_activity_logs_id_seq', 1, false);
          public               postgres    false    257            ~           0    0    students_id_seq    SEQUENCE SET     >   SELECT pg_catalog.setval('public.students_id_seq', 1, false);
          public               postgres    false    223                       0    0     super_admin_activity_logs_id_seq    SEQUENCE SET     O   SELECT pg_catalog.setval('public.super_admin_activity_logs_id_seq', 11, true);
          public               postgres    false    261            �           0    0    users_id_seq    SEQUENCE SET     :   SELECT pg_catalog.setval('public.users_id_seq', 1, true);
          public               postgres    false    217            �           2606    16468 .   account_lock_history account_lock_history_pkey 
   CONSTRAINT     l   ALTER TABLE ONLY public.account_lock_history
    ADD CONSTRAINT account_lock_history_pkey PRIMARY KEY (id);
 X   ALTER TABLE ONLY public.account_lock_history DROP CONSTRAINT account_lock_history_pkey;
       public                 postgres    false    226            '           2606    16753 ,   announcement_images announcement_images_pkey 
   CONSTRAINT     j   ALTER TABLE ONLY public.announcement_images
    ADD CONSTRAINT announcement_images_pkey PRIMARY KEY (id);
 V   ALTER TABLE ONLY public.announcement_images DROP CONSTRAINT announcement_images_pkey;
       public                 postgres    false    252            !           2606    16728     announcements announcements_pkey 
   CONSTRAINT     ^   ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);
 J   ALTER TABLE ONLY public.announcements DROP CONSTRAINT announcements_pkey;
       public                 postgres    false    250            3           2606    16810    audit_logs audit_logs_pkey 
   CONSTRAINT     X   ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
 D   ALTER TABLE ONLY public.audit_logs DROP CONSTRAINT audit_logs_pkey;
       public                 postgres    false    256            �           2606    16493 $   concern_types concern_types_name_key 
   CONSTRAINT     _   ALTER TABLE ONLY public.concern_types
    ADD CONSTRAINT concern_types_name_key UNIQUE (name);
 N   ALTER TABLE ONLY public.concern_types DROP CONSTRAINT concern_types_name_key;
       public                 postgres    false    228            �           2606    16491     concern_types concern_types_pkey 
   CONSTRAINT     ^   ALTER TABLE ONLY public.concern_types
    ADD CONSTRAINT concern_types_pkey PRIMARY KEY (id);
 J   ALTER TABLE ONLY public.concern_types DROP CONSTRAINT concern_types_pkey;
       public                 postgres    false    228                       2606    16641 6   counseling_sessions counseling_sessions_meeting_id_key 
   CONSTRAINT     w   ALTER TABLE ONLY public.counseling_sessions
    ADD CONSTRAINT counseling_sessions_meeting_id_key UNIQUE (meeting_id);
 `   ALTER TABLE ONLY public.counseling_sessions DROP CONSTRAINT counseling_sessions_meeting_id_key;
       public                 postgres    false    242                       2606    16639 ,   counseling_sessions counseling_sessions_pkey 
   CONSTRAINT     j   ALTER TABLE ONLY public.counseling_sessions
    ADD CONSTRAINT counseling_sessions_pkey PRIMARY KEY (id);
 V   ALTER TABLE ONLY public.counseling_sessions DROP CONSTRAINT counseling_sessions_pkey;
       public                 postgres    false    242            �           2606    16564 &   file_attachments file_attachments_pkey 
   CONSTRAINT     d   ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_pkey PRIMARY KEY (id);
 P   ALTER TABLE ONLY public.file_attachments DROP CONSTRAINT file_attachments_pkey;
       public                 postgres    false    236            �           2606    16521    inquiries inquiries_pkey 
   CONSTRAINT     V   ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);
 B   ALTER TABLE ONLY public.inquiries DROP CONSTRAINT inquiries_pkey;
       public                 postgres    false    232                       2606    16575 ,   inquiry_attachments inquiry_attachments_pkey 
   CONSTRAINT     j   ALTER TABLE ONLY public.inquiry_attachments
    ADD CONSTRAINT inquiry_attachments_pkey PRIMARY KEY (id);
 V   ALTER TABLE ONLY public.inquiry_attachments DROP CONSTRAINT inquiry_attachments_pkey;
       public                 postgres    false    237            �           2606    16542 &   inquiry_concerns inquiry_concerns_pkey 
   CONSTRAINT     d   ALTER TABLE ONLY public.inquiry_concerns
    ADD CONSTRAINT inquiry_concerns_pkey PRIMARY KEY (id);
 P   ALTER TABLE ONLY public.inquiry_concerns DROP CONSTRAINT inquiry_concerns_pkey;
       public                 postgres    false    234                       2606    16597 &   inquiry_messages inquiry_messages_pkey 
   CONSTRAINT     d   ALTER TABLE ONLY public.inquiry_messages
    ADD CONSTRAINT inquiry_messages_pkey PRIMARY KEY (id);
 P   ALTER TABLE ONLY public.inquiry_messages DROP CONSTRAINT inquiry_messages_pkey;
       public                 postgres    false    239            
           2606    16614 ,   message_attachments message_attachments_pkey 
   CONSTRAINT     j   ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);
 V   ALTER TABLE ONLY public.message_attachments DROP CONSTRAINT message_attachments_pkey;
       public                 postgres    false    240            1           2606    16771     notifications notifications_pkey 
   CONSTRAINT     ^   ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
 J   ALTER TABLE ONLY public.notifications DROP CONSTRAINT notifications_pkey;
       public                 postgres    false    254            �           2606    16434     office_admins office_admins_pkey 
   CONSTRAINT     ^   ALTER TABLE ONLY public.office_admins
    ADD CONSTRAINT office_admins_pkey PRIMARY KEY (id);
 J   ALTER TABLE ONLY public.office_admins DROP CONSTRAINT office_admins_pkey;
       public                 postgres    false    222            �           2606    16500 .   office_concern_types office_concern_types_pkey 
   CONSTRAINT     l   ALTER TABLE ONLY public.office_concern_types
    ADD CONSTRAINT office_concern_types_pkey PRIMARY KEY (id);
 X   ALTER TABLE ONLY public.office_concern_types DROP CONSTRAINT office_concern_types_pkey;
       public                 postgres    false    230            E           2606    16866 (   office_login_logs office_login_logs_pkey 
   CONSTRAINT     f   ALTER TABLE ONLY public.office_login_logs
    ADD CONSTRAINT office_login_logs_pkey PRIMARY KEY (id);
 R   ALTER TABLE ONLY public.office_login_logs DROP CONSTRAINT office_login_logs_pkey;
       public                 postgres    false    260            �           2606    16426    offices offices_pkey 
   CONSTRAINT     R   ALTER TABLE ONLY public.offices
    ADD CONSTRAINT offices_pkey PRIMARY KEY (id);
 >   ALTER TABLE ONLY public.offices DROP CONSTRAINT offices_pkey;
       public                 postgres    false    220                       2606    16685 2   session_participations session_participations_pkey 
   CONSTRAINT     p   ALTER TABLE ONLY public.session_participations
    ADD CONSTRAINT session_participations_pkey PRIMARY KEY (id);
 \   ALTER TABLE ONLY public.session_participations DROP CONSTRAINT session_participations_pkey;
       public                 postgres    false    246                       2606    16671 *   session_recordings session_recordings_pkey 
   CONSTRAINT     h   ALTER TABLE ONLY public.session_recordings
    ADD CONSTRAINT session_recordings_pkey PRIMARY KEY (id);
 T   ALTER TABLE ONLY public.session_recordings DROP CONSTRAINT session_recordings_pkey;
       public                 postgres    false    244                       2606    16673 4   session_recordings session_recordings_session_id_key 
   CONSTRAINT     u   ALTER TABLE ONLY public.session_recordings
    ADD CONSTRAINT session_recordings_session_id_key UNIQUE (session_id);
 ^   ALTER TABLE ONLY public.session_recordings DROP CONSTRAINT session_recordings_session_id_key;
       public                 postgres    false    244                       2606    16705 (   session_reminders session_reminders_pkey 
   CONSTRAINT     f   ALTER TABLE ONLY public.session_reminders
    ADD CONSTRAINT session_reminders_pkey PRIMARY KEY (id);
 R   ALTER TABLE ONLY public.session_reminders DROP CONSTRAINT session_reminders_pkey;
       public                 postgres    false    248            A           2606    16844 0   student_activity_logs student_activity_logs_pkey 
   CONSTRAINT     n   ALTER TABLE ONLY public.student_activity_logs
    ADD CONSTRAINT student_activity_logs_pkey PRIMARY KEY (id);
 Z   ALTER TABLE ONLY public.student_activity_logs DROP CONSTRAINT student_activity_logs_pkey;
       public                 postgres    false    258            �           2606    16453    students students_pkey 
   CONSTRAINT     T   ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);
 @   ALTER TABLE ONLY public.students DROP CONSTRAINT students_pkey;
       public                 postgres    false    224            M           2606    16885 8   super_admin_activity_logs super_admin_activity_logs_pkey 
   CONSTRAINT     v   ALTER TABLE ONLY public.super_admin_activity_logs
    ADD CONSTRAINT super_admin_activity_logs_pkey PRIMARY KEY (id);
 b   ALTER TABLE ONLY public.super_admin_activity_logs DROP CONSTRAINT super_admin_activity_logs_pkey;
       public                 postgres    false    262            �           2606    16406    users users_email_key 
   CONSTRAINT     Q   ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);
 ?   ALTER TABLE ONLY public.users DROP CONSTRAINT users_email_key;
       public                 postgres    false    218            �           2606    16404    users users_pkey 
   CONSTRAINT     N   ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
 :   ALTER TABLE ONLY public.users DROP CONSTRAINT users_pkey;
       public                 postgres    false    218            �           1259    16480 %   idx_account_lock_history_locked_by_id    INDEX     n   CREATE INDEX idx_account_lock_history_locked_by_id ON public.account_lock_history USING btree (locked_by_id);
 9   DROP INDEX public.idx_account_lock_history_locked_by_id;
       public                 postgres    false    226            �           1259    16481 "   idx_account_lock_history_timestamp    INDEX     j   CREATE INDEX idx_account_lock_history_timestamp ON public.account_lock_history USING btree ("timestamp");
 6   DROP INDEX public.idx_account_lock_history_timestamp;
       public                 postgres    false    226            �           1259    16479     idx_account_lock_history_user_id    INDEX     d   CREATE INDEX idx_account_lock_history_user_id ON public.account_lock_history USING btree (user_id);
 4   DROP INDEX public.idx_account_lock_history_user_id;
       public                 postgres    false    226            (           1259    16759 '   idx_announcement_images_announcement_id    INDEX     r   CREATE INDEX idx_announcement_images_announcement_id ON public.announcement_images USING btree (announcement_id);
 ;   DROP INDEX public.idx_announcement_images_announcement_id;
       public                 postgres    false    252            "           1259    16739    idx_announcements_author_id    INDEX     Z   CREATE INDEX idx_announcements_author_id ON public.announcements USING btree (author_id);
 /   DROP INDEX public.idx_announcements_author_id;
       public                 postgres    false    250            #           1259    16742    idx_announcements_created_at    INDEX     \   CREATE INDEX idx_announcements_created_at ON public.announcements USING btree (created_at);
 0   DROP INDEX public.idx_announcements_created_at;
       public                 postgres    false    250            $           1259    16741    idx_announcements_is_public    INDEX     Z   CREATE INDEX idx_announcements_is_public ON public.announcements USING btree (is_public);
 /   DROP INDEX public.idx_announcements_is_public;
       public                 postgres    false    250            %           1259    16740 "   idx_announcements_target_office_id    INDEX     h   CREATE INDEX idx_announcements_target_office_id ON public.announcements USING btree (target_office_id);
 6   DROP INDEX public.idx_announcements_target_office_id;
       public                 postgres    false    250            4           1259    16828    idx_audit_logs_action    INDEX     N   CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);
 )   DROP INDEX public.idx_audit_logs_action;
       public                 postgres    false    256            5           1259    16826    idx_audit_logs_actor_id    INDEX     R   CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs USING btree (actor_id);
 +   DROP INDEX public.idx_audit_logs_actor_id;
       public                 postgres    false    256            6           1259    16827    idx_audit_logs_actor_role    INDEX     V   CREATE INDEX idx_audit_logs_actor_role ON public.audit_logs USING btree (actor_role);
 -   DROP INDEX public.idx_audit_logs_actor_role;
       public                 postgres    false    256            7           1259    16830    idx_audit_logs_inquiry_id    INDEX     V   CREATE INDEX idx_audit_logs_inquiry_id ON public.audit_logs USING btree (inquiry_id);
 -   DROP INDEX public.idx_audit_logs_inquiry_id;
       public                 postgres    false    256            8           1259    16831    idx_audit_logs_office_id    INDEX     T   CREATE INDEX idx_audit_logs_office_id ON public.audit_logs USING btree (office_id);
 ,   DROP INDEX public.idx_audit_logs_office_id;
       public                 postgres    false    256            9           1259    16829    idx_audit_logs_target_type    INDEX     X   CREATE INDEX idx_audit_logs_target_type ON public.audit_logs USING btree (target_type);
 .   DROP INDEX public.idx_audit_logs_target_type;
       public                 postgres    false    256            :           1259    16832    idx_audit_logs_timestamp    INDEX     V   CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");
 ,   DROP INDEX public.idx_audit_logs_timestamp;
       public                 postgres    false    256                       1259    16659 $   idx_counseling_sessions_counselor_id    INDEX     l   CREATE INDEX idx_counseling_sessions_counselor_id ON public.counseling_sessions USING btree (counselor_id);
 8   DROP INDEX public.idx_counseling_sessions_counselor_id;
       public                 postgres    false    242                       1259    16658 !   idx_counseling_sessions_office_id    INDEX     f   CREATE INDEX idx_counseling_sessions_office_id ON public.counseling_sessions USING btree (office_id);
 5   DROP INDEX public.idx_counseling_sessions_office_id;
       public                 postgres    false    242                       1259    16660 $   idx_counseling_sessions_scheduled_at    INDEX     l   CREATE INDEX idx_counseling_sessions_scheduled_at ON public.counseling_sessions USING btree (scheduled_at);
 8   DROP INDEX public.idx_counseling_sessions_scheduled_at;
       public                 postgres    false    242                       1259    16661    idx_counseling_sessions_status    INDEX     `   CREATE INDEX idx_counseling_sessions_status ON public.counseling_sessions USING btree (status);
 2   DROP INDEX public.idx_counseling_sessions_status;
       public                 postgres    false    242                       1259    16657 "   idx_counseling_sessions_student_id    INDEX     h   CREATE INDEX idx_counseling_sessions_student_id ON public.counseling_sessions USING btree (student_id);
 6   DROP INDEX public.idx_counseling_sessions_student_id;
       public                 postgres    false    242                        1259    16570 #   idx_file_attachments_uploaded_by_id    INDEX     j   CREATE INDEX idx_file_attachments_uploaded_by_id ON public.file_attachments USING btree (uploaded_by_id);
 7   DROP INDEX public.idx_file_attachments_uploaded_by_id;
       public                 postgres    false    236            �           1259    16535    idx_inquiries_created_at    INDEX     T   CREATE INDEX idx_inquiries_created_at ON public.inquiries USING btree (created_at);
 ,   DROP INDEX public.idx_inquiries_created_at;
       public                 postgres    false    232            �           1259    16533    idx_inquiries_office_id    INDEX     R   CREATE INDEX idx_inquiries_office_id ON public.inquiries USING btree (office_id);
 +   DROP INDEX public.idx_inquiries_office_id;
       public                 postgres    false    232            �           1259    16534    idx_inquiries_status    INDEX     L   CREATE INDEX idx_inquiries_status ON public.inquiries USING btree (status);
 (   DROP INDEX public.idx_inquiries_status;
       public                 postgres    false    232            �           1259    16532    idx_inquiries_student_id    INDEX     T   CREATE INDEX idx_inquiries_student_id ON public.inquiries USING btree (student_id);
 ,   DROP INDEX public.idx_inquiries_student_id;
       public                 postgres    false    232                       1259    16586 "   idx_inquiry_attachments_inquiry_id    INDEX     h   CREATE INDEX idx_inquiry_attachments_inquiry_id ON public.inquiry_attachments USING btree (inquiry_id);
 6   DROP INDEX public.idx_inquiry_attachments_inquiry_id;
       public                 postgres    false    237            �           1259    16554 $   idx_inquiry_concerns_concern_type_id    INDEX     l   CREATE INDEX idx_inquiry_concerns_concern_type_id ON public.inquiry_concerns USING btree (concern_type_id);
 8   DROP INDEX public.idx_inquiry_concerns_concern_type_id;
       public                 postgres    false    234            �           1259    16553    idx_inquiry_concerns_inquiry_id    INDEX     b   CREATE INDEX idx_inquiry_concerns_inquiry_id ON public.inquiry_concerns USING btree (inquiry_id);
 3   DROP INDEX public.idx_inquiry_concerns_inquiry_id;
       public                 postgres    false    234                       1259    16608    idx_inquiry_messages_inquiry_id    INDEX     b   CREATE INDEX idx_inquiry_messages_inquiry_id ON public.inquiry_messages USING btree (inquiry_id);
 3   DROP INDEX public.idx_inquiry_messages_inquiry_id;
       public                 postgres    false    239                       1259    16609    idx_inquiry_messages_sender_id    INDEX     `   CREATE INDEX idx_inquiry_messages_sender_id ON public.inquiry_messages USING btree (sender_id);
 2   DROP INDEX public.idx_inquiry_messages_sender_id;
       public                 postgres    false    239                       1259    16625 "   idx_message_attachments_message_id    INDEX     h   CREATE INDEX idx_message_attachments_message_id ON public.message_attachments USING btree (message_id);
 6   DROP INDEX public.idx_message_attachments_message_id;
       public                 postgres    false    240            )           1259    16798 !   idx_notifications_announcement_id    INDEX     f   CREATE INDEX idx_notifications_announcement_id ON public.notifications USING btree (announcement_id);
 5   DROP INDEX public.idx_notifications_announcement_id;
       public                 postgres    false    254            *           1259    16794    idx_notifications_created_at    INDEX     \   CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);
 0   DROP INDEX public.idx_notifications_created_at;
       public                 postgres    false    254            +           1259    16797    idx_notifications_inquiry_id    INDEX     \   CREATE INDEX idx_notifications_inquiry_id ON public.notifications USING btree (inquiry_id);
 0   DROP INDEX public.idx_notifications_inquiry_id;
       public                 postgres    false    254            ,           1259    16793    idx_notifications_is_read    INDEX     V   CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);
 -   DROP INDEX public.idx_notifications_is_read;
       public                 postgres    false    254            -           1259    16795 #   idx_notifications_notification_type    INDEX     j   CREATE INDEX idx_notifications_notification_type ON public.notifications USING btree (notification_type);
 7   DROP INDEX public.idx_notifications_notification_type;
       public                 postgres    false    254            .           1259    16796 "   idx_notifications_source_office_id    INDEX     h   CREATE INDEX idx_notifications_source_office_id ON public.notifications USING btree (source_office_id);
 6   DROP INDEX public.idx_notifications_source_office_id;
       public                 postgres    false    254            /           1259    16792    idx_notifications_user_id    INDEX     V   CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
 -   DROP INDEX public.idx_notifications_user_id;
       public                 postgres    false    254            �           1259    16446    idx_office_admins_office_id    INDEX     Z   CREATE INDEX idx_office_admins_office_id ON public.office_admins USING btree (office_id);
 /   DROP INDEX public.idx_office_admins_office_id;
       public                 postgres    false    222            �           1259    16445    idx_office_admins_user_id    INDEX     V   CREATE INDEX idx_office_admins_user_id ON public.office_admins USING btree (user_id);
 -   DROP INDEX public.idx_office_admins_user_id;
       public                 postgres    false    222            �           1259    16512 (   idx_office_concern_types_concern_type_id    INDEX     t   CREATE INDEX idx_office_concern_types_concern_type_id ON public.office_concern_types USING btree (concern_type_id);
 <   DROP INDEX public.idx_office_concern_types_concern_type_id;
       public                 postgres    false    230            �           1259    16511 "   idx_office_concern_types_office_id    INDEX     h   CREATE INDEX idx_office_concern_types_office_id ON public.office_concern_types USING btree (office_id);
 6   DROP INDEX public.idx_office_concern_types_office_id;
       public                 postgres    false    230            B           1259    16873     idx_office_login_logs_login_time    INDEX     d   CREATE INDEX idx_office_login_logs_login_time ON public.office_login_logs USING btree (login_time);
 4   DROP INDEX public.idx_office_login_logs_login_time;
       public                 postgres    false    260            C           1259    16872 %   idx_office_login_logs_office_admin_id    INDEX     n   CREATE INDEX idx_office_login_logs_office_admin_id ON public.office_login_logs USING btree (office_admin_id);
 9   DROP INDEX public.idx_office_login_logs_office_admin_id;
       public                 postgres    false    260            �           1259    16427    idx_offices_name    INDEX     D   CREATE INDEX idx_offices_name ON public.offices USING btree (name);
 $   DROP INDEX public.idx_offices_name;
       public                 postgres    false    220                       1259    16696 %   idx_session_participations_session_id    INDEX     n   CREATE INDEX idx_session_participations_session_id ON public.session_participations USING btree (session_id);
 9   DROP INDEX public.idx_session_participations_session_id;
       public                 postgres    false    246                       1259    16697 "   idx_session_participations_user_id    INDEX     h   CREATE INDEX idx_session_participations_user_id ON public.session_participations USING btree (user_id);
 6   DROP INDEX public.idx_session_participations_user_id;
       public                 postgres    false    246                       1259    16716     idx_session_reminders_session_id    INDEX     d   CREATE INDEX idx_session_reminders_session_id ON public.session_reminders USING btree (session_id);
 4   DROP INDEX public.idx_session_reminders_session_id;
       public                 postgres    false    248                       1259    16717    idx_session_reminders_user_id    INDEX     ^   CREATE INDEX idx_session_reminders_user_id ON public.session_reminders USING btree (user_id);
 1   DROP INDEX public.idx_session_reminders_user_id;
       public                 postgres    false    248            ;           1259    16851     idx_student_activity_logs_action    INDEX     d   CREATE INDEX idx_student_activity_logs_action ON public.student_activity_logs USING btree (action);
 4   DROP INDEX public.idx_student_activity_logs_action;
       public                 postgres    false    258            <           1259    16852 $   idx_student_activity_logs_related_id    INDEX     l   CREATE INDEX idx_student_activity_logs_related_id ON public.student_activity_logs USING btree (related_id);
 8   DROP INDEX public.idx_student_activity_logs_related_id;
       public                 postgres    false    258            =           1259    16853 &   idx_student_activity_logs_related_type    INDEX     p   CREATE INDEX idx_student_activity_logs_related_type ON public.student_activity_logs USING btree (related_type);
 :   DROP INDEX public.idx_student_activity_logs_related_type;
       public                 postgres    false    258            >           1259    16850 $   idx_student_activity_logs_student_id    INDEX     l   CREATE INDEX idx_student_activity_logs_student_id ON public.student_activity_logs USING btree (student_id);
 8   DROP INDEX public.idx_student_activity_logs_student_id;
       public                 postgres    false    258            ?           1259    16854 #   idx_student_activity_logs_timestamp    INDEX     l   CREATE INDEX idx_student_activity_logs_timestamp ON public.student_activity_logs USING btree ("timestamp");
 7   DROP INDEX public.idx_student_activity_logs_timestamp;
       public                 postgres    false    258            �           1259    16460    idx_students_student_number    INDEX     Z   CREATE INDEX idx_students_student_number ON public.students USING btree (student_number);
 /   DROP INDEX public.idx_students_student_number;
       public                 postgres    false    224            �           1259    16459    idx_students_user_id    INDEX     L   CREATE INDEX idx_students_user_id ON public.students USING btree (user_id);
 (   DROP INDEX public.idx_students_user_id;
       public                 postgres    false    224            F           1259    16902 $   idx_super_admin_activity_logs_action    INDEX     l   CREATE INDEX idx_super_admin_activity_logs_action ON public.super_admin_activity_logs USING btree (action);
 8   DROP INDEX public.idx_super_admin_activity_logs_action;
       public                 postgres    false    262            G           1259    16901 ,   idx_super_admin_activity_logs_super_admin_id    INDEX     |   CREATE INDEX idx_super_admin_activity_logs_super_admin_id ON public.super_admin_activity_logs USING btree (super_admin_id);
 @   DROP INDEX public.idx_super_admin_activity_logs_super_admin_id;
       public                 postgres    false    262            H           1259    16905 .   idx_super_admin_activity_logs_target_office_id    INDEX     �   CREATE INDEX idx_super_admin_activity_logs_target_office_id ON public.super_admin_activity_logs USING btree (target_office_id);
 B   DROP INDEX public.idx_super_admin_activity_logs_target_office_id;
       public                 postgres    false    262            I           1259    16903 )   idx_super_admin_activity_logs_target_type    INDEX     v   CREATE INDEX idx_super_admin_activity_logs_target_type ON public.super_admin_activity_logs USING btree (target_type);
 =   DROP INDEX public.idx_super_admin_activity_logs_target_type;
       public                 postgres    false    262            J           1259    16904 ,   idx_super_admin_activity_logs_target_user_id    INDEX     |   CREATE INDEX idx_super_admin_activity_logs_target_user_id ON public.super_admin_activity_logs USING btree (target_user_id);
 @   DROP INDEX public.idx_super_admin_activity_logs_target_user_id;
       public                 postgres    false    262            K           1259    16906 '   idx_super_admin_activity_logs_timestamp    INDEX     t   CREATE INDEX idx_super_admin_activity_logs_timestamp ON public.super_admin_activity_logs USING btree ("timestamp");
 ;   DROP INDEX public.idx_super_admin_activity_logs_timestamp;
       public                 postgres    false    262            �           1259    16415    idx_users_account_locked    INDEX     T   CREATE INDEX idx_users_account_locked ON public.users USING btree (account_locked);
 ,   DROP INDEX public.idx_users_account_locked;
       public                 postgres    false    218            �           1259    16416    idx_users_created_at    INDEX     L   CREATE INDEX idx_users_created_at ON public.users USING btree (created_at);
 (   DROP INDEX public.idx_users_created_at;
       public                 postgres    false    218            �           1259    16412    idx_users_email    INDEX     B   CREATE INDEX idx_users_email ON public.users USING btree (email);
 #   DROP INDEX public.idx_users_email;
       public                 postgres    false    218            �           1259    16414    idx_users_is_active    INDEX     J   CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);
 '   DROP INDEX public.idx_users_is_active;
       public                 postgres    false    218            �           1259    16413    idx_users_role    INDEX     @   CREATE INDEX idx_users_role ON public.users USING btree (role);
 "   DROP INDEX public.idx_users_role;
       public                 postgres    false    218            R           2606    16474 ;   account_lock_history account_lock_history_locked_by_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.account_lock_history
    ADD CONSTRAINT account_lock_history_locked_by_id_fkey FOREIGN KEY (locked_by_id) REFERENCES public.users(id) ON DELETE SET NULL;
 e   ALTER TABLE ONLY public.account_lock_history DROP CONSTRAINT account_lock_history_locked_by_id_fkey;
       public               postgres    false    226    218    4827            S           2606    16469 6   account_lock_history account_lock_history_user_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.account_lock_history
    ADD CONSTRAINT account_lock_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
 `   ALTER TABLE ONLY public.account_lock_history DROP CONSTRAINT account_lock_history_user_id_fkey;
       public               postgres    false    226    4827    218            k           2606    16754 <   announcement_images announcement_images_announcement_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.announcement_images
    ADD CONSTRAINT announcement_images_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;
 f   ALTER TABLE ONLY public.announcement_images DROP CONSTRAINT announcement_images_announcement_id_fkey;
       public               postgres    false    252    4897    250            i           2606    16729 *   announcements announcements_author_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE;
 T   ALTER TABLE ONLY public.announcements DROP CONSTRAINT announcements_author_id_fkey;
       public               postgres    false    250    4827    218            j           2606    16734 1   announcements announcements_target_office_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_target_office_id_fkey FOREIGN KEY (target_office_id) REFERENCES public.offices(id) ON DELETE SET NULL;
 [   ALTER TABLE ONLY public.announcements DROP CONSTRAINT announcements_target_office_id_fkey;
       public               postgres    false    250    4830    220            p           2606    16811 #   audit_logs audit_logs_actor_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;
 M   ALTER TABLE ONLY public.audit_logs DROP CONSTRAINT audit_logs_actor_id_fkey;
       public               postgres    false    256    4827    218            q           2606    16816 %   audit_logs audit_logs_inquiry_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id) ON DELETE SET NULL;
 O   ALTER TABLE ONLY public.audit_logs DROP CONSTRAINT audit_logs_inquiry_id_fkey;
       public               postgres    false    256    4857    232            r           2606    16821 $   audit_logs audit_logs_office_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE SET NULL;
 N   ALTER TABLE ONLY public.audit_logs DROP CONSTRAINT audit_logs_office_id_fkey;
       public               postgres    false    220    256    4830            a           2606    16652 9   counseling_sessions counseling_sessions_counselor_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.counseling_sessions
    ADD CONSTRAINT counseling_sessions_counselor_id_fkey FOREIGN KEY (counselor_id) REFERENCES public.users(id) ON DELETE CASCADE;
 c   ALTER TABLE ONLY public.counseling_sessions DROP CONSTRAINT counseling_sessions_counselor_id_fkey;
       public               postgres    false    242    218    4827            b           2606    16647 6   counseling_sessions counseling_sessions_office_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.counseling_sessions
    ADD CONSTRAINT counseling_sessions_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE CASCADE;
 `   ALTER TABLE ONLY public.counseling_sessions DROP CONSTRAINT counseling_sessions_office_id_fkey;
       public               postgres    false    242    4830    220            c           2606    16642 7   counseling_sessions counseling_sessions_student_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.counseling_sessions
    ADD CONSTRAINT counseling_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
 a   ALTER TABLE ONLY public.counseling_sessions DROP CONSTRAINT counseling_sessions_student_id_fkey;
       public               postgres    false    242    4838    224            Z           2606    16565 5   file_attachments file_attachments_uploaded_by_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES public.users(id) ON DELETE SET NULL;
 _   ALTER TABLE ONLY public.file_attachments DROP CONSTRAINT file_attachments_uploaded_by_id_fkey;
       public               postgres    false    236    4827    218            V           2606    16527 "   inquiries inquiries_office_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE CASCADE;
 L   ALTER TABLE ONLY public.inquiries DROP CONSTRAINT inquiries_office_id_fkey;
       public               postgres    false    232    4830    220            W           2606    16522 #   inquiries inquiries_student_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
 M   ALTER TABLE ONLY public.inquiries DROP CONSTRAINT inquiries_student_id_fkey;
       public               postgres    false    232    4838    224            [           2606    16576 /   inquiry_attachments inquiry_attachments_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.inquiry_attachments
    ADD CONSTRAINT inquiry_attachments_id_fkey FOREIGN KEY (id) REFERENCES public.file_attachments(id) ON DELETE CASCADE;
 Y   ALTER TABLE ONLY public.inquiry_attachments DROP CONSTRAINT inquiry_attachments_id_fkey;
       public               postgres    false    237    4863    236            \           2606    16581 7   inquiry_attachments inquiry_attachments_inquiry_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.inquiry_attachments
    ADD CONSTRAINT inquiry_attachments_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id) ON DELETE CASCADE;
 a   ALTER TABLE ONLY public.inquiry_attachments DROP CONSTRAINT inquiry_attachments_inquiry_id_fkey;
       public               postgres    false    237    4857    232            X           2606    16548 6   inquiry_concerns inquiry_concerns_concern_type_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.inquiry_concerns
    ADD CONSTRAINT inquiry_concerns_concern_type_id_fkey FOREIGN KEY (concern_type_id) REFERENCES public.concern_types(id) ON DELETE CASCADE;
 `   ALTER TABLE ONLY public.inquiry_concerns DROP CONSTRAINT inquiry_concerns_concern_type_id_fkey;
       public               postgres    false    234    4847    228            Y           2606    16543 1   inquiry_concerns inquiry_concerns_inquiry_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.inquiry_concerns
    ADD CONSTRAINT inquiry_concerns_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id) ON DELETE CASCADE;
 [   ALTER TABLE ONLY public.inquiry_concerns DROP CONSTRAINT inquiry_concerns_inquiry_id_fkey;
       public               postgres    false    234    4857    232            ]           2606    16598 1   inquiry_messages inquiry_messages_inquiry_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.inquiry_messages
    ADD CONSTRAINT inquiry_messages_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id) ON DELETE CASCADE;
 [   ALTER TABLE ONLY public.inquiry_messages DROP CONSTRAINT inquiry_messages_inquiry_id_fkey;
       public               postgres    false    239    4857    232            ^           2606    16603 0   inquiry_messages inquiry_messages_sender_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.inquiry_messages
    ADD CONSTRAINT inquiry_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;
 Z   ALTER TABLE ONLY public.inquiry_messages DROP CONSTRAINT inquiry_messages_sender_id_fkey;
       public               postgres    false    239    4827    218            _           2606    16615 /   message_attachments message_attachments_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_id_fkey FOREIGN KEY (id) REFERENCES public.file_attachments(id) ON DELETE CASCADE;
 Y   ALTER TABLE ONLY public.message_attachments DROP CONSTRAINT message_attachments_id_fkey;
       public               postgres    false    240    4863    236            `           2606    16620 7   message_attachments message_attachments_message_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.message_attachments
    ADD CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.inquiry_messages(id) ON DELETE CASCADE;
 a   ALTER TABLE ONLY public.message_attachments DROP CONSTRAINT message_attachments_message_id_fkey;
       public               postgres    false    240    4871    239            l           2606    16787 0   notifications notifications_announcement_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE SET NULL;
 Z   ALTER TABLE ONLY public.notifications DROP CONSTRAINT notifications_announcement_id_fkey;
       public               postgres    false    254    4897    250            m           2606    16782 +   notifications notifications_inquiry_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id) ON DELETE SET NULL;
 U   ALTER TABLE ONLY public.notifications DROP CONSTRAINT notifications_inquiry_id_fkey;
       public               postgres    false    254    4857    232            n           2606    16777 1   notifications notifications_source_office_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_source_office_id_fkey FOREIGN KEY (source_office_id) REFERENCES public.offices(id) ON DELETE SET NULL;
 [   ALTER TABLE ONLY public.notifications DROP CONSTRAINT notifications_source_office_id_fkey;
       public               postgres    false    254    4830    220            o           2606    16772 (   notifications notifications_user_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
 R   ALTER TABLE ONLY public.notifications DROP CONSTRAINT notifications_user_id_fkey;
       public               postgres    false    254    4827    218            O           2606    16440 *   office_admins office_admins_office_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.office_admins
    ADD CONSTRAINT office_admins_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE CASCADE;
 T   ALTER TABLE ONLY public.office_admins DROP CONSTRAINT office_admins_office_id_fkey;
       public               postgres    false    4830    222    220            P           2606    16435 (   office_admins office_admins_user_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.office_admins
    ADD CONSTRAINT office_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
 R   ALTER TABLE ONLY public.office_admins DROP CONSTRAINT office_admins_user_id_fkey;
       public               postgres    false    222    4827    218            T           2606    16506 >   office_concern_types office_concern_types_concern_type_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.office_concern_types
    ADD CONSTRAINT office_concern_types_concern_type_id_fkey FOREIGN KEY (concern_type_id) REFERENCES public.concern_types(id) ON DELETE CASCADE;
 h   ALTER TABLE ONLY public.office_concern_types DROP CONSTRAINT office_concern_types_concern_type_id_fkey;
       public               postgres    false    230    228    4847            U           2606    16501 8   office_concern_types office_concern_types_office_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.office_concern_types
    ADD CONSTRAINT office_concern_types_office_id_fkey FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE CASCADE;
 b   ALTER TABLE ONLY public.office_concern_types DROP CONSTRAINT office_concern_types_office_id_fkey;
       public               postgres    false    230    4830    220            t           2606    16867 8   office_login_logs office_login_logs_office_admin_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.office_login_logs
    ADD CONSTRAINT office_login_logs_office_admin_id_fkey FOREIGN KEY (office_admin_id) REFERENCES public.office_admins(id) ON DELETE CASCADE;
 b   ALTER TABLE ONLY public.office_login_logs DROP CONSTRAINT office_login_logs_office_admin_id_fkey;
       public               postgres    false    260    222    4834            e           2606    16686 =   session_participations session_participations_session_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.session_participations
    ADD CONSTRAINT session_participations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.counseling_sessions(id) ON DELETE CASCADE;
 g   ALTER TABLE ONLY public.session_participations DROP CONSTRAINT session_participations_session_id_fkey;
       public               postgres    false    246    4878    242            f           2606    16691 :   session_participations session_participations_user_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.session_participations
    ADD CONSTRAINT session_participations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
 d   ALTER TABLE ONLY public.session_participations DROP CONSTRAINT session_participations_user_id_fkey;
       public               postgres    false    246    4827    218            d           2606    16674 5   session_recordings session_recordings_session_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.session_recordings
    ADD CONSTRAINT session_recordings_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.counseling_sessions(id) ON DELETE CASCADE;
 _   ALTER TABLE ONLY public.session_recordings DROP CONSTRAINT session_recordings_session_id_fkey;
       public               postgres    false    244    4878    242            g           2606    16706 3   session_reminders session_reminders_session_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.session_reminders
    ADD CONSTRAINT session_reminders_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.counseling_sessions(id) ON DELETE CASCADE;
 ]   ALTER TABLE ONLY public.session_reminders DROP CONSTRAINT session_reminders_session_id_fkey;
       public               postgres    false    248    4878    242            h           2606    16711 0   session_reminders session_reminders_user_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.session_reminders
    ADD CONSTRAINT session_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
 Z   ALTER TABLE ONLY public.session_reminders DROP CONSTRAINT session_reminders_user_id_fkey;
       public               postgres    false    248    4827    218            s           2606    16845 ;   student_activity_logs student_activity_logs_student_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.student_activity_logs
    ADD CONSTRAINT student_activity_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
 e   ALTER TABLE ONLY public.student_activity_logs DROP CONSTRAINT student_activity_logs_student_id_fkey;
       public               postgres    false    4838    224    258            Q           2606    16454    students students_user_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
 H   ALTER TABLE ONLY public.students DROP CONSTRAINT students_user_id_fkey;
       public               postgres    false    4827    224    218            u           2606    16886 G   super_admin_activity_logs super_admin_activity_logs_super_admin_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.super_admin_activity_logs
    ADD CONSTRAINT super_admin_activity_logs_super_admin_id_fkey FOREIGN KEY (super_admin_id) REFERENCES public.users(id) ON DELETE SET NULL;
 q   ALTER TABLE ONLY public.super_admin_activity_logs DROP CONSTRAINT super_admin_activity_logs_super_admin_id_fkey;
       public               postgres    false    4827    262    218            v           2606    16896 I   super_admin_activity_logs super_admin_activity_logs_target_office_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.super_admin_activity_logs
    ADD CONSTRAINT super_admin_activity_logs_target_office_id_fkey FOREIGN KEY (target_office_id) REFERENCES public.offices(id) ON DELETE SET NULL;
 s   ALTER TABLE ONLY public.super_admin_activity_logs DROP CONSTRAINT super_admin_activity_logs_target_office_id_fkey;
       public               postgres    false    4830    262    220            w           2606    16891 G   super_admin_activity_logs super_admin_activity_logs_target_user_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.super_admin_activity_logs
    ADD CONSTRAINT super_admin_activity_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
 q   ALTER TABLE ONLY public.super_admin_activity_logs DROP CONSTRAINT super_admin_activity_logs_target_user_id_fkey;
       public               postgres    false    4827    218    262            N           2606    16407    users users_locked_by_id_fkey    FK CONSTRAINT     �   ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_locked_by_id_fkey FOREIGN KEY (locked_by_id) REFERENCES public.users(id) ON DELETE SET NULL;
 G   ALTER TABLE ONLY public.users DROP CONSTRAINT users_locked_by_id_fkey;
       public               postgres    false    4827    218    218                  x������ � �      ,      x������ � �      *      x������ � �      0   �   x���Q
�0��x
/`i�V�`0;�0�VW�*���ӲG7�2��~��m�q�m�a��M�v�#�5>���1�M���R:���\�7�m��0�݊�I�(*�9C���"'�RH���u��ݴ��p��~;a�ݰ6��|s���pN���cgZ?<�3Ti���d� ��F)"+^"&�&Y�� PMx�         *  x�}W�V7]���*+�3<�%�`��<8�&��fFA�jK����ϭ��i�
P��n�n�ꪋ�����?�4PR71�<�IGژظn����XK)�4��!����[;k��Q�`mCg)vI僅�����Y}K6�&�[��wr�k��h�d��3@m��8���y�N�t�6C��w�Q��`���`�gl@�'}b6^�~��~pyz�MN��&�L��e�b��7#w׭�9Qwy`�ꌾ�1Ĥ.C����`���h�-�zMb��]����S�1�}9mηu)1pr�-���"¡�>ejt�j��"����tL[�Ό�G��"
M}�G5�8�sL�O�A�\��KO&
؝�t������9J��!Q�<G� x�����{�>�_�wM	�H��&�{��YU��`���{ܘ��[�G]�����(��?��h �珅'���G�'\[�p����A�Y$/��'9[j����p\3���QCm����uu�<�j�o�~&.���\3Ԋ��0�Bt����"R�닝qެ ���s�mpс�Y�!�43L>��e���ٵ�e�.��r�H����v.M*��|�u������B�����o	��W�ޣ6�&Ղ����E0O�YG�M�����sH�u�L08������x�A�Q�9���y�~Q��P}1B#�^��Fy�>�/�7��S3j�-�=�آYR� B��'t���Э�c�$��V O7��o!���m���<�q#�f .�~��H�+��#j��$+O����Mm>j\*��OrT �ƍ�]IhA2>x��f�����(rƗX���./��R"4f$��%�����(��hI#o��ٲX��P.�E{J�T�Y�ؖ��U�\�~����M+I_,���M�J{��^#E0��O��U;
8��?;'�}g<�D����HMŐG8'����^j)�SbNY��<a)x^��`��b]`Zc�3"tl�2ԙ��Vω�zɱ�s��p�+��Ě����X��XA���?�C��I����VA���}�}M.�<��R�y���_�qd�w�x�{_u3�����D�B�hr��2�j%>�蚤n�G�rK�~�Ț�*�(�c��\S#e�6Ľ�Ĩ1i�?��bW�?β�4��ၝ�����N(-ԯ�Ȟ�E��<t��YJD�v[a�~e��~9_�~'�e��O�T%i�X4�D}"��Ls�yY;�a���q�-�T�1�c�N$oi�e��ڠ���r�%���&=����<S� ��A_���p�@Oo�'�N����^F�EP�e�su��!�Q�W�M+�"+Q���v�ʞ:�(4k�aa��3�[%�rT���~ܲm.�j����*����V\}�.]�+uD����1<ԭ�F�F�4pT�N��/��kc���"`m�"���ó �[��X]q����-#��*�8�C��k^���^�)f��,���4�(���^�R�k�w�U��崎������+�;pD��L� ��>9Q�5폎�x��%��6������냿>88��7�      "      x������ � �            x������ � �            x������ � �            x������ � �            x������ � �            x������ � �             x������ � �      .      x������ � �            x������ � �         �   x��ɑE!Cѵo0]�C.?�8�~m�2��N':��L��؝�cn��yy��Fir�Îb�c�m�6:�Aw��_�/\c����O+��k,|[���~ǋ?뙏Xm,B��m�/�1�����=n⌇��:�K��<rM�E�+"�+N�W���+���f!/�      4      x������ � �         e  x�eTM��0=����ݙ.�|s�v��30e(ܸ���
\;+�]�4��%�mYO��)�ͺmɢ��I;4߰#I�|��<��d���dn0p�~�!�=���{����&�Q�������q�����Q�4i��w��+ǋ�bE�l�z,�j�Yl��/�ӥ��`	���pol9���k2Gb��������W�����5�K��BDu����I���X��*幁^Q��V)�B�U��N p�9v{i���f������9j�ݩ
}i2��#��F���)|nz9�Bc��x���scUdӍ����.��su�X��{��J͵%_��k#�C�|'U��a�.��@H}*<�6+NK)���}����jq=I���F	���Z��m�Pu�Ѩs)T�g-W5c����w�js}�DV�����6:\7�M�DN�� &C"�q�����Z�Z/�JDU���VGJ�8�\�u��I��\m�i�&����V��RY�m�r<���{t��:�}:������ɽ~z�F�u��:o0�t�#p�GA�}q	����o8���v�N���	��m1��\U�dU9#s|*�9O�B�|6���7���      &      x������ � �      $      x������ � �      (      x������ � �      2      x������ � �            x������ � �      6   �  x�ՓKO�0Fי_q� 1��	+��(�iٰ1,�8�����璈�J�T"�*YX�n������W.�
���b���ձxN~���j��oy�|h]�+�k�P|Xq��q+E(݆���W`�~��~jyg}��[�J	C����/��o'Є'�~�����[�bB�3P�q���/���CVp�Ւ�%��x�E�9��S�
#肣�ǐ�}�6�]\~v�8{Ώ��K2��S�������$Z*cFi�R?�ߡO����2J$tI��7��$�)�Ĉ�s � �k˧.�,HM4�VO]��Um�u�{�-n#�8(ү�}�/hYr��P�����J^
A����ig�ъm�zD��C��Y"5��i�}�J�-eD1Ŭ��l�$Jٵ�6�,�z�M�      
   �   x�M��N1�k�SP��ɻ����@P E<@$�^�������ҠY���L1���?���z�0�갾�ݟ/��ex{9�,��4'�ޅlܧ�����0�wl�GЭ�\����$�K�Nj$�	+C�₏K�#�i䰂x��,���8*��b��nA�XZ(N�X��*���^��j]��NV���W�e>��Ƿ�j���-�;�d1a�ɣ��	�KB��&B��}�u�CWC     