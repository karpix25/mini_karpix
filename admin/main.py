import os
import asyncio
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, Form, Request, HTTPException, Depends, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import hashlib

app = FastAPI(title="Админ-панель Уроков")

# Простая HTML-админка
# В admin/main.py обновите HTML_TEMPLATE (добавьте колонки):

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Админ-панель - Уроки</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        th { background-color: #f2f2f2; }
        .btn { padding: 6px 12px; margin: 2px; text-decoration: none; background: #007bff; color: white; border: none; cursor: pointer; font-size: 12px; }
        .btn-danger { background: #dc3545; }
        .form-group { margin: 10px 0; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 8px; }
        .login-form { max-width: 400px; margin: 100px auto; padding: 20px; border: 1px solid #ddd; }
        textarea { height: 200px; }
        .preview-text { height: 80px; }
        .content-preview { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Админ-панель - Управление уроками</h1>
        <a href="/admin/lessons/new" class="btn">Добавить урок</a>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Курс</th>
                    <th>Секция</th>
                    <th>Урок</th>
                    <th>Заголовок</th>
                    <th>Ранг</th>
                    <th>Превью</th>
                    <th>Порядок</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                {% for lesson in lessons %}
                <tr>
                    <td>{{ lesson.id }}</td>
                    <td>{{ lesson.course_id }}</td>
                    <td>{{ lesson.section_id }}</td>
                    <td>{{ lesson.lesson_slug }}</td>
                    <td>{{ lesson.title }}</td>
                    <td>{{ lesson.rank_required or 1 }}</td>
                    <td class="content-preview">{{ lesson.preview_text or '' }}</td>
                    <td>{{ lesson.sort_order }}</td>
                    <td>
                        <a href="/admin/lessons/{{ lesson.id }}/edit" class="btn">Редактировать</a>
                        <a href="/admin/lessons/{{ lesson.id }}/delete" class="btn btn-danger" onclick="return confirm('Удалить урок?')">Удалить</a>
                    </td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
</body>
</html>
"""

# Обновите EDIT_TEMPLATE (добавьте новые поля):

EDIT_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Редактировать урок</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .form-group { margin: 15px 0; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        .btn { padding: 10px 20px; margin: 4px; text-decoration: none; background: #007bff; color: white; border: none; cursor: pointer; border-radius: 4px; }
        .btn-secondary { background: #6c757d; }
        textarea { height: 300px; }
        .preview-text { height: 100px; }
        .form-row { display: flex; gap: 20px; }
        .form-row .form-group { flex: 1; }
    </style>
</head>
<body>
    <div class="container">
        <h1>{{ "Редактировать" if lesson else "Добавить" }} урок</h1>
        <form method="post">
            <div class="form-row">
                <div class="form-group">
                    <label>Курс ID:</label>
                    <input type="text" name="course_id" value="{{ lesson.course_id if lesson else '' }}" required 
                           placeholder="Например: welcome, javascript, python">
                </div>
                <div class="form-group">
                    <label>Секция ID:</label>
                    <input type="text" name="section_id" value="{{ lesson.section_id if lesson else '' }}" required
                           placeholder="Например: introduction, basics, advanced">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Урок (slug):</label>
                    <input type="text" name="lesson_slug" value="{{ lesson.lesson_slug if lesson else '' }}" required
                           placeholder="Например: getting-started, variables, functions">
                </div>
                <div class="form-group">
                    <label>Требуемый ранг:</label>
                    <select name="rank_required" required>
                        <option value="1" {{ 'selected' if lesson and lesson.rank_required == 1 else '' }}>1 - Новичок</option>
                        <option value="2" {{ 'selected' if lesson and lesson.rank_required == 2 else '' }}>2 - Активный участник</option>
                        <option value="3" {{ 'selected' if lesson and lesson.rank_required == 3 else '' }}>3 - Ветеран</option>
                        <option value="4" {{ 'selected' if lesson and lesson.rank_required == 4 else '' }}>4 - Легенда</option>
                    </select>
                </div>
            </div>
            
            <div class="form-group">
                <label>Заголовок:</label>
                <input type="text" name="title" value="{{ lesson.title if lesson else '' }}" required
                       placeholder="Название урока">
            </div>
            
            <div class="form-group">
                <label>Превью (краткое описание):</label>
                <textarea name="preview_text" class="preview-text" 
                          placeholder="Краткое описание урока, которое увидят пользователи">{{ lesson.preview_text if lesson else '' }}</textarea>
            </div>
            
            <div class="form-group">
                <label>Содержимое (Markdown):</label>
                <textarea name="content" placeholder="# Заголовок урока

Введение в урок...

## Что вы изучите

- Пункт 1
- Пункт 2

## Пример кода

```javascript
console.log('Hello, World!');
```

## Заключение

Подведение итогов...">{{ lesson.content if lesson else '' }}</textarea>
            </div>
            
            <div class="form-group">
                <label>Порядок сортировки:</label>
                <input type="number" name="sort_order" value="{{ lesson.sort_order if lesson else '0' }}"
                       placeholder="0, 1, 2, 3... (порядок отображения)">
            </div>
            
            <button type="submit" class="btn">Сохранить</button>
            <a href="/admin/lessons" class="btn btn-secondary">Отмена</a>
        </form>
    </div>
</body>
</html>
"""

LOGIN_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Вход в админ-панель</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .login-form { max-width: 400px; margin: 100px auto; padding: 20px; border: 1px solid #ddd; }
        .form-group { margin: 10px 0; }
        .form-group label { display: block; margin-bottom: 5px; }
        .form-group input { width: 100%; padding: 8px; }
        .btn { padding: 8px 16px; background: #007bff; color: white; border: none; cursor: pointer; width: 100%; }
        .error { color: red; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="login-form">
        <h2>Вход в админ-панель</h2>
        {% if error %}
        <div class="error">{{ error }}</div>
        {% endif %}
        <form method="post">
            <div class="form-group">
                <label>Логин:</label>
                <input type="text" name="username" required>
            </div>
            <div class="form-group">
                <label>Пароль:</label>
                <input type="password" name="password" required>
            </div>
            <button type="submit" class="btn">Войти</button>
        </form>
    </div>
</body>
</html>
"""

EDIT_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Редактировать урок</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .form-group { margin: 10px 0; }
        .form-group label { display: block; margin-bottom: 5px; }
        .form-group input, .form-group textarea { width: 100%; padding: 8px; }
        .btn { padding: 8px 16px; margin: 4px; text-decoration: none; background: #007bff; color: white; border: none; cursor: pointer; }
        textarea { height: 300px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>{{ "Редактировать" if lesson else "Добавить" }} урок</h1>
        <form method="post">
            <div class="form-group">
                <label>Курс ID:</label>
                <input type="text" name="course_id" value="{{ lesson.course_id if lesson else '' }}" required>
            </div>
            <div class="form-group">
                <label>Секция ID:</label>
                <input type="text" name="section_id" value="{{ lesson.section_id if lesson else '' }}" required>
            </div>
            <div class="form-group">
                <label>Урок (slug):</label>
                <input type="text" name="lesson_slug" value="{{ lesson.lesson_slug if lesson else '' }}" required>
            </div>
            <div class="form-group">
                <label>Заголовок:</label>
                <input type="text" name="title" value="{{ lesson.title if lesson else '' }}" required>
            </div>
            <div class="form-group">
                <label>Содержимое (Markdown):</label>
                <textarea name="content">{{ lesson.content if lesson else '' }}</textarea>
            </div>
            <div class="form-group">
                <label>Порядок сортировки:</label>
                <input type="number" name="sort_order" value="{{ lesson.sort_order if lesson else '0' }}">
            </div>
            <button type="submit" class="btn">Сохранить</button>
            <a href="/admin/lessons" class="btn">Отмена</a>
        </form>
    </div>
</body>
</html>
"""

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        return conn
    finally:
        pass

def check_admin_auth(username: str, password: str) -> bool:
    """Проверка логина/пароля администратора"""
    conn = get_db()
    cur = conn.cursor()
    
    # Хешируем пароль для сравнения (простой способ)
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    cur.execute("SELECT * FROM admins WHERE username = %s", (username,))
    admin = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if admin:
        # Проверяем пароль (здесь упрощенно, в реальности используйте bcrypt)
        return admin['password'] == password_hash or password == "C@rlo1822"  # временно для первого входа
    
    return False

def render_template(template: str, **context):
    """Простой рендер шаблонов"""
    for key, value in context.items():
        template = template.replace(f"{{{{ {key} }}}}", str(value) if value is not None else "")
    
    # Обработка циклов {% for %}
    if "{% for lesson in lessons %}" in template and "lessons" in context:
        lessons_html = ""
        for lesson in context["lessons"]:
            lesson_row = """
                <tr>
                    <td>{id}</td>
                    <td>{course_id}</td>
                    <td>{section_id}</td>
                    <td>{lesson_slug}</td>
                    <td>{title}</td>
                    <td>{sort_order}</td>
                    <td>
                        <a href="/admin/lessons/{id}/edit" class="btn">Редактировать</a>
                        <a href="/admin/lessons/{id}/delete" class="btn btn-danger" onclick="return confirm('Удалить урок?')">Удалить</a>
                    </td>
                </tr>
            """.format(**lesson)
            lessons_html += lesson_row
        
        template = template.replace(
            "{% for lesson in lessons %}\n                <tr>\n                    <td>{{ lesson.id }}</td>\n                    <td>{{ lesson.course_id }}</td>\n                    <td>{{ lesson.section_id }}</td>\n                    <td>{{ lesson.lesson_slug }}</td>\n                    <td>{{ lesson.title }}</td>\n                    <td>{{ lesson.sort_order }}</td>\n                    <td>\n                        <a href=\"/admin/lessons/{{ lesson.id }}/edit\" class=\"btn\">Редактировать</a>\n                        <a href=\"/admin/lessons/{{ lesson.id }}/delete\" class=\"btn btn-danger\" onclick=\"return confirm('Удалить урок?')\">Удалить</a>\n                    </td>\n                </tr>\n                {% endfor %}",
            lessons_html
        )
    
    return template

@app.get("/admin/login", response_class=HTMLResponse)
async def login_page():
    return render_template(LOGIN_TEMPLATE, error="")

@app.post("/admin/login")
async def login(username: str = Form(...), password: str = Form(...)):
    if check_admin_auth(username, password):
        response = RedirectResponse(url="/admin/lessons", status_code=302)
        response.set_cookie("admin_session", "authenticated")  # Простая сессия
        return response
    else:
        return HTMLResponse(render_template(LOGIN_TEMPLATE, error="Неверный логин или пароль"))

@app.get("/admin/lessons", response_class=HTMLResponse)
async def list_lessons():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM lessons ORDER BY course_id, section_id, sort_order")
    lessons = cur.fetchall()
    cur.close()
    conn.close()
    
    return HTMLResponse(render_template(HTML_TEMPLATE, lessons=lessons))

@app.get("/admin/lessons/new", response_class=HTMLResponse)
async def new_lesson():
    return HTMLResponse(render_template(EDIT_TEMPLATE, lesson=None))

@app.post("/admin/lessons/new")
async def create_lesson(
    course_id: str = Form(...),
    section_id: str = Form(...),
    lesson_slug: str = Form(...),
    title: str = Form(...),
    content: str = Form(...),
    sort_order: int = Form(0)
):
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("""
        INSERT INTO lessons (course_id, section_id, lesson_slug, title, content, sort_order)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (course_id, section_id, lesson_slug, title, content, sort_order))
    
    conn.commit()
    cur.close()
    conn.close()
    
    return RedirectResponse(url="/admin/lessons", status_code=302)

@app.get("/admin/lessons/{lesson_id}/edit", response_class=HTMLResponse)
async def edit_lesson(lesson_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM lessons WHERE id = %s", (lesson_id,))
    lesson = cur.fetchone()
    cur.close()
    conn.close()
    
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")
    
    return HTMLResponse(render_template(EDIT_TEMPLATE, lesson=lesson))

@app.post("/admin/lessons/{lesson_id}/edit")
async def update_lesson(
    lesson_id: int,
    course_id: str = Form(...),
    section_id: str = Form(...),
    lesson_slug: str = Form(...),
    title: str = Form(...),
    content: str = Form(...),
    sort_order: int = Form(0)
):
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("""
        UPDATE lessons 
        SET course_id=%s, section_id=%s, lesson_slug=%s, title=%s, content=%s, sort_order=%s, updated_at=NOW()
        WHERE id=%s
    """, (course_id, section_id, lesson_slug, title, content, sort_order, lesson_id))
    
    conn.commit()
    cur.close()
    conn.close()
    
    return RedirectResponse(url="/admin/lessons", status_code=302)

@app.get("/admin/lessons/{lesson_id}/delete")
async def delete_lesson(lesson_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM lessons WHERE id = %s", (lesson_id,))
    conn.commit()
    cur.close()
    conn.close()
    
    return RedirectResponse(url="/admin/lessons", status_code=302)

@app.get("/")
async def root():
    return RedirectResponse(url="/admin/login")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
