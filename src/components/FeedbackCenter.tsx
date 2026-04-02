import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FeedbackThread = Tables<"feedback_threads">;
type FeedbackMessage = Tables<"feedback_messages">;
type FeedbackMode = "staff" | "admin";

type FeedbackCenterProps = {
  mode: FeedbackMode;
  className?: string;
  title?: string;
  description?: string;
};

const statusBadgeVariant = (status: FeedbackThread["status"]) =>
  status === "closed" ? "secondary" : "default";

const FeedbackCenter = ({
  mode,
  className,
  title,
  description,
}: FeedbackCenterProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const isAdmin = mode === "admin";
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [newThreadMessage, setNewThreadMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [creatingThread, setCreatingThread] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threads]
  );

  const fetchThreads = useCallback(async () => {
    if (!user?.id) {
      setThreads([]);
      setThreadsLoading(false);
      return;
    }

    setThreadsLoading(true);

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
      setThreads([]);
      setThreadsLoading(false);
      return;
    }

    const nextThreads = data ?? [];
    setThreads(nextThreads);
    setSelectedThreadId((current) => {
      if (nextThreads.length === 0) {
        return null;
      }

      if (current && nextThreads.some((thread) => thread.id === current)) {
        return current;
      }

      return nextThreads[0].id;
    });
    setThreadsLoading(false);
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
    void fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    if (!selectedThreadId) {
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
        void fetchThreads();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback_messages" }, (payload: any) => {
        const threadId = payload.new?.thread_id ?? payload.old?.thread_id ?? null;
        void fetchThreads();

        if (selectedThreadId && threadId === selectedThreadId) {
          void fetchMessages(selectedThreadId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, fetchThreads, mode, selectedThreadId, user?.id]);

  const syncThreadActivity = useCallback(
    async (threadId: string, lastMessageAt: string) => {
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
    },
    []
  );

  const createThread = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user?.id) {
      return;
    }

    const trimmedSubject = subject.trim();
    const trimmedMessage = newThreadMessage.trim();

    if (!trimmedSubject || !trimmedMessage) {
      toast({
        title: "Subject and message required",
        description: "Add a subject and describe the issue or feedback you want admin to review.",
        variant: "destructive",
      });
      return;
    }

    setCreatingThread(true);

    const { data: thread, error: threadError } = await supabase
      .from("feedback_threads")
      .insert({
        staff_user_id: user.id,
        staff_name: profile?.name || user.email?.split("@")[0] || "Staff Member",
        staff_email: profile?.email || user.email || null,
        subject: trimmedSubject,
      })
      .select("*")
      .single();

    if (threadError || !thread) {
      setCreatingThread(false);
      toast({
        title: "Unable to start feedback",
        description: threadError?.message || "The feedback thread could not be created.",
        variant: "destructive",
      });
      return;
    }

    const messageTime = new Date().toISOString();
    const { error: messageError } = await supabase.from("feedback_messages").insert({
      thread_id: thread.id,
      sender_user_id: user.id,
      sender_role: "staff",
      message: trimmedMessage,
    });

    if (messageError) {
      setCreatingThread(false);
      toast({
        title: "Unable to send feedback",
        description: messageError.message,
        variant: "destructive",
      });
      return;
    }

    try {
      await syncThreadActivity(thread.id, messageTime);
    } catch (error: any) {
      setCreatingThread(false);
      toast({
        title: "Feedback sent with warning",
        description: error.message || "The thread activity timestamp could not be updated.",
        variant: "destructive",
      });
      return;
    }

    setSubject("");
    setNewThreadMessage("");
    setSelectedThreadId(thread.id);
    setCreatingThread(false);
    toast({
      title: "Feedback sent",
      description: "Your message is now waiting for admin.",
    });
    await Promise.all([fetchThreads(), fetchMessages(thread.id)]);
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user?.id || !selectedThread) {
      return;
    }

    const trimmedReply = replyMessage.trim();

    if (!trimmedReply) {
      toast({
        title: "Message required",
        description: "Write a reply before sending it.",
        variant: "destructive",
      });
      return;
    }

    setSendingReply(true);
    const messageTime = new Date().toISOString();

    const { error: messageError } = await supabase.from("feedback_messages").insert({
      thread_id: selectedThread.id,
      sender_user_id: user.id,
      sender_role: isAdmin ? "admin" : "staff",
      message: trimmedReply,
    });

    if (messageError) {
      setSendingReply(false);
      toast({ title: "Unable to send reply", description: messageError.message, variant: "destructive" });
      return;
    }

    try {
      await syncThreadActivity(selectedThread.id, messageTime);
    } catch (error: any) {
      setSendingReply(false);
      toast({
        title: "Reply sent with warning",
        description: error.message || "The thread activity timestamp could not be updated.",
        variant: "destructive",
      });
      return;
    }

    setReplyMessage("");
    setSendingReply(false);
    await Promise.all([fetchThreads(), fetchMessages(selectedThread.id)]);
  };

  const toggleThreadStatus = async () => {
    if (!selectedThread || !isAdmin) {
      return;
    }

    setUpdatingStatus(true);
    const nextStatus = selectedThread.status === "closed" ? "open" : "closed";

    const { error } = await supabase
      .from("feedback_threads")
      .update({ status: nextStatus })
      .eq("id", selectedThread.id);

    setUpdatingStatus(false);

    if (error) {
      toast({ title: "Unable to update thread", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: nextStatus === "closed" ? "Thread closed" : "Thread reopened",
      description: `This feedback thread is now ${nextStatus}.`,
    });
    await fetchThreads();
  };

  const resolvedTitle = title ?? (isAdmin ? "Staff Feedback Inbox" : "Feedback");
  const resolvedDescription =
    description ??
    (isAdmin
      ? "Review complaints, questions, and suggestions from staff, then reply directly in each thread."
      : "Send complaints, questions, or suggestions to admin and keep the conversation in one place.");

  return (
    <Card className={cn("border-0 shadow-sm", className)}>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{resolvedTitle}</CardTitle>
            <CardDescription>{resolvedDescription}</CardDescription>
          </div>

          <Button variant="outline" size="sm" onClick={() => void fetchThreads()} disabled={threadsLoading}>
            {threadsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-background p-4">
            <p className="text-sm text-muted-foreground">Total Threads</p>
            <p className="mt-1 text-2xl font-semibold">{threads.length}</p>
          </div>
          <div className="rounded-2xl border bg-background p-4">
            <p className="text-sm text-muted-foreground">Open</p>
            <p className="mt-1 text-2xl font-semibold">
              {threads.filter((thread) => thread.status === "open").length}
            </p>
          </div>
          <div className="rounded-2xl border bg-background p-4">
            <p className="text-sm text-muted-foreground">Closed</p>
            <p className="mt-1 text-2xl font-semibold">
              {threads.filter((thread) => thread.status === "closed").length}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[340px,1fr]">
          <div className="space-y-4">
            {!isAdmin ? (
              <form onSubmit={createThread} className="rounded-2xl border bg-background p-4 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">Start New Feedback</p>
                    <p className="text-xs text-muted-foreground">Send admin a complaint, report, or suggestion.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="feedback-subject">Subject</Label>
                    <Input
                      id="feedback-subject"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      placeholder="Short title for this feedback"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="feedback-message">Message</Label>
                    <Textarea
                      id="feedback-message"
                      rows={5}
                      value={newThreadMessage}
                      onChange={(event) => setNewThreadMessage(event.target.value)}
                      placeholder="Describe the issue, concern, or suggestion clearly."
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={creatingThread}>
                    {creatingThread ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send Feedback
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="rounded-2xl border bg-background shadow-sm">
              <div className="border-b px-4 py-3">
                <p className="font-medium">{isAdmin ? "All Feedback Threads" : "Your Feedback Threads"}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? "Select a staff conversation to read and reply." : "Open any thread to continue the conversation."}
                </p>
              </div>

              <ScrollArea className="h-[360px]">
                <div className="space-y-2 p-3">
                  {threadsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : threads.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        {isAdmin ? "No staff feedback has arrived yet." : "You have not started any feedback threads yet."}
                      </p>
                    </div>
                  ) : (
                    threads.map((thread) => (
                      <button
                        type="button"
                        key={thread.id}
                        onClick={() => setSelectedThreadId(thread.id)}
                        className={cn(
                          "w-full rounded-2xl border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/40",
                          selectedThreadId === thread.id ? "border-primary bg-primary/5" : "bg-background"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{thread.subject}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {isAdmin ? thread.staff_name : thread.staff_email || "Admin conversation"}
                            </p>
                          </div>
                          <Badge variant={statusBadgeVariant(thread.status)}>{thread.status}</Badge>
                        </div>

                        <p className="mt-3 text-xs text-muted-foreground">
                          Updated {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="rounded-2xl border bg-background shadow-sm">
            {selectedThread ? (
              <>
                <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold">{selectedThread.subject}</p>
                      <Badge variant={statusBadgeVariant(selectedThread.status)}>{selectedThread.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isAdmin
                        ? `${selectedThread.staff_name}${selectedThread.staff_email ? ` • ${selectedThread.staff_email}` : ""}`
                        : "Direct conversation with admin"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Started {format(new Date(selectedThread.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>

                  {isAdmin ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void toggleThreadStatus()}
                      disabled={updatingStatus}
                    >
                      {updatingStatus ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : selectedThread.status === "closed" ? (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      {selectedThread.status === "closed" ? "Reopen Thread" : "Close Thread"}
                    </Button>
                  ) : null}
                </div>

                <ScrollArea className="h-[360px]">
                  <div className="space-y-3 p-4">
                    {messagesLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="rounded-2xl border border-dashed p-6 text-center">
                        <p className="text-sm text-muted-foreground">No messages yet in this thread.</p>
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
                                {fromAdmin ? "Admin" : isAdmin ? selectedThread.staff_name : "You"}
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

                <form onSubmit={sendReply} className="border-t p-4">
                  {!isAdmin && selectedThread.status === "closed" ? (
                    <p className="mb-3 text-sm text-muted-foreground">
                      This feedback thread is closed. Admin can reopen it to continue the conversation.
                    </p>
                  ) : null}

                  <div className="space-y-3">
                    <Textarea
                      rows={4}
                      value={replyMessage}
                      onChange={(event) => setReplyMessage(event.target.value)}
                      placeholder={isAdmin ? "Reply directly to this staff member." : "Add more detail or respond to admin."}
                      disabled={!isAdmin && selectedThread.status === "closed"}
                    />

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={sendingReply || (!isAdmin && selectedThread.status === "closed")}
                      >
                        {sendingReply ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Send Reply
                      </Button>
                    </div>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center p-6">
                <div className="max-w-sm text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageSquareText className="h-6 w-6" />
                  </div>
                  <p className="text-base font-semibold">Select a feedback thread</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isAdmin
                      ? "Choose any staff conversation from the left to read the messages and reply directly."
                      : "Start a new feedback thread or open an existing one to continue your conversation with admin."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeedbackCenter;
