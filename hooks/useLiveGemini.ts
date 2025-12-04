import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { 
  PCM_SAMPLE_RATE_INPUT, 
  PCM_SAMPLE_RATE_OUTPUT, 
  createPcmBlob, 
  decodeBase64, 
  decodeAudioData 
} from '../utils/audio';

interface UseLiveGeminiReturn {
  isConnected: boolean;
  isConnecting: boolean;
  isSpeaking: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  outputAnalyser: AnalyserNode | null;
  inputAnalyser: AnalyserNode | null;
}

export function useLiveGemini(): UseLiveGeminiReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio Contexts and Nodes
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Analysers for visualization
  const [inputAnalyser, setInputAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);

  // Playback State
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Session Management
  const sessionResolveRef = useRef<((value: any) => void) | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  const cleanup = useCallback(() => {
    console.log('Cleaning up Gemini Live session...');
    
    // Stop all active audio sources
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { /* ignore */ }
    });
    activeSourcesRef.current.clear();

    // Disconnect and stop script processor
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current.onaudioprocess = null;
      scriptProcessorRef.current = null;
    }

    // Disconnect input source
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }

    // Stop Microphone Stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close Audio Contexts
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close().catch(() => {});
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close().catch(() => {});
      outputAudioContextRef.current = null;
    }

    // Reset Refs
    nextStartTimeRef.current = 0;
    sessionPromiseRef.current = null;
    sessionResolveRef.current = null;
    
    // Reset State
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setInputAnalyser(null);
    setOutputAnalyser(null);
  }, []);

  const connect = useCallback(async () => {
    if (isConnected || isConnecting) return;
    
    try {
      setIsConnecting(true);
      setError(null);

      // 1. Initialize Audio Contexts
      // We use a lower buffer size (2048) for lower latency (~128ms at 16kHz)
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: PCM_SAMPLE_RATE_INPUT,
      });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: PCM_SAMPLE_RATE_OUTPUT,
      });

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      // Setup Analysers
      const inAnalyser = inputCtx.createAnalyser();
      inAnalyser.fftSize = 256;
      inAnalyser.smoothingTimeConstant = 0.5;
      setInputAnalyser(inAnalyser);

      const outAnalyser = outputCtx.createAnalyser();
      outAnalyser.fftSize = 256;
      outAnalyser.smoothingTimeConstant = 0.5;
      setOutputAnalyser(outAnalyser);

      // 2. Initialize Gemini API Client
      // Create a new instance for each connection to ensure fresh state
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Create a promise wrapper to allow the audio processor to wait for the session
      let sessionResolver: (value: any) => void;
      const p = new Promise<any>((resolve) => {
        sessionResolver = resolve;
      });
      sessionResolveRef.current = sessionResolver!;
      sessionPromiseRef.current = p;

      // 3. Connect to Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: {
            parts: [{ text: "You are a helpful, witty, and concise AI assistant. Keep responses relatively short to facilitate a natural conversation flow." }]
          },
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        },
        callbacks: {
          onopen: async () => {
            console.log('Gemini Live Connection Opened');
            setIsConnected(true);
            setIsConnecting(false);

            // Start Audio Stream after connection is confirmed
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              streamRef.current = stream;
              
              const source = inputCtx.createMediaStreamSource(stream);
              inputSourceRef.current = source;
              source.connect(inAnalyser);

              // Setup Processor with 2048 buffer size for better latency
              const processor = inputCtx.createScriptProcessor(2048, 1, 1);
              scriptProcessorRef.current = processor;

              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                
                // Send to session using the promise to ensure session is ready
                if (sessionPromiseRef.current) {
                  sessionPromiseRef.current.then(session => {
                    try {
                      session.sendRealtimeInput({ media: pcmBlob });
                    } catch (e) {
                      console.error("Error sending input", e);
                    }
                  });
                }
              };

              source.connect(processor);
              processor.connect(inputCtx.destination);
            } catch (err) {
              console.error('Microphone error:', err);
              setError("Microphone access failed.");
              cleanup();
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio) {
              try {
                if (outputCtx.state === 'suspended') {
                  await outputCtx.resume();
                }

                // Ensure strict sync
                nextStartTimeRef.current = Math.max(
                  nextStartTimeRef.current,
                  outputCtx.currentTime
                );

                const audioBuffer = await decodeAudioData(
                  decodeBase64(base64Audio),
                  outputCtx,
                  PCM_SAMPLE_RATE_OUTPUT,
                  1
                );

                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outAnalyser);
                outAnalyser.connect(outputCtx.destination);
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                
                activeSourcesRef.current.add(source);
                setIsSpeaking(true);

                source.onended = () => {
                  activeSourcesRef.current.delete(source);
                  // Add a small delay to prevent flickering if a new chunk arrives immediately
                  setTimeout(() => {
                    if (activeSourcesRef.current.size === 0) {
                      setIsSpeaking(false);
                    }
                  }, 200);
                };
              } catch (decodeErr) {
                console.error("Audio Decode Error", decodeErr);
              }
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              console.log('Model interrupted');
              activeSourcesRef.current.forEach(src => {
                try { src.stop(); } catch(e) {/* ignore */}
              });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onclose: () => {
            console.log("Gemini Connection Closed");
            cleanup();
          },
          onerror: (err) => {
            console.error("Gemini Connection Error", err);
            setError("Connection error.");
            cleanup();
          }
        }
      });

      // Handle connection promise resolution/rejection
      sessionPromise
        .then(session => {
          if (sessionResolveRef.current) {
             sessionResolveRef.current(session);
          }
        })
        .catch(err => {
          console.error("Session connection failed", err);
          setError(err.message || "Connection failed");
          cleanup();
        });

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect");
      setIsConnecting(false);
      cleanup();
    }
  }, [isConnected, isConnecting, cleanup]);

  const disconnect = useCallback(() => {
    // Attempt to close the session gracefully
    sessionPromiseRef.current?.then(session => {
       if(session) {
         try {
           // Not all SDK versions expose explicit close, but we try
           // @ts-ignore
           session.close?.(); 
         } catch(e) {
           console.warn("Could not close session explicitly", e);
         }
       }
    }).catch(() => {});
    
    // Force local cleanup
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isConnected,
    isConnecting,
    isSpeaking,
    error,
    connect,
    disconnect,
    inputAnalyser,
    outputAnalyser
  };
}