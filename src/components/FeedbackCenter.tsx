import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, Loader2, MessageSquareText, RefreshCw, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FeedbackThread = Tables<"feedback_threads">;
type FeedbackMessage = Tables<"feedback_messages">;
type FeedbackMode = "staff" | "admin";

type ConversationSummary = FeedbackThread & {
  displayName: string;
  previewMessage: string;
  previewCreatedAt: string | null;
};

type FeedbackCenterProps = {
  mode: FeedbackMode;
  className?: string;
  title?: string;
  description?: string;
};

const NEW_CONVERSATION_ID = "__new__";
const DEFAULT_FEEDBACK_SUBJECT = "Feedback conversation";

const truncateMessage = (value: string, maxLength = 78) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
};

const FeedbackCenter = ({
  mode,
  className,
  title,
  description,
}: FeedbackCenterProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const isAdmin = mode === "admin";

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedThreadId) ?? null,
    [conversations, selectedThreadId]
  );

  const isStartingNewConversation = !isAdmin && selectedThreadId === NEW_CONVERSATION_ID;

  const fetchConversations = useCallback(async () => {
    if (!user?.id) {
      setConversations([]);
      setConversationsLoading(false);
      return;
    }

    setConversationsLoading(true);

    let query = supabase
      .from("feedback_threads")
      .select("*")
      .order("last_message_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("staff_user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Unable to load feedback", description: error.message, variant: "destructive" });
      setConversations([]);
      setConversationsLoading(false);
      return;
    }

    const dedupedThreads = new Map<string, FeedbackThread>();

    (data ?? []).forEach((thread) => {
      if (!dedupedThreads.has(thread.staff_user_id)) {
        dedupedThreads.set(thread.staff_user_id, thread);
      }
    });

    const nextThreads = Array.from(dedupedThreads.values());

    if (nextThreads.length === 0) {
      setConversations([]);
      setSelectedThreadId((current) => (current === NEW_CONVERSATION_ID ? current : null));
      setConversationsLoading(false);
      return;
    }

    const threadIds = nextThreads.map((thread) => thread.id);
    const { data: previewRows, error: previewError } = await supabase
      .from("feedback_messages")
      .select("thread_id,message,created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false });

    if (previewError) {
      toast({ title: "Unable to load feedback", description: previewError.message, variant: "destructive" });
      setConversations([]);
      setConversationsLoading(false);
      return;
    }

    const previewByThreadId = new Map<string, { message: string; created_at: string }>();

    (previewRows ?? []).forEach((row) => {
      if (!previewByThreadId.has(row.thread_id)) {
        previewByThreadId.set(row.thread_id, {
          message: row.message,
          created_at: row.created_at,
        });
      }
    });

    const nextConversations: ConversationSummary[] = nextThreads.map((thread) => {
      const preview = previewByThreadId.get(thread.id);

      return {
        ...thread,
        displayName: isAdmin ? thread.staff_name : "Admin",
        previewMessage: truncateMessage(preview?.message ?? "No messages yet."),
        previewCreatedAt: preview?.created_at ?? thread.last_message_at ?? thread.created_at,
      };
    });

    setConversations(nextConversations);
    setSelectedThreadId((current) => {
      if (current === NEW_CONVERSATION_ID) {
        return nextConversations[0]?.id ?? null;
      }

      if (current && nextConversations.some((conversation) => conversation.id === current)) {
        return current;
      }

      return null;
    });
    setConversationsLoading(false);
  }, [isAdmin, toast, user?.id]);

  const fetchMessages = useCallback(
    async (threadId: string) => {
      setMessagesLoading(true);

      const { data, error } = await supabase
        .from("feedback_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) {
        toast({ title: "Unable to load messages", description: error.message, variant: "destructive" });
        setMessages([]);
        setMessagesLoading(false);
        return;
      }

      setMessages(data ?? []);
      setMessagesLoading(false);
    },
    [toast]
  );

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedThreadId || selectedThreadId === NEW_CONVERSATION_ID) {
      setMessages([]);
      return;
    }

    void fetchMessages(selectedThreadId);
  }, [fetchMessages, selectedThreadId]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`feedback-center-${mode}-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback_threads" }, () => {
        void fetchConversations();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback_messages" }, (payload: any) => {
        const changedThreadId = payload.new?.thread_id ?? payload.old?.thread_id ?? null;
        void fetchConversations();

        if (selectedThreadId && selectedThreadId !== NEW_CONVERSATION_ID && changedThreadId === selectedThreadId) {
          void fetchMessages(selectedThreadId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConversations, fetchMessages, mode, selectedThreadId, user?.id]);

  const syncThreadActivity = useCallback(async (threadId: string, lastMessageAt: string) => {
    const { error } = await supabase
      .from("feedback_threads")
      .update({
        last_message_at: lastMessageAt,
        status: "open",
      })
      .eq("id", threadId);

    if (error) {
      throw error;
    }
  }, []);

  const ensureStaffConversation = useCallback(async () => {
    if (!user?.id) {
      return null;
    }

    const existingConversation = conversations[0];
    if (existingConversation) {
      return existingConversation.id;
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("feedback_threads")
      .select("*")
      .eq("staff_user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (existingError) {
      throw existingError;
    }

    const existingThread = existingRows?.[0];
    if (existingThread) {
      return existingThread.id;
    }

    const { data: createdThread, error: createError } = await supabase
      .from("feedback_threads")
      .insert({
        staff_user_id: user.id,
        staff_name: profile?.name || user.email?.split("@")[0] || "Staff Member",
        staff_email: profile?.email || user.email || null,
        subject: DEFAULT_FEEDBACK_SUBJECT,
      })
      .select("*")
      .single();

    if (createError || !createdThread) {
      throw createError || new Error("Unable to create feedback conversation.");
    }

    return createdThread.id;
  }, [conversations, profile?.email, profile?.name, user?.email, user?.id]);

  const openConversation = (threadId: string) => {
    setSelectedThreadId(threadId);
  };

  const startConversation = () => {
    setSelectedThreadId(NEW_CONVERSATION_ID);
    setMessages([]);
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user?.id) {
      return;
    }

    const trimmedMessage = draftMessage.trim();

    if (!trimmedMessage) {
      toast({
        title: "Message required",
        description: "Write a message before sending it.",
        variant: "destructive",
      });
      return;
    }

    setSendingMessage(true);

    try {
      let threadId = selectedConversation?.id ?? null;

      if (!threadId && !isAdmin) {
        threadId = await ensureStaffConversation();
      }

      if (!threadId) {
        throw new Error("Select a conversation before sending a message.");
      }

      const messageTime = new Date().toISOString();
      const { error: messageError } = await supabase.from("feedback_messages").insert({
        thread_id: threadId,
        sender_user_id: user.id,
        sender_role: isAdmin ? "admin" : "staff",
        message: trimmedMessage,
      });

      if (messageError) {
        throw messageError;
      }

      await syncThreadActivity(threadId, messageTime);

      setDraftMessage("");
      setSelectedThreadId(threadId);
      await Promise.all([fetchConversations(), fetchMessages(threadId)]);
    } catch (error: any) {
      toast({
        title: "Unable to send message",
        description: error.message || "The feedback message could not be sent.",
        variant: "destructive",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const resolvedTitle = title ?? (isAdmin ? "Feedback" : "Feedback");
  const resolvedDescription =
    description ??
    (isAdmin
      ? "Open any staff conversation, read the latest message preview, and reply directly."
      : "Open your conversation with admin, send a complaint or suggestion, and continue chatting in one place.");

  const listTitle = isAdmin ? "Staff Conversations" : "Messages";
  const showConversationView = Boolean(selectedConversation) || isStartingNewConversation;
  const conversationHeaderTitle = selectedConversation?.displayName ?? "Admin";
  const conversationHeaderDescription = isAdmin
    ? selectedConversation?.staff_email || "Direct message conversation"
    : "Direct conversation with admin";

  return (
    <Card className={cn("border-0 shadow-sm", className)}>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{resolvedTitle}</CardTitle>
            <CardDescription>{resolvedDescription}</CardDescription>
          </div>

          <Button variant="outline" size="sm" onClick={() => void fetchConversations()} disabled={conversationsLoading}>
            {conversationsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {showConversationView ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" size="sm" className="-ml-2 gap-2" onClick={() => setSelectedThreadId(null)}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border bg-background p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="text-sm font-semibold">
                  {(conversationHeaderTitle.trim().charAt(0) || "A").toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{conversationHeaderTitle}</p>
                <p className="truncate text-sm text-muted-foreground">{conversationHeaderDescription}</p>
              </div>
            </div>

            <ScrollArea className="h-[360px] rounded-2xl border bg-background">
              <div className="space-y-3 p-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Start the conversation and your messages will appear here.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const fromAdmin = message.sender_role === "admin";

                    return (
                      <div
                        key={message.id}
                        className={cn("flex", fromAdmin ? "justify-start" : "justify-end")}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                            fromAdmin
                              ? "bg-muted text-foreground"
                              : "bg-primary text-primary-foreground"
                          )}
                        >
                          <p className="text-xs font-medium opacity-80">
                            {fromAdmin ? "Admin" : isAdmin ? conversationHeaderTitle : "You"}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap leading-6">{message.message}</p>
                          <p className="mt-2 text-[11px] opacity-75">
                            {format(new Date(message.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <form onSubmit={sendMessage} className="space-y-3">
              <Textarea
                rows={4}
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder={isAdmin ? "Reply directly to this staff member." : "Write your message to admin."}
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={sendingMessage || (isAdmin && !selectedConversation)}>
                  {sendingMessage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-medium">{listTitle}</p>
              <p className="text-sm text-muted-foreground">
                {isAdmin
                  ? "Each staff member keeps one continuous conversation, just like a messaging app."
                  : "Open your admin conversation and keep chatting there whenever you need help."}
              </p>
            </div>

            {conversationsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : conversations.length === 0 ? (
              isAdmin ? (
                <div className="rounded-2xl border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">No staff conversations yet.</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startConversation}
                  className="w-full rounded-2xl border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <span className="text-sm font-semibold">A</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">Admin</p>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        Start a conversation with admin.
                      </p>
                    </div>
                  </div>
                </button>
              )
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <button
                    type="button"
                    key={conversation.id}
                    onClick={() => openConversation(conversation.id)}
                    className="w-full rounded-2xl border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <span className="text-sm font-semibold">
                          {(conversation.displayName.trim().charAt(0) || "A").toUpperCase()}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold">{conversation.displayName}</p>
                          {conversation.previewCreatedAt ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(conversation.previewCreatedAt), { addSuffix: true })}
                            </span>
                          ) : null}
                        </div>

                        {isAdmin && conversation.staff_email ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{conversation.staff_email}</p>
                        ) : null}

                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {conversation.previewMessage}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FeedbackCenter;
