import React, { useState, useEffect, useRef } from 'react';
import { AuditSession, FixModule, FixCategory, Threat } from '../types';
import ThreatCard from './ThreatCard';
import ImageAnnotator from './ImageAnnotator';
import FixModuleCard from './FixModuleCard';
import { ShieldCheck, ShieldAlert, ArrowLeft, Volume2, Loader2, Mic, MicOff } from 'lucide-react';
import { generateAudioGuide } from '../services/geminiService';

interface DashboardProps {
  session: AuditSession;
  onSimulateFix: () => void; // Deprecated but kept for compatibility if needed
  onReset: () => void;
}

const FIX_MODULES: FixModule[] = [
  { id: 'fix-enc', category: 'Encryption', label: 'Enable TLS/SSL', icon: 'Lock', description: 'Encrypts data in transit to prevent interception.' },
  { id: 'fix-net', category: 'Network', label: 'Firewall Rules', icon: 'Network', description: 'Blocks unauthorized ports and limits traffic.' },
  { id: 'fix-auth', category: 'Authentication', label: 'Strong Auth', icon: 'Key', description: 'Enforces robust passwords or MFA.' },
  { id: 'fix-dev', category: 'Device', label: 'Firmware Update', icon: 'Cpu', description: 'Patches known vulnerabilities in device OS.' },
];

