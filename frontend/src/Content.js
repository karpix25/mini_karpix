// frontend/src/Content.js

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Content.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Константа для количества курсов на странице
const COURSES_PER_PAGE = 12;

// Компонент для иконки замка
const LockIcon = ({ size = 32, color = 'white' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

// Компонент для стрелок пагинации
const ChevronLeft = ({ size = 12 }) => (
  <svg viewBox="0 0 25 40" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
    <path d="M24.2349 4.20503C24.5099 4.47811 24.5107 4.92268 24.2367 5.19673L9.92837 19.505C9.65501 19.7784 9.65501 20.2216 9.92837 20.495L24.2367 34.8033C24.5107 35.0773 24.5099 35.5219 24.2349 35.795L20.495 39.5085C20.2214 39.7802 19.7795 39.7795 19.5068 39.5068L0.495041 20.495C0.221674 20.2216 0.221673 19.7784 0.49504 19.505L19.5068 0.49323C19.7795 0.220545 20.2214 0.219764 20.495 0.491483L24.2349 4.20503Z"></path>
  </svg>
);

const ChevronRight = ({ size = 12 }) => (
  <svg viewBox="0 0 25 40" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
    <path d="M0.494387 4.20556C0.221231 4.47872 0.22099 4.92152 0.493848 5.19497L14.7733 19.5056C15.0459 19.7788 15.0459 20.2212 14.7733 20.4944L0.493849 34.805C0.220991 35.0785 0.221231 35.5213 0.494388 35.7944L4.20498 39.505C4.47834 39.7784 4.92156 39.7784 5.19493 39.505L24.205 20.495C24.4783 20.2216 24.4783 19.7784 24.205 19.505L5.19493 0.494976C4.92156 0.221609 4.47834 0.221608 4.20498 0.494975L0.494387 4.20556Z"></path>
  </svg>
);

// Компонент пагинации в стиле Skool
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const startItem = (currentPage - 1) * COURSES_PER_PAGE + 1;
  const endItem = Math.min(currentPage * COURSES_PER_PAGE, totalPages * COURSES_PER_PAGE);
  const totalItems = totalPages * COURSES_PER_PAGE;

  return (
    <div className="pagination-wrapper">
      <div className="pagination-controls">
        <button 
          type="button" 
          className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft />
          <span>Previous</span>
        </button>
        
        <button type="button" className="pagination-btn current-page">
          <span>{currentPage}</span>
        </button>
        
        <button 
          type="button" 
          className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <span>Next</span>
          <ChevronRight />
        </button>
      </div>
      
      <div className="pagination-meta">
        {startItem}-{endItem} of {totalItems}
      </div>
    </div>
  );
};

// Компонент для одной карточки курса
const CourseCard = ({ course }) => {
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

  const cardContent = (
    <div className={`course-card ${!course.is_unlocked ? 'locked' : ''}`}>
      <div 
        className="course-preview"
        style={{ background: getPreviewColor(course.id) }}
      >
        <div className="course-preview-content">
          <div className="course-icon">📚</div>
          {course.is_unlocked && (
            <div className="rank-badge" style={{ backgroundColor: status.color }}>
              {status.text}
            </div>
          )}
        </div>
        
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

// Основной компонент
function Content() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

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

  // Вычисляем пагинацию
  const totalPages = Math.ceil(courses.length / COURSES_PER_PAGE);
  const startIndex = (currentPage - 1) * COURSES_PER_PAGE;
  const endIndex = startIndex + COURSES_PER_PAGE;
  const currentCourses = courses.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Прокручиваем к началу контейнера
      document.querySelector('.content-container')?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };

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

  if (courses.length === 0) {
    return (
      <div className="content-container">
        <div className="content-header">
          <h2>📚 Обучающие курсы</h2>
          <p className="content-subtitle">Развивайте навыки, повышайте ранг и получайте доступ к новому контенту</p>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🔒</div>
          <h3>Пока нет доступных курсов</h3>
          <p>Повышайте свой ранг, участвуя в активностях канала, чтобы разблокировать новый контент!</p>
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

      <div className="courses-grid">
        {currentCourses.map((course, index) => (
          <CourseCard 
            key={course.id} 
            course={course}
            style={{ animationDelay: `${index * 0.05}s` }}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}

export default Content;
