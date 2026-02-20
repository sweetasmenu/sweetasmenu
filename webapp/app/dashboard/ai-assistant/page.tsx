'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  Bot,
  Send,
  Sparkles,
  TrendingUp,
  PenLine,
  DollarSign,
  Lock,
  Crown,
  ArrowLeft,
  Loader2
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIAssistantPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('free_trial');
  const [hasAccess, setHasAccess] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Quick action templates
  const quickActions = [
    {
      icon: PenLine,
      label: 'Write Description',
      color: 'text-blue-600',
      bg: 'bg-blue-50 hover:bg-blue-100',
      prompt: 'Write an appealing menu description for my restaurant. Focus on highlighting our best dishes and unique selling points.'
    },
    {
      icon: DollarSign,
      label: 'Suggest Pricing',
      color: 'text-green-600',
      bg: 'bg-green-50 hover:bg-green-100',
      prompt: 'Analyze my current menu pricing and suggest optimal price points. Consider the New Zealand market and competitor pricing.'
    },
    {
      icon: TrendingUp,
      label: 'Analyze Sales',
      color: 'text-purple-600',
      bg: 'bg-purple-50 hover:bg-purple-100',
      prompt: 'Give me a summary of my sales performance. What are the trends, best sellers, and areas for improvement?'
    }
  ];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    checkAuthAndPlan();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkAuthAndPlan = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const uid = session.user.id;
      setUserId(uid);

      // Fetch trial status to check role
      const trialResponse = await fetch(`${API_URL}/api/trial/status/${uid}`);
      let role = 'free_trial';

      if (trialResponse.ok) {
        const trialData = await trialResponse.json();
        role = trialData.role || trialData.subscription?.role || 'free_trial';
      }

      setUserRole(role);

      // Check if user has enterprise or admin access
      const allowed = ['enterprise', 'premium', 'admin'].includes(role);
      setHasAccess(allowed);

      if (allowed) {
        // Fetch restaurant ID from profile
        const savedRestaurantId = localStorage.getItem(`selected_restaurant_${uid}`);
        let profileUrl = `${API_URL}/api/user/profile?user_id=${uid}`;
        if (savedRestaurantId) {
          profileUrl += `&restaurant_id=${savedRestaurantId}`;
        }

        const profileResponse = await fetch(profileUrl);
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const restId = profileData.restaurant?.restaurant_id;
          if (restId) {
            setRestaurantId(restId);
          }
        }

        // Add welcome message
        setMessages([
          {
            role: 'assistant',
            content:
              "Hello! I'm your **Smart Menu AI Assistant**. I can help you with:\n\n" +
              "- **Writing menu descriptions** that attract customers\n" +
              "- **Suggesting pricing strategies** for the NZ market\n" +
              "- **Analyzing your sales data** and identifying trends\n" +
              "- **Optimizing your menu** for better performance\n\n" +
              "How can I help you today?"
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to check auth/plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sendingMessage || !userId) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message to chat
    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage }
    ];
    setMessages(updatedMessages);
    setSendingMessage(true);

    try {
      // Build history from previous messages (exclude the welcome message if it's the only one)
      const history = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch(`${API_URL}/api/ai/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          restaurant_id: restaurantId,
          message: userMessage,
          history
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assistantContent =
          data.response || data.message || 'Sorry, I could not generate a response.';

        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: assistantContent }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'Sorry, something went wrong. Please try again in a moment.'
          }
        ]);
      }
    } catch (error) {
      console.error('AI chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Sorry, I could not connect to the AI service. Please check your connection and try again.'
        }
      ]);
    } finally {
      setSendingMessage(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  /** Render message content with basic markdown-like formatting */
  const renderMessageContent = (content: string) => {
    // Split into lines for line-break support
    const lines = content.split('\n');

    return lines.map((line, lineIndex) => {
      // Process bold (**text**)
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const rendered = parts.map((part, partIndex) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={partIndex} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={partIndex}>{part}</span>;
      });

      return (
        <span key={lineIndex}>
          {rendered}
          {lineIndex < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Upgrade blocker for non-enterprise users
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back link */}
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-gray-600 hover:text-orange-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </div>

          {/* Upgrade blocker card */}
          <div className="bg-white rounded-2xl shadow-xl p-10 text-center">
            <div className="inline-block bg-orange-100 p-5 rounded-full mb-6">
              <Lock className="w-14 h-14 text-orange-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Enterprise Plan Required
            </h2>
            <p className="text-gray-600 mb-2 max-w-md mx-auto">
              The AI Assistant is available exclusively for Enterprise plan
              subscribers.
            </p>
            <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
              Upgrade to Enterprise to unlock AI-powered menu descriptions,
              pricing suggestions, sales analysis, and more.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-4 px-10 rounded-xl transition-all shadow-lg hover:shadow-xl text-lg"
            >
              <Crown className="w-6 h-6 mr-3" />
              Upgrade Plan
            </Link>
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main AI Assistant interface for Enterprise users
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center text-gray-600 hover:text-orange-500 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Back to Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-gray-300 hidden sm:block" />
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-br from-orange-500 to-red-500 p-2 rounded-lg">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    AI Assistant
                  </h1>
                  <p className="text-xs text-gray-500 hidden sm:block">
                    Powered by Smart Menu AI
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                Enterprise
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 gap-6 overflow-hidden">
        {/* Left sidebar - Quick Actions */}
        <div className="hidden lg:flex flex-col w-72 flex-shrink-0 gap-4">
          <div className="bg-white rounded-2xl shadow-lg p-5 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.prompt)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${action.bg} group`}
                >
                  <div
                    className={`p-2 rounded-lg bg-white shadow-sm ${action.color}`}
                  >
                    <action.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {action.label}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tips card */}
          <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-lg p-5 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-semibold">Pro Tips</h3>
            </div>
            <ul className="text-sm text-orange-100 space-y-2">
              <li>- Ask about your best-selling items</li>
              <li>- Get menu copy in multiple languages</li>
              <li>- Request pricing analysis by category</li>
              <li>- Ask for seasonal menu suggestions</li>
            </ul>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col flex-1 overflow-hidden">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`flex items-start gap-3 max-w-[85%] sm:max-w-[75%] ${
                      message.role === 'user'
                        ? 'flex-row-reverse'
                        : 'flex-row'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        message.role === 'user'
                          ? 'bg-orange-500'
                          : 'bg-slate-200'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <span className="text-white text-xs font-bold">
                          You
                        </span>
                      ) : (
                        <Bot className="w-4 h-4 text-slate-600" />
                      )}
                    </div>

                    {/* Message bubble */}
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 text-gray-800'
                      }`}
                    >
                      <div
                        className={`text-sm leading-relaxed ${
                          message.role === 'user'
                            ? 'text-white'
                            : 'text-gray-800'
                        }`}
                      >
                        {renderMessageContent(message.content)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {sendingMessage && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-3 max-w-[75%]">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-200">
                      <Bot className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="bg-slate-100 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Mobile quick actions - visible on smaller screens */}
            <div className="lg:hidden border-t border-gray-100 px-4 py-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 transition-colors border border-gray-200"
                  >
                    <action.icon className={`w-4 h-4 ${action.color}`} />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input bar */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about your restaurant..."
                  disabled={sendingMessage}
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sendingMessage}
                  className="flex-shrink-0 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors shadow-md hover:shadow-lg"
                >
                  {sendingMessage ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                AI responses are generated based on your restaurant data. Always
                verify suggestions before applying.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
