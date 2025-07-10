import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './CourseOverview.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент раздела с toggle
const CourseSection = ({ section, isExpanded, onToggle, onLessonClick, userPoints }) => {
  return (
    <div className="course-section">
      <div 
        className={`section-header ${isExpanded ? 'expanded' : ''}`}
        onClick={onToggle}
      >
        <div className="section-info">
          <span className="section-icon">{section.icon || '📚'}</span>
          <span className="section-title">{section.title}</span>
        </div>
        <div className="section-controls">
          <span className="lessons-count">{section.lessons.length} уроков</span>
          <span className={`toggle-arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="section-lessons">
          {section.lessons.map((lesson, index) => {
            const isUnlocked = userPoints >= (lesson.points || 0);
            return (
              <div 
                key={lesson.id}
                className={`lesson-item ${!isUnlocked ? 'locked' : ''} ${lesson.completed ? 'completed' : ''}`}
                onClick={() => isUnlocked && onLessonClick(lesson.id)}
              >
                <div className="lesson-info">
                  <span className="lesson-icon">
                    {!isUnlocked ? '🔒' : lesson.completed ? '✅' : '📄'}
                  </span>
                  <span className="lesson-title">{lesson.title}</span>
                </div>
                {lesson.duration && (
                  <span className="lesson-duration">{lesson.duration}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function CourseOverview() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userPoints, setUserPoints] = useState(0);
  const [expandedSections, setExpandedSections] = useState({});

  // Настройка Telegram BackButton
  useEffect(() => {
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => navigate('/content');
      tg.BackButton.onClick(onBackClick);
      return () => tg.BackButton.offClick(onBackClick);
    }
  }, [navigate]);

  // Загрузка данных курса
  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        // Загружаем данные пользователя для проверки доступа
        if (tg?.initData) {
          const userResponse = await fetch(`${BACKEND_URL}/api/me`, {
            headers: { 'X-Init-Data': tg.initData }
          });
          if (userResponse.ok) {
            const userData = await userResponse.json();
            setUserPoints(userData.points || 0);
          }
        }

        // Загружаем данные курса
        if (tg?.initData) {
          const courseResponse = await fetch(`${BACKEND_URL}/api/courses/${courseId}`, {
            headers: { 'X-Init-Data': tg.initData }
          });
          
          if (courseResponse.ok) {
            const courseData = await courseResponse.json();
            setCourse(courseData);
            
            // Разворачиваем первый раздел по умолчанию
            if (courseData.sections?.length > 0) {
              setExpandedSections({ [courseData.sections[0].id]: true });
            }
          }
        } else {
          // Моковые данные для разработки
          const mockCourse = {
            id: courseId,
            title: "Введение в разработку",
            description: "Изучите основы веб-разработки от А до Я",
            sections: [
              {
                id: "introduction",
                title: "🚀 Introduction",
                icon: "🚀",
                lessons: [
                  { id: "welcome", title: "Welcome!", points: 0, duration: "5 мин", completed: false },
                  { id: "setup", title: "Project Setup", points: 10, duration: "10 мин", completed: false }
                ]
              },
              {
                id: "basics",
                title: "📚 Beginner's Guide",
                icon: "📚",
                lessons: [
                  { id: "html-basics", title: "HTML Basics", points: 20, duration: "15 мин", completed: false },
                  { id: "css-intro", title: "CSS Introduction", points: 40, duration: "20 мин", completed: false }
                ]
              },
              {
                id: "advanced",
                title: "⚡ Advanced Topics",
                icon: "⚡",
                lessons: [
                  { id: "javascript", title: "JavaScript Fundamentals", points: 80, duration: "30 мин", completed: false },
                  { id: "frameworks", title: "Modern Frameworks", points: 150, duration: "45 мин", completed: false }
                ]
              }
            ]
          };
          setCourse(mockCourse);
          setExpandedSections({ "introduction": true });
          setUserPoints(50); // Моковые очки
        }
      } catch (error) {
        console.error('Ошибка загрузки курса:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [courseId]);

  const handleSectionToggle = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleLessonClick = (lessonId) => {
    navigate(`/course/${courseId}/lesson/${lessonId}`);
  };

  const goBackToContent = () => {
    navigate('/content');
  };

  if (loading) {
    return (
      <div className="course-overview-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Загружается курс...</p>
        </div>
      </div>
    );
  }

  if (!course) {
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

  const totalLessons = course.sections?.reduce((acc, section) => acc + section.lessons.length, 0) || 0;
  const completedLessons = course.sections?.reduce((acc, section) => 
    acc + section.lessons.filter(lesson => lesson.completed).length, 0
  ) || 0;
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="course-overview-container">
      {/* Мобильная навигация */}
      <div className="mobile-navigation">
        <button className="back-to-menu" onClick={goBackToContent}>
          ← Menu
        </button>
      </div>

      {/* Заголовок курса */}
      <div className="course-header">
        <h1 className="course-title">{course.title}</h1>
        <p className="course-description">{course.description}</p>
        
        <div className="course-stats">
          <div className="progress-section">
            <div className="progress-text">
              <span className="progress-percentage">{progressPercentage}%</span>
              <span className="progress-label">завершено</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
          
          <div className="course-meta">
            <span className="meta-item">
              <span className="meta-icon">📚</span>
              {totalLessons} уроков
            </span>
            <span className="meta-item">
              <span className="meta-icon">⚡</span>
              {userPoints} очков
            </span>
          </div>
        </div>
      </div>

      {/* Список разделов */}
      <div className="course-sections">
        {course.sections?.map((section) => (
          <CourseSection
            key={section.id}
            section={section}
            isExpanded={expandedSections[section.id]}
            onToggle={() => handleSectionToggle(section.id)}
            onLessonClick={handleLessonClick}
            userPoints={userPoints}
          />
        ))}
      </div>

      {/* Информация о доступе */}
      <div className="access-info">
        <p className="access-text">
          💡 Зарабатывайте очки в канале, чтобы разблокировать новые уроки
        </p>
      </div>
    </div>
  );
}

export default CourseOverview;
