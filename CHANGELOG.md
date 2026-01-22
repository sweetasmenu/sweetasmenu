# Changelog - Smart Menu for Thai Restaurant NZ

All notable changes to this project will be documented in this file.

---

## [2026-01-22] - Version 1.5.0

### New Features

#### 1. Daily Sales Summary with Print Function
- **Location**: Order Summary page (`/dashboard/order-summary`)
- **Button**: "Print Summary" (orange button, available to all users)
- **Features**:
  - Print-ready receipt format (80mm thermal printer compatible)
  - Shows Order Summary (total, paid, pending, voided)
  - Shows Payment Methods breakdown with count and revenue
  - Shows Service Types breakdown (Dine In, Pickup, Delivery)
  - Shows Revenue breakdown (Gross, GST 15%, Net, Total)
- **How to use**:
  1. Go to Dashboard > Orders
  2. Select date range
  3. Click "Print Summary" button
  4. Print dialog will open automatically

#### 2. Bilingual Order Status Page
- **Location**: `/order-status/[order_id]`
- **Supported Languages**: English, Thai, Korean, Chinese, Japanese
- **Features**:
  - All text now displays in customer's selected language
  - Language is passed from menu page through payment to order status
  - Includes: status messages, labels, buttons, timeline

### Bug Fixes

#### 1. Cart Quantity Not Updating
- **Problem**: When selecting quantity > 1 in item modal and clicking "Add to Cart", cart showed only 1 item
- **Root Cause**: `handleAddToCart` was calling `onAddToCart` in a loop instead of passing quantity directly
- **Solution**: Modified to pass quantity as parameter directly to `addToCart` function
- **Files Changed**:
  - `webapp/app/restaurant/[id]/page.tsx`

#### 2. Payment Methods Count Showing 0
- **Problem**: Payment Methods card in Order Summary showed 0 for all methods
- **Root Cause**: Backend was counting only `paid` orders, but most orders were `processing` or `pending`
- **Solution**: Changed to count all non-voided orders (not just paid)
- **Files Changed**:
  - `backend/services/orders_service.py`
  - `webapp/app/dashboard/order-summary/page.tsx`

#### 3. Service Types Count Not Displaying
- **Problem**: Service Types card showed 0 for all types
- **Solution**: Same fix as Payment Methods - count all orders
- **Files Changed**:
  - `backend/services/orders_service.py`

### Changes

#### 1. "Back to Home" Changed to "Back to Menu"
- **Location**: Order Status page
- **Change**: Button now says "Back to Menu" and links to restaurant menu page instead of home
- **Benefit**: Customers can easily order more or check other orders

#### 2. Added Cash Payment Method Support
- **Location**: Order Summary page
- **Change**: Now tracks and displays Cash payment method in summary
- **Files Changed**:
  - `backend/services/orders_service.py`
  - `webapp/app/dashboard/order-summary/page.tsx`

#### 3. Language Parameter Flow
- **Change**: Language selection now passes through entire order flow
- **Flow**: Restaurant Menu → Payment Page → Order Status Page
- **Files Changed**:
  - `webapp/app/restaurant/[id]/page.tsx`
  - `webapp/app/payment/[order_id]/page.tsx`
  - `webapp/app/order-status/[order_id]/page.tsx`

---

## [2026-01-21] - Version 1.4.0

### Bug Fixes

#### 1. Kitchen Start Button Not Working
- **Problem**: Clicking "Start" button on kitchen page did not update order status
- **Solution**: Added immediate local state update and proper error handling
- **Files Changed**:
  - `webapp/app/pos/kitchen/page.tsx`

#### 2. Category Translation Issues
- **Problem**: Korean category translations had markdown artifacts like "**국수**"
- **Solution**: Added `cleanTranslation()` helper and deleted corrupted Korean translations
- **Files Changed**:
  - Database: `menu_translations` table

#### 3. User Data Mixing Between Accounts
- **Problem**: When switching accounts, previous user's restaurant data appeared
- **Solution**: Scoped localStorage keys per userId and clear on logout
- **Files Changed**:
  - `webapp/components/AuthProvider.tsx`
  - `webapp/app/dashboard/page.tsx`
  - `webapp/app/dashboard/settings/restaurants/page.tsx`
  - `webapp/app/dashboard/order-summary/page.tsx`

### Changes

#### 1. Settings Page Made Bilingual
- Added Thai translations for all settings options

---

## How to Use This Document

### For Developers
- Check this file before starting work to understand recent changes
- Update this file after completing any feature/fix
- Include: what changed, why, which files, and how to use (if applicable)

### For Project Managers
- Review weekly to track progress
- Use version numbers for release planning

### Format Guidelines
```markdown
## [DATE] - Version X.X.X

### New Features
#### Feature Name
- **Location**: Where in the app
- **Features**: What it does
- **How to use**: Step by step

### Bug Fixes
#### Bug Name
- **Problem**: What was wrong
- **Root Cause**: Why it happened
- **Solution**: How it was fixed
- **Files Changed**: List of files

### Changes
#### Change Name
- **Location**: Where in the app
- **Change**: What was modified
- **Benefit**: Why this helps
```
