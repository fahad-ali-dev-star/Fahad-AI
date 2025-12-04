import React from 'react';
import { MicOff, Phone, PhoneOff, Activity, Sparkles } from 'lucide-react';
import { useLiveGemini } from './hooks/useLiveGemini';
import AudioVisualizer from './components/AudioVisualizer';

const App: React.FC = () => {
  const { 
    isConnected, 
    isConnecting, 
    isSpeaking, 
    connect, 
    disconnect, 
    error,
    inputAnalyser,
    outputAnalyser
  } = useLiveGemini();

  const handleToggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-900/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="absolute top-6 left-6 z-10 flex items-center gap-2">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg shadow-blue-900/50">
           <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
          Fahad.AI
        </h1>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-12">
        
        {/* Status Indicator */}
        <div className={`
          flex items-center gap-3 px-4 py-2 rounded-full border backdrop-blur-md transition-all duration-300
          ${isConnected 
            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
            : isConnecting 
              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
              : 'bg-zinc-800/50 border-zinc-700 text-zinc-400'
          }
        `}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : isConnecting ? 'bg-yellow-500 animate-bounce' : 'bg-zinc-500'}`} />
          <span className="text-sm font-medium tracking-wide">
            {isConnecting ? 'CONNECTING...' : isConnected ? 'LIVE' : 'DISCONNECTED'}
          </span>
        </div>

        {/* Visualizer Container */}
        <div className="relative w-80 h-80 sm:w-96 sm:h-96 flex items-center justify-center">
          {/* Output Visualizer (Agent) - Blue/Purple */}
          <div className={`absolute inset-0 z-10 transition-opacity duration-500 ${isSpeaking ? 'opacity-100' : 'opacity-30'}`}>
             <AudioVisualizer 
               analyser={outputAnalyser} 
               isActive={isSpeaking} 
               barColor="#818cf8" // Indigo 400
             />
          </div>
          
          {/* Input Visualizer (User) - Green, only visible when connected and agent not speaking */}
           <div className={`absolute inset-0 z-20 transition-opacity duration-500 ${!isSpeaking && isConnected ? 'opacity-100' : 'opacity-0'}`}>
              <AudioVisualizer 
                analyser={inputAnalyser} 
                isActive={true} 
                barColor="#34d399" // Emerald 400
              />
           </div>

           {/* Idle State Icon */}
           {!isConnected && !isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center z-30">
                 <div className="w-48 h-48 rounded-full border-2 border-zinc-800 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm">
                    <MicOff className="w-12 h-12 text-zinc-700" />
                 </div>
              </div>
           )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm max-w-sm text-center animate-in fade-in slide-in-from-bottom-2">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col items-center gap-6">
          <p className="text-zinc-400 text-center max-w-md text-sm">
            {isConnected 
              ? "Start speaking naturally. The model will listen and respond in real-time."
              : "Connect to start a real-time voice conversation with Fahad.AI."
            }
          </p>

          <button
            onClick={handleToggleConnection}
            disabled={isConnecting}
            className={`
              group relative flex items-center justify-center gap-3 px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 shadow-xl
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isConnected 
                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 ring-1 ring-red-500/50' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-blue-900/30'
              }
            `}
          >
            {isConnected ? (
              <>
                <PhoneOff className="w-5 h-5" />
                <span>End Call</span>
              </>
            ) : (
              <>
                {isConnecting ? (
                  <Activity className="w-5 h-5 animate-spin" />
                ) : (
                  <Phone className="w-5 h-5" />
                )}
                <span>{isConnecting ? 'Connecting...' : 'Start Conversation'}</span>
              </>
            )}
            
            {/* Button Glow Effect */}
            {!isConnected && !isConnecting && (
              <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 transition-all" />
            )}
          </button>
        </div>

      </main>

      {/* Footer Info */}
      <footer className="absolute bottom-6 text-zinc-600 text-xs">
         Using Gemini 2.5 Flash Native Audio Preview
      </footer>

    </div>
  );
}

export default App;