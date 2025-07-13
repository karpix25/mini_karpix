// src/CourseOverview.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './CourseOverview.css'; // Подключаем наши стили

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

function CourseOverview() {
    const { courseId, lessonId } = useParams();
    const navigate = useNavigate();

    // Состояния из ваших файлов, объединенные в одном месте
    const [course, setCourse] = useState(null);
    const [lessonContent, setLessonContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Для мобильного меню

    // Загрузка данных: один useEffect для курса и контента урока
    useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            if (!tg?.initData) {
                setError("Приложение должно быть открыто в Telegram.");
                setLoading(false); return;
            }
            try {
                const headers = { 'X-Init-Data': tg.initData };
                
                // 1. Всегда загружаем структуру курса
                const courseResponse = await fetch(`${BACKEND_URL}/api/courses/${courseId}`, { headers });
                if (!courseResponse.ok) throw new Error("Ошибка загрузки данных курса");
                const courseData = await courseResponse.json();
                setCourse(courseData);

                // 2. Если есть lessonId в URL, загружаем контент этого урока
                if (lessonId) {
                    const lessonResponse = await fetch(`${BACKEND_URL}/api/courses/${courseId}/lessons/${lessonId}`, { headers });
                    if (!lessonResponse.ok) throw new Error('Не удалось загрузить урок');
                    const lessonData = await lessonResponse.json();
                    setLessonContent(lessonData.content);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [courseId, lessonId]);

    // Ваша функция для отметки о завершении
    const handleMarkComplete = async () => {
        // ... (ваша логика handleMarkComplete)
    };

    // Ваши заглушки для loading/error
    if (loading) { return <div className="loading-state"><div className="loader">Загрузка...</div></div>; }
    if (error) { return <div className="error-state"><p>❌ {error}</p></div>; }
    if (!course) { return <div className="error-state"><p>Курс не найден</p></div>; }
    
    const currentLesson = course.sections?.flatMap(s => s.lessons).find(l => l.id === lessonId);

    return (
        <div className="course-view-container">
            {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
            
            <aside className={`course-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h2 className="course-name">{course.title}</h2>
                </div>
                <div className="sidebar-progress-wrapper">
                    <div className="sidebar-progress-bar">
                        <div className="sidebar-progress-fill" style={{ width: `${course.progress || 0}%` }}>
                            <span>{course.progress || 0}%</span>
                        </div>
                    </div>
                </div>
                <div className="sidebar-content">
                    {course.sections.map(section => (
                        <div key={section.id} className="sidebar-section">
                            <div className="sidebar-section-header">
                                <h3 className="section-title">{section.title}</h3>
                            </div>
                            <ul className="sidebar-lessons-list">
                                {section.lessons.map(l => (
                                    <li key={l.id} className={`sidebar-lesson ${l.id === lessonId ? 'active' : ''}`}
                                        onClick={() => {
                                            navigate(`/course/${courseId}/lesson/${l.id}`);
                                            setIsSidebarOpen(false);
                                        }}>
                                        {l.title}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="course-main-content">
                <div className="mobile-navigation">
                    <button className="sidebar-toggle" onClick={() => setIsSidebarOpen(true)}>☰</button>
                    <span className="mobile-course-title">{course.title}</span>
                </div>

                <div className="lesson-content-wrapper">
                    {lessonId && currentLesson ? (
                        <>
                            <div className="lesson-header">
                                <h1 className="lesson-title">{currentLesson.title}</h1>
                                {/* Кнопка завершения здесь */}
                            </div>
                            {currentLesson.video_url && (
                                <div className="lesson-video-wrapper">
                                    <iframe src={currentLesson.video_url} title={currentLesson.title} frameBorder="0" allowFullScreen></iframe>
                                </div>
                            )}
                            <div className="lesson-markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{lessonContent}</ReactMarkdown>
                            </div>
                        </>
                    ) : (
                        <div className="lesson-placeholder">
                            <h2>Добро пожаловать в курс!</h2>
                            <p>Выберите урок из меню слева, чтобы начать обучение.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default CourseOverview;
