// frontend/src/Content.js

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Content.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// --- ИЗМЕНЕНИЕ: Добавили компонент для иконки замка, чтобы не ставить библиотеки ---
const LockIcon = ({ size = 32, color = 'white' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

// Компонент для одной карточки курса
const CourseCard = ({ course }) => {
  // Ваши функции для стилизации остаются без изменений
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

  const getStatusBadge = (rankRequired) => {
    if (rankRequired <= 1) return { text: 'Доступно', color: '#28a745' };
    if (rankRequired <= 2) return { text: 'Новичок+', color: '#ffc107' };
    if (rankRequired <= 3) return { text: 'Ветеран', color: '#fd7e14' };
    return { text: 'Легенда', color: '#dc3545' };
  };

  const status = getStatusBadge(course.rank_required);

  // --- ИЗМЕНЕНИЕ: Выносим содержимое карточки в отдельную переменную, чтобы не дублировать ---
  const cardContent = (
    // Добавляем класс .locked, если курс не разблокирован
    <div className={`course-card ${!course.is_unlocked ? 'locked' : ''}`}>
      <div 
        className="course-preview"
        style={{ background: getPreviewColor(course.id) }}
      >
        <div className="course-preview-content">
          <div className="course-icon">📚</div>
          {/* Показываем бейдж только если курс разблокирован */}
          {course.is_unlocked && (
            <div className="rank-badge" style={{ backgroundColor: status.color }}>
              {status.text}
            </div>
          )}
        </div>
        
        {/* --- ИЗМЕНЕНИЕ: Добавляем оверлей с замком --- */}
        {!course.is_unlocked && (
          <div className="course-lock-overlay">
            <LockIcon />
            <p className="lock-overlay-text">Private Course</p>
          </div>
        )}
      </div>

      <div className="course-content">
        <h3 className="course-title">{course.title}</h3>
        <p className="course-description">
          {course.description || 'Изучите основы и продвинутые техники. Получите практические навыки и знания.'}
        </p>

        <div className="course-progress">
          <div className="progress-info">
            <span className="progress-text">{course.progress}% завершено</span>
            <span className="lessons-count">{course.total_lessons} уроков</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${course.progress}%` }}></div>
          </div>
        </div>

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
  );

  // --- ИЗМЕНЕНИЕ: Условный рендеринг ссылки ---
  // Если курс разблокирован, оборачиваем в Link, иначе - в простой div
  return course.is_unlocked ? (
    <Link to={`/course/${course.id}`} className="course-card-link">
      {cardContent}
    </Link>
  ) : (
    <div className="course-card-link">
      {cardContent}
    </div>
  );
};

// --- Ваш основной компонент Content остается без изменений ---
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
        const response = await fetch(`${BACKEND_URL}/api/courses`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        
        if (!response.ok) {
          if (response.status === 401) throw new Error('Ошибка авторизации. Перезапустите приложение.');
          if (response.status === 403) throw new Error('Доступ запрещен. Убедитесь, что вы участник канала.');
          throw new Error('Не удалось загрузить курсы');
        }
        
        const data = await response.json();
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
        <div className="content-header"><h2>📚 Обучающие курсы</h2></div>
        <div className="loading-state"><div className="loader">Загрузка курсов...</div></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-container">
        <div className="content-header"><h2>📚 Обучающие курсы</h2></div>
        <div className="error-state">
          <p>❌ {error}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', marginTop: '10px', cursor: 'pointer' }}>
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
        <p className="content-subtitle">Развивайте навыки, повышайте ранг и получайте доступ к новому контенту</p>
      </div>

      {courses.length > 0 ? (
        <div className="courses-grid">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
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
