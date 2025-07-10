import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import './CourseOverview.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент для одного урока в разделе
const LessonItem = ({ lesson, courseId, sectionId }) => {
  return (
    <Link 
      to={`/course/${courseId}/lesson/${lesson.id}`} 
      className="lesson-item"
    >
      <div className="lesson-icon">
        {lesson.completed ? '✅' : '📄'}
      </div>
      <div className="lesson-info">
        <h4 className="lesson-title">{lesson.title}</h4>
      </div>
      <div className="lesson-arrow">→</div>
    </Link>
  );
};

// Компонент для раздела курса
const CourseSection = ({ section, courseId, isExpanded, onToggle }) => {
  return (
    <div className="course-section">
      <button 
        className={`section-header ${isExpanded ? 'expanded' : ''}`}
        onClick={onToggle}
      >
        <span className="section-toggle">{isExpanded ? '▼' : '▶'}</span>
        <span className="section-title">{section.title}</span>
        <span className="section-count">{section.lessons.length} уроков</span>
      </button>
      
      {isExpanded && (
        <div className="section-lessons">
          {section.lessons.map((lesson) => (
            <LessonItem 
              key={lesson.id}
              lesson={lesson}
              courseId={courseId}
              sectionId={section.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function CourseOverview() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [courseData, setCourseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState(new Set());

  useEffect(() => {
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => navigate('/content');
      tg.BackButton.onClick(onBackClick);
      return () => tg.BackButton.offClick(onBackClick);
    }
  }, [navigate]);

  useEffect(() => {
    const fetchCourseData = async () => {
      if (!tg?.initData || !courseId) return;
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/courses/${courseId}`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить курс');
        }
        
        const data = await response.json();
        setCourseData(data);
        
        // По умолчанию раскрываем первый раздел
        if (data.sections.length > 0) {
          setExpandedSections(new Set([data.sections[0].id]));
        }
        
      } catch (error) {
        console.error('Ошибка при загрузке курса:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [courseId]);

  const toggleSection = (sectionId) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const goBackToContent = () => {
    navigate('/content');
  };

  if (loading) {
    return (
      <div className="course-overview-container">
        <div className="loading-state">Загрузка курса...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="course-overview-container">
        <div className="error-state">
          <h2>Ошибка</h2>
          <p>{error}</p>
          <button onClick={goBackToContent} className="back-button">
            ← Вернуться к курсам
          </button>
        </div>
      </div>
    );
  }

  if (!courseData) {
    return (
      <div className="course-overview-container">
        <div className="error-state">
          <h2>Курс не найден</h2>
          <button onClick={goBackToContent} className="back-button">
            ← Вернуться к курсам
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="course-overview-container">
      {/* Мобильная навигация */}
      <div className="mobile-navigation">
        <button className="back-to-content" onClick={goBackToContent}>
          ← Назад к курсам
        </button>
      </div>

      {/* Заголовок курса */}
      <div className="course-header">
        <h1 className="course-title">{courseData.title}</h1>
        <p className="course-description">{courseData.description}</p>
        
        {/* Прогресс курса */}
        <div className="course-progress-header">
          <div className="progress-text">{courseData.progress}%</div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${courseData.progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Разделы курса */}
      <div className="course-sections">
        {courseData.sections.map((section) => (
          <CourseSection
            key={section.id}
            section={section}
            courseId={courseId}
            isExpanded={expandedSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>

      {/* Пустое состояние если нет разделов */}
      {courseData.sections.length === 0 && (
        <div className="empty-sections">
          <div className="empty-icon">📚</div>
          <h3>Курс пока пуст</h3>
          <p>Уроки будут добавлены в ближайшее время</p>
        </div>
      )}
    </div>
  );
}

export default CourseOverview;
