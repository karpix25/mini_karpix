import os
import hmac
import hashlib
import json
import glob
from urllib.parse import unquote, parse_qsl
from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
import psycopg2
from typing import List, Optional, Literal
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor

# --- Настройки ---
BOT_TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")
CONTENT_DIR = "/app/content" 

app = FastAPI()

# --- Настройка CORS ---
origins = [
    "https://minifront.karpix.com",
    "https://n8n-karpix-miniapp-karpix.g44y6r.easypanel.host",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Обновленные модели данных ---
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

# НОВЫЕ МОДЕЛИ ДЛЯ КУРСОВ
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

async def get_current_user(x_init_data: str = Header(None)):
    if not x_init_data: 
        raise HTTPException(status_code=401, detail="X-Init-Data header is missing")
    user_data = validate_init_data(x_init_data, BOT_TOKEN)
    if not user_data: 
        raise HTTPException(status_code=401, detail="Invalid InitData")
    return user_data

# --- НОВЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С КУРСАМИ ---

def load_course_metadata(course_path: str) -> dict:
    """Загружает метаданные курса из course.json"""
    metadata_file = os.path.join(course_path, "course.json")
    if os.path.exists(metadata_file):
        try:
            with open(metadata_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"ERROR: Failed to load course.json from {metadata_file}: {e}")
    
    # Fallback для старых статей
    course_id = os.path.basename(course_path)
    return {
        "title": f"Курс {course_id}",
        "description": "Описание курса",
        "rank_required": 1,
        "sections": [
            {
                "id": "main",
                "title": "Основной раздел", 
                "lessons": []
            }
        ]
    }

def scan_course_lessons(course_path: str, sections: list) -> list:
    """Сканирует уроки в курсе и обновляет секции"""
    updated_sections = []
    
    for section in sections:
        section_path = os.path.join(course_path, section["id"])
        lessons = []
        
        if os.path.exists(section_path):
            # Ищем .md файлы в папке секции
            for md_file in glob.glob(os.path.join(section_path, "*.md")):
                lesson_id = os.path.splitext(os.path.basename(md_file))[0]
                
                # Читаем заголовок из первой строки
                try:
                    with open(md_file, 'r', encoding='utf-8') as f:
                        first_line = f.readline().strip()
                        title = first_line.lstrip('#').strip() if first_line.startswith('#') else lesson_id
                except Exception as e:
                    print(f"ERROR: Failed to read {md_file}: {e}")
                    title = lesson_id
                
                lessons.append({
                    "id": lesson_id,
                    "title": title
                })
        
        updated_sections.append({
            "id": section["id"],
            "title": section["title"],
            "lessons": lessons
        })
    
    return updated_sections

# --- НОВЫЕ ЭНДПОИНТЫ ДЛЯ КУРСОВ ---

@app.get("/api/courses", response_model=List[CourseInfo])
async def get_courses(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    """Получить список всех доступных курсов"""
    user_id = user.get("id")
    print(f"DEBUG: Getting courses for user {user_id}")
    
    # Получаем данные пользователя
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    user_rank_level = get_rank_level(points)
    
    print(f"DEBUG: User points: {points}, rank level: {user_rank_level}")
    print(f"DEBUG: Content directory: {CONTENT_DIR}")
    
    courses = []
    
    # Проверяем существование папки content
    if not os.path.exists(CONTENT_DIR):
        print(f"ERROR: Content directory {CONTENT_DIR} does not exist")
        return courses
    
    # Ищем папки курсов
    try:
        items = os.listdir(CONTENT_DIR)
        print(f"DEBUG: Items in content directory: {items}")
        
        for item in items:
            course_path = os.path.join(CONTENT_DIR, item)
            print(f"DEBUG: Checking item: {item}, path: {course_path}")
            
            if os.path.isdir(course_path):
                print(f"DEBUG: Found directory: {item}")
                
                # Загружаем метаданные курса
                metadata = load_course_metadata(course_path)
                print(f"DEBUG: Loaded metadata for {item}: {metadata}")
                
                # Проверяем доступ
                course_rank_required = metadata.get("rank_required", 1)
                print(f"DEBUG: Course {item} requires rank {course_rank_required}, user has level {user_rank_level}")
                
                if course_rank_required <= user_rank_level:
                    # Подсчитываем уроки
                    sections = scan_course_lessons(course_path, metadata.get("sections", []))
                    total_lessons = sum(len(section["lessons"]) for section in sections)
                    
                    print(f"DEBUG: Course {item} has {total_lessons} lessons")
                    
                    courses.append(CourseInfo(
                        id=item,
                        title=metadata.get("title", item),
                        description=metadata.get("description", ""),
                        rank_required=metadata.get("rank_required", 1),
                        progress=0,  # TODO: Добавить реальный прогресс
                        total_lessons=total_lessons,
                        completed_lessons=0  # TODO: Добавить реальный прогресс
                    ))
                else:
                    print(f"DEBUG: Course {item} not accessible - rank {course_rank_required} > user level {user_rank_level}")
    except Exception as e:
        print(f"ERROR: Failed to scan courses: {e}")
    
    print(f"DEBUG: Returning {len(courses)} courses")
    return courses

@app.get("/api/courses/{course_id}", response_model=CourseDetail)
async def get_course_detail(course_id: str, user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    """Получить детальную информацию о курсе"""
    user_id = user.get("id")
    course_path = os.path.join(CONTENT_DIR, course_id)
    
    print(f"DEBUG: Getting course detail for {course_id}, path: {course_path}")
    
    if not os.path.exists(course_path):
        print(f"ERROR: Course path {course_path} does not exist")
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Проверяем доступ пользователя
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    user_rank_level = get_rank_level(points)
    
    # Загружаем метаданные
    metadata = load_course_metadata(course_path)
    
    if metadata.get("rank_required", 1) > user_rank_level:
        raise HTTPException(status_code=403, detail="Недостаточно прав для доступа к курсу")
    
    # Сканируем уроки
    sections = scan_course_lessons(course_path, metadata.get("sections", []))
    
    return CourseDetail(
        id=course_id,
        title=metadata.get("title", course_id),
        description=metadata.get("description", ""),
        rank_required=metadata.get("rank_required", 1),
        sections=sections,
        progress=0  # TODO: Добавить реальный прогресс
    )

@app.get("/api/courses/{course_id}/lessons/{lesson_id}", response_model=LessonContent)
async def get_lesson_content(course_id: str, lesson_id: str, user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    """Получить содержимое конкретного урока"""
    user_id = user.get("id")
    course_path = os.path.join(CONTENT_DIR, course_id)
    
    print(f"DEBUG: Getting lesson {lesson_id} from course {course_id}")
    
    if not os.path.exists(course_path):
        raise HTTPException(status_code=404, detail="Курс не найден")
    
    # Проверяем доступ
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    user_rank_level = get_rank_level(points)
    
    metadata = load_course_metadata(course_path)
    if metadata.get("rank_required", 1) > user_rank_level:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    # Ищем файл урока
    lesson_file = None
    section_id = None
    
    for section in metadata.get("sections", []):
        section_path = os.path.join(course_path, section["id"])
        potential_file = os.path.join(section_path, f"{lesson_id}.md")
        
        if os.path.exists(potential_file):
            lesson_file = potential_file
            section_id = section["id"]
            break
    
    if not lesson_file:
        raise HTTPException(status_code=404, detail="Урок не найден")
    
    # Читаем содержимое
    try:
        with open(lesson_file, 'r', encoding='utf-8') as f:
            content = f.read()
            # Извлекаем заголовок из первой строки
            lines = content.split('\n')
            title = lines[0].lstrip('#').strip() if lines and lines[0].startswith('#') else lesson_id
    except Exception as e:
        print(f"ERROR: Failed to read lesson file {lesson_file}: {e}")
        raise HTTPException(status_code=500, detail="Ошибка чтения файла урока")
    
    return LessonContent(
        id=lesson_id,
        title=title,
        content=content,
        course_id=course_id,
        section_id=section_id
    )

# --- СТАРЫЕ ЭНДПОИНТЫ (для обратной совместимости) ---

@app.get("/api/content", response_model=List[ArticleInfo])
async def get_content_list_legacy(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    """Старый эндпоинт для обратной совместимости"""
    user_id = user.get("id")
    print(f"DEBUG: User ID: {user_id}")
    
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    user_rank_level = get_rank_level(points)
    
    print(f"DEBUG: User points: {points}, rank level: {user_rank_level}")
    
    # Ищем старые .md файлы в корне
    available_articles = []
    search_path = os.path.join(CONTENT_DIR, "*.md")
    print(f"DEBUG: Searching in: {search_path}")
    
    found_files = glob.glob(search_path)
    print(f"DEBUG: Found files: {found_files}")
    
    for filepath in found_files:
        filename = os.path.basename(filepath)
        print(f"DEBUG: Processing file: {filename}")
        try:
            parts = filename.split('__')
            if len(parts) >= 2:
                rank_required = int(parts[0])
                article_id = parts[1].replace('.md', '')
                print(f"DEBUG: File requires rank {rank_required}, article_id: {article_id}")
                
                if rank_required <= user_rank_level:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        title = f.readline().strip().lstrip('#').strip()
                    print(f"DEBUG: Article accessible: {article_id} - {title}")
                    available_articles.append(ArticleInfo(
                        id=article_id, 
                        title=title, 
                        rank_required=rank_required
                    ))
                else:
                    print(f"DEBUG: Article NOT accessible: rank {rank_required} > user level {user_rank_level}")
        except (ValueError, IndexError) as e:
            print(f"DEBUG: Error processing {filename}: {e}")
            continue
    
    available_articles.sort(key=lambda x: x.rank_required)
    print(f"DEBUG: Final articles list: {[a.id for a in available_articles]}")
    return available_articles

@app.get("/api/content/{article_id}", response_model=ArticleContent)
async def get_article_legacy(article_id: str, user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    """Старый эндпоинт для обратной совместимости"""
    user_id = user.get("id")
    
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    user_rank_level = get_rank_level(points)
    
    # Ищем файл статьи
    search_pattern = os.path.join(CONTENT_DIR, f"*__{article_id}.md")
    found_files = glob.glob(search_pattern)
    
    if not found_files:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    
    found_path = found_files[0]
    filename = os.path.basename(found_path)
    
    try: 
        target_rank_required = int(filename.split('__')[0])
    except (ValueError, IndexError): 
        raise HTTPException(status_code=500, detail="Invalid file name")
    
    if user_rank_level < target_rank_required: 
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    with open(found_path, 'r', encoding='utf-8') as f: 
        content = f.read()
    
    return ArticleContent(id=article_id, content=content)

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
