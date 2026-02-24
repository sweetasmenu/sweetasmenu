'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, CreditCard, Key, Shield, CheckCircle, AlertTriangle, Copy } from 'lucide-react';
import { useState } from 'react';

export default function StripeSetupGuidePage() {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  const copyText = (text: string, step: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Stripe Setup Guide</h1>
            <p className="text-sm text-gray-500">How to connect your Stripe account to accept card payments</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Intro */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <CreditCard className="w-6 h-6 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold text-blue-900 text-lg">What is Stripe?</h2>
              <p className="text-blue-800 mt-1">
                Stripe is the most popular payment platform for businesses in New Zealand.
                It allows your customers to pay with Visa, Mastercard, American Express, Apple Pay, and Google Pay.
                Funds are deposited directly into your New Zealand bank account.
              </p>
              <p className="text-blue-700 text-sm mt-2">
                Stripe fee: approximately 2.7% + 30c per transaction (NZD).
              </p>
            </div>
          </div>
        </div>

        {/* Step 1 */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
            <h3 className="text-lg font-semibold text-gray-900">Create a Stripe Account</h3>
          </div>
          <div className="ml-11 space-y-3">
            <p className="text-gray-700">
              If you don't have a Stripe account yet, create one for free:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>
                Go to{' '}
                <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium inline-flex items-center gap-1">
                  stripe.com/register <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Enter your email address and create a password</li>
              <li>Select <strong>New Zealand</strong> as your country</li>
              <li>Fill in your business details (restaurant name, address, etc.)</li>
              <li>Add your New Zealand bank account for payouts (e.g., ANZ, ASB, Westpac, BNZ, Kiwibank)</li>
              <li>Complete identity verification as required by Stripe</li>
            </ol>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> You need a registered New Zealand business or sole trader to activate live payments.
                  You can still use test mode while setting up.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
            <h3 className="text-lg font-semibold text-gray-900">Find Your API Keys</h3>
          </div>
          <div className="ml-11 space-y-3">
            <p className="text-gray-700">
              After logging in to your Stripe account:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>
                Go to{' '}
                <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium inline-flex items-center gap-1">
                  Stripe Dashboard → Developers → API Keys <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Or click the menu: <strong>Developers</strong> (top right) → <strong>API keys</strong>
              </li>
            </ol>

            <p className="text-gray-700 mt-3">
              You will see two keys on this page:
            </p>

            {/* Publishable Key */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-gray-900">Publishable key</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Safe to share</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                This key is used in the customer's browser to load the Stripe payment form.
                It starts with:
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-white px-3 py-1.5 rounded border font-mono text-sm text-gray-800 flex-1">
                  pk_live_xxxxxxxxxxxxxxxxxxxxxxxx
                </code>
                <button
                  onClick={() => copyText('pk_live_', 1)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  {copiedStep === 1 ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Click the copy button next to the key on the Stripe dashboard to copy it.
              </p>
            </div>

            {/* Secret Key */}
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-red-600" />
                <span className="font-semibold text-gray-900">Secret key</span>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Keep private</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                This key is used on the server to process payments. You need to click <strong>"Reveal live key"</strong> (or "Reveal test key") to see it. It starts with:
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-white px-3 py-1.5 rounded border font-mono text-sm text-gray-800 flex-1">
                  sk_live_xxxx...xxxx
                </code>
                <button
                  onClick={() => copyText('sk_live_...', 2)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  {copiedStep === 2 ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Click <strong>"Reveal live key"</strong> → enter your password → then copy the key.
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-800">
                  <strong>Security Warning:</strong> Never share your Secret Key with anyone.
                  Do not post it publicly or include it in emails.
                  SweetAsMenu stores it securely on the server.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
            <h3 className="text-lg font-semibold text-gray-900">Paste Keys in SweetAsMenu</h3>
          </div>
          <div className="ml-11 space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>
                Go to{' '}
                <Link href="/dashboard/settings" className="text-blue-600 hover:underline font-medium">
                  Dashboard → Settings
                </Link>
              </li>
              <li>Click the <strong>Payment Settings</strong> tab</li>
              <li>Make sure <strong>Card Payments</strong> is turned ON</li>
              <li>Paste your <strong>Publishable Key</strong> in the first field</li>
              <li>Paste your <strong>Secret Key</strong> in the second field</li>
              <li>Click <strong>"Save & Test Connection"</strong></li>
            </ol>
            <p className="text-gray-700 mt-2">
              If the keys are valid, you'll see a green <strong>"Stripe Connected"</strong> message.
              Your restaurant is now ready to accept card payments!
            </p>
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
            <h3 className="text-lg font-semibold text-gray-900">Test vs Live Mode</h3>
          </div>
          <div className="ml-11 space-y-3">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <h4 className="font-semibold text-yellow-900 mb-2">Test Mode</h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>Keys start with <code className="bg-white px-1 rounded">pk_test_</code> and <code className="bg-white px-1 rounded">sk_test_</code></li>
                  <li>No real money is charged</li>
                  <li>Use test card: <code className="bg-white px-1 rounded">4242 4242 4242 4242</code></li>
                  <li>Good for testing your setup</li>
                </ul>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h4 className="font-semibold text-green-900 mb-2">Live Mode</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>Keys start with <code className="bg-white px-1 rounded">pk_live_</code> and <code className="bg-white px-1 rounded">sk_live_</code></li>
                  <li>Real money is charged</li>
                  <li>Funds go to your bank account</li>
                  <li>Use for real customers</li>
                </ul>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Start with test keys to make sure everything works.
                When you're ready for real customers, switch to live keys in the Stripe dashboard
                and update them in your SweetAsMenu settings.
              </p>
            </div>
          </div>
        </div>

        {/* Step 5 */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">5</div>
            <h3 className="text-lg font-semibold text-gray-900">Test Your Setup</h3>
          </div>
          <div className="ml-11 space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Open your restaurant menu page on your phone or computer</li>
              <li>Add an item to cart and place an order</li>
              <li>On the payment page, select <strong>Card Payment</strong></li>
              <li>
                If using test keys, enter:
                <div className="mt-1 bg-gray-50 rounded-lg p-3 border">
                  <p className="font-mono text-sm">Card: <strong>4242 4242 4242 4242</strong></p>
                  <p className="font-mono text-sm">Expiry: <strong>12/34</strong> (any future date)</p>
                  <p className="font-mono text-sm">CVC: <strong>123</strong> (any 3 digits)</p>
                </div>
              </li>
              <li>Click Pay — the payment should go through successfully</li>
              <li>Check your Stripe Dashboard to see the payment</li>
            </ol>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900">How long does it take to get verified?</h4>
              <p className="text-sm text-gray-600 mt-1">
                Usually within 1-2 business days. You can use test mode immediately while waiting.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">When do I receive my money?</h4>
              <p className="text-sm text-gray-600 mt-1">
                Stripe deposits funds to your NZ bank account on a rolling basis (usually 2-3 business days after each payment).
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">What are Stripe's fees?</h4>
              <p className="text-sm text-gray-600 mt-1">
                Stripe charges approximately 2.7% + 30c NZD per successful card payment.
                There are no monthly fees or setup costs.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Can I change my keys later?</h4>
              <p className="text-sm text-gray-600 mt-1">
                Yes. Go to Settings → Payment Settings → click "Disconnect" → enter new keys.
                You can also switch between test and live keys at any time.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Is it secure?</h4>
              <p className="text-sm text-gray-600 mt-1">
                Yes. Your Secret Key is stored securely on our server and is never exposed to the browser.
                All payment processing is handled by Stripe's PCI-compliant infrastructure.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pb-8">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-semibold transition-colors"
          >
            <CreditCard className="w-5 h-5" />
            Go to Payment Settings
          </Link>
        </div>

      </div>
    </div>
  );
}
