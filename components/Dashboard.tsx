import React, { useState, useEffect, useRef } from 'react';
import { AuditSession, FixModule, FixCategory } from '../types';
import ThreatCard from './ThreatCard';
import ImageAnnotator from './ImageAnnotator';
import FixModuleCard from './FixModuleCard';
import { ShieldCheck, ShieldAlert, ArrowLeft, Volume2, Loader2, Mic, MicOff, Download, Share2 } from 'lucide-react';
import { generateAudioGuide } from '../services/geminiService';

interface DashboardProps {
  session: AuditSession;
  onSimulateFix: () => void; // Deprecated but kept for compatibility
  onReset: () => void;
}

const FIX_MODULES: FixModule[] = [
  { id: 'fix-enc', category: 'Encryption', label: 'Enable TLS/SSL', icon: 'Lock', description: 'Encrypts data in transit.' },
  { id: 'fix-net', category: 'Network', label: 'Firewall Rules', icon: 'Network', description: 'Blocks unauthorized ports.' },
  { id: 'fix-auth', category: 'Authentication', label: 'Strong Auth', icon: 'Key', description: 'Enforces robust passwords.' },
  { id: 'fix-dev', category: 'Device', label: 'Firmware Update', icon: 'Cpu', description: 'Patches known bugs.' },
];

