import os
import hmac
import hashlib
import json
import glob
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
class UserRank(BaseModel):
    name: str
    min_points: int

class UserData(BaseModel):
    id: int
    first_name: Optional[str] = None
    username: Optional[str] = None
    points: int
    rank: str
    # --- Новые поля ---
    next_rank_name: Optional[str] = None
    points_to_next_rank: Optional[int] = None
    progress_percentage: int

class RankInfo(BaseModel):
    level: int
    name: str
    min_points: int
    is_unlocked: bool

# ... остальные модели (ArticleInfo, LeaderboardUser) остаются без изменений
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

# VVVVVV  ЗАМЕНИТЕ СТАРУЮ ФУНКЦИЮ GET_ME НА ЭТУ  VVVVVV
@app.get("/api/me", response_model=UserData)
async def get_me(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT first_name, username, message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    
    points = (db_user[0] * 2) if db_user and db_user[0] is not None else 0
    
    # Определяем текущий и следующий ранг
    current_rank_info = RANKS[0]
    next_rank_info = None
    for i, rank in enumerate(RANKS):
        if points >= rank.min_points:
            current_rank_info = rank
            if i + 1 < len(RANKS):
                next_rank_info = RANKS[i+1]
            else:
                next_rank_info = None # Это максимальный ранг
        else:
            break
    
    # Рассчитываем прогресс до следующего уровня
    points_to_next_rank = None
    progress_percentage = 100
    if next_rank_info:
        points_needed_for_next_rank = next_rank_info.min_points - current_rank_info.min_points
        points_earned_in_current_rank = points - current_rank_info.min_points
        points_to_next_rank = next_rank_info.min_points - points
        if points_needed_for_next_rank > 0:
            progress_percentage = int((points_earned_in_current_rank / points_needed_for_next_rank) * 100)

    first_name = db_user[0] if db_user else user.get("first_name")
    username = db_user[1] if db_user else user.get("username")

    return UserData(
        id=user_id,
        first_name=first_name,
        username=username,
        points=points,
        rank=current_rank_info.name,
        next_rank_name=next_rank_info.name if next_rank_info else None,
        points_to_next_rank=points_to_next_rank,
        progress_percentage=progress_percentage
    )
# ^^^^^^ КОНЕЦ ЗАМЕНЫ ^^^^^^

@app.get("/api/leaderboard", response_model=List[LeaderboardUser])
async def get_leaderboard(db=Depends(get_db_connection)):
    cur = db.cursor()
    cur.execute("SELECT first_name, username, message_count FROM channel_subscribers WHERE is_active = TRUE ORDER BY message_count DESC LIMIT 20")
    leaders = [LeaderboardUser(first_name=r[0], username=r[1], points=(r[2] or 0) * 2) for r in cur.fetchall()]
    cur.close()
    return leaders

# --- ЛОГИКА ДЛЯ КОНТЕНТА С ОТЛАДОЧНОЙ ИНФОРМАЦИЕЙ ---
@app.get("/api/content", response_model=List[ArticleInfo])
async def get_content_list(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    # --- БЛОК 1: ОПРЕДЕЛЕНИЕ РАНГА ---
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
    
    # DEBUG: Выводим информацию о пользователе в лог
    print(f"--- DEBUG INFO FOR USER {user_id} ---")
    print(f"Points: {points}, Rank Name: '{user_rank_name}', Rank Level: {user_rank_level}")
    
    # --- БЛОК 2: СКАНИРОВАНИЕ ПАПКИ ---
    available_articles = []
    search_path = os.path.join(CONTENT_DIR, "*.md")
    
    # DEBUG: Выводим путь, по которому ищем файлы
    print(f"Scanning for files in: {search_path}")
    
    found_files = glob.glob(search_path)
    
    # DEBUG: Выводим список всех найденных файлов
    print(f"Found files: {found_files}")

    for filepath in found_files:
        filename = os.path.basename(filepath)
        # DEBUG: Обрабатываем каждый найденный файл
        print(f"Processing file: {filename}")
        try:
            parts = filename.split('__')
            rank_required = int(parts[0])
            article_id = parts[1].replace('.md', '')

            if rank_required <= user_rank_level:
                with open(filepath, 'r', encoding='utf-8') as f:
                    title = f.readline().strip().lstrip('#').strip()
                available_articles.append(
                    ArticleInfo(id=article_id, title=title, rank_required=rank_required)
                )
                # DEBUG: Сообщаем об успешном добавлении статьи
                print(f"  -> SUCCESS: Added article '{title}' for rank {rank_required}")
            else:
                # DEBUG: Сообщаем, почему статья пропущена
                print(f"  -> SKIPPED: User rank ({user_rank_level}) is less than required ({rank_required})")

        except (ValueError, IndexError):
            # DEBUG: Сообщаем об ошибке формата имени файла
            print(f"  -> FAILED: Incorrect file name format. Skipping.")
            continue
    
    available_articles.sort(key=lambda x: x.rank_required)
    
    print("--- DEBUG END ---")
    return available_articles

# --- ЛОГИКА ДЛЯ ПОЛУЧЕНИЯ СТАТЬИ С ОТЛАДОЧНОЙ ИНФОРМАЦИЕЙ ---
@app.get("/api/content/{article_id}", response_model=ArticleContent)
async def get_article(article_id: str, user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
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

# VVVVVV  ДОБАВЬТЕ ЭТОТ НОВЫЙ ЭНДПОИНТ В КОНЕЦ ФАЙЛА  VVVVVV
@app.get("/api/ranks", response_model=List[RankInfo])
async def get_all_ranks(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    # Получаем текущие очки пользователя, чтобы знать, какие ранги разблокированы
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    points = (db_user[2] * 2) if db_user and db_user[2] is not None else 0

    # Формируем список всех рангов с информацией о разблокировке
    ranks_list = []
    for i, rank in enumerate(RANKS):
        ranks_list.append(RankInfo(
            level=i + 1,
            name=rank.name,
            min_points=rank.min_points,
            is_unlocked=(points >= rank.min_points)
        ))
    return ranks_list
# ^^^^^^ КОНЕЦ ДОБАВЛЕНИЯ ^^^^^^
