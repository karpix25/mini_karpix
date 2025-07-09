import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './ArticleReader.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";
function ArticleReader() {
  const { articleId } = useParams(); // Получаем ID статьи из URL
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Показываем системную кнопку "Назад" в Telegram
    if (tg) {
      tg.BackButton.show();
      const onBackClick = () => window.history.back();
      tg.BackButton.onClick(onBackClick);
      // Убираем обработчик при размонтировании
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
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
  }, [articleId]);

  if (loading) {
    return <div className="reader-container">Загрузка статьи...</div>;
  }

  return (
    <div className="reader-container">
      {/* Ссылка "Назад" для отладки в браузере */}
      {!tg && <Link to="/content" className="back-button">← Назад к списку</Link>}
      <div className="markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {article?.content || "Статья не найдена."}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default ArticleReader;
