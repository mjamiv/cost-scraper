import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CostDataRow } from '../api/types';
import { ChatMessage, streamChatMessage, transcribeAudio, synthesizeSpeech } from '../api/costDataApi';
import { generateMarkdownSummary } from '../utils/llmDataFormatter';

interface ChatBotProps {
  data: CostDataRow[];
}

// Analysis categories with targeted prompts
const ANALYSIS_CATEGORIES = [
  {
    id: 'overview',
    label: 'Overview',
    icon: '📊',
    prompts: [
      'Give me an executive summary of the cost status',
      'What are the key financial metrics I should know?',
      'Summarize budget vs actual performance',
    ],
  },
  {
    id: 'variance',
    label: 'Variance',
    icon: '⚠️',
    prompts: [
      'What are the top 5 unfavorable variances?',
      'Which cost categories are over budget?',
      'Analyze the SL variance trends',
    ],
  },
  {
    id: 'forecast',
    label: 'Forecast',
    icon: '🔮',
    prompts: [
      'What is the forecast at completion?',
      'How has the forecast changed recently?',
      'Are we trending over or under budget?',
    ],
  },
  {
    id: 'trends',
    label: 'Trends',
    icon: '📈',
    prompts: [
      'How is spending trending month over month?',
      'What is the burn rate pattern?',
      'Compare recent periods to historical average',
    ],
  },
];

