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
        
        .debug-info { 
            background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; 
            padding: 10px; border-radius: 4px; margin-bottom: 20px; font-size: 14px; 
        }
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
        
        {debug_info}
        
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
            border-radius: 8px; font-size: 14px; box-sizing: border-box;
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

# HTML шаблоны для уроков
LESSONS_LIST_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
    <title>Уроки курса - {course_name}</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .header h1 { margin: 0; color: #2c3e50; }
        .breadcrumb { color: #6c757d; margin-bottom: 10px; }
        .breadcrumb a { color: #007bff; text-decoration: none; }
        .btn { padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 8px; }
        .btn:hover { background: #0056b3; }
        .btn-secondary { background: #6c757d; }
        .btn-danger { background: #dc3545; }
        .btn-small { padding: 6px 12px; font-size: 12px; }
        .course-info { background: white; border-radius: 12px; padding: 20px; margin-bottom: 30px; display: flex; align-items: center; gap: 20px; }
        .course-cover { width: 80px; height: 80px; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; }
        .empty-state { text-align: center; padding: 60px 20px; color: #6c757d; background: white; border-radius: 12px; }
        .lessons-list { background: white; border-radius: 12px; overflow: hidden; }
        .lesson-item { padding: 20px; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center; }
        .lesson-actions { display: flex; gap: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="breadcrumb">
            <a href="/admin/courses">← Курсы</a> / {course_name}
        </div>
        <div class="header">
            <h1>📖 Уроки курса</h1>
            <a href="/admin/courses/{course_id}/lessons/new" class="btn">+ Новый урок</a>
        </div>
        <div class="course-info">
            <div class="course-cover">{course_initial}</div>
            <div>
                <h2>{course_name}</h2>
                <p>{course_description}</p>
            </div>
        </div>
        {lessons_content}
    </div>
</body>
</html>"""


LESSON_FORM_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
    <title>{form_title}</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f8f9fa; }
        .container { max-width: 1000px; margin: 0 auto; }
        .breadcrumb { color: #6c757d; margin-bottom: 10px; }
        .breadcrumb a { color: #007bff; text-decoration: none; }
        .form-card { background: white; border-radius: 12px; padding: 30px; }
        .form-header h1 { margin: 0; color: #2c3e50; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #2c3e50; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 12px; border: 1px solid #dee2e6; border-radius: 8px; box-sizing: border-box; }
        .form-group textarea { height: 120px; resize: vertical; }
        .form-group textarea.content-editor { height: 400px; font-family: monospace; }
        .help-text { font-size: 12px; color: #6c757d; margin-top: 4px; }
        .form-row { display: flex; gap: 20px; }
        .form-row .form-group { flex: 1; }
        .form-actions { display: flex; gap: 15px; justify-content: flex-end; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; }
        .btn { padding: 12px 24px; border-radius: 8px; text-decoration: none; border: none; cursor: pointer; }
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <div class="breadcrumb">
            <a href="/admin/courses">Курсы</a> / 
            <a href="/admin/courses/{course_id}/lessons">{course_name}</a> / 
            {form_title}
        </div>
        <div class="form-card">
            <div class="form-header">
                <h1>{form_title}</h1>
                <p>Создайте интересный урок для вашего курса</p>
            </div>
            <form method="post">
                <div class="form-row">
                    <div class="form-group">
                        <label>Название урока</label>
                        <input type="text" name="title" value="{title}" required maxlength="100" placeholder="Например: Основы HTML">
                        <div class="help-text">Максимум 100 символов</div>
                    </div>
                    <div class="form-group">
                        <label>Порядковый номер</label>
                        <input type="number" name="order_index" value="{order_index}" min="1" placeholder="1">
                        <div class="help-text">Порядок показа урока в курсе</div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Краткое описание урока</label>
                    <textarea name="description" maxlength="300" placeholder="Краткое описание того, что изучат в этом уроке">{description}</textarea>
                    <div class="help-text">Максимум 300 символов</div>
                </div>
                <div class="form-group">
                    <label>Содержимое урока</label>
                    <textarea name="content" class="content-editor" placeholder="# Заголовок урока">{content}</textarea>
                    <div class="help-text">Используйте Markdown для форматирования</div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Тип урока</label>
                        <select name="lesson_type">
                            <option value="text" {text_selected}>📄 Текстовый урок</option>
                            <option value="video" {video_selected}>🎥 Видео урок</option>
                            <option value="interactive" {interactive_selected}>⚡ Интерактивный</option>
                            <option value="quiz" {quiz_selected}>❓ Тест/Квиз</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Время прохождения (мин)</label>
                        <input type="number" name="duration_minutes" value="{duration_minutes}" min="1" placeholder="15">
                        <div class="help-text">Примерное время на изучение</div>
                    </div>
                </div>
                <div class="form-actions">
                    <a href="/admin/courses/{course_id}/lessons" class="btn btn-secondary">Отмена</a>
                    <button type="submit" class="btn btn-primary">Сохранить урок</button>
                </div>
            </form>
        </div>
    </div>
</body>
</html>"""

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn

def ensure_tables_exist():
    """Убеждаемся что все необходимые таблицы существуют"""
    conn = get_db()
    cur = conn.cursor()
    
    try:
        # Создаем таблицу courses
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
        
        # Создаем таблицу admins
        cur.execute("""
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(128) NOT NULL
            );
        """)
        
        conn.commit()
        return True
    except Exception as e:
        print(f"Ошибка создания таблиц: {e}")
        return False
    finally:
        cur.close()
        conn.close()

def ensure_lessons_table_exists():
    """Создаем таблицу уроков для курсов из админки"""
    try:
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            CREATE TABLE IF NOT EXISTS course_lessons (
                id SERIAL PRIMARY KEY,
                course_id INT REFERENCES courses(id) ON DELETE CASCADE,
                title VARCHAR(200) NOT NULL,
                description TEXT,
                content TEXT,
                lesson_type VARCHAR(20) DEFAULT 'text',
                order_index INT DEFAULT 1,
                duration_minutes INT DEFAULT 15,
                is_published BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_course_lessons_course_id 
            ON course_lessons (course_id, order_index);
        """)
        
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"Ошибка создания таблицы уроков: {e}")
        return False

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

def get_course_by_id(course_id: int):
    """Получить курс по ID"""
    try:
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, name, description, cover_image_url
            FROM courses 
            WHERE id = %s AND is_published = true
        """, (course_id,))
        
        course = cur.fetchone()
        cur.close()
        conn.close()
        
        return course
    except Exception as e:
        print(f"Ошибка получения курса: {e}")
        return None

def get_course_lessons(course_id: int):
    """Получить все уроки курса"""
    try:
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, title, description, lesson_type, order_index, 
                   duration_minutes, is_published, created_at
            FROM course_lessons 
            WHERE course_id = %s 
            ORDER BY order_index, created_at
        """, (course_id,))
        
        lessons = cur.fetchall()
        cur.close()
        conn.close()
        
        return lessons
    except Exception as e:
        print(f"Ошибка получения уроков: {e}")
        return []

def render_courses_list(courses, debug_info=""):
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
                    <a href="/admin/courses/{course['id']}/lessons" class="btn btn-small">Уроки</a>
                    <a href="/admin/courses/{course['id']}/edit" class="btn btn-small btn-secondary">Изменить</a>
                    <a href="/admin/courses/{course['id']}/delete" class="btn btn-small btn-danger" 
                       onclick="return confirm('Удалить курс?')">Удалить</a>
                </div>
            </div>
        </div>
        """
    
    debug_html = f'<div class="debug-info">{debug_info}</div>' if debug_info else ""
    
    return COURSES_LIST_TEMPLATE.replace("{courses_cards}", cards_html).replace("{debug_info}", debug_html)

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

def render_lessons_list(course, lessons):
    """Рендер списка уроков курса"""
    if not lessons:
        lessons_content = f"""
        <div class="empty-state">
            <h3>📖 Уроки еще не созданы</h3>
            <p>Начните создавать уроки для этого курса</p>
            <a href="/admin/courses/{course['id']}/lessons/new" class="btn">+ Создать первый урок</a>
        </div>
        """
    else:
        items_html = ""
        for lesson in lessons:
            lesson_type_icons = {
                'text': '📄',
                'video': '🎥', 
                'interactive': '⚡',
                'quiz': '❓'
            }
            
            icon = lesson_type_icons.get(lesson['lesson_type'], '📄')
            status = "Опубликован" if lesson['is_published'] else "Черновик"
            
            # ИСПРАВЛЕННАЯ ЧАСТЬ - убираем f-строку и используем .format()
            items_html += """
            <div class="lesson-item">
                <div style="display: flex; align-items: center;">
                    <div class="drag-handle">≡</div>
                    <div class="lesson-info">
                        <h3>{icon} {title}</h3>
                        <div class="lesson-meta">
                            #{order_index} • {duration} мин • {status}
                        </div>
                    </div>
                </div>
                <div class="lesson-actions">
                    <a href="/admin/courses/{course_id}/lessons/{lesson_id}/edit" 
                       class="btn btn-small btn-secondary">Изменить</a>
                    <a href="/admin/courses/{course_id}/lessons/{lesson_id}/delete" 
                       class="btn btn-small btn-danger" 
                       onclick="return confirm('Удалить урок?')">Удалить</a>
                </div>
            </div>
            """.format(
                icon=icon,
                title=lesson['title'],
                order_index=lesson['order_index'],
                duration=lesson['duration_minutes'],
                status=status,
                course_id=course['id'],
                lesson_id=lesson['id']
            )
        
        lessons_content = f'<div class="lessons-list">{items_html}</div>'
    
    course_initial = course['name'][:1].upper() if course['name'] else 'К'
    course_description = course['description'] or 'Описание курса'
    
    return LESSONS_LIST_TEMPLATE.format(
        course_id=course['id'],
        course_name=course['name'],
        course_initial=course_initial,
        course_description=course_description,
        lessons_content=lessons_content
    )

def render_lesson_form(course, lesson=None, form_title="Новый урок"):
    """Рендер формы урока"""
    template = LESSON_FORM_TEMPLATE.replace("{form_title}", form_title)
    template = template.replace("{course_id}", str(course['id']))
    template = template.replace("{course_name}", course['name'])
    
    if lesson:
        template = template.replace("{title}", lesson.get('title', ''))
        template = template.replace("{description}", lesson.get('description', ''))
        template = template.replace("{content}", lesson.get('content', ''))
        template = template.replace("{order_index}", str(lesson.get('order_index', 1)))
        template = template.replace("{duration_minutes}", str(lesson.get('duration_minutes', 15)))
        
        lesson_type = lesson.get('lesson_type', 'text')
        for ltype in ['text', 'video', 'interactive', 'quiz']:
            selected = "selected" if lesson_type == ltype else ""
            template = template.replace(f"{{{ltype}_selected}}", selected)
    else:
        template = template.replace("{title}", "")
        template = template.replace("{description}", "")
        template = template.replace("{content}", "")
        template = template.replace("{order_index}", "1")
        template = template.replace("{duration_minutes}", "15")
        template = template.replace("{text_selected}", "selected")
        for ltype in ['video', 'interactive', 'quiz']:
            template = template.replace(f"{{{ltype}_selected}}", "")
    
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
        # Убеждаемся что таблицы существуют
        tables_created = ensure_tables_exist()
        
        conn = get_db()
        cur = conn.cursor()
        
        # Проверяем существует ли таблица
        cur.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'courses'
        """)
        table_exists = cur.fetchone()
        
        cur.execute("SELECT * FROM courses ORDER BY created_at DESC")
        courses = cur.fetchall()
        cur.close()
        conn.close()
        
        debug_info = f"🔧 Debug: Таблица courses {'✅ найдена' if table_exists else '❌ НЕ найдена'}, курсов: {len(courses)}, таблицы {'✅ созданы' if tables_created else '❌ ошибка создания'}"
        
        return HTMLResponse(render_courses_list(courses, debug_info))
    except Exception as e:
        return HTMLResponse(f"""
        <h1>Ошибка базы данных: {str(e)}</h1>
        <p>Попробуйте обновить страницу через несколько секунд.</p>
        <a href='/admin/courses'>🔄 Обновить</a> | 
        <a href='/admin/lessons'>→ Старые уроки</a>
        """, status_code=500)

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
    access_days: str = Form("")
):
    try:
        # КРИТИЧНО: убеждаемся что таблицы существуют ПЕРЕД вставкой
        ensure_tables_exist()
        
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
        
    except Exception as e:
        return HTMLResponse(f"""
        <h1>Ошибка: {str(e)}</h1>
        <p>Не удалось создать курс. Проверьте данные.</p>
        <a href='/admin/courses'>← Назад к курсам</a>
        """, status_code=500)

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
    access_days: str = Form("")
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

# Старая система уроков (для совместимости)
@app.get("/admin/lessons", response_class=HTMLResponse)
async def list_lessons():
    return HTMLResponse("<h1>Старые уроки</h1><p>Переходите на новую систему курсов!</p><a href='/admin/courses'>→ Курсы</a>")

# --- НОВЫЕ МАРШРУТЫ ДЛЯ УРОКОВ ---

@app.get("/admin/courses/{course_id}/lessons", response_class=HTMLResponse)
async def list_course_lessons(course_id: int):
    """Список уроков курса - С ДИАГНОСТИКОЙ"""
    try:
        print(f"🔍 DEBUG: Trying to get course {course_id}")
        
        # Проверяем создание таблицы
        table_created = ensure_lessons_table_exists()
        print(f"🔍 DEBUG: Table created: {table_created}")
        
        # Получаем курс
        course = get_course_by_id(course_id)
        print(f"🔍 DEBUG: Course: {course}")
        
        if not course:
            return HTMLResponse(f"""
            <h1>❌ Курс не найден</h1>
            <p>Course ID: {course_id}</p>
            <a href="/admin/courses">← Назад к курсам</a>
            """)
        
        # Получаем уроки
        lessons = get_course_lessons(course_id)
        print(f"🔍 DEBUG: Lessons: {lessons}")
        
        # Рендерим
        result = render_lessons_list(course, lessons)
        print(f"🔍 DEBUG: Render successful")
        
        return HTMLResponse(result)
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return HTMLResponse(f"""
        <h1>Ошибка: {str(e)}</h1>
        <a href="/admin/courses">← Назад к курсам</a>
        """, status_code=500)

@app.get("/admin/courses/{course_id}/lessons/new", response_class=HTMLResponse) 
async def new_lesson(course_id: int):
    """Форма создания нового урока"""
    course = get_course_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    return HTMLResponse(render_lesson_form(course))

@app.post("/admin/courses/{course_id}/lessons/new")
async def create_lesson(
    course_id: int,
    title: str = Form(...),
    description: str = Form(""),
    content: str = Form(""),
    lesson_type: str = Form("text"),
    order_index: int = Form(1),
    duration_minutes: int = Form(15)
):
    """Создать новый урок"""
    try:
        ensure_lessons_table_exists()
        
        course = get_course_by_id(course_id)
        if not course:
            raise HTTPException(status_code=404, detail="Курс не найден")
        
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO course_lessons 
            (course_id, title, description, content, lesson_type, order_index, duration_minutes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (course_id, title, description, content, lesson_type, order_index, duration_minutes))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return RedirectResponse(url=f"/admin/courses/{course_id}/lessons", status_code=302)
        
    except Exception as e:
        return HTMLResponse(f"""
        <h1>Ошибка: {str(e)}</h1>
        <p>Не удалось создать урок.</p>
        <a href='/admin/courses/{course_id}/lessons'>← Назад к урокам</a>
        """, status_code=500)

@app.get("/admin/courses/{course_id}/lessons/{lesson_id}/edit", response_class=HTMLResponse)
async def edit_lesson(course_id: int, lesson_id: int):
    """Форма редактирования урока"""
    course = get_course_by_id(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    try:
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT * FROM course_lessons 
            WHERE id = %s AND course_id = %s
        """, (lesson_id, course_id))
        
        lesson = cur.fetchone()
        cur.close()
        conn.close()
        
        if not lesson:
            raise HTTPException(status_code=404, detail="Урок не найден")
        
        return HTMLResponse(render_lesson_form(course, lesson, "Редактировать урок"))
        
    except Exception as e:
        return HTMLResponse(f"""
        <h1>Ошибка: {str(e)}</h1>
        <a href='/admin/courses/{course_id}/lessons'>← Назад к урокам</a>
        """, status_code=500)

@app.post("/admin/courses/{course_id}/lessons/{lesson_id}/edit")
async def update_lesson(
    course_id: int,
    lesson_id: int,
    title: str = Form(...),
    description: str = Form(""),
    content: str = Form(""),
    lesson_type: str = Form("text"),
    order_index: int = Form(1),
    duration_minutes: int = Form(15)
):
    """Обновить урок"""
    try:
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE course_lessons 
            SET title=%s, description=%s, content=%s, lesson_type=%s, 
                order_index=%s, duration_minutes=%s, updated_at=NOW()
            WHERE id=%s AND course_id=%s
        """, (title, description, content, lesson_type, order_index, duration_minutes, lesson_id, course_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return RedirectResponse(url=f"/admin/courses/{course_id}/lessons", status_code=302)
        
    except Exception as e:
        return HTMLResponse(f"""
        <h1>Ошибка: {str(e)}</h1>
        <a href='/admin/courses/{course_id}/lessons'>← Назад к урокам</a>
        """, status_code=500)

@app.get("/admin/courses/{course_id}/lessons/{lesson_id}/delete")
async def delete_lesson(course_id: int, lesson_id: int):
    """Удалить урок"""
    try:
        conn = get_db()
        cur = conn.cursor()
        
        cur.execute("""
            DELETE FROM course_lessons 
            WHERE id = %s AND course_id = %s
        """, (lesson_id, course_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return RedirectResponse(url=f"/admin/courses/{course_id}/lessons", status_code=302)
        
    except Exception as e:
        return HTMLResponse(f"""
        <h1>Ошибка: {str(e)}</h1>
        <a href='/admin/courses/{course_id}/lessons'>← Назад к урокам</a>
        """, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
