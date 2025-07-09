import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ArticleReader.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент для элемента навигации в sidebar
const LessonItem = ({ lesson, isActive, isCompleted, isLocked, onClick }) => {
  return (
    <div 
      className={`lesson-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}`}
      onClick={!isLocked ? onClick : undefined}
    >
      <div className="lesson-status">
        {isCompleted ? (
          <div className="status-icon completed">✓</div>
        ) : isLocked ? (
          <div className="status-icon locked">🔒</div>
        ) : (
          <div className="status-icon available"></div>
        )}
      </div>
      
      <div className="lesson-content">
        <h4 className="lesson-title">{lesson.title}</h4>
        {lesson.description && (
          <p className="lesson-description">{lesson.description}</p>
        )}
      </div>
      
      {!isLocked && (
        <div className="lesson-arrow">→</div>
      )}
    </div>
  );
};

// Компонент для прогресса курса в sidebar
const CourseProgress = ({ courseName, progress, completedLessons, totalLessons }) => {
  return (
    <div className="course-progress-sidebar">
      <h3 className="course-name">{courseName}</h3>
      <div className="progress-stats">
        <span className="progress-text">{progress}% завершено</span>
        <span className="lessons-stats">{completedLessons}/{totalLessons} уроков</span>
      </div>
      <div className="progress-bar-sidebar">
        <div 
          className="progress-fill-sidebar" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

function ArticleReader() {
  const { articleId } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Моковые данные для демонстрации структуры курса
  const courseData = {
    name: "Основы веб-разработки",
    lessons: [
      { 
        id: "welcome", 
        title: "Добро пожаловать", 
        description: "Введение в курс",
        completed: true 
      },
      { 
        id: "done", 
        title: "Завершение", 
        description: "Подведение итогов",
        completed: false 
      },
      { 
        id: "advanced", 
        title: "Продвинутые техники", 
        description: "Для опытных разработчиков",
        completed: false,
        locked: true 
      }
    ]
  };

  const currentLessonIndex = courseData.lessons.findIndex(l => l.id === articleId);
  const currentLesson = courseData.lessons[currentLessonIndex];
  const completedCount = courseData.lessons.filter(l => l.completed).length;
  const progress = Math.round((completedCount / courseData.lessons.length) * 100);

  useEffect(() => {
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => window.history.back();
      tg.BackButton.onClick(onBackClick);
      return () => tg.BackButton.offClick(onBackClick);
    }
  }, []);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!tg?.initData || !articleId) return;
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/content/${articleId}`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        
        if (!response.ok) throw new Error('Не удалось загрузить статью');
        
        const data = await response.json();
        setArticle(data);
        
        // Проверяем статус завершения (пока моковые данные)
        setIsCompleted(currentLesson?.completed || false);
        
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [articleId, currentLesson]);

  const handleMarkComplete = () => {
    setIsCompleted(!isCompleted);
    // Здесь будет API вызов для сохранения прогресса
    console.log(`Урок ${articleId} отмечен как ${!isCompleted ? 'завершенный' : 'незавершенный'}`);
  };

  const handleLessonSelect = (lessonId) => {
    if (lessonId !== articleId) {
      window.location.href = `/article/${lessonId}`;
    }
    setSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="article-reader">
        <div className="loading-content">Загрузка урока...</div>
      </div>
    );
  }

  return (
    <div className="article-reader">
      {/* Кнопка для открытия sidebar на мобильных */}
      <button 
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        ☰ Содержание
      </button>

      {/* Overlay для закрытия sidebar на мобильных */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

      {/* Левая панель с навигацией */}
      <div className={`course-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <CourseProgress 
          courseName={courseData.name}
          progress={progress}
          completedLessons={completedCount}
          totalLessons={courseData.lessons.length}
        />
        
        <div className="lessons-list">
          {courseData.lessons.map((lesson) => (
            <LessonItem
              key={lesson.id}
              lesson={lesson}
              isActive={lesson.id === articleId}
              isCompleted={lesson.completed}
              isLocked={lesson.locked}
              onClick={() => handleLessonSelect(lesson.id)}
            />
          ))}
        </div>

        {/* Ресурсы */}
        <div className="course-resources">
          <h4>Ресурсы</h4>
          <a href="#" className="resource-link">
            <span className="resource-icon">🔗</span>
            Дополнительные материалы
          </a>
        </div>
      </div>

      {/* Основная область контента */}
      <div className="article-content">
        {/* Заголовок урока */}
        <div className="lesson-header">
          <h1 className="lesson-title">{currentLesson?.title || article?.title || 'Урок'}</h1>
          <button 
            className={`complete-button ${isCompleted ? 'completed' : ''}`}
            onClick={handleMarkComplete}
          >
            {isCompleted ? (
              <>
                <span className="check-icon">✓</span>
                Завершено
              </>
            ) : (
              'Отметить как завершенное'
            )}
          </button>
        </div>

        {/* Браузерная ссылка назад (только для разработки) */}
        {!tg && (
          <Link to="/content" className="back-button">
            ← Назад к курсам
          </Link>
        )}

        {/* Markdown контент */}
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article?.content || "Контент урока загружается..."}
          </ReactMarkdown>
        </div>

        {/* Навигация между уроками */}
        <div className="lesson-navigation">
          {currentLessonIndex > 0 && (
            <Link 
              to={`/article/${courseData.lessons[currentLessonIndex - 1].id}`}
              className="nav-button prev"
            >
              ← Предыдущий урок
            </Link>
          )}
          
          {currentLessonIndex < courseData.lessons.length - 1 && (
            <Link 
              to={`/article/${courseData.lessons[currentLessonIndex + 1].id}`}
              className="nav-button next"
            >
              Следующий урок →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArticleReader;
