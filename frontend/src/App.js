import React, { useState, useEffect } from 'react';
import './App.css';
import Leaderboard from './Leaderboard'; // Импортируем наш новый компонент
import Content from './Content';       // Импортируем наш второй новый компонент

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://n8n-karpix-miniapp-karpix-backeng.g44y6r.easypanel.host";

function Profile({ userData }) {
  if (!userData) {
    return <div>Загрузка профиля...</div>;
  }
  return (
    <div>
      <h1>Привет, {userData.first_name || userData.username}!</h1>
      <p>Твой ранг: <strong>{userData.rank}</strong></p>
      <p>У тебя <strong>{userData.points}</strong> баллов.</p>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'leaderboard', 'content'
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tg) {
      tg.ready();
    }
    
    const fetchUserData = async () => {
      if (!tg?.initData) {
        setError("Это приложение предназначено для работы внутри Telegram.");
        return;
      }
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

  const renderContent = () => {
    if (error) return <div><strong>Ошибка:</strong><p>{error}</p></div>;

    switch (activeTab) {
      case 'profile':
        return <Profile userData={userData} />;
      case 'leaderboard':
        return <Leaderboard />;
      case 'content':
        return <Content />;
      default:
        return <Profile userData={userData} />;
    }
  };

  return (
    <div className="App">
      <div className="content">
        {renderContent()}
      </div>
      <div className="nav-tabs">
        <div className={`nav-tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          Профиль
        </div>
        <div className={`nav-tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>
          Лидеры
        </div>
        <div className={`nav-tab ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setActiveTab('content')}>
          Контент
        </div>
      </div>
    </div>
  );
}

export default App;
