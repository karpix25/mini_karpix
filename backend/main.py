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

# --- ИСПРАВЛЕННАЯ Настройка CORS ---
# Правильная конфигурация, которая разрешает запросы от вашего нового фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://minifront.karpix.com", # Ваш новый домен фронтенда
        "http://localhost:3000"     # Для локальной разработки
    ],
    allow_credentials=True,
    allow_methods=["*"], # Разрешаем ВСЕ методы (GET, POST, и важный для нас OPTIONS)
    allow_headers=["*"], # Разрешаем ВСЕ заголовки (включая X-Init-Data)
)

# --- Модели данных ---
class UserRank(BaseModel): name: str; min_points: int
class UserData(BaseModel): id: int; first_name: Optional[str] = None; username: Optional[str] = None; points: int; rank: str; next_rank_name: Optional[str] = None; points_to_next_rank: Optional[int] = None; progress_percentage: int
class RankInfo(BaseModel): level: int; name: str; min_points: int; is_unlocked: bool
class ArticleInfo(BaseModel): id: str; title: str; rank_required: int
class ArticleContent(BaseModel): id: str; content: str
# Старая модель для /api/leaderboard
class LeaderboardUser(BaseModel): first_name: Optional[str] = None; username: Optional[str] = None; points: int

# --- Логика Рангов ---
RANKS = [
    UserRank(name="Новичок", min_points=0),
    UserRank(name="Активный участник", min_points=51),
    UserRank(name="Ветеран", min_points=201),
    UserRank(name="Легенда", min_points=501),
]
def get_rank(points: int) -> str:
    for rank in reversed(RANKS):
        if points >= rank.min_points: return rank.name
    return RANKS[0].name

# --- Утилиты ---
def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
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

# --- ВАША СТАРАЯ, РАБОЧАЯ ФУНКЦИЯ АВТОРИЗАЦИИ ---
# Мы возвращаемся к ней, чтобы ничего не сломать
async def get_current_user(x_init_data: str = Header(None)):
    if not x_init_data: raise HTTPException(status_code=401, detail="X-Init-Data header is missing")
    user_data = validate_init_data(x_init_data, BOT_TOKEN)
    if not user_data: raise HTTPException(status_code=401, detail="Invalid InitData")
    return user_data

# --- Эндпоинты API, которые у вас уже РАБОТАЛИ ---

