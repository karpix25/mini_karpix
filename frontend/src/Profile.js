import React, { useState, useEffect } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css'; 
import './Profile.css'; 

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
    const scoreFormatted = (period === 'all' && user.score >= 0) ? user.score : (user.score > 0 ? `+${user.score}` : user.score);
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'User';
    const initials = fullName.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
    const avatarUrl = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=4A90E2&color=fff&size=40&font-size=0.5`;

    return (
        <div className="leaderboard-user-row">
            <RankDisplay rank={user.rank} />
            <img 
                src={avatarUrl} 
                alt={fullName} 
                className="leaderboard-avatar"
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
  const [leaderboardData7d, setLeaderboardData7d] = useState({ top_users: [], current_user: null });
  const [leaderboardData30d, setLeaderboardData30d] = useState({ top_users: [], current_user: null });
  const [leaderboardDataAll, setLeaderboardDataAll] = useState({ top_users: [], current_user: null });
  
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

        const [lb7dRes, lb30dRes, lbAllRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/leaderboard?period=7d`, { headers }),
            fetch(`${BACKEND_URL}/api/leaderboard?period=30d`, { headers }),
            fetch(`${BACKEND_URL}/api/leaderboard?period=all`, { headers })
        ]);

        if (!lb7dRes.ok) throw new Error("Ошибка загрузки лидерборда (7 дней)");
        if (!lb30dRes.ok) throw new Error("Ошибка загрузки лидерборда (30 дней)");
        if (!lbAllRes.ok) throw new Error("Ошибка загрузки лидерборда (все время)");

        setLeaderboardData7d(await lb7dRes.json());
        setLeaderboardData30d(await lb30dRes.json());
        setLeaderboardDataAll(await lbAllRes.json());

      } catch (err) {
        console.error("Ошибка загрузки данных:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []); 

  if (loading) return <div className="profile-container common-loading-error-state">Загрузка...</div>;
  if (error) return <div className="profile-container common-loading-error-state"><strong>Ошибка:</strong><p>{error}</p></div>;
  if (!userData || allRanks.length === 0) return <div className="profile-container common-loading-error-state">Загрузка...</div>;

  const fullName = [userData.first_name, tg.initDataUnsafe?.user?.last_name || ''].filter(Boolean).join(' ');
  const initials = fullName.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
  const profileAvatarUrl = tg.initDataUnsafe?.user?.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=4A90E2&color=fff&size=150&font-size=0.5`;

  const renderLeaderboardSection = (title, data, period) => {
    const top10Users = data.top_users.slice(0, 10);
    const currentUserForDisplay = data.current_user ? (top10Users.find(u => data.current_user && u.user_id === data.current_user.user_id) || data.current_user) : null;
    
    return (
        <div className="profile-card leaderboard-section">
            <h3 className="card-title leaderboard-title">{title}</h3>
            {top10Users.length > 0 ? (
                <div className="leaderboard-list">
                    {top10Users.map(user => (
                        <LeaderboardUserRow key={user.user_id} user={user} period={period} />
                    ))}
                </div>
            ) : (
                <div className="no-leaders-message">Лидеры пока не определены. Будь первым!</div>
            )}

            {currentUserForDisplay && !top10Users.some(u => u.user_id === currentUserForDisplay.user_id) && (
                <div className="leaderboard-your-rank-card">
                    <h3 className="leaderboard-your-rank-title">Ваш ранг</h3>
                    <LeaderboardUserRow user={currentUserForDisplay} period={period} />
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="profile-container">
      <div className="profile-desktop-wrapper"> {/* НОВАЯ ОБЕРТКА ДЛЯ ДЕСКТОПА */}
        {/* Верхняя секция: Профиль + Все уровни */}
        <div className="profile-top-section"> {/* НОВАЯ ОБЕРТКА ДЛЯ ВЕРХНЕЙ СЕКЦИИ */}
          {/* Профиль пользователя */}
          <div className="profile-card profile-main-card">
            <div className="profile-header">
              <div className="progress-container">
                <CircularProgressbar
                  value={userData.progress_percentage || 0}
                  text={`${userData.level || userData.rank}`} 
                  strokeWidth={5}
                  styles={buildStyles({
                    textColor: '#1A1A1A', 
                    pathColor: '#61dafb', 
                    trailColor: '#E9ECEF', 
                    textSize: '28px',
                    backgroundColor: 'white', 
                  })}
                />
                <img 
                  src={profileAvatarUrl} 
                  alt="avatar" 
                  className="profile-avatar" 
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=6c757d&color=fff&size=150&font-size=0.5`;
                  }}
                />
                <div className="profile-rank-badge">
                    {userData.level}
                </div>
              </div>
              <h2 className="profile-name">{fullName}</h2>
              <p className="profile-rank-name">
                  Level {userData.level} - {userData.rank} 
                  <span className="rank-icon-text">🛠️</span>
              </p>
              {userData.points_to_next_rank !== null ? (
                  <p className="profile-points-to-go">
                    {userData.points_to_next_rank} points to level up 
                    <span className="help-icon">?</span>
                </p>
              ) : (
                  <p className="profile-points-to-go">Максимальный уровень!</p>
              )}
            </div>
          </div>

          {/* Секция "Все уровни" как отдельная карточка */}
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
        </div> {/* КОНЕЦ profile-top-section */}

        {/* Секции Лидерборда (каждая в отдельной карточке) */}
        <div className="profile-leaderboards-section"> {/* НОВАЯ ОБЕРТКА ДЛЯ ЛИДЕРБОРДОВ */}
            {renderLeaderboardSection("Leaderboard (7-day)", leaderboardData7d, '7d')}
            {renderLeaderboardSection("Leaderboard (30-day)", leaderboardData30d, '30d')}
            {renderLeaderboardSection("Leaderboard (All-time)", leaderboardDataAll, 'all')}
        </div>
      </div> {/* КОНЕЦ profile-desktop-wrapper */}
    </div>
  );
}

export default Profile;
