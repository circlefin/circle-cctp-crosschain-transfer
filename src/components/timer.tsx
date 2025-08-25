"use client";

import { useState, useEffect, useRef } from 'react';

interface TimerProps {
  isRunning: boolean;
  onTick?: (seconds: number) => void;
  initialSeconds?: number;
}

export function Timer({ isRunning, onTick }: TimerProps) {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const animationRef = useRef<number | undefined>(undefined);
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (isRunning && startTime === null) {
      setStartTime(Date.now());
    } else if (!isRunning && startTime !== null) {
      setStartTime(null);
    }
  }, [isRunning, startTime]);

  useEffect(() => {
    const animate = () => {
      if (startTime) {
        const now = Date.now();
        const newElapsed = Math.floor((now - startTime) / 1000);
        setElapsed(newElapsed);
        onTickRef.current?.(newElapsed);
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    if (isRunning) {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="text-2xl font-mono">
      <span>{minutes.toString().padStart(2, '0')}</span>:
      <span>{seconds.toString().padStart(2, '0')}</span>
    </div>
  );
}