import { useState, useCallback, useEffect, useRef } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import {
  checkCustomVoiceEligibility,
  uploadConsent,
  createCustomVoice,
} from '../api/costDataApi';
import '../styles/voice-chat.css';

export interface CustomVoiceWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceCreated: (voice: { id: string; name: string; languageTag: string }) => void;
}

type WizardStep = 'eligibility' | 'consent' | 'sample' | 'creating' | 'success' | 'error';

const CONSENT_PHRASE = 'I agree to have my voice used to create a synthetic voice.';

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'it-IT', label: 'Italian (Italy)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
];

const SAMPLE_TIPS = [
  'Speak clearly in a normal tone of voice',
  'Record in a quiet environment',
  'Maintain consistent distance from microphone',
  'Speak for 10-30 seconds',
];

export function CustomVoiceWizard({ isOpen, onClose, onVoiceCreated }: CustomVoiceWizardProps) {
  const [step, setStep] = useState<WizardStep>('eligibility');
  const [error, setError] = useState<string | null>(null);
  const [languageTag, setLanguageTag] = useState('en-US');
  const [voiceName, setVoiceName] = useState('');
  const [consentId, setConsentId] = useState<string | null>(null);
  const [creationProgress, setCreationProgress] = useState(0);
  const [createdVoice, setCreatedVoice] = useState<{ id: string; name: string } | null>(null);

  // Separate recorders for consent and sample
  const consentRecorder = useAudioRecorder({ maxDuration: 10 });
  const sampleRecorder = useAudioRecorder({ maxDuration: 30 });

  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Check eligibility on open
  useEffect(() => {
    if (isOpen) {
      setStep('eligibility');
      setError(null);
      checkEligibility();
    }
  }, [isOpen]);

  // Reset wizard state when closing
  const handleClose = useCallback(() => {
    setStep('eligibility');
    setError(null);
    setLanguageTag('en-US');
    setVoiceName('');
    setConsentId(null);
    setCreationProgress(0);
    setCreatedVoice(null);
    consentRecorder.clearRecording();
    sampleRecorder.clearRecording();
    onClose();
  }, [onClose, consentRecorder, sampleRecorder]);

  const checkEligibility = async () => {
    try {
      setError(null);
      const result = await checkCustomVoiceEligibility();

      if (result.eligible) {
        setStep('consent');
      } else {
        setError(result.message);
        setStep('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check eligibility');
      setStep('error');
    }
  };

  const handleConsentSubmit = async () => {
    if (!consentRecorder.audioBlob) {
      setError('Please record the consent phrase first');
      return;
    }

    if (consentRecorder.duration < 2) {
      setError('Recording is too short. Please read the full consent phrase.');
      return;
    }

    try {
      setError(null);
      setStep('creating');
      setCreationProgress(25);

      const result = await uploadConsent(consentRecorder.audioBlob, languageTag);

      setConsentId(result.consent_id);
      setCreationProgress(50);
      setStep('sample');
      consentRecorder.clearRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload consent');
      setStep('consent');
    }
  };

  const handleVoiceCreate = async () => {
    if (!sampleRecorder.audioBlob) {
      setError('Please record a voice sample first');
      return;
    }

    if (sampleRecorder.duration < 10) {
      setError('Recording is too short. Please record at least 10 seconds.');
      return;
    }

    if (!voiceName.trim()) {
      setError('Please enter a name for your voice');
      return;
    }

    if (!consentId) {
      setError('Consent not found. Please start over.');
      setStep('consent');
      return;
    }

    try {
      setError(null);
      setStep('creating');
      setCreationProgress(75);

      const result = await createCustomVoice(
        sampleRecorder.audioBlob,
        consentId,
        voiceName.trim(),
        languageTag
      );

      setCreationProgress(100);
      setCreatedVoice({ id: result.voice_id, name: result.name });
      setStep('success');

      // Notify parent
      onVoiceCreated({
        id: result.voice_id,
        name: result.name,
        languageTag,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create voice');
      setStep('sample');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const getStepNumber = (): number => {
    switch (step) {
      case 'eligibility': return 0;
      case 'consent': return 1;
      case 'sample':
      case 'creating':
        return consentId ? 2 : 1;
      case 'success':
      case 'error':
        return 3;
      default: return 0;
    }
  };

  return (
    <div className="wizard-overlay" onClick={handleClose}>
      <div className="wizard-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="wizard-header">
          <h2 className="wizard-title">Create Custom Voice</h2>
          <button onClick={handleClose} className="wizard-close-btn" title="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicators */}
        {step !== 'error' && (
          <div className="wizard-steps">
            <div className={`wizard-step ${getStepNumber() >= 1 ? 'active' : ''} ${getStepNumber() > 1 ? 'completed' : ''}`}>
              <span className="wizard-step-dot" />
              <span className="wizard-step-label">Consent</span>
            </div>
            <div className="wizard-step-line" />
            <div className={`wizard-step ${getStepNumber() >= 2 ? 'active' : ''} ${getStepNumber() > 2 ? 'completed' : ''}`}>
              <span className="wizard-step-dot" />
              <span className="wizard-step-label">Sample</span>
            </div>
            <div className="wizard-step-line" />
            <div className={`wizard-step ${getStepNumber() >= 3 ? 'active' : ''}`}>
              <span className="wizard-step-dot" />
              <span className="wizard-step-label">Create</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="wizard-content">
          {/* Eligibility Check */}
          {step === 'eligibility' && (
            <div className="wizard-step-content">
              <div className="wizard-loading">
                <div className="wizard-spinner" />
                <p>Checking account eligibility...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="wizard-step-content">
              <div className="wizard-error-state">
                <svg className="wizard-error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3>Unable to Continue</h3>
                <p className="wizard-error-message">{error}</p>
                <button onClick={handleClose} className="wizard-btn wizard-btn-primary">
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Consent Recording */}
          {step === 'consent' && (
            <div className="wizard-step-content">
              <h3 className="wizard-step-title">Record Consent</h3>
              <p className="wizard-step-description">
                To create a voice clone, you must first record yourself reading the consent phrase below.
              </p>

              {/* Language selector */}
              <div className="wizard-field">
                <label htmlFor="language-select" className="wizard-label">Language</label>
                <select
                  id="language-select"
                  value={languageTag}
                  onChange={e => setLanguageTag(e.target.value)}
                  className="wizard-select"
                  disabled={consentRecorder.isRecording}
                >
                  {LANGUAGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Consent phrase */}
              <div className="wizard-consent-box">
                <span className="wizard-consent-label">Read this aloud:</span>
                <p className="wizard-consent-phrase">"{CONSENT_PHRASE}"</p>
              </div>

              {/* Recording controls */}
              <div className="wizard-recorder">
                <div className="wizard-recorder-visual">
                  <div className={`wizard-record-orb ${consentRecorder.isRecording ? 'recording' : ''}`}>
                    {consentRecorder.isRecording && (
                      <div className="wizard-audio-level" style={{ transform: `scale(${1 + consentRecorder.audioLevel * 0.5})` }} />
                    )}
                    <svg className="wizard-record-icon" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  </div>
                  <span className="wizard-duration">{formatDuration(consentRecorder.duration)}</span>
                </div>

                <div className="wizard-recorder-buttons">
                  {!consentRecorder.isRecording && !consentRecorder.audioBlob && (
                    <button onClick={consentRecorder.startRecording} className="wizard-btn wizard-btn-record">
                      Start Recording
                    </button>
                  )}
                  {consentRecorder.isRecording && (
                    <button onClick={consentRecorder.stopRecording} className="wizard-btn wizard-btn-stop">
                      Stop Recording
                    </button>
                  )}
                  {consentRecorder.audioBlob && !consentRecorder.isRecording && (
                    <>
                      <audio
                        ref={audioPreviewRef}
                        src={consentRecorder.audioUrl || undefined}
                        className="wizard-audio-preview"
                        controls
                      />
                      <button onClick={consentRecorder.clearRecording} className="wizard-btn wizard-btn-secondary">
                        Re-record
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Error display */}
              {(error || consentRecorder.error) && (
                <div className="wizard-inline-error">
                  {error || consentRecorder.error}
                </div>
              )}

              {/* Actions */}
              <div className="wizard-actions">
                <button onClick={handleClose} className="wizard-btn wizard-btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleConsentSubmit}
                  disabled={!consentRecorder.audioBlob || consentRecorder.isRecording}
                  className="wizard-btn wizard-btn-primary"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Voice Sample Recording */}
          {step === 'sample' && (
            <div className="wizard-step-content">
              <h3 className="wizard-step-title">Record Voice Sample</h3>
              <p className="wizard-step-description">
                Record 10-30 seconds of your natural speaking voice. This will be used to create your custom voice.
              </p>

              {/* Voice name input */}
              <div className="wizard-field">
                <label htmlFor="voice-name" className="wizard-label">Voice Name</label>
                <input
                  id="voice-name"
                  type="text"
                  value={voiceName}
                  onChange={e => setVoiceName(e.target.value)}
                  placeholder="e.g., My Voice, Professional, Narrator"
                  className="wizard-input"
                  maxLength={50}
                  disabled={sampleRecorder.isRecording}
                />
              </div>

              {/* Tips */}
              <div className="wizard-tips">
                <span className="wizard-tips-title">Tips for best results:</span>
                <ul className="wizard-tips-list">
                  {SAMPLE_TIPS.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>

              {/* Recording controls */}
              <div className="wizard-recorder">
                <div className="wizard-recorder-visual">
                  <div className={`wizard-record-orb ${sampleRecorder.isRecording ? 'recording' : ''}`}>
                    {sampleRecorder.isRecording && (
                      <div className="wizard-audio-level" style={{ transform: `scale(${1 + sampleRecorder.audioLevel * 0.5})` }} />
                    )}
                    <svg className="wizard-record-icon" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  </div>
                  <span className="wizard-duration">
                    {formatDuration(sampleRecorder.duration)}
                    {sampleRecorder.isRecording && <span className="wizard-duration-hint"> / 0:30</span>}
                  </span>
                </div>

                <div className="wizard-recorder-buttons">
                  {!sampleRecorder.isRecording && !sampleRecorder.audioBlob && (
                    <button onClick={sampleRecorder.startRecording} className="wizard-btn wizard-btn-record">
                      Start Recording
                    </button>
                  )}
                  {sampleRecorder.isRecording && (
                    <button onClick={sampleRecorder.stopRecording} className="wizard-btn wizard-btn-stop">
                      Stop Recording
                    </button>
                  )}
                  {sampleRecorder.audioBlob && !sampleRecorder.isRecording && (
                    <>
                      <audio
                        src={sampleRecorder.audioUrl || undefined}
                        className="wizard-audio-preview"
                        controls
                      />
                      <button onClick={sampleRecorder.clearRecording} className="wizard-btn wizard-btn-secondary">
                        Re-record
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Error display */}
              {(error || sampleRecorder.error) && (
                <div className="wizard-inline-error">
                  {error || sampleRecorder.error}
                </div>
              )}

              {/* Actions */}
              <div className="wizard-actions">
                <button onClick={() => { setStep('consent'); sampleRecorder.clearRecording(); }} className="wizard-btn wizard-btn-secondary">
                  Back
                </button>
                <button
                  onClick={handleVoiceCreate}
                  disabled={!sampleRecorder.audioBlob || sampleRecorder.isRecording || !voiceName.trim()}
                  className="wizard-btn wizard-btn-primary"
                >
                  Create Voice
                </button>
              </div>
            </div>
          )}

          {/* Creating State */}
          {step === 'creating' && (
            <div className="wizard-step-content">
              <div className="wizard-creating">
                <div className="wizard-spinner" />
                <h3>Creating Your Voice</h3>
                <p className="wizard-creating-message">
                  {creationProgress < 50 && 'Uploading consent recording...'}
                  {creationProgress >= 50 && creationProgress < 75 && 'Consent verified. Proceed with voice sample.'}
                  {creationProgress >= 75 && 'Processing voice sample...'}
                </p>
                <div className="wizard-progress-bar">
                  <div className="wizard-progress-fill" style={{ width: `${creationProgress}%` }} />
                </div>
                <span className="wizard-progress-text">{creationProgress}%</span>
              </div>
            </div>
          )}

          {/* Success State */}
          {step === 'success' && createdVoice && (
            <div className="wizard-step-content">
              <div className="wizard-success">
                <svg className="wizard-success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3>Voice Created!</h3>
                <p className="wizard-success-message">
                  Your custom voice "{createdVoice.name}" is ready to use.
                </p>
                <button onClick={handleClose} className="wizard-btn wizard-btn-primary">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
