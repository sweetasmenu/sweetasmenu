'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ChefHat, Sparkles, Zap, Crown, ArrowLeft, X, Languages, Wand2, QrCode, Smartphone, TrendingUp, Star } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans';

export default function PricingPage() {
  const router = useRouter();
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  const getIconForPlan = (planId: string) => {
    switch (planId) {
      case 'free':
        return <ChefHat className="w-7 h-7" />;
      case 'basic':
        return <Zap className="w-7 h-7" />;
      case 'pro':
        return <Sparkles className="w-7 h-7" />;
      case 'enterprise':
        return <Crown className="w-7 h-7" />;
      default:
        return <ChefHat className="w-7 h-7" />;
    }
  };

  const getColorClasses = (color: string) => {
    const colors = {
      blue: {
        bg: 'bg-blue-500',
        hover: 'hover:bg-blue-600',
        text: 'text-blue-600',
        border: 'border-blue-500',
        icon: 'bg-blue-100 text-blue-600',
        gradient: 'from-blue-500 to-cyan-500',
      },
      orange: {
        bg: 'bg-orange-500',
        hover: 'hover:bg-orange-600',
        text: 'text-orange-600',
        border: 'border-orange-500',
        icon: 'bg-orange-100 text-orange-600',
        gradient: 'from-orange-500 to-red-500',
      },
      purple: {
        bg: 'bg-purple-500',
        hover: 'hover:bg-purple-600',
        text: 'text-purple-600',
        border: 'border-purple-500',
        icon: 'bg-purple-100 text-purple-600',
        gradient: 'from-purple-500 to-pink-500',
      },
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  // "Who it's for" descriptions
  const planTargets: Record<string, string> = {
    free: 'Try everything free for 14 days — no credit card needed',
    basic: 'Small takeaways, cafes, and food trucks getting started with digital menus',
    pro: 'Growing restaurants that want professional branding, analytics, and online ordering',
    enterprise: 'Fine dining, restaurant chains, and multi-location businesses needing full power',
  };

  // Feature comparison table data
  const featureComparison = [
    {
      category: 'Menu Management',
      features: [
        { name: 'Menu Items', free: '20', starter: '30', pro: 'Unlimited', enterprise: 'Unlimited' },
        { name: 'Categories', free: '5', starter: '10', pro: 'Unlimited', enterprise: 'Unlimited' },
        { name: 'Menu Editing', free: true, starter: true, pro: true, enterprise: true },
        { name: 'Real-time QR Menu Updates', free: true, starter: true, pro: true, enterprise: true },
      ]
    },
    {
      category: 'AI Features',
      features: [
        { name: 'AI Image Generation', free: '5/mo', starter: '30/mo', pro: '200/mo', enterprise: '500/mo' },
        { name: 'AI Photo Enhancement', free: '5/mo', starter: '30/mo', pro: '200/mo', enterprise: '500/mo' },
        { name: 'AI Menu Descriptions', free: true, starter: true, pro: true, enterprise: true },
        { name: 'AI Menu Assistant (Chatbot)', free: false, starter: false, pro: false, enterprise: true },
      ]
    },
    {
      category: 'Translation & Languages',
      features: [
        { name: 'Languages Supported', free: '2', starter: '2', pro: '2', enterprise: '13+' },
        { name: 'Original + English', free: true, starter: true, pro: true, enterprise: true },
        { name: 'Chinese, Japanese, Korean', free: false, starter: false, pro: false, enterprise: true },
        { name: 'Thai, Vietnamese, Hindi, etc.', free: false, starter: false, pro: false, enterprise: true },
      ]
    },
    {
      category: 'Branding & Customisation',
      features: [
        { name: 'Custom Logo', free: false, starter: 'Small', pro: 'Prominent', enterprise: 'Full' },
        { name: 'Theme Colour Customisation', free: false, starter: false, pro: true, enterprise: true },
        { name: 'Cover Image', free: false, starter: false, pro: true, enterprise: true },
      ]
    },
    {
      category: 'Ordering & POS',
      features: [
        { name: 'Online Ordering', free: true, starter: true, pro: true, enterprise: true },
        { name: 'Card & EFTPOS Payments', free: true, starter: true, pro: true, enterprise: true },
        { name: 'QR Code Digital Menu', free: true, starter: true, pro: true, enterprise: true },
        { name: 'POS System', free: 'Basic', starter: 'Basic', pro: 'Full', enterprise: 'Full' },
        { name: 'Kitchen Display System', free: true, starter: true, pro: true, enterprise: true },
        { name: 'Cashier Terminal', free: true, starter: true, pro: true, enterprise: true },
        { name: 'Thermal Receipt Printing', free: true, starter: true, pro: true, enterprise: true },
        { name: 'Staff Management', free: true, starter: true, pro: true, enterprise: true },
        { name: 'Order Analytics', free: false, starter: false, pro: true, enterprise: true },
        { name: 'Advanced Analytics', free: false, starter: false, pro: false, enterprise: true },
        { name: 'Multi-branch Support', free: false, starter: false, pro: false, enterprise: true },
      ]
    },
    {
      category: 'Support',
      features: [
        { name: 'Email Support', free: true, starter: true, pro: true, enterprise: true },
        { name: 'Priority Support', free: false, starter: false, pro: true, enterprise: true },
        { name: 'Dedicated Account Manager', free: false, starter: false, pro: false, enterprise: true },
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-gray-600 hover:text-orange-500 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>

        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent leading-tight pb-2">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-2 font-medium">
            Choose the perfect plan for your restaurant
          </p>
          <p className="text-base text-gray-500 mb-2">
            All prices in NZD, GST inclusive
          </p>
          <p className="text-lg text-orange-600 font-semibold mb-8">
            14-Day Free Trial &bull; No Credit Card Required &bull; Cancel Anytime
          </p>

          {/* Interval Toggle */}
          <div className="inline-flex items-center bg-white rounded-full p-1 shadow-lg border border-gray-100">
            <button
              onClick={() => setInterval('month')}
              className={`px-6 py-2.5 rounded-full font-semibold transition-all ${
                interval === 'month'
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('year')}
              className={`px-6 py-2.5 rounded-full font-semibold transition-all flex items-center gap-2 ${
                interval === 'year'
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                Save 10%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-20">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const colors = getColorClasses(plan.color);
            const displayPrice = interval === 'year' ? Math.round(plan.price * 0.9) : plan.price;
            const isBestValue = plan.id === 'pro';

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-3xl shadow-xl overflow-hidden transition-all hover:shadow-2xl ${
                  plan.popular ? 'ring-4 ring-orange-500 ring-opacity-50 lg:scale-105 z-10' : ''
                }`}
              >
                {/* Best Value / Popular Badge */}
                {isBestValue && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 text-sm font-semibold text-center flex items-center justify-center gap-2">
                    <Star className="w-4 h-4 fill-current" />
                    Best Value
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                )}

                {plan.popular && !isBestValue && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 text-sm font-semibold text-center">
                    Most Popular
                  </div>
                )}

                <div className={`p-6 ${plan.popular || isBestValue ? 'pt-12' : ''}`}>
                  {/* Icon */}
                  <div className={`${colors.icon} w-14 h-14 rounded-2xl flex items-center justify-center mb-4`}>
                    {getIconForPlan(plan.id)}
                  </div>

                  {/* Plan Name */}
                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                    {plan.name}
                  </h3>

                  {/* Who it's for */}
                  <p className="text-gray-500 text-xs mb-4 min-h-[2.5rem] leading-relaxed">
                    {planTargets[plan.id]}
                  </p>

                  {/* Price */}
                  <div className="mb-4">
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold text-gray-900">
                        ${displayPrice}
                      </span>
                      <span className="text-gray-500 ml-2 text-sm">
                        NZD/{interval === 'month' ? 'mo' : 'yr'}
                      </span>
                    </div>
                    {interval === 'year' && plan.price > 0 && (
                      <p className="text-xs text-green-600 mt-1 font-semibold">
                        Save ${(plan.price * 12 * 0.1).toFixed(0)}/year
                      </p>
                    )}
                    {isBestValue && (
                      <div className="inline-flex items-center bg-green-50 border border-green-200 rounded-full px-3 py-1 mt-2">
                        <TrendingUp className="w-3 h-3 text-green-600 mr-1" />
                        <span className="text-xs text-green-700 font-semibold">Save $110+/mo vs photographer</span>
                      </div>
                    )}
                  </div>

                  {/* CTA Button */}
                  <Link
                    href={plan.price === 0 ? '/login?tab=signup' : `/checkout?plan=${plan.id}&interval=${interval}`}
                    className={`w-full bg-gradient-to-r ${colors.gradient} text-white py-3 rounded-xl font-semibold text-sm transition-all hover:shadow-lg mb-5 flex items-center justify-center`}
                  >
                    {plan.price === 0 ? 'Start Free Trial' : isBestValue ? 'Start Free Trial' : 'Get Started'}
                  </Link>

                  {/* Features */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-900 mb-3">
                      What&apos;s included:
                    </p>
                    <div className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start">
                          {feature.startsWith('✅') ? (
                            <Check className={`${colors.text} w-4 h-4 mr-2 flex-shrink-0 mt-0.5`} />
                          ) : feature.startsWith('❌') ? (
                            <X className="text-gray-300 w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                          ) : feature.startsWith('⚠️') ? (
                            <span className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5 text-xs">⚠️</span>
                          ) : (
                            <Check className={`${colors.text} w-4 h-4 mr-2 flex-shrink-0 mt-0.5`} />
                          )}
                          <span className={`text-xs leading-relaxed ${
                            feature.startsWith('❌') ? 'text-gray-400' : 'text-gray-700'
                          }`}>
                            {feature.replace(/^[✅❌⚠️]\s*/, '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Value Proposition Banner */}
        <div className="max-w-4xl mx-auto mb-16 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6 md:p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
            Why Professional is the Best Value
          </h3>
          <div className="grid sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-orange-600">$200+</p>
              <p className="text-sm text-gray-600">Saved on menu printing per month</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">$500+</p>
              <p className="text-sm text-gray-600">Saved on food photography</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">40%</p>
              <p className="text-sm text-gray-600">More orders with AI-enhanced photos</p>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            The Professional plan at $89/mo pays for itself within the first week.
          </p>
        </div>

        {/* Feature Comparison Table */}
        <div className="max-w-6xl mx-auto mb-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Compare All Features
          </h2>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-4 px-6 font-semibold text-gray-900">Feature</th>
                    <th className="text-center py-4 px-4 font-semibold text-gray-900 min-w-[100px]">Free Trial</th>
                    <th className="text-center py-4 px-4 font-semibold text-gray-900 min-w-[100px]">Starter</th>
                    <th className="text-center py-4 px-4 font-semibold text-orange-600 min-w-[100px]">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full mb-1">BEST VALUE</span>
                        Professional
                      </div>
                    </th>
                    <th className="text-center py-4 px-4 font-semibold text-purple-600 min-w-[100px]">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {featureComparison.map((category, catIndex) => (
                    <>
                      <tr key={`cat-${catIndex}`} className="bg-gray-50">
                        <td colSpan={5} className="py-3 px-6 font-semibold text-gray-700 text-sm">
                          {category.category}
                        </td>
                      </tr>
                      {category.features.map((feature, featureIndex) => (
                        <tr key={`feature-${catIndex}-${featureIndex}`} className="border-b border-gray-100">
                          <td className="py-3 px-6 text-gray-700 text-sm">{feature.name}</td>
                          <td className="py-3 px-4 text-center">
                            {typeof feature.free === 'boolean' ? (
                              feature.free ? (
                                <Check className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <X className="w-5 h-5 text-gray-300 mx-auto" />
                              )
                            ) : (
                              <span className="text-sm text-gray-600">{feature.free}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {typeof feature.starter === 'boolean' ? (
                              feature.starter ? (
                                <Check className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <X className="w-5 h-5 text-gray-300 mx-auto" />
                              )
                            ) : (
                              <span className="text-sm text-gray-600">{feature.starter}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center bg-orange-50/50">
                            {typeof feature.pro === 'boolean' ? (
                              feature.pro ? (
                                <Check className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <X className="w-5 h-5 text-gray-300 mx-auto" />
                              )
                            ) : (
                              <span className="text-sm font-semibold text-orange-600">{feature.pro}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center bg-purple-50/50">
                            {typeof feature.enterprise === 'boolean' ? (
                              feature.enterprise ? (
                                <Check className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <X className="w-5 h-5 text-gray-300 mx-auto" />
                              )
                            ) : (
                              <span className="text-sm font-semibold text-purple-600">{feature.enterprise}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto mb-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-md">
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I change plans later?
              </h3>
              <p className="text-gray-600 text-sm">
                Yes! You can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md">
              <h3 className="font-semibold text-gray-900 mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600 text-sm">
                We accept all major credit cards (Visa, Mastercard, Amex) and bank transfers for Enterprise plans.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md">
              <h3 className="font-semibold text-gray-900 mb-2">
                Is there a free trial?
              </h3>
              <p className="text-gray-600 text-sm">
                Yes! All plans come with a 14-day free trial. No credit card required. Test all AI features risk-free!
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md">
              <h3 className="font-semibold text-gray-900 mb-2">
                What languages are supported?
              </h3>
              <p className="text-gray-600 text-sm">
                Free to Professional plans include Original + English (2 languages). Enterprise unlocks 13+ languages including Chinese, Japanese, Korean, Thai, Vietnamese, Hindi, and more.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md">
              <h3 className="font-semibold text-gray-900 mb-2">
                How does AI photo enhancement work?
              </h3>
              <p className="text-gray-600 text-sm">
                Upload your food photos and our AI enhances lighting, color, and presentation automatically. No editing skills required! Even phone photos become magazine-quality.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md">
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-gray-600 text-sm">
                Absolutely. Cancel anytime with no penalties. Your data will be available for 30 days after cancellation.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md">
              <h3 className="font-semibold text-gray-900 mb-2">
                What is multi-branch support?
              </h3>
              <p className="text-gray-600 text-sm">
                Enterprise users can manage multiple restaurant locations from a single account. Each branch gets its own menu, QR code, and POS system while sharing analytics and branding.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-md">
              <h3 className="font-semibold text-gray-900 mb-2">
                Do I need to install anything?
              </h3>
              <p className="text-gray-600 text-sm">
                No installation needed! SweetAsMenu is fully web-based. Works on any device — phone, tablet, or computer. Your customers just scan the QR code.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-3xl p-12 shadow-2xl max-w-4xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Get More Customers?
          </h2>
          <p className="text-xl text-white/90 mb-4">
            Start your free 14-day trial today — setup takes just 5 minutes
          </p>
          <p className="text-sm text-white/70 mb-8">
            Join 500+ restaurants already using SweetAsMenu
          </p>
          <Link
            href="/login?tab=signup"
            className="inline-block bg-white hover:bg-gray-100 text-orange-600 px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            Start Free Trial
          </Link>
          <p className="text-white/70 text-sm mt-4">
            No credit card required &bull; Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
