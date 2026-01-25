import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { CostDataRow } from '../api/types';
import { useRealtimeVoice, ChartRequest, VoiceState, ConversationItem } from '../hooks/useRealtimeVoice';
import { generateMarkdownSummary } from '../utils/llmDataFormatter';
import {
  SpendTrendChart,
  EarnedValueChart,
  ProjectComparisonChart,
  BudgetPieChart,
  VarianceChart,
} from './ChatCharts';
import '../styles/voice-chat.css';

interface VoiceChatPanelProps {
  data: CostDataRow[];
  isOpen: boolean;
  onClose: () => void;
}

type VoiceOption = 'alloy' | 'nova' | 'echo' | 'fable' | 'onyx' | 'shimmer';

const VOICE_OPTIONS: { value: VoiceOption; label: string }[] = [
  { value: 'alloy', label: 'Alloy (Neutral)' },
  { value: 'nova', label: 'Nova (Female)' },
  { value: 'echo', label: 'Echo (Male)' },
  { value: 'fable', label: 'Fable (British)' },
  { value: 'onyx', label: 'Onyx (Deep)' },
  { value: 'shimmer', label: 'Shimmer (Soft)' },
];

function getStatusText(state: VoiceState, isMuted: boolean): string {
  switch (state) {
    case 'disconnected':
      return 'Ready to connect';
    case 'connecting':
      return 'Connecting...';
    case 'connected':
      return isMuted ? 'Muted' : 'Speak to ask a question';
    case 'listening':
      return 'Listening...';
    case 'speaking':
      return 'Speaking...';
    case 'error':
      return 'Error occurred';
    default:
      return '';
  }
}

function getStatusDotClass(state: VoiceState): string {
  switch (state) {
    case 'connected':
    case 'listening':
    case 'speaking':
      return 'connected';
    case 'connecting':
      return 'connecting';
    case 'error':
      return 'error';
    default:
      return '';
  }
}

function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

