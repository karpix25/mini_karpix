import React, { useState, useEffect } from 'react';

// Не забудьте указать URL вашего бэкенда
const BACKEND_URL = "https://n8n-karpix-miniapp-karpix-backeng.g44y6r.easypanel.host";

function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/leaderboard`);
        const data = await response.json();
        setLeaders(data);
      } catch (error) {
        console.error("Ошибка при загрузке лидерборда:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaders();
  }, []);

  if (loading) {
    return <div>Загрузка лидерборда...</div>;
  }

  return (
    <div>
      <h2>🏆 Лидерборд</h2>
      <ol className="leaderboard-list">
        {leaders.map((user, index) => (
          <li key={index} className="leaderboard-item">
            <span>{index + 1}. {user.first_name || user.username}</span>
            <span>{user.points} баллов</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default Leaderboard;
