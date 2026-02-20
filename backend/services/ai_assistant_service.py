"""
AI Assistant Service - Restaurant management AI assistant powered by Google Gemini

Provides conversational AI for restaurant owners:
- Menu description writing
- Pricing suggestions
- New menu item ideas
- Analytics summaries with insights
"""

import os
import json
import traceback
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

import google.generativeai as genai
from dotenv import load_dotenv
import pathlib

# Load environment variables
env_path = pathlib.Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=str(env_path))
else:
    load_dotenv()

# Gemini configuration
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
    print("AI Assistant Service: Gemini API key configured")
else:
    print("WARNING: GOOGLE_API_KEY not found. AI Assistant will not work.")

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = (
    os.getenv('SUPABASE_SERVICE_ROLE_KEY') or
    os.getenv('SUPABASE_KEY') or
    os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
)

MODEL_NAME = "gemini-2.0-flash"

SYSTEM_PROMPT = """You are a knowledgeable restaurant management AI assistant for a restaurant menu SaaS platform based in New Zealand.

Your capabilities:
- Write compelling, appetizing menu item descriptions
- Suggest pricing strategies based on market context (NZD, GST-inclusive)
- Recommend new menu items based on the restaurant's existing menu and cuisine type
- Answer restaurant management questions (operations, marketing, customer service, food safety)
- Provide actionable business advice tailored to the restaurant industry

Guidelines:
- Be concise and practical in your responses
- All prices should be in NZD and GST-inclusive (15% GST)
- When writing menu descriptions, keep them appetizing, professional, and under 50 words
- When suggesting prices, consider the restaurant's existing price range
- Be culturally aware of New Zealand dining trends and preferences
- If you do not have enough context to answer, ask clarifying questions
- Always provide actionable suggestions the restaurant owner can implement immediately
"""


