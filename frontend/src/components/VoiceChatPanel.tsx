import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { CostDataRow } from '../api/types';
import { useRealtimeVoice, ChartRequest, VoiceState, ConversationItem } from '../hooks/useRealtimeVoice';
import { useCustomVoices } from '../hooks/useCustomVoices';
import { deleteCustomVoice } from '../api/costDataApi';
import { generateMarkdownSummary } from '../utils/llmDataFormatter';
import {
  SpendTrendChart,
  EarnedValueChart,
  ProjectComparisonChart,
  BudgetPieChart,
  VarianceChart,
} from './ChatCharts';
import { CustomVoiceWizard } from './CustomVoiceWizard';
import '../styles/voice-chat.css';

interface VoiceChatPanelProps {
  data: CostDataRow[];
  isOpen: boolean;
  onClose: () => void;
}

// OpenAI Realtime API supported voices (as of Jan 2025)
type BuiltInVoice = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse';

// Special value for opening the custom voice wizard
const CREATE_CUSTOM_VOICE = '__create_custom__';

const BUILTIN_VOICE_OPTIONS: { value: BuiltInVoice; label: string }[] = [
  { value: 'alloy', label: 'Alloy (Neutral)' },
  { value: 'ash', label: 'Ash (Confident)' },
  { value: 'ballad', label: 'Ballad (Warm)' },
  { value: 'coral', label: 'Coral (Clear)' },
  { value: 'echo', label: 'Echo (Balanced)' },
  { value: 'sage', label: 'Sage (Calm)' },
  { value: 'shimmer', label: 'Shimmer (Bright)' },
  { value: 'verse', label: 'Verse (Dynamic)' },
];

function isBuiltInVoice(voice: string): voice is BuiltInVoice {
  return BUILTIN_VOICE_OPTIONS.some(opt => opt.value === voice);
}

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
  const [selectedVoice, setSelectedVoice] = useState<string>('alloy');
  const [activeChart, setActiveChart] = useState<ChartRequest | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [deletingVoiceId, setDeletingVoiceId] = useState<string | null>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  // Custom voices hook
  const { voices: customVoices, addVoice, removeVoice } = useCustomVoices();

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

  // Handle custom voice creation
  const handleVoiceCreated = useCallback((voice: { id: string; name: string; languageTag: string }) => {
    addVoice(voice);
    setSelectedVoice(voice.id);
    setIsWizardOpen(false);
  }, [addVoice]);

  // Handle custom voice deletion
  const handleDeleteVoice = useCallback(async (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();  // Prevent selecting the voice
    e.preventDefault();

    if (deletingVoiceId) return;  // Already deleting

    const voice = customVoices.find(v => v.id === voiceId);
    if (!voice) return;

    if (!confirm(`Delete custom voice "${voice.name}"? This cannot be undone.`)) {
      return;
    }

    setDeletingVoiceId(voiceId);

    try {
      // Delete from OpenAI
      await deleteCustomVoice(voiceId);
      // Remove from local storage
      removeVoice(voiceId);
      // Reset selection if deleted voice was selected
      if (selectedVoice === voiceId) {
        setSelectedVoice('alloy');
      }
    } catch (err) {
      console.error('Failed to delete voice:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete voice');
    } finally {
      setDeletingVoiceId(null);
    }
  }, [customVoices, deletingVoiceId, removeVoice, selectedVoice]);

  // Handle voice selection change
  const handleVoiceChange = useCallback((value: string) => {
    if (value === CREATE_CUSTOM_VOICE) {
      setIsWizardOpen(true);
    } else {
      setSelectedVoice(value);
    }
  }, []);

  // Get voice config for API
  const voiceConfig = useMemo(() => {
    // Return the voice ID - both built-in and custom voices are strings
    return selectedVoice;
  }, [selectedVoice]);

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
    sessionConfig: { voice: voiceConfig },
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
          {/* Outer glow ring */}
          <div className={`voice-orb-glow ${isListening ? 'listening' : isSpeaking ? 'speaking' : ''}`} />

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
            {/* Wave bars when active */}
            {(isListening || isSpeaking) ? (
              <div className="voice-orb-waves">
                <div className="voice-orb-wave-bar" />
                <div className="voice-orb-wave-bar" />
                <div className="voice-orb-wave-bar" />
                <div className="voice-orb-wave-bar" />
                <div className="voice-orb-wave-bar" />
              </div>
            ) : (
              // Chat bubble icon for idle state
              <svg className="voice-orb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 10h8M8 14h4" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </div>

        {/* Voice selector (only when disconnected) */}
        {!isConnected && (
          <div className="voice-selector-container">
            <div className="voice-selector">
              <label htmlFor="voice-select" className="voice-selector-label">
                Voice:
              </label>
              <select
                id="voice-select"
                value={selectedVoice}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="voice-selector-select"
              >
                <optgroup label="Built-in Voices">
                  {BUILTIN_VOICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
                {customVoices.length > 0 && (
                  <optgroup label="My Voices">
                    {customVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="">
                  <option value={CREATE_CUSTOM_VOICE}>+ Create Custom Voice</option>
                </optgroup>
              </select>
            </div>

            {/* Delete button for selected custom voice */}
            {!isBuiltInVoice(selectedVoice) && customVoices.some(v => v.id === selectedVoice) && (
              <button
                onClick={(e) => handleDeleteVoice(selectedVoice, e)}
                className="voice-delete-btn"
                title="Delete custom voice"
                disabled={deletingVoiceId === selectedVoice}
              >
                {deletingVoiceId === selectedVoice ? (
                  <svg className="voice-delete-spinner" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="voice-delete-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            )}
          </div>
        )}

        {/* Custom Voice Wizard */}
        <CustomVoiceWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onVoiceCreated={handleVoiceCreated}
        />

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
