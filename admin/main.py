import os
from fastapi import FastAPI
from tortoise import Tortoise
from fastapi_admin.app import app as admin_app
from fastapi_admin.resources import Model as AdminModelResource
from fastapi_admin.widgets import inputs
from fastapi_admin.providers.login import UsernamePasswordProvider
from tortoise.models import Model
from tortoise import fields

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
    
    def __str__(self): 
        return self.title

class AdminUser(Model):
    id = fields.IntField(pk=True)
    username = fields.CharField(max_length=50, unique=True)
    password = fields.CharField(max_length=128)
    
    class Meta:
        table = "admins"
    
    def __str__(self): 
        return self.username

# Модель для логов администратора - НЕ НУЖНА для базовой работы
# class AdminLog(AbstractAdminLog):
#     pass

app = FastAPI()

@app.on_event("startup")
async def startup():
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set")
    
    await Tortoise.init(
        db_url=DATABASE_URL,
        modules={"models": ["__main__"]}
    )
    
    login_provider = UsernamePasswordProvider(
        login_logo_url="https://preview.tabler.io/static/logo.svg",
        admin_model=AdminUser,
    )

    await admin_app.configure(
        logo_url="https://preview.tabler.io/static/logo-white.svg",
        providers=[login_provider],
        resources=[
            AdminModelResource(
                label="Урок", 
                model=Lesson, 
                icon="fas fa-book",
                fields=[
                    "id", 
                    "course_id", 
                    "section_id", 
                    "lesson_slug", 
                    "title",
                    "content",  # Обычное текстовое поле без кастомизации
                    "sort_order", 
                    "created_at", 
                    "updated_at",
                ]
            ),
        ]
    )

app.mount('/', admin_app)
