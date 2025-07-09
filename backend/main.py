### НАЧАЛО ОТЛАДОЧНОГО КОДА ДЛЯ main.py ###

import os
import hmac
import hashlib
import json
from urllib.parse import unquote, parse_qsl
from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List

from fastapi.middleware.cors import CORSMiddleware

# --- Настройки ---
BOT_TOKEN = os.getenv("BOT_TOKEN")

app = FastAPI()

# --- МАКСИМАЛЬНО ПРОСТАЯ НАСТРОЙКА CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Утилиты (оставляем только то, что нужно) ---
def validate_init_data(init_data: str, bot_token: str) -> Optional[dict]:
    try:
        parsed_data = dict(parse_qsl(init_data))
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()) if k != "hash")
        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        h = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256)
        if h.hexdigest() == parsed_data["hash"]: return json.loads(unquote(parsed_data.get("user", "{}")))
    except Exception: return None

async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header is missing")
    try:
        scheme, init_data = authorization.split()
        if scheme.lower() != 'tma': raise ValueError("Invalid scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization scheme")
    
    user_data = validate_init_data(init_data, BOT_TOKEN)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid InitData")
    return user_data

# --- Эндпоинты API ---

class DebugResponse(BaseModel):
    status: str
    user_id: int

# --- УПРОЩЕННЫЙ ЭНДПОИНТ ДЛЯ ТЕСТА ---
@app.get("/api/leaderboard", response_model=DebugResponse)
async def get_leaderboard_debug(user: dict = Depends(get_current_user)):
    # Этот эндпоинт НЕ лезет в базу данных.
    # Он просто проверяет авторизацию и возвращает "ok".
    return {"status": "ok", "user_id": user.get("id")}

### КОНЕЦ ОТЛАДОЧНОГО КОДА ###```

#### Шаг 2: Перезапустите бэкенд

1.  Сохраните изменения на GitHub ("Commit changes").
2.  Перейдите в **EasyPanel** и нажмите **"Redeploy"** для сервиса **`backend`**.
3.  Дождитесь завершения.

#### Шаг 3: Проверьте результат во вкладке "Сеть"

1.  **Полностью перезапустите Telegram Desktop.**
2.  Откройте ваше Mini App в режиме отладки (правый клик -> Inspect).
3.  Перейдите на вкладку **"Network"** (Сеть).
4.  Вы должны снова увидеть красную ошибку в консоли, **но это не страшно**.
5.  На вкладке "Network" найдите запрос `leaderboard?period=7d`. Он будет красным. **Кликните на него.**
6.  Справа откроется панель. Перейдите в ней на вкладку **"Response" (Ответ)**.

### Что вы должны увидеть во вкладке "Response":

*   **Если мы победили:** Вы увидите простой JSON-ответ:
    ```json
    {"status": "ok", "user_id": 12345678} 
    ```
    (где 12345678 - ваш ID).
    Если вы видите это, значит, **СВЯЗЬ УСТАНОВЛЕНА**, и мы можем вернуть в бэкенд сложную логику.

*   **Если проблема осталась:** Вы снова увидите ошибку 404 или что-то другое.

Пожалуйста, пришлите скриншот именно вкладки **"Response"** для запроса `leaderboard`. Это наш финальный тест.
