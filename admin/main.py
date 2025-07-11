import os
from fastapi import FastAPI
from tortoise import Tortoise
from fastapi_admin.app import app as admin_app
from fastapi_admin.resources import Model as ModelResource, Field
from fastapi_admin.widgets import inputs
from fastapi_admin.providers.login import UsernamePasswordProvider
from tortoise.models import Model
from tortoise import fields

# Описываем, как админка "видит" наши таблицы в базе
class Lesson(Model):
    id = fields.IntField(pk=True)
    course_id = fields.CharField(max_length=100)
    section_id = fields.CharField(max_length=100)
    lesson_slug = fields.CharField(max_length=100)
    title = fields.CharField(max_length=255)
    content = fields.TextField(null=True)
    sort_order = fields.IntField(default=0)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)
    class Meta:
        table = "lessons"
    def __str__(self): return self.title

class AdminUser(Model):
    id = fields.IntField(pk=True)
    username = fields.CharField(max_length=50, unique=True)
    password = fields.CharField(max_length=128)
    class Meta:
        table = "admins" # Таблица для хранения логинов/паролей админов
    def __str__(self): return self.username

# Основное приложение FastAPI для админки
app = FastAPI()

# Эта функция выполняется при старте сервиса админки
@app.on_event("startup")
async def startup():
    DATABASE_URL = os.getenv("DATABASE_URL")
    # Подключаемся к нашей общей базе данных
    await Tortoise.init(
        db_url=DATABASE_URL,
        modules={"models": ["__main__"]} # Указываем, что модели в этом файле
    )
    
    # Настраиваем страницу входа
    login_provider = UsernamePasswordProvider(
        login_logo_url="https://preview.tabler.io/static/logo.svg",
        admin_model=AdminUser, # Указываем, где хранятся админы
    )

    # Настраиваем саму админ-панель
    await admin_app.configure(
        logo_url="https://preview.tabler.io/static/logo-white.svg",
        providers=[login_provider],
        # Добавляем раздел "Уроки" в меню админки
        resources=[
            ModelResource(
                label="Урок", model=Lesson, icon="fas fa-book",
                fields=[
                    "id", "course_id", "section_id", "lesson_slug", "title",
                    Field(name="content", label="Содержимое (Markdown)", input_=inputs.TextArea()),
                    "sort_order", "created_at", "updated_at",
                ]
            ),
        ]
    )

# !!! ИЗМЕНЕНИЕ ЗДЕСЬ: МОНТИРУЕМ АДМИНКУ В КОРЕНЬ !!!
app.mount('/', admin_app)

# Теперь эндпоинт @app.get("/") становится лишним, так как / будет обслуживаться админкой.
# Можно его удалить или оставить, он просто не будет доступен.
# @app.get("/")
# async def root():
#     return {"message": "Это сервис админки. Сама админка доступна по /admin"}
