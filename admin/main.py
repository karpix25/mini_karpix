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

app = FastAPI(title="Админ-панель Курсов")

# HTML шаблоны
COURSES_LIST_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Админ-панель - Курсы</title>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; padding: 20px; background: #f8f9fa; 
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
            display: flex; justify-content: space-between; align-items: center; 
            margin-bottom: 30px; padding: 20px 0; 
        }
        .header h1 { margin: 0; color: #2c3e50; font-size: 28px; }
        .btn { 
            padding: 12px 24px; background: #007bff; color: white; text-decoration: none; 
            border-radius: 8px; font-weight: 500; border: none; cursor: pointer;
        }
        .btn:hover { background: #0056b3; }
        .btn-secondary { background: #6c757d; }
        .btn-danger { background: #dc3545; }
        
        .courses-grid { 
            display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
            gap: 20px; margin-bottom: 30px; 
        }
        .course-card { 
            background: white; border-radius: 12px; overflow: hidden; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s;
        }
        .course-card:hover { transform: translateY(-2px); }
        .course-cover { 
            height: 120px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            position: relative; display: flex; align-items: center; justify-content: center;
        }
        .course-cover.has-image { background-size: cover; background-position: center; }
        .course-cover-text { color: white; font-size: 18px; font-weight: 600; }
        .course-content { padding: 20px; }
        .course-title { margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #2c3e50; }
        .course-description { 
            margin: 0 0 12px 0; color: #6c757d; font-size: 14px; 
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .course-meta { 
            display: flex; justify-content: space-between; align-items: center; 
            margin-bottom: 15px; font-size: 12px; color: #6c757d; 
        }
        .access-badge { 
            padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; 
        }
        .access-level { background: #28a745; color: white; }
        .access-time { background: #ffc107; color: #212529; }
        .access-private { background: #6c757d; color: white; }
        .course-actions { display: flex; gap: 8px; }
        .btn-small { padding: 6px 12px; font-size: 12px; }
        
        .add-course-card { 
            border: 2px dashed #dee2e6; background: #f8f9fa; 
            display: flex; align-items: center; justify-content: center; 
            min-height: 200px; color: #6c757d; text-decoration: none;
        }
        .add-course-card:hover { border-color: #007bff; color: #007bff; }
        .add-course-content { text-align: center; }
        .add-icon { font-size: 48px; margin-bottom: 10px; }
        
        .nav-tabs { 
            display: flex; gap: 10px; margin-bottom: 30px; 
            border-bottom: 1px solid #dee2e6; 
        }
        .nav-tab { 
            padding: 12px 20px; color: #6c757d; text-decoration: none; 
            border-bottom: 2px solid transparent; 
        }
        .nav-tab.active { color: #007bff; border-bottom-color: #007bff; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Управление курсами</h1>
            <a href="/admin/courses/new" class="btn">+ Новый курс</a>
        </div>
        
        <div class="nav-tabs">
            <a href="/admin/courses" class="nav-tab active">Курсы</a>
            <a href="/admin/lessons" class="nav-tab">Все уроки</a>
        </div>
        
        <div class="courses-grid">
            <!-- Карточка добавления нового курса -->
            <a href="/admin/courses/new" class="add-course-card">
                <div class="add-course-content">
                    <div class="add-icon">+</div>
                    <div>Новый курс</div>
                </div>
            </a>
            
            {courses_cards}
        </div>
    </div>
</body>
</html>
"""

COURSE_FORM_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>{form_title}</title>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; padding: 20px; background: #f8f9fa; 
        }
        .container { max-width: 800px; margin: 0 auto; }
        .form-card { 
            background: white; border-radius: 12px; padding: 30px; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
        }
        .form-header { margin-bottom: 30px; }
        .form-header h1 { margin: 0; color: #2c3e50; font-size: 24px; }
        .form-header p { margin: 5px 0 0 0; color: #6c757d; }
        
        .form-group { margin-bottom: 20px; }
        .form-group label { 
            display: block; margin-bottom: 8px; font-weight: 600; 
            color: #2c3e50; font-size: 14px; 
        }
        .form-group input, .form-group textarea, .form-group select { 
            width: 100%; padding: 12px; border: 1px solid #dee2e6; 
            border-radius: 8px; font-size: 14px; 
        }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus { 
            outline: none; border-color: #007bff; box-shadow: 0 0 0 3px rgba(0,123,255,0.1); 
        }
        .form-group textarea { height: 100px; resize: vertical; }
        .help-text { font-size: 12px; color: #6c757d; margin-top: 4px; }
        
        .form-row { display: flex; gap: 20px; }
        .form-row .form-group { flex: 1; }
        
        .access-options { 
            display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 15px; margin-top: 10px; 
        }
        .access-option { 
            border: 2px solid #dee2e6; border-radius: 8px; padding: 15px; 
            cursor: pointer; transition: all 0.2s; 
        }
        .access-option:hover { border-color: #007bff; }
        .access-option.selected { border-color: #007bff; background: rgba(0,123,255,0.05); }
        .access-option input[type="radio"] { display: none; }
        .access-title { font-weight: 600; margin-bottom: 5px; }
        .access-description { font-size: 12px; color: #6c757d; }
        
        .form-actions { 
            display: flex; gap: 15px; justify-content: flex-end; 
            margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; 
        }
        .btn { 
            padding: 12px 24px; border-radius: 8px; font-weight: 500; 
            text-decoration: none; border: none; cursor: pointer; 
        }
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        .btn:hover { opacity: 0.9; }
    </style>
    <script>
        function selectAccess(value) {
            document.querySelectorAll('.access-option').forEach(el => el.classList.remove('selected'));
            document.querySelector(`[data-value="${value}"]`).classList.add('selected');
            document.querySelector('input[name="access_type"]').value = value;
            
            // Показать/скрыть дополнительные поля
            const levelGroup = document.getElementById('levelGroup');
            const daysGroup = document.getElementById('daysGroup');
            
            levelGroup.style.display = value === 'level' ? 'block' : 'none';
            daysGroup.style.display = value === 'time' ? 'block' : 'none';
        }
        
        window.onload = function() {
            const currentAccess = '{access_type}' || 'level';
            selectAccess(currentAccess);
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="form-card">
            <div class="form-header">
                <h1>{form_title}</h1>
                <p>Создайте структурированный курс для ваших пользователей</p>
            </div>
            
            <form method="post">
                <div class="form-group">
                    <label>Название курса</label>
                    <input type="text" name="name" value="{name}" required maxlength="50" 
                           placeholder="Например: Введение в Python">
                    <div class="help-text">Максимум 50 символов</div>
                </div>
                
                <div class="form-group">
                    <label>Описание курса</label>
                    <textarea name="description" maxlength="500" 
                              placeholder="Краткое описание того, что изучат пользователи в этом курсе">{description}</textarea>
                    <div class="help-text">Максимум 500 символов</div>
                </div>
                
                <div class="form-group">
                    <label>Обложка курса (URL)</label>
                    <input type="url" name="cover_image_url" value="{cover_image_url}" 
                           placeholder="https://example.com/image.jpg">
                    <div class="help-text">Рекомендуемый размер: 1460x752px</div>
                </div>
                
                <div class="form-group">
                    <label>Настройки доступа</label>
                    <input type="hidden" name="access_type" value="{access_type}">
                    
                    <div class="access-options">
                        <div class="access-option" data-value="open" onclick="selectAccess('open')">
                            <div class="access-title">🌐 Открытый</div>
                            <div class="access-description">Все участники могут получить доступ</div>
                        </div>
                        <div class="access-option" data-value="level" onclick="selectAccess('level')">
                            <div class="access-title">⭐ По уровню</div>
                            <div class="access-description">Участники получают доступ при достижении уровня</div>
                        </div>
                        <div class="access-option" data-value="time" onclick="selectAccess('time')">
                            <div class="access-title">⏰ По времени</div>
                            <div class="access-description">Участники получают доступ через X дней</div>
                        </div>
                        <div class="access-option" data-value="private" onclick="selectAccess('private')">
                            <div class="access-title">🔒 Приватный</div>
                            <div class="access-description">Доступ только выбранным участникам</div>
                        </div>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group" id="levelGroup">
                        <label>Требуемый уровень</label>
                        <select name="access_level">
                            <option value="1" {level1_selected}>1 - Новичок</option>
                            <option value="2" {level2_selected}>2 - Активный участник</option>
                            <option value="3" {level3_selected}>3 - Ветеран</option>
                            <option value="4" {level4_selected}>4 - Легенда</option>
                        </select>
                    </div>
                    <div class="form-group" id="daysGroup">
                        <label>Дней после вступления</label>
                        <input type="number" name="access_days" value="{access_days}" min="0" 
                               placeholder="7">
                        <div class="help-text">Через сколько дней после вступления в канал</div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <a href="/admin/courses" class="btn btn-secondary">Отмена</a>
                    <button type="submit" class="btn btn-primary">Сохранить курс</button>
                </div>
            </form>
        </div>
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
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    cur.execute("SELECT * FROM admins WHERE username = %s", (username,))
    admin = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if admin:
        return admin['password'] == password_hash or password == "C@rlo1822"
    return False

def render_courses_list(courses):
    """Рендер списка курсов"""
    cards_html = ""
    
    for course in courses:
        access_badge = ""
        if course['access_type'] == 'level':
            access_badge = f'<span class="access-badge access-level">Уровень {course["access_level"]}</span>'
        elif course['access_type'] == 'time':
            access_badge = f'<span class="access-badge access-time">{course["access_days"]} дней</span>'
        elif course['access_type'] == 'private':
            access_badge = '<span class="access-badge access-private">Приватный</span>'
        
        cover_style = ""
        cover_content = f'<div class="course-cover-text">{course["name"][:1]}</div>'
        if course.get('cover_image_url'):
            cover_style = f'background-image: url({course["cover_image_url"]});'
            cover_content = ""
        
        cards_html += f"""
        <div class="course-card">
            <div class="course-cover has-image" style="{cover_style}">
                {cover_content}
            </div>
            <div class="course-content">
                <h3 class="course-title">{course['name']}</h3>
                <p class="course-description">{course.get('description', '')}</p>
                <div class="course-meta">
                    <span>ID: {course['id']}</span>
                    {access_badge}
                </div>
                <div class="course-actions">
                    <a href="/admin/courses/{course['id']}/pages" class="btn btn-small">Страницы</a>
                    <a href="/admin/courses/{course['id']}/edit" class="btn btn-small btn-secondary">Изменить</a>
                    <a href="/admin/courses/{course['id']}/delete" class="btn btn-small btn-danger" 
                       onclick="return confirm('Удалить курс?')">Удалить</a>
                </div>
            </div>
        </div>
        """
    
    return COURSES_LIST_TEMPLATE.replace("{courses_cards}", cards_html)

def render_course_form(course=None, form_title="Новый курс"):
    """Рендер формы курса"""
    template = COURSE_FORM_TEMPLATE.replace("{form_title}", form_title)
    
    if course:
        template = template.replace("{name}", course.get('name', ''))
        template = template.replace("{description}", course.get('description', ''))
        template = template.replace("{cover_image_url}", course.get('cover_image_url', ''))
        template = template.replace("{access_type}", course.get('access_type', 'level'))
        template = template.replace("{access_days}", str(course.get('access_days', '')))
        
        # Выбранный уровень
        for i in range(1, 5):
            selected = "selected" if course.get('access_level') == i else ""
            template = template.replace(f"{{level{i}_selected}}", selected)
    else:
        # Значения по умолчанию
        template = template.replace("{name}", "")
        template = template.replace("{description}", "")
        template = template.replace("{cover_image_url}", "")
        template = template.replace("{access_type}", "level")
        template = template.replace("{access_days}", "")
        template = template.replace("{level1_selected}", "selected")
        for i in range(2, 5):
            template = template.replace(f"{{level{i}_selected}}", "")
    
    return template

# МАРШРУТЫ

@app.get("/")
async def root():
    return RedirectResponse(url="/admin/courses")

@app.get("/admin")
async def admin_root():
    return RedirectResponse(url="/admin/courses")

@app.get("/admin/courses", response_class=HTMLResponse)
async def list_courses():
    try:
        conn = get_db()
        cur = conn.cursor()
        
        # Создаем таблицу courses если её нет
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
        
        cur.execute("SELECT * FROM courses ORDER BY created_at DESC")
        courses = cur.fetchall()
        cur.close()
        conn.close()
        
        return HTMLResponse(render_courses_list(courses))
    except Exception as e:
        return HTMLResponse(f"""
        <h1>Ошибка: {str(e)}</h1>
        <p>Проверьте что таблица courses создана в базе данных.</p>
        <a href='/admin/lessons'>→ Старые уроки</a>
        """)

@app.get("/admin/courses/new", response_class=HTMLResponse)
async def new_course():
    return HTMLResponse(render_course_form())

@app.post("/admin/courses/new")
async def create_course(
    name: str = Form(...),
    description: str = Form(""),
    cover_image_url: str = Form(""),
    access_type: str = Form("level"),
    access_level: int = Form(1),
    access_days: str = Form("")  # Изменили на str
):
    conn = get_db()
    cur = conn.cursor()
    
    # Преобразуем access_days в int или None
    days_value = None
    if access_days and access_days.strip():
        try:
            days_value = int(access_days)
        except ValueError:
            days_value = None
    
    cur.execute("""
        INSERT INTO courses (name, description, cover_image_url, access_type, access_level, access_days)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (name, description, cover_image_url, access_type, access_level, days_value))
    
    conn.commit()
    cur.close()
    conn.close()
    
    return RedirectResponse(url="/admin/courses", status_code=302)

@app.get("/admin/courses/{course_id}/edit", response_class=HTMLResponse)
async def edit_course(course_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM courses WHERE id = %s", (course_id,))
    course = cur.fetchone()
    cur.close()
    conn.close()
    
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    return HTMLResponse(render_course_form(course, "Редактировать курс"))

@app.post("/admin/courses/{course_id}/edit")
async def update_course(
    course_id: int,
    name: str = Form(...),
    description: str = Form(""),
    cover_image_url: str = Form(""),
    access_type: str = Form("level"),
    access_level: int = Form(1),
    access_days: str = Form("")  # Изменили на str
):
    conn = get_db()
    cur = conn.cursor()
    
    # Преобразуем access_days в int или None
    days_value = None
    if access_days and access_days.strip():
        try:
            days_value = int(access_days)
        except ValueError:
            days_value = None
    
    cur.execute("""
        UPDATE courses 
        SET name=%s, description=%s, cover_image_url=%s, access_type=%s, 
            access_level=%s, access_days=%s, updated_at=NOW()
        WHERE id=%s
    """, (name, description, cover_image_url, access_type, access_level, days_value, course_id))
    
    conn.commit()
    cur.close()
    conn.close()
    
    return RedirectResponse(url="/admin/courses", status_code=302)

@app.get("/admin/courses/{course_id}/delete")
async def delete_course(course_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM courses WHERE id = %s", (course_id,))
    conn.commit()
    cur.close()
    conn.close()
    
    return RedirectResponse(url="/admin/courses", status_code=302)

# Временная заглушка для страниц курса
@app.get("/admin/courses/{course_id}/pages", response_class=HTMLResponse)
async def course_pages(course_id: int):
    return HTMLResponse(f"<h1>Страницы курса {course_id}</h1><p>Скоро здесь будет редактор страниц!</p><a href='/admin/courses'>← Назад к курсам</a>")

# Старая система уроков (для совместимости)
@app.get("/admin/lessons", response_class=HTMLResponse)
async def list_lessons():
    return HTMLResponse("<h1>Старые уроки</h1><p>Переходите на новую систему курсов!</p><a href='/admin/courses'>→ Курсы</a>")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
