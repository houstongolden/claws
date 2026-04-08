"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { StudioTemplate } from "@/lib/studio/template-config";

interface DeployModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  files: { path: string; content: string }[];
  template?: StudioTemplate;
}

export function DeployModal({ open, onClose, title, files, template }: DeployModalProps) {
  const { user } = useUser();
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const userId = user?.id ?? "";
  const hubs = useQuery(api.hubs.listHubsByOwner, userId ? { owner_id: userId } : "skip");
  const applyTemplate = useMutation(api.hubs.applyStudioTemplate);

  if (!open) return null;

  const handleDeployNew = async () => {
    setDeploying(true);
    setError(null);
    try {
      const response = await fetch("/api/studio/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, files }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Deploy failed"); return; }
      if (data.redirectTo) window.location.href = data.redirectTo;
    } catch {
      setError("Deploy failed. Try again.");
    } finally {
      setDeploying(false);
    }
  };

  const handleApplyToExisting = async () => {
    if (!selectedHub) return;
    setDeploying(true);
    setError(null);
    try {
      // Parse template from TEMPLATE.json file if available
      const templateJson = files.find((f) => f.path === "TEMPLATE.json");
      let t = template;
      if (!t && templateJson) {
        try { t = JSON.parse(templateJson.content); } catch { /* */ }
      }

      await applyTemplate({
        hub_id: selectedHub as any,
        template_name: title,
        theme_id: t?.themeId || "dark",
        accent: t?.accent || "#D4A574",
        monogram: t?.monogram,
        panels: t?.panels?.map((p) => ({ id: p.id, visible: p.visible, position: p.position, size: p.size })),
        sidebar_panels: t?.sidebarPanels?.map((p) => ({ id: p.id, visible: p.visible, position: p.position })),
        skills: t?.skills,
      });

      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 1500);
    } catch (err) {
      setError("Failed to apply theme. Try again.");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded shadow-sm w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text">Deploy Template</h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-1 bg-surface-muted rounded p-1">
            <button
              onClick={() => setMode("new")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === "new" ? "bg-surface text-text shadow-sm" : "text-text-secondary"
              }`}
            >
              New Workspace
            </button>
            <button
              onClick={() => setMode("existing")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === "existing" ? "bg-surface text-text shadow-sm" : "text-text-secondary"
              }`}
            >
              Apply to Existing
            </button>
          </div>

          {mode === "new" && (
            <div className="text-xs text-text-secondary">
              Create a new workspace with "{title}" template applied.
            </div>
          )}

          {mode === "existing" && (
            <div className="space-y-3">
              <div className="text-xs text-text-secondary">
                Apply this theme and layout to an existing workspace.
              </div>
              {hubs === undefined ? (
                <div className="text-xs text-text-secondary animate-pulse py-4 text-center">
                  Loading workspaces...
                </div>
              ) : hubs.length === 0 ? (
                <div className="text-xs text-text-secondary py-4 text-center">
                  No workspaces found. Create one first.
                </div>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {hubs.map((hub: any) => (
                    <button
                      key={hub._id}
                      onClick={() => setSelectedHub(hub._id)}
                      className={`w-full text-left px-3 py-2 rounded transition-colors text-xs ${
                        selectedHub === hub._id
                          ? "bg-accent/10 text-accent border border-accent/30"
                          : "text-text hover:bg-surface-muted border border-transparent"
                      }`}
                    >
                      <div className="font-medium">{hub.display_name || hub.name}</div>
                      <div className="text-text-secondary text-[10px] mt-0.5">
                        {hub.subdomain?.includes('.') ? hub.subdomain : `${hub.subdomain}.hubify.com`} · {hub.template || "custom"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {success && (
            <div className="text-xs text-green-400 bg-green-500/10 px-3 py-2 rounded text-center">
              Theme applied successfully!
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
          <button onClick={onClose} disabled={deploying} className="px-4 py-1.5 text-xs font-medium rounded text-text-secondary hover:text-text border border-border transition-colors">
            Cancel
          </button>
          <button
            onClick={mode === "new" ? handleDeployNew : handleApplyToExisting}
            disabled={deploying || (mode === "existing" && !selectedHub)}
            className="px-4 py-1.5 text-xs font-semibold rounded transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: "#D4A574", color: "#0A0908" }}
          >
            {deploying ? "Applying..." : mode === "new" ? "Create Workspace" : "Apply Theme"}
          </button>
        </div>
      </div>
    </div>
  );
}
