import React, { useEffect, useState } from 'react';
import './App.css';

// Получаем объект Telegram Web App
const tg = window.Telegram.WebApp;

// URL вашего бэкенда. Убедитесь, что нет лишних слэшей в конце.
const BACKEND_URL = "https://n8n-karpix-miniapp-karpix-backeng.g44y6r.easypanel.host"; 

function App() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Сообщаем Telegram, что приложение готово
    if (tg.ready) {
        tg.ready();
    }
    
    const fetchUserData = async () => {
      try {
        // Проверяем, есть ли initData
        if (!tg.initData) {
          // Это для отладки в обычном браузере, а не в Telegram
          setError("Это приложение должно быть открыто внутри Telegram.");
          setLoading(false);
          return;
        }

        const response = await fetch(`${BACKEND_URL}/api/me`, {
          method: 'GET',
          headers: {
            // Отправляем initData в заголовке для авторизации на бэкенде
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
        // Для отладки можно выводить ошибку на главный экран
        if (tg.showAlert) {
            tg.showAlert(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  if (loading) {
    return <div className="App-header">Загрузка данных пользователя...</div>;
  }

  if (error) {
    return <div className="App-header">Ошибка: {error}</div>;
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
          <p>Не удалось загрузить данные. Убедитесь, что вы в Telegram.</p>
        )}
      </header>
    </div>
  );
}

export default App;