@app.get("/api/me", response_model=UserData)
async def get_me(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT first_name, username, message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    points = (db_user['message_count'] * 2) if db_user and db_user.get('message_count') else 0
    current_rank_name = get_rank(points)
    current_rank_info = next((r for r in RANKS if r.name == current_rank_name), RANKS[0])
    current_rank_index = RANKS.index(current_rank_info)
    next_rank_info = RANKS[current_rank_index + 1] if current_rank_index + 1 < len(RANKS) else None
    points_to_next_rank = next_rank_info.min_points - points if next_rank_info else None
    progress_percentage = 100
    if next_rank_info:
        points_needed = next_rank_info.min_points - current_rank_info.min_points
        points_earned = points - current_rank_info.min_points
        if points_needed > 0: progress_percentage = int((points_earned / points_needed) * 100)
    
    return UserData(id=user_id, first_name=(db_user['first_name'] if db_user else user.get("first_name")), username=(db_user['username'] if db_user else user.get("username")), points=points, rank=current_rank_info.name, next_rank_name=(next_rank_info.name if next_rank_info else "Max"), points_to_next_rank=points_to_next_rank, progress_percentage=progress_percentage)

@app.get("/api/leaderboard", response_model=List[LeaderboardUser])
async def get_leaderboard(db=Depends(get_db_connection)):
    # Этот эндпоинт не использует авторизацию, поэтому он не ломался
    cur = db.cursor()
    cur.execute("SELECT first_name, username, message_count FROM channel_subscribers WHERE is_active = TRUE ORDER BY message_count DESC LIMIT 20")
    leaders = [LeaderboardUser(first_name=r['first_name'], username=r['username'], points=(r['message_count'] or 0) * 2) for r in cur.fetchall()]
    cur.close()
    return leaders

@app.get("/api/content", response_model=List[ArticleInfo])
async def get_content_list(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    points = (db_user['message_count'] * 2) if db_user and db_user.get('message_count') else 0
    user_rank_name = get_rank(points)
    user_rank_level = next((i + 1 for i, r in enumerate(RANKS) if r.name == user_rank_name), 1)
    available_articles = []
    for filepath in glob.glob(os.path.join(CONTENT_DIR, "*.md")):
        filename = os.path.basename(filepath)
        try:
            rank_required = int(filename.split('__')[0])
            if rank_required <= user_rank_level:
                with open(filepath, 'r', encoding='utf-8') as f: title = f.readline().strip().lstrip('#').strip()
                available_articles.append(ArticleInfo(id=filename.split('__')[1].replace('.md', ''), title=title, rank_required=rank_required))
        except (ValueError, IndexError): continue
    return sorted(available_articles, key=lambda x: x.rank_required)

@app.get("/api/content/{article_id}", response_model=ArticleContent)
async def get_article(article_id: str, user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    points = (db_user['message_count'] * 2) if db_user and db_user.get('message_count') else 0
    user_rank_level = next((i + 1 for i, r in enumerate(RANKS) if r.name == get_rank(points)), 1)
    found_files = glob.glob(os.path.join(CONTENT_DIR, f"*__{article_id}.md"))
    if not found_files: raise HTTPException(status_code=404, detail="Article not found")
    try:
        if user_rank_level < int(os.path.basename(found_files[0]).split('__')[0]): raise HTTPException(status_code=403, detail="Rank not high enough")
    except (ValueError, IndexError): raise HTTPException(status_code=500, detail="Invalid file format on server")
    with open(found_files[0], 'r', encoding='utf-8') as f: content = f.read()
    return ArticleContent(id=article_id, content=content)

@app.get("/api/ranks", response_model=List[RankInfo])
async def get_all_ranks(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    points = (db_user['message_count'] * 2) if db_user and db_user.get('message_count') else 0
    return [RankInfo(level=i + 1, name=r.name, min_points=r.min_points, is_unlocked=(points >= r.min_points)) for i, r in enumerate(RANKS)]

# ЗДЕСЬ МЫ БЕЗОПАСНО ДОБАВЛЯЕМ НОВЫЙ ЛИДЕРБОРД, НЕ ТРОГАЯ СТАРЫЙ

class LeaderboardUserV2(BaseModel): rank: int; user_id: int; first_name: Optional[str] = None; username: Optional[str] = None; score: int
class CurrentUserRankV2(BaseModel): rank: int; score: int
class LeaderboardResponseV2(BaseModel): top_users: List[LeaderboardUserV2]; current_user: Optional[CurrentUserRankV2] = None

@app.get("/api/v2/leaderboard", response_model=LeaderboardResponseV2, tags=["V2"])
async def get_leaderboard_v2(
    period: Literal['7d', '30d', 'all'] = '7d',
    user: dict = Depends(get_current_user), # Используем вашу РАБОЧУЮ авторизацию!
    db=Depends(get_db_connection)
):
    current_user_id = user.get("id")
    if period == 'all':
        query = "SELECT telegram_id as user_id, first_name, username, (message_count * 2) as score, RANK() OVER (ORDER BY message_count DESC, telegram_id) as rank FROM channel_subscribers WHERE is_active = TRUE;"
    else:
        interval_sql = f"INTERVAL '{'7 days' if period == '7d' else '30 days'}'"
        query = f"WITH user_scores AS (SELECT user_id, SUM(points) AS score FROM messages WHERE message_date >= NOW() - {interval_sql} GROUP BY user_id) SELECT s.user_id, s.score, cs.first_name, cs.username, RANK() OVER (ORDER BY s.score DESC, s.user_id) as rank FROM user_scores s JOIN channel_subscribers cs ON cs.telegram_id = s.user_id;"
    
    cur = db.cursor()
    cur.execute(query)
    all_users = cur.fetchall()
    cur.close()

    top_users = [LeaderboardUserV2(**u) for u in all_users[:20]]
    current_user_data = next((CurrentUserRankV2(**u) for u in all_users if u['user_id'] == current_user_id), None)

    return LeaderboardResponseV2(top_users=top_users, current_user=current_user_data)