export function ChatBot({ data }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Generate data context for the AI
  const getDataContext = useCallback(() => {
    if (!data.length) {
      return 'No cost data is currently loaded. Please load some project data first.';
    }
    return generateMarkdownSummary(data);
  }, [data]);

  // Play audio response
  const playAudioResponse = async (text: string) => {
    if (!voiceEnabled || !text) return;

    try {
      setIsPlaying(true);
      const audioBlob = await synthesizeSpeech(text, 'nova');

      if (audioBlob.size === 0) {
        setIsPlaying(false);
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error('Audio playback error:', error);
      setIsPlaying(false);
    }
  };

  // Stop audio playback
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        try {
          setIsLoading(true);
          const result = await transcribeAudio(audioBlob);
          if (result.success && result.text) {
            setInput(result.text);
            handleSendMessage(result.text);
          }
        } catch (error) {
          console.error('Transcription error:', error);
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const userMessage = (messageText || input).trim();
    if (!userMessage || isLoading) return;

    setInput('');
    setActiveCategory(null);
    setIsLoading(true);

    const newUserMessage: ChatMessage = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const dataContext = getDataContext();
      let fullResponse = '';

      for await (const chunk of streamChatMessage({
        message: userMessage,
        data_context: dataContext,
        history: messages,
      })) {
        fullResponse += chunk;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: fullResponse };
          return updated;
        });
      }

      if (voiceEnabled && fullResponse) {
        playAudioResponse(fullResponse);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage}`,
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => handleSendMessage();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    stopAudio();
    setActiveCategory(null);
  };

  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleExportChat = (format: 'markdown' | 'text') => {
    if (messages.length === 0) return;

    let content = '';
    const timestamp = new Date().toLocaleString();

    if (format === 'markdown') {
      content = `# Cost Analysis Chat Export\n\n**Exported:** ${timestamp}\n\n---\n\n`;
      messages.forEach(msg => {
        const role = msg.role === 'user' ? '**You**' : '**Analyst**';
        content += `${role}:\n${msg.content}\n\n---\n\n`;
      });
    } else {
      content = `Cost Analysis Chat Export\nExported: ${timestamp}\n\n`;
      messages.forEach(msg => {
        const role = msg.role === 'user' ? 'You' : 'Analyst';
        content += `${role}:\n${msg.content}\n\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost-analysis-chat-${new Date().toISOString().split('T')[0]}.${format === 'markdown' ? 'md' : 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  // Calculate data summary for header
  const dataSummary = data.length > 0 ? {
    projects: new Set(data.map(r => r.PROJECT_NUMBER)).size,
    records: data.length,
  } : null;

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="chat-toggle-btn"
        title={isOpen ? 'Close analyst' : 'Open cost analyst'}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )}
        {!isOpen && data.length > 0 && (
          <span className="chat-badge">AI</span>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-header">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-midnight-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Cost Analyst</h3>
                <p className="text-xs text-slate-400">
                  {dataSummary
                    ? `${dataSummary.projects} projects · ${dataSummary.records.toLocaleString()} records`
                    : 'No data loaded'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Voice Toggle */}
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`p-1.5 rounded-full transition-colors ${
                  voiceEnabled ? 'bg-accent/20 text-accent' : 'bg-midnight-700 text-slate-500'
                }`}
                title={voiceEnabled ? 'Voice responses ON' : 'Voice responses OFF'}
              >
                {voiceEnabled ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                )}
              </button>

              {/* Export Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-1.5 rounded-full bg-midnight-700 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Export conversation"
                  disabled={messages.length === 0}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-midnight-800 border border-midnight-600 rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
                    <button
                      onClick={() => handleExportChat('markdown')}
                      className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-midnight-700"
                    >
                      Export as Markdown
                    </button>
                    <button
                      onClick={() => handleExportChat('text')}
                      className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-midnight-700"
                    >
                      Export as Text
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleClear}
                className="p-1.5 rounded-full bg-midnight-700 text-slate-400 hover:text-slate-200 transition-colors"
                title="Clear chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Playing Indicator */}
          {isPlaying && (
            <div className="px-4 py-2 bg-accent/10 border-b border-accent/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-accent text-sm">
                <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
                <span>Speaking...</span>
              </div>
              <button onClick={stopAudio} className="text-accent hover:text-accent/80 text-xs font-medium">
                Stop
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-welcome">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-slate-100 mb-1">Cost Analysis Assistant</h4>
                <p className="text-sm text-slate-400 mb-4">
                  I can help you analyze budgets, variances, forecasts, and spending trends.
                </p>

                {data.length > 0 ? (
                  <>
                    {/* Analysis Categories */}
                    <div className="flex flex-wrap gap-2 justify-center mb-4">
                      {ANALYSIS_CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            activeCategory === cat.id
                              ? 'bg-accent text-midnight-950'
                              : 'bg-midnight-700 text-slate-300 hover:bg-midnight-600'
                          }`}
                        >
                          {cat.icon} {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Category Prompts */}
                    {activeCategory && (
                      <div className="space-y-2 mb-4">
                        {ANALYSIS_CATEGORIES.find(c => c.id === activeCategory)?.prompts.map((prompt, i) => (
                          <button
                            key={i}
                            onClick={() => handlePromptClick(prompt)}
                            className="chat-suggestion"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Quick Start Prompts */}
                    {!activeCategory && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Quick Start</p>
                        <button
                          onClick={() => handlePromptClick('Give me an executive summary of the current cost status')}
                          className="chat-suggestion"
                        >
                          📊 Executive Summary
                        </button>
                        <button
                          onClick={() => handlePromptClick('What are the top risks and concerns I should focus on?')}
                          className="chat-suggestion"
                        >
                          ⚠️ Top Risks & Concerns
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-300">
                    <p className="font-medium mb-1">No data loaded</p>
                    <p className="text-amber-300/70">Use the filter bar above to load project cost data, then return here for analysis.</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`chat-message ${message.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'}`}
                  >
                    <div className="chat-message-content group relative">
                      {message.content ? (
                        message.role === 'assistant' ? (
                          <div className="chat-markdown">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          message.content
                        )
                      ) : (
                        <span className="chat-typing">
                          <span></span>
                          <span></span>
                          <span></span>
                        </span>
                      )}
                      {/* Copy button for assistant messages */}
                      {message.role === 'assistant' && message.content && (
                        <button
                          onClick={() => handleCopyMessage(message.content)}
                          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-midnight-600 rounded text-slate-400 hover:text-slate-200"
                          title="Copy message"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="chat-input-container">
            {/* Voice Record Button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading || data.length === 0}
              className={`chat-voice-btn ${isRecording ? 'recording' : ''}`}
              title={isRecording ? 'Stop recording' : 'Voice input'}
            >
              {isRecording ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? 'Listening...' : data.length > 0 ? 'Ask about costs, variances, forecasts...' : 'Load data first...'}
              className="chat-input"
              disabled={isLoading || data.length === 0 || isRecording}
            />

            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || data.length === 0}
              className="chat-send-btn"
            >
              {isLoading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
