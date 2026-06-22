"use client";

import React, { useEffect, useState } from "react";

export default function SystemTime({ timeOffset }: { timeOffset: number }) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Initial set
    setCurrentTime(new Date(Date.now() + timeOffset));
    
    // Tick every second
    const interval = setInterval(() => {
      setCurrentTime(new Date(Date.now() + timeOffset));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timeOffset]);

  if (!currentTime) return <div className="text-yellow-400 font-bold">SYNCING...</div>;

  return (
    <div className="text-yellow-400 font-bold">
      {currentTime.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })}{" "}
      {currentTime.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta" })} WIB
    </div>
  );
}
