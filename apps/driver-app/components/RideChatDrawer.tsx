import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import type { RideMessageRecord } from '../contracts/types';
import { driverBackendService } from '../services/driverBackendService';
import { useDriverApp } from '../state/DriverAppContext';

const QUICK_REPLIES = [
  'On my way to pickup!',
  'I have arrived at your pickup point.',
  'Please share your 4-digit Pickup OTP.',
  'Calling you now.',
] as const;

export const RideChatDrawer: React.FC<{
  rideId: string;
  driverId: string;
  driverName: string;
  customerId: string;
  customerName?: string;
}> = ({ rideId, driverId, driverName, customerId, customerName = 'Customer' }) => {
  const { setFeedback } = useDriverApp();
  const [messages, setMessages] = useState<RideMessageRecord[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rideId) return;
    const unsub = driverBackendService.rides.subscribeMessages(rideId, (list) => {
      setMessages(list);
    });
    return unsub;
  }, [rideId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const sendText = async (text: string) => {
    const cleaned = text.trim();
    if (!cleaned || sending) return;
    setSending(true);
    const res = await driverBackendService.rides.sendMessage({
      ride_id: rideId,
      driver_id: driverId,
      customer_id: customerId,
      sender_id: driverId,
      sender_name: driverName,
      text: cleaned,
    });
    setSending(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Message Not Sent',
        message: res.error?.message || 'Unable to deliver chat message.',
      });
      return;
    }
    setDraft('');
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-2.5 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[#F5C518]" />
          <div>
            <h3 className="font-display text-sm font-bold">Live Chat with {customerName}</h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Real-time Firestore sync (ride_messages)
            </p>
          </div>
        </div>
        <span className="font-mono-num text-[11px] font-bold text-[#F5C518]">
          {messages.length} msgs
        </span>
      </div>

      {/* Messages Viewport */}
      <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-[#F7F8FA] p-3 dark:bg-[#0D0F13]">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
            No messages yet. Tap a quick message below or write to {customerName}.
          </p>
        ) : (
          messages.map((msg) => {
            const isDriver = msg.sender_role === 'driver' || msg.sender_id === driverId;
            return (
              <div
                key={msg.message_id}
                className={`flex flex-col ${isDriver ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs ${
                    isDriver
                      ? 'bg-[#1E1E1E] text-white dark:bg-[#F5C518] dark:text-[#1E1E1E]'
                      : 'border border-neutral-200 bg-white text-[#1E1E1E] dark:border-neutral-700 dark:bg-[#1A1D23] dark:text-white'
                  }`}
                >
                  <p className="font-medium leading-relaxed">{msg.text}</p>
                </div>
                <span className="mt-0.5 text-[10px] text-neutral-400">
                  {msg.sender_name} · {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Reply Chips */}
      <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
        {QUICK_REPLIES.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={sending}
            onClick={() => void sendText(preset)}
            className="shrink-0 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23] dark:text-neutral-200"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Compose Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendText(draft);
        }}
        className="mt-2.5 flex items-center gap-2"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message rider…"
          className="min-h-[42px] flex-1 rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-xs outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label="Send chat message"
          className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl bg-[#F5C518] text-[#1E1E1E] disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
};
