import os
import logging
import asyncio
import psycopg2
from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, ChatMemberUpdated

logging.basicConfig(level=logging.INFO)
BOT_TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")
GROUP_ID = int(os.getenv("GROUP_ID"))
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def setup_database():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # 1. Создание таблицы подписчиков с новыми колонками (ОНА ДОЛЖНА БЫТЬ ПЕРВОЙ)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS channel_subscribers (
            telegram_id BIGINT PRIMARY KEY,
            username VARCHAR(255),
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            photo_url VARCHAR(500),
            language_code VARCHAR(10),
            is_bot BOOLEAN DEFAULT FALSE,
            subscription_date TIMESTAMPTZ DEFAULT NOW(),
            unsubscription_date TIMESTAMPTZ,
            message_count INT DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            last_seen TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    
    # 2. НОВАЯ ТАБЛИЦА: Метаданные курсов
    cur.execute("""
        CREATE TABLE IF NOT EXISTS courses (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            cover_image_url TEXT,
            access_type VARCHAR(20) DEFAULT 'level',
            access_level INT DEFAULT 1,
            access_days INT,
            is_published BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    
    # 3. Создание таблицы сообщений
    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            user_id BIGINT,
            message_id BIGINT,
            message_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            points INT DEFAULT 2
        );
    """)
    
    # 4. Создание таблицы прогресса по урокам (ОНА ССЫЛАЕТСЯ НА ПЕРВУЮ)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_lesson_progress (
            user_id BIGINT NOT NULL,
            course_id VARCHAR(100) NOT NULL,
            lesson_id VARCHAR(100) NOT NULL,
            completed_at TIMESTAMPTZ DEFAULT NOW(),
            FOREIGN KEY (user_id) REFERENCES channel_subscribers(telegram_id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, course_id, lesson_id)
        );
    """)

    # 5. Создание ОБНОВЛЕННОЙ таблицы для хранения уроков/страниц
    cur.execute("""
        CREATE TABLE IF NOT EXISTS lessons (
            id SERIAL PRIMARY KEY,
            course_id VARCHAR(100) NOT NULL,
            course_ref_id INT REFERENCES courses(id) ON DELETE CASCADE,
            section_id VARCHAR(100) NOT NULL,
            lesson_slug VARCHAR(100) NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            rich_content TEXT,
            sort_order INT DEFAULT 0,
            rank_required INT DEFAULT 1,
            preview_text TEXT,
            is_published BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (course_id, lesson_slug)
        );
    """)
    
    # 6. НОВАЯ ТАБЛИЦА: Создание таблицы администраторов (для админки)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password VARCHAR(128) NOT NULL
        );
    """)
    
    # 7. Создаем индекс для ускорения выборок по дате
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_date_user_id ON messages (message_date, user_id);
    """)
    
    # 8. Добавляем недостающие колонки в существующие таблицы
    try:
        # Колонки для channel_subscribers
        cur.execute("ALTER TABLE channel_subscribers ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);")
        cur.execute("ALTER TABLE channel_subscribers ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);")
        cur.execute("ALTER TABLE channel_subscribers ADD COLUMN IF NOT EXISTS language_code VARCHAR(10);")
        cur.execute("ALTER TABLE channel_subscribers ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE;")
        cur.execute("ALTER TABLE channel_subscribers ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();")
        
        logging.info("Channel subscribers columns updated")
        
        # НОВЫЕ КОЛОНКИ для таблицы lessons
        cur.execute("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS rank_required INT DEFAULT 1;")
        logging.info("Added rank_required column")
        
        cur.execute("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS preview_text TEXT;")
        logging.info("Added preview_text column")
        
        cur.execute("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS course_ref_id INT;")
        logging.info("Added course_ref_id column")
        
        cur.execute("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS rich_content TEXT;")
        logging.info("Added rich_content column")
        
        cur.execute("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE;")
        logging.info("Added is_published column")
        
        # Добавляем внешний ключ если его еще нет
        cur.execute("""
            DO $ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name = 'lessons_course_ref_id_fkey'
                ) THEN
                    ALTER TABLE lessons ADD CONSTRAINT lessons_course_ref_id_fkey 
                    FOREIGN KEY (course_ref_id) REFERENCES courses(id) ON DELETE CASCADE;
                END IF;
            END $;
        """)
        
        # 9. Создаем индекс ПОСЛЕ добавления колонки (с проверкой существования колонки)
        cur.execute("""
            DO $body$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'lessons' AND column_name = 'course_ref_id'
                ) THEN
                    CREATE INDEX IF NOT EXISTS idx_lessons_course_ref_id ON lessons (course_ref_id);
                END IF;
            END $body$;
        """)
        
        logging.info("Database schema updated successfully with courses table")
    except Exception as e:
        logging.warning(f"Error adding columns (they might already exist): {e}")
        
    conn.commit()
    cur.close()
    conn.close()

async def get_user_photo_url(user_id):
    """Получает URL фото профиля пользователя"""
    try:
        photos = await bot.get_user_profile_photos(user_id, limit=1)
        if photos.total_count > 0:
            # Получаем самое большое фото
            photo = photos.photos[0][-1]  # последнее = самое большое
            file_info = await bot.get_file(photo.file_id)
            return f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_info.file_path}"
    except Exception as e:
        logging.warning(f"Couldn't get photo for user {user_id}: {e}")
    return None

@dp.chat_member(F.chat.id == GROUP_ID)
async def on_chat_member_updated(update: ChatMemberUpdated):
    user = update.new_chat_member.user
    conn = get_db_connection()
    cur = conn.cursor()
    
    if update.new_chat_member.status in ["member", "administrator", "creator"]:
        logging.info(f"User {user.id} ({user.first_name} {user.last_name or ''}) joined.")
        
        # Получаем фото профиля пользователя
        photo_url = await get_user_photo_url(user.id)
        
        cur.execute("""
            INSERT INTO channel_subscribers 
            (telegram_id, username, first_name, last_name, photo_url, language_code, is_bot, is_active, subscription_date, last_seen) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, NOW(), NOW())
            ON CONFLICT (telegram_id) 
            DO UPDATE SET 
                is_active = TRUE, 
                unsubscription_date = NULL,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                username = EXCLUDED.username,
                photo_url = EXCLUDED.photo_url,
                language_code = EXCLUDED.language_code,
                is_bot = EXCLUDED.is_bot,
                last_seen = NOW();
        """, (user.id, user.username, user.first_name, user.last_name, photo_url, user.language_code, user.is_bot))
        
    elif update.new_chat_member.status in ["left", "kicked"]:
        logging.info(f"User {user.id} left.")
        cur.execute("""
            UPDATE channel_subscribers 
            SET is_active = FALSE, unsubscription_date = NOW() 
            WHERE telegram_id = %s;
        """, (user.id,))
    
    conn.commit()
    cur.close()
    conn.close()

@dp.message(F.chat.id == GROUP_ID)
async def on_new_message(message: Message):
    user = message.from_user
    # Пропускаем сообщения от анонимных админов или каналов
    if user is None:
        return
        
    logging.info(f"Message from {user.id} ({user.first_name} {user.last_name or ''})")
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Обновляем счетчик сообщений и last_seen
    cur.execute("""
        UPDATE channel_subscribers 
        SET message_count = message_count + 1, last_seen = NOW() 
        WHERE telegram_id = %s;
    """, (user.id,))
    
    # Добавляем запись в таблицу messages
    cur.execute("""
        INSERT INTO messages (user_id, message_id, points) 
        VALUES (%s, %s, %s);
    """, (user.id, message.message_id, 2))
    
    # Если пользователь написал впервые (не было в подписчиках)
    if cur.rowcount == 0:
        logging.info(f"Adding new user {user.id} to subscribers")
        
        # Получаем фото при первом сообщении
        photo_url = await get_user_photo_url(user.id)
            
        cur.execute("""
            INSERT INTO channel_subscribers 
            (telegram_id, username, first_name, last_name, photo_url, language_code, is_bot, message_count, is_active, last_seen) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, 1, TRUE, NOW()) 
            ON CONFLICT (telegram_id) 
            DO UPDATE SET 
                message_count = message_count + 1,
                last_seen = NOW();
        """, (user.id, user.username, user.first_name, user.last_name, photo_url, user.language_code, user.is_bot))
    
    conn.commit()
    cur.close()
    conn.close()

async def main():
    setup_database()
    logging.info(f"Starting collector bot for group {GROUP_ID}...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
