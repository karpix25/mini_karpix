import React, { useState, useEffect } from 'react';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://n8n-karpix-miniapp-karpix-backeng.g44y6r.easypanel.host";

function Content() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      if (!tg?.initData) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/content`, {
           headers: { 'X-Init-Data': tg.initData }
        });
        const data = await response.json();
        setArticles(data);
      } catch (error) {
        console.error("Ошибка при загрузке контента:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, []);

  if (loading) {
    return <div>Загрузка контента...</div>;
  }
  
  return (
    <div>
      <h2>📚 Доступный контент</h2>
      <div className="leaderboard-list">
        {articles.map((article) => (
          <div key={article.id} className="leaderboard-item">
            <span>{article.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Content;
