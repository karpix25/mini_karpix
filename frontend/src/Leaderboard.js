import React, { useState, useEffect } from 'react';
import './Leaderboard.css'; // Убедитесь, что этот файл существует и содержит стили

// Маленький компонент для отображения бейджа с рангом
const RankBadge = ({ rank }) => {
    const isTopThree = rank <= 3;
    if (!isTopThree) {
        return <div className="rank-number">{rank}</div>;
    }
    const badgeClass = `rank-badge rank-${rank}`;
    return <div className={badgeClass}>{rank}</div>;
};

// Компонент для одной строки в списке лидеров
const UserRow = ({ user, period }) => {
    const scoreFormatted = period !== 'all' && user.score > 0 ? `+${user.score}` : user.score;
    const avatarUrl = user.avatar_url || `https://api.dicebear.com/8.x/pixel-art/svg?seed=${user.username || user.user_id}`;

    return (
        <div className="user-row">
            <RankBadge rank={user.rank} />
            <img src={avatarUrl} alt={user.first_name || user.username} className="avatar" />
            <span className="user-name">{user.first_name || user.username}</span>
            <span className="user-score">{scoreFormatted}</span>
        </div>
    );
};


// Главный компонент Лидерборда
function Leaderboard() {
    const [period, setPeriod] = useState('7d');
    const [data, setData] = useState({ top_users: [], current_user: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLeaders = async () => {
            setLoading(true);
            setError(null);
            
            if (!window.Telegram || !window.Telegram.WebApp || !window.Telegram.WebApp.initData) {
                setError("Не удалось получить данные Telegram. Пожалуйста, откройте приложение в Telegram.");
                setLoading(false);
                return;
            }

            try {
                // === ИСПРАВЛЕНИЕ ЗДЕСЬ ===
                // Меняем 'Authorization' на 'X-Init-Data' и убираем префикс 'tma'
                const headers = {
                    'X-Init-Data': window.Telegram.WebApp.initData
                };
                // =========================

                // Запрашиваем данные для выбранного периода
                // Важно: URL теперь относительный, т.к. EasyPanel проксирует запросы
                const response = await fetch(`/api/leaderboard?period=${period}`, { headers });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || "Ошибка сети");
                }
                
                const responseData = await response.json();
                setData(responseData);
            } catch (error) {
                console.error("Ошибка при загрузке лидерборда:", error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaders();
    }, [period]); 

    // Находим данные текущего пользователя из общего списка для отображения в блоке "Your Rank"
    const currentUserForDisplay = data.top_users.find(u => data.current_user && u.user_id === data.current_user.user_id);
    const currentUserRankData = data.current_user ? { ...currentUserForDisplay, ...data.current_user } : null;

    return (
        <div className="leaderboard-container">
            <div className="leaderboard-card">
                <div className="leaderboard-header">
                    <h2>Leaderboard</h2>
                    <div className="period-selector">
                        <button onClick={() => setPeriod('7d')} className={period === '7d' ? 'active' : ''}>7-day</button>
                        <button onClick={() => setPeriod('30d')} className={period === '30d' ? 'active' : ''}>30-day</button>
                        <button onClick={() => setPeriod('all')} className={period === 'all' ? 'active' : ''}>All-time</button>
                    </div>
                </div>

                {loading && <div className="loader">Загрузка...</div>}
                {error && <div className="error-message">{error}</div>}

                {!loading && !error && (
                    <div className="leaderboard-list">
                        {data.top_users.map(user => (
                            <UserRow key={user.user_id} user={user} period={period} />
                        ))}
                    </div>
                )}
            </div>

            {/* Блок "Your rank" теперь рендерится правильно */}
            {!loading && !error && currentUserRankData && (
                <div className="your-rank-card">
                    <h3 className="your-rank-title">Your rank</h3>
                    <UserRow user={currentUserRankData} period={period} />
                </div>
            )}
        </div>
    );
}

export default Leaderboard;
