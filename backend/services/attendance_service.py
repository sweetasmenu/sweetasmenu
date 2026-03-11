"""
Staff Attendance Service - QR-based clock-in/clock-out
"""
import os
import hmac
import hashlib
from typing import Optional, Dict, Any, List
from datetime import date, datetime, timezone
from dotenv import load_dotenv
import pathlib

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

from services.staff_service import staff_service

# Load environment variables
env_path = pathlib.Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=str(env_path))
else:
    load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')
ATTENDANCE_QR_SECRET = os.getenv('ATTENDANCE_QR_SECRET', 'smartmenu-attendance-default-secret')


class AttendanceService:
    """Service for staff QR-based attendance tracking"""

    def __init__(self):
        self.supabase_client: Optional[Client] = None
        if SUPABASE_AVAILABLE and SUPABASE_URL and SUPABASE_KEY:
            try:
                self.supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
                print("AttendanceService: Supabase client initialized")
            except Exception as e:
                print(f"AttendanceService: Failed to initialize: {str(e)}")

    def generate_daily_token(self, restaurant_id: str) -> str:
        """Generate a daily HMAC token for QR code anti-fraud"""
        day_str = date.today().isoformat()
        message = f"{restaurant_id}:{day_str}"
        token = hmac.new(
            ATTENDANCE_QR_SECRET.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()[:16]
        return token

    def verify_daily_token(self, restaurant_id: str, token: str) -> bool:
        """Verify that a daily token is valid for today"""
        expected = self.generate_daily_token(restaurant_id)
        return hmac.compare_digest(expected, token)

    def clock_in(self, restaurant_id: str, pin_code: str) -> Optional[Dict[str, Any]]:
        """
        Clock in a staff member by PIN code.

        Returns dict with record info, or None if PIN invalid.
        May include 'already_clocked_in': True if already clocked in today.
        """
        if not self.supabase_client:
            return None

        try:
            # Verify PIN to identify staff
            staff = staff_service.verify_pin(restaurant_id, pin_code)
            if not staff:
                return None

            staff_id = staff['id']
            staff_name = staff.get('name', 'Unknown')
            today_str = date.today().isoformat()

            # Check if already clocked in today (open record)
            existing = self.supabase_client.table('staff_attendance').select('id, clock_in').eq(
                'staff_id', staff_id
            ).eq(
                'date', today_str
            ).is_('clock_out', 'null').limit(1).execute()

            if existing.data and len(existing.data) > 0:
                return {
                    'already_clocked_in': True,
                    'staff_name': staff_name,
                    'staff_id': staff_id,
                    'clock_in': existing.data[0]['clock_in']
                }

            # Create new attendance record
            record = {
                'staff_id': staff_id,
                'restaurant_id': restaurant_id,
                'date': today_str,
            }

            result = self.supabase_client.table('staff_attendance').insert(record).execute()

            if result.data and len(result.data) > 0:
                # Log activity
                staff_service.log_activity(
                    staff_id=staff_id,
                    restaurant_id=restaurant_id,
                    action='clock_in',
                    description=f'{staff_name} clocked in',
                )
                return {
                    'staff_name': staff_name,
                    'staff_id': staff_id,
                    'record_id': result.data[0]['id'],
                    'clock_in': result.data[0]['clock_in'],
                }

            return None

        except Exception as e:
            print(f"Failed to clock in: {str(e)}")
            return None

    def clock_out(self, restaurant_id: str, pin_code: str) -> Optional[Dict[str, Any]]:
        """
        Clock out a staff member by PIN code.

        Returns dict with record info, or None if PIN invalid.
        May include 'not_clocked_in': True if no open record found.
        """
        if not self.supabase_client:
            return None

        try:
            # Verify PIN to identify staff
            staff = staff_service.verify_pin(restaurant_id, pin_code)
            if not staff:
                return None

            staff_id = staff['id']
            staff_name = staff.get('name', 'Unknown')

            # Find the most recent open record
            open_record = self.supabase_client.table('staff_attendance').select('id, clock_in').eq(
                'staff_id', staff_id
            ).is_('clock_out', 'null').order(
                'clock_in', desc=True
            ).limit(1).execute()

            if not open_record.data or len(open_record.data) == 0:
                return {
                    'not_clocked_in': True,
                    'staff_name': staff_name,
                    'staff_id': staff_id,
                }

            record = open_record.data[0]
            clock_in_time = datetime.fromisoformat(record['clock_in'].replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            duration = int((now - clock_in_time).total_seconds() / 60)

            # Update the record
            update_result = self.supabase_client.table('staff_attendance').update({
                'clock_out': now.isoformat(),
                'duration_minutes': duration,
            }).eq('id', record['id']).execute()

            if update_result.data and len(update_result.data) > 0:
                # Log activity
                staff_service.log_activity(
                    staff_id=staff_id,
                    restaurant_id=restaurant_id,
                    action='clock_out',
                    description=f'{staff_name} clocked out ({duration} min)',
                )
                return {
                    'staff_name': staff_name,
                    'staff_id': staff_id,
                    'record_id': record['id'],
                    'clock_in': record['clock_in'],
                    'clock_out': update_result.data[0]['clock_out'],
                    'duration_minutes': duration,
                }

            return None

        except Exception as e:
            print(f"Failed to clock out: {str(e)}")
            return None

    def get_records(
        self,
        restaurant_id: str,
        start_date: str,
        end_date: str,
        staff_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get attendance records for a restaurant within a date range"""
        if not self.supabase_client:
            return []

        try:
            query = self.supabase_client.table('staff_attendance').select(
                '*, staff(name, role)'
            ).eq(
                'restaurant_id', restaurant_id
            ).gte(
                'date', start_date
            ).lte(
                'date', end_date
            ).order('date', desc=True).order('clock_in', desc=True)

            if staff_id:
                query = query.eq('staff_id', staff_id)

            result = query.execute()
            return result.data if result.data else []

        except Exception as e:
            print(f"Failed to get attendance records: {str(e)}")
            return []


# Create singleton instance
attendance_service = AttendanceService()
