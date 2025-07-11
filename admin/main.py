import os
from fastapi import FastAPI
from tortoise import Tortoise
from fastapi_admin.app import app as admin_app
from fastapi_admin.resources import Model
from fastapi_admin.providers.login import UsernamePasswordProvider
from tortoise.models import Model as TortoiseModel
from tortoise import fields

class Lesson(TortoiseModel):
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

class AdminUser(TortoiseModel):
    id = fields.IntField(pk=True)
    username = fields.CharField(max_length=50, unique=True)
    password = fields.CharField(max_length=128)
    
    class Meta:
        table = "admins"

app = FastAPI()

@app.on_event("startup")
async def startup():
    DATABASE_URL = os.getenv("DATABASE_URL")
    
    await Tortoise.init(
        db_url=DATABASE_URL,
        modules={"models": ["main"]}
    )
    
    await Tortoise.generate_schemas()
    
    login_provider = UsernamePasswordProvider(
        admin_model=AdminUser,
    )

    await admin_app.configure(
        providers=[login_provider],
        resources=[
            Model(
                label="Уроки", 
                model=Lesson, 
                fields=["id", "course_id", "section_id", "lesson_slug", "title", "content", "sort_order"]
            ),
        ]
    )

app.mount('/', admin_app)
