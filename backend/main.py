import os
import hmac
import hashlib
import json
from urllib.parse import unquote, parse_qsl
from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
import psycopg2
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware

# --- Настройки ---
BOT_TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")
# ВАЖНО: Указываем правильный путь к папке с контентом внутри Docker-контейнера
CONTENT_DIR = "/app/content" 

app = FastAPI()

# --- Настройка CORS ---
origins = [
    "https://n8n-karpix-miniapp-karpix.g44y6r.easypanel.host", # URL вашего фронтенда
    "http://localhost:3000", # Для локальной разработки
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Модели данных (Pydantic) ---
class UserRank(BaseModel):
    name: str
    min_points: int

class UserData(BaseModel):
    id: int
    first_name: Optional[str] = None
    username: Optional[str] = None
    points: int
    rank: str

class ArticleInfo(BaseModel):
    id: str
    title: str
    rank_required: int

class ArticleContent(BaseModel):
    id: str
    content: str

class LeaderboardUser(BaseModel):
    first_name: Optional[str] = None
    username: Optional[str] = None
    points: int

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

# --- Утилиты ---
def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL)
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
    return None

async def get_current_user(x_init_data: str = Header(None)):
    if not x_init_data:
         raise HTTPException(status_code=401, detail="X-Init-Data header is missing")
    user_data = validate_init_data(x_init_data, BOT_TOKEN)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid InitData")
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
    leaders = []
    for row in cur.fetchall():
        points = (row[2] or 0) * 2
        leaders.append(LeaderboardUser(first_name=row[0], username=row[1], points=points))
    cur.close()
    return leaders

# --- ИЗМЕНЕННАЯ ЛОГИКА ДЛЯ КОНТЕНТА ---
@app.get("/api/content", response_model=List[ArticleInfo])
async def get_content_list(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    # 1. Получаем ранг текущего пользователя
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()

    points = (db_user[0] * 2) if db_user and db_user[0] is not None else 0
    user_rank_name = get_rank(points)

    # 2. Определяем числовой уровень ранга пользователя
    user_rank_level = 1
    for i, rank_info in enumerate(RANKS):
        if rank_info.name == user_rank_name:
            user_rank_level = i + 1
            break

    # 3. Полный список всех статей в приложении
    all_articles = [
        ArticleInfo(id="article_rank_1", title="👋 Приветственная статья", rank_required=1),
        ArticleInfo(id="article_rank_2", title="🔒 Первый эксклюзив (для Активных)", rank_required=2),
        ArticleInfo(id="article_rank_3", title="💎 Продвинутое руководство (для Ветеранов)", rank_required=3),
        ArticleInfo(id="article_rank_4", title="👑 Секретный контент (для Легенд)", rank_required=4)
    ]

    # 4. Фильтруем статьи по рангу
    available_articles = [
        article for article in all_articles if article.rank_required <= user_rank_level
    ]

    return available_articles
# --- КОНЕЦ ИЗМЕНЕНИЙ ---
    
@app.get("/api/content/{article_id}", response_model=ArticleContent)
async def get_article(article_id: str, user: dict = Depends(get_current_user)):
    # В будущем здесь тоже нужно будет добавить проверку доступа по рангу
    filepath = os.path.join(CONTENT_DIR, f"{article_id}.md")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Article not found")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    return ArticleContent(id=article_id, content=content)
