'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Printer, Cloud, CheckCircle, XCircle, Clock, RefreshCw,
  Loader2, Power, ArrowLeft, Trash2, RotateCcw
} from 'lucide-react';
import { printViaIframe } from '@/lib/utils/printHelper';
import { supabase } from '@/lib/supabase/client';

interface POSSession {
  staffId: string;
  staffName: string;
  role: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  primaryLanguage?: string;
  expires: number;
}

interface PrintJob {
  id: string;
  restaurant_id: string;
  order_id: string | null;
  job_type: 'receipt' | 'kitchen_ticket';
  html_content: string;
  status: 'pending' | 'printing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: string;
  printed_at: string | null;
}

export default function PrintAgentPage() {
  const router = useRouter();
  const [session, setSession] = useState<POSSession | null>(null);
  const [connected, setConnected] = useState(false);
  const [autoPrint, setAutoPrint] = useState(true);
  const [pendingJobs, setPendingJobs] = useState<PrintJob[]>([]);
  const [printHistory, setPrintHistory] = useState<PrintJob[]>([]);
  const [stats, setStats] = useState({ printed: 0, failed: 0 });
  const [printing, setPrinting] = useState(false);
  const printQueueRef = useRef<PrintJob[]>([]);
  const isProcessingRef = useRef(false);
  const autoPrintRef = useRef(true);

  // Keep ref in sync
  useEffect(() => { autoPrintRef.current = autoPrint; }, [autoPrint]);

  // Check session
  useEffect(() => {
    const savedSession = localStorage.getItem('pos_session');
    if (!savedSession) {
      router.push('/pos/login');
      return;
    }

    const parsedSession = JSON.parse(savedSession) as POSSession;
    if (parsedSession.expires < Date.now()) {
      localStorage.removeItem('pos_session');
      router.push('/pos/login');
      return;
    }

    setSession(parsedSession);
  }, [router]);

  // Process print queue sequentially
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || printQueueRef.current.length === 0) return;
    if (!autoPrintRef.current) return;

    isProcessingRef.current = true;
    setPrinting(true);

    while (printQueueRef.current.length > 0 && autoPrintRef.current) {
      const job = printQueueRef.current[0];

      try {
        // Update status to 'printing'
        await supabase
          .from('print_queue')
          .update({ status: 'printing' })
          .eq('id', job.id);

        // Print using existing desktop print helper
        printViaIframe(job.html_content);

        // Wait for print to process
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Mark as completed
        await supabase
          .from('print_queue')
          .update({ status: 'completed', printed_at: new Date().toISOString() })
          .eq('id', job.id);

        // Update local state
        const completedJob = { ...job, status: 'completed' as const, printed_at: new Date().toISOString() };
        setPrintHistory(prev => [completedJob, ...prev.slice(0, 49)]);
        setStats(prev => ({ ...prev, printed: prev.printed + 1 }));
      } catch (error) {
        console.error('Print job failed:', error);

        await supabase
          .from('print_queue')
          .update({ status: 'failed', error_message: String(error) })
          .eq('id', job.id);

        const failedJob = { ...job, status: 'failed' as const, error_message: String(error) };
        setPrintHistory(prev => [failedJob, ...prev.slice(0, 49)]);
        setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
      }

      // Remove from queue
      printQueueRef.current = printQueueRef.current.slice(1);
      setPendingJobs([...printQueueRef.current]);
    }

    isProcessingRef.current = false;
    setPrinting(false);
  }, []);

  // Manual print single job
  const printSingleJob = useCallback(async (job: PrintJob) => {
    setPrinting(true);
    try {
      await supabase.from('print_queue').update({ status: 'printing' }).eq('id', job.id);

      printViaIframe(job.html_content);
      await new Promise(resolve => setTimeout(resolve, 3000));

      await supabase
        .from('print_queue')
        .update({ status: 'completed', printed_at: new Date().toISOString() })
        .eq('id', job.id);

      // Remove from pending
      printQueueRef.current = printQueueRef.current.filter(j => j.id !== job.id);
      setPendingJobs([...printQueueRef.current]);

      const completedJob = { ...job, status: 'completed' as const, printed_at: new Date().toISOString() };
      setPrintHistory(prev => [completedJob, ...prev.slice(0, 49)]);
      setStats(prev => ({ ...prev, printed: prev.printed + 1 }));
    } catch (error) {
      console.error('Manual print failed:', error);

      await supabase
        .from('print_queue')
        .update({ status: 'failed', error_message: String(error) })
        .eq('id', job.id);

      setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
    }
    setPrinting(false);
  }, []);

  // Retry failed job
  const retryJob = useCallback(async (job: PrintJob) => {
    // Reset to pending and add back to queue
    await supabase.from('print_queue').update({ status: 'pending', error_message: null }).eq('id', job.id);

    const resetJob = { ...job, status: 'pending' as const, error_message: null };
    printQueueRef.current = [...printQueueRef.current, resetJob];
    setPendingJobs([...printQueueRef.current]);
    setPrintHistory(prev => prev.filter(j => j.id !== job.id));
    setStats(prev => ({ ...prev, failed: Math.max(0, prev.failed - 1) }));

    // Process if auto-print is on
    if (autoPrintRef.current) {
      processQueue();
    }
  }, [processQueue]);

  // Fetch pending jobs on load
  useEffect(() => {
    if (!session?.restaurantId) return;

    const fetchPending = async () => {
      const { data } = await supabase
        .from('print_queue')
        .select('*')
        .eq('restaurant_id', session.restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (data && data.length > 0) {
        printQueueRef.current = data as PrintJob[];
        setPendingJobs(data as PrintJob[]);
        if (autoPrintRef.current) {
          processQueue();
        }
      }
    };

    // Also fetch recent history
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('print_queue')
        .select('*')
        .eq('restaurant_id', session.restaurantId)
        .in('status', ['completed', 'failed'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setPrintHistory(data as PrintJob[]);
        const completed = data.filter(j => j.status === 'completed').length;
        const failed = data.filter(j => j.status === 'failed').length;
        setStats({ printed: completed, failed });
      }
    };

    fetchPending();
    fetchHistory();
  }, [session?.restaurantId, processQueue]);

  // Realtime subscription for new print jobs
  useEffect(() => {
    if (!session?.restaurantId) return;

    const channel = supabase
      .channel('print-agent-queue')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'print_queue',
          filter: `restaurant_id=eq.${session.restaurantId}`
        },
        (payload) => {
          const newJob = payload.new as PrintJob;
          if (newJob.status === 'pending') {
            printQueueRef.current = [...printQueueRef.current, newJob];
            setPendingJobs([...printQueueRef.current]);

            if (autoPrintRef.current) {
              processQueue();
            }
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.restaurantId, processQueue]);

  // Clear all completed/failed history
  const clearHistory = async () => {
    if (!session?.restaurantId) return;

    await supabase
      .from('print_queue')
      .delete()
      .eq('restaurant_id', session.restaurantId)
      .in('status', ['completed', 'failed']);

    setPrintHistory([]);
    setStats({ printed: 0, failed: 0 });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/pos/orders')}
              className="p-2 hover:bg-slate-700 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-purple-400" />
              <h1 className="text-lg font-bold">Print Agent</h1>
            </div>
            <span className="text-sm text-slate-400">{session.restaurantName}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              connected ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              {connected ? 'Connected' : 'Disconnected'}
            </div>

            {/* Auto-Print Toggle */}
            <button
              onClick={() => setAutoPrint(!autoPrint)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                autoPrint
                  ? 'bg-purple-600 hover:bg-purple-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              <Power className="w-4 h-4" />
              Auto-Print: {autoPrint ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-orange-400 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <div className="text-3xl font-bold text-orange-400">{pendingJobs.length}</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Printed</span>
            </div>
            <div className="text-3xl font-bold text-green-400">{stats.printed}</div>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Failed</span>
            </div>
            <div className="text-3xl font-bold text-red-400">{stats.failed}</div>
          </div>
        </div>

        {/* Printing Indicator */}
        {printing && (
          <div className="bg-purple-900/30 border border-purple-700 rounded-xl p-4 mb-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span className="text-purple-300 font-medium">Printing in progress...</span>
          </div>
        )}

        {/* Pending Jobs */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-6">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              Pending Jobs ({pendingJobs.length})
            </h2>
            {pendingJobs.length > 0 && !autoPrint && (
              <button
                onClick={processQueue}
                disabled={printing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                Print All
              </button>
            )}
          </div>

          {pendingJobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Cloud className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No pending print jobs</p>
              <p className="text-xs mt-1">Jobs will appear here when sent from iPad/tablet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {pendingJobs.map((job) => (
                <div key={job.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      job.status === 'printing' ? 'bg-blue-400 animate-pulse' : 'bg-orange-400'
                    }`} />
                    <div>
                      <span className="font-medium text-sm">
                        {job.job_type === 'receipt' ? 'Receipt' : 'Kitchen Ticket'}
                      </span>
                      {job.order_id && (
                        <span className="text-slate-400 text-xs ml-2">
                          #{job.order_id.slice(0, 8).toUpperCase()}
                        </span>
                      )}
                      <div className="text-xs text-slate-500">{formatTime(job.created_at)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => printSingleJob(job)}
                    disabled={printing}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium disabled:opacity-50"
                  >
                    <Printer className="w-3 h-3" />
                    Print
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Print History */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Print History
            </h2>
            {printHistory.length > 0 && (
              <button
                onClick={clearHistory}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-400"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {printHistory.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              No print history yet
            </div>
          ) : (
            <div className="divide-y divide-slate-700 max-h-[400px] overflow-y-auto">
              {printHistory.map((job) => (
                <div key={job.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {job.status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <div>
                      <span className="text-sm">
                        {job.job_type === 'receipt' ? 'Receipt' : 'Kitchen'}
                        {job.order_id && (
                          <span className="text-slate-400 ml-1.5">
                            #{job.order_id.slice(0, 8).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <div className="text-xs text-slate-500">
                        {formatTime(job.created_at)}
                        {job.printed_at && ` → ${formatTime(job.printed_at)}`}
                      </div>
                      {job.error_message && (
                        <div className="text-xs text-red-400 mt-0.5">{job.error_message}</div>
                      )}
                    </div>
                  </div>
                  {job.status === 'failed' && (
                    <button
                      onClick={() => retryJob(job)}
                      className="flex items-center gap-1 px-2 py-1 bg-orange-600 hover:bg-orange-500 rounded text-xs font-medium"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Retry
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-sm text-slate-400">
          <p className="font-medium text-slate-300 mb-2">How to use:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Keep this page open on the computer connected to the thermal printer</li>
            <li>On iPad/tablet, set print method to <span className="text-purple-400 font-medium">Cloud</span> in the POS Orders toolbar</li>
            <li>When staff prints from iPad, the job will appear here and print automatically</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
