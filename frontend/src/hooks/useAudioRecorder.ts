import { useState, useRef, useCallback, useEffect } from 'react';

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  audioLevel: number;
}

export interface UseAudioRecorderOptions {
  maxDuration?: number;  // Maximum recording duration in seconds
  mimeType?: string;     // Preferred MIME type
  onMaxDuration?: () => void;  // Callback when max duration reached
}

export interface UseAudioRecorderReturn extends RecordingState {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearRecording: () => void;
  isSupported: boolean;
}

const DEFAULT_MAX_DURATION = 30;  // 30 seconds default max
const SUPPORTED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
];

function getSupportedMimeType(): string {
  for (const type of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderReturn {
  const {
    maxDuration = DEFAULT_MAX_DURATION,
    mimeType: preferredMimeType,
    onMaxDuration,
  } = options;

  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    error: null,
    audioLevel: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const isSupported = typeof MediaRecorder !== 'undefined' && typeof navigator.mediaDevices !== 'undefined';
  const mimeType = preferredMimeType || getSupportedMimeType();

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Reset refs
    mediaRecorderRef.current = null;
    analyserRef.current = null;
    chunksRef.current = [];
  }, []);

  // Audio level monitoring
  const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalizedLevel = Math.min(1, average / 128);  // Normalize to 0-1

        setState(prev => ({ ...prev, audioLevel: normalizedLevel }));

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.warn('Audio level monitoring not available:', err);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setState(prev => ({ ...prev, error: 'Audio recording is not supported in this browser' }));
      return;
    }

    if (!mimeType) {
      setState(prev => ({ ...prev, error: 'No supported audio format found' }));
      return;
    }

    try {
      // Reset state
      setState({
        isRecording: false,
        duration: 0,
        audioBlob: null,
        audioUrl: null,
        error: null,
        audioLevel: 0,
      });

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      // Handle data available
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle stop
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);

        setState(prev => ({
          ...prev,
          isRecording: false,
          audioBlob: blob,
          audioUrl: url,
          audioLevel: 0,
        }));

        cleanup();
      };

      // Handle error
      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setState(prev => ({
          ...prev,
          isRecording: false,
          error: 'Recording error occurred',
          audioLevel: 0,
        }));
        cleanup();
      };

      // Start recording
      recorder.start(100);  // Collect data every 100ms

      // Start audio level monitoring
      startAudioLevelMonitoring(stream);

      setState(prev => ({ ...prev, isRecording: true, error: null }));

      // Start duration counter
      const startTime = Date.now();
      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setState(prev => ({ ...prev, duration: elapsed }));

        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            onMaxDuration?.();
          }
        }
      }, 100);

    } catch (err) {
      console.error('Error starting recording:', err);
      let errorMessage = 'Failed to start recording';

      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Microphone access denied. Please allow microphone access in browser settings.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Microphone is in use by another application.';
        }
      }

      setState(prev => ({ ...prev, error: errorMessage, isRecording: false }));
      cleanup();
    }
  }, [isSupported, mimeType, maxDuration, onMaxDuration, cleanup, startAudioLevelMonitoring]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const clearRecording = useCallback(() => {
    // Revoke the URL to free memory
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }

    setState({
      isRecording: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      error: null,
      audioLevel: 0,
    });
  }, [state.audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }
    };
  }, [cleanup, state.audioUrl]);

  return {
    ...state,
    startRecording,
    stopRecording,
    clearRecording,
    isSupported,
  };
}
