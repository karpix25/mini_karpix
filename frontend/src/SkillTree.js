import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './SkillTree.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Простая конфигурация дерева навыков
const SKILL_TREE = {
  logo: {
    id: 'logo',
    title: 'Karpix',
    x: 50,
    y: 85,
    icon: '🏢'
  },
  root: {
    id: 'foundation',
    title: 'Основа',
    x: 50,
    y: 65,
    icon: '🏗️',
    points: 0
  },
  branches: [
    {
      id: 'frontend',
      title: 'Frontend',
      x: 20,
      y: 45,
      icon: '🌐',
      color: '#4ECDC4',
      skills: [
        { id: 'html', title: 'HTML', x: 15, y: 35, icon: '📄', points: 0 },
        { id: 'css', title: 'CSS', x: 10, y: 25, icon: '🎨', points: 20 },
        { id: 'js', title: 'JavaScript', x: 5, y: 15, icon: '⚡', points: 50 },
        { id: 'react', title: 'React', x: 0, y: 5, icon: '⚛️', points: 100 }
      ]
    },
    {
      id: 'backend',
      title: 'Backend',
      x: 80,
      y: 45,
      icon: '⚙️',
      color: '#45B7D1',
      skills: [
        { id: 'python', title: 'Python', x: 85, y: 35, icon: '🐍', points: 10 },
        { id: 'fastapi', title: 'FastAPI', x: 90, y: 25, icon: '🚀', points: 40 },
        { id: 'database', title: 'Database', x: 95, y: 15, icon: '🗄️', points: 80 },
        { id: 'docker', title: 'Docker', x: 100, y: 5, icon: '🐳', points: 120 }
      ]
    },
    {
      id: 'design',
      title: 'Design',
      x: 35,
      y: 30,
      icon: '🎨',
      color: '#F7DC6F',
      skills: [
        { id: 'figma', title: 'Figma', x: 30, y: 20, icon: '🎭', points: 15 },
        { id: 'ui', title: 'UI Design', x: 25, y: 10, icon: '📱', points: 60 },
        { id: 'ux', title: 'UX Research', x: 20, y: 0, icon: '🔍', points: 110 },
        { id: 'prototype', title: 'Prototype', x: 15, y: -10, icon: '🔧', points: 150 }
      ]
    },
    {
      id: 'marketing',
      title: 'Marketing',
      x: 65,
      y: 30,
      icon: '📈',
      color: '#EC7063',
      skills: [
        { id: 'seo', title: 'SEO', x: 70, y: 20, icon: '🔍', points: 25 },
        { id: 'analytics', title: 'Analytics', x: 75, y: 10, icon: '📊', points: 70 },
        { id: 'ads', title: 'Ads', x: 80, y: 0, icon: '🎯', points: 130 },
        { id: 'social', title: 'Social Media', x: 85, y: -10, icon: '📱', points: 180 }
      ]
    }
  ]
};

// Компонент узла дерева
const TreeNode = ({ node, type, isUnlocked, onClick, scale }) => {
  const nodeSize = type === 'logo' ? 70 : type === 'root' ? 80 : type === 'branch' ? 60 : 50;
  
  return (
    <div
      className={`tree-node tree-node--${type} ${isUnlocked ? 'unlocked' : 'locked'}`}
      style={{
        left: `${node.x}%`,
        top: `${node.y}%`,
        width: `${nodeSize}px`,
        height: `${nodeSize}px`,
        backgroundColor: node.color || (type === 'logo' ? '#667eea' : type === 'root' ? '#8B4513' : '#555'),
        transform: `translate(-50%, -50%) scale(${Math.min(scale, 1.5)})`,
        zIndex: type === 'logo' ? 100 : type === 'root' ? 90 : type === 'branch' ? 80 : 70
      }}
      onClick={() => isUnlocked && onClick?.(node)}
      title={`${node.title} ${node.points !== undefined ? `(${node.points} очков)` : ''}`}
    >
      <div className="node-icon">
        {type === 'logo' ? node.icon : node.icon || (isUnlocked ? '⚡' : '🔒')}
      </div>
      <div className="node-title">{node.title}</div>
    </div>
  );
};

