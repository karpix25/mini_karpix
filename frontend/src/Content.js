import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Content.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент для одной карточки курса
const CourseCard = ({ course }) => {
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

  const status = getStatusBadge(course.rank_required);

  return (
    <Link to={`/course/${course.id}`} className="course-card-link">
      <div className="course-card">
        {/* Превью изображение */}
        <div 
          className="course-preview"
          style={{ background: getPreviewColor(course.id) }}
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
          <h3 className="course-title">{course.title}</h3>
          <p className="course-description">
            {course.description || 'Изучите основы и продвинутые техники. Получите практические навыки и знания.'}
          </p>

          {/* Прогресс */}
          <div className="course-progress">
            <div className="progress-info">
              <span className="progress-text">{course.progress}% завершено</span>
              <span className="lessons-count">{course.total_lessons} уроков</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${course.progress}%` }}
              ></div>
            </div>
          </div>

          {/* Метаинформация */}
          <div className="course-meta">
            <span className="course-difficulty">
              <span className="meta-icon">⭐</span>
              Ранг {course.rank_required}
            </span>
            <span className="course-duration">
              <span className="meta-icon">📖</span>
              {course.completed_lessons}/{course.total_lessons}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

function Content() {
  const [courses, setCourses] = useState([]);
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
        // ИЗМЕНЕНО: используем новый API /api/courses вместо /api/content
        const response = await fetch(`${BACKEND_URL}/api/courses`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Ошибка авторизации. Перезапустите приложение.');
          }
          if (response.status === 403) {
            throw new Error('Доступ запрещен. Убедитесь, что вы участник канала.');
          }
          throw new Error('Не удалось загрузить курсы');
        }
        
        const data = await response.json();
        console.log('Loaded courses:', data); // Для отладки
        setCourses(data);
      } catch (error) {
        console.error("Ошибка при загрузке курсов:", error);
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
          <button 
            onClick={() => window.location.reload()} 
            style={{
              padding: '10px 20px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              marginTop: '10px',
              cursor: 'pointer'
            }}
          >
            Попробовать снова
          </button>
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

      {courses.length > 0 ? (
        <div className="courses-grid">
          {courses.map((course) => (
            <CourseCard 
              key={course.id} 
              course={course}
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
