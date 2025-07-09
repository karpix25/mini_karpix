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
    # Создание таблицы подписчиков (ваш существующий код)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS channel_subscribers (
            telegram_id BIGINT PRIMARY KEY,
            username VARCHAR(255),
            first_name VARCHAR(255),
            subscription_date TIMESTAMPTZ DEFAULT NOW(),
            unsubscription_date TIMESTAMPTZ,
            message_count INT DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE
        );
    """)
    # === ИЗМЕНЕНИЕ 1: Добавляем создание таблицы messages ===
    cur.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            user_id BIGINT,
            message_id BIGINT,
            message_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            points INT DEFAULT 2
        );
    """)
    # Также создаем индекс для ускорения выборок по дате
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_date_user_id ON messages (message_date, user_id);
    """)
    # =======================================================
    conn.commit()
    cur.close()
    conn.close()

@dp.chat_member(F.chat.id == GROUP_ID)
async def on_chat_member_updated(update: ChatMemberUpdated):
    user = update.new_chat_member.user
    conn = get_db_connection()
    cur = conn.cursor()
    if update.new_chat_member.status in ["member", "administrator", "creator"]:
        logging.info(f"User {user.id} joined.")
        cur.execute("""
            INSERT INTO channel_subscribers (telegram_id, username, first_name, is_active, subscription_date) VALUES (%s, %s, %s, TRUE, NOW())
            ON CONFLICT (telegram_id) DO UPDATE SET is_active = TRUE, unsubscription_date = NULL;
        """, (user.id, user.username, user.first_name))
    elif update.new_chat_member.status in ["left", "kicked"]:
        logging.info(f"User {user.id} left.")
        cur.execute("UPDATE channel_subscribers SET is_active = FALSE, unsubscription_date = NOW() WHERE telegram_id = %s;", (user.id,))
    conn.commit()
    cur.close()
    conn.close()

@dp.message(F.chat.id == GROUP_ID)
async def on_new_message(message: Message):
    user = message.from_user
    # Пропускаем сообщения от анонимных админов или каналов
    if user is None:
        return
        
    logging.info(f"Message from {user.id}")
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Обновляем общий счетчик (старая логика)
    cur.execute("UPDATE channel_subscribers SET message_count = message_count + 1 WHERE telegram_id = %s;", (user.id,))
    
    # === ИЗМЕНЕНИЕ 2: Добавляем запись в таблицу messages ===
    cur.execute(
        "INSERT INTO messages (user_id, message_id, points) VALUES (%s, %s, %s);",
        (user.id, message.message_id, 2)
    )
    # =====================================================

    # Если пользователь написал впервые, добавляем его в subscribers
    if cur.rowcount == 0:
        cur.execute("INSERT INTO channel_subscribers (telegram_id, username, first_name, message_count, is_active) VALUES (%s, %s, %s, 1, TRUE) ON CONFLICT (telegram_id) DO NOTHING;", (user.id, user.username, user.first_name))
    
    conn.commit()
    cur.close()
    conn.close()

async def main():
    setup_database()
    logging.info(f"Starting collector bot for group {GROUP_ID}...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
