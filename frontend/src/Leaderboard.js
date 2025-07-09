import React, { useState, useEffect } from 'react';
import './Leaderboard.css';

// НОВЫЙ КОМПОНЕНТ для отображения места и медали
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

// ОБНОВЛЕННЫЙ компонент для одной строки в списке лидеров
const UserRow = ({ user, period }) => {
    const scoreFormatted = period !== 'all' && user.score > 0 ? `+${user.score}` : user.score;
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'User';
    const initials = fullName.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
    
    // Логика аватаров остается прежней, она хороша
    const avatarUrl = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=4a90e2&color=fff&size=40&font-size=0.5`;

    return (
        <div className="user-row">
            {/* Используем новый компонент для отображения места */}
            <RankDisplay rank={user.rank} />
            
            <img 
                src={avatarUrl} 
                alt={fullName} 
                className="avatar"
                onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=6c757d&color=fff&size=40&font-size=0.5`;
                }}
            />
            <span className="user-name">{fullName}</span>
            <span className="user-score">{scoreFormatted}</span>
        </div>
    );
};

// Главный компонент Лидерборда (логика загрузки данных без изменений)
function Leaderboard() {
    const [period, setPeriod] = useState('7d');
    const [data, setData] = useState({ top_users: [], current_user: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLeaders = async () => {
            setLoading(true);
            setError(null);
            
            if (!window.Telegram?.WebApp?.initData) {
                setError("Приложение должно быть открыто в Telegram.");
                setLoading(false);
                return;
            }

            try {
                const headers = { 'X-Init-Data': window.Telegram.WebApp.initData };
                const response = await fetch(`https://miniback.karpix.com/api/leaderboard?period=${period}`, { headers });
                
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

    const currentUserForDisplay = data.top_users.find(u => data.current_user && u.user_id === data.current_user.user_id);
    const currentUserRankData = data.current_user ? (currentUserForDisplay || data.current_user) : null;

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
