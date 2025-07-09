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

class ArticleInfo(BaseModel): 
    id: str
    title: str
    rank_required: int

class ArticleContent(BaseModel): 
    id: str
    content: str

# ОБНОВЛЕННЫЕ МОДЕЛИ ДЛЯ ЛИДЕРБОРДА С НОВЫМИ ПОЛЯМИ
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

# --- ОБНОВЛЕННЫЙ ЭНДПОИНТ ЛИДЕРБОРДА ---
@app.get("/api/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard_by_period(
    period: Literal['7d', '30d', 'all'] = '7d',
    user: dict = Depends(get_current_user), 
    db=Depends(get_db_connection)
):
    current_user_id = user.get("id")
    
    # Определяем временной интервал для SQL-запроса
    interval_map = {'7d': "INTERVAL '7 days'", '30d': "INTERVAL '30 days'"}
    date_filter_sql = f"WHERE m.message_date >= NOW() - {interval_map[period]}" if period in interval_map else ""

    # SQL-запрос с новыми полями
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
    
    # Для режима 'all' используется данные из channel_subscribers
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

    # Формируем список топ-20 пользователей с новыми полями
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

    # Ищем данные о текущем пользователе
    current_user_data = None
    for u in all_users:
        if u['user_id'] == current_user_id:
            current_user_data = CurrentUserRankInfo(rank=u['rank'], score=u['total_score'])
            break

    return LeaderboardResponse(top_users=top_users, current_user=current_user_data)

# --- ОБНОВЛЕННЫЙ ЭНДПОИНТ ПРОФИЛЯ ---
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

@app.get("/api/content", response_model=List[ArticleInfo])
async def get_content_list(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    user_id = user.get("id")
    print(f"DEBUG: User ID: {user_id}")
    
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    print(f"DEBUG: User points: {points}")
    
    user_rank_name = get_rank(points)
    user_rank_level = 1
    for i, rank_info in enumerate(RANKS):
        if rank_info.name == user_rank_name: 
            user_rank_level = i + 1
            break
    
    print(f"DEBUG: User rank: {user_rank_name}, level: {user_rank_level}")
    
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
            rank_required = int(parts[0])
            article_id = parts[1].replace('.md', '')
            print(f"DEBUG: File requires rank {rank_required}, article_id: {article_id}")
            
            if rank_required <= user_rank_level:
                with open(filepath, 'r', encoding='utf-8') as f:
                    title = f.readline().strip().lstrip('#').strip()
                print(f"DEBUG: Article accessible: {article_id} - {title}")
                available_articles.append(ArticleInfo(id=article_id, title=title, rank_required=rank_required))
            else:
                print(f"DEBUG: Article NOT accessible: rank {rank_required} > user level {user_rank_level}")
        except (ValueError, IndexError) as e:
            print(f"DEBUG: Error processing {filename}: {e}")
            continue
    
    available_articles.sort(key=lambda x: x.rank_required)
    print(f"DEBUG: Final articles list: {[a.id for a in available_articles]}")
    return available_articles

@app.get("/api/content/{article_id}", response_model=ArticleContent)
async def get_article(article_id: str, user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    points = (db_user['message_count'] * 2) if db_user and db_user['message_count'] is not None else 0
    user_rank_name = get_rank(points)
    user_rank_level = 1
    for i, rank_info in enumerate(RANKS):
        if rank_info.name == user_rank_name: 
            user_rank_level = i + 1
            break
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
    if user_rank_level < target_rank_required: 
        raise HTTPException(status_code=403, detail="You do not have high enough rank to view this content")
    with open(found_path, 'r', encoding='utf-8') as f: 
        content = f.read()
    return ArticleContent(id=article_id, content=content)

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
