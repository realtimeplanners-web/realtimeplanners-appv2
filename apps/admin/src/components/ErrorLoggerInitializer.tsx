"use client";

import { useEffect } from "react";
import { initializeGlobalErrorLogging } from "../lib/globalErrorLogger";

export default function ErrorLoggerInitializer() {
  useEffect(() => {
    // Initialize global error logging only in browser
    initializeGlobalErrorLogging();
  }, []);

  // This component doesn't render anything
  return null;
}
