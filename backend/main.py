import os
import hmac
import hashlib
import json
import glob  # Добавляем этот импорт для сканирования файлов
from urllib.parse import unquote, parse_qsl
from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
import psycopg2
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware

# --- Настройки ---
BOT_TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")
CONTENT_DIR = "/app/content" 

app = FastAPI()

# --- Настройка CORS ---
origins = [
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

# --- Модели данных (Pydantic) ---
class UserRank(BaseModel): name: str; min_points: int
class UserData(BaseModel): id: int; first_name: Optional[str] = None; username: Optional[str] = None; points: int; rank: str
class ArticleInfo(BaseModel): id: str; title: str; rank_required: int
class ArticleContent(BaseModel): id: str; content: str
class LeaderboardUser(BaseModel): first_name: Optional[str] = None; username: Optional[str] = None; points: int

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
        if points >= rank.min_points: return rank.name
    return current_rank

# --- Утилиты ---
def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL)
    try: yield conn
    finally: conn.close()

def validate_init_data(init_data: str, bot_token: str) -> Optional[dict]:
    try:
        parsed_data = dict(parse_qsl(init_data))
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()) if k != "hash")
        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        h = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256)
        if h.hexdigest() == parsed_data["hash"]: return json.loads(unquote(parsed_data.get("user", "{}")))
    except Exception: return None

async def get_current_user(x_init_data: str = Header(None)):
    if not x_init_data: raise HTTPException(status_code=401, detail="X-Init-Data header is missing")
    user_data = validate_init_data(x_init_data, BOT_TOKEN)
    if not user_data: raise HTTPException(status_code=401, detail="Invalid InitData")
    return user_data

# --- Эндпоинты API ---

@app.get("/api/me", response_model=UserData)
async def get_me(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT first_name, username, message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    points = (db_user[2] * 2) if db_user and db_user[2] is not None else 0
    rank = get_rank(points)
    first_name = db_user[0] if db_user else user.get("first_name")
    username = db_user[1] if db_user else user.get("username")
    return UserData(id=user_id, first_name=first_name, username=username, points=points, rank=rank)

@app.get("/api/leaderboard", response_model=List[LeaderboardUser])
async def get_leaderboard(db=Depends(get_db_connection)):
    cur = db.cursor()
    cur.execute("SELECT first_name, username, message_count FROM channel_subscribers WHERE is_active = TRUE ORDER BY message_count DESC LIMIT 20")
    leaders = [LeaderboardUser(first_name=r[0], username=r[1], points=(r[2] or 0) * 2) for r in cur.fetchall()]
    cur.close()
    return leaders

# --- НОВАЯ АВТОМАТИЧЕСКАЯ ЛОГИКА ДЛЯ КОНТЕНТА ---
@app.get("/api/content", response_model=List[ArticleInfo])
async def get_content_list(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    # 1. Определяем числовой уровень ранга пользователя
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    points = (db_user[0] * 2) if db_user and db_user[0] is not None else 0
    user_rank_name = get_rank(points)
    user_rank_level = 1
    for i, rank_info in enumerate(RANKS):
        if rank_info.name == user_rank_name:
            user_rank_level = i + 1
            break

    # 2. Сканируем папку с контентом и формируем список доступных статей
    available_articles = []
    # Ищем все файлы, соответствующие шаблону *.md в папке CONTENT_DIR
    for filepath in glob.glob(os.path.join(CONTENT_DIR, "*.md")):
        filename = os.path.basename(filepath)
        try:
            # Пытаемся распарсить имя файла, например "2__first-exclusive.md"
            parts = filename.split('__')
            rank_required = int(parts[0])
            article_id = parts[1].replace('.md', '')

            # Проверяем, доступна ли статья пользователю
            if rank_required <= user_rank_level:
                # Читаем первую строку файла, чтобы получить заголовок
                with open(filepath, 'r', encoding='utf-8') as f:
                    # Убираем '#' и лишние пробелы в начале/конце
                    title = f.readline().strip().lstrip('#').strip()
                
                available_articles.append(
                    ArticleInfo(id=article_id, title=title, rank_required=rank_required)
                )
        except (ValueError, IndexError):
            # Если имя файла не соответствует формату, просто игнорируем его
            print(f"Warning: Skipping file with incorrect name format: {filename}")
            continue
    
    # Сортируем статьи по требуемому рангу
    available_articles.sort(key=lambda x: x.rank_required)
    
    return available_articles

# --- НОВАЯ АВТОМАТИЧЕСКАЯ ЛОГИКА ДЛЯ ПОЛУЧЕНИЯ СТАТЬИ ---
@app.get("/api/content/{article_id}", response_model=ArticleContent)
async def get_article(article_id: str, user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    # Тут тоже нужно проверить доступ по рангу, чтобы пользователь не мог получить статью по прямой ссылке
    # (этот код повторяет логику из get_content_list)
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    points = (db_user[0] * 2) if db_user and db_user[0] is not None else 0
    user_rank_name = get_rank(points)
    user_rank_level = 1
    for i, rank_info in enumerate(RANKS):
        if rank_info.name == user_rank_name:
            user_rank_level = i + 1
            break

    # Ищем файл, который соответствует запрошенному ID
    found_path = None
    target_rank_required = 0
    # Ищем файл с нужным ID, например, *__welcome.md
    search_pattern = os.path.join(CONTENT_DIR, f"*__{article_id}.md")
    found_files = glob.glob(search_pattern)

    if found_files:
        found_path = found_files[0]
        try:
            filename = os.path.basename(found_path)
            target_rank_required = int(filename.split('__')[0])
        except (ValueError, IndexError):
             raise HTTPException(status_code=500, detail="Invalid file name on server")
    else:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Проверяем, есть ли у пользователя доступ
    if user_rank_level < target_rank_required:
        raise HTTPException(status_code=403, detail="You do not have high enough rank to view this content")

    # Если доступ есть, отдаем контент
    with open(found_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return ArticleContent(id=article_id, content=content)
