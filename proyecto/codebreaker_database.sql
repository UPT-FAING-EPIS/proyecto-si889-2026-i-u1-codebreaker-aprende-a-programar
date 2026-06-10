-- =============================================================
--  CODEBREAKER — Script completo de base de datos
--  Versión: 1.0 | Abril 2026
--  Compatible con: PostgreSQL 14+
-- =============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
--  1. USUARIOS Y AUTENTICACIÓN
-- =============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255),                        -- NULL si usa OAuth
    avatar_url      TEXT,
    oauth_provider  VARCHAR(30),                         -- 'google' | 'github' | NULL
    oauth_id        VARCHAR(255),
    total_xp        INT          NOT NULL DEFAULT 0,
    level           INT          NOT NULL DEFAULT 1,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_auth CHECK (
        password_hash IS NOT NULL OR (oauth_provider IS NOT NULL AND oauth_id IS NOT NULL)
    )
);

-- Sesiones / tokens JWT activos
CREATE TABLE user_sessions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   VARCHAR(255) NOT NULL UNIQUE,           -- hash del JWT
    device_info  TEXT,
    ip_address   INET,
    expires_at   TIMESTAMPTZ  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
--  2. CONTENIDO: RUTAS Y NIVELES
-- =============================================================

-- Rutas de aprendizaje (Python, PHP, ...)
CREATE TABLE tracks (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug         VARCHAR(50)  NOT NULL UNIQUE,           -- 'python', 'php'
    name         VARCHAR(100) NOT NULL,
    language     VARCHAR(30)  NOT NULL,                  -- 'python' | 'php'
    icon_url     TEXT,
    description  TEXT,
    order_index  INT          NOT NULL DEFAULT 0,
    is_published BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Niveles dentro de cada ruta
CREATE TABLE levels (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id     UUID         NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    order_index  INT          NOT NULL,
    title        VARCHAR(150) NOT NULL,
    description  TEXT,
    difficulty   VARCHAR(20)  NOT NULL DEFAULT 'beginner'
                     CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    xp_reward    INT          NOT NULL DEFAULT 10,
    is_published BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (track_id, order_index)
);

-- =============================================================
--  3. EJERCICIOS
-- =============================================================

-- Ejercicios dentro de cada nivel
CREATE TABLE exercises (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level_id        UUID         NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
    type            VARCHAR(30)  NOT NULL
                        CHECK (type IN ('fill_code', 'fix_error', 'write_code', 'multiple_choice')),
    title           VARCHAR(200) NOT NULL,
    instructions    TEXT         NOT NULL,
    starter_code    TEXT,                                -- código base para el editor
    expected_output TEXT,                               -- salida esperada (para comparación simple)
    order_index     INT          NOT NULL DEFAULT 0,
    max_attempts    INT          NOT NULL DEFAULT 0,    -- 0 = intentos ilimitados
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Pistas (hints) por ejercicio
CREATE TABLE exercise_hints (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exercise_id  UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    hint_order   INT  NOT NULL,
    content      TEXT NOT NULL,
    xp_penalty   INT  NOT NULL DEFAULT 5,               -- XP que se resta al usar la pista
    UNIQUE (exercise_id, hint_order)
);

-- Casos de prueba para validación automática
CREATE TABLE exercise_test_cases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exercise_id     UUID    NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    input           TEXT,                               -- stdin a pasar al sandbox
    expected_output TEXT    NOT NULL,
    is_hidden       BOOLEAN NOT NULL DEFAULT FALSE,     -- TRUE = no se muestra al usuario
    order_index     INT     NOT NULL DEFAULT 0
);

-- Opciones para ejercicios de opción múltiple
CREATE TABLE exercise_options (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exercise_id UUID    NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    content     TEXT    NOT NULL,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    order_index INT     NOT NULL DEFAULT 0
);

-- =============================================================
--  4. ENVÍOS DE CÓDIGO Y VALIDACIÓN
-- =============================================================

CREATE TABLE code_submissions (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id       UUID         NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    level_id          UUID         NOT NULL REFERENCES levels(id),
    language          VARCHAR(20)  NOT NULL,            -- 'python' | 'php'
    code              TEXT         NOT NULL,
    status            VARCHAR(20)  NOT NULL
                          CHECK (status IN ('accepted', 'wrong_answer', 'runtime_error',
                                            'time_limit', 'memory_limit', 'pending')),
    stdout            TEXT,
    stderr            TEXT,
    execution_time_ms FLOAT,
    memory_used_kb    INT,
    xp_earned         INT          NOT NULL DEFAULT 0,
    hints_used        INT          NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
--  5. PROGRESO DEL USUARIO
-- =============================================================

CREATE TABLE user_progress (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id     UUID        NOT NULL REFERENCES tracks(id),
    level_id     UUID        NOT NULL REFERENCES levels(id),
    status       VARCHAR(20) NOT NULL DEFAULT 'locked'
                     CHECK (status IN ('locked', 'unlocked', 'in_progress', 'completed')),
    attempts     INT         NOT NULL DEFAULT 0,
    best_score   INT         NOT NULL DEFAULT 0,        -- mejor puntuación obtenida
    completed_at TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, level_id)
);

-- =============================================================
--  6. GAMIFICACIÓN: LOGROS Y RACHAS
-- =============================================================

-- Catálogo de logros disponibles
CREATE TABLE achievements (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug             VARCHAR(80)  NOT NULL UNIQUE,
    name             VARCHAR(100) NOT NULL,
    description      TEXT         NOT NULL,
    icon_url         TEXT,
    condition_type   VARCHAR(50)  NOT NULL,             -- 'levels_completed', 'streak_days', 'xp_total', etc.
    condition_value  INT          NOT NULL,             -- valor umbral para desbloquear
    xp_reward        INT          NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Logros obtenidos por cada usuario
CREATE TABLE user_achievements (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID        NOT NULL REFERENCES achievements(id),
    earned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, achievement_id)
);

-- Rachas de actividad diaria
CREATE TABLE user_streaks (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_streak      INT  NOT NULL DEFAULT 0,
    longest_streak      INT  NOT NULL DEFAULT 0,
    last_activity_date  DATE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
--  7. NOTIFICACIONES (OPCIONAL / FASE FUTURA)
-- =============================================================

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,                    -- 'achievement', 'level_up', 'streak_at_risk'
    title      VARCHAR(150) NOT NULL,
    body       TEXT,
    is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
--  8. ÍNDICES DE RENDIMIENTO
-- =============================================================

-- users
CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- sessions
CREATE INDEX idx_sessions_user_id    ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

-- tracks y levels
CREATE INDEX idx_levels_track_id ON levels(track_id, order_index);

-- exercises
CREATE INDEX idx_exercises_level_id ON exercises(level_id, order_index);

-- submissions
CREATE INDEX idx_submissions_user_id     ON code_submissions(user_id);
CREATE INDEX idx_submissions_exercise_id ON code_submissions(exercise_id);
CREATE INDEX idx_submissions_status      ON code_submissions(status);
CREATE INDEX idx_submissions_created_at  ON code_submissions(created_at DESC);

-- progress
CREATE INDEX idx_progress_user_id    ON user_progress(user_id);
CREATE INDEX idx_progress_track_id   ON user_progress(track_id);
CREATE INDEX idx_progress_status     ON user_progress(status);

-- achievements
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);

-- notifications
CREATE INDEX idx_notifications_user_id  ON notifications(user_id);
CREATE INDEX idx_notifications_is_read  ON notifications(user_id, is_read);

-- =============================================================
--  9. TRIGGERS: UPDATED_AT AUTOMÁTICO
-- =============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tracks_updated_at
    BEFORE UPDATE ON tracks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_levels_updated_at
    BEFORE UPDATE ON levels
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_exercises_updated_at
    BEFORE UPDATE ON exercises
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
--  10. TRIGGER: XP ACUMULADO EN USERS
--  Suma XP automáticamente cuando se acepta un envío
-- =============================================================

CREATE OR REPLACE FUNCTION update_user_xp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'accepted' AND NEW.xp_earned > 0 THEN
        UPDATE users
        SET total_xp  = total_xp + NEW.xp_earned,
            level     = FLOOR(1 + SQRT(total_xp + NEW.xp_earned) / 10),
            updated_at = NOW()
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_submission_xp
    AFTER INSERT ON code_submissions
    FOR EACH ROW EXECUTE FUNCTION update_user_xp();

-- =============================================================
--  11. TRIGGER: DESBLOQUEAR SIGUIENTE NIVEL
--  Cuando user_progress pasa a 'completed', desbloquea el siguiente
-- =============================================================

CREATE OR REPLACE FUNCTION unlock_next_level()
RETURNS TRIGGER AS $$
DECLARE
    v_next_level_id UUID;
    v_track_id      UUID;
    v_order_index   INT;
BEGIN
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
        SELECT track_id, order_index INTO v_track_id, v_order_index
        FROM levels WHERE id = NEW.level_id;

        SELECT id INTO v_next_level_id
        FROM levels
        WHERE track_id = v_track_id
          AND order_index = v_order_index + 1
          AND is_published = TRUE;

        IF v_next_level_id IS NOT NULL THEN
            INSERT INTO user_progress (user_id, track_id, level_id, status)
            VALUES (NEW.user_id, v_track_id, v_next_level_id, 'unlocked')
            ON CONFLICT (user_id, level_id) DO UPDATE
                SET status = CASE
                    WHEN user_progress.status = 'locked' THEN 'unlocked'
                    ELSE user_progress.status
                END;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_unlock_next_level
    AFTER UPDATE ON user_progress
    FOR EACH ROW EXECUTE FUNCTION unlock_next_level();

-- =============================================================
--  12. TRIGGER: ACTUALIZAR RACHA DIARIA
-- =============================================================

CREATE OR REPLACE FUNCTION update_streak()
RETURNS TRIGGER AS $$
DECLARE
    v_today     DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
    v_streak    RECORD;
BEGIN
    SELECT * INTO v_streak FROM user_streaks WHERE user_id = NEW.user_id;

    IF NOT FOUND THEN
        INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date)
        VALUES (NEW.user_id, 1, 1, v_today);
    ELSIF v_streak.last_activity_date = v_today THEN
        NULL; -- ya hubo actividad hoy, no hace nada
    ELSIF v_streak.last_activity_date = v_yesterday THEN
        UPDATE user_streaks
        SET current_streak     = current_streak + 1,
            longest_streak     = GREATEST(longest_streak, current_streak + 1),
            last_activity_date = v_today,
            updated_at         = NOW()
        WHERE user_id = NEW.user_id;
    ELSE
        UPDATE user_streaks
        SET current_streak     = 1,
            last_activity_date = v_today,
            updated_at         = NOW()
        WHERE user_id = NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_submission_streak
    AFTER INSERT ON code_submissions
    FOR EACH ROW WHEN (NEW.status = 'accepted')
    EXECUTE FUNCTION update_streak();

