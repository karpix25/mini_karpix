import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

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
        {articles.length > 0 ? (
          articles.map((article) => (
            <Link to={`/article/${article.id}`} key={article.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="leaderboard-item" style={{cursor: 'pointer'}}>
                <span>{article.title}</span>
                <span>→</span>
              </div>
            </Link>
          ))
        ) : (
          <p>Для вашего ранга пока нет доступного контента.</p>
        )}
      </div>
    </div>
  );
}

export default Content;
