import asyncio
import os
from tortoise import Tortoise
# Мы импортируем модели из нашего основного файла админки
from main import AdminUser 
# Импортируем функцию для хеширования пароля, чтобы она была такой же, как при логине
from fastapi_admin.providers.login import get_password_hash

# Асинхронная функция для создания админа
async def main():
    print("--- Скрипт создания администратора запущен ---")

    # Получаем URL базы данных из переменных окружения
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        print("ОШИБКА: Переменная окружения DATABASE_URL не найдена.")
        return

    print("Подключение к базе данных...")
    # Инициализируем подключение к базе
    await Tortoise.init(
        db_url=DATABASE_URL,
        modules={"models": ["main"]}
    )
    # Эта команда создает таблицу 'admins' в базе, если она еще не создана
    await Tortoise.generate_schemas()
    print("Подключение успешно.")

    # --- ЗАДАЙТЕ ВАШ ЛОГИН И ПАРОЛЬ ЗДЕСЬ ---
    username = "nadaraya"
    password = "C@rlo1822" # Рекомендую поменять на что-то другое после первого входа
    
    print(f"Проверка существования администратора '{username}'...")

    # Проверяем, существует ли уже пользователь с таким именем
    if not await AdminUser.filter(username=username).exists():
        # Хешируем пароль для безопасного хранения
        password_hash = get_password_hash(password)
        
        # Создаем нового админа в таблице 'admins'
        await AdminUser.create(username=username, password=password_hash)
        print(f"УСПЕХ: Администратор '{username}' успешно создан!")
    else:
        print(f"ИНФО: Администратор '{username}' уже существует. Ничего не сделано.")
    
    print("--- Скрипт завершил работу ---")

# Эта конструкция позволяет запускать скрипт командой "python create_admin.py"
if __name__ == "__main__":
    asyncio.run(main())
