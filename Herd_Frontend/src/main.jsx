import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

Sentry.init({
  dsn: "https://78aafb2376f3471625d00f32d77183e5@o4511846047416320.ingest.us.sentry.io/4511846065963008",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0, 
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Set dark mode as default BEFORE React renders (MP-3 §17.1)
const savedTheme = localStorage.getItem('herd-settings')
  ? JSON.parse(localStorage.getItem('herd-settings'))?.state?.theme
  : null;
document.documentElement.setAttribute('data-theme', savedTheme || 'light');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
