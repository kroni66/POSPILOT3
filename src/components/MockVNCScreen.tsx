import React, { useEffect, useRef, useState } from 'react';

interface MockVNCScreenProps {
  systemName: string;
  systemType: string;
  style?: React.CSSProperties;
}

const MockVNCScreen: React.FC<MockVNCScreenProps> = ({ systemName, systemType, style }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
      drawScreen();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const drawScreen = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw mock interface
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, canvas.width, 30); // Top bar

    // System info
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText(`${systemName} - ${systemType}`, 10, 20);

    // Time
    const timeString = time.toLocaleTimeString();
    ctx.fillText(timeString, canvas.width - 70, 20);

    // Mock content based on system type
    if (systemType === 'SCO') {
      drawSCOInterface(ctx, canvas.width, canvas.height);
    } else {
      drawPOSInterface(ctx, canvas.width, canvas.height);
    }
  };

  const drawSCOInterface = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw mock SCO interface
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(50, 50, width - 100, height - 100);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText('Self-Checkout Terminal', width/2 - 100, height/2);
    
    // Draw mock buttons
    drawButton(ctx, width/2 - 100, height - 80, 'Pay Now');
    drawButton(ctx, width/2 + 20, height - 80, 'Cancel');
  };

  const drawPOSInterface = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw mock POS interface
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(50, 50, width - 100, height - 100);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText('Point of Sale Terminal', width/2 - 90, height/2);
    
    // Draw mock register display
    ctx.fillStyle = '#000000';
    ctx.fillRect(60, 60, width - 120, 40);
    ctx.fillStyle = '#00ff00';
    ctx.font = '24px "Courier New"';
    ctx.fillText('$0.00', 70, 90);
  };

  const drawButton = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 100, 40);
    ctx.fillStyle = '#000000';
    ctx.font = '16px Arial';
    ctx.fillText(text, x + 20, y + 25);
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{
        width: '100%',
        height: '100%',
        ...style
      }}
    />
  );
};

export default MockVNCScreen;