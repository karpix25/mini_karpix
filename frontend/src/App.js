import React, { useEffect, useState } from 'react';
import './App.css';

// URL вашего бэкенда.
const BACKEND_URL = "https://n8n-karpix-miniapp-karpix-backeng.g44y6r.easypanel.host"; 

// Безопасно получаем объект Telegram Web App
const tg = window.Telegram?.WebApp;

function App() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Сообщаем Telegram, что приложение готово, только если мы в Telegram
    if (tg) {
        tg.ready();
    }
    
    const fetchUserData = async () => {
      try {
        // Проверяем, есть ли initData. Если нет - показываем ошибку.
        if (!tg?.initData) {
          throw new Error("Это приложение предназначено для работы внутри Telegram.");
        }

        const response = await fetch(`${BACKEND_URL}/api/me`, {
          method: 'GET',
          headers: {
            'X-Init-Data': tg.initData,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ошибка от сервера: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        setUserData(data);

      } catch (err) {
        setError(err.message);
        // Показываем alert в Telegram, если есть такая возможность
        if (tg?.showAlert) {
            tg.showAlert(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []); // Пустой массив зависимостей означает, что этот эффект выполнится один раз при запуске

  if (loading) {
    return <div className="App-header">Загрузка данных пользователя...</div>;
  }

  if (error) {
    return <div className="App-header"><strong>Ошибка:</strong><p>{error}</p></div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        {userData ? (
          <div>
            <h1>Привет, {userData.first_name || userData.username}!</h1>
            <p>Твой ранг: <strong>{userData.rank}</strong></p>
            <p>У тебя <strong>{userData.points}</strong> баллов.</p>
          </div>
        ) : (
          // Это сообщение мы не должны увидеть, т.к. есть обработка ошибок
          <p>Не удалось загрузить данные.</p>
        )}
      </header>
    </div>
  );
}

export default App;