export function VoiceChatPanel({ data, isOpen, onClose }: VoiceChatPanelProps) {
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>('alloy');
  const [activeChart, setActiveChart] = useState<ChartRequest | null>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  // Generate data context for the voice assistant
  const dataContext = useMemo(() => {
    if (!data.length) return 'No cost data is currently loaded.';
    return generateMarkdownSummary(data);
  }, [data]);

  // Handle chart requests from voice
  const handleChartRequest = useCallback((request: ChartRequest) => {
    setActiveChart(request);
  }, []);

  // Handle session end
  const handleSessionEnd = useCallback(() => {
    setActiveChart(null);
  }, []);

  // Handle errors
  const handleError = useCallback((errorMsg: string) => {
    console.error('Voice error:', errorMsg);
  }, []);

  // Initialize voice hook
  const {
    state,
    isConnected,
    isListening,
    isSpeaking,
    isMuted,
    transcript,
    aiResponse,
    error,
    usage,
    conversationHistory,
    startSession,
    endSession,
    toggleMute,
  } = useRealtimeVoice({
    dataContext,
    sessionConfig: { voice: selectedVoice },
    onChartRequest: handleChartRequest,
    onSessionEnd: handleSessionEnd,
    onError: handleError,
  });

  // Auto-scroll history to bottom
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, transcript, aiResponse]);

  // Handle close
  const handleClose = useCallback(() => {
    if (isConnected) {
      endSession();
    }
    setActiveChart(null);
    onClose();
  }, [isConnected, endSession, onClose]);

  // Don't render if not open
  if (!isOpen) return null;

  // Render the appropriate chart
  const renderChart = () => {
    if (!activeChart || !data.length) return null;

    const chartProps = { data, title: activeChart.title };

    switch (activeChart.chartType) {
      case 'spend-trend':
        return <SpendTrendChart {...chartProps} />;
      case 'earned-value':
        return <EarnedValueChart {...chartProps} />;
      case 'project-comparison':
        return <ProjectComparisonChart {...chartProps} />;
      case 'budget-pie':
        return <BudgetPieChart {...chartProps} />;
      case 'variance':
        return <VarianceChart {...chartProps} />;
      default:
        return null;
    }
  };

  // Build display items: history + live transcript/response
  const displayItems: (ConversationItem | { role: 'user' | 'assistant'; text: string; live: true })[] = [
    ...conversationHistory,
  ];

  // Add live transcript if listening
  if (isListening && transcript) {
    displayItems.push({ role: 'user', text: transcript, live: true, timestamp: new Date() } as ConversationItem & { live: true });
  }

  // Add live AI response if speaking
  if (isSpeaking && aiResponse) {
    displayItems.push({ role: 'assistant', text: aiResponse, live: true, timestamp: new Date() } as ConversationItem & { live: true });
  }

  return (
    <div className="voice-chat-overlay" onClick={handleClose}>
      <div className="voice-chat-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="voice-chat-header">
          <div className="voice-chat-title">
            {/* Cost Chat Bot Icon - Dollar sign with chat bubble */}
            <svg className="w-6 h-6 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
              <path d="M12 7v2m0 4v2m-2-6c0-1 .5-2 2-2s2 1 2 2-.5 1.5-2 2c-1.5.5-2 1-2 2s.5 2 2 2 2-1 2-2" strokeLinecap="round" />
            </svg>
            <span>Cost Assistant</span>
          </div>
          <div className="voice-chat-status">
            <span className={`voice-chat-status-dot ${getStatusDotClass(state)}`} />
            <span className="text-neutral-400">{getStatusText(state, isMuted)}</span>
          </div>
          <button onClick={handleClose} className="voice-chat-close-btn" title="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cost counter */}
        {isConnected && (
          <div className="voice-cost-counter">
            <span className="voice-cost-label">Session Cost:</span>
            <span className="voice-cost-value">{formatCost(usage.totalCost)}</span>
            <span className="voice-cost-breakdown">
              (in: {usage.inputAudioSec.toFixed(1)}s, out: {usage.outputAudioSec.toFixed(1)}s)
            </span>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="voice-error">
            <svg className="voice-error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* No data warning */}
        {data.length === 0 && (
          <div className="voice-error">
            <svg className="voice-error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Load cost data first to enable voice analysis</span>
          </div>
        )}

        {/* Voice Orb Visualizer */}
        <div className="voice-orb-container">
          {/* Pulse rings */}
          {isListening && (
            <>
              <div className="voice-pulse listening" />
              <div className="voice-pulse listening" />
              <div className="voice-pulse listening" />
            </>
          )}
          {isSpeaking && (
            <>
              <div className="voice-pulse speaking" />
              <div className="voice-pulse speaking" />
              <div className="voice-pulse speaking" />
            </>
          )}

          {/* Main orb */}
          <div
            className={`voice-orb ${
              isListening ? 'listening' : isSpeaking ? 'speaking' : state === 'connecting' ? 'connecting' : ''
            }`}
          >
            {isListening ? (
              <svg className="voice-orb-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
              </svg>
            ) : isSpeaking ? (
              <svg className="voice-orb-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            ) : (
              // Dollar sign chat icon for idle state
              <svg className="voice-orb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 7v2m0 4v2m-2-6c0-1 .5-2 2-2s2 1 2 2-.5 1.5-2 2c-1.5.5-2 1-2 2s.5 2 2 2 2-1 2-2" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </div>

        {/* Voice selector (only when disconnected) */}
        {!isConnected && (
          <div className="voice-selector">
            <label htmlFor="voice-select" className="voice-selector-label">
              Voice:
            </label>
            <select
              id="voice-select"
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value as VoiceOption)}
              className="voice-selector-select"
            >
              {VOICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Control buttons */}
        <div className="voice-control-buttons">
          {!isConnected ? (
            <button
              onClick={startSession}
              disabled={state === 'connecting' || data.length === 0}
              className="voice-btn voice-start-btn"
            >
              <svg className="voice-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {state === 'connecting' ? 'Connecting...' : 'Start Voice Chat'}
            </button>
          ) : (
            <>
              <button onClick={toggleMute} className={`voice-btn voice-mute-btn ${isMuted ? 'muted' : ''}`}>
                {isMuted ? (
                  <svg className="voice-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="voice-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
              <button onClick={endSession} className="voice-btn voice-end-btn">
                <svg className="voice-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                End Session
              </button>
            </>
          )}
        </div>

        {/* Conversation history - below control buttons */}
        <div className="voice-history">
          {displayItems.length === 0 && isConnected ? (
            <div className="voice-history-placeholder">
              Say something like "What's my budget status?" or "Show me the spend chart"
            </div>
          ) : displayItems.length === 0 ? (
            <div className="voice-history-placeholder">
              Click Start to begin voice chat
            </div>
          ) : (
            displayItems.map((item, index) => (
              <div
                key={index}
                className={`voice-history-item ${item.role} ${'live' in item && item.live ? 'live' : ''}`}
              >
                <div className="voice-history-avatar">
                  {item.role === 'user' ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm0-4h-2V7h2v8z" />
                    </svg>
                  )}
                </div>
                <div className="voice-history-content">
                  <span className="voice-history-role">{item.role === 'user' ? 'You' : 'Assistant'}</span>
                  <span className="voice-history-text">{item.text}</span>
                </div>
              </div>
            ))
          )}
          <div ref={historyEndRef} />
        </div>

        {/* Chart display area */}
        {activeChart && data.length > 0 && (
          <div className="voice-chart-area">
            {renderChart()}
          </div>
        )}
      </div>
    </div>
  );
}
