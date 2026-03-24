# School Staff Tracker

A comprehensive GPS-verified workforce management system designed for schools to track staff attendance, manage work sessions, handle leave requests, and monitor compliance in real-time.

## 🚀 Features

### Staff Management
- **GPS-Verified Attendance**: Location-based check-in/out with configurable radius validation
- **Work Session Tracking**: Track work periods, breaks, and off-site duties
- **Leave Management**: Submit and approve leave requests with admin oversight
- **Contract Management**: Define expected hours and grace periods per staff member
- **Attendance History**: View personal attendance records and session details

### Admin Dashboard
- **Real-Time Monitoring**: Live attendance tracking with status updates
- **Advanced Analytics**: Comprehensive reporting with filters and exports
- **Staff Administration**: Add, deactivate, and manage staff accounts
- **Calendar Integration**: Track holidays, early closures, and school events
- **Alert System**: Configurable notifications for missed check-ins
- **Manual Overrides**: Admin ability to correct attendance records
- **Data Export**: Excel/CSV export for payroll and reporting

### Security & Compliance
- **Row Level Security**: Database-level access control
- **Rate Limiting**: Prevents abuse of attendance endpoints
- **Location Validation**: Server-side GPS coordinate verification
- **Device Tracking**: Monitor check-in devices and compliance
- **Audit Trail**: Complete history of all attendance modifications

## 🛠 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS + shadcn/ui components
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **State Management**: React Query (TanStack)
- **Charts & Data**: React Big Calendar, XLSX for exports
- **Date Handling**: date-fns
- **Icons**: Lucide React

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Git

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd school-staff-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## 🗄 Database Setup

Run the SQL migrations in your Supabase project in order:

1. Navigate to your Supabase dashboard → SQL Editor
2. Execute each migration file from `supabase/migrations/` in chronological order
3. Or use the setup guide in `SUPABASE_SETUP.md`

Key database components:
- `work_sessions`: Session-based attendance tracking
- `staff_contracts`: Contract hours and grace periods
- `school_calendar`: Holidays and special events
- `leave_requests`: Leave management system
- `location_pings`: Continuous GPS monitoring

## 📖 Usage

### For Staff
1. **Login** with your email and password
2. **Grant GPS Permission** when prompted
3. **Check Distance** to school location
4. **Clock In/Out** for work sessions
5. **Request Leave** through the leave management system
6. **View History** of your attendance records

### For Administrators
1. **Access Admin Dashboard** after login
2. **Monitor Real-Time Attendance** on the analytics page
3. **Manage Staff** accounts and permissions
4. **Configure Settings** (GPS coordinates, radius, alerts)
5. **Approve Leave Requests** and handle overrides
6. **Generate Reports** and export data

## 🏗 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   └── AdminLayout.tsx # Admin navigation
├── contexts/           # React contexts (Auth, Location)
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations
├── lib/                # Utility functions
├── pages/              # Route components
│   ├── admin/          # Admin dashboard pages
│   └── StaffDashboard.tsx
└── App.tsx             # Main app component

supabase/
├── config.toml         # Supabase configuration
├── functions/          # Edge functions
└── migrations/         # Database schema migrations
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests with Vitest

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support, please contact the development team or create an issue in this repository.

## 🔄 Recent Updates

- **Work Session Model**: Replaced simple attendance with flexible session tracking
- **Contract Management**: Added staff-specific contract hours and grace periods
- **Calendar Integration**: School calendar for holidays and special events
- **Continuous GPS Monitoring**: Background location tracking for compliance
- **Advanced Analytics**: Comprehensive reporting and data visualization
- **Alert System**: Configurable notifications for admin oversight
