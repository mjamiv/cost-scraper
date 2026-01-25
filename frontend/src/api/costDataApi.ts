import { CostDataResponse, FilterOptions, QueryFilters } from './types';
import { getMockCostDataResponse } from './mockData';

const API_BASE = '/api';

// Check if running on GitHub Pages (static deployment)
const isStaticDeployment = import.meta.env.PROD && window.location.hostname.includes('github.io');

export async function fetchCostData(filters: QueryFilters): Promise<CostDataResponse> {
  // Use mock data for GitHub Pages demo
  if (isStaticDeployment) {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    const projects = filters.projectNumbers.split(',').map(p => p.trim()).filter(Boolean);
    return getMockCostDataResponse(projects, filters.startMonth, filters.districtId || undefined);
  }

  const params = new URLSearchParams();
  
  if (filters.projectNumbers) {
    params.append('project_numbers', filters.projectNumbers);
  }
  if (filters.startMonth) {
    params.append('start_month', filters.startMonth);
  }
  if (filters.districtId) {
    params.append('district_id', filters.districtId);
  }
  
  const response = await fetch(`${API_BASE}/cost-data?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  if (isStaticDeployment) {
    return {
      districts: [
        { LEAD_DISTRICT: 'Southeast Region', LEAD_DISTRICT_ID: 'SE5001' },
        { LEAD_DISTRICT: 'Northwest Division', LEAD_DISTRICT_ID: 'NW3002' },
        { LEAD_DISTRICT: 'Central Operations', LEAD_DISTRICT_ID: 'CE4003' },
      ],
      fiscal_months: ['202203', '202202', '202201', '202112', '202111', '202110', '202109', '202108', '202107', '202106', '202105', '202104', '202103', '202102', '202101'],
    };
  }

  const response = await fetch(`${API_BASE}/filters`);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchDistricts() {
  if (isStaticDeployment) {
    return [
      { LEAD_DISTRICT: 'Southeast Region', LEAD_DISTRICT_ID: 'SE5001' },
      { LEAD_DISTRICT: 'Northwest Division', LEAD_DISTRICT_ID: 'NW3002' },
      { LEAD_DISTRICT: 'Central Operations', LEAD_DISTRICT_ID: 'CE4003' },
    ];
  }

  const response = await fetch(`${API_BASE}/districts`);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function fetchProjects(districtId?: string) {
  if (isStaticDeployment) {
    const projects = ['106049', '104831', '105553', '104834', '106073', '106345', '105119', '104980'];
    return projects.map(p => ({
      PROJECT_NUMBER: p,
      LEAD_DISTRICT_ID: 'SE5001',
      LEAD_DISTRICT: 'Southeast Region',
    }));
  }

  const params = districtId ? `?district_id=${districtId}` : '';
  const response = await fetch(`${API_BASE}/projects${params}`);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Chat API types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  data_context: string;
  history: ChatMessage[];
}

export interface ChatResponse {
  success: boolean;
  response: string;
  error?: string;
}

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  // For static deployment, return a demo response
  if (isStaticDeployment) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      success: true,
      response: `This is a demo response. In production, this would analyze your cost data and answer: "${request.message}"\n\nTo enable the AI chatbot, connect to a backend with the ANTHROPIC_API_KEY configured.`
    };
  }

  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

export async function* streamChatMessage(request: ChatRequest): AsyncGenerator<string, void, unknown> {
  // For static deployment, simulate streaming
  if (isStaticDeployment) {
    const demoResponse = `This is a demo response. In production, this would analyze your cost data and answer: "${request.message}"\n\nTo enable the AI chatbot, connect to a backend with the ANTHROPIC_API_KEY configured.`;
    for (const word of demoResponse.split(' ')) {
      await new Promise(resolve => setTimeout(resolve, 50));
      yield word + ' ';
    }
    return;
  }

  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        if (data.startsWith('[ERROR]')) {
          throw new Error(data.slice(8));
        }
        yield data;
      }
    }
  }
}

// Voice API functions
export async function transcribeAudio(audioBlob: Blob): Promise<{ success: boolean; text: string }> {
  if (isStaticDeployment) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true, text: "This is a demo transcription. Connect to backend for real voice input." };
  }

  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.webm');

  const response = await fetch(`${API_BASE}/voice/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.status}`);
  }

  return response.json();
}

export async function synthesizeSpeech(text: string, voice: string = 'alloy'): Promise<Blob> {
  if (isStaticDeployment) {
    // Return empty audio for demo
    return new Blob([], { type: 'audio/mpeg' });
  }

  const formData = new FormData();
  formData.append('text', text);
  formData.append('voice', voice);

  const response = await fetch(`${API_BASE}/voice/synthesize`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Speech synthesis failed: ${response.status}`);
  }

  return response.blob();
}

// Realtime Voice API types
export interface RealtimeSessionConfig {
  voice?: 'alloy' | 'nova' | 'echo' | 'fable' | 'onyx' | 'shimmer';
  temperature?: number;
}

export interface RealtimeTokenRequest {
  data_context: string;
  session_config?: RealtimeSessionConfig;
}

export interface RealtimeTokenResponse {
  client_secret: string;
  session_id: string;
  expires_at: number;  // Unix timestamp
  voice: string;
}

export async function getRealtimeToken(request: RealtimeTokenRequest): Promise<RealtimeTokenResponse> {
  if (isStaticDeployment) {
    // Demo mode - return mock response
    // Note: WebRTC won't actually work without real token, but UI can be demonstrated
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      client_secret: 'demo-token-not-functional',
      session_id: 'demo-session',
      expires_at: Math.floor((Date.now() + 600000) / 1000),  // Unix timestamp
      voice: request.session_config?.voice || 'alloy'
    };
  }

  const response = await fetch(`${API_BASE}/voice/realtime-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

export { isStaticDeployment };

