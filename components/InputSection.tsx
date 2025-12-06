import React, { useState, ChangeEvent, useRef } from 'react';
import { Upload, FileText, Code, Loader2, Mic, StopCircle } from 'lucide-react';

interface InputSectionProps {
  onAnalyze: (imageUrl: string | undefined, configText: string | undefined, audioData: string | undefined) => void;
  isAnalyzing: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ onAnalyze, isAnalyzing }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [configText, setConfigText] = useState<string>('');
  
  // Audio state
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
            setAudioData(reader.result as string);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAudioData(null); // Clear previous
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAnalyze = () => {
    if (!imagePreview && !configText.trim() && !audioData) return;
    onAnalyze(imagePreview || undefined, configText || undefined, audioData || undefined);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-slate-900/50 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Visual & Audio Input Area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2 text-cyan-400">
                <Upload className="w-5 h-5" />
                <h3 className="font-semibold text-lg">Visual & Voice</h3>
            </div>
            
            {/* Audio Recorder Controls */}
            {!isRecording && !audioData && (
                <button 
                    onClick={startRecording}
                    className="flex items-center space-x-1 text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors bg-slate-800 px-3 py-1 rounded-full border border-slate-700"
                    disabled={isAnalyzing}
                >
                    <Mic className="w-3 h-3" />
                    <span>ADD VOICE</span>
                </button>
            )}
            {isRecording && (
                <button 
                    onClick={stopRecording}
                    className="flex items-center space-x-1 text-xs font-bold text-rose-400 animate-pulse bg-rose-950/30 px-3 py-1 rounded-full border border-rose-500/30"
                >
                    <StopCircle className="w-3 h-3" />
                    <span>STOP REC</span>
                </button>
            )}
            {audioData && !isRecording && (
                 <div className="flex items-center space-x-2">
                    <span className="text-xs text-emerald-400 font-mono">● Voice Recorded</span>
                    <button onClick={() => setAudioData(null)} className="text-slate-500 hover:text-rose-400">
                        <span className="text-xs">✕</span>
                    </button>
                 </div>
            )}
          </div>

          <div className="relative group">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={isAnalyzing}
            />
            <div className={`
              border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 relative overflow-hidden
              ${imagePreview 
                ? 'border-emerald-500/50 bg-emerald-950/20' 
                : 'border-slate-700 bg-slate-800/50 hover:border-cyan-500 hover:bg-slate-800'}
            `}>
              {imagePreview ? (
                <div className="relative h-48 w-full">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                    <span className="text-white text-sm font-medium">Click to change</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 space-y-3">
                  <div className="p-4 bg-slate-800 rounded-full text-slate-400 group-hover:text-cyan-400 transition-colors">
                    <Upload className="w-8 h-8" />
                  </div>
                  <p className="text-slate-400 text-sm">Drop photo or describe via Voice</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Config Text Area */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-cyan-400 mb-2">
            <Code className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Config Analysis</h3>
          </div>
          <textarea
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            placeholder="Paste config snippet (e.g., MQTT settings, JSON config, Network rules)..."
            className="w-full h-[232px] bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm font-mono text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none resize-none transition-all placeholder:text-slate-600"
            disabled={isAnalyzing}
          />
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleAnalyze}
          disabled={(!imagePreview && !configText.trim() && !audioData) || isAnalyzing}
          className={`
            flex items-center space-x-2 px-8 py-3 rounded-xl font-bold text-white transition-all transform active:scale-95
            ${(!imagePreview && !configText.trim() && !audioData) || isAnalyzing
              ? 'bg-slate-700 cursor-not-allowed opacity-50' 
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-900/20'}
          `}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Scanning...</span>
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              <span>Run Security Audit</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default InputSection;