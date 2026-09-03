"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Send, Reply, CornerDownRight, Loader2, User } from "lucide-react";

interface Comment {
  id: string;
  findingId: string;
  body: string;
  parentId?: string | null;
  createdAt: string;
  user: {
    id: string;
    name?: string | null;
    email: string;
  };
  replies?: Comment[];
}

interface FindingCommentsThreadProps {
  findingId: string;
  organizationId: string;
}

export function FindingCommentsThread({
  findingId,
  organizationId,
}: FindingCommentsThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadComments() {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/comments?findingId=${encodeURIComponent(
          findingId,
        )}&organizationId=${encodeURIComponent(organizationId)}`,
      );
      if (res.ok) {
        const json = await res.json();
        setComments(json.data ?? []);
      }
    } catch {
      // Degraded or network issue
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComments();
  }, [findingId, organizationId]);

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newCommentText.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId,
          organizationId,
          body: newCommentText.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? "Failed to post comment");
      }

      setNewCommentText("");
      await loadComments();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddReply(parentId: string) {
    if (!replyText.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findingId,
          organizationId,
          body: replyText.trim(),
          parentId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? "Failed to post reply");
      }

      setReplyText("");
      setReplyingToId(null);
      await loadComments();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Top-level comments and nested replies
  const topLevelComments = comments.filter((c) => !c.parentId);
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parentId === parentId);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">
            Discussion & Remediation Notes
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
            {comments.length}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Document team decisions, exception approvals, and implementation context.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* New Comment Input */}
      <form onSubmit={handleAddComment} className="space-y-2">
        <textarea
          rows={3}
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder="Leave a note, link to a PR, or request verification from an engineer..."
          className="input text-xs leading-relaxed"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!newCommentText.trim() || submitting}
            className="btn-primary inline-flex items-center gap-1.5 text-xs min-h-[36px]"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Post Note
          </button>
        </div>
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400">
          <Loader2 className="mx-auto h-5 w-5 animate-spin mb-1" />
          Loading comments...
        </div>
      ) : topLevelComments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
          No discussion notes recorded on this finding yet. Start the thread above.
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          {topLevelComments.map((comment) => {
            const replies = getReplies(comment.id);
            return (
              <div key={comment.id} className="space-y-3">
                <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-semibold text-slate-900">
                        {comment.user.name || comment.user.email}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(comment.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 whitespace-pre-wrap pl-8">
                    {comment.body}
                  </p>

                  <div className="flex justify-end pl-8 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setReplyingToId(
                          replyingToId === comment.id ? null : comment.id,
                        )
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-brand-600"
                    >
                      <Reply className="h-3 w-3" />
                      Reply
                    </button>
                  </div>
                </div>

                {/* Reply input */}
                {replyingToId === comment.id && (
                  <div className="ml-8 rounded-lg bg-white p-3 border border-brand-200 shadow-sm space-y-2">
                    <textarea
                      rows={2}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Replying to ${comment.user.name || comment.user.email}...`}
                      className="input text-xs"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToId(null);
                          setReplyText("");
                        }}
                        className="btn-ghost text-xs py-1 min-h-[30px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddReply(comment.id)}
                        disabled={!replyText.trim() || submitting}
                        className="btn-primary text-xs py-1 min-h-[30px]"
                      >
                        Submit Reply
                      </button>
                    </div>
                  </div>
                )}

                {/* Nested replies */}
                {replies.length > 0 && (
                  <div className="ml-8 space-y-2 border-l-2 border-slate-200 pl-4">
                    {replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="rounded-lg bg-slate-50 p-3 border border-slate-100 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <CornerDownRight className="h-3 w-3 text-slate-400" />
                            <span className="font-semibold text-slate-900">
                              {reply.user.name || reply.user.email}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(reply.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap pl-4">
                          {reply.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
