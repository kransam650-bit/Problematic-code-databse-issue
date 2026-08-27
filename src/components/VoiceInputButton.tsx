import React, { useState, useEffect } from 'react';
import { Mic } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({ onTranscript }) => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            onTranscript(transcript);
          }
        };

        rec.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        setRecognition(rec);
      }
    }
  }, [onTranscript]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const isSpeechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  if (!isSpeechSupported) return null;

  return (
    <div className="relative inline-block">
      {isListening && (
        <>
          <div className="absolute inset-0 rounded-md bg-rose-500/20 animate-mic-ripple-1 pointer-events-none" />
          <div className="absolute inset-0 rounded-md bg-rose-500/15 animate-mic-ripple-2 pointer-events-none" />
          <div className="absolute inset-0 rounded-md bg-rose-500/10 animate-mic-ripple-3 pointer-events-none" />
        </>
      )}
      <button
        type="button"
        onClick={toggleListening}
        className={cn(
          "relative z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm border cursor-pointer select-none",
          isListening 
            ? "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/20 scale-105" 
            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
        )}
        title={isListening ? "Listening... Click to stop" : "Use Voice Input (Speech to Text)"}
      >
        {isListening ? (
          <>
            <div className="flex items-end gap-0.5 h-3.5 px-0.5">
              <span className="w-0.5 h-3.5 bg-white rounded-full origin-bottom animate-mic-wave-1" />
              <span className="w-0.5 h-3.5 bg-white rounded-full origin-bottom animate-mic-wave-2" />
              <span className="w-0.5 h-3.5 bg-white rounded-full origin-bottom animate-mic-wave-3" />
            </div>
            <span>Listening...</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-slate-500" />
            <span>Voice</span>
          </>
        )}
      </button>
    </div>
  );
};
