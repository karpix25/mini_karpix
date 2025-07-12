import os
import hmac
import hashlib
import json
from urllib.parse import unquote, parse_qsl
from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
import psycopg2
from typing import List, Optional, Literal, Dict
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor

# --- Настройки ---
BOT_TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")

app = FastAPI()

# --- Настройка CORS ---
origins = [
    "https://minifront.karpix.com",
    "https://miniback.karpix.com", 
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Модели данных ---
class UserRank(BaseModel): 
    name: str
    min_points: int

class UserData(BaseModel): 
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    points: int
    rank: str
    next_rank_name: Optional[str] = None
    points_to_next_rank: Optional[int] = None
    progress_percentage: int

class RankInfo(BaseModel): 
    level: int
    name: str
    min_points: int
    is_unlocked: bool

class LessonInfo(BaseModel):
    id: str
    title: str
    completed: Optional[bool] = False

class SectionInfo(BaseModel):
    id: str
    title: str
    lessons: List[LessonInfo]

class CourseInfo(BaseModel):
    id: str
    title: str
    description: str
    rank_required: int
    progress: int
    total_lessons: int
    completed_lessons: int
    is_unlocked: bool  # <-- ДОБАВЬТЕ ЭТУ СТРОКУ

class CourseDetail(BaseModel):
    id: str
    title: str
    description: str
    rank_required: int
    sections: List[SectionInfo]
    progress: int

class LessonContent(BaseModel):
    id: str
    title: str
    content: str
    course_id: str
    section_id: str

class CompletionStatus(BaseModel):
    status: str

# СТАРЫЕ МОДЕЛИ (для обратной совместимости)
class ArticleInfo(BaseModel): 
    id: str
    title: str
    rank_required: int

class ArticleContent(BaseModel): 
    id: str
    content: str

# МОДЕЛИ ЛИДЕРБОРДА
class LeaderboardUserRow(BaseModel):
    rank: int
    user_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    score: int

class CurrentUserRankInfo(BaseModel):
    rank: int
    user_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    score: int

class LeaderboardResponse(BaseModel):
    top_users: List[LeaderboardUserRow]
    current_user: Optional[CurrentUserRankInfo] = None

# --- Логика Рангов ---
RANKS = [
    UserRank(name="Новичок", min_points=0),
    UserRank(name="Активный участник", min_points=51),
    UserRank(name="Ветеран", min_points=201),
    UserRank(name="Легенда", min_points=501),
]

def get_rank(points: int) -> str:
    current_rank = RANKS[0].name
    for rank in reversed(RANKS):
        if points >= rank.min_points: 
            return rank.name
    return current_rank

def get_rank_level(points: int) -> int:
    """Возвращает уровень ранга (1-4)"""
    for i, rank in enumerate(reversed(RANKS)):
        if points >= rank.min_points:
            return len(RANKS) - i
    return 1

# --- Утилиты ---
def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try: 
        yield conn
    finally: 
        conn.close()

def validate_init_data(init_data: str, bot_token: str) -> Optional[dict]:
    try:
        parsed_data = dict(parse_qsl(init_data))
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()) if k != "hash")
        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        h = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256)
        if h.hexdigest() == parsed_data["hash"]: 
            return json.loads(unquote(parsed_data.get("user", "{}")))
    except Exception: 
        return None

