import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import type {
  AssistantRoleId,
  CaptainAiChatMessage,
  GeoPoint,
  MapsGroundedPlace,
  VehicleCategory,
} from '../contracts/types';
import {
  getFirebaseAuth,
  getFirebaseDb,
  handleFirestoreError,
  OperationType,
  tsToIso,
} from './firebaseClient';

export interface CaptainRoleMeta {
  id: AssistantRoleId;
  title: string;
  badge: string;
  modelLabel: string;
  modelTier: 'hydrogen' | 'flash_lite';
  description: string;
  quickPrompts: string[];
}

export const CAPTAIN_AI_ROLES: CaptainRoleMeta[] = [
  {
    id: 'maps_navigator',
    title: 'Maps Navigator',
    badge: 'Google Maps Grounded',
    modelLabel: 'gemini-4-hydrogen + Google Maps',
    modelTier: 'hydrogen',
    description: 'Live petrol/CNG pumps, EV stations, airport cab queues & clean rest stops near your GPS.',
    quickPrompts: [
      'Nearest CNG & petrol pumps open now near me',
      'Best EV fast charging stations nearby',
      'High-demand metro station & cab stand hotspots near me',
      'Affordable dhabas or rest stops nearby with parking',
    ],
  },
  {
    id: 'dispatch_strategist',
    title: 'Dispatch Co-Pilot',
    badge: 'Peak & Route Coach',
    modelLabel: 'gemini-4-hydrogen',
    modelTier: 'hydrogen',
    description: 'Peak-hour zone positioning, surge strategy, passenger handover tips & trip readiness.',
    quickPrompts: [
      'How should I position my vehicle during evening peak hours?',
      'Best checklist before accepting a long airport ride',
      'How to handle passenger wait-time & pickup PIN smoothly',
    ],
  },
  {
    id: 'earnings_analyst',
    title: 'Earnings Planner',
    badge: 'Weekly Goal Advisor',
    modelLabel: 'gemini-4-hydrogen',
    modelTier: 'hydrogen',
    description: 'Daily trip targets, cash commission dues vs UPI wallet splits, and Weekly Goal pacing.',
    quickPrompts: [
      'Break down how many trips I need today to hit my Weekly Goal',
      'Explain how SHINE CAB 15% commission & cash dues work',
      'Compare short hops vs long trips for net hourly income',
    ],
  },
  {
    id: 'quick_helper',
    title: 'Instant Helper',
    badge: 'Fast Flash-Lite',
    modelLabel: 'gemini-3.1-flash-lite',
    modelTier: 'flash_lite',
    description: 'Instant 1-tap help in English or Hinglish for OTP start, KYC upload, SOS & payouts.',
    quickPrompts: [
      'Customer Pickup OTP verify nahi ho raha, kya karun?',
      'Which 4 KYC documents are needed for Admin approval?',
      'How do instant bank/UPI wallet payouts work?',
    ],
  },
];

export interface CaptainDriverContextPayload {
  driverName?: string;
  city?: string;
  vehicleCategory?: VehicleCategory;
  onlineStatus?: string;
  weeklyGoalInr?: number;
  weeklyEarningsInr?: number;
  completedRides?: number;
}

export interface GeminiChatResponse {
  reply: string;
  modelUsed: string;
  roleId: AssistantRoleId;
  mapsSources: MapsGroundedPlace[];
}

export async function sendCaptainAiChat(params: {
  roleId: AssistantRoleId;
  modelTier: 'hydrogen' | 'flash_lite';
  messages: Array<{ role: 'user' | 'model'; text: string }>;
  location?: GeoPoint | null;
  driverContext?: CaptainDriverContextPayload;
}): Promise<GeminiChatResponse> {
  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roleId: params.roleId,
      modelTier: params.modelTier,
      messages: params.messages,
      location: params.location ? { lat: params.location.lat, lng: params.location.lng } : null,
      driverContext: params.driverContext,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as Partial<GeminiChatResponse> & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(payload.error || `Gemini chat failed with HTTP ${res.status}`);
  }

  return {
    reply: payload.reply || '',
    modelUsed: payload.modelUsed || 'gemini-4-hydrogen',
    roleId: payload.roleId || params.roleId,
    mapsSources: Array.isArray(payload.mapsSources) ? payload.mapsSources : [],
  };
}

