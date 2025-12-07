import React, { useState, ChangeEvent, useRef } from 'react';
import { Upload, FileText, Code, Loader2, Mic, StopCircle, Info, XCircle } from 'lucide-react';

interface InputSectionProps {
  onAnalyze: (imageUrl: string | undefined, configText: string | undefined, audioData: string | undefined) => void;
  isAnalyzing: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ onAnalyze, isAnalyzing }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [configText, setConfigText] = useState<string>('');
  const [showErrorHint, setShowErrorHint] = useState(false);
  
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
        setShowErrorHint(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const getSupportedMimeType = () => {
    const types = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/mp4',
      'audio/ogg'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Browser default
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Microphone not accessible. Please check permissions or use HTTPS.");
        return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const type = mediaRecorder.mimeType || 'audio/webm';
        if (chunksRef.current.length === 0) {
            console.warn("No audio chunks recorded");
            return;
        }
        const blob = new Blob(chunksRef.current, { type });
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setAudioData(result);
            setShowErrorHint(false);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      // Pass timeslice to ensure dataavailable fires periodically (every 200ms)
      mediaRecorder.start(200);
      setIsRecording(true);
      setAudioData(null); 
    } catch (err) {
      console.error("Mic Error:", err);
      alert("Error starting recording. Please check browser permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAnalyze = () => {
    if (!imagePreview && !configText.trim() && !audioData) {
        setShowErrorHint(true);
        return;
    }
    onAnalyze(imagePreview || undefined, configText || undefined, audioData || undefined);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 bg-slate-900/50 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-sm">
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
                    type="button"
                    onClick={startRecording}
                    className="flex items-center space-x-1 text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 active:scale-95 touch-manipulation z-20 cursor-pointer"
                    disabled={isAnalyzing}
                >
                    <Mic className="w-3 h-3" />
                    <span>ADD VOICE</span>
                </button>
            )}
            {isRecording && (
                <button 
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center space-x-1 text-xs font-bold text-rose-400 animate-pulse bg-rose-950/30 px-3 py-1.5 rounded-full border border-rose-500/30 active:scale-95 touch-manipulation cursor-pointer"
                >
                    <StopCircle className="w-3 h-3" />
                    <span>STOP REC</span>
                </button>
            )}
            {audioData && !isRecording && (
                 <div className="flex items-center space-x-2 bg-emerald-950/30 px-2 py-1 rounded-full border border-emerald-500/20">
                    <span className="text-xs text-emerald-400 font-mono">● Audio Ready</span>
                    <button onClick={() => setAudioData(null)} className="text-slate-400 hover:text-rose-400">
                        <XCircle className="w-3 h-3" />
                    </button>
                 </div>
            )}
          </div>

          <div className="relative group min-h-[232px]">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={isAnalyzing}
            />
            <div className={`
              h-full border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 relative overflow-hidden flex flex-col items-center justify-center
              ${imagePreview 
                ? 'border-emerald-500/50 bg-emerald-950/20' 
                : showErrorHint 
                    ? 'border-rose-500/50 bg-rose-950/10 animate-pulse' 
                    : 'border-slate-700 bg-slate-800/50 hover:border-cyan-500 hover:bg-slate-800'}
            `}>
              {imagePreview ? (
                <div className="relative h-48 w-full">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                    <span className="text-white text-sm font-medium">Click to change</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
                  <div className="p-4 bg-slate-800 rounded-full text-slate-400 group-hover:text-cyan-400 transition-colors">
                    <Upload className="w-8 h-8" />
                  </div>
                  <p className="text-slate-400 text-sm">Drop setup photo here</p>
                  {showErrorHint && (
                      <div className="text-rose-400 text-xs font-semibold flex items-center mt-2 animate-bounce">
                          <Info className="w-3 h-3 mr-1" />
                          Input required (Img, Voice, or Code)
                      </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Config Text Area */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-cyan-400 mb-2">
            <Code className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Config Snippet</h3>
          </div>
          <textarea
            value={configText}
            onChange={(e) => {
                setConfigText(e.target.value);
                if (e.target.value.trim()) setShowErrorHint(false);
            }}
            placeholder="Paste config (e.g., mqtt://192.168.1.10:1883) or describe setup..."
            className={`w-full h-[232px] bg-slate-950 border rounded-xl p-4 text-sm font-mono text-slate-300 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none resize-none transition-all placeholder:text-slate-600
                ${showErrorHint && !configText.trim() ? 'border-rose-900' : 'border-slate-700'}
            `}
            disabled={isAnalyzing}
          />
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className={`
            w-full md:w-auto flex items-center justify-center space-x-2 px-8 py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 shadow-lg
            ${isAnalyzing
              ? 'bg-slate-700 cursor-not-allowed opacity-50' 
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-cyan-900/20'}
          `}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Analyzing Vectors...</span>
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              <span>Analyze Threats</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default InputSection;