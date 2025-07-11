import asyncio
import os
import sys # <-- ДОБАВЛЕНО: Импортируем модуль sys
from tortoise import Tortoise
from passlib.context import CryptContext 

# !!! ДОБАВЛЕНА СТРОКА: Явно добавляем родительскую директорию в путь импорта Python !!!
# Это позволяет импортировать 'main.py', который находится в /app (родительская папка для /app/scripts)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))) 

# Теперь импорт AdminUser должен сработать, т.к. 'main' находится в sys.path
from main import AdminUser 

# Создаем контекст для работы с паролями (используем bcrypt, как делает FastAPI-Admin)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
        modules={"models": ["main"]} # Теперь "main" здесь относится к admin/main.py
    )
    # Эта команда создает таблицу 'admins' в базе, если она еще не создана
    await Tortoise.generate_schemas()
    print("Подключение успешно.")

    # --- ЗАДАЙТЕ ВАШ ЛОГИН И ПАРОЛЬ ЗДЕСЬ ---
    username = "nadaraya"
    password = "C@rlo1822" # !!! ПОЖАЛУЙСТА, ОБЯЗАТЕЛЬНО ПОМЕНЯЙТЕ ЭТОТ ПАРОЛЬ НА ДРУГОЙ, СЛОЖНЫЙ И УНИКАЛЬНЫЙ !!!
    
    print(f"Проверка существования администратора '{username}'...")

    # Проверяем, существует ли уже пользователь с таким именем
    if not await AdminUser.filter(username=username).exists():
        password_hash = pwd_context.hash(password)
        
        # Создаем нового админа в таблице 'admins'
        await AdminUser.create(username=username, password=password_hash)
        print(f"УСПЕХ: Администратор '{username}' успешно создан!")
    else:
        print(f"ИНФО: Администратор '{username}' уже существует. Ничего не сделано.")
    
    print("--- Скрипт завершил работу ---")

# Эта конструкция позволяет запускать скрипт командой "python create_admin.py"
if __name__ == "__main__":
    asyncio.run(main())
