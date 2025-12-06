import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Copy, Terminal, Zap, ArrowRightCircle } from 'lucide-react';
import { Threat, Severity, FixCategory } from '../types';

interface ThreatCardProps {
  threat: Threat;
  isMitigated: boolean;
  onDropMatch: (category: FixCategory) => void;
}

const ThreatCard: React.FC<ThreatCardProps> = ({ threat, isMitigated, onDropMatch }) => {
  const [expanded, setExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const getSeverityColor = (s: Severity) => {
    if (isMitigated) return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20';
    switch (s) {
      case Severity.High: return 'text-rose-400 border-rose-500/30 bg-rose-950/20';
      case Severity.Medium: return 'text-amber-400 border-amber-500/30 bg-amber-950/20';
      case Severity.Low: return 'text-blue-400 border-blue-500/30 bg-blue-950/20';
    }
  };

  const getBadgeColor = (s: Severity) => {
    if (isMitigated) return 'bg-emerald-500/20 text-emerald-300';
    switch (s) {
      case Severity.High: return 'bg-rose-500/20 text-rose-300';
      case Severity.Medium: return 'bg-amber-500/20 text-amber-300';
      case Severity.Low: return 'bg-blue-500/20 text-blue-300';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const category = e.dataTransfer.getData("fixCategory") as FixCategory;
    if (category) {
        onDropMatch(category);
    }
  };

  return (
    <div 
        className={`border rounded-xl mb-4 overflow-hidden transition-all duration-300 ${getSeverityColor(threat.severity)} ${isDragOver ? 'scale-[1.02] ring-2 ring-cyan-400 shadow-xl shadow-cyan-900/50' : 'border-opacity-50'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      <div 
        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
            <div className="mt-1">
                {isMitigated ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                <AlertTriangle className="w-5 h-5" />
                )}
            </div>
            <div>
                <h4 className={`font-semibold text-lg ${isMitigated ? 'text-slate-300 line-through decoration-emerald-500/50' : 'text-slate-100'}`}>
                {threat.title}
                </h4>
                <div className="flex items-center space-x-2 mt-1">
                     <p className="text-sm text-slate-400">{threat.description}</p>
                     {!isMitigated && (
                         <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                             Req: {threat.fixCategory}
                         </span>
                     )}
                </div>
            </div>
            </div>
            <div className="flex flex-col items-end space-y-2">
                <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider ${getBadgeColor(threat.severity)}`}>
                {isMitigated ? 'SECURED' : threat.severity}
                </span>
                {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </div>
        </div>

        {/* Risk Probability Bar */}
        <div className="mt-4 pt-4 border-t border-white/5">
             <div className="flex items-center justify-between text-xs mb-1 font-mono">
                <span className="text-slate-400">EXPLOIT PROBABILITY</span>
                <span className={isMitigated ? 'text-emerald-400' : 'text-rose-400'}>
                    {isMitigated ? `${threat.mitigatedRiskProbability}%` : `${threat.riskProbability}%`}
                </span>
             </div>
             <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden relative">
                 {/* Before Fix Bar */}
                 <div 
                    className="absolute top-0 left-0 h-full bg-rose-500 transition-all duration-1000 ease-out" 
                    style={{ width: `${threat.riskProbability}%`, opacity: isMitigated ? 0.2 : 1 }}
                 />
                 {/* After Fix Bar (Simulated) */}
                 <div 
                    className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-1000 ease-out" 
                    style={{ width: `${isMitigated ? threat.mitigatedRiskProbability : 0}%` }}
                 />
             </div>
             {isMitigated && (
                 <p className="text-xs text-emerald-400/80 mt-1 font-mono flex items-center">
                     <Zap className="w-3 h-3 mr-1" />
                     {threat.fixCategory} Patch applied: Risk reduced by {threat.riskProbability - threat.mitigatedRiskProbability}%
                 </p>
             )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 bg-slate-900/50">
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 text-slate-300">
                    <Terminal className="w-4 h-4 text-cyan-500" />
                    <span className="text-sm font-semibold">
                        {isMitigated ? 'Active Patch Code' : 'Suggested Fix Code'}
                    </span>
                </div>
                <button 
                  className="text-slate-500 hover:text-cyan-400 transition-colors"
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(threat.fixCode); }}
                >
                    <Copy className="w-4 h-4" />
                </button>
            </div>
            <div className="relative">
                <pre className={`p-4 rounded-lg overflow-x-auto border text-sm font-mono transition-colors duration-500 ${isMitigated ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-100/90' : 'bg-slate-950 border-slate-800 text-cyan-100/90'}`}>
                    <code>{threat.fixCode}</code>
                </pre>
            </div>
            <p className="mt-3 text-sm text-slate-400 italic border-l-2 border-cyan-500/30 pl-3">
                {threat.fixExplanation}
            </p>
            {!isMitigated && (
                <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20 text-xs text-blue-300 flex items-center">
                    <ArrowRightCircle className="w-4 h-4 mr-2" />
                    Drag the "{threat.fixCategory}" module here to simulate this fix.
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreatCard;