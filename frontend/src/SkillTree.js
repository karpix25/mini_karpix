import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './SkillTree.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Конфигурация игрового дерева навыков
const SKILL_TREE = {
  center: {
    id: 'player',
    type: 'avatar'
  },
  branches: [
    {
      id: 'frontend',
      title: 'Frontend',
      angle: 30,
      color: '#4ECDC4',
      skills: [
        { id: 'html', title: 'HTML', points: 0, distance: 120 },
        { id: 'css', title: 'CSS', points: 20, distance: 180 },
        { id: 'js', title: 'JavaScript', points: 50, distance: 240 },
        { id: 'react', title: 'React', points: 100, distance: 300 },
        { id: 'next', title: 'Next.js', points: 150, distance: 360 }
      ]
    },
    {
      id: 'backend',
      title: 'Backend',
      angle: 120,
      color: '#45B7D1',
      skills: [
        { id: 'python', title: 'Python', points: 10, distance: 120 },
        { id: 'fastapi', title: 'FastAPI', points: 40, distance: 180 },
        { id: 'database', title: 'Database', points: 80, distance: 240 },
        { id: 'docker', title: 'Docker', points: 120, distance: 300 }
      ]
    },
    {
      id: 'design',
      title: 'Design',
      angle: 210,
      color: '#F7DC6F',
      skills: [
        { id: 'figma', title: 'Figma', points: 15, distance: 120 },
        { id: 'ui', title: 'UI Design', points: 60, distance: 180 },
        { id: 'ux', title: 'UX Research', points: 110, distance: 240 }
      ]
    },
    {
      id: 'marketing',
      title: 'Marketing',
      angle: 300,
      color: '#EC7063',
      skills: [
        { id: 'seo', title: 'SEO', points: 25, distance: 120 },
        { id: 'analytics', title: 'Analytics', points: 70, distance: 180 },
        { id: 'ads', title: 'Ads', points: 130, distance: 240 }
      ]
    }
  ]
};

// Компонент для звездного фона
const StarField = () => {
  const stars = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    opacity: Math.random() * 0.8 + 0.2
  }));

  return (
    <div className="star-field">
      {stars.map(star => (
        <div
          key={star.id}
          className="star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity
          }}
        />
      ))}
    </div>
  );
};

