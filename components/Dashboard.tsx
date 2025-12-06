import React, { useState } from 'react';
import { AuditSession } from '../types';
import ThreatCard from './ThreatCard';
import ImageAnnotator from './ImageAnnotator';
import { ShieldCheck, ShieldAlert, RefreshCw, ArrowLeft, Volume2, Loader2 } from 'lucide-react';
import { generateAudioGuide } from '../services/geminiService';

interface DashboardProps {
  session: AuditSession;
  onSimulateFix: () => void;
  onReset: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ session, onSimulateFix, onReset }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  if (!session.result) return null;

  const { overallRiskScore, threats } = session.result;
  
  const currentRiskScore = session.isSimulated ? Math.max(5, overallRiskScore - 90) : overallRiskScore;
  const isSecure = currentRiskScore < 20;
  const hasImage = !!session.imageUrl;

  const handleVoiceGuide = async () => {
    if (isPlaying) return;
    setIsLoadingAudio(true);
    try {
        const textToSpeak = `Security Audit Report. I have found ${threats.length} issues. 
        Top priority: ${threats[0].title}. ${threats[0].fixExplanation}. 
        Risk probability is ${threats[0].riskProbability} percent. 
        Say "apply python fix" to simulate remediation.`;

        const audioBuffer = await generateAudioGuide(textToSpeak);
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => setIsPlaying(false);
        source.start();
        setIsPlaying(true);
    } catch (e) {
        console.error("Audio guide failed", e);
        alert("Could not generate audio guide.");
    } finally {
        setIsLoadingAudio(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header Toolbar */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 z-10 sticky top-0">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onReset}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Start New Audit"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Audit Results
          </h2>
        </div>
        
        <div className="flex items-center space-x-4">
             {/* Voice Guide Button */}
            <button
                onClick={handleVoiceGuide}
                disabled={isLoadingAudio || isPlaying}
                className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all border
                    ${isPlaying ? 'border-cyan-500 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}
                `}
            >
                {isLoadingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-pulse' : ''}`} />}
                <span>{isPlaying ? 'Speaking...' : 'Voice Guide Me'}</span>
            </button>

            <div className="h-8 w-px bg-slate-800 mx-2"></div>

            <div className="flex flex-col items-end mr-4">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Current Risk</span>
                <div className={`text-2xl font-black ${isSecure ? 'text-emerald-400' : 'text-rose-500'}`}>
                    {currentRiskScore}<span className="text-sm font-normal text-slate-500">/100</span>
                </div>
            </div>
            <button
                onClick={onSimulateFix}
                disabled={session.isSimulated}
                className={`
                    flex items-center space-x-2 px-6 py-2 rounded-lg font-bold text-sm transition-all
                    ${session.isSimulated 
                        ? 'bg-emerald-900/30 text-emerald-500 cursor-default border border-emerald-500/30' 
                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/30'}
                `}
            >
                {session.isSimulated ? (
                    <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>System Secure</span>
                    </>
                ) : (
                    <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Simulate Fix</span>
                    </>
                )}
            </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-hidden">
        <div className="flex flex-col lg:flex-row h-full">
            
            {/* Left: Visual Analysis (Sticky/Fixed on Desktop) */}
            {hasImage && (
                 <div className="lg:w-3/5 h-[50vh] lg:h-full p-4 bg-slate-950 relative border-b lg:border-b-0 lg:border-r border-slate-800">
                    <ImageAnnotator 
                        imageUrl={session.imageUrl!} 
                        threats={threats} 
                        isSimulated={session.isSimulated}
                    />
                    <div className="absolute bottom-8 left-8 right-8 pointer-events-none">
                        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-xl flex items-center justify-between">
                             <div className="flex items-center space-x-3">
                                {isSecure ? <ShieldCheck className="w-8 h-8 text-emerald-400" /> : <ShieldAlert className="w-8 h-8 text-rose-500" />}
                                <div>
                                    <h3 className="font-bold text-slate-100">{isSecure ? 'Environment Secure' : 'Vulnerabilities Detected'}</h3>
                                    <p className="text-xs text-slate-400">{session.isSimulated ? 'Patches applied successfully.' : `${threats.length} active threats found.`}</p>
                                </div>
                             </div>
                        </div>
                    </div>
                 </div>
            )}

            {/* Right: Threat List & Remediation */}
            <div className={`h-full overflow-y-auto bg-slate-900/50 ${hasImage ? 'lg:w-2/5' : 'w-full max-w-5xl mx-auto'}`}>
                <div className="p-6">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                           <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
                           <span>Prioritized Threats</span>
                        </h3>
                        <p className="text-slate-400 text-sm mt-2 ml-4">
                            Detailed analysis of found vulnerabilities with probabilistic risk assessment.
                        </p>
                    </div>
                    
                    <div className="space-y-2">
                        {threats.map((threat) => (
                            <ThreatCard 
                                key={threat.id} 
                                threat={threat} 
                                isSimulated={session.isSimulated}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;