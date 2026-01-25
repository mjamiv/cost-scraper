import { useState, useRef, useCallback } from 'react';
import { getRealtimeToken, isStaticDeployment, RealtimeSessionConfig } from '../api/costDataApi';

export type VoiceState = 'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error';

export interface ChartRequest {
  chartType: 'spend-trend' | 'variance' | 'project-comparison' | 'budget-pie' | 'earned-value';
  title?: string;
}

// OpenAI Realtime API pricing (as of Jan 2025)
// Audio input: $0.06/min = $0.001/sec
// Audio output: $0.24/min = $0.004/sec
// Text tokens: ~$0.00001/token (blended)
const PRICING = {
  audioInputPerSec: 0.001,
  audioOutputPerSec: 0.004,
  textTokens: 0.00001,
};

export interface UsageCost {
  inputAudioSec: number;
  outputAudioSec: number;
  textTokens: number;
  totalCost: number;
}

export interface UseRealtimeVoiceOptions {
  dataContext: string;
  sessionConfig?: RealtimeSessionConfig;
  onChartRequest?: (request: ChartRequest) => void;
  onSessionEnd?: () => void;
  onError?: (error: string) => void;
}

export interface ConversationItem {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export interface UseRealtimeVoiceReturn {
  state: VoiceState;
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  transcript: string;
  aiResponse: string;
  error: string | null;
  usage: UsageCost;
  conversationHistory: ConversationItem[];
  startSession: () => Promise<void>;
  endSession: () => void;
  toggleMute: () => void;
}

export function useRealtimeVoice(options: UseRealtimeVoiceOptions): UseRealtimeVoiceReturn {
  const { dataContext, sessionConfig, onChartRequest, onSessionEnd, onError } = options;

  // State
  const [state, setState] = useState<VoiceState>('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationItem[]>([]);

  // Usage tracking
  const [usage, setUsage] = useState<UsageCost>({
    inputAudioSec: 0,
    outputAudioSec: 0,
    textTokens: 0,
    totalCost: 0,
  });

  // Refs for WebRTC objects
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Track current function call for responses
  const currentFunctionCallRef = useRef<{ callId: string; name: string } | null>(null);

  // Track audio timing for cost estimation
  const audioTimingRef = useRef<{
    inputStartTime: number | null;
    outputStartTime: number | null;
  }>({ inputStartTime: null, outputStartTime: null });

  // Update usage cost
  const updateUsage = useCallback((updates: Partial<Omit<UsageCost, 'totalCost'>>) => {
    setUsage(prev => {
      const newUsage = {
        inputAudioSec: prev.inputAudioSec + (updates.inputAudioSec || 0),
        outputAudioSec: prev.outputAudioSec + (updates.outputAudioSec || 0),
        textTokens: prev.textTokens + (updates.textTokens || 0),
        totalCost: 0,
      };
      newUsage.totalCost =
        newUsage.inputAudioSec * PRICING.audioInputPerSec +
        newUsage.outputAudioSec * PRICING.audioOutputPerSec +
        newUsage.textTokens * PRICING.textTokens;
      return newUsage;
    });
  }, []);

  // Clean up resources
  const cleanup = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }

    setTranscript('');
    setAiResponse('');
    currentFunctionCallRef.current = null;
    audioTimingRef.current = { inputStartTime: null, outputStartTime: null };
  }, []);

  // Send message through data channel
  const sendDataChannelMessage = useCallback((event: object) => {
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(event));
    }
  }, []);

  // Handle function call results
  const sendFunctionResult = useCallback((callId: string, result: object) => {
    sendDataChannelMessage({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(result)
      }
    });
    // Trigger response after function result
    sendDataChannelMessage({ type: 'response.create' });
  }, [sendDataChannelMessage]);

  // Process data channel events
  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'session.created':
          console.log('Realtime session created');
          setState('connected');
          break;

        case 'session.updated':
          console.log('Session updated');
          break;

        case 'input_audio_buffer.speech_started':
          setState('listening');
          setTranscript('');
          audioTimingRef.current.inputStartTime = Date.now();
          break;

        case 'input_audio_buffer.speech_stopped':
          // Track input audio duration
          if (audioTimingRef.current.inputStartTime) {
            const duration = (Date.now() - audioTimingRef.current.inputStartTime) / 1000;
            updateUsage({ inputAudioSec: duration });
            audioTimingRef.current.inputStartTime = null;
          }
          break;

        case 'conversation.item.input_audio_transcription.completed':
          // User's speech transcribed
          setTranscript(data.transcript || '');
          setConversationHistory(prev => [
            ...prev,
            { role: 'user', text: data.transcript || '', timestamp: new Date() }
          ]);
          break;

        case 'response.created':
          setState('speaking');
          setAiResponse('');
          audioTimingRef.current.outputStartTime = Date.now();
          break;

        case 'response.audio_transcript.delta':
          // Streaming AI response text
          setAiResponse(prev => prev + (data.delta || ''));
          break;

        case 'response.audio_transcript.done':
          // AI response complete
          setConversationHistory(prev => [
            ...prev,
            { role: 'assistant', text: data.transcript || '', timestamp: new Date() }
          ]);
          break;

        case 'response.function_call_arguments.delta':
          // Function call arguments streaming
          break;

        case 'response.function_call_arguments.done':
          // Function call complete - extract and process
          if (data.call_id && data.name) {
            currentFunctionCallRef.current = { callId: data.call_id, name: data.name };

            try {
              const args = JSON.parse(data.arguments || '{}');

              if (data.name === 'show_chart' && onChartRequest) {
                onChartRequest({
                  chartType: args.chart_type,
                  title: args.title
                });
                sendFunctionResult(data.call_id, { success: true, message: 'Chart displayed' });
              } else if (data.name === 'get_executive_summary') {
                sendFunctionResult(data.call_id, { success: true, message: 'Summary refreshed' });
              } else if (data.name === 'end_voice_session') {
                sendFunctionResult(data.call_id, { success: true, message: 'Session ending' });
                // End session after a brief delay to allow goodbye
                setTimeout(() => {
                  endSession();
                  onSessionEnd?.();
                }, 2000);
              }
            } catch (e) {
              console.error('Error parsing function arguments:', e);
              sendFunctionResult(data.call_id, { success: false, error: 'Failed to parse arguments' });
            }
          }
          break;

        case 'output_audio_buffer.started':
          // AI is about to start speaking
          setState('speaking');
          break;

        case 'output_audio_buffer.stopped':
          // AI finished playing audio - return to connected state
          if (state === 'speaking') {
            setState('connected');
          }
          break;

        case 'response.done':
          // Track output audio duration
          if (audioTimingRef.current.outputStartTime) {
            const duration = (Date.now() - audioTimingRef.current.outputStartTime) / 1000;
            updateUsage({ outputAudioSec: duration });
            audioTimingRef.current.outputStartTime = null;
          }

          // Also track usage from response if available
          if (data.response?.usage) {
            const u = data.response.usage;
            // OpenAI may provide token counts
            if (u.total_tokens) {
              updateUsage({ textTokens: u.total_tokens });
            }
          }

          // Only set to connected if not already speaking (audio might still be playing)
          if (state !== 'speaking') {
            setState('connected');
          }
          break;

        case 'input_audio_buffer.committed':
          // User's audio was committed for processing
          break;

        case 'conversation.item.created':
          // A new conversation item was created
          break;

        case 'rate_limits.updated':
          // Rate limit info - can be used for monitoring
          break;

        case 'error':
          console.error('Realtime API error:', data.error);
          setError(data.error?.message || 'Unknown error');
          onError?.(data.error?.message || 'Unknown error');
          break;

        default:
          // Log unhandled events for debugging
          if (import.meta.env.DEV) {
            console.log('Unhandled event:', data.type, data);
          }
      }
    } catch (e) {
      console.error('Error processing data channel message:', e);
    }
  }, [onChartRequest, onSessionEnd, onError, sendFunctionResult, updateUsage]);

  // Start voice session
  const startSession = useCallback(async () => {
    if (state !== 'disconnected' && state !== 'error') {
      return;
    }

    setError(null);
    setState('connecting');
    setConversationHistory([]);
    setUsage({ inputAudioSec: 0, outputAudioSec: 0, textTokens: 0, totalCost: 0 });

    try {
      // Demo mode warning
      if (isStaticDeployment) {
        setError('Voice chat requires a backend connection. This is a demo preview.');
        setState('error');
        return;
      }

      // Get ephemeral token from backend
      const tokenResponse = await getRealtimeToken({
        data_context: dataContext,
        session_config: sessionConfig
      });

      // Request microphone access with enhanced noise suppression
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          // Additional constraints for better voice quality
          channelCount: { ideal: 1 },           // Mono audio for voice
          sampleRate: { ideal: 24000 },         // Match OpenAI's expected sample rate
          sampleSize: { ideal: 16 },            // 16-bit audio
          latency: { ideal: 0.01 },             // Low latency
        }
      });
      localStreamRef.current = localStream;

      // Create RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [] // OpenAI doesn't use ICE servers
      });
      peerConnectionRef.current = pc;

      // Add local audio track
      localStream.getAudioTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      // Handle remote audio (AI responses)
      pc.ontrack = (event) => {
        if (event.streams[0]) {
          const audio = new Audio();
          audio.srcObject = event.streams[0];
          audio.autoplay = true;
          audioElementRef.current = audio;
        }
      };

      // Create data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log('Data channel open');
      };

      dc.onmessage = handleDataChannelMessage;

      dc.onerror = (event) => {
        console.error('Data channel error:', event);
        setError('Connection error');
        setState('error');
      };

      dc.onclose = () => {
        console.log('Data channel closed');
        if (state !== 'disconnected') {
          setState('disconnected');
        }
      };

      // Connection state monitoring
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setError('Connection lost');
          setState('error');
          cleanup();
        }
      };

      // Create and set local SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to OpenAI and get answer
      const sdpResponse = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenResponse.client_secret}`,
            'Content-Type': 'application/sdp'
          },
          body: offer.sdp
        }
      );

      if (!sdpResponse.ok) {
        throw new Error(`SDP negotiation failed: ${sdpResponse.status}`);
      }

      const answerSdp = await sdpResponse.text();

      // Set remote description
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });

      console.log('WebRTC connection established');

    } catch (err) {
      console.error('Failed to start voice session:', err);
      const message = err instanceof Error ? err.message : 'Failed to start voice session';

      // Provide helpful error messages
      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setError('Microphone access denied. Please allow microphone access and try again.');
      } else if (message.includes('NotFoundError')) {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError(message);
      }

      onError?.(message);
      setState('error');
      cleanup();
    }
  }, [state, dataContext, sessionConfig, handleDataChannelMessage, onError, cleanup]);

  // End voice session
  const endSession = useCallback(() => {
    cleanup();
    setState('disconnected');
  }, [cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  return {
    state,
    isConnected: state === 'connected' || state === 'listening' || state === 'speaking',
    isListening: state === 'listening',
    isSpeaking: state === 'speaking',
    isMuted,
    transcript,
    aiResponse,
    error,
    usage,
    conversationHistory,
    startSession,
    endSession,
    toggleMute
  };
}