-- =============================================================
--  13. DATOS SEMILLA (SEED)
-- =============================================================

-- Rutas iniciales
INSERT INTO tracks (id, slug, name, language, description, order_index, is_published) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', 'python', 'Python', 'python',
     'Aprende Python desde cero: variables, funciones y estructuras de datos.', 1, TRUE),
    ('aaaaaaaa-0000-0000-0000-000000000002', 'php', 'PHP', 'php',
     'Domina PHP: sintaxis, arrays, funciones y manejo de formularios.', 2, TRUE);

-- Niveles de Python (10 niveles)
INSERT INTO levels (id, track_id, order_index, title, difficulty, xp_reward, is_published) VALUES
    ('bbbbbbbb-0001-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 1,  'Hola, Python',              'beginner',     10, TRUE),
    ('bbbbbbbb-0002-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 2,  'Variables y tipos',         'beginner',     15, TRUE),
    ('bbbbbbbb-0003-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 3,  'Operadores',                'beginner',     15, TRUE),
    ('bbbbbbbb-0004-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 4,  'Condicionales',             'beginner',     20, TRUE),
    ('bbbbbbbb-0005-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 5,  'Bucles while',              'beginner',     20, TRUE),
    ('bbbbbbbb-0006-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 6,  'Bucles for',                'beginner',     20, TRUE),
    ('bbbbbbbb-0007-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 7,  'Listas',                    'intermediate', 25, TRUE),
    ('bbbbbbbb-0008-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 8,  'Diccionarios',              'intermediate', 25, TRUE),
    ('bbbbbbbb-0009-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 9,  'Funciones',                 'intermediate', 30, TRUE),
    ('bbbbbbbb-0010-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 10, 'Manejo de errores',         'intermediate', 30, TRUE);

-- Niveles de PHP (10 niveles)
INSERT INTO levels (id, track_id, order_index, title, difficulty, xp_reward, is_published) VALUES
    ('cccccccc-0001-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 1,  'Hola, PHP',                 'beginner',     10, TRUE),
    ('cccccccc-0002-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 2,  'Variables y tipos',         'beginner',     15, TRUE),
    ('cccccccc-0003-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 3,  'Operadores y strings',      'beginner',     15, TRUE),
    ('cccccccc-0004-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 4,  'Condicionales',             'beginner',     20, TRUE),
    ('cccccccc-0005-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 5,  'Bucles',                    'beginner',     20, TRUE),
    ('cccccccc-0006-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 6,  'Arrays indexados',          'beginner',     20, TRUE),
    ('cccccccc-0007-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 7,  'Arrays asociativos',        'intermediate', 25, TRUE),
    ('cccccccc-0008-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 8,  'Funciones',                 'intermediate', 25, TRUE),
    ('cccccccc-0009-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 9,  'Formularios y GET/POST',    'intermediate', 30, TRUE),
    ('cccccccc-0010-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 10, 'Manejo de archivos',        'intermediate', 30, TRUE);

-- Logros iniciales
INSERT INTO achievements (slug, name, description, condition_type, condition_value, xp_reward) VALUES
    ('first_blood',      'Primer Código',         'Completa tu primer ejercicio.',             'submissions_accepted', 1,   0),
    ('level_5',          'En Camino',             'Completa 5 niveles en cualquier ruta.',     'levels_completed',     5,   50),
    ('level_10',         'Codebreaker Jr.',       'Completa 10 niveles en cualquier ruta.',    'levels_completed',     10,  100),
    ('python_complete',  'Pythonista',            'Completa toda la ruta de Python.',          'track_completed',      1,   200),
    ('php_complete',     'PHPero',                'Completa toda la ruta de PHP.',             'track_completed',      2,   200),
    ('streak_7',         'Semana Imparable',      'Mantén una racha de 7 días seguidos.',      'streak_days',          7,   70),
    ('streak_30',        'Mes Dedicado',          'Mantén una racha de 30 días seguidos.',     'streak_days',          30,  300),
    ('xp_500',           '500 XP',                'Acumula 500 puntos de experiencia.',        'xp_total',             500, 50),
    ('xp_1000',          'Mil Puntos',            'Acumula 1000 puntos de experiencia.',       'xp_total',             1000, 100),
    ('speed_run',        'Velocista',             'Completa un nivel en menos de 2 minutos.',  'fast_completion',      120, 30),
    ('no_hints',         'Sin Ayuda',             'Completa un nivel sin usar ninguna pista.', 'no_hints_level',       1,   25),
    ('night_coder',      'Coder Nocturno',        'Completa un ejercicio entre las 12am y 5am.','night_submission',    1,   20);

-- =============================================================
--  FIN DEL SCRIPT
-- =============================================================
