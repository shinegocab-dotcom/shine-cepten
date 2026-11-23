import React, { useState } from 'react';
import {
  Compass,
  ExternalLink,
  Fuel,
  Loader2,
  MapPin,
  MessageSquareQuote,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { MapsGroundedPlace } from '../contracts/types';
import { queryMapsGrounding } from '../services/captainAiService';
import { useDriverApp } from '../state/DriverAppContext';

const QUICK_MAP_QUERIES = [
  { label: 'Nearest CNG & Petrol', query: 'Nearest CNG and petrol pumps open right now near me', icon: Fuel },
  { label: 'EV Fast Chargers', query: 'EV fast charging stations near my current GPS location', icon: Zap },
  { label: 'Cab & Auto Hotspots', query: 'Busy metro stations, malls, and railway cab pickup stands nearby', icon: MapPin },
  { label: 'Clean Rest Stops', query: 'Budget drivers dhaba, tea stall, or rest stop with parking nearby', icon: Compass },
];

export interface MapsGroundingPanelProps {
  compact?: boolean;
  onOpenFullCopilot?: () => void;
}

export const MapsGroundingPanel: React.FC<MapsGroundingPanelProps> = ({
  compact = false,
  onOpenFullCopilot,
}) => {
  const { driverProfile, vehicle, onboardingDraft, liveLocation, requestGpsFix } = useDriverApp();

  const [queryText, setQueryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [modelUsed, setModelUsed] = useState<string>('gemini-4-hydrogen');
  const [places, setPlaces] = useState<MapsGroundedPlace[]>([]);

  const activeCategory = vehicle?.category || onboardingDraft.vehicleCategory;
  const activeCity = driverProfile?.city || onboardingDraft.city || undefined;

  const runSearch = async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) return;

    setLoading(true);
    setErrorMsg(null);
    setQueryText(trimmed);

    try {
      let coords = liveLocation;
      if (!coords) {
        coords = await requestGpsFix();
      }
      const result = await queryMapsGrounding({
        query: trimmed,
        location: coords,
        city: activeCity,
        vehicleCategory: activeCategory,
      });
      setReplyText(result.reply);
      setModelUsed(result.modelUsed);
      setPlaces(result.mapsSources);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to fetch live Google Maps Grounding results right now.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#FFC928] text-[#111111]">
              <MapPin className="h-3.5 w-3.5" />
            </span>
            <h2 className="font-display text-base font-bold text-[#1E1E1E] dark:text-white">
              Live Google Maps Grounding Finder
            </h2>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Real-time verified places via Gemini ({modelUsed}) anchored to{' '}
            {liveLocation
              ? `${liveLocation.lat.toFixed(4)}, ${liveLocation.lng.toFixed(4)}`
              : activeCity || 'your GPS position'}
          </p>
        </div>

        {onOpenFullCopilot && (
          <button
            type="button"
            onClick={onOpenFullCopilot}
            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-[#111111] px-3 text-[11px] font-bold text-[#FFC928] transition-colors hover:bg-neutral-800"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Co-Pilot Chat
          </button>
        )}
      </div>

      {/* Quick Fuel / EV / Demand Chips */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {QUICK_MAP_QUERIES.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.label}
              type="button"
              disabled={loading}
              onClick={() => void runSearch(chip.query)}
              className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-[#F7F8FA] px-3 text-xs font-semibold text-[#1E1E1E] transition-colors hover:border-[#F5C518] disabled:opacity-60 dark:border-neutral-700 dark:bg-[#1A1D23] dark:text-neutral-100"
            >
              <Icon className="h-3.5 w-3.5 text-[#F5C518]" />
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Search Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(queryText);
        }}
        className="mt-3 flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search CNG pump, airport stand, workshop, or food stop…"
            aria-label="Search nearby places with Google Maps Grounding"
            className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] pr-3 pl-9 text-xs font-medium text-[#1E1E1E] outline-none placeholder:text-neutral-400 focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23] dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !queryText.trim()}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-[#F5C518] px-4 text-xs font-bold text-[#111111] transition-colors hover:bg-[#e5b512] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {loading ? 'Searching…' : 'Find'}
        </button>
      </form>

      {errorMsg && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {(replyText || places.length > 0) && (
        <div className="mt-3 space-y-3 rounded-2xl border border-neutral-200 bg-[#F7F8FA] p-3.5 dark:border-neutral-800 dark:bg-[#0D0F13]">
          {replyText && (
            <div className="space-y-1.5 text-xs leading-relaxed text-[#1E1E1E] dark:text-neutral-200">
              {replyText
                .split('\n')
                .filter((line) => line.trim().length > 0)
                .slice(0, compact ? 8 : 20)
                .map((line, index) => (
                  <p key={`${index}-${line.slice(0, 16)}`}>{line}</p>
                ))}
            </div>
          )}

          {places.length > 0 && (
            <div className="space-y-2 border-t border-neutral-200 pt-2.5 dark:border-neutral-800">
              <p className="text-[11px] font-bold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                Verified Google Maps Places ({places.length})
              </p>
              <div className="grid grid-cols-1 gap-2">
                {places.map((place, idx) => {
                  const safeUri =
                    place.uri.startsWith('https://') || place.uri.startsWith('http://')
                      ? place.uri
                      : '#';
                  return (
                    <div
                      key={`${place.uri}-${idx}`}
                      className="rounded-xl border border-neutral-200 bg-white p-2.5 dark:border-neutral-800 dark:bg-[#14161A]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-[#1E1E1E] dark:text-white">
                          {place.title}
                        </span>
                        <a
                          href={safeUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#111111] px-2.5 py-1 text-[11px] font-bold text-[#FFC928] hover:bg-neutral-800"
                        >
                          Open Google Maps
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      {place.reviewSnippets && place.reviewSnippets.length > 0 && (
                        <div className="mt-2 space-y-1 border-t border-neutral-100 pt-1.5 dark:border-neutral-800">
                          {place.reviewSnippets.map((snippet, sIdx) => (
                            <p
                              key={`${idx}-snip-${sIdx}`}
                              className="flex items-start gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400"
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
            </div>
          )}
        </div>
      )}
    </section>
  );
};
