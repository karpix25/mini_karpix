import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SkillTree.css';

const tg = window.Telegram?.WebApp;
const BACKEND_URL = "https://miniback.karpix.com";

// Конфигурация дерева
const TREE_CONFIG = {
  title: "Дерево развития",
  trunk: [
    { id: "intro", title: "Введение", points_required: 0 },
    { id: "basics", title: "Основы", points_required: 10 }
  ],
  branches: [
    {
      id: "frontend",
      title: "Frontend",
      angle: 45,
      color: "#4facfe",
      topics: [
        { id: "html", title: "HTML", points_required: 20 },
        { id: "css", title: "CSS", points_required: 50 },
        { id: "javascript", title: "JavaScript", points_required: 100 },
        { id: "react", title: "React", points_required: 200 }
      ]
    },
    {
      id: "backend",
      title: "Backend", 
      angle: 135,
      color: "#43e97b",
      topics: [
        { id: "python", title: "Python", points_required: 30 },
        { id: "django", title: "Django", points_required: 80 },
        { id: "api", title: "REST API", points_required: 150 },
        { id: "database", title: "Databases", points_required: 250 }
      ]
    },
    {
      id: "design",
      title: "Design",
      angle: 225, 
      color: "#fa709a",
      topics: [
        { id: "figma", title: "Figma", points_required: 40 },
        { id: "ui", title: "UI Design", points_required: 90 },
        { id: "ux", title: "UX Research", points_required: 180 }
      ]
    },
    {
      id: "marketing",
      title: "Marketing",
      angle: 315,
      color: "#667eea", 
      topics: [
        { id: "seo", title: "SEO", points_required: 35 },
        { id: "analytics", title: "Analytics", points_required: 70 },
        { id: "ads", title: "Реклама", points_required: 120 }
      ]
    }
  ]
};

// Вычисляет позиции узлов
const calculateNodePositions = (userPoints) => {
  const nodes = [];
  const connections = [];
  
  // Ствол дерева
  TREE_CONFIG.trunk.forEach((topic, index) => {
    const status = userPoints >= topic.points_required ? 'available' : 'locked';
    nodes.push({
      ...topic,
      x: 50,
      y: 10 + (index * 20),
      type: 'trunk',
      status
    });
    
    // Соединения в стволе
    if (index > 0) {
      connections.push({
        from: TREE_CONFIG.trunk[index - 1].id,
        to: topic.id
      });
    }
  });
  
  // Ветки
  TREE_CONFIG.branches.forEach(branch => {
    const startX = 50;
    const startY = 35; // От конца ствола
    const angle = branch.angle * (Math.PI / 180);
    
    branch.topics.forEach((topic, index) => {
      const distance = 25 + (index * 30);
      const x = startX + Math.cos(angle) * distance;
      const y = startY + Math.sin(angle) * distance;
      
      const status = userPoints >= topic.points_required ? 'available' : 'locked';
      
      nodes.push({
        ...topic,
        x: Math.max(5, Math.min(95, x)), // Ограничиваем границами
        y: Math.max(5, Math.min(95, y)),
        branch: branch.id,
        branchColor: branch.color,
        type: 'branch',
        status
      });
      
      // Соединение с предыдущим узлом или стволом
      const fromId = index === 0 ? 'basics' : branch.topics[index - 1].id;
      connections.push({
        from: fromId,
        to: topic.id,
        color: branch.color
      });
    });
  });
  
  return { nodes, connections };
};

// Компонент узла
const TreeNode = ({ node, onClick }) => {
  const getNodeStyle = () => {
    const baseStyle = {
      position: 'absolute',
      left: `${node.x}%`,
      top: `${node.y}%`,
      transform: 'translate(-50%, -50%)',
      width: '60px',
      height: '60px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: node.status === 'available' ? 'pointer' : 'not-allowed',
      transition: 'all 0.3s ease',
      fontSize: '24px',
      fontWeight: 'bold',
      border: '3px solid',
      zIndex: 10
    };
    
    if (node.status === 'locked') {
      return {
        ...baseStyle,
        backgroundColor: '#666',
        borderColor: '#444',
        color: '#999',
        opacity: 0.5
      };
    }
    
    if (node.type === 'trunk') {
      return {
        ...baseStyle,
        backgroundColor: '#8B4513',
        borderColor: '#654321',
        color: 'white'
      };
    }
    
    return {
      ...baseStyle,
      backgroundColor: node.branchColor || '#4facfe',
      borderColor: 'white',
      color: 'white',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    };
  };
  
  return (
    <div 
      className="tree-node"
      style={getNodeStyle()}
      onClick={() => node.status === 'available' && onClick(node)}
      title={`${node.title} (${node.points_required} очков)`}
    >
      {node.status === 'locked' ? '🔒' : '📚'}
    </div>
  );
};

// Компонент соединения
const Connection = ({ connection, nodes }) => {
  const fromNode = nodes.find(n => n.id === connection.from);
  const toNode = nodes.find(n => n.id === connection.to);
  
  if (!fromNode || !toNode) return null;
  
  return (
    <line
      x1={`${fromNode.x}%`}
      y1={`${fromNode.y}%`}
      x2={`${toNode.x}%`}
      y2={`${toNode.y}%`}
      stroke={connection.color || '#8B4513'}
      strokeWidth="3"
      opacity="0.7"
    />
  );
};

function SkillTree() {
  const navigate = useNavigate();
  const [userPoints, setUserPoints] = useState(0);
  const [treeData, setTreeData] = useState({ nodes: [], connections: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserProgress = async () => {
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
          setUserPoints(userData.points);
          setTreeData(calculateNodePositions(userData.points));
        }
      } catch (error) {
        console.error('Ошибка загрузки прогресса:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProgress();
  }, []);

  const handleNodeClick = (node) => {
    // Переход к курсу/теме
    navigate(`/course/${node.id}`);
  };

  if (loading) {
    return (
      <div className="skill-tree-container">
        <div className="loading">Загрузка дерева развития...</div>
      </div>
    );
  }

  return (
    <div className="skill-tree-container">
      <div className="tree-header">
        <h1>🌳 Дерево развития</h1>
        <p>Ваш прогресс: {userPoints} очков</p>
      </div>
      
      <div className="tree-canvas">
        {/* SVG для соединений */}
        <svg className="tree-connections">
          {treeData.connections.map((connection, index) => (
            <Connection 
              key={index} 
              connection={connection} 
              nodes={treeData.nodes} 
            />
          ))}
        </svg>
        
        {/* Узлы дерева */}
        {treeData.nodes.map(node => (
          <TreeNode 
            key={node.id} 
            node={node} 
            onClick={handleNodeClick}
          />
        ))}
      </div>
      
      {/* Легенда */}
      <div className="tree-legend">
        <div className="legend-item">
          <span className="legend-icon">🔒</span>
          <span>Заблокировано</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon">📚</span>
          <span>Доступно</span>
        </div>
      </div>
    </div>
  );
}

export default SkillTree;