class AIAssistantService:
    """AI-powered assistant for restaurant management tasks."""

    def __init__(self):
        self.api_key = GOOGLE_API_KEY
        self.ready = bool(self.api_key)
        self.supabase = None

        if not self.ready:
            print("WARNING: AI Assistant Service not ready - missing API key")
            return

        try:
            from supabase import create_client
            if SUPABASE_URL and SUPABASE_KEY:
                self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
                print("AI Assistant Service: Supabase client initialized")
            else:
                print("WARNING: AI Assistant Service: Supabase credentials not found")
        except Exception as e:
            print(f"WARNING: Failed to initialize Supabase for AI Assistant: {str(e)}")
            self.supabase = None

        print("AI Assistant Service initialized")

    def _get_restaurant_context(self, restaurant_id: str) -> str:
        """
        Build a context string with the restaurant's menu information.

        Args:
            restaurant_id: The restaurant UUID

        Returns:
            Formatted string with menu categories, items, and prices
        """
        if not self.supabase:
            return "Restaurant menu data is not available."

        try:
            # Fetch active menu items for this restaurant
            response = self.supabase.table('menus').select(
                'name_original, name_english, price, category, category_en'
            ).eq(
                'restaurant_id', restaurant_id
            ).eq(
                'is_active', True
            ).execute()

            items = response.data if response.data else []

            if not items:
                return "This restaurant has no menu items yet."

            # Group items by category
            categories: Dict[str, List[Dict]] = defaultdict(list)
            for item in items:
                category = item.get('category_en') or item.get('category') or 'Uncategorized'
                categories[category].append(item)

            # Build context string
            lines = [f"Restaurant Menu ({len(items)} items across {len(categories)} categories):"]
            lines.append("")

            for category, category_items in sorted(categories.items()):
                lines.append(f"  {category}:")
                for item in category_items:
                    name = item.get('name_english') or item.get('name_original') or 'Unknown'
                    original = item.get('name_original') or ''
                    price = item.get('price', 0)

                    if original and original != name:
                        lines.append(f"    - {name} ({original}) - ${price:.2f}")
                    else:
                        lines.append(f"    - {name} - ${price:.2f}")

                lines.append("")

            # Calculate price stats
            prices = [item.get('price', 0) for item in items if item.get('price')]
            if prices:
                lines.append(f"  Price range: ${min(prices):.2f} - ${max(prices):.2f}")
                lines.append(f"  Average price: ${sum(prices) / len(prices):.2f}")

            return "\n".join(lines)

        except Exception as e:
            print(f"Error fetching restaurant context: {str(e)}")
            return "Could not load restaurant menu data."

    def chat(
        self,
        user_id: str,
        restaurant_id: str,
        message: str,
        history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Send a message to the AI assistant with restaurant context.

        Args:
            user_id: The authenticated user's ID
            restaurant_id: The restaurant UUID for context
            message: The user's message
            history: Optional list of previous messages, each with 'role' and 'content'

        Returns:
            Dict with success status, response text, and suggested follow-up questions
        """
        if not self.ready:
            return {
                "success": False,
                "error": "AI Assistant is not configured. Please set the GOOGLE_API_KEY environment variable."
            }

        if not message or not message.strip():
            return {
                "success": False,
                "error": "Message cannot be empty."
            }

        try:
            # Build restaurant context
            restaurant_context = self._get_restaurant_context(restaurant_id)

            # Compose the full prompt with system instructions and context
            full_system_prompt = (
                f"{SYSTEM_PROMPT}\n\n"
                f"--- Restaurant Context ---\n"
                f"{restaurant_context}\n"
                f"--- End Context ---"
            )

            model = genai.GenerativeModel(
                MODEL_NAME,
                system_instruction=full_system_prompt,
                generation_config={
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "top_k": 40,
                    "max_output_tokens": 1024,
                }
            )

            # Build conversation history for Gemini
            chat_history = []
            if history:
                for entry in history:
                    role = entry.get('role', 'user')
                    content = entry.get('content', '')
                    if not content:
                        continue
                    # Gemini uses 'user' and 'model' roles
                    gemini_role = 'model' if role in ('assistant', 'model') else 'user'
                    chat_history.append({
                        "role": gemini_role,
                        "parts": [content]
                    })

            # Start chat with history
            chat = model.start_chat(history=chat_history)
            response = chat.send_message(message)

            response_text = response.text.strip()

            # Generate follow-up suggestions
            suggestions = self._generate_suggestions(message, response_text)

            return {
                "success": True,
                "response": response_text,
                "suggestions": suggestions
            }

        except Exception as e:
            print(f"AI Assistant chat error: {str(e)}")
            traceback.print_exc()
            return {
                "success": False,
                "error": f"Failed to get AI response: {str(e)}"
            }

    def _generate_suggestions(self, user_message: str, ai_response: str) -> List[str]:
        """
        Generate contextual follow-up question suggestions.

        Args:
            user_message: The user's original message
            ai_response: The AI's response

        Returns:
            List of 2-3 suggested follow-up questions
        """
        try:
            model = genai.GenerativeModel(
                MODEL_NAME,
                generation_config={
                    "temperature": 0.8,
                    "max_output_tokens": 256,
                }
            )

            prompt = (
                f"Based on this restaurant management conversation, suggest exactly 3 brief follow-up questions "
                f"the user might want to ask next. Return ONLY a JSON array of strings, nothing else.\n\n"
                f"User asked: {user_message[:200]}\n"
                f"Assistant replied: {ai_response[:300]}\n\n"
                f"JSON array of 3 follow-up questions:"
            )

            response = model.generate_content(prompt)
            text = response.text.strip()

            # Clean markdown code blocks if present
            if '```json' in text:
                text = text.split('```json')[1].split('```')[0]
            elif '```' in text:
                text = text.split('```')[1].split('```')[0]

            suggestions = json.loads(text.strip())

            if isinstance(suggestions, list) and len(suggestions) > 0:
                return suggestions[:3]

        except Exception as e:
            print(f"Failed to generate suggestions: {str(e)}")

        # Fallback suggestions
        return [
            "Can you write a description for my best-selling item?",
            "What pricing strategy do you recommend?",
            "Suggest a new menu item for my restaurant."
        ]

    def get_analytics_summary(
        self,
        restaurant_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Generate an AI-powered analytics summary with insights and recommendations.

        Queries recent order data from Supabase and uses Gemini to produce
        a natural language summary with actionable business insights.

        Args:
            restaurant_id: The restaurant UUID
            days: Number of days to analyze (default: 30)

        Returns:
            Dict with success status, summary text, insights list, and recommendations list
        """
        if not self.ready:
            return {
                "success": False,
                "error": "AI Assistant is not configured. Please set the GOOGLE_API_KEY environment variable."
            }

        if not self.supabase:
            return {
                "success": False,
                "error": "Database connection is not available."
            }

        try:
            start_date = (datetime.now() - timedelta(days=days)).isoformat()

            # Fetch orders for the period
            orders_response = self.supabase.table('orders').select(
                'id, total_price, status, service_type, created_at'
            ).eq(
                'restaurant_id', restaurant_id
            ).gte(
                'created_at', start_date
            ).execute()

            orders = orders_response.data if orders_response.data else []

            # Exclude cancelled/voided orders for revenue calculations
            active_statuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'pending_payment', 'verifying_payment']
            active_orders = [o for o in orders if o.get('status') in active_statuses]
            completed_orders = [o for o in orders if o.get('status') in ['completed', 'ready']]

            # Basic metrics
            total_orders = len(active_orders)
            total_revenue = sum(o.get('total_price', 0) for o in completed_orders)
            avg_order_value = total_revenue / len(completed_orders) if completed_orders else 0

            # Service type breakdown
            service_breakdown: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"count": 0, "revenue": 0})
            for order in completed_orders:
                stype = order.get('service_type', 'dine_in')
                service_breakdown[stype]["count"] += 1
                service_breakdown[stype]["revenue"] += order.get('total_price', 0)

            # Status breakdown
            status_counts: Dict[str, int] = defaultdict(int)
            for order in orders:
                status_counts[order.get('status', 'unknown')] += 1

            # Fetch popular items via order_items
            order_ids = [o.get('id') for o in completed_orders if o.get('id')]
            popular_items: List[Dict[str, Any]] = []

            if order_ids:
                # Supabase .in_() has a practical limit; batch if needed
                batch_size = 100
                item_counts: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"quantity": 0, "revenue": 0})

                for i in range(0, len(order_ids), batch_size):
                    batch_ids = order_ids[i:i + batch_size]
                    items_response = self.supabase.table('order_items').select(
                        'menu_item_name, quantity, price'
                    ).in_(
                        'order_id', batch_ids
                    ).execute()

                    if items_response.data:
                        for item in items_response.data:
                            name = item.get('menu_item_name', 'Unknown')
                            qty = item.get('quantity', 1)
                            price = item.get('price', 0)
                            item_counts[name]["quantity"] += qty
                            item_counts[name]["revenue"] += price * qty

                # Sort by quantity sold
                popular_items = sorted(
                    [
                        {"name": name, "quantity": data["quantity"], "revenue": round(data["revenue"], 2)}
                        for name, data in item_counts.items()
                    ],
                    key=lambda x: x["quantity"],
                    reverse=True
                )[:10]

            # Daily order counts for trend
            daily_orders: Dict[str, int] = defaultdict(int)
            for order in completed_orders:
                date_str = order.get('created_at', '')[:10]
                if date_str:
                    daily_orders[date_str] += 1

            # Build the analytics data payload for Gemini
            analytics_data = {
                "period_days": days,
                "total_orders": total_orders,
                "completed_orders": len(completed_orders),
                "total_revenue_nzd": round(total_revenue, 2),
                "average_order_value_nzd": round(avg_order_value, 2),
                "service_type_breakdown": {
                    stype: {"orders": data["count"], "revenue_nzd": round(data["revenue"], 2)}
                    for stype, data in service_breakdown.items()
                },
                "order_status_breakdown": dict(status_counts),
                "top_selling_items": popular_items[:5],
                "daily_order_counts": dict(sorted(daily_orders.items())[-7:]),  # Last 7 days with data
            }

            # Send to Gemini for natural language summary
            model = genai.GenerativeModel(
                MODEL_NAME,
                generation_config={
                    "temperature": 0.5,
                    "top_p": 0.9,
                    "max_output_tokens": 1024,
                }
            )

            prompt = (
                f"You are a restaurant business analyst. Analyze this order data for a New Zealand restaurant "
                f"and provide a concise business summary.\n\n"
                f"Data (last {days} days):\n"
                f"{json.dumps(analytics_data, indent=2)}\n\n"
                f"Respond in EXACTLY this JSON format (no markdown, no code blocks):\n"
                f'{{\n'
                f'  "summary": "A 2-3 sentence natural language overview of the business performance",\n'
                f'  "insights": ["insight 1", "insight 2", "insight 3"],\n'
                f'  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]\n'
                f'}}\n\n'
                f"Requirements:\n"
                f"- Summary should mention revenue, order volume, and notable trends\n"
                f"- Insights should highlight patterns, strengths, or concerns in the data\n"
                f"- Recommendations should be specific, actionable steps to improve the business\n"
                f"- All monetary values in NZD\n"
                f"- Keep each insight and recommendation to one sentence"
            )

            response = model.generate_content(prompt)
            response_text = response.text.strip()

            # Parse the JSON response
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0]
            elif '```' in response_text:
                response_text = response_text.split('```')[1].split('```')[0]

            parsed = json.loads(response_text.strip())

            return {
                "success": True,
                "summary": parsed.get("summary", "No summary available."),
                "insights": parsed.get("insights", []),
                "recommendations": parsed.get("recommendations", []),
                "raw_metrics": {
                    "total_orders": total_orders,
                    "total_revenue": round(total_revenue, 2),
                    "average_order_value": round(avg_order_value, 2),
                    "period_days": days,
                    "top_items": popular_items[:5],
                    "service_breakdown": {
                        stype: {"orders": data["count"], "revenue": round(data["revenue"], 2)}
                        for stype, data in service_breakdown.items()
                    }
                }
            }

        except json.JSONDecodeError as e:
            print(f"AI Assistant analytics JSON parse error: {str(e)}")
            # Return raw metrics even if AI summary fails
            return {
                "success": True,
                "summary": f"Over the last {days} days, the restaurant processed {total_orders} orders with ${total_revenue:.2f} NZD in revenue.",
                "insights": ["AI-generated insights are temporarily unavailable."],
                "recommendations": ["Try again later for detailed AI recommendations."],
                "raw_metrics": {
                    "total_orders": total_orders,
                    "total_revenue": round(total_revenue, 2),
                    "average_order_value": round(avg_order_value, 2),
                    "period_days": days,
                }
            }

        except Exception as e:
            print(f"AI Assistant analytics error: {str(e)}")
            traceback.print_exc()
            return {
                "success": False,
                "error": f"Failed to generate analytics summary: {str(e)}"
            }


# Module-level singleton instance
ai_assistant_service = AIAssistantService()