// Компонент навыка
const SkillNode = ({ skill, branch, isUnlocked, transform, onClick }) => {
  const angleRad = (branch.angle * Math.PI) / 180;
  // МИКРОСКОП ЛОГИКА: расстояние тоже увеличивается при зуме
  const scaledDistance = skill.distance * transform.scale;
  const x = 50 + (Math.cos(angleRad) * scaledDistance) / 10;
  const y = 50 + (Math.sin(angleRad) * scaledDistance) / 10;

  return (
    <div
      className={`skill-node ${isUnlocked ? 'unlocked' : 'locked'}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        backgroundColor: isUnlocked ? branch.color : '#555',
        borderColor: isUnlocked ? 'white' : '#666',
        transform: `translate(-50%, -50%) scale(${Math.min(transform.scale, 1.5)})` // Ограничиваем размер узлов
      }}
      onClick={() => isUnlocked && onClick(skill)}
      title={`${skill.title} (${skill.points} очков)`}
    >
      <div className="skill-icon">
        {isUnlocked ? '⚡' : '🔒'}
      </div>
      <div className="skill-title">{skill.title}</div>
    </div>
  );
};

// Компонент соединительной линии
const ConnectionLine = ({ from, to, branch, transform }) => {
  const fromAngle = (branch.angle * Math.PI) / 180;
  const toAngle = (branch.angle * Math.PI) / 180;
  
  // МИКРОСКОП ЛОГИКА: расстояния линий тоже масштабируются
  const fromDistance = from.distance * transform.scale;
  const toDistance = to.distance * transform.scale;
  
  const fromX = 50 + (Math.cos(fromAngle) * fromDistance) / 10;
  const fromY = 50 + (Math.sin(fromAngle) * fromDistance) / 10;
  const toX = 50 + (Math.cos(toAngle) * toDistance) / 10;
  const toY = 50 + (Math.sin(toAngle) * toDistance) / 10;

  return (
    <svg className="connection-svg">
      <line
        x1={`${fromX}%`}
        y1={`${fromY}%`}
        x2={`${toX}%`}
        y2={`${toY}%`}
        stroke={branch.color}
        strokeWidth={Math.max(2, 3 * Math.min(transform.scale, 1.5))}
        opacity={0.6}
        className="connection-line"
      />
    </svg>
  );
};

// Центральный аватар пользователя
const PlayerAvatar = ({ user, transform }) => {
  const getTelegramAvatarUrl = () => {
    // Получаем аватар напрямую из Telegram WebApp
    if (tg?.initDataUnsafe?.user?.photo_url) {
      return tg.initDataUnsafe.user.photo_url;
    }
    
    // Fallback на данные из API
    if (user?.photo_url) {
      return user.photo_url;
    }
    
    // Генерируем аватар с инициалами
    const firstName = user?.first_name || tg?.initDataUnsafe?.user?.first_name || 'User';
    const initials = firstName.substring(0, 2).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=667eea&color=fff&size=200&font-size=0.6`;
  };

  return (
    <div 
      className="player-avatar"
      style={{
        transform: `translate(-50%, -50%) scale(${Math.min(transform.scale, 1.2)})` // Ограничиваем размер аватара
      }}
    >
      <div className="avatar-ring" />
      <img 
        src={getTelegramAvatarUrl()} 
        alt="Player"
        className="avatar-image"
        onError={(e) => {
          const fallbackName = user?.first_name || 'U';
          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=667eea&color=fff&size=200`;
        }}
      />
    </div>
  );
};

function SkillTree() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  
  const [user, setUser] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Состояние для панорамирования и зума
  const [transform, setTransform] = useState({
    x: 0,
    y: 0,
    scale: 1
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [lastTouch, setLastTouch] = useState({ x: 0, y: 0 });
  const [lastDistance, setLastDistance] = useState(0);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!tg?.initData) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${BACKEND_URL}/api/me`, {
          headers: { 'X-Init-Data': tg.initData }
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setUserPoints(userData.points);
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Вычисляем расстояние между двумя точками касания
  const getDistance = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Обработка touch событий для панорамирования и pinch zoom
  const handleTouchStart = (e) => {
    e.preventDefault();
    
    if (e.touches.length === 1) {
      // Одно касание - панорамирование
      setIsDragging(true);
      setLastTouch({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      });
    } else if (e.touches.length === 2) {
      // Два касания - зум
      setIsDragging(false);
      const distance = getDistance(e.touches[0], e.touches[1]);
      setLastDistance(distance);
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    
    if (e.touches.length === 1 && isDragging) {
      // Панорамирование
      const deltaX = e.touches[0].clientX - lastTouch.x;
      const deltaY = e.touches[0].clientY - lastTouch.y;
      
      setTransform(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastTouch({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      });
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const distance = getDistance(e.touches[0], e.touches[1]);
      if (lastDistance > 0) {
        const scaleDelta = distance / lastDistance;
        setTransform(prev => ({
          ...prev,
          scale: Math.max(0.5, Math.min(3, prev.scale * scaleDelta))
        }));
      }
      setLastDistance(distance);
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length === 0) {
      setIsDragging(false);
      setLastDistance(0);
    }
  };

  // Обработка зума колесиком мыши (для десктопа)
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(3, prev.scale + delta))
    }));
  };

  const handleSkillClick = (skill) => {
    console.log('Clicked skill:', skill);
    // navigate(`/skill/${skill.id}`);
  };

  const isSkillUnlocked = (skill) => {
    return userPoints >= skill.points;
  };

  if (loading) {
    return (
      <div className="skill-tree-game">
        <StarField />
        <div className="loading-game">
          <div className="loading-spinner" />
          <p>Загружается дерево навыков...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="skill-tree-game">
      <StarField />
      
      <div className="game-ui">
        <div className="player-stats">
          <div className="stats-item">
            <span className="stats-icon">⚡</span>
            <span>{userPoints} очков</span>
          </div>
          <div className="stats-item">
            <span className="stats-icon">🏆</span>
            <span>{user?.rank || 'Новичок'}</span>
          </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="skill-tree-canvas"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px)`
        }}
      >
        {/* Соединительные линии */}
        <div className="connections-layer">
          {SKILL_TREE.branches.map(branch => 
            branch.skills.map((skill, index) => {
              if (index === 0) {
                // Соединение от центра к первому навыку
                const angle = (branch.angle * Math.PI) / 180;
                const scaledDistance = skill.distance * transform.scale;
                const endX = 50 + (Math.cos(angle) * scaledDistance) / 10;
                const endY = 50 + (Math.sin(angle) * scaledDistance) / 10;
                
                return (
                  <svg key={`${branch.id}-center`} className="connection-svg">
                    <line
                      x1="50%"
                      y1="50%"
                      x2={`${endX}%`}
                      y2={`${endY}%`}
                      stroke={branch.color}
                      strokeWidth={Math.max(3, 4 * Math.min(transform.scale, 1.5))}
                      opacity={0.8}
                      className="connection-line main-branch"
                    />
                  </svg>
                );
              } else {
                // Соединения между навыками
                return (
                  <ConnectionLine
                    key={`${branch.id}-${index}`}
                    from={branch.skills[index - 1]}
                    to={skill}
                    branch={branch}
                    transform={transform}
                  />
                );
              }
            })
          )}
        </div>

        {/* Центральный аватар */}
        <PlayerAvatar user={user} transform={transform} />

        {/* Навыки */}
        <div className="skills-layer">
          {SKILL_TREE.branches.map(branch =>
            branch.skills.map(skill => (
              <SkillNode
                key={skill.id}
                skill={skill}
                branch={branch}
                isUnlocked={isSkillUnlocked(skill)}
                transform={transform}
                onClick={handleSkillClick}
              />
            ))
          )}
        </div>

        {/* Названия веток */}
        <div className="branch-labels">
          {SKILL_TREE.branches.map(branch => {
            const angle = (branch.angle * Math.PI) / 180;
            const labelDistance = 80 * transform.scale; // Масштабируем расстояние
            const x = 50 + (Math.cos(angle) * labelDistance) / 10;
            const y = 50 + (Math.sin(angle) * labelDistance) / 10;
            
            return (
              <div
                key={branch.id}
                className="branch-label"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  color: branch.color,
                  transform: `translate(-50%, -50%) scale(${Math.min(transform.scale, 1.3)})`
                }}
              >
                {branch.title}
              </div>
            );
          })}
        </div>
      </div>

      {/* Элементы управления */}
      <div className="zoom-controls">
        <button 
          className="zoom-btn"
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale + 0.3) }))}
        >
          +
        </button>
        <button 
          className="zoom-btn"
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.3) }))}
        >
          −
        </button>
        <button 
          className="zoom-btn reset"
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
        >
          ⌂
        </button>
      </div>
    </div>
  );
}

export default SkillTree;