async def get_current_user(x_init_data: str = Header(None), db=Depends(get_db_connection)):
    if not x_init_data: 
        raise HTTPException(status_code=401, detail="X-Init-Data header is missing")
    user_data = validate_init_data(x_init_data, BOT_TOKEN)
    if not user_data: 
        raise HTTPException(status_code=401, detail="Invalid InitData")
    
    user_id = user_data.get("id")
    
    cur = db.cursor()
    cur.execute("SELECT is_active FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()

    if db_user and db_user.get('is_active') is False:
        raise HTTPException(status_code=403, detail="Access denied. You must be an active member of the group.")

    return user_data

# --- НОВЫЕ ФУНКЦИИ ДЛЯ КУРСОВ ИЗ АДМИНКИ ---

def get_admin_courses_from_db(db) -> List[dict]:
    """Получает курсы созданные через админку"""
    try:
        cur = db.cursor()
        cur.execute("""
            SELECT id, name, description, cover_image_url, access_type, 
                   access_level, access_days, is_published, created_at
            FROM courses 
            WHERE is_published = true 
            ORDER BY created_at DESC
        """)
        admin_courses = cur.fetchall()
        cur.close()
        
        courses = []
        for course in admin_courses:
            courses.append({
                "id": f"admin_{course['id']}", 
                "title": course['name'],
                "description": course['description'] or f"Описание курса {course['name']}",
                "rank_required": course['access_level'] or 1,
                "admin_course": True,
                "access_type": course['access_type'],
                "cover_image_url": course['cover_image_url']
            })
        
        return courses
    except Exception as e:
        print(f"Ошибка получения курсов из админки: {e}")
        return []

def get_combined_courses_data(db) -> Dict[str, dict]:
    """Объединяет курсы из БД (lessons) + курсы из админки"""
    existing_courses = get_courses_from_db(db)
    admin_courses = get_admin_courses_from_db(db)
    
    all_courses = {}
    
    # Сначала добавляем курсы из админки
    for course in admin_courses:
        all_courses[course["id"]] = course
    
    # Потом добавляем существующие курсы
    for course_id, course_data in existing_courses.items():
        if course_id not in all_courses:
            all_courses[course_id] = course_data
    
    return all_courses

# --- ФУНКЦИИ ДЛЯ РАБОТЫ С КУРСАМИ ИЗ БД ---

def get_courses_from_db(db) -> Dict[str, dict]:
    """Получает все курсы из БД и группирует их"""
    cur = db.cursor()
    cur.execute("""
        SELECT course_id, 
               MIN(rank_required) as min_rank_required,
               COALESCE(MIN(sort_order), 0) as min_sort_order
        FROM lessons 
        GROUP BY course_id 
        ORDER BY min_sort_order, course_id
    """)
    courses_data = cur.fetchall()
    cur.close()
    
    courses = {}
    for course_row in courses_data:
        course_id = course_row['course_id']
        courses[course_id] = {
            "id": course_id,
            "title": f"Курс {course_id.title()}",
            "description": f"Описание курса {course_id}",
            "rank_required": course_row['min_rank_required'] or 1,
            "admin_course": False
        }
    
    return courses

def get_course_sections_from_db(db, course_id: str) -> List[dict]:
    """Получает секции и уроки курса из БД"""
    cur = db.cursor()
    cur.execute("""
        SELECT section_id, lesson_slug, title, sort_order
        FROM lessons 
        WHERE course_id = %s 
        ORDER BY section_id, sort_order, lesson_slug
    """, (course_id,))
    lessons_data = cur.fetchall()
    cur.close()
    
    # Группируем уроки по секциям
    sections_dict = {}
    for lesson in lessons_data:
        section_id = lesson['section_id']
        if section_id not in sections_dict:
            sections_dict[section_id] = {
                "id": section_id,
                "title": f"Секция {section_id.title()}",
                "lessons": []
            }
        
        sections_dict[section_id]["lessons"].append({
            "id": lesson['lesson_slug'],
            "title": lesson['title']
        })
    
    return list(sections_dict.values())

# --- ОБНОВЛЕННЫЕ ЭНДПОИНТЫ ДЛЯ КУРСОВ ---

@app.get("/api/courses", response_model=List[CourseInfo])
async def get_courses(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    """Получить список всех доступных курсов из БД + Админки"""
    user_id = user.get("id")
    
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    user_rank_level = get_rank_level(points)
    
    # Получаем ВСЕ курсы: из БД + из админки
    courses_data = get_combined_courses_data(db)
    courses = []
    
# --- НАЧАЛО НОВОГО БЛОКА ДЛЯ ВСТАВКИ ---

for course_id, course_meta in courses_data.items():
    # 1. Вычисляем флаг is_unlocked вместо фильтрации
    is_unlocked = course_meta.get("rank_required", 1) <= user_rank_level

    # 2. Задаем значения по умолчанию. Для заблокированных курсов они останутся нулевыми.
    progress = 0
    total_lessons = 0
    completed_lessons = 0

    # 3. Считаем реальный прогресс ТОЛЬКО для разблокированных курсов
    if is_unlocked:
        if course_meta.get("admin_course", False):
            try:
                real_course_id = int(course_id.replace("admin_", ""))
            except ValueError:
                print(f"Invalid admin course ID: {course_id}")
                continue
            
            cur.execute("SELECT COUNT(*) FROM course_lessons WHERE course_id = %s AND is_published = true", (real_course_id,))
            total_lessons_res = cur.fetchone()
            total_lessons = total_lessons_res['count'] if total_lessons_res else 0
            
            # TODO: Добавить логику подсчета пройденных уроков админ-курса
            completed_lessons = 0 
        else:
            cur.execute("SELECT COUNT(*) FROM lessons WHERE course_id = %s", (course_id,))
            total_lessons_res = cur.fetchone()
            total_lessons = total_lessons_res['count'] if total_lessons_res else 0
            
            cur.execute("SELECT COUNT(*) FROM user_lesson_progress WHERE user_id = %s AND course_id = %s;", (user_id, course_id))
            completed_lessons_res = cur.fetchone()
            completed_lessons = completed_lessons_res['count'] if completed_lessons_res else 0
            
        progress = int((completed_lessons / total_lessons) * 100) if total_lessons > 0 else 0
    
    # 4. Добавляем КАЖДЫЙ курс в итоговый список, передавая новый флаг
    courses.append(CourseInfo(
        id=course_id,
        title=course_meta["title"],
        description=course_meta["description"],
        rank_required=course_meta["rank_required"],
        progress=progress,
        total_lessons=total_lessons,
        completed_lessons=completed_lessons,
        is_unlocked=is_unlocked  # <-- Передаем наш новый флаг на фронтенд
    ))

cur.close()

# (Опционально, но полезно) Сортируем курсы, чтобы разблокированные были вверху.
courses.sort(key=lambda c: (not c.is_unlocked, c.rank_required))

return courses

# --- КОНЕЦ НОВОГО БЛОКА ---

@app.get("/api/courses/{course_id}", response_model=CourseDetail)
async def get_course_detail(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    """Получить детальную информацию о курсе из БД"""
    user_id = user.get("id")
    
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    user_rank_level = get_rank_level(points)
    
    # Получаем все курсы
    courses_data = get_combined_courses_data(db)
    
    if course_id not in courses_data:
        cur.close()
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    course_meta = courses_data[course_id]
    
    if course_meta.get("rank_required", 1) > user_rank_level:
        cur.close()
        raise HTTPException(status_code=403, detail="Недостаточно прав для доступа к курсу")
    
    # ИСПРАВЛЕНИЕ: Этот блок `if` был сдвинут влево. Теперь он находится на правильном уровне отступа.
    if course_meta.get("admin_course", False):
        try:
            real_course_id = int(course_id.replace("admin_", ""))
        except ValueError:
            cur.close()
            raise HTTPException(status_code=400, detail="Invalid admin course ID format")
            
        cur.execute("""
            SELECT id, title, description, lesson_type, order_index, duration_minutes
            FROM course_lessons 
            WHERE course_id = %s AND is_published = true
            ORDER BY order_index, created_at
        """, (real_course_id,))
        admin_lessons = cur.fetchall()
        
        if not admin_lessons:
            cur.close()
            return CourseDetail(
                id=course_id,
                title=course_meta["title"],
                description=course_meta["description"],
                rank_required=course_meta["rank_required"],
                sections=[{
                    "id": "coming_soon",
                    "title": "Скоро появятся уроки",
                    "lessons": [{
                        "id": "placeholder",
                        "title": "Уроки для этого курса скоро будут добавлены!",
                        "completed": False
                    }]
                }],
                progress=0
            )
        
        sections = [{"id": "main_section", "title": "Основные уроки", "lessons": []}]
        
        for lesson in admin_lessons:
            sections[0]["lessons"].append({
                "id": f"lesson_{lesson['id']}",
                "title": lesson['title'],
                "completed": False,
                "locked": False
            })
        
        cur.close()
        return CourseDetail(
            id=course_id,
            title=course_meta["title"],
            description=course_meta["description"],
            rank_required=course_meta["rank_required"],
            sections=sections,
            progress=0  # TODO: посчитать реальный прогресс
        )
    
    # Для обычных курсов используем существующую логику
    cur.execute("SELECT COUNT(*) FROM lessons WHERE course_id = %s", (course_id,))
    if cur.fetchone()['count'] == 0:
        cur.close()
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    sections = get_course_sections_from_db(db, course_id)
    
    cur.execute("""
        SELECT lesson_id FROM user_lesson_progress
        WHERE user_id = %s AND course_id = %s;
    """, (user_id, course_id))
    completed_lesson_rows = cur.fetchall()
    completed_lesson_ids = {row['lesson_id'] for row in completed_lesson_rows}
    
    total_lessons = 0
    for section in sections:
        total_lessons += len(section['lessons'])
        for lesson in section['lessons']:
            lesson['completed'] = lesson['id'] in completed_lesson_ids

    progress = int((len(completed_lesson_ids) / total_lessons) * 100) if total_lessons > 0 else 0
    
    cur.close()
    
    return CourseDetail(
        id=course_id,
        title=course_meta["title"],
        description=course_meta["description"],
        rank_required=course_meta["rank_required"],
        sections=sections,
        progress=progress
    )

@app.get("/api/courses/{course_id}/lessons/{lesson_id}", response_model=LessonContent)
async def get_lesson_content(course_id: str, lesson_id: str, user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    """Получить содержимое конкретного урока из БД"""
    user_id = user.get("id")
    
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    user_rank_level = get_rank_level(points)
    
    courses_data = get_combined_courses_data(db)
    if course_id not in courses_data:
        cur.close()
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    course_meta = courses_data[course_id]
    if course_meta.get("rank_required", 1) > user_rank_level:
        cur.close()
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    # ИСПРАВЛЕНИЕ: Этот блок `if` и вложенный в него `try` были сдвинуты влево.
    if course_meta.get("admin_course", False):
        try:
            real_lesson_id = int(lesson_id.replace("lesson_", ""))
        except ValueError:
            cur.close()
            raise HTTPException(status_code=400, detail="Invalid lesson ID format")
        
        cur.execute("""
            SELECT title, content, description
            FROM course_lessons 
            WHERE id = %s AND is_published = true
        """, (real_lesson_id,))
        lesson_data = cur.fetchone()
        
        if not lesson_data:
            cur.close()
            raise HTTPException(status_code=404, detail="Урок не найден")
        
        cur.close()
        
        return LessonContent(
            id=lesson_id,
            title=lesson_data['title'],
            content=lesson_data['content'] or "",
            course_id=course_id,
            section_id="main_section"
        )
    
    # Для обычных курсов используем старую логику
    cur.execute("""
        SELECT section_id, title, content
        FROM lessons 
        WHERE course_id = %s AND lesson_slug = %s
    """, (course_id, lesson_id))
    lesson_data = cur.fetchone()
    
    if not lesson_data:
        cur.close()
        raise HTTPException(status_code=404, detail="Урок не найден")
    
    cur.close()
    
    return LessonContent(
        id=lesson_id,
        title=lesson_data['title'],
        content=lesson_data['content'] or "",
        course_id=course_id,
        section_id=lesson_data['section_id']
    )

@app.post("/api/courses/{course_id}/lessons/{lesson_id}/complete", response_model=CompletionStatus)
async def mark_lesson_as_complete(
    course_id: str, 
    lesson_id: str, 
    user: dict = Depends(get_current_user), 
    db=Depends(get_db_connection)
):
    user_id = user.get("id")
    
    try:
        cur = db.cursor()
        cur.execute("""
            INSERT INTO user_lesson_progress (user_id, course_id, lesson_id)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, course_id, lesson_id) DO NOTHING;
        """, (user_id, course_id, lesson_id))
        db.commit()
        cur.close()
    except Exception as e:
        db.rollback() # Рекомендуется откатывать транзакцию при ошибке
        cur.close()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    return CompletionStatus(status="completed")

# --- СТАРЫЕ ЭНДПОИНТЫ (для обратной совместимости) ---

@app.get("/api/content", response_model=List[ArticleInfo])
async def get_content_list_legacy(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    """Старый эндпоинт - теперь читает из БД"""
    user_id = user.get("id")
    
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    user_rank_level = get_rank_level(points)
    
    # Получаем статьи из БД (для обратной совместимости)
    cur.execute("""
        SELECT lesson_slug, title, sort_order
        FROM lessons 
        WHERE course_id = 'legacy' 
        ORDER BY sort_order, lesson_slug
    """)
    lessons = cur.fetchall()
    
    available_articles = []
    for lesson in lessons:
        # Используем sort_order как rank_required для совместимости
        rank_required = lesson['sort_order'] if lesson['sort_order'] > 0 else 1
        
        if rank_required <= user_rank_level:
            available_articles.append(ArticleInfo(
                id=lesson['lesson_slug'],
                title=lesson['title'],
                rank_required=rank_required
            ))
    
    cur.close()
    return available_articles

@app.get("/api/content/{article_id}", response_model=ArticleContent)
async def get_article_legacy(article_id: str, user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    """Старый эндпоинт - теперь читает из БД"""
    user_id = user.get("id")
    
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    user_rank_level = get_rank_level(points)
    
    # Получаем статью из БД
    cur.execute("""
        SELECT content, sort_order
        FROM lessons 
        WHERE course_id = 'legacy' AND lesson_slug = %s
    """, (article_id,))
    lesson = cur.fetchone()
    
    if not lesson:
        cur.close()
        raise HTTPException(status_code=404, detail="Статья не найдена")
    
    rank_required = lesson['sort_order'] if lesson['sort_order'] > 0 else 1
    
    if user_rank_level < rank_required:
        cur.close()
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    cur.close()
    
    return ArticleContent(id=article_id, content=lesson['content'] or "")

# --- ОСТАЛЬНЫЕ ЭНДПОИНТЫ (лидерборд, профиль, ранги) ---

@app.get("/api/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard_by_period(
    period: Literal['7d', '30d', 'all'] = '7d',
    user: dict = Depends(get_current_user), 
    db=Depends(get_db_connection)
):
    current_user_id = user.get("id")
    
    interval_map = {'7d': "INTERVAL '7 days'", '30d': "INTERVAL '30 days'"}
    date_filter_sql = f"WHERE m.message_date >= NOW() - {interval_map[period]}" if period in interval_map else ""

    query = f"""
        WITH user_scores AS (
            SELECT
                user_id,
                SUM(points) AS total_score
            FROM messages m
            {date_filter_sql}
            GROUP BY user_id
        ),
        ranked_users AS (
            SELECT
                s.user_id,
                s.total_score,
                cs.first_name,
                cs.last_name,
                cs.username,
                cs.photo_url,
                RANK() OVER (ORDER BY s.total_score DESC, s.user_id) as rank
            FROM user_scores s
            JOIN channel_subscribers cs ON cs.telegram_id = s.user_id
            WHERE cs.is_active = TRUE
        )
        SELECT * FROM ranked_users;
    """
    
    if period == 'all':
        query = """
            SELECT
                telegram_id as user_id,
                first_name,
                last_name,
                username,
                photo_url,
                (message_count * 2) as total_score,
                RANK() OVER (ORDER BY message_count DESC, telegram_id) as rank
            FROM channel_subscribers
            WHERE is_active = TRUE AND message_count > 0;
        """

    cur = db.cursor()
    cur.execute(query)
    all_users = cur.fetchall()
    cur.close()

    top_users = [
        LeaderboardUserRow(
            rank=u['rank'],
            user_id=u['user_id'],
            first_name=u['first_name'],
            last_name=u['last_name'],
            username=u['username'],
            photo_url=u['photo_url'],
            score=u['total_score']
        ) for u in all_users[:20]
    ]

    current_user_data = None
    for u in all_users:
        if u['user_id'] == current_user_id:
            current_user_data = CurrentUserRankInfo(
                rank=u['rank'], 
                user_id=u['user_id'],
                first_name=u['first_name'],
                last_name=u['last_name'],
                username=u['username'],
                photo_url=u['photo_url'],
                score=u['total_score']
            )
            break

    return LeaderboardResponse(top_users=top_users, current_user=current_user_data)

@app.get("/api/me", response_model=UserData)
async def get_me(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT first_name, last_name, username, message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    current_rank_name = get_rank(points)
    current_rank_info = next((r for r in RANKS if r.name == current_rank_name), RANKS[0])
    current_rank_index = RANKS.index(current_rank_info)
    next_rank_info = RANKS[current_rank_index + 1] if current_rank_index + 1 < len(RANKS) else None
    
    points_to_next_rank = None
    progress_percentage = 100
    if next_rank_info:
        points_needed_for_next_rank = next_rank_info.min_points - current_rank_info.min_points
        points_earned_in_current_rank = points - current_rank_info.min_points
        points_to_next_rank = next_rank_info.min_points - points
        if points_needed_for_next_rank > 0:
            progress_percentage = int((points_earned_in_current_rank / points_needed_for_next_rank) * 100)
    
    first_name = db_user['first_name'] if db_user else user.get("first_name")
    last_name = db_user['last_name'] if db_user else user.get("last_name")
    username = db_user['username'] if db_user else user.get("username")

    return UserData(
        id=user_id, 
        first_name=first_name, 
        last_name=last_name,
        username=username, 
        points=points, 
        rank=current_rank_info.name, 
        next_rank_name=next_rank_info.name if next_rank_info else "Max", 
        points_to_next_rank=points_to_next_rank, 
        progress_percentage=progress_percentage
    )

@app.get("/api/ranks", response_model=List[RankInfo])
async def get_all_ranks(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    ranks_list = []
    for i, rank in enumerate(RANKS): 
        ranks_list.append(RankInfo(
            level=i + 1, 
            name=rank.name, 
            min_points=rank.min_points, 
            is_unlocked=(points >= rank.min_points)
        ))
    return ranks_list
