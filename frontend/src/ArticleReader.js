import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ArticleReader.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент для урока в sidebar (десктоп)
const LessonSidebarItem = ({ lesson, isActive, onClick }) => {
  return (
    <div 
      className={`lesson-sidebar-item ${isActive ? 'active' : ''} ${lesson.locked ? 'locked' : ''}`}
      onClick={!lesson.locked ? onClick : undefined}
    >
      <div className="lesson-title">{lesson.title}</div>
    </div>
  );
};

function ArticleReader() {
  const { articleId } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);

  // Моковые данные курса (позже заменим на API)
  const courseData = {
    name: "Обучающие курсы",
    lessons: [
      { 
        id: "welcome", 
        title: "Step 1 → Read This First 🔥", 
        completed: true,
        locked: false
      },
      { 
        id: "done", 
        title: "Step 2 → Getting Started", 
        completed: false,
        locked: false
      },
      { 
        id: "advanced", 
        title: "Step 3 → Advanced Topics", 
        completed: false,
        locked: true
      }
    ]
  };

  const currentLesson = courseData.lessons.find(l => l.id === articleId);
  const currentLessonIndex = courseData.lessons.findIndex(l => l.id === articleId);

  useEffect(() => {
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => navigate('/content');
      tg.BackButton.onClick(onBackClick);
      return () => tg.BackButton.offClick(onBackClick);
    }
  }, [navigate]);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!tg?.initData || !articleId) return;
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/content/${articleId}`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        
        if (!response.ok) throw new Error('Не удалось загрузить урок');
        
        const data = await response.json();
        setArticle(data);
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
    // TODO: API вызов для сохранения прогресса
    console.log(`Урок ${articleId} отмечен как ${!isCompleted ? 'завершенный' : 'незавершенный'}`);
  };

  const handleLessonSelect = (lessonId) => {
    navigate(`/article/${lessonId}`);
  };

  const goBackToContent = () => {
    navigate('/content');
  };

  if (loading) {
    return (
      <div className="article-reader-container">
        <div className="loading-state">Загрузка урока...</div>
      </div>
    );
  }

  return (
    <div className="article-reader-container">
      {/* Левый sidebar для десктопа */}
      <div className="course-sidebar-desktop">
        <div className="sidebar-header">
          <h3 className="course-name">{courseData.name}</h3>
          <div className="progress-info">0%</div>
        </div>
        
        <div className="lessons-sidebar-list">
          {courseData.lessons.map((lesson) => (
            <LessonSidebarItem
              key={lesson.id}
              lesson={lesson}
              isActive={lesson.id === articleId}
              onClick={() => handleLessonSelect(lesson.id)}
            />
          ))}
        </div>
      </div>

      {/* Основная область контента */}
      <div className="article-main-content">
        {/* Мобильная навигация */}
        <div className="mobile-navigation">
          <button className="back-to-menu" onClick={goBackToContent}>
            ← Menu
          </button>
        </div>

        {/* Заголовок урока */}
        <div className="lesson-header">
          <h1 className="lesson-title">
            {currentLesson?.title || article?.title || 'Урок'}
          </h1>
          <button 
            className={`complete-button ${isCompleted ? 'completed' : ''}`}
            onClick={handleMarkComplete}
          >
            {isCompleted ? (
              <div className="completion-check">✓</div>
            ) : (
              <div className="completion-circle"></div>
            )}
          </button>
        </div>

        {/* Markdown контент */}
        <div className="lesson-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article?.content || "Контент урока загружается..."}
          </ReactMarkdown>
        </div>

        {/* Навигация между уроками */}
        <div className="lesson-navigation">
          {currentLessonIndex > 0 && (
            <button 
              className="nav-button prev"
              onClick={() => handleLessonSelect(courseData.lessons[currentLessonIndex - 1].id)}
            >
              ← Previous
            </button>
          )}
          
          {currentLessonIndex < courseData.lessons.length - 1 && (
            <button 
              className="nav-button next"
              onClick={() => handleLessonSelect(courseData.lessons[currentLessonIndex + 1].id)}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArticleReader;
