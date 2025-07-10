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
