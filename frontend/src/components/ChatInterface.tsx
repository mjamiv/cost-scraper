import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CostDataRow } from '../api/types';
import { ChatMessage, streamChatMessage, transcribeAudio, synthesizeSpeech } from '../api/costDataApi';
import { generateMarkdownSummary } from '../utils/llmDataFormatter';
import { InlineChatChart, ChartType, detectChartRequest } from './ChatCharts';

interface ExtendedChatMessage extends ChatMessage {
  chartType?: ChartType;
}

// Preprocess markdown to fix formatting issues (headers, lists, tables)
function preprocessMarkdown(content: string): string {
  let result = content;

  // 1. Normalize line endings
  result = result.replace(/\r\n/g, '\n');

  // 2. Add blank lines before headers (###, ##, #) if not already present
  // Match any non-newline char followed by optional newline and then a header
  result = result.replace(/([^\n])\n?(#{1,6}\s)/g, '$1\n\n$2');

  // 3. Split headers that run directly into table pipes (e.g., "### Title| Col1 | Col2")
  result = result.replace(/(#{1,6}\s[^|\n]+)\|/g, '$1\n\n|');

  // 4. Add blank lines after headers if followed by non-header content
  result = result.replace(/(#{1,6}\s[^\n]+)\n([^\n#\s])/g, '$1\n\n$2');

  // 5. Add blank lines before bullet lists (ensure list items are properly separated)
  result = result.replace(/([^\n\-\*\s])\n([-\*]\s)/g, '$1\n\n$2');

  // 6. Add blank lines before numbered lists
  result = result.replace(/([^\n\d\s])\n(\d+\.\s)/g, '$1\n\n$2');

  // 7. Fix inline tables where || indicates row breaks
  if (result.includes('||') && result.includes('|') && (result.match(/\|/g) || []).length >= 6) {
    result = result.replace(/\|\|/g, '|\n|');
  }

  // 8. Process tables to ensure proper formatting
  const lines = result.split('\n');
  const processed: string[] = [];
  let inTable = false;
  let tableLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect table rows (lines that start and end with pipes or have multiple pipes)
    const isPipeRow = (trimmed.startsWith('|') && trimmed.endsWith('|')) ||
      (trimmed.includes('|') && trimmed.split('|').length >= 3);

    if (isPipeRow) {
      if (!inTable) {
        inTable = true;
        tableLines = [];
        // Add blank line before table if needed
        if (processed.length > 0 && processed[processed.length - 1] !== '') {
          processed.push('');
        }
      }
      tableLines.push(trimmed);
    } else {
      if (inTable) {
        // End of table - process collected table lines
        if (tableLines.length > 0) {
          // Check if we have a separator row
          const hasSeparator = tableLines.some(l => /^\|[\s\-:|]+\|$/.test(l) || /^[\s\-:|]+$/.test(l.replace(/\|/g, '')));

          if (!hasSeparator && tableLines.length > 1) {
            // Insert separator after first row
            const headerRow = tableLines[0];
            const colCount = headerRow.split('|').filter(c => c.trim()).length;
            const separator = '|' + Array(colCount).fill('---').join('|') + '|';
            tableLines.splice(1, 0, separator);
          }

          processed.push(...tableLines);
          processed.push(''); // Add blank line after table
        }
        inTable = false;
        tableLines = [];
      }
      processed.push(line);
    }
  }

  // Handle case where content ends with a table
  if (inTable && tableLines.length > 0) {
    const hasSeparator = tableLines.some(l => /^\|[\s\-:|]+\|$/.test(l));
    if (!hasSeparator && tableLines.length > 1) {
      const headerRow = tableLines[0];
      const colCount = headerRow.split('|').filter(c => c.trim()).length;
      const separator = '|' + Array(colCount).fill('---').join('|') + '|';
      tableLines.splice(1, 0, separator);
    }
    processed.push(...tableLines);
    processed.push('');
  }

  // 9. Clean up artifacts
  result = processed.join('\n');
  result = result.replace(/,?\s*\[object Object\],?\s*/g, ' ');
  result = result.replace(/\[object Object\]/g, '');

  // 10. Normalize multiple blank lines to max 2
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

// Helper to extract text content from React children
function getTextContent(children: ReactNode): string {
  if (children === null || children === undefined) return '';
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    return children.map(getTextContent).join('');
  }
  // For React elements, try to get the children prop
  if (typeof children === 'object' && 'props' in children && children.props?.children) {
    return getTextContent(children.props.children);
  }
  return '';
}

// Custom paragraph component that handles table-like content in paragraphs
function TableAwareParagraph({ children }: { children?: ReactNode }) {
  // Extract text content properly to avoid [object Object]
  const content = getTextContent(children);

  // If the paragraph contains pipe characters that look like a table
  if (content.includes('|') && content.split('|').length >= 4) {
    // Split by newlines or || to get rows
    const rows = content.split(/\n|\|\|/).filter(r => r.trim() && r.includes('|'));

    if (rows.length >= 2) {
      // Parse as table - keep all cells including empty ones for proper alignment
      const tableRows = rows
        .filter(row => !row.match(/^[\s\-:|]+$/)) // Skip separator rows
        .map(row => {
          // Split by | and handle edge cases
          const cells = row.split('|');
          // Remove first and last if they're empty (from leading/trailing |)
          if (cells[0]?.trim() === '') cells.shift();
          if (cells[cells.length - 1]?.trim() === '') cells.pop();
          return cells.map(cell => cell.trim());
        })
        .filter(row => row.length >= 2 && row.some(cell => cell)); // Must have at least 2 cells with content

      if (tableRows.length >= 1) {
        const headerRow = tableRows[0];
        const bodyRows = tableRows.slice(1);

        return (
          <table>
            <thead>
              <tr>
                {headerRow.map((cell, i) => (
                  <th key={i}>{cell || '\u00A0'}</th>
                ))}
              </tr>
            </thead>
            {bodyRows.length > 0 && (
              <tbody>
                {bodyRows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx}>{cell || '\u00A0'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        );
      }
    }
  }

  return <p>{children}</p>;
}

// Custom components for ReactMarkdown
const markdownComponents: Components = {
  p: TableAwareParagraph,
};

// Loading skeleton for streaming responses
function LoadingSkeleton() {
  return (
    <div className="chat-skeleton">
      <div className="chat-skeleton-line w-full"></div>
      <div className="chat-skeleton-line w-3/4"></div>
      <div className="chat-skeleton-line w-1/2"></div>
    </div>
  );
}

// Avatar components
function UserAvatar() {
  return (
    <div className="chat-avatar chat-avatar-user">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="chat-avatar chat-avatar-assistant">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    </div>
  );
}

interface ExtendedChatMessageWithMeta extends ExtendedChatMessage {
  timestamp?: string;
}

// Helper to get formatted timestamp
function getTimestamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface ChatInterfaceProps {
  data: CostDataRow[];
  onCommand?: (command: string) => void;
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
      'Show me a variance chart',
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
    id: 'charts',
    label: 'Charts',
    icon: '📈',
    prompts: [
      'Show me the spend trend chart',
      'Show me a project comparison chart',
      'Show me budget allocation pie chart',
    ],
  },
];

// Command help text
const COMMAND_HELP = `
**Available Commands:**

| Command | Description |
|---------|-------------|
| \`/filter project 106049,104831\` | Set project filter |
| \`/filter month 202301\` | Set start month |
| \`/filter district D01\` | Set district |
| \`/search\` | Execute search with current filters |
| \`/show chart\` | Open sidebar, show chart |
| \`/show table\` | Open sidebar, show table |
| \`/show filters\` | Open sidebar, show filters |
| \`/export\` | Open sidebar, show export |
| \`/chart spend\` | Show spend trend chart in chat |
| \`/chart projects\` | Show project comparison chart |
| \`/chart budget\` | Show budget pie chart |
| \`/chart variance\` | Show variance chart |
| \`/help\` | Show this help |
`;

export function ChatInterface({ data, onCommand }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ExtendedChatMessageWithMeta[]>([]);
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

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

  // Add a chart message
  const addChartMessage = (chartType: ChartType, title: string) => {
    const timestamp = getTimestamp();
    if (!data.length) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: `Show ${title}`, timestamp },
        { role: 'assistant', content: 'No data loaded. Please load project data first using the filters.', timestamp },
      ]);
      return;
    }

    setMessages(prev => [
      ...prev,
      { role: 'user', content: `Show ${title}`, timestamp },
      { role: 'assistant', content: '', chartType, timestamp },
    ]);
  };

  const handleSendMessage = async (messageText?: string) => {
    const userMessage = (messageText || input).trim();
    if (!userMessage || isLoading) return;

    const timestamp = getTimestamp();
    setInput('');
    setActiveCategory(null);

    // Check for commands
    if (userMessage.startsWith('/')) {
      const lowerCommand = userMessage.toLowerCase();

      // Help command - show in chat
      if (lowerCommand === '/help') {
        setMessages(prev => [
          ...prev,
          { role: 'user', content: userMessage, timestamp },
          { role: 'assistant', content: COMMAND_HELP, timestamp },
        ]);
        return;
      }

      // Chart commands
      if (lowerCommand.startsWith('/chart')) {
        const chartArg = lowerCommand.replace('/chart', '').trim();
        let chartType: ChartType | null = null;
        let chartTitle = '';

        if (chartArg.includes('spend') || chartArg.includes('trend')) {
          chartType = 'spend-trend';
          chartTitle = 'Spend Trend Chart';
        } else if (chartArg.includes('project') || chartArg.includes('comparison')) {
          chartType = 'project-comparison';
          chartTitle = 'Project Comparison Chart';
        } else if (chartArg.includes('budget') || chartArg.includes('pie')) {
          chartType = 'budget-pie';
          chartTitle = 'Budget Allocation Chart';
        } else if (chartArg.includes('variance')) {
          chartType = 'variance';
          chartTitle = 'Variance Chart';
        } else {
          chartType = 'spend-trend';
          chartTitle = 'Spend Trend Chart';
        }

        addChartMessage(chartType, chartTitle);
        return;
      }

      // Pass command to parent
      if (onCommand) {
        onCommand(userMessage);

        // Show confirmation in chat
        let confirmMsg = '';
        if (lowerCommand.startsWith('/filter')) {
          confirmMsg = `Filter updated: \`${userMessage}\``;
        } else if (lowerCommand.startsWith('/show')) {
          confirmMsg = `Opening ${userMessage.replace('/show ', '')}...`;
        } else if (lowerCommand === '/search') {
          confirmMsg = 'Executing search...';
        } else if (lowerCommand === '/export') {
          confirmMsg = 'Opening export panel...';
        }

        if (confirmMsg) {
          setMessages(prev => [
            ...prev,
            { role: 'user', content: userMessage, timestamp },
            { role: 'assistant', content: confirmMsg, timestamp },
          ]);
        }
        return;
      }
    }

    // Check if user is asking for a chart
    const detectedChart = detectChartRequest(userMessage);

    // Normal message flow
    setIsLoading(true);
    const newUserMessage: ExtendedChatMessageWithMeta = { role: 'user', content: userMessage, timestamp };
    setMessages(prev => [...prev, newUserMessage]);
    setMessages(prev => [...prev, { role: 'assistant', content: '', chartType: detectedChart || undefined, timestamp }]);

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
          const lastMsg = updated[updated.length - 1];
          updated[updated.length - 1] = { ...lastMsg, content: fullResponse };
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
      content = `# northstar.cost-chat Export\n\n**Exported:** ${timestamp}\n\n---\n\n`;
      messages.forEach(msg => {
        const role = msg.role === 'user' ? '**You**' : '**Analyst**';
        content += `${role}:\n${msg.content}\n\n---\n\n`;
      });
    } else {
      content = `northstar.cost-chat Export\nExported: ${timestamp}\n\n`;
      messages.forEach(msg => {
        const role = msg.role === 'user' ? 'You' : 'Analyst';
        content += `${role}:\n${msg.content}\n\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `northstar-chat-${new Date().toISOString().split('T')[0]}.${format === 'markdown' ? 'md' : 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // Calculate data summary
  const dataSummary = data.length > 0 ? {
    projects: new Set(data.map(r => r.PROJECT_NUMBER)).size,
    records: data.length,
  } : null;

  return (
    <div className="chat-container">
      {/* Playing Indicator */}
      {isPlaying && (
        <div className="chat-playing-indicator">
          <div className="flex items-center gap-2 text-gold text-sm">
            <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
            <span>Speaking...</span>
          </div>
          <button onClick={stopAudio} className="text-gold hover:text-gold/80 text-xs font-medium">
            Stop
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome-centered">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Northstar" className="w-20 h-20 mx-auto mb-6" />
            <h2 className="text-xl font-semibold text-white mb-2">Chat with Cost</h2>
            <p className="text-neutral-400 mb-6 max-w-md">
              Your cost analysis assistant.
            </p>

            {data.length > 0 ? (
              <>
                {/* Analysis Categories */}
                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  {ANALYSIS_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                      className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>

                {/* Category Prompts */}
                {activeCategory && (
                  <div className="space-y-2 mb-6 max-w-md mx-auto">
                    {ANALYSIS_CATEGORIES.find(c => c.id === activeCategory)?.prompts.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(prompt)}
                        className="chat-suggestion"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Example Prompts */}
                {!activeCategory && (
                  <div className="space-y-2 max-w-md mx-auto">
                    <p className="text-sm text-neutral-400 mb-3">Try These Examples. Or try your own!</p>
                    <button
                      onClick={() => handleSendMessage('Give me an executive summary of the current cost status')}
                      className="chat-suggestion"
                    >
                      📊 Executive Summary
                    </button>
                    <button
                      onClick={() => addChartMessage('spend-trend', 'Spend Trend Chart')}
                      className="chat-suggestion"
                    >
                      📈 Show Spend Trend Chart
                    </button>
                    <button
                      onClick={() => handleSendMessage('/help')}
                      className="chat-suggestion"
                    >
                      💡 Show available commands
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="no-data-notice">
                <p className="font-medium mb-1">No data loaded</p>
                <p className="opacity-70">
                  Open the sidebar filters or type <code>/show filters</code> to load project data.
                </p>
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
                {/* Avatar */}
                {message.role === 'user' ? <UserAvatar /> : <AssistantAvatar />}

                {/* Message wrapper for content + timestamp */}
                <div className="chat-message-wrapper">
                  <div className="chat-message-content group relative">
                    {message.content ? (
                      message.role === 'assistant' ? (
                        <>
                          <div className="chat-markdown">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {preprocessMarkdown(message.content)}
                            </ReactMarkdown>
                          </div>
                          {/* Render chart if present */}
                          {message.chartType && data.length > 0 && (
                            <div className="mt-4">
                              <InlineChatChart type={message.chartType} data={data} />
                            </div>
                          )}
                        </>
                      ) : (
                        message.content
                      )
                    ) : message.chartType && data.length > 0 ? (
                      // Chart-only message (no text)
                      <InlineChatChart type={message.chartType} data={data} />
                    ) : (
                      <LoadingSkeleton />
                    )}
                    {/* Copy button for assistant messages */}
                    {message.role === 'assistant' && message.content && (
                      <button
                        onClick={() => handleCopyMessage(message.content)}
                        className="chat-copy-btn"
                        title="Copy message"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {/* Timestamp */}
                  {message.timestamp && (
                    <div className="chat-message-meta">
                      <span className="chat-timestamp">{message.timestamp}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area with Controls */}
      <div className="chat-input-wrapper">
        <div className="chat-input-container">
          {/* Voice Record Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading}
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
            placeholder={isRecording ? 'Listening...' : 'Ask about costs, or try /chart spend, /help'}
            className="chat-input"
            disabled={isLoading || isRecording}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
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

          {/* Divider */}
          <div className="chat-input-divider" />

          {/* Voice Toggle */}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`chat-control-btn ${voiceEnabled ? 'active' : ''}`}
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
              className="chat-control-btn"
              title="Export conversation"
              disabled={messages.length === 0}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 bottom-full mb-2 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
                <button
                  onClick={() => handleExportChat('markdown')}
                  className="w-full px-3 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-700"
                >
                  Export as Markdown
                </button>
                <button
                  onClick={() => handleExportChat('text')}
                  className="w-full px-3 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-700"
                >
                  Export as Text
                </button>
              </div>
            )}
          </div>

          {/* Clear Chat */}
          <button
            onClick={handleClear}
            className="chat-control-btn"
            title="Clear chat"
            disabled={messages.length === 0}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Data summary below input */}
        {dataSummary && (
          <div className="chat-input-meta">
            {dataSummary.projects} projects · {dataSummary.records.toLocaleString()} records loaded
          </div>
        )}
      </div>
    </div>
  );
}
