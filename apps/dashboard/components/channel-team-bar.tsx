"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X, Crown, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import {
  getChannelTeam,
  addChannelMember,
  removeChannelMember,
  setChannelLead,
  subscribeChannelMembers,
  type ChannelTeam,
} from "../lib/channel-members";
import { getStatus } from "../lib/api";

interface AgentInfo {
  id: string;
  description?: string;
}

/**
 * ChannelTeamBar — Slack-style member list that renders above the chat
 * in channel mode. Shows pills for each member, a lead crown, and an
 * "+ invite agent" picker.
 */
export function ChannelTeamBar({ channelId }: { channelId: string }) {
  const [team, setTeam] = useState<ChannelTeam | null>(() =>
    getChannelTeam(channelId)
  );
  const [availableAgents, setAvailableAgents] = useState<AgentInfo[]>([]);
  const [picking, setPicking] = useState(false);

  // Subscribe to team changes
  useEffect(() => {
    setTeam(getChannelTeam(channelId));
    return subscribeChannelMembers(channelId, (t) => setTeam(t));
  }, [channelId]);

  // Fetch the agent roster from the gateway
  useEffect(() => {
    let cancelled = false;
    getStatus()
      .then((res) => {
        if (cancelled) return;
        const agents =
          (res?.status as { agents?: AgentInfo[] } | undefined)?.agents ?? [];
        setAvailableAgents(agents);
      })
      .catch(() => {
        if (!cancelled) setAvailableAgents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const members = team?.memberAgentIds ?? [];
  const leadId = team?.leadAgentId ?? members[0];

  const uninvited = useMemo(
    () => availableAgents.filter((a) => !members.includes(a.id)),
    [availableAgents, members]
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1.5 px-1">
      <span
        className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-muted-foreground/60 mr-0.5"
      >
        // team
      </span>

      {members.length === 0 ? (
        <span className="text-[11px] text-muted-foreground/60 italic">
          No members yet. Invite an agent to start the channel.
        </span>
      ) : (
        members.map((id) => {
          const isLead = id === leadId;
          const info = availableAgents.find((a) => a.id === id);
          return (
            <AgentPill
              key={id}
              id={id}
              description={info?.description}
              isLead={isLead}
              onMakeLead={() => setChannelLead(channelId, id)}
              onRemove={() => removeChannelMember(channelId, id)}
            />
          );
        })
      )}

      {/* Invite picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          disabled={uninvited.length === 0}
          className="flex items-center gap-1 rounded-md border border-dashed border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-border/90 hover:bg-muted/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={
            uninvited.length === 0
              ? "All available agents are already in this channel"
              : "Invite an agent to this channel"
          }
        >
          <Plus size={10} strokeWidth={2.2} />
          invite
        </button>
        {picking && uninvited.length > 0 ? (
          <>
            {/* Click-outside overlay */}
            <button
              type="button"
              className="fixed inset-0 z-10"
              onClick={() => setPicking(false)}
              aria-label="Close invite picker"
            />
            <div className="absolute top-full left-0 mt-1 z-20 min-w-[220px] rounded-md border border-border/80 bg-popover shadow-lg overflow-hidden py-1">
              <div className="px-2.5 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/60 font-[family-name:var(--font-geist-mono)] border-b border-border/40">
                Invite agent to channel
              </div>
              {uninvited.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    addChannelMember(channelId, agent.id);
                    setPicking(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-muted/60 transition-colors flex items-start gap-2"
                >
                  <span className="font-[family-name:var(--font-geist-mono)] text-foreground shrink-0">
                    @{agent.id}
                  </span>
                  {agent.description ? (
                    <span className="text-[10.5px] text-muted-foreground/80 truncate">
                      {agent.description}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function AgentPill({
  id,
  description,
  isLead,
  onMakeLead,
  onRemove,
}: {
  id: string;
  description?: string;
  isLead: boolean;
  onMakeLead: () => void;
  onRemove: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((m) => !m)}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] transition-colors font-[family-name:var(--font-geist-mono)]",
          isLead
            ? "bg-destructive/10 text-destructive border border-destructive/20"
            : "bg-muted/60 text-foreground hover:bg-muted border border-transparent"
        )}
        title={description ?? `@${id}`}
      >
        {isLead ? <Crown size={9} strokeWidth={2.2} /> : null}
        <span>@{id}</span>
        <ChevronDown size={9} className="opacity-50" strokeWidth={2.2} />
      </button>
      {menuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute top-full left-0 mt-1 z-20 min-w-[160px] rounded-md border border-border/80 bg-popover shadow-lg overflow-hidden py-1">
            <div className="px-2.5 py-1 text-[9px] uppercase tracking-wider text-muted-foreground/60 font-[family-name:var(--font-geist-mono)] border-b border-border/40 truncate">
              @{id}
            </div>
            {description ? (
              <div className="px-2.5 py-1.5 text-[10.5px] text-muted-foreground leading-snug">
                {description}
              </div>
            ) : null}
            {!isLead ? (
              <button
                type="button"
                onClick={() => {
                  onMakeLead();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-muted/60 transition-colors flex items-center gap-2"
              >
                <Crown size={10} strokeWidth={2.2} />
                Make lead
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onRemove();
                setMenuOpen(false);
              }}
              className="w-full text-left px-2.5 py-1.5 text-[11px] text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
            >
              <X size={10} strokeWidth={2.2} />
              Remove from channel
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
