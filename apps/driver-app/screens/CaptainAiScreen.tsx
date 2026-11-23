import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Compass,
  ExternalLink,
  IndianRupee,
  Loader2,
  MapPin,
  MessageSquareQuote,
  Radio,
  Send,
  Sparkles,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import type { AssistantRoleId, CaptainAiChatMessage } from '../contracts/types';
import {
  CAPTAIN_AI_ROLES,
  clearPersistedCaptainAiMessages,
  persistCaptainAiMessage,
  sendCaptainAiChat,
  subscribeCaptainAiMessages,
} from '../services/captainAiService';
import { getFirebaseAuth } from '../services/firebaseClient';
import { useDriverApp } from '../state/DriverAppContext';

const ROLE_ICON_MAP: Record<AssistantRoleId, React.ComponentType<{ className?: string }>> = {
  maps_navigator: MapPin,
  dispatch_strategist: Radio,
  earnings_analyst: IndianRupee,
  quick_helper: Zap,
};

export const CaptainAiScreen: React.FC = () => {
  const {
    driverProfile,
    vehicle,
    onboardingDraft,
    liveLocation,
    requestGpsFix,
    earnings,
    weeklyGoalInr,
    rideHistory,
    setFeedback,
    navigate,
  } = useDriverApp();

  const [selectedRole, setSelectedRole] = useState<AssistantRoleId>('maps_navigator');
  const [persistedMessages, setPersistedMessages] = useState<CaptainAiChatMessage[]>([]);
  const [localMessages, setLocalMessages] = useState<CaptainAiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const auth = getFirebaseAuth();
  const activeDriverId = driverProfile?.driver_id || auth?.currentUser?.uid || '';
  const canPersistToFirestore = Boolean(auth?.currentUser && activeDriverId);

  useEffect(() => {
    if (!canPersistToFirestore) {
      setPersistedMessages([]);
      return;
    }
    const unsub = subscribeCaptainAiMessages(activeDriverId, (msgs) => {
      setPersistedMessages(msgs);
    });
    return () => unsub();
  }, [activeDriverId, canPersistToFirestore]);

  const activeRoleMeta = useMemo(
    () => CAPTAIN_AI_ROLES.find((r) => r.id === selectedRole) || CAPTAIN_AI_ROLES[0],
    [selectedRole]
  );

  const roleThread = useMemo(() => {
    const source = canPersistToFirestore ? persistedMessages : localMessages;
    return source.filter((m) => m.role_id === selectedRole);
  }, [canPersistToFirestore, localMessages, persistedMessages, selectedRole]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [roleThread.length, sending, selectedRole]);

  const handleSend = async (promptOverride?: string) => {
    const text = (promptOverride ?? input).trim();
    if (!text || sending) return;

    setChatError(null);
    if (!promptOverride) setInput('');
    setSending(true);

    const userMsg: CaptainAiChatMessage = {
      message_id: `local_u_${Date.now()}`,
      role_id: selectedRole,
      sender: 'user',
      model_used: null,
      text,
      created_at: new Date().toISOString(),
    };

    const nextHistoryPayload = [...roleThread, userMsg].slice(-20).map((m) => ({
      role: m.sender,
      text: m.text,
    }));

    if (canPersistToFirestore) {
      void persistCaptainAiMessage(activeDriverId, {
        role_id: selectedRole,
        sender: 'user',
        model_used: null,
        text,
      });
    } else {
      setLocalMessages((prev) => [...prev, userMsg]);
    }

    try {
      let coords = liveLocation;
      if (!coords && selectedRole === 'maps_navigator') {
        coords = await requestGpsFix();
      }

      const response = await sendCaptainAiChat({
        roleId: selectedRole,
        modelTier: activeRoleMeta.modelTier,
        messages: nextHistoryPayload,
        location: coords,
        driverContext: {
          driverName: driverProfile?.full_name || onboardingDraft.fullName || undefined,
          city: driverProfile?.city || onboardingDraft.city || undefined,
          vehicleCategory: vehicle?.category || onboardingDraft.vehicleCategory,
          onlineStatus: driverProfile?.is_online ? 'Online' : 'Offline',
          weeklyGoalInr,
          weeklyEarningsInr: earnings?.net_earnings_inr ?? 0,
          completedRides: rideHistory.filter((r) => r.status === 'completed').length,
        },
      });

      const modelMsg: CaptainAiChatMessage = {
        message_id: `local_m_${Date.now()}`,
        role_id: selectedRole,
        sender: 'model',
        model_used: response.modelUsed,
        text: response.reply,
        maps_sources: response.mapsSources.length > 0 ? response.mapsSources : undefined,
        created_at: new Date().toISOString(),
      };

      if (canPersistToFirestore) {
        await persistCaptainAiMessage(activeDriverId, {
          role_id: selectedRole,
          sender: 'model',
          model_used: response.modelUsed,
          text: response.reply,
          maps_sources: response.mapsSources.length > 0 ? response.mapsSources : undefined,
        });
      } else {
        setLocalMessages((prev) => [...prev, modelMsg]);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to reach Gemini AI Co-Pilot. Please try again.';
      setChatError(message);
    } finally {
      setSending(false);
    }
  };

  const handleClearThread = async () => {
    setClearing(true);
    try {
      if (canPersistToFirestore) {
        await clearPersistedCaptainAiMessages(activeDriverId, selectedRole);
      } else {
        setLocalMessages((prev) => prev.filter((m) => m.role_id !== selectedRole));
      }
      setFeedback({
        type: 'info',
        title: 'Conversation Cleared',
        message: `${activeRoleMeta.title} history cleared.`,
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Dark Brand Co-Pilot Header Card */}
      <section className="rounded-3xl bg-[#1E1E1E] p-4 text-white shadow-sm dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-[#FFC928] px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#111111]">
              <Sparkles className="h-3 w-3" />
              SHINE CAPTAIN · GEMINI CO-PILOT &amp; GOOGLE MAPS GROUNDING
            </div>
            <h1 className="font-display mt-2 text-2xl font-extrabold tracking-tight text-white">
              Role-Based AI Assistant
            </h1>
            <p className="mt-1 text-xs text-neutral-300">
              Multi-turn conversation memory persisted in Cloud Firestore · Free-tier Gemini models
              with live Google Maps Grounding
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!canPersistToFirestore && (
              <button
                type="button"
                onClick={() => navigate('login_otp')}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#FFC928] px-3 text-xs font-bold text-[#111111]"
              >
                Sign In to Sync Cloud History
              </button>
            )}
            {roleThread.length > 0 && (
              <button
                type="button"
                disabled={clearing}
                onClick={() => void handleClearThread()}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-neutral-700 bg-[#262626] px-3 text-xs font-semibold text-neutral-200 hover:border-red-400 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {clearing ? 'Clearing…' : 'Clear Role Chat'}
              </button>
            )}
          </div>
        </div>

        {/* Role Switcher Cards */}
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-neutral-800 pt-4">
          {CAPTAIN_AI_ROLES.map((role) => {
            const Icon = ROLE_ICON_MAP[role.id];
            const active = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  setSelectedRole(role.id);
                  setChatError(null);
                }}
                className={`flex flex-col items-start rounded-2xl border p-3 text-left transition-colors ${
                  active
                    ? 'border-[#FFC928] bg-[#FFC928] text-[#111111]'
                    : 'border-neutral-800 bg-[#252525] text-white hover:border-neutral-600'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1.5">
                  <Icon className={`h-4 w-4 ${active ? 'text-[#111111]' : 'text-[#FFC928]'}`} />
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                      active
                        ? 'bg-[#111111] text-[#FFC928]'
                        : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    {role.badge}
                  </span>
                </div>
                <p className="mt-2 text-xs font-extrabold">{role.title}</p>
                <p
                  className={`mt-0.5 line-clamp-2 text-[11px] ${
                    active ? 'text-[#111111]/80' : 'text-neutral-400'
                  }`}
                >
                  {role.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Active Role Persona & GPS Readout Strip */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-800 bg-[#14161A] px-3 py-2 text-[11px]">
          <span className="font-semibold text-neutral-300">
            Active Model:{' '}
            <strong className="font-mono-num text-[#FFC928]">{activeRoleMeta.modelLabel}</strong>
          </span>
          <span className="inline-flex items-center gap-1 text-neutral-400">
            <Compass className="h-3.5 w-3.5 text-[#FFC928]" />
            {liveLocation
              ? `GPS ${liveLocation.lat.toFixed(4)}, ${liveLocation.lng.toFixed(4)}`
              : driverProfile?.city || onboardingDraft.city || 'No GPS fix yet'}
          </span>
        </div>
      </section>

      {/* Scrollable Multi-Turn Conversation Thread */}
      <section className="flex flex-col rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div>
            <h2 className="font-display text-sm font-bold text-[#1E1E1E] dark:text-white">
              {activeRoleMeta.title} Thread ({roleThread.length})
            </h2>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {canPersistToFirestore
                ? `Synced to Firestore · ${activeDriverId}`
                : 'Session thread · Sign in to persist across devices'}
            </p>
          </div>
          {!liveLocation && (
            <button
              type="button"
              onClick={() => void requestGpsFix()}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-xl border border-neutral-300 px-2.5 text-[11px] font-semibold text-[#1E1E1E] hover:border-[#F5C518] dark:border-neutral-700 dark:text-neutral-200"
            >
              <MapPin className="h-3 w-3 text-[#F5C518]" />
              Attach GPS
            </button>
          )}
        </div>

        <div className="max-h-[420px] min-h-[260px] space-y-3 overflow-y-auto p-4">
          {roleThread.length === 0 ? (
            <div className="space-y-3 py-4">
              <div className="flex items-start gap-2.5 rounded-2xl border border-neutral-200 bg-[#F7F8FA] p-3.5 dark:border-neutral-800 dark:bg-[#1A1D23]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFC928] text-[#111111]">
                  <Bot className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#1E1E1E] dark:text-white">
                    Ready as {activeRoleMeta.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                    {activeRoleMeta.description} Tap any prompt below or ask your own question to
                    start a multi-turn conversation.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-neutral-500 uppercase dark:text-neutral-400">
                  Suggested Quick Prompts
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeRoleMeta.quickPrompts.map((qPrompt) => (
                    <button
                      key={qPrompt}
                      type="button"
                      disabled={sending}
                      onClick={() => void handleSend(qPrompt)}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left text-xs font-semibold text-[#1E1E1E] transition-colors hover:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23] dark:text-neutral-100"
                    >
                      {qPrompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            roleThread.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.message_id}
                  className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#111111] text-[#FFC928]">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                  )}

                  <div
                    className={`max-w-[86%] space-y-2 rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-[#FFC928] font-medium text-[#111111]'
                        : 'border border-neutral-200 bg-[#F7F8FA] text-[#1E1E1E] dark:border-neutral-800 dark:bg-[#1A1D23] dark:text-neutral-100'
                    }`}
                  >
                    <div className="space-y-1">
                      {msg.text
                        .split('\n')
                        .filter((line) => line.trim().length > 0)
                        .map((line, i) => (
                          <p key={`${msg.message_id}-l-${i}`}>{line}</p>
                        ))}
                    </div>

                    {msg.maps_sources && msg.maps_sources.length > 0 && (
                      <div className="space-y-1.5 border-t border-neutral-200 pt-2 dark:border-neutral-700">
                        <p className="text-[10px] font-bold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                          Google Maps Grounded Sources
                        </p>
                        {msg.maps_sources.map((place, pIdx) => {
                          const safeUri =
                            place.uri.startsWith('https://') || place.uri.startsWith('http://')
                              ? place.uri
                              : '#';
                          return (
                            <div
                              key={`${msg.message_id}-p-${pIdx}`}
                              className="rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-700 dark:bg-[#14161A]"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-bold text-[#1E1E1E] dark:text-white">
                                  {place.title}
                                </span>
                                <a
                                  href={safeUri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#111111] px-2 py-1 text-[10px] font-bold text-[#FFC928]"
                                >
                                  Maps
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                              {place.reviewSnippets && place.reviewSnippets.length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {place.reviewSnippets.map((snippet, rIdx) => (
                                    <p
                                      key={`${msg.message_id}-p-${pIdx}-r-${rIdx}`}
                                      className="flex items-start gap-1 text-[10px] text-neutral-600 dark:text-neutral-400"
                                    >
                                      <MessageSquareQuote className="mt-0.5 h-3 w-3 shrink-0 text-[#F5C518]" />
                                      <span>{snippet}</span>
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <p
                      className={`font-mono-num text-[10px] ${
                        isUser ? 'text-[#111111]/70' : 'text-neutral-400'
                      }`}
                    >
                      {msg.model_used ? `${msg.model_used} · ` : ''}
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {isUser && (
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#FFC928] text-[#111111]">
                      <User className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              );
            })
          )}

          {sending && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <Loader2 className="h-4 w-4 animate-spin text-[#F5C518]" />
              <span>{activeRoleMeta.title} is thinking…</span>
            </div>
          )}

          <div ref={threadEndRef} />
        </div>

        {chatError && (
          <div className="mx-4 mb-3 rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <p className="font-bold">Gemini AI Request Error</p>
            <p className="mt-0.5">{chatError}</p>
            <p className="mt-1 text-[11px] opacity-85">
              Ensure GEMINI_API_KEY is configured in Settings &gt; Secrets on the server.
            </p>
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="flex items-end gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800"
        >
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={`Ask ${activeRoleMeta.title} anything…`}
            aria-label="Message Gemini AI Co-Pilot"
            className="min-h-[46px] flex-1 resize-none rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 py-2.5 text-xs font-medium text-[#1E1E1E] outline-none placeholder:text-neutral-400 focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23] dark:text-white"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send message"
            className="flex min-h-[46px] min-w-[46px] shrink-0 items-center justify-center rounded-xl bg-[#FFC928] text-[#111111] transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </section>
    </div>
  );
};
