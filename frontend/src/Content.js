import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Content.css'; // Создадим этот файл

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент для одной карточки курса
const CourseCard = ({ article, progress = 0 }) => {
  // Генерируем цвета для превью на основе ID
  const getPreviewColor = (id) => {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    ];
    const index = id.length % colors.length;
    return colors[index];
  };

  // Определяем статус курса
  const getStatusBadge = (rankRequired) => {
    if (rankRequired <= 1) return { text: 'Доступно', color: '#28a745' };
    if (rankRequired <= 2) return { text: 'Новичок+', color: '#ffc107' };
    if (rankRequired <= 3) return { text: 'Ветеран', color: '#fd7e14' };
    return { text: 'Легенда', color: '#dc3545' };
  };

  const status = getStatusBadge(article.rank_required);

  return (
    <Link to={`/article/${article.id}`} className="course-card-link">
      <div className="course-card">
        {/* Превью изображение */}
        <div 
          className="course-preview"
          style={{ background: getPreviewColor(article.id) }}
        >
          <div className="course-preview-content">
            <div className="course-icon">📚</div>
            <div className="rank-badge" style={{ backgroundColor: status.color }}>
              {status.text}
            </div>
          </div>
        </div>

        {/* Контент карточки */}
        <div className="course-content">
          <h3 className="course-title">{article.title}</h3>
          <p className="course-description">
            Изучите основы и продвинутые техники. Получите практические навыки и знания.
          </p>

          {/* Прогресс */}
          <div className="course-progress">
            <div className="progress-info">
              <span className="progress-text">{progress}% завершено</span>
              <span className="lessons-count">5 уроков</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Метаинформация */}
          <div className="course-meta">
            <span className="course-difficulty">
              <span className="meta-icon">⭐</span>
              Ранг {article.rank_required}
            </span>
            <span className="course-duration">
              <span className="meta-icon">🕒</span>
              ~30 мин
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

function Content() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchContent = async () => {
      if (!tg?.initData) {
        setError("Приложение должно быть открыто в Telegram.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/api/content`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить контент');
        }
        
        const data = await response.json();
        setArticles(data);
      } catch (error) {
        console.error("Ошибка при загрузке контента:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  if (loading) {
    return (
      <div className="content-container">
        <div className="content-header">
          <h2>📚 Обучающие курсы</h2>
        </div>
        <div className="loading-state">
          <div className="loader">Загрузка курсов...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-container">
        <div className="content-header">
          <h2>📚 Обучающие курсы</h2>
        </div>
        <div className="error-state">
          <p>❌ {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="content-header">
        <h2>📚 Обучающие курсы</h2>
        <p className="content-subtitle">
          Развивайте навыки, повышайте ранг и получайте доступ к новому контенту
        </p>
      </div>

      {articles.length > 0 ? (
        <div className="courses-grid">
          {articles.map((article) => (
            <CourseCard 
              key={article.id} 
              article={article}
              progress={Math.floor(Math.random() * 101)} // Временно рандомный прогресс
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🔒</div>
          <h3>Пока нет доступных курсов</h3>
          <p>Повышайте свой ранг, участвуя в активностях канала, чтобы разблокировать новый контент!</p>
        </div>
      )}
    </div>
  );
}

export default Content;
