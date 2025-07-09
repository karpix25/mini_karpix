import os
import hmac
import hashlib
import json
from urllib.parse import unquote, parse_qsl
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import psycopg2
from typing import List, Optional

BOT_TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")
CONTENT_DIR = "/app/content"
app = FastAPI()

class UserRank(BaseModel): name: str; min_points: int
class UserData(BaseModel): id: int; first_name: Optional[str] = None; username: Optional[str] = None; points: int; rank: str
class ArticleInfo(BaseModel): id: str; title: str; rank_required: int
class ArticleContent(BaseModel): id: str; content: str
class LeaderboardUser(BaseModel): first_name: Optional[str] = None; username: Optional[str] = None; points: int; rank: str

RANKS = [UserRank(name="Новичок", min_points=0), UserRank(name="Активный участник", min_points=51), UserRank(name="Ветеран", min_points=201), UserRank(name="Легенда", min_points=501)]
def get_rank(points: int) -> str:
    current_rank = RANKS[0].name
    for rank in RANKS:
        if points >= rank.min_points: current_rank = rank.name
        else: break
    return current_rank

def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL)
    try: yield conn
    finally: conn.close()

def validate_init_data(init_data: str, bot_token: str) -> Optional[dict]:
    try:
        parsed_data = dict(parse_qsl(init_data))
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()) if k != "hash")
        secret_key = hmac.new("WebAppData".encode(), bot_token.encode(), hashlib.sha256).digest()
        h = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256)
        if h.hexdigest() == parsed_data["hash"]: return json.loads(unquote(parsed_data.get("user", "{}")))
    except Exception: return None

async def get_current_user(x_init_data: str = Header(...)):
    user_data = validate_init_data(x_init_data, BOT_TOKEN)
    if not user_data: raise HTTPException(status_code=401, detail="Invalid InitData")
    return user_data

@app.get("/api/me", response_model=UserData)
async def get_me(user: dict = Depends(get_current_user), db=Depends(get_db_connection)):
    user_id = user.get("id")
    cur = db.cursor()
    cur.execute("SELECT first_name, username, message_count FROM channel_subscribers WHERE telegram_id = %s", (user_id,))
    db_user = cur.fetchone()
    cur.close()
    if not db_user: return UserData(id=user_id, first_name=user.get("first_name"), username=user.get("username"), points=0, rank=get_rank(0))
    points = (db_user[2] or 0) * 2
    return UserData(id=user_id, first_name=db_user[0], username=db_user[1], points=points, rank=get_rank(points))

@app.get("/api/leaderboard", response_model=List[LeaderboardUser])
async def get_leaderboard(db=Depends(get_db_connection)):
    cur = db.cursor()
    cur.execute("SELECT first_name, username, message_count FROM channel_subscribers WHERE is_active = TRUE ORDER BY message_count DESC LIMIT 20")
    leaders = [LeaderboardUser(first_name=r[0], username=r[1], points=(r[2] or 0) * 2, rank=get_rank((r[2] or 0) * 2)) for r in cur.fetchall()]
    cur.close()
    return leaders

@app.get("/api/content/{article_id}", response_model=ArticleContent)
async def get_article(article_id: str):
    filepath = os.path.join(CONTENT_DIR, f"{article_id}.md")
    if not os.path.exists(filepath): raise HTTPException(status_code=404, detail="Article not found")
    with open(filepath, 'r', encoding='utf-8') as f: content = f.read()
    return ArticleContent(id=article_id, content=content)