"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Key,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Shield,
  Clock,
  Activity,
} from "lucide-react";
import { EmptyState } from "@aros/ui";
import { LoadingSpinner } from "@aros/ui";

import {
  createApiKeyAction,
  rotateApiKeyAction,
  revokeApiKeyAction,
} from "./actions";

interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  rateLimitPerMinute: number;
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  totalCalls: number;
}

interface ScopeOption {
  id: string;
  label: string;
  description: string;
}

interface NewKeyResult {
  id: string;
  name: string;
  plaintext: string;
  expiresAt: string | null;
  scopes: string[];
  rateLimitPerMinute: number;
}

interface ApiKeysListProps {
  organizationId: string;
  initialKeys: ApiKey[];
  availableScopes: ScopeOption[];
  disabled?: boolean;
}

function formatDate(date: Date | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Expired";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 30) return `${diffDays} days`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"}`;
}

function maskKey(key: string): string {
  if (key.length <= 12) return "****";
  return key.slice(0, 8) + "...";
}

export function ApiKeysList({
  organizationId,
  initialKeys,
  availableScopes,
  disabled = false,
}: ApiKeysListProps) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["read"]);

  const [isCreatePending, startCreateTransition] = useTransition();
  const [isRotatePending, startRotateTransition] = useTransition();

  const [createError, setCreateError] = useState<string | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  // Clear copied state after 2 seconds
  useEffect(() => {
    if (copiedId) {
      const timer = setTimeout(() => setCopiedId(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedId]);

  // Handle scope checkbox changes
  function handleScopeChange(scopeId: string, checked: boolean) {
    setSelectedScopes((prev) => {
      if (checked) {
        return [...prev, scopeId];
      }
      return prev.filter((s) => s !== scopeId);
    });
  }

  // Handle form submission for creating a new key
  async function handleCreateSubmit(formData: FormData) {
    setCreateError(null);

    if (disabled) {
      setCreateError("API key creation requires a paid plan");
      return;
    }

    // Add selected scopes to form data
    formData.set("scopes", JSON.stringify(selectedScopes));

    startCreateTransition(async () => {
      const result = await createApiKeyAction(
        { success: false, error: null },
        formData,
      );

      if (!result.success) {
        setCreateError(result.error);
        return;
      }

      if (result.key) {
        setNewKey(result.key);
        setShowCreateForm(false);
        // Add the new key to the list (we'll need to refetch or reconstruct)
        const newApiKey: ApiKey = {
          id: result.key.id,
          name: result.key.name,
          scopes: result.key.scopes,
          rateLimitPerMinute: result.key.rateLimitPerMinute,
          isActive: true,
          lastUsedAt: null,
          expiresAt: result.key.expiresAt
            ? new Date(result.key.expiresAt)
            : null,
          createdAt: new Date(),
          totalCalls: 0,
        };
        setKeys((prev) => [newApiKey, ...prev]);
      }
    });
  }

  // Handle key rotation
  async function handleRotate(keyId: string) {
    if (disabled) return;
    if (isRotating) return;

    setIsRotating(keyId);

    const formData = new FormData();
    formData.append("organizationId", organizationId);
    formData.append("keyId", keyId);

    startRotateTransition(async () => {
      const result = await rotateApiKeyAction(
        { success: false, error: null },
        formData,
      );

      setIsRotating(null);

      if (!result.success) {
        alert(result.error);
        return;
      }

      if (result.key) {
        setNewKey({
          id: result.key.id,
          name: result.key.name,
          plaintext: result.key.plaintext,
          expiresAt:
            keys.find((k) => k.id === keyId)?.expiresAt?.toISOString() ?? null,
          scopes: keys.find((k) => k.id === keyId)?.scopes ?? [],
          rateLimitPerMinute:
            keys.find((k) => k.id === keyId)?.rateLimitPerMinute ?? 60,
        });
        // Remove the old key from the list
        setKeys((prev) => prev.filter((k) => k.id !== keyId));
      }
    });
  }

  // Handle revoke confirmation
  async function handleRevokeSubmit(formData: FormData) {
    if (disabled) return;
    await revokeApiKeyAction(formData);
  }

  // Copy key to clipboard
  async function copyKey(key: string, id: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedId(id);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = key;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedId(id);
    }
  }

  // Check if a key is expiring soon (within 7 days)
  function isExpiringSoon(key: ApiKey): boolean {
    if (!key.expiresAt || !key.isActive) return false;
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    return key.expiresAt < sevenDaysFromNow && key.expiresAt > new Date();
  }

  // Check if key is expired
  function isExpired(key: ApiKey): boolean {
    if (!key.expiresAt || !key.isActive) return false;
    return key.expiresAt < new Date();
  }

  // Get scope badges
  function getScopeBadges(scopes: string[]): string[] {
    if (scopes.includes("*")) return ["Full Access"];
    return scopes.map((s) => {
      const scope = availableScopes.find((opt) => opt.id === s);
      return scope?.label || s;
    });
  }

  if (newKey) {
    return (
      <div className="card border-brand-200 bg-gradient-to-br from-white to-brand-50/30">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center">
            <Key className="h-4 w-4 text-brand-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            API Key Created
          </h2>
        </div>

        <div className="rounded-xl border-2 border-brand-200 bg-white p-4 mb-4">
          <p className="text-sm text-amber-700 font-medium mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Copy this key now - it won&apos;t be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-slate-950 text-slate-50 px-3 py-2 rounded text-sm font-mono break-all">
              {newKey.plaintext}
            </code>
            <button
              type="button"
              onClick={() => copyKey(newKey.plaintext, "new-key")}
              className="btn-secondary shrink-0"
              aria-label="Copy API key"
            >
              {copiedId === "new-key" ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-900">Name:</span>{" "}
            {newKey.name}
          </p>
          <p>
            <span className="font-medium text-slate-900">Scopes:</span>{" "}
            {newKey.scopes.length > 0
              ? newKey.scopes.join(", ")
              : "Full Access"}
          </p>
          <p>
            <span className="font-medium text-slate-900">Rate Limit:</span>{" "}
            {newKey.rateLimitPerMinute} requests/minute
          </p>
          {newKey.expiresAt && (
            <p>
              <span className="font-medium text-slate-900">Expires:</span>{" "}
              {formatDate(new Date(newKey.expiresAt))}
            </p>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setNewKey(null)}
            className="btn-primary"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => copyKey(newKey.plaintext, "new-key")}
            className="btn-secondary"
          >
            {copiedId === "new-key" ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!showCreateForm ? (
        <div className="flex items-center justify-between">
          {keys.length > 0 && (
            <p className="text-sm text-slate-500">
              {keys.length} API key{keys.length !== 1 ? "s" : ""}
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="btn-primary ml-auto"
            disabled={disabled}
          >
            Create API Key
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Create New API Key
            </h2>
          </div>

          <form action={handleCreateSubmit} className="space-y-4">
            <input type="hidden" name="organizationId" value={organizationId} />

            <div>
              <label htmlFor="key-name" className="label">
                Key Name
              </label>
              <input
                id="key-name"
                type="text"
                name="name"
                placeholder="e.g., Production API Key"
                required
                maxLength={100}
                className="input"
                disabled={isCreatePending || disabled}
              />
              <p className="mt-1 text-xs text-slate-500">
                A descriptive name to identify this key
              </p>
            </div>

            <div>
              <label className="label">Scopes</label>
              <div className="space-y-2">
                {availableScopes.map((scope) => (
                  <label
                    key={scope.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      name="scope"
                      value={scope.id}
                      checked={selectedScopes.includes(scope.id)}
                      onChange={(e) =>
                        handleScopeChange(scope.id, e.target.checked)
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                      disabled={isCreatePending || disabled}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {scope.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {scope.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="rate-limit" className="label">
                  Rate Limit (per minute)
                </label>
                <input
                  id="rate-limit"
                  type="number"
                  name="rateLimitPerMinute"
                  defaultValue={60}
                  min={1}
                  max={10000}
                  required
                  className="input"
                  disabled={isCreatePending || disabled}
                />
              </div>

              <div>
                <label htmlFor="expires-at" className="label">
                  Expiration Date (optional)
                </label>
                <input
                  id="expires-at"
                  type="datetime-local"
                  name="expiresAt"
                  className="input"
                  disabled={isCreatePending || disabled}
                />
              </div>
            </div>

            {createError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {createError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={isCreatePending || disabled}
              >
                {isCreatePending ? (
                  <LoadingSpinner size="sm" label="Creating..." />
                ) : (
                  "Create Key"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
                disabled={isCreatePending}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {keys.length === 0 && !showCreateForm ? (
        <EmptyState
          icon={Key}
          title="No API keys yet"
          description="Create your first API key to automate scans, exports, and integrations from your own systems."
          action={
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="btn-primary"
              disabled={disabled}
            >
              Create Your First Key
            </button>
          }
          className="card"
        />
      ) : (
        <div className="space-y-4">
          {keys.map((key) => (
            <div
              key={key.id}
              className={`card ${!key.isActive ? "opacity-60" : ""} ${
                isExpired(key) ? "border-red-200 bg-red-50/30" : ""
              } ${isExpiringSoon(key) ? "border-amber-200" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900">{key.name}</h3>
                    {key.isActive && isExpired(key) && (
                      <span className="badge bg-red-100 text-red-800">
                        Expired
                      </span>
                    )}
                    {key.isActive && isExpiringSoon(key) && !isExpired(key) && (
                      <span className="badge bg-amber-100 text-amber-800">
                        Expires in {formatRelativeTime(key.expiresAt!)}
                      </span>
                    )}
                    {!key.isActive && (
                      <span className="badge bg-slate-100 text-slate-500">
                        Revoked
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {getScopeBadges(key.scopes).map((badge) => (
                      <span
                        key={badge}
                        className="badge bg-slate-100 text-slate-700"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Activity className="h-4 w-4" />
                      <span>{key.totalCalls.toLocaleString()} calls</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="h-4 w-4" />
                      <span>{formatDate(key.lastUsedAt)}</span>
                      <span className="text-slate-400">last used</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Shield className="h-4 w-4" />
                      <span>{key.rateLimitPerMinute}/min</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="h-4 w-4" />
                      <span>{formatDate(key.createdAt)}</span>
                      <span className="text-slate-400">created</span>
                    </div>
                  </div>
                </div>

                {key.isActive && !isExpired(key) && (
                  <div className="flex items-center gap-2 shrink-0">
                    {revokeConfirmId === key.id ? (
                      <form
                        action={handleRevokeSubmit}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="hidden"
                          name="organizationId"
                          value={organizationId}
                        />
                        <input type="hidden" name="keyId" value={key.id} />
                        <button
                          type="submit"
                          className="btn-danger text-xs px-2 py-1"
                          disabled={disabled}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setRevokeConfirmId(null)}
                          className="btn-secondary text-xs px-2 py-1"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRotate(key.id)}
                          className="btn-secondary text-xs px-2 py-1"
                          disabled={
                            isRotating === key.id || isRotatePending || disabled
                          }
                          title="Rotate key"
                        >
                          {isRotating === key.id ? (
                            <LoadingSpinner size="sm" label="Rotating..." />
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Rotate
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRevokeConfirmId(key.id)}
                          className="btn-danger text-xs px-2 py-1"
                          disabled={disabled}
                          title="Revoke key"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Revoke
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
