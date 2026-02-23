'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Printer, Cloud, CheckCircle, XCircle, Clock,
  Loader2, Power, ArrowLeft, Trash2, RotateCcw, Volume2, VolumeX, Zap
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

/** Play a beep notification sound using Web Audio API */
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [0, 0.2].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.value = 0.3;
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.15);
    });
  } catch {
    // Audio not available
  }
}

/**
 * Try to auto-print by opening a popup window.
 * Returns true if popup opened successfully (auto-print will happen).
 * Returns false if popup was blocked (need manual print).
 *
 * Works automatically when Chrome is launched with:
 *   --kiosk-printing --disable-popup-blocking
 */
function tryAutoPrint(htmlContent: string): boolean {
  try {
    const printWindow = window.open('', '', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      // The receipt HTML has auto-print script that calls window.print()
      // With --kiosk-printing flag, it prints directly without dialog
      return true;
    }
  } catch (e) {
    console.error('[PrintAgent] Auto-print error:', e);
  }
  return false;
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [flashJob, setFlashJob] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const printQueueRef = useRef<PrintJob[]>([]);
  const isProcessingRef = useRef(false);
  const autoPrintRef = useRef(true);
  const soundRef = useRef(true);

  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { autoPrintRef.current = autoPrint; }, [autoPrint]);

  // Check session
  useEffect(() => {
    const savedSession = localStorage.getItem('pos_session');
    if (!savedSession) { router.push('/pos/login'); return; }
    const parsedSession = JSON.parse(savedSession) as POSSession;
    if (parsedSession.expires < Date.now()) {
      localStorage.removeItem('pos_session');
      router.push('/pos/login');
      return;
    }
    setSession(parsedSession);
  }, [router]);

  // Mark a job as completed in DB and local state
  const markCompleted = useCallback((job: PrintJob) => {
    const now = new Date().toISOString();
    supabase.from('print_queue')
      .update({ status: 'completed', printed_at: now })
      .eq('id', job.id).then();

    printQueueRef.current = printQueueRef.current.filter(j => j.id !== job.id);
    setPendingJobs([...printQueueRef.current]);
    setPrintHistory(prev => [{ ...job, status: 'completed' as const, printed_at: now }, ...prev.slice(0, 49)]);
    setStats(prev => ({ ...prev, printed: prev.printed + 1 }));
  }, []);

  // Auto-print queue processor
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || printQueueRef.current.length === 0) return;
    if (!autoPrintRef.current) return;

    isProcessingRef.current = true;
    setPrinting(true);

    while (printQueueRef.current.length > 0 && autoPrintRef.current) {
      const job = printQueueRef.current[0];

      await supabase.from('print_queue').update({ status: 'printing' }).eq('id', job.id);

      const success = tryAutoPrint(job.html_content);

      if (success) {
        // Popup opened — receipt will auto-print via its <script>
        await new Promise(resolve => setTimeout(resolve, 3000));
        markCompleted(job);
        setPopupBlocked(false);
      } else {
        // Popup was blocked — stop auto-processing, user needs manual click
        console.warn('[PrintAgent] Popup blocked — switching to manual mode');
        await supabase.from('print_queue').update({ status: 'pending' }).eq('id', job.id);
        setPopupBlocked(true);
        break;
      }
    }

    isProcessingRef.current = false;
    setPrinting(false);
  }, [markCompleted]);

  // Manual print single job (user click = user gesture = always works)
  const printJob = useCallback(async (job: PrintJob) => {
    setPrinting(true);
    await supabase.from('print_queue').update({ status: 'printing' }).eq('id', job.id);
    printViaIframe(job.html_content);
    await new Promise(resolve => setTimeout(resolve, 2000));
    markCompleted(job);
    setPrinting(false);
  }, [markCompleted]);

  // Manual print ALL
  const printAllJobs = useCallback(async () => {
    if (printQueueRef.current.length === 0) return;
    setPrinting(true);
    const jobs = [...printQueueRef.current];
    for (const job of jobs) {
      await supabase.from('print_queue').update({ status: 'printing' }).eq('id', job.id);
      printViaIframe(job.html_content);
      await new Promise(resolve => setTimeout(resolve, 3000));
      markCompleted(job);
    }
    setPrinting(false);
  }, [markCompleted]);

  // Retry failed job
  const retryJob = useCallback(async (job: PrintJob) => {
    await supabase.from('print_queue').update({ status: 'pending', error_message: null }).eq('id', job.id);
    const resetJob = { ...job, status: 'pending' as const, error_message: null };
    printQueueRef.current = [...printQueueRef.current, resetJob];
    setPendingJobs([...printQueueRef.current]);
    setPrintHistory(prev => prev.filter(j => j.id !== job.id));
    setStats(prev => ({ ...prev, failed: Math.max(0, prev.failed - 1) }));
    if (autoPrintRef.current) processQueue();
  }, [processQueue]);

  // Keyboard shortcut: Enter or P = print next job
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === 'Enter' || e.key === 'p' || e.key === 'P') && printQueueRef.current.length > 0) {
        e.preventDefault();
        printJob(printQueueRef.current[0]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [printJob]);

  // Fetch pending jobs on load
  useEffect(() => {
    if (!session?.restaurantId) return;

    const fetchPending = async () => {
      const { data } = await supabase
        .from('print_queue').select('*')
        .eq('restaurant_id', session.restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (data && data.length > 0) {
        printQueueRef.current = data as PrintJob[];
        setPendingJobs(data as PrintJob[]);
        if (autoPrintRef.current) processQueue();
      }
    };

    const fetchHistory = async () => {
      const { data } = await supabase
        .from('print_queue').select('*')
        .eq('restaurant_id', session.restaurantId)
        .in('status', ['completed', 'failed'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) {
        setPrintHistory(data as PrintJob[]);
        setStats({
          printed: data.filter(j => j.status === 'completed').length,
          failed: data.filter(j => j.status === 'failed').length,
        });
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
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'print_queue',
        filter: `restaurant_id=eq.${session.restaurantId}`
      }, (payload) => {
        const newJob = payload.new as PrintJob;
        if (newJob.status === 'pending') {
          printQueueRef.current = [...printQueueRef.current, newJob];
          setPendingJobs([...printQueueRef.current]);

          if (soundRef.current) playBeep();
          setFlashJob(true);
          setTimeout(() => setFlashJob(false), 2000);

          // Try auto-print
          if (autoPrintRef.current) processQueue();
        }
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, [session?.restaurantId, processQueue]);

  // Clear history
  const clearHistory = async () => {
    if (!session?.restaurantId) return;
    await supabase.from('print_queue').delete()
      .eq('restaurant_id', session.restaurantId)
      .in('status', ['completed', 'failed']);
    setPrintHistory([]);
    setStats({ printed: 0, failed: 0 });
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

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
            <button onClick={() => router.push('/pos/orders')} className="p-2 hover:bg-slate-700 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Cloud className="w-5 h-5 text-purple-400" />
            <h1 className="text-lg font-bold">Print Agent</h1>
            <span className="text-sm text-slate-400 hidden sm:inline">{session.restaurantName}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium ${
              connected ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              {connected ? 'Connected' : 'Disconnected'}
            </div>

            {/* Auto-Print Toggle */}
            <button
              onClick={() => setAutoPrint(!autoPrint)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                autoPrint ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Auto
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded-lg transition-colors ${
                soundEnabled ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        {/* Popup Blocked Warning */}
        {popupBlocked && autoPrint && (
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4 mb-4">
            <p className="text-yellow-300 font-medium mb-2">Auto-print blocked by browser</p>
            <p className="text-yellow-400/80 text-sm mb-3">
              Chrome blocks automatic printing for security. To enable auto-print:
            </p>
            <ol className="text-yellow-400/80 text-sm list-decimal list-inside space-y-1 mb-3">
              <li>Close Chrome completely</li>
              <li>Use the <span className="text-white font-mono">start-print-agent.bat</span> file to open Chrome</li>
              <li>This launches Chrome with special flags that allow auto-printing</li>
            </ol>
            <p className="text-yellow-400/60 text-xs">
              Or click the <span className="text-green-400">PRINT</span> button / press <kbd className="px-1 py-0.5 bg-slate-700 rounded font-mono">Enter</kbd> to print manually
            </p>
          </div>
        )}

        {/* New Job Flash Alert */}
        {flashJob && (
          <div className="bg-yellow-600/30 border-2 border-yellow-500 rounded-xl p-4 mb-4 flex items-center gap-3 animate-pulse">
            <Printer className="w-6 h-6 text-yellow-400" />
            <span className="text-yellow-300 font-bold text-lg">New print job received!</span>
          </div>
        )}

        {/* PRINT Button — always visible when there are pending jobs */}
        {pendingJobs.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => pendingJobs.length === 1 ? printJob(pendingJobs[0]) : printAllJobs()}
              disabled={printing}
              className="w-full py-5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:opacity-50 rounded-2xl text-white font-bold text-2xl flex items-center justify-center gap-3 transition-colors shadow-lg shadow-green-900/50"
            >
              {printing ? (
                <><Loader2 className="w-7 h-7 animate-spin" /> Printing...</>
              ) : (
                <><Printer className="w-7 h-7" /> {pendingJobs.length === 1 ? 'PRINT' : `PRINT ALL (${pendingJobs.length})`}</>
              )}
            </button>
            <p className="text-center text-slate-500 text-xs mt-2">
              Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono">Enter</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono">P</kbd> to print
            </p>
          </div>
        )}

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
          <div className="px-4 py-3 border-b border-slate-700">
            <h2 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              Pending Jobs ({pendingJobs.length})
            </h2>
          </div>
          {pendingJobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Cloud className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Waiting for print jobs...</p>
              <p className="text-xs mt-1">Send from iPad/tablet using Cloud print method</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {pendingJobs.map((job, idx) => (
                <div key={job.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-green-400 animate-pulse' : 'bg-orange-400'}`} />
                    <div>
                      <span className="font-medium text-sm">
                        {job.job_type === 'receipt' ? 'Receipt' : 'Kitchen Ticket'}
                      </span>
                      {job.order_id && <span className="text-slate-400 text-xs ml-2">#{job.order_id.slice(0, 8).toUpperCase()}</span>}
                      <div className="text-xs text-slate-500">{formatTime(job.created_at)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => printJob(job)}
                    disabled={printing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-medium disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5" />
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
              <button onClick={clearHistory} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-400">
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          {printHistory.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No print history yet</div>
          ) : (
            <div className="divide-y divide-slate-700 max-h-[400px] overflow-y-auto">
              {printHistory.map((job) => (
                <div key={job.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {job.status === 'completed'
                      ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    }
                    <div>
                      <span className="text-sm">
                        {job.job_type === 'receipt' ? 'Receipt' : 'Kitchen'}
                        {job.order_id && <span className="text-slate-400 ml-1.5">#{job.order_id.slice(0, 8).toUpperCase()}</span>}
                      </span>
                      <div className="text-xs text-slate-500">
                        {formatTime(job.created_at)}
                        {job.printed_at && ` → ${formatTime(job.printed_at)}`}
                      </div>
                      {job.error_message && <div className="text-xs text-red-400 mt-0.5">{job.error_message}</div>}
                    </div>
                  </div>
                  {job.status === 'failed' && (
                    <button onClick={() => retryJob(job)} className="flex items-center gap-1 px-2 py-1 bg-orange-600 hover:bg-orange-500 rounded text-xs font-medium">
                      <RotateCcw className="w-3 h-3" /> Retry
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-sm text-slate-400">
          <p className="font-medium text-slate-300 mb-2">Setup for auto-print (no clicking needed):</p>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Set POS80 as <span className="text-white">default printer</span> in Windows Settings</li>
            <li>Close Chrome completely</li>
            <li>Double-click <span className="text-purple-400 font-mono">start-print-agent.bat</span> to open Chrome</li>
            <li>Login to POS → this page opens with auto-print enabled</li>
          </ol>
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <p className="font-medium text-slate-300 mb-1">Without .bat file (manual mode):</p>
            <p>Jobs arrive with sound alert → click <span className="text-green-400 font-medium">PRINT</span> or press <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-300 font-mono text-xs">Enter</kbd></p>
          </div>
        </div>
      </div>
    </div>
  );
}
