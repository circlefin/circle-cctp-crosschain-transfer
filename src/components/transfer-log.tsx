"use client";

import { useEffect, useRef } from 'react';

export function TransferLog({ logs }: { logs: string[] }) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current && containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 100;

      if (isNearBottom) {
        logsEndRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }
    }
  }, [logs]);

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto mt-8 p-4 bg-gray-50 rounded-lg h-64 overflow-y-auto">
      <div className="text-sm font-mono">
        {logs.map((log, index) => (
          <div key={index} className="text-gray-700">
            {log} {/* Timestamp is now pre-rendered in the log message */}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}