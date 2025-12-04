import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  barColor?: string;
  mode?: 'circle' | 'bars';
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  analyser, 
  isActive, 
  barColor = '#3b82f6', // blue-500
  mode = 'circle'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Initialized with null for correct type safety
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Helper to get frequency data
    const bufferLength = analyser ? analyser.frequencyBinCount : 0;
    const dataArray = analyser ? new Uint8Array(bufferLength) : new Uint8Array(0);

    const draw = () => {
      if (!canvas || !ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 3;

      ctx.clearRect(0, 0, width, height);

      if (isActive && analyser) {
        analyser.getByteFrequencyData(dataArray);
      } else {
         // idle animation
         if (!isActive) {
            const time = Date.now() / 1000;
            const breathingRadius = radius + Math.sin(time * 2) * 5;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, breathingRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#27272a'; // zinc-800
            ctx.lineWidth = 2;
            ctx.stroke();
            
            animationRef.current = requestAnimationFrame(draw);
            return;
         }
      }

      if (mode === 'circle') {
        ctx.beginPath();
        // Draw a base circle
        ctx.arc(centerX, centerY, radius - 10, 0, 2 * Math.PI);
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw frequency bars radiating out
        const bars = 60; // Number of bars
        const step = Math.floor(bufferLength / bars);
        
        for (let i = 0; i < bars; i++) {
          const value = dataArray[i * step] || 0;
          const percent = value / 255;
          const barHeight = percent * (radius * 0.8);
          
          const angle = (Math.PI * 2 * i) / bars;
          
          // Start point on circle
          const x1 = centerX + Math.cos(angle) * radius;
          const y1 = centerY + Math.sin(angle) * radius;
          
          // End point outwards
          const x2 = centerX + Math.cos(angle) * (radius + barHeight);
          const y2 = centerY + Math.sin(angle) * (radius + barHeight);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          
          ctx.strokeStyle = barColor;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          
          // Add a glow effect
          ctx.shadowBlur = 10;
          ctx.shadowColor = barColor;
          
          ctx.stroke();
          
          // Reset shadow for performance
          ctx.shadowBlur = 0;
        }
      } else {
        // Simple bars
        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for(let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;
            ctx.fillStyle = barColor;
            ctx.fillRect(x, height - barHeight / 2 - height/2, barWidth, barHeight);
            x += barWidth + 1;
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isActive, barColor, mode]);

  return (
    <canvas 
      ref={canvasRef} 
      width={600} 
      height={600} 
      className="w-full h-full max-w-[500px] max-h-[500px]"
    />
  );
};

export default AudioVisualizer;