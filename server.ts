import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type AssistantRoleId =
  | 'maps_navigator'
  | 'dispatch_strategist'
  | 'earnings_analyst'
  | 'quick_helper';

interface ChatTurnInput {
  role: 'user' | 'model';
  text: string;
}

interface DriverContextInput {
  driverName?: string;
  city?: string;
  vehicleCategory?: string;
  onlineStatus?: string;
  weeklyGoalInr?: number;
  weeklyEarningsInr?: number;
  completedRides?: number;
}

interface MapsSourceItem {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets?: string[];
}

const VALID_ROLES = new Set<AssistantRoleId>([
  'maps_navigator',
  'dispatch_strategist',
  'earnings_analyst',
  'quick_helper',
]);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sanitizeLatLng(raw: unknown): { latitude: number; longitude: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as { lat?: unknown; lng?: unknown; latitude?: unknown; longitude?: unknown };
  const lat = Number(candidate.lat ?? candidate.latitude);
  const lng = Number(candidate.lng ?? candidate.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

function buildRoleInstruction(roleId: AssistantRoleId, ctx?: DriverContextInput): string {
  const driverFacts = [
    ctx?.driverName ? `Captain: ${String(ctx.driverName).slice(0, 80)}` : null,
    ctx?.city ? `City: ${String(ctx.city).slice(0, 60)}` : null,
    ctx?.vehicleCategory ? `Vehicle: ${String(ctx.vehicleCategory).toUpperCase().slice(0, 20)}` : null,
    ctx?.onlineStatus ? `Duty: ${String(ctx.onlineStatus).slice(0, 30)}` : null,
    typeof ctx?.weeklyEarningsInr === 'number' && Number.isFinite(ctx.weeklyEarningsInr)
      ? `Weekly Earnings: INR ${Math.round(ctx.weeklyEarningsInr)}`
      : null,
    typeof ctx?.weeklyGoalInr === 'number' && Number.isFinite(ctx.weeklyGoalInr)
      ? `Weekly Goal: INR ${Math.round(ctx.weeklyGoalInr)}`
      : null,
    typeof ctx?.completedRides === 'number' && Number.isFinite(ctx.completedRides)
      ? `Total Trips: ${Math.round(ctx.completedRides)}`
      : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const contextSuffix = driverFacts ? `\nLive Captain Context: ${driverFacts}.` : '';

  switch (roleId) {
    case 'maps_navigator':
      return (
        'You are SHINE CAPTAIN Live Maps Navigator for commercial Bike, Auto, and Cab drivers in India. ' +
        'Use Google Maps grounding to recommend accurate nearby petrol/CNG stations, EV chargers, airport/railway cab stands, clean rest stops, and traffic corridors. ' +
        'Keep answers concise, practical, and clearly structured in bullet points.' +
        contextSuffix
      );
    case 'earnings_analyst':
      return (
        'You are SHINE CAPTAIN Financial & Weekly Goal Analyst. ' +
        'Help drivers maximize net take-home income (15% platform commission model), balance cash dues vs UPI wallet payouts, plan daily trip quotas to hit their Weekly Goal, and maintain 5-star customer ratings.' +
        contextSuffix
      );
    case 'quick_helper':
      return (
        'You are SHINE CAPTAIN Instant Pocket Helper. ' +
        'Give ultra-fast, clear 2-4 line answers (in simple English or Hinglish if the driver writes in Hindi/Hinglish) on 4-digit Pickup OTP checks, KYC document uploads (DL, RC, Aadhaar, Selfie), Emergency SOS, and ride settlement.' +
        contextSuffix
      );
    case 'dispatch_strategist':
    default:
      return (
        'You are SHINE CAPTAIN Dispatch & Demand Co-Pilot for SHINE CAB drivers in India. ' +
        'Advise drivers on peak-hour demand strategy, surge zones, trip acceptance etiquette, vehicle readiness, and passenger safety.' +
        contextSuffix
      );
  }
}

function extractMapsSources(response: unknown): MapsSourceItem[] {
  const resObj = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{
          maps?: {
            uri?: string;
            title?: string;
            placeId?: string;
            placeAnswerSources?: {
              reviewSnippets?: Array<{ reviewText?: string; authorAttribution?: { displayName?: string } }>;
            };
          };
        }>;
      };
    }>;
  };
  const chunks = resObj?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];

  const seen = new Set<string>();
  const items: MapsSourceItem[] = [];
  for (const chunk of chunks) {
    const maps = chunk?.maps;
    if (!maps?.uri || typeof maps.uri !== 'string') continue;
    if (!maps.uri.startsWith('https://') && !maps.uri.startsWith('http://')) continue;
    if (seen.has(maps.uri)) continue;
    seen.add(maps.uri);
    const snippets = (maps.placeAnswerSources?.reviewSnippets || [])
      .map((r) => (typeof r?.reviewText === 'string' ? r.reviewText.trim() : ''))
      .filter((t) => t.length > 0)
      .slice(0, 2);
    items.push({
      title: typeof maps.title === 'string' && maps.title.trim() ? maps.title.trim() : 'Google Maps Place',
      uri: maps.uri,
      placeId: typeof maps.placeId === 'string' ? maps.placeId : undefined,
      reviewSnippets: snippets.length > 0 ? snippets : undefined,
    });
  }
  return items;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || 'Gemini request failed.');
  const lower = raw.toLowerCase();
  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      message: 'Please check your GEMINI_API_KEY in the Settings > Secrets panel.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    return {
      status: 429,
      message:
        'Gemini rate/quota limit reached. Wait a moment or configure a billed key in Settings > Secrets.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: 'Requested Gemini model is currently unavailable for this key.',
    };
  }
  return {
    status: 500,
    message: raw || 'Unable to generate Gemini response right now.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    });
  });

  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured yet. Add GEMINI_API_KEY in Settings > Secrets to activate Captain AI.',
      });
    }

    const body = req.body as {
      roleId?: unknown;
      modelTier?: unknown;
      messages?: unknown;
      location?: unknown;
      driverContext?: unknown;
    };

    const roleId: AssistantRoleId =
      typeof body?.roleId === 'string' && VALID_ROLES.has(body.roleId as AssistantRoleId)
        ? (body.roleId as AssistantRoleId)
        : 'dispatch_strategist';

    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return res.status(400).json({ error: 'At least one chat message is required.' });
    }

    const sanitizedTurns: ChatTurnInput[] = [];
    for (const item of body.messages.slice(-24)) {
      if (!item || typeof item !== 'object') continue;
      const role = (item as { role?: unknown }).role === 'model' ? 'model' : 'user';
      const rawText = (item as { text?: unknown }).text;
      if (typeof rawText !== 'string') continue;
      const trimmed = rawText.trim().slice(0, 3000);
      if (trimmed) {
        sanitizedTurns.push({ role, text: trimmed });
      }
    }

    if (sanitizedTurns.length === 0 || sanitizedTurns[sanitizedTurns.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Latest turn must be a non-empty user message.' });
    }

    const latestUserMessage = sanitizedTurns[sanitizedTurns.length - 1].text;
    const priorHistory = sanitizedTurns.slice(0, -1).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    }));

    const latLng = sanitizeLatLng(body?.location);
    const driverContext =
      body?.driverContext && typeof body.driverContext === 'object'
        ? (body.driverContext as DriverContextInput)
        : undefined;

    const systemInstruction = buildRoleInstruction(roleId, driverContext);

    const requestedFast = body?.modelTier === 'flash_lite' || roleId === 'quick_helper';
    const model =
      roleId === 'maps_navigator'
        ? 'gemini-4-hydrogen'
        : requestedFast
          ? 'gemini-3.1-flash-lite'
          : 'gemini-4-hydrogen';

    try {
      const config: Record<string, unknown> = {
        systemInstruction,
      };

      if (roleId === 'maps_navigator') {
        config.tools = [{ googleMaps: {} }];
        if (latLng) {
          config.toolConfig = {
            retrievalConfig: {
              latLng,
            },
          };
        }
      } else if (model === 'gemini-3.1-flash-lite') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
      } else if (roleId === 'earnings_analyst') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      } else {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const chat = ai.chats.create({
        model,
        history: priorHistory,
        config,
      });

      const response = await chat.sendMessage({
        message: latestUserMessage,
      });

      const mapsSources = roleId === 'maps_navigator' ? extractMapsSources(response) : [];
      const reply = (response.text || '').trim();
      if (!reply && mapsSources.length === 0) {
        return res.status(502).json({
          error: 'Gemini returned an empty response. Please rephrase your question and try again.',
        });
      }

      return res.json({
        reply: reply || 'Here are the verified Google Maps locations near your coordinates:',
        modelUsed: model,
        roleId,
        mapsSources,
      });
    } catch (err) {
      console.error('Gemini chat error:', err);
      const formatted = formatGeminiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/gemini/maps-grounding', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured yet. Add GEMINI_API_KEY in Settings > Secrets to use Live Maps Grounding.',
      });
    }

    const body = req.body as {
      query?: unknown;
      location?: unknown;
      city?: unknown;
      vehicleCategory?: unknown;
    };

    const rawQuery = typeof body?.query === 'string' ? body.query.trim().slice(0, 400) : '';
    if (!rawQuery) {
      return res.status(400).json({ error: 'Search query is required for Google Maps grounding.' });
    }

    const latLng = sanitizeLatLng(body?.location);
    const cityHint = typeof body?.city === 'string' && body.city.trim() ? body.city.trim().slice(0, 60) : '';
    const vehicleHint =
      typeof body?.vehicleCategory === 'string' && ['bike', 'auto', 'cab'].includes(body.vehicleCategory)
        ? body.vehicleCategory.toUpperCase()
        : 'CAB';

    const promptText = latLng
      ? `For a SHINE CAPTAIN (${vehicleHint}) driver near coordinates (${latLng.latitude.toFixed(5)}, ${latLng.longitude.toFixed(5)})${cityHint ? ` in ${cityHint}` : ''}: ${rawQuery}. Give practical, up-to-date nearby places with short bullet points.`
      : `For a SHINE CAPTAIN (${vehicleHint}) driver${cityHint ? ` in ${cityHint}` : ' in India'}: ${rawQuery}. Give practical, up-to-date places with short bullet points.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          systemInstruction:
            'You are a Google Maps grounded assistant for commercial ride-hailing drivers. Return accurate, concise place recommendations using Markdown bullet points. Do not invent coordinates or place links.',
          tools: [{ googleMaps: {} }],
          ...(latLng
            ? {
                toolConfig: {
                  retrievalConfig: {
                    latLng,
                  },
                },
              }
            : {}),
        },
      });

      const mapsSources = extractMapsSources(response);
      const reply = (response.text || '').trim();
      return res.json({
        reply: reply || 'Verified nearby Google Maps places:',
        modelUsed: 'gemini-4-hydrogen',
        mapsSources,
      });
    } catch (err) {
      console.error('Gemini maps grounding error:', err);
      const formatted = formatGeminiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`SHINE CAPTAIN full-stack server running on http://0.0.0.0:${port}`);
  });
}

void startServer();
