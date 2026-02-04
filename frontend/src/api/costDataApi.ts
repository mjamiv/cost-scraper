import { CostDataResponse, FilterOptions, QueryFilters, WBSDataResponse, ProjectsResponse, Project } from './types';
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

export async function fetchProjects(
  districtId?: string,
  activeOnly: boolean = true
): Promise<ProjectsResponse> {
  if (isStaticDeployment) {
    const mockProjects: Project[] = [
      { PROJECT_NUMBER: '106049', PROJECT_DESCRIPTION: 'IH-35 Corridor Expansion', LEAD_DISTRICT_ID: 'SE5001', LEAD_DISTRICT: 'Southeast Region' },
      { PROJECT_NUMBER: '104831', PROJECT_DESCRIPTION: 'US-290 Bridge Replacement', LEAD_DISTRICT_ID: 'SE5001', LEAD_DISTRICT: 'Southeast Region' },
      { PROJECT_NUMBER: '105553', PROJECT_DESCRIPTION: 'SH-130 Toll Road Phase 2', LEAD_DISTRICT_ID: 'NW3002', LEAD_DISTRICT: 'Northwest Division' },
      { PROJECT_NUMBER: '104834', PROJECT_DESCRIPTION: 'Loop 360 Interchange', LEAD_DISTRICT_ID: 'CE4003', LEAD_DISTRICT: 'Central Operations' },
      { PROJECT_NUMBER: '106073', PROJECT_DESCRIPTION: 'MoPac South Extension', LEAD_DISTRICT_ID: 'SE5001', LEAD_DISTRICT: 'Southeast Region' },
      { PROJECT_NUMBER: '106345', PROJECT_DESCRIPTION: 'FM 620 Widening Project', LEAD_DISTRICT_ID: 'NW3002', LEAD_DISTRICT: 'Northwest Division' },
      { PROJECT_NUMBER: '105119', PROJECT_DESCRIPTION: 'IH-10 Katy Freeway', LEAD_DISTRICT_ID: 'SE5001', LEAD_DISTRICT: 'Southeast Region' },
      { PROJECT_NUMBER: '104980', PROJECT_DESCRIPTION: 'US-183 Safety Improvements', LEAD_DISTRICT_ID: 'CE4003', LEAD_DISTRICT: 'Central Operations' },
    ];
    return {
      success: true,
      projects: districtId ? mockProjects.filter(p => p.LEAD_DISTRICT_ID === districtId) : mockProjects,
      count: mockProjects.length,
      timing_ms: 0
    };
  }

  const params = new URLSearchParams();
  if (districtId) params.append('district_id', districtId);
  params.append('active_only', activeOnly.toString());

  const response = await fetch(`${API_BASE}/projects?${params.toString()}`);

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

export interface ChatFilterHints {
  project_numbers?: string[];
  start_month?: string;
  end_month?: string;
  district_id?: string;
  wbs_tags?: Record<string, string[]>;
}

export interface ChatContextPrefs {
  exclude_current_month?: boolean;
}

export interface ChartRequest {
  type: 'spend-trend' | 'earned-value' | 'project-comparison' | 'budget-pie' | 'variance';
  metric?: string | null;
  groupBy?: string | null;
  projects?: string[] | null;
  dateRange?: { start?: string; end?: string } | null;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  filter_hints?: ChatFilterHints;
  context_prefs?: ChatContextPrefs;
}

export interface ChatResponse {
  success: boolean;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  needs_clarification: boolean;
  clarifying_question?: string | null;
  data_coverage: { rowCount: number; projectCount: number; periodCount: number };
  chart_request?: ChartRequest | null;
  error?: string;
}

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  // For static deployment, return a demo response
  if (isStaticDeployment) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      success: true,
      answer: `This is a demo response. In production, this would analyze your cost data and answer: "${request.message}".`,
      confidence: 'medium',
      needs_clarification: false,
      clarifying_question: null,
      data_coverage: { rowCount: 0, projectCount: 0, periodCount: 0 },
      chart_request: null
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
// OpenAI Realtime API supported voices (as of Jan 2025)
// Can be a built-in voice string or a custom voice ID
export type VoiceId = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse' | string;

export interface RealtimeSessionConfig {
  voice?: VoiceId;
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

// Custom Voice API types
export interface CustomVoiceEligibilityResponse {
  eligible: boolean;
  message: string;
}

export interface CustomVoiceConsentResponse {
  success: boolean;
  consent_id: string;
  message: string;
}

export interface CustomVoiceCreateResponse {
  success: boolean;
  voice_id: string;
  name: string;
  message: string;
}

export interface CustomVoiceDeleteResponse {
  success: boolean;
  message: string;
}

/**
 * Check if the account is eligible for custom voice creation.
 */
export async function checkCustomVoiceEligibility(): Promise<CustomVoiceEligibilityResponse> {
  if (isStaticDeployment) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      eligible: false,
      message: 'Custom voices are not available in demo mode. Connect to a backend to use this feature.'
    };
  }

  const response = await fetch(`${API_BASE}/voice/custom/eligibility`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

/**
 * Upload consent recording for voice cloning.
 */
export async function uploadConsent(
  audioBlob: Blob,
  languageTag: string = 'en-US'
): Promise<CustomVoiceConsentResponse> {
  if (isStaticDeployment) {
    await new Promise(resolve => setTimeout(resolve, 500));
    throw new Error('Custom voices are not available in demo mode.');
  }

  const formData = new FormData();
  formData.append('audio', audioBlob, 'consent.webm');
  formData.append('language_tag', languageTag);

  const response = await fetch(`${API_BASE}/voice/custom/consent`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    // Handle specific error codes
    if (response.status === 403) {
      throw new Error('Custom voices require OpenAI approval. Contact sales@openai.com');
    }
    if (response.status === 413) {
      throw new Error('Audio file too large. Maximum size is 10MB.');
    }
    if (response.status === 422) {
      throw new Error(errorData.detail || 'Consent phrase not recognized. Please read the exact phrase shown.');
    }
    if (response.status === 429) {
      throw new Error('Rate limited. Please wait a moment and try again.');
    }

    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

/**
 * Create a custom voice from a voice sample.
 */
export async function createCustomVoice(
  audioBlob: Blob,
  consentId: string,
  name: string,
  languageTag: string = 'en-US'
): Promise<CustomVoiceCreateResponse> {
  if (isStaticDeployment) {
    await new Promise(resolve => setTimeout(resolve, 500));
    throw new Error('Custom voices are not available in demo mode.');
  }

  const formData = new FormData();
  formData.append('audio', audioBlob, 'voice_sample.webm');
  formData.append('consent_id', consentId);
  formData.append('name', name);
  formData.append('language_tag', languageTag);

  const response = await fetch(`${API_BASE}/voice/custom/create`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    // Handle specific error codes
    if (response.status === 403) {
      throw new Error('Custom voices require OpenAI approval. Contact sales@openai.com');
    }
    if (response.status === 413) {
      throw new Error('Audio file too large. Maximum size is 10MB.');
    }
    if (response.status === 422) {
      throw new Error(errorData.detail || 'Voice sample rejected. Please record a clearer sample.');
    }
    if (response.status === 429) {
      throw new Error('Rate limited. Please wait a moment and try again.');
    }

    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete a custom voice.
 */
export async function deleteCustomVoice(voiceId: string): Promise<CustomVoiceDeleteResponse> {
  if (isStaticDeployment) {
    await new Promise(resolve => setTimeout(resolve, 300));
    throw new Error('Custom voices are not available in demo mode.');
  }

  const response = await fetch(`${API_BASE}/voice/custom/${encodeURIComponent(voiceId)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    if (response.status === 404) {
      throw new Error('Voice not found. It may have already been deleted.');
    }
    if (response.status === 403) {
      throw new Error('Not authorized to delete this voice.');
    }

    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

// WBS Data API functions
export async function fetchWBSData(projectNumbers: string, limit: number = 1000): Promise<WBSDataResponse> {
  if (isStaticDeployment) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      success: false,
      columns: [],
      rows: [],
      row_count: 0,
      query_id: 'demo',
      timing_ms: 0,
      view_name: 'PROD_ENT_CONSUMPTION.SEM_VW.WBS',
      message: 'WBS data not available in demo mode'
    };
  }

  const params = new URLSearchParams();
  params.append('project_numbers', projectNumbers);
  params.append('limit', limit.toString());

  const response = await fetch(`${API_BASE}/wbs-data?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchWBSSnapshot(
  projectNumbers: string,
  fiscalMonth?: string,
  limit: number = 1000
): Promise<WBSDataResponse> {
  if (isStaticDeployment) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      success: false,
      columns: [],
      rows: [],
      row_count: 0,
      query_id: 'demo',
      timing_ms: 0,
      view_name: 'PROD_ENT_CONSUMPTION.SEM_VW.WBS_SNAPSHOT_FLAT_WITH_ATTRIBUTES',
      message: 'WBS snapshot data not available in demo mode'
    };
  }

  const params = new URLSearchParams();
  params.append('project_numbers', projectNumbers);
  params.append('limit', limit.toString());
  if (fiscalMonth) {
    params.append('fiscal_month', fiscalMonth);
  }

  const response = await fetch(`${API_BASE}/wbs-snapshot?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export { isStaticDeployment };

