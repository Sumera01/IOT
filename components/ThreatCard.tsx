import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Copy, Terminal, Zap } from 'lucide-react';
import { Threat, Severity } from '../types';

interface ThreatCardProps {
  threat: Threat;
  isSimulated: boolean;
}

const ThreatCard: React.FC<ThreatCardProps> = ({ threat, isSimulated }) => {
  const [expanded, setExpanded] = useState(false);

  const getSeverityColor = (s: Severity) => {
    if (isSimulated) return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20';
    switch (s) {
      case Severity.High: return 'text-rose-400 border-rose-500/30 bg-rose-950/20';
      case Severity.Medium: return 'text-amber-400 border-amber-500/30 bg-amber-950/20';
      case Severity.Low: return 'text-blue-400 border-blue-500/30 bg-blue-950/20';
    }
  };

  const getBadgeColor = (s: Severity) => {
    if (isSimulated) return 'bg-emerald-500/20 text-emerald-300';
    switch (s) {
      case Severity.High: return 'bg-rose-500/20 text-rose-300';
      case Severity.Medium: return 'bg-amber-500/20 text-amber-300';
      case Severity.Low: return 'bg-blue-500/20 text-blue-300';
    }
  };

  return (
    <div className={`border rounded-xl mb-4 overflow-hidden transition-all duration-300 ${getSeverityColor(threat.severity)} border-opacity-50`}>
      <div 
        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
            <div className="mt-1">
                {isSimulated ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                <AlertTriangle className="w-5 h-5" />
                )}
            </div>
            <div>
                <h4 className={`font-semibold text-lg ${isSimulated ? 'text-slate-300 line-through' : 'text-slate-100'}`}>
                {threat.title}
                </h4>
                <p className="text-sm text-slate-400 mt-1">{threat.description}</p>
            </div>
            </div>
            <div className="flex flex-col items-end space-y-2">
                <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wider ${getBadgeColor(threat.severity)}`}>
                {isSimulated ? 'SECURED' : threat.severity}
                </span>
                {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </div>
        </div>

        {/* Risk Probability Bar */}
        <div className="mt-4 pt-4 border-t border-white/5">
             <div className="flex items-center justify-between text-xs mb-1 font-mono">
                <span className="text-slate-400">EXPLOIT PROBABILITY</span>
                <span className={isSimulated ? 'text-emerald-400' : 'text-rose-400'}>
                    {isSimulated ? `${threat.mitigatedRiskProbability}%` : `${threat.riskProbability}%`}
                </span>
             </div>
             <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden relative">
                 {/* Before Fix Bar */}
                 <div 
                    className="absolute top-0 left-0 h-full bg-rose-500 transition-all duration-1000 ease-out" 
                    style={{ width: `${threat.riskProbability}%`, opacity: isSimulated ? 0.2 : 1 }}
                 />
                 {/* After Fix Bar (Simulated) */}
                 <div 
                    className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-1000 ease-out" 
                    style={{ width: `${isSimulated ? threat.mitigatedRiskProbability : 0}%` }}
                 />
             </div>
             {isSimulated && (
                 <p className="text-xs text-emerald-400/80 mt-1 font-mono">
                     <Zap className="w-3 h-3 inline mr-1" />
                     Fix reduces risk by {threat.riskProbability - threat.mitigatedRiskProbability}%
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
                    <span className="text-sm font-semibold">Suggested Fix (Python)</span>
                </div>
                <button 
                  className="text-slate-500 hover:text-cyan-400 transition-colors"
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(threat.fixCode); }}
                >
                    <Copy className="w-4 h-4" />
                </button>
            </div>
            <div className="relative">
                <pre className="bg-slate-950 p-4 rounded-lg overflow-x-auto border border-slate-800 text-sm text-cyan-100/90 font-mono">
                    <code>{threat.fixCode}</code>
                </pre>
            </div>
            <p className="mt-3 text-sm text-slate-400 italic border-l-2 border-cyan-500/30 pl-3">
                {threat.fixExplanation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreatCard;