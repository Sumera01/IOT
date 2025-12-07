
import React from 'react';
import { Lock, Network, Key, Shield, Cpu, Activity, Database } from 'lucide-react';
import { FixModule, FixCategory } from '../types';

interface FixModuleCardProps {
  module: FixModule;
  onClick?: (category: FixCategory) => void;
  isRecommended?: boolean;
}

const FixModuleCard: React.FC<FixModuleCardProps> = ({ module, onClick, isRecommended }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Lock': return <Lock className="w-5 h-5" />;
      case 'Network': return <Network className="w-5 h-5" />;
      case 'Key': return <Key className="w-5 h-5" />;
      case 'Cpu': return <Cpu className="w-5 h-5" />;
      case 'Activity': return <Activity className="w-5 h-5" />;
      case 'Database': return <Database className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("fixCategory", module.category);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick && onClick(module.category)}
      className={`
        p-3 rounded-xl cursor-pointer active:cursor-grabbing transition-all hover:scale-105 group shadow-lg flex flex-col justify-between h-full touch-manipulation select-none relative
        ${isRecommended 
            ? 'bg-blue-950/40 border-2 border-cyan-500/60 hover:bg-blue-900/50 shadow-cyan-500/20' 
            : 'bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-cyan-500'}
      `}
      title={isRecommended ? "Recommended Fix" : "Drag or Tap to Apply"}
    >
      {isRecommended && (
          <div className="absolute -top-2 -right-2 w-3 h-3 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)] z-10"></div>
      )}
      
      <div className="flex items-center space-x-3 mb-2 pointer-events-none">
        <div className={`p-2 rounded-lg ${isRecommended ? 'bg-cyan-900/50 text-cyan-300' : 'bg-slate-900 text-cyan-400 group-hover:text-cyan-300'}`}>
          {getIcon(module.icon)}
        </div>
        <h4 className={`font-semibold text-sm ${isRecommended ? 'text-white' : 'text-slate-200'}`}>{module.label}</h4>
      </div>
      <p className={`text-xs leading-tight pointer-events-none ${isRecommended ? 'text-slate-300' : 'text-slate-500'}`}>
        {module.description}
      </p>
    </div>
  );
};

export default FixModuleCard;
