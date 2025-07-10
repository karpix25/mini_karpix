import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './SkillTree.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Гибридная конфигурация дерева навыков
const SKILL_TREE_CONFIG = {
  logo: {
    id: 'logo',
    title: 'Karpix',
    type: 'logo'
  },
  root: {
    id: 'foundation',
    title: 'Основа',
    icon: '🏗️',
    points: 0
  },
  branches: [
    {
      id: 'frontend',
      title: 'Frontend',
      icon: '🌐',
      color: '#4ECDC4',
      skills: [
        { id: 'html', title: 'HTML', icon: '📄', points: 0 },
        { id: 'css', title: 'CSS', icon: '🎨', points: 20 },
        { id: 'js', title: 'JavaScript', icon: '⚡', points: 50 },
        { id: 'react', title: 'React', icon: '⚛️', points: 100 }
      ]
    },
    {
      id: 'backend',
      title: 'Backend',
      icon: '⚙️',
      color: '#45B7D1',
      skills: [
        { id: 'python', title: 'Python', icon: '🐍', points: 10 },
        { id: 'fastapi', title: 'FastAPI', icon: '🚀', points: 40 },
        { id: 'database', title: 'Database', icon: '🗄️', points: 80 }
      ]
    },
    {
      id: 'design',
      title: 'Design',
      icon: '🎨',
      color: '#F7DC6F',
      skills: [
        { id: 'figma', title: 'Figma', icon: '🎭', points: 15 },
        { id: 'ui', title: 'UI Design', icon: '📱', points: 60 }
      ]
    },
    {
      id: 'marketing',
      title: 'Marketing',
      icon: '📈',
      color: '#EC7063',
      skills: [
        { id: 'seo', title: 'SEO', icon: '🔍', points: 25 },
        { id: 'analytics', title: 'Analytics', icon: '📊', points: 70 }
      ]
    }
  ]
};

// Автоматический расчет позиций (адаптивный алгоритм)
const calculatePositions = (branches, scale = 1, viewportWidth, viewportHeight) => {
  const positions = {
    logo: { x: 50, y: 15 },
    root: { x: 50, y: 35 },
    branches: [],
    skills: []
  };

  const baseDistance = Math.min(viewportWidth, viewportHeight) * 0.15 * scale;
  const angleStep = 360 / branches.length;

  branches.forEach((branch, branchIndex) => {
    const angle = (angleStep * branchIndex) * (Math.PI / 180);
    
    // Позиция главного узла ветки
    const branchX = 50 + (Math.cos(angle) * baseDistance * 0.8) / (viewportWidth / 100);
    const branchY = 35 + (Math.sin(angle) * baseDistance * 0.8) / (viewportHeight / 100);
    
    positions.branches.push({
      id: branch.id,
      x: Math.max(10, Math.min(90, branchX)),
      y: Math.max(20, Math.min(80, branchY)),
      color: branch.color
    });

    // Позиции навыков в ветке
    branch.skills.forEach((skill, skillIndex) => {
      const skillDistance = baseDistance * (0.4 + skillIndex * 0.3);
      const skillX = 50 + (Math.cos(angle) * skillDistance) / (viewportWidth / 100);
      const skillY = 35 + (Math.sin(angle) * skillDistance) / (viewportHeight / 100);
      
      positions.skills.push({
        ...skill,
        branchId: branch.id,
        x: Math.max(5, Math.min(95, skillX)),
        y: Math.max(15, Math.min(85, skillY)),
        color: branch.color,
        index: skillIndex
      });
    });
  });

  return positions;
};

// Оптимизированный Canvas для соединений
const ConnectionCanvas = React.memo(({ positions, dimensions, scale }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;
    
    // Устанавливаем размеры
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    // Очищаем
    ctx.clearRect(0, 0, width, height);
    
    // Рисуем соединения от корня к веткам
    positions.branches.forEach(branch => {
      ctx.beginPath();
      ctx.moveTo(
        (positions.root.x * width) / 100,
        (positions.root.y * height) / 100
      );
      ctx.lineTo(
        (branch.x * width) / 100,
        (branch.y * height) / 100
      );
      ctx.strokeStyle = branch.color;
      ctx.lineWidth = Math.max(2, 4 * Math.min(scale, 1.5));
      ctx.stroke();
    });

    // Рисуем соединения внутри веток
    SKILL_TREE_CONFIG.branches.forEach(branchConfig => {
      const branchPos = positions.branches.find(b => b.id === branchConfig.id);
      if (!branchPos) return;

      branchConfig.skills.forEach((skill, index) => {
        const skillPos = positions.skills.find(s => s.id === skill.id);
        if (!skillPos) return;

        ctx.beginPath();
        if (index === 0) {
          // Соединение от ветки к первому навыку
          ctx.moveTo(
            (branchPos.x * width) / 100,
            (branchPos.y * height) / 100
          );
        } else {
          // Соединение между навыками
          const prevSkill = positions.skills.find(s => 
            s.branchId === branchConfig.id && s.index === index - 1
          );
          if (prevSkill) {
            ctx.moveTo(
              (prevSkill.x * width) / 100,
              (prevSkill.y * height) / 100
            );
          }
        }
        
        ctx.lineTo(
          (skillPos.x * width) / 100,
          (skillPos.y * height) / 100
        );
        ctx.strokeStyle = branchPos.color;
        ctx.lineWidth = Math.max(1, 2 * Math.min(scale, 1.5));
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    });

  }, [positions, dimensions, scale]);

  return (
    <canvas
      ref={canvasRef}
      className="connection-canvas"
      style={{
        width: dimensions.width,
        height: dimensions.height,
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none'
      }}
    />
  );
});

