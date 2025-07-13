// src/CourseLessonList.js

import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { CourseContext } from './CourseLayout';
import useMediaQuery from './hooks/useMediaQuery'; //  <-- ВОТ ИСПРАВЛЕНИЕ: ДОБАВЛЕН ЭТОТ ИМПОРТ
import './CourseLessonList.css';

function CourseLessonList() {
    const { course, courseId } = useContext(CourseContext);
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    if (!course) return null;

    // На десктопе это просто плейсхолдер
    if (isDesktop) {
        return (
            <div className="lesson-placeholder">
                <h2>Добро пожаловать в курс!</h2>
                <p>Выберите урок из меню слева, чтобы начать обучение.</p>
            </div>
        );
    }
    
    // А на мобильных это полноценная страница-список
    return (
        <div className="mobile-lesson-list">
             <div className="mobile-list-header">
                <h1>{course.title}</h1>
                {/* Здесь можно добавить мобильный прогресс-бар */}
             </div>
             {course.sections.map(section => (
                <div key={section.id} className="mobile-section">
                    <h3 className="mobile-section-title">{section.title}</h3>
                    <ul>
                        {section.lessons.map(l => (
                            <li key={l.id}>
                                <Link to={`/course/${courseId}/lesson/${l.id}`} className="mobile-lesson-link">
                                    {l.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
             ))}
        </div>
    );
}

export default CourseLessonList;