// Компонент соединительных линий
const ConnectionLines = ({ scale }) => {
  return (
    <svg className="connection-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      {/* От логотипа к основе */}
      <line
        x1="50" y1="85"
        x2="50" y2="65"
        stroke="#8B4513"
        strokeWidth={Math.max(0.3, 0.5 * scale)}
        opacity="0.8"
      />
      
      {/* От основы к веткам */}
      {SKILL_TREE.branches.map(branch => (
        <line
          key={`root-${branch.id}`}
          x1="50" y1="65"
          x2={branch.x} y2={branch.y}
          stroke={branch.color}
          strokeWidth={Math.max(0.2, 0.4 * scale)}
          opacity="0.7"
        />
      ))}
      
      {/* Внутри веток */}
      {SKILL_TREE.branches.map(branch =>
        branch.skills.map((skill, index) => (
          <line
            key={`${branch.id}-${skill.id}`}
            x1={index === 0 ? branch.x : branch.skills[index - 1].x}
            y1={index === 0 ? branch.y : branch.skills[index - 1].y}
            x2={skill.x}
            y2={skill.y}
            stroke={branch.color}
            strokeWidth={Math.max(0.1, 0.2 * scale)}
            opacity="0.6"
          />
        ))
      )}
    </svg>
  );
};

function SkillTree() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);

  // Загрузка данных пользователя
  useEffect(() => {
    const fetchUserData = async () => {
      // Если нет Telegram данных, используем моковые данные
      if (!tg?.initData) {
        console.log('No Telegram initData, using mock data');
        setUser({ first_name: 'Test User', rank: 'Новичок' });
        setUserPoints(50);
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
          setUserPoints(userData.points || 0);
        } else {
          setUser({ first_name: 'User', rank: 'Новичок' });
          setUserPoints(0);
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        setUser({ first_name: 'User', rank: 'Новичок' });
        setUserPoints(0);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleNodeClick = (node) => {
    console.log('Clicked node:', node);
    // navigate(`/skill/${node.id}`);
  };

  const isNodeUnlocked = (node) => {
    return userPoints >= (node.points || 0);
  };

  const zoomIn = () => {
    setScale(prev => Math.min(2.5, prev + 0.3));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(0.5, prev - 0.3));
  };

  const resetZoom = () => {
    setScale(1);
  };

  if (loading) {
    return (
      <div className="skill-tree-simple">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Загружается дерево навыков...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="skill-tree-simple">
      {/* Фиксированный UI */}
      <div className="fixed-ui">
        <div className="user-stats">
          <span>⚡ {userPoints} очков</span>
          <span>🏆 {user?.rank || 'Новичок'}</span>
        </div>
        
        <div className="zoom-controls">
          <button onClick={zoomIn}>+</button>
          <button onClick={zoomOut}>−</button>
          <button onClick={resetZoom}>⌂</button>
        </div>
      </div>

      {/* Дерево навыков */}
      <div 
        className="tree-container"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center'
        }}
      >
        {/* Соединительные линии */}
        <ConnectionLines scale={scale} />

        {/* Логотип */}
        <TreeNode
          node={SKILL_TREE.logo}
          type="logo"
          isUnlocked={true}
          scale={scale}
        />

        {/* Корневой узел (Основа) */}
        <TreeNode
          node={SKILL_TREE.root}
          type="root"
          isUnlocked={isNodeUnlocked(SKILL_TREE.root)}
          onClick={handleNodeClick}
          scale={scale}
        />

        {/* Ветки */}
        {SKILL_TREE.branches.map(branch => (
          <TreeNode
            key={branch.id}
            node={branch}
            type="branch"
            isUnlocked={isNodeUnlocked(branch)}
            onClick={handleNodeClick}
            scale={scale}
          />
        ))}

        {/* Навыки */}
        {SKILL_TREE.branches.map(branch =>
          branch.skills.map(skill => (
            <TreeNode
              key={skill.id}
              node={{ ...skill, color: branch.color }}
              type="skill"
              isUnlocked={isNodeUnlocked(skill)}
              onClick={handleNodeClick}
              scale={scale}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default SkillTree;