export async function queryMapsGrounding(params: {
  query: string;
  location?: GeoPoint | null;
  city?: string;
  vehicleCategory?: VehicleCategory;
}): Promise<{ reply: string; modelUsed: string; mapsSources: MapsGroundedPlace[] }> {
  const res = await fetch('/api/gemini/maps-grounding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: params.query,
      location: params.location ? { lat: params.location.lat, lng: params.location.lng } : null,
      city: params.city,
      vehicleCategory: params.vehicleCategory,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    reply?: string;
    modelUsed?: string;
    mapsSources?: MapsGroundedPlace[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(payload.error || `Google Maps Grounding failed with HTTP ${res.status}`);
  }
  return {
    reply: payload.reply || '',
    modelUsed: payload.modelUsed || 'gemini-4-hydrogen',
    mapsSources: Array.isArray(payload.mapsSources) ? payload.mapsSources : [],
  };
}

function mapAiMessageDoc(raw: Record<string, unknown>, id: string): CaptainAiChatMessage {
  let mapsSources: MapsGroundedPlace[] | undefined;
  if (typeof raw.maps_sources_json === 'string' && raw.maps_sources_json.trim()) {
    try {
      const parsed = JSON.parse(raw.maps_sources_json);
      if (Array.isArray(parsed)) {
        mapsSources = parsed.filter(
          (item): item is MapsGroundedPlace =>
            Boolean(item && typeof item.uri === 'string' && typeof item.title === 'string')
        );
      }
    } catch {
      mapsSources = undefined;
    }
  }

  return {
    message_id: String(raw.message_id || id),
    role_id: (raw.role_id as AssistantRoleId) || 'dispatch_strategist',
    sender: raw.sender === 'model' ? 'model' : 'user',
    model_used: raw.model_used ? String(raw.model_used) : null,
    text: String(raw.text || ''),
    maps_sources: mapsSources,
    created_at: tsToIso(raw.created_at),
  };
}

export function subscribeCaptainAiMessages(
  driverId: string,
  onMessages: (msgs: CaptainAiChatMessage[]) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || !driverId) return () => {};

  const q = query(collection(db, 'captain_ai_messages'), where('driver_id', '==', driverId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapAiMessageDoc(d.data() as Record<string, unknown>, d.id))
        .sort((a, b) => (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0));
      onMessages(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'captain_ai_messages');
    }
  );
}

export async function persistCaptainAiMessage(
  driverId: string,
  msg: Omit<CaptainAiChatMessage, 'message_id' | 'created_at'>
): Promise<void> {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || !driverId) return;

  const messageId = `aim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const path = `captain_ai_messages/${messageId}`;
  try {
    const serializedMaps =
      msg.maps_sources && msg.maps_sources.length > 0
        ? JSON.stringify(msg.maps_sources).slice(0, 15500)
        : null;

    await setDoc(doc(db, 'captain_ai_messages', messageId), {
      message_id: messageId,
      driver_id: driverId,
      role_id: msg.role_id,
      sender: msg.sender,
      model_used: msg.model_used ? String(msg.model_used).slice(0, 64) : null,
      text: String(msg.text || '').slice(0, 7900),
      maps_sources_json: serializedMaps,
      created_at: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function clearPersistedCaptainAiMessages(
  driverId: string,
  roleId?: AssistantRoleId
): Promise<void> {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || !driverId) return;

  try {
    const snap = await getDocs(
      query(collection(db, 'captain_ai_messages'), where('driver_id', '==', driverId))
    );
    const targets = snap.docs.filter((d) => !roleId || d.data().role_id === roleId);
    await Promise.all(targets.map((d) => deleteDoc(d.ref)));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'captain_ai_messages');
  }
}