const Dashboard: React.FC<DashboardProps> = ({ session, onReset }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  
  // Simulation State
  const [appliedCategories, setAppliedCategories] = useState<FixCategory[]>([]);
  const [secureScore, setSecureScore] = useState(0);
  
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
        alert("Microphone access is restricted or not supported in this browser.");
      }
    }
  };

  const processVoiceCommand = (text: string) => {
    if (text.includes("encryption") || text.includes("tls") || text.includes("ssl")) applyFix('Encryption');
    if (text.includes("firewall") || text.includes("network") || text.includes("port")) applyFix('Network');
    if (text.includes("auth") || text.includes("password") || text.includes("login")) applyFix('Authentication');
    if (text.includes("firmware") || text.includes("update") || text.includes("patch")) applyFix('Device');
    if (text.includes("reset") || text.includes("clear")) setAppliedCategories([]);
    if (text.includes("report") || text.includes("export")) handleExportReport();
  };

  const applyFix = (category: FixCategory) => {
    if (!appliedCategories.includes(category)) {
      setAppliedCategories(prev => [...prev, category]);
    }
  };

  // Weighted Score Calculation
  useEffect(() => {
    if (!session.result) return;
    const threats = session.result.threats;
    
    if (threats.length === 0) {
        setSecureScore(100);
        return;
    }

    // 1. Fixed Threats Ratio (40%)
    const fixedCount = threats.filter(t => appliedCategories.includes(t.fixCategory)).length;
    const fixedRatioScore = (fixedCount / threats.length) * 40;

    // 2. Encryption Bonus (30%) - Critical vulnerability check
    const encThreats = threats.filter(t => t.fixCategory === 'Encryption');
    let encScore = 30; // Default max if no encryption threats exist
    if (encThreats.length > 0) {
        const fixedEnc = encThreats.filter(t => appliedCategories.includes(t.fixCategory)).length;
        encScore = (fixedEnc / encThreats.length) * 30;
    }

    // 3. Risk Probability Reduction (30%)
    const initialRiskSum = threats.reduce((acc, t) => acc + t.riskProbability, 0);
    const currentRiskSum = threats.reduce((acc, t) => acc + (appliedCategories.includes(t.fixCategory) ? t.mitigatedRiskProbability : t.riskProbability), 0);
    
    let riskScore = 30;
    if (initialRiskSum > 0) {
        const improvement = (initialRiskSum - currentRiskSum) / initialRiskSum;
        riskScore = improvement * 30;
    }

    const total = Math.round(fixedRatioScore + encScore + riskScore);
    // Ensure we don't exceed 100 or go below 0, though formula shouldn't allow it.
    // Also, if no fixes are applied, the base score should reflect the initial state (inverse of initial risk).
    // To make it fun, let's floor it at the initial inverse risk.
    const baseSecure = 100 - session.result.overallRiskScore;
    
    // Smooth transition
    const finalScore = Math.max(baseSecure, Math.min(100, total + baseSecure * 0.3)); 
    setSecureScore(Math.round(finalScore));

  }, [appliedCategories, session.result]);

  const handleVoiceGuide = async () => {
    if (isPlaying) return;
    setIsLoadingAudio(true);
    try {
        const activeThreats = threats.filter(t => !appliedCategories.includes(t.fixCategory));
        const mitigatedCount = threats.length - activeThreats.length;
        
        let textToSpeak = "";
        if (mitigatedCount > 0) {
            textToSpeak += `You have applied ${mitigatedCount} security patches. `;
        }
        
        if (activeThreats.length > 0) {
            textToSpeak += `Attention. ${activeThreats.length} vulnerabilities remain. Critical priority: ${activeThreats[0].title}. Recommended action: Apply ${activeThreats[0].fixCategory} protocol.`;
        } else {
            textToSpeak += "System Secure. All known threats mitigated. Secure score is optimal.";
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

  const handleExportReport = () => {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
        alert("Pop-up blocked. Please allow pop-ups to export report.");
        return;
    }
    
    const date = new Date().toLocaleDateString();
    const activeThreats = threats.filter(t => !appliedCategories.includes(t.fixCategory));
    
    const html = `
      <html>
        <head>
          <title>IoT Sentinel Security Report - ${date}</title>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
            h1 { color: #0f172a; border-bottom: 2px solid #06b6d4; padding-bottom: 10px; }
            .score-box { background: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            .score { font-size: 40px; font-weight: bold; color: ${secureScore > 80 ? '#10b981' : '#f43f5e'}; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
            th { background-color: #f8fafc; }
            .status-fixed { color: #10b981; font-weight: bold; }
            .status-risk { color: #f43f5e; font-weight: bold; }
            .footer { margin-top: 50px; font-size: 12px; color: #64748b; text-align: center; }
          </style>
        </head>
        <body>
          <h1>IoT Sentinel Security Audit</h1>
          <p>Date: ${date}</p>
          
          <div class="score-box">
            <div>Secure Score</div>
            <div class="score">${secureScore}/100</div>
            <p>${secureScore > 80 ? 'System is hardened and secure.' : 'System requires immediate attention.'}</p>
          </div>

          <h2>Detailed Threat Analysis</h2>
          <table>
            <thead>
              <tr>
                <th>Threat</th>
                <th>Severity</th>
                <th>Category</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${threats.map(t => `
                <tr>
                  <td>
                    <strong>${t.title}</strong><br/>
                    <small>${t.description}</small>
                  </td>
                  <td>${t.severity}</td>
                  <td>${t.fixCategory}</td>
                  <td class="${appliedCategories.includes(t.fixCategory) ? 'status-fixed' : 'status-risk'}">
                    ${appliedCategories.includes(t.fixCategory) ? 'MITIGATED' : 'ACTIVE'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            Generated by IoT Sentinel using Gemini Multimodal Analysis.
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    
    reportWindow.document.write(html);
    reportWindow.document.close();
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const category = e.dataTransfer.getData("fixCategory") as FixCategory;
    if (category) applyFix(category);
  };

  const isSecure = secureScore >= 80;

  // Gauge Calculation
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (secureScore / 100) * circumference;

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header Toolbar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-4 bg-slate-900 border-b border-slate-800 z-30 sticky top-0 shadow-md">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <button 
            onClick={onReset}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Start New Audit"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-white tracking-tight leading-none">
                IoT Sentinel
            </h2>
            <span className="text-xs text-slate-500 mt-1 hidden md:block">Interactive Security Simulator</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4 overflow-x-auto">
            {/* Voice Command */}
            <button
                onClick={toggleListening}
                className={`
                    flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap
                    ${isListening ? 'border-rose-500 text-rose-400 bg-rose-950/30 animate-pulse' : 'border-slate-700 text-slate-400 hover:text-white bg-slate-800'}
                `}
            >
                {isListening ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                <span className="hidden sm:inline">{isListening ? 'Listening...' : 'Commands'}</span>
            </button>

             {/* Voice Guide */}
            <button
                onClick={handleVoiceGuide}
                disabled={isLoadingAudio || isPlaying}
                className={`
                    flex items-center space-x-2 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border whitespace-nowrap
                    ${isPlaying ? 'border-cyan-500 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}
                `}
            >
                {isLoadingAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className={`w-3 h-3 ${isPlaying ? 'animate-pulse' : ''}`} />}
                <span className="hidden sm:inline">Voice Guide</span>
            </button>
            
            {/* Export */}
            <button
                onClick={handleExportReport}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg font-semibold text-xs border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all whitespace-nowrap"
            >
                <Share2 className="w-3 h-3" />
                <span className="hidden sm:inline">Export</span>
            </button>

            <div className="h-8 w-px bg-slate-800 mx-2 hidden md:block"></div>

            {/* Score Gauge */}
            <div className="flex items-center space-x-3 mr-2">
                 <div className="relative w-12 h-12">
                     <svg className="w-full h-full transform -rotate-90">
                         <circle cx="24" cy="24" r={radius} stroke="#1e293b" strokeWidth="6" fill="transparent" />
                         <circle 
                            cx="24" cy="24" r={radius} 
                            stroke={isSecure ? '#10b981' : '#f43f5e'} 
                            strokeWidth="6" 
                            fill="transparent" 
                            strokeDasharray={circumference} 
                            strokeDashoffset={strokeDashoffset} 
                            className="transition-all duration-1000 ease-out"
                         />
                     </svg>
                     <div className="absolute inset-0 flex items-center justify-center">
                         <span className={`text-xs font-bold ${isSecure ? 'text-emerald-400' : 'text-rose-400'}`}>{secureScore}</span>
                     </div>
                 </div>
                 <div className="flex flex-col hidden sm:flex">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Secure Score</span>
                    <span className={`text-xs font-medium ${isSecure ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isSecure ? 'System Hardened' : 'Risk Detected'}
                    </span>
                 </div>
            </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative">
            
            {/* Sidebar: Fix Modules (Left on Desktop, Top on Mobile) */}
            <div className="lg:w-64 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 z-20 lg:overflow-y-auto shrink-0">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex justify-between items-center">
                    <span>Available Patches</span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-cyan-500">DRAG or TAP</span>
                </h3>
                {/* Mobile: Horizontal scroll, Desktop: Vertical list */}
                <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible gap-3 pb-2 lg:pb-0 scrollbar-hide">
                    {FIX_MODULES.map(module => (
                        <div key={module.id} className="min-w-[160px] lg:min-w-0">
                            <FixModuleCard module={module} onClick={() => applyFix(module.category)} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Middle: Visual Analysis */}
            {hasImage && (
                 <div 
                    className="flex-1 min-h-[300px] lg:h-full p-4 bg-slate-950 relative border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <ImageAnnotator 
                        imageUrl={session.imageUrl!} 
                        threats={threats} 
                        isSimulated={false} 
                    />
                    
                    {/* Overlay Status */}
                    <div className="absolute bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-8 pointer-events-none">
                        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-xl flex items-center justify-between">
                             <div className="flex items-center space-x-3">
                                {isSecure ? <ShieldCheck className="w-8 h-8 text-emerald-400" /> : <ShieldAlert className="w-8 h-8 text-rose-500" />}
                                <div>
                                    <h3 className="font-bold text-slate-100 text-sm md:text-base">{isSecure ? 'Environment Secure' : 'Vulnerabilities Active'}</h3>
                                    <p className="text-xs text-slate-400">
                                        {appliedCategories.length > 0 ? `${appliedCategories.length} patch modules active.` : 'No defenses applied.'}
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
                <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                        <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
                        <span>Threat Analysis</span>
                    </h3>
                </div>
                
                <div className="space-y-4 pb-20 lg:pb-0">
                    {threats.map((threat) => (
                        <ThreatCard 
                            key={threat.id} 
                            threat={threat} 
                            isMitigated={appliedCategories.includes(threat.fixCategory)}
                            onDropMatch={(cat) => applyFix(cat)}
                        />
                    ))}
                    {threats.length === 0 && (
                        <div className="text-center text-slate-500 py-10 flex flex-col items-center">
                            <ShieldCheck className="w-12 h-12 mb-4 opacity-50" />
                            <p>No threats detected.</p>
                            <p className="text-xs mt-2">Your configuration appears secure.</p>
                        </div>
                    )}
                </div>
            </div>
      </div>
    </div>
  );
};

export default Dashboard;