// Компонент узла
const TreeNode = React.memo(({ node, type, isUnlocked, onClick, scale }) => {
  const nodeSize = type === 'logo' ? 60 : type === 'root' ? 80 : type === 'branch' ? 70 : 60;
  const scaledSize = Math.max(40, nodeSize * Math.min(scale, 1.3));

  return (
    <div
      className={`tree-node tree-node--${type} ${isUnlocked ? 'unlocked' : 'locked'}`}
      style={{
        left: `${node.x}%`,
        top: `${node.y}%`,
        width: `${scaledSize}px`,
        height: `${scaledSize}px`,
        backgroundColor: node.color || (type === 'logo' ? '#667eea' : type === 'root' ? '#8B4513' : '#555'),
        transform: `translate(-50%, -50%)`,
        zIndex: type === 'logo' ? 100 : type === 'root' ? 90 : type === 'branch' ? 80 : 70
      }}
      onClick={() => isUnlocked && onClick?.(node)}
      title={node.title}
    >
      <div className="node-icon">
        {type === 'logo' ? '🏢' : node.icon || (isUnlocked ? '⚡' : '🔒')}
      </div>
      <div className="node-title">{node.title}</div>
    </div>
  );
});

function SkillTree() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [user, setUser] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Оптимизированное состояние
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [positions, setPositions] = useState(null);
  
  // Touch состояние
  const [isDragging, setIsDragging] = useState(false);
  const [lastTouch, setLastTouch] = useState({ x: 0, y: 0 });
  const [lastDistance, setLastDistance] = useState(0);

  // Дебаунсированное обновление позиций
  const updatePositions = useCallback(() => {
    if (dimensions.width && dimensions.height) {
      const newPositions = calculatePositions(
        SKILL_TREE_CONFIG.branches,
        transform.scale,
        dimensions.width,
        dimensions.height
      );
      setPositions(newPositions);
    }
  }, [dimensions, transform.scale]);

  // Обновление размеров
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Обновление позиций при изменении
  useEffect(() => {
    const timeoutId = setTimeout(updatePositions, 16); // 60fps throttle
    return () => clearTimeout(timeoutId);
  }, [updatePositions]);

  // Загрузка данных пользователя
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

  // Вычисляем расстояние между касаниями
  const getDistance = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Оптимизированные touch события
  const handleTouchStart = useCallback((e) => {
    e.preventDefault();
    
    if (e.touches.length === 1) {
      setIsDragging(true);
      setLastTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      setLastDistance(getDistance(e.touches[0], e.touches[1]));
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    
    if (e.touches.length === 1 && isDragging) {
      const deltaX = e.touches[0].clientX - lastTouch.x;
      const deltaY = e.touches[0].clientY - lastTouch.y;
      
      setTransform(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      const distance = getDistance(e.touches[0], e.touches[1]);
      if (lastDistance > 0) {
        const scaleDelta = distance / lastDistance;
        setTransform(prev => ({
          ...prev,
          scale: Math.max(0.5, Math.min(2.5, prev.scale * scaleDelta))
        }));
      }
      setLastDistance(distance);
    }
  }, [isDragging, lastTouch, lastDistance]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setLastDistance(0);
  }, []);

  // Wheel zoom для десктопа
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(2.5, prev.scale + delta))
    }));
  }, []);

  const handleNodeClick = useCallback((node) => {
    console.log('Clicked node:', node);
    // navigate(`/skill/${node.id}`);
  }, []);

  const isNodeUnlocked = useCallback((node) => {
    return userPoints >= (node.points || 0);
  }, [userPoints]);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 });
  }, []);

  if (loading) {
    return (
      <div className="skill-tree-hybrid">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Загружается дерево навыков...</p>
        </div>
      </div>
    );
  }

  if (!positions) {
    return <div className="skill-tree-hybrid">Инициализация...</div>;
  }

  return (
    <div className="skill-tree-hybrid">
      {/* Фиксированный UI */}
      <div className="fixed-ui">
        <div className="user-stats">
          <span>⚡ {userPoints} очков</span>
          <span>🏆 {user?.rank || 'Новичок'}</span>
        </div>
        
        <div className="zoom-controls">
          <button onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(2.5, prev.scale + 0.3) }))}>+</button>
          <button onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.3) }))}>−</button>
          <button onClick={resetView}>⌂</button>
        </div>
      </div>

      {/* Основной контейнер */}
      <div 
        ref={containerRef}
        className="tree-container"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
        }}
      >
        {/* Canvas для соединений */}
        <ConnectionCanvas 
          positions={positions} 
          dimensions={dimensions} 
          scale={transform.scale} 
        />

        {/* Логотип */}
        <TreeNode
          node={SKILL_TREE_CONFIG.logo}
          type="logo"
          isUnlocked={true}
          scale={transform.scale}
        />

        {/* Корневой узел */}
        <TreeNode
          node={{ ...SKILL_TREE_CONFIG.root, ...positions.root }}
          type="root"
          isUnlocked={isNodeUnlocked(SKILL_TREE_CONFIG.root)}
          onClick={handleNodeClick}
          scale={transform.scale}
        />

        {/* Ветки */}
        {positions.branches.map((branch, index) => (
          <TreeNode
            key={branch.id}
            node={{ ...SKILL_TREE_CONFIG.branches[index], ...branch }}
            type="branch"
            isUnlocked={isNodeUnlocked(SKILL_TREE_CONFIG.branches[index])}
            onClick={handleNodeClick}
            scale={transform.scale}
          />
        ))}

        {/* Навыки */}
        {positions.skills.map(skill => (
          <TreeNode
            key={skill.id}
            node={skill}
            type="skill"
            isUnlocked={isNodeUnlocked(skill)}
            onClick={handleNodeClick}
            scale={transform.scale}
          />
        ))}
      </div>
    </div>
  );
}

export default SkillTree;
