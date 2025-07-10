import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './LessonReader.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Компонент урока в sidebar
const SidebarLesson = ({ lesson, isActive, onClick, isLocked }) => {
  return (
    <div 
      className={`sidebar-lesson ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''} ${lesson.completed ? 'completed' : ''}`}
      onClick={!isLocked ? onClick : undefined}
    >
      <div className="lesson-icon">
        {isLocked ? '🔒' : lesson.completed ? '✅' : '📄'}
      </div>
      <div className="lesson-details">
        <div className="lesson-title">{lesson.title}</div>
        {lesson.duration && (
          <div className="lesson-duration">{lesson.duration}</div>
        )}
      </div>
    </div>
  );
};

// Компонент раздела в sidebar с toggle
const SidebarSection = ({ section, currentLessonId, onLessonClick, userPoints, isExpanded, onToggle }) => {
  return (
    <div className="sidebar-section">
      <div 
        className={`sidebar-section-header ${isExpanded ? 'expanded' : ''}`}
        onClick={onToggle}
      >
        <div className="section-info">
          <span className="section-icon">{section.icon || '📚'}</span>
          <span className="section-title">{section.title}</span>
        </div>
        <span className={`toggle-arrow ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </div>
      
      {isExpanded && (
        <div className="sidebar-lessons">
          {section.lessons.map((lesson) => {
            const isLocked = userPoints < (lesson.points || 0);
            return (
              <SidebarLesson
                key={lesson.id}
                lesson={lesson}
                isActive={lesson.id === currentLessonId}
                isLocked={isLocked}
                onClick={() => onLessonClick(lesson.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

function LessonReader() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  
  const [course, setCourse] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userPoints, setUserPoints] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Настройка Telegram BackButton
  useEffect(() => {
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => navigate(`/course/${courseId}`);
      tg.BackButton.onClick(onBackClick);
      return () => tg.BackButton.offClick(onBackClick);
    }
  }, [navigate, courseId]);

  // Загрузка данных
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Загружаем данные пользователя
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
            
            // Находим текущий урок
            let currentLesson = null;
            courseData.sections?.forEach(section => {
              const foundLesson = section.lessons.find(l => l.id === lessonId);
              if (foundLesson) {
                currentLesson = foundLesson;
                // Разворачиваем раздел с текущим уроком
                setExpandedSections(prev => ({ ...prev, [section.id]: true }));
              }
            });

            if (currentLesson) {
              // Загружаем контент урока
              const lessonResponse = await fetch(`${BACKEND_URL}/api/courses/${courseId}/lessons/${lessonId}`, {
                headers: { 'X-Init-Data': tg.initData }
              });
              
              if (lessonResponse.ok) {
                const lessonData = await lessonResponse.json();
                setLesson(lessonData);
                setIsCompleted(currentLesson.completed || false);
              }
            }
          }
        } else {
          // Моковые данные для разработки
          const mockCourse = {
            id: courseId,
            title: "Введение в разработку",
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
              }
            ]
          };
          
          setCourse(mockCourse);
          setUserPoints(50);
          
          // Находим раздел с текущим уроком для мока
          mockCourse.sections.forEach(section => {
            const foundLesson = section.lessons.find(l => l.id === lessonId);
            if (foundLesson) {
              setExpandedSections(prev => ({ ...prev, [section.id]: true }));
            }
          });
          
          setLesson({
            id: lessonId,
            title: "Добро пожаловать в курс!",
            content: `# Добро пожаловать в курс!

Это тестовый урок курса "${courseId}".

## Что вы изучите:

- Основы веб-разработки
- Современные технологии
- Практические навыки

## Следующие шаги

1. Изучите материал
2. Выполните практические задания
3. Переходите к следующему уроку

Удачи в обучении! 🚀`
          });
        }