const Dashboard: React.FC<DashboardProps> = ({ session, onReset }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  
  // Simulation State
  const [appliedCategories, setAppliedCategories] = useState<FixCategory[]>([]);
  const [currentScore, setCurrentScore] = useState(session.result?.overallRiskScore || 0);
  
  // Voice Command State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  if (!session.result) return null;
  const { threats } = session.result;
  const hasImage = !!session.imageUrl;

  // Initialize Speech Recognition for Commands
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
        console.log("Command received:", transcript);
        processVoiceCommand(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
         // Auto-restart if we want continuous, but let's require manual toggle for better UX
         if (isListening) recognitionRef.current.start(); 
      };
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Start failed", e);
      }
    }
  };

  const processVoiceCommand = (text: string) => {
    // Simple keyword matching for demo
    if (text.includes("encryption") || text.includes("tls") || text.includes("ssl")) applyFix('Encryption');
    if (text.includes("firewall") || text.includes("network") || text.includes("port")) applyFix('Network');
    if (text.includes("auth") || text.includes("password") || text.includes("login")) applyFix('Authentication');
    if (text.includes("firmware") || text.includes("update") || text.includes("patch")) applyFix('Device');
    if (text.includes("reset") || text.includes("clear")) setAppliedCategories([]);
  };

  const applyFix = (category: FixCategory) => {
    if (!appliedCategories.includes(category)) {
      setAppliedCategories(prev => [...prev, category]);
      // Play a small sound or feedback?
    }
  };

  // Recalculate score whenever fixes change
  useEffect(() => {
    if (!session.result) return;
    
    // Base score
    let score = session.result.overallRiskScore;
    
    // Subtract risk for each mitigated threat
    session.result.threats.forEach(t => {
        if (appliedCategories.includes(t.fixCategory)) {
            const reduction = t.riskProbability - t.mitigatedRiskProbability;
            // Approximate score impact based on threat reduction
            // Assuming overall score is loosely an average or max of risks
            // Let's proportionally reduce overall score
            score -= (reduction * 0.5); 
        }
    });

    setCurrentScore(Math.max(0, Math.round(score)));
  }, [appliedCategories, session.result]);

  const handleVoiceGuide = async () => {
    if (isPlaying) return;
    setIsLoadingAudio(true);
    try {
        const activeThreats = threats.filter(t => !appliedCategories.includes(t.fixCategory));
        const mitigatedCount = threats.length - activeThreats.length;
        
        let textToSpeak = "";
        if (mitigatedCount > 0) {
            textToSpeak += `You have successfully mitigated ${mitigatedCount} threats. `;
        }
        
        if (activeThreats.length > 0) {
            textToSpeak += `There are ${activeThreats.length} remaining issues. Priority one is ${activeThreats[0].title}. Recommended action: Apply ${activeThreats[0].fixCategory} fix.`;
        } else {
            textToSpeak += "Excellent work. All identified threats have been mitigated. Your system secure score is 100.";
        }

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

  // Drag and Drop Handlers for Main Area (Global Drop)
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const category = e.dataTransfer.getData("fixCategory") as FixCategory;
    if (category) applyFix(category);
  };

  const isSecure = currentScore < 20;

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header Toolbar */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 z-10 sticky top-0 shadow-md">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onReset}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Start New Audit"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-white tracking-tight leading-none">
                Interactive Simulator
            </h2>
            <span className="text-xs text-slate-500 mt-1">Drag fixes to apply • Voice enabled</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
            {/* Voice Command Toggle */}
            <button
                onClick={toggleListening}
                className={`
                    flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                    ${isListening ? 'border-rose-500 text-rose-400 bg-rose-950/30 animate-pulse' : 'border-slate-700 text-slate-400 hover:text-white bg-slate-800'}
                `}
            >
                {isListening ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                <span>{isListening ? 'Listening...' : 'Command Mode'}</span>
            </button>

             {/* Voice Guide Button */}
            <button
                onClick={handleVoiceGuide}
                disabled={isLoadingAudio || isPlaying}
                className={`
                    flex items-center space-x-2 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border
                    ${isPlaying ? 'border-cyan-500 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}
                `}
            >
                {isLoadingAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className={`w-3 h-3 ${isPlaying ? 'animate-pulse' : ''}`} />}
                <span>Guide Me</span>
            </button>

            <div className="h-8 w-px bg-slate-800 mx-2"></div>

            <div className="flex flex-col items-end mr-4">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Security Score</span>
                <div className={`text-2xl font-black transition-colors duration-500 ${isSecure ? 'text-emerald-400' : 'text-rose-500'}`}>
                    {100 - currentScore}<span className="text-sm font-normal text-slate-500">%</span>
                </div>
            </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative">
            
            {/* Sidebar: Fix Modules (Left on Desktop, Top on Mobile) */}
            <div className="lg:w-64 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 z-20 overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Available Defenses</h3>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                    {FIX_MODULES.map(module => (
                        <FixModuleCard key={module.id} module={module} />
                    ))}
                </div>
                <div className="mt-6 p-3 bg-cyan-900/10 border border-cyan-500/20 rounded-lg text-xs text-cyan-300">
                    <p className="font-bold mb-1">💡 Tip</p>
                    Drag these cards onto threats to simulate fixes, or say "Simulate [Name]".
                </div>
            </div>

            {/* Middle: Visual Analysis */}
            {hasImage && (
                 <div 
                    className="flex-1 h-[40vh] lg:h-full p-4 bg-slate-950 relative border-b lg:border-b-0 lg:border-r border-slate-800"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <ImageAnnotator 
                        imageUrl={session.imageUrl!} 
                        threats={threats} 
                        isSimulated={false} // We handle individual simulation now via ThreatCard visuals
                    />
                    
                    {/* Overlay Status */}
                    <div className="absolute bottom-8 left-8 right-8 pointer-events-none">
                        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-xl flex items-center justify-between">
                             <div className="flex items-center space-x-3">
                                {isSecure ? <ShieldCheck className="w-8 h-8 text-emerald-400" /> : <ShieldAlert className="w-8 h-8 text-rose-500" />}
                                <div>
                                    <h3 className="font-bold text-slate-100">{isSecure ? 'System Hardened' : 'Vulnerabilities Active'}</h3>
                                    <p className="text-xs text-slate-400">
                                        {appliedCategories.length > 0 ? `${appliedCategories.length} modules active.` : 'No defenses applied.'}
                                    </p>
                                </div>
                             </div>
                        </div>
                    </div>
                 </div>
            )}

            {/* Right: Threat List & Remediation */}
            <div 
                className={`h-full overflow-y-auto bg-slate-900/50 ${hasImage ? 'lg:w-96' : 'flex-1'} p-6 transition-all`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                        <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
                        <span>Threat Analysis</span>
                    </h3>
                </div>
                
                <div className="space-y-4">
                    {threats.map((threat) => (
                        <ThreatCard 
                            key={threat.id} 
                            threat={threat} 
                            isMitigated={appliedCategories.includes(threat.fixCategory)}
                            onDropMatch={(cat) => {
                                if (cat === threat.fixCategory) applyFix(cat);
                            }}
                        />
                    ))}
                    {threats.length === 0 && (
                        <div className="text-center text-slate-500 py-10">
                            No threats detected.
                        </div>
                    )}
                </div>
            </div>
      </div>
    </div>
  );
};

export default Dashboard;