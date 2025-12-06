import React from 'react';
import { Threat, Severity } from '../types';

interface ImageAnnotatorProps {
  imageUrl: string;
  threats: Threat[];
  isSimulated: boolean;
}

const ImageAnnotator: React.FC<ImageAnnotatorProps> = ({ imageUrl, threats, isSimulated }) => {
  const getBoxColor = (s: Severity) => {
    if (isSimulated) return 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
    switch (s) {
      case Severity.High: return 'border-rose-500 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.3)]';
      case Severity.Medium: return 'border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.3)]';
      case Severity.Low: return 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.3)]';
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
        {/* Image Container */}
        <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
            <img 
                src={imageUrl} 
                alt="Analyzed IoT Setup" 
                className="max-w-full max-h-full object-contain" 
            />
            
            {/* Overlays */}
            {threats.map((threat) => {
                if (!threat.boundingBox) return null;
                const { ymin, xmin, ymax, xmax } = threat.boundingBox;
                
                // Convert 0-1000 scale to percentages
                const top = (ymin / 1000) * 100;
                const left = (xmin / 1000) * 100;
                const height = ((ymax - ymin) / 1000) * 100;
                const width = ((xmax - xmin) / 1000) * 100;

                return (
                    <div
                        key={threat.id}
                        className={`absolute border-2 transition-all duration-500 ${getBoxColor(threat.severity)}`}
                        style={{
                            top: `${top}%`,
                            left: `${left}%`,
                            height: `${height}%`,
                            width: `${width}%`,
                        }}
                    >
                        {/* Label Tag */}
                        <div className={`
                            absolute -top-6 left-0 px-2 py-0.5 text-xs font-bold text-white rounded shadow-sm whitespace-nowrap
                            ${isSimulated ? 'bg-emerald-600' : 
                                threat.severity === Severity.High ? 'bg-rose-600' :
                                threat.severity === Severity.Medium ? 'bg-amber-600' : 'bg-blue-600'}
                        `}>
                             {isSimulated ? 'SAFE' : `! ${threat.severity}`}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default ImageAnnotator;