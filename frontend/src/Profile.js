import React, { useState, useEffect } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circularbar-progressbar/dist/styles.css'; // Убедитесь, что этот CSS импортирован
import './Profile.css'; // Обновленный CSS для Profile и Leaderboard

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Новый вспомогательный компонент для отображения места и медали (из Leaderboard.js)
const RankDisplay = ({ rank }) => {
    let medal = null;
    if (rank === 1) medal = '🥇';
    if (rank === 2) medal = '🥈';
    if (rank === 3) medal = '🥉';

    return (
        <div className="user-rank-position">
            <span className="rank-number">{rank}</span>
            {medal && <span className="medal-emoji">{medal}</span>}
        </div>
    );
};

// Новый вспомогательный компонент для одной строки пользователя в лидерборде (из Leaderboard.js)
const LeaderboardUserRow = ({ user, period }) => {
    const scoreFormatted = period !== 'all' && user.score > 0 ? `+${user.score}` : user.score;
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'User';
    // Используем initials для заглушки, как в Leaderboard.js
    const initials = fullName.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
    const avatarUrl = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=4A90E2&color=fff&size=40&font-size=0.5`;

    return (
        <div className="leaderboard-user-row">
            <RankDisplay rank={user.rank} />
            <img 
                src={avatarUrl} 
                alt={fullName} 
                className="leaderboard-avatar" // Используем новый класс, чтобы не конфликтовать с аватаром профиля
                onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=6c757d&color=fff&size=40&font-size=0.5`;
                }}
            />
            <span className="leaderboard-user-name">{fullName}</span>
            <span className="leaderboard-user-score">{scoreFormatted}</span>
        </div>
    );
};


function Profile() {
  const [userData, setUserData] = useState(null);
  const [allRanks, setAllRanks] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState({ top_users: [], current_user: null });
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('7d'); // Период для лидерборда
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tg?.initData) {
      setError("Это приложение предназначено для работы внутри Telegram.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = { 'X-Init-Data': tg.initData };
        
        // Запрашиваем данные профиля и всех рангов
        const [userRes, ranksRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/me`, { headers }),
          fetch(`${BACKEND_URL}/api/ranks`, { headers })
        ]);

        if (!userRes.ok) throw new Error("Ошибка загрузки профиля");
        if (!ranksRes.ok) throw new Error("Ошибка загрузки рангов");

        const userDataFetched = await userRes.json();
        const ranksDataFetched = await ranksRes.json();

        setUserData(userDataFetched);
        setAllRanks(ranksDataFetched);

        // Загружаем данные лидерборда
        const leaderboardResponse = await fetch(`${BACKEND_URL}/api/leaderboard?period=${leaderboardPeriod}`, { headers });
        if (!leaderboardResponse.ok) {
            const errorData = await leaderboardResponse.json();
            throw new Error(errorData.detail || "Ошибка загрузки лидерборда");
        }
        const leaderboardDataFetched = await leaderboardResponse.json();
        setLeaderboardData(leaderboardDataFetched);

      } catch (err) {
        console.error("Ошибка загрузки данных:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [leaderboardPeriod]); // Перезагружаем данные при смене периода лидерборда

  if (loading) return <div className="profile-container common-loading-error-state">Загрузка...</div>;
  if (error) return <div className="profile-container common-loading-error-state"><strong>Ошибка:</strong><p>{error}</p></div>;
  if (!userData || allRanks.length === 0) return <div className="profile-container common-loading-error-state">Загрузка...</div>;

  const fullName = [userData.first_name, tg.initDataUnsafe?.user?.last_name || ''].filter(Boolean).join(' ');
  const initials = fullName.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
  const profileAvatarUrl = tg.initDataUnsafe?.user?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=4A90E2&color=fff&size=150&font-size=0.5`;

  // Лидерборд: отображаем только топ-10
  const top10Users = leaderboardData.top_users.slice(0, 10);
  const currentUserLeaderboardData = leaderboardData.current_user ? (top10Users.find(u => leaderboardData.current_user && u.user_id === leaderboardData.current_user.user_id) || leaderboardData.current_user) : null;

  return (
    <div className="profile-container">
      {/* Профиль пользователя */}
      <div className="profile-card">
        <div className="profile-header">
          <div className="progress-container">
            <CircularProgressbar
              value={userData.progress_percentage || 0}
              text={`${userData.level || userData.rank}`} // Показываем уровень или ранг
              strokeWidth={5}
              styles={buildStyles({
                textColor: '#1A1A1A', // Темный текст
                pathColor: '#61dafb', // Акцентный цвет
                trailColor: '#E9ECEF', // Светлый трек
                textSize: '28px',
                backgroundColor: 'white', // Фон внутри круга
              })}
            />
            <img 
              src={profileAvatarUrl} 
              alt="avatar" 
              className="profile-avatar" // Отдельный класс для аватара профиля
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=6c757d&color=fff&size=150&font-size=0.5`;
              }}
            />
             {/* Значок ранга на аватаре, как на скриншоте */}
            <div className="profile-rank-badge">
                {userData.rank_level}
            </div>
          </div>
          <h2 className="profile-name">{fullName}</h2>
          <p className="profile-rank-name">
              Level {userData.level} - {userData.rank} 
              {/* Если на скриншоте есть иконка - ее сюда */}
              <span className="rank-icon-text"> 🛠️</span>
          </p>
          {userData.points_to_next_rank !== null ? (
              <p className="profile-points-to-go">{userData.points_to_next_rank} points to level up <span className="help-icon">?</span></p>
          ) : (
              <p className="profile-points-to-go">Максимальный уровень!</p>
          )}
        </div>
      </div>

      {/* Список всех рангов */}
      <div className="profile-card ranks-list-card">
        <h3 className="card-title">Все уровни</h3>
        <div className="ranks-list">
            {allRanks.map(rank => (
            <div key={rank.level} className={`rank-item ${rank.is_unlocked ? 'unlocked' : 'locked'}`}>
                <div className="rank-item-icon">
                {rank.is_unlocked ? '✅' : '🔒'}
                </div>
                <div className="rank-item-info">
                Level {rank.level} - {rank.name}
                <span>{rank.min_points}+ очков</span>
                </div>
            </div>
            ))}
        </div>
      </div>

      {/* Секция Лидерборда */}
      <div className="profile-card leaderboard-section">
        <div className="leaderboard-header">
            <h3 className="card-title">Leaderboard ({leaderboardPeriod === '7d' ? '7-day' : leaderboardPeriod === '30d' ? '30-day' : 'All-time'})</h3>
            <div className="period-selector">
                <button onClick={() => setLeaderboardPeriod('7d')} className={leaderboardPeriod === '7d' ? 'active' : ''}>7-day</button>
                <button onClick={() => setLeaderboardPeriod('30d')} className={leaderboardPeriod === '30d' ? 'active' : ''}>30-day</button>
                <button onClick={() => setLeaderboardPeriod('all')} className={leaderboardPeriod === 'all' ? 'active' : ''}>All-time</button>
            </div>
        </div>

        {top10Users.length > 0 ? (
            <div className="leaderboard-list">
                {top10Users.map(user => (
                    <LeaderboardUserRow key={user.user_id} user={user} period={leaderboardPeriod} />
                ))}
            </div>
        ) : (
            <div className="no-leaders-message">Лидеры пока не определены. Будь первым!</div>
        )}

        {/* Карточка "Your rank", если текущий пользователь не в топ-10 */}
        {currentUserLeaderboardData && !top10Users.some(u => u.user_id === currentUserLeaderboardData.user_id) && (
             <div className="leaderboard-your-rank-card">
                <h3 className="leaderboard-your-rank-title">Your rank</h3>
                <LeaderboardUserRow user={currentUserLeaderboardData} period={leaderboardPeriod} />
            </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
