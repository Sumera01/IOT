import React from 'react';
import { Lock, Network, Key, Shield, Cpu } from 'lucide-react';
import { FixModule } from '../types';

interface FixModuleCardProps {
  module: FixModule;
}

const FixModuleCard: React.FC<FixModuleCardProps> = ({ module }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Lock': return <Lock className="w-5 h-5" />;
      case 'Network': return <Network className="w-5 h-5" />;
      case 'Key': return <Key className="w-5 h-5" />;
      case 'Cpu': return <Cpu className="w-5 h-5" />;
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
      className="p-3 bg-slate-800 border border-slate-700 rounded-xl cursor-grab active:cursor-grabbing hover:bg-slate-700 hover:border-cyan-500 transition-all hover:scale-105 group shadow-lg"
    >
      <div className="flex items-center space-x-3 mb-2">
        <div className="p-2 rounded-lg bg-slate-900 text-cyan-400 group-hover:text-cyan-300">
          {getIcon(module.icon)}
        </div>
        <h4 className="font-semibold text-sm text-slate-200">{module.label}</h4>
      </div>
      <p className="text-xs text-slate-500 leading-tight">
        {module.description}
      </p>
    </div>
  );
};

export default FixModuleCard;