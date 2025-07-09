import React, { useState, useEffect } from 'react';
// --- Новые импорты ---
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import './Profile.css'; // Скоро создадим этот файл

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://n8n-karpix-miniapp-karpix-backeng.g44y6r.easypanel.host";

function Profile() {
  const [userData, setUserData] = useState(null);
  const [allRanks, setAllRanks] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tg?.initData) {
      setError("Это приложение предназначено для работы внутри Telegram.");
      return;
    }

    const fetchData = async () => {
      try {
        // Запрашиваем данные пользователя и список всех рангов одновременно
        const [userRes, ranksRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/me`, { headers: { 'X-Init-Data': tg.initData } }),
          fetch(`${BACKEND_URL}/api/ranks`, { headers: { 'X-Init-Data': tg.initData } })
        ]);

        if (!userRes.ok) throw new Error("Ошибка загрузки профиля");
        if (!ranksRes.ok) throw new Error("Ошибка загрузки рангов");

        const userData = await userRes.json();
        const ranksData = await ranksRes.json();

        setUserData(userData);
        setAllRanks(ranksData);

      } catch (err) {
        setError(err.message);
      }
    };
    fetchData();
  }, []);

  if (error) return <div className="profile-container"><strong>Ошибка:</strong><p>{error}</p></div>;
  if (!userData || allRanks.length === 0) return <div className="profile-container">Загрузка...</div>;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="progress-container">
          <CircularProgressbar
            value={userData.progress_percentage}
            text={`${userData.level || userData.rank.charAt(0)}`} // Показываем первую букву ранга или уровень
            strokeWidth={5}
            styles={buildStyles({
              textColor: '#fff',
              pathColor: '#61dafb',
              trailColor: '#4a505c',
              textSize: '28px',
            })}
          />
          <img 
            src={tg.initDataUnsafe?.user?.photo_url || 'https://via.placeholder.com/150'} 
            alt="avatar" 
            className="avatar"
          />
        </div>
        <h2>{userData.first_name} {tg.initDataUnsafe?.user?.last_name || ''}</h2>
        <p className="rank-name">Level {userData.level} - {userData.rank}</p>
        {userData.points_to_next_rank !== null ? (
            <p className="points-to-go">{userData.points_to_next_rank} points to level up</p>
        ) : (
            <p className="points-to-go">Максимальный уровень!</p>
        )}
      </div>
      <div className="ranks-list">
        <h3>Все уровни</h3>
        {allRanks.map(rank => (
          <div key={rank.level} className={`rank-item ${rank.is_unlocked ? 'unlocked' : 'locked'}`}>
            <div className="rank-item-icon">
              {rank.is_unlocked ? '✔️' : '🔒'}
            </div>
            <div className="rank-item-info">
              Level {rank.level} - {rank.name}
              <span>{rank.min_points}+ очков</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Profile;
