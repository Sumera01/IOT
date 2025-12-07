
import React, { useState, useEffect, useRef } from 'react';
import { AuditSession, FixModule, FixCategory } from '../types';
import ThreatCard from './ThreatCard';
import ImageAnnotator from './ImageAnnotator';
import FixModuleCard from './FixModuleCard';
import { ShieldCheck, ShieldAlert, ArrowLeft, Volume2, Loader2, Mic, MicOff, Share2 } from 'lucide-react';
import { generateAudioGuide } from '../services/geminiService';

interface DashboardProps {
  session: AuditSession;
  onSimulateFix: () => void; // Deprecated
  onReset: () => void;
}

const FIX_MODULES: FixModule[] = [
  { id: 'fix-enc-tls', category: 'Encryption', label: 'Enable TLS/SSL', icon: 'Lock', description: 'Encrypts data in transit.' },
  { id: 'fix-enc-keys', category: 'Encryption', label: 'Rotate Keys', icon: 'Lock', description: 'Auto-rotates certificates.' },
  { id: 'fix-net-fw', category: 'Network', label: 'Firewall Rules', icon: 'Network', description: 'Blocks unauthorized ports.' },
  { id: 'fix-net-upnp', category: 'Network', label: 'Disable UPnP', icon: 'Network', description: 'Prevents auto-forwarding.' },
  { id: 'fix-auth-mfa', category: 'Authentication', label: 'Enforce MFA', icon: 'Key', description: 'Requires 2-factor auth.' },
  { id: 'fix-auth-pwd', category: 'Authentication', label: 'Strong Auth', icon: 'Key', description: 'Enforces robust passwords.' },
  { id: 'fix-dev-fw', category: 'Device', label: 'Firmware Update', icon: 'Cpu', description: 'Patches known bugs.' },
  { id: 'fix-dev-boot', category: 'Device', label: 'Secure Boot', icon: 'Cpu', description: 'Verifies OS signature.' },
  { id: 'fix-phy-jtag', category: 'Physical', label: 'Disable JTAG', icon: 'Cpu', description: 'Locks physical debug ports.' },
  { id: 'fix-iso-vlan', category: 'Isolation', label: 'VLAN Isolate', icon: 'Shield', description: 'Segments IoT traffic.' },
  { id: 'fix-mon-logs', category: 'Monitoring', label: 'Enable Logs', icon: 'Activity', description: 'Audits access events.' },
  { id: 'fix-dat-min', category: 'Data', label: 'Data Privacy', icon: 'Database', description: 'Minimizes stored data.' },
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

  // Identify recommended categories based on active threats
  const activeCategories = Array.from(new Set(threats.filter(t => !appliedCategories.includes(t.fixCategory)).map(t => t.fixCategory)));

  // Sort modules: Recommended first, then alphabetical or standard order
  const sortedModules = [...FIX_MODULES].sort((a, b) => {
    const aRec = activeCategories.includes(a.category);
    const bRec = activeCategories.includes(b.category);
    if (aRec && !bRec) return -1;
    if (!aRec && bRec) return 1;
    return 0;
  });

  const applyFix = (category: FixCategory) => {
    setAppliedCategories(prev => {
        if (prev.includes(category)) return prev;
        return [...prev, category];
    });
  };

  const processVoiceCommand = (text: string) => {
    // "Fix it" or "Fix all" applies all needed categories
    if (text.includes("fix all") || text.includes("fix it") || text.includes("apply all")) {
        const needed = Array.from(new Set(threats.map(t => t.fixCategory)));
        setAppliedCategories(needed);
        return;
    }

    if (text.includes("encryption") || text.includes("tls") || text.includes("ssl")) applyFix('Encryption');
    if (text.includes("firewall") || text.includes("network") || text.includes("port")) applyFix('Network');
    if (text.includes("auth") || text.includes("password") || text.includes("login")) applyFix('Authentication');
    if (text.includes("firmware") || text.includes("update") || text.includes("patch")) applyFix('Device');
    if (text.includes("isolate") || text.includes("vlan") || text.includes("segment")) applyFix('Isolation');
    if (text.includes("monitor") || text.includes("log") || text.includes("audit")) applyFix('Monitoring');
    if (text.includes("physical") || text.includes("jtag") || text.includes("debug")) applyFix('Physical');
    if (text.includes("data") || text.includes("privacy")) applyFix('Data');
    
    if (text.includes("reset") || text.includes("clear")) setAppliedCategories([]);
    if (text.includes("report") || text.includes("export")) handleExportReport();
  };

  // Ref to hold the latest version of processVoiceCommand to avoid stale closures in event listeners
  const processCommandRef = useRef(processVoiceCommand);
  useEffect(() => {
    processCommandRef.current = processVoiceCommand;
  });

  // Initialize Speech Recognition
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
        // Call the ref to ensure we use the latest state/logic
        processCommandRef.current(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
             setIsListening(false);
        }
      };
      
      recognitionRef.current.onend = () => {
         if (isListening) {
             try {
                recognitionRef.current.start(); 
             } catch (e) {
                 setIsListening(false);
             }
         }
      };
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [isListening]); // Re-run only when listening state toggles

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
        alert("Microphone access is restricted or not supported.");
      }
    }
  };

  // 40/30/30 Weighted Score Calculation
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

    // 2. Encryption Bonus (30%)
    const encThreats = threats.filter(t => t.fixCategory === 'Encryption');
    let encScore = 30; 
    if (encThreats.length > 0) {
        const fixedEnc = encThreats.filter(t => appliedCategories.includes(t.fixCategory)).length;
        encScore = (fixedEnc / encThreats.length) * 30;
    }

    // 3. Risk Delta (30%)
    const initialRiskSum = threats.reduce((acc, t) => acc + t.riskProbability, 0);
    const currentRiskSum = threats.reduce((acc, t) => acc + (appliedCategories.includes(t.fixCategory) ? t.mitigatedRiskProbability : t.riskProbability), 0);
    
    let riskScore = 0;
    if (initialRiskSum > 0) {
        // Calculate percentage reduction
        const improvement = (initialRiskSum - currentRiskSum) / initialRiskSum;
        riskScore = improvement * 30;
    }

    // Base score from initial audit (100 - initial risk)
    const initialBase = Math.max(0, 100 - session.result.overallRiskScore);
    const gap = 100 - initialBase;
    const calculatedProgress = fixedRatioScore + encScore + riskScore;
    const finalScore = initialBase + (calculatedProgress / 100) * gap;

    setSecureScore(Math.round(Math.min(100, finalScore)));

  }, [appliedCategories, session.result]);

  const handleVoiceGuide = async () => {
    if (isPlaying) return;
    setIsLoadingAudio(true);
    try {
        const activeThreats = threats.filter(t => !appliedCategories.includes(t.fixCategory));
        
        let textToSpeak = "";
        
        if (activeThreats.length > 0) {
            textToSpeak += `Security alert. ${activeThreats.length} vulnerabilities detected. `;
            textToSpeak += `Highest priority: ${activeThreats[0].title}. `;
            textToSpeak += `Risk probability is ${activeThreats[0].riskProbability} percent. `;
            textToSpeak += `Say 'Fix It' to apply the ${activeThreats[0].fixCategory} patch.`;
        } else {
            textToSpeak += "System Hardened. All protocols operational. Security score nominal.";
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
        alert("Audio generation error.");
    } finally {
        setIsLoadingAudio(false);
    }
  };

  const handleExportReport = () => {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
        alert("Please allow pop-ups to export report.");
        return;
    }
    
    const date = new Date().toLocaleDateString();
    
    const html = `
      <html>
        <head>
          <title>IoT Sentinel Report - ${date}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; }
            h1 { color: #0f172a; border-bottom: 2px solid #06b6d4; padding-bottom: 10px; }
            .score-box { background: #f1f5f9; padding: 24px; border-radius: 12px; margin-bottom: 30px; text-align: center; }
            .score { font-size: 48px; font-weight: 800; color: ${secureScore > 80 ? '#10b981' : '#f43f5e'}; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1); }
            th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
            th { background-color: #f8fafc; font-weight: 600; }
            .status-fixed { color: #10b981; font-weight: bold; background: #ecfdf5; }
            .status-risk { color: #f43f5e; font-weight: bold; background: #fff1f2; }
            .cve-tag { display: inline-block; padding: 2px 6px; background: #e2e8f0; border-radius: 4px; font-size: 11px; margin-top: 4px; }
            .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center; }
          </style>
        </head>
        <body>
          <h1>IoT Sentinel Security Audit</h1>
          <p>Generated on ${date}</p>
          
          <div class="score-box">
            <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">Secure Score</div>
            <div class="score">${secureScore}/100</div>
            <p>${secureScore > 80 ? 'System Hardened. Vulnerabilities Mitigated.' : 'CRITICAL: Immediate Action Required.'}</p>
          </div>

          <h2>Threat Analysis & Mitigation</h2>
          <table>
            <thead>
              <tr>
                <th>Threat</th>
                <th>CVE / Severity</th>
                <th>Status</th>
                <th>Probability</th>
              </tr>
            </thead>
            <tbody>
              ${threats.map(t => `
                <tr>
                  <td>
                    <strong>${t.title}</strong><br/>
                    <small>${t.description}</small>
                  </td>
                  <td>
                    ${t.severity}<br/>
                    ${t.cve ? `<span class="cve-tag">${t.cve}</span>` : ''}
                  </td>
                  <td class="${appliedCategories.includes(t.fixCategory) ? 'status-fixed' : 'status-risk'}">
                    ${appliedCategories.includes(t.fixCategory) ? 'MITIGATED' : 'ACTIVE'}
                  </td>
                  <td>${appliedCategories.includes(t.fixCategory) ? t.mitigatedRiskProbability : t.riskProbability}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            Analysis by Gemini 2.5 Multimodal • IoT Sentinel
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    
    reportWindow.document.write(html);
    reportWindow.document.close();
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const category = e.dataTransfer.getData("fixCategory") as FixCategory;
    if (category) applyFix(category);
  };

  const isSecure = secureScore >= 80;

  // Gauge Config
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (secureScore / 100) * circumference;

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-4 bg-slate-900 border-b border-slate-800 z-30 sticky top-0 shadow-md">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <button 
            onClick={onReset}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight leading-none">IoT Sentinel</h2>
            <span className="text-xs text-slate-500 hidden md:block">Real-time Threat Simulator</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4 overflow-x-auto">
            {/* Commands */}
            <button
                onClick={toggleListening}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap
                    ${isListening ? 'border-rose-500 text-rose-400 bg-rose-950/30 animate-pulse' : 'border-slate-700 text-slate-400 hover:text-white bg-slate-800'}
                `}
            >
                {isListening ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                <span className="hidden sm:inline">{isListening ? 'Listening...' : 'Mic'}</span>
            </button>

             {/* Guide */}
            <button
                onClick={handleVoiceGuide}
                disabled={isLoadingAudio || isPlaying}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border whitespace-nowrap
                    ${isPlaying ? 'border-cyan-500 text-cyan-400 bg-cyan-950/30' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}
                `}
            >
                {isLoadingAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className={`w-3 h-3 ${isPlaying ? 'animate-pulse' : ''}`} />}
                <span className="hidden sm:inline">Guide</span>
            </button>
            
            {/* Export */}
            <button
                onClick={handleExportReport}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg font-semibold text-xs border border-slate-700 text-slate-300 hover:bg-slate-800 transition-all whitespace-nowrap"
            >
                <Share2 className="w-3 h-3" />
                <span className="hidden sm:inline">PDF</span>
            </button>

            <div className="h-8 w-px bg-slate-800 mx-2 hidden md:block"></div>

            {/* Gauge */}
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
            </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row relative">
            
            {/* Sidebar */}
            <div className="lg:w-64 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 z-20 shrink-0">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex justify-between items-center">
                    <span>Fix Modules</span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-cyan-500">DRAG / TAP</span>
                </h3>
                <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible gap-3 pb-2 lg:pb-0 scrollbar-hide">
                    {sortedModules.map(module => (
                        <div key={module.id} className="min-w-[160px] lg:min-w-0">
                            <FixModuleCard 
                                module={module} 
                                onClick={() => applyFix(module.category)}
                                isRecommended={activeCategories.includes(module.category)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Visual */}
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
                    
                    <div className="absolute bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-8 pointer-events-none">
                        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-xl flex items-center justify-between">
                             <div className="flex items-center space-x-3">
                                {isSecure ? <ShieldCheck className="w-8 h-8 text-emerald-400" /> : <ShieldAlert className="w-8 h-8 text-rose-500" />}
                                <div>
                                    <h3 className="font-bold text-slate-100 text-sm md:text-base">{isSecure ? 'System Hardened' : 'Vulnerabilities Active'}</h3>
                                    <p className="text-xs text-slate-400">
                                        {appliedCategories.length > 0 ? `${appliedCategories.length} patches applied.` : 'No defenses active.'}
                                    </p>
                                </div>
                             </div>
                        </div>
                    </div>
                 </div>
            )}

            {/* List */}
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
                        </div>
                    )}
                </div>
            </div>
      </div>
    </div>
  );
};

export default Dashboard;
