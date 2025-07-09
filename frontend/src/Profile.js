import React, { useState, useEffect } from 'react';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://n8n-karpix-miniapp-karpix-backeng.g44y6r.easypanel.host";

function Profile() {
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tg?.initData) {
      setError("Это приложение предназначено для работы внутри Telegram.");
      return;
    }
    const fetchUserData = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/me`, {
          headers: { 'X-Init-Data': tg.initData },
        });
        if (!response.ok) throw new Error("Ошибка сети при загрузке профиля");
        const data = await response.json();
        setUserData(data);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchUserData();
  }, []);

  if (error) return <div><strong>Ошибка:</strong><p>{error}</p></div>;
  if (!userData) return <div>Загрузка профиля...</div>;

  return (
    <div>
      <h1>Привет, {userData.first_name || userData.username}!</h1>
      <p>Твой ранг: <strong>{userData.rank}</strong></p>
      <p>У тебя <strong>{userData.points}</strong> баллов.</p>
    </div>
  );
}

export default Profile;
