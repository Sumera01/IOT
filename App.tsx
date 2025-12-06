import React, { useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import InputSection from './components/InputSection';
import Dashboard from './components/Dashboard';
import { analyzeIoTSetup } from './services/geminiService';
import { AuditSession, AuditResult } from './types';

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<AuditSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (imageUrl: string | undefined, configText: string | undefined, audioData: string | undefined) => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeIoTSetup(imageUrl, configText, audioData);
      setSession({
        imageUrl,
        configText,
        audioData,
        result,
        appliedFixes: [],
      });
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateFix = () => {
    // Deprecated in favor of drag and drop
  };

  const handleReset = () => {
    setSession(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      {!session ? (
        <div className="flex flex-col min-h-screen relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px]" />
                <div className="absolute top-[40%] -left-[10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
                <div className="text-center mb-12 space-y-4">
                    <div className="inline-flex items-center justify-center p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl mb-4">
                        <Shield className="w-12 h-12 text-cyan-500" />
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white">
                        IoT <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Sentinel</span>
                    </h1>
                    <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
                        Multimodal security auditor for your smart home & IoT infrastructure. 
                        Upload an image, describe via voice, or paste your config.
                    </p>
                </div>

                <InputSection onAnalyze={handleAnalyze} isAnalyzing={loading} />

                {error && (
                    <div className="mt-8 p-4 bg-rose-950/30 border border-rose-500/30 rounded-lg text-rose-300 flex items-center max-w-md">
                        <span className="mr-2">⚠️</span> {error}
                    </div>
                )}
            </div>
            
            <footer className="relative z-10 p-6 text-center text-slate-600 text-sm">
                Powered by Gemini 2.5 • Secure by Design
            </footer>
        </div>
      ) : (
        <Dashboard 
            session={session} 
            onSimulateFix={handleSimulateFix} 
            onReset={handleReset} 
        />
      )}
    </div>
  );
};

export default App;