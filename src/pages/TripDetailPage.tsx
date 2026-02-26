import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FileText, CheckSquare, Square, MessageSquare } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { mockTrips } from '@/data/mockData';
import { statusConfig, urgencyConfig, budgetLabels } from '@/lib/config';

const checklist = [
  { id: 1, label: 'Hotel reservations confirmed', done: true },
  { id: 2, label: 'Airport transfers booked', done: true },
  { id: 3, label: 'Restaurant reservations made', done: false },
  { id: 4, label: 'Activity tickets purchased', done: false },
  { id: 5, label: 'Travel insurance verified', done: true },
  { id: 6, label: 'Welcome pack prepared', done: false },
];

const mockFiles = [
  { name: 'Itinerary_v2.pdf', type: 'PDF', date: '2026-02-24' },
  { name: 'Hotel_Confirmation.pdf', type: 'PDF', date: '2026-02-22' },
  { name: 'Client_Preferences.docx', type: 'DOC', date: '2026-02-20' },
];

const itineraryDays = [
  { day: 1, title: 'Arrival & City Exploration', description: 'Airport pickup, hotel check-in, walking tour of historic center, welcome dinner.' },
  { day: 2, title: 'Cultural Immersion', description: 'Morning museum visit, traditional cooking class, afternoon free time, fado evening.' },
  { day: 3, title: 'Day Trip', description: 'Full-day excursion with private guide, lunch at local restaurant, return by evening.' },
];

const TripDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const trip = mockTrips.find((t) => t.id === id);

  if (!trip) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Trip not found</p>
          <Link to="/trips" className="text-info text-sm hover:underline mt-2 inline-block">Back to trips</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link to="/trips" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
              <ArrowLeft className="h-3 w-3" /> Back to trips
            </Link>
            <h1 className="text-xl font-semibold">{trip.clientName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {trip.destination} · {trip.pax} pax · {budgetLabels[trip.budgetLevel]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge {...urgencyConfig[trip.urgency]} />
            <StatusBadge {...statusConfig[trip.status]} />
          </div>
        </div>

        {trip.hasBlocker && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
            <span className="text-destructive text-sm">⚠</span>
            <div>
              <p className="text-sm font-medium text-destructive">Blocker</p>
              <p className="text-sm text-destructive/80">{trip.blockerNote}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Main content */}
          <div className="col-span-2 space-y-6">
            {/* Trip Info */}
            <div className="bg-card rounded-lg border p-4">
              <h2 className="text-sm font-semibold mb-3">Trip Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Dates</p>
                  <p className="font-medium">{trip.startDate} → {trip.endDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sales Owner</p>
                  <p className="font-medium">{trip.salesOwner}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Value</p>
                  <p className="font-medium">€{trip.totalValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Trip ID</p>
                  <p className="font-medium">{trip.id}</p>
                </div>
              </div>
            </div>

            {/* Itinerary */}
            <div className="bg-card rounded-lg border p-4">
              <h2 className="text-sm font-semibold mb-3">Itinerary</h2>
              <div className="space-y-3">
                {itineraryDays.map((day) => (
                  <div key={day.day} className="flex gap-3 p-3 rounded-md border hover:bg-muted/30 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                      {day.day}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{day.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{day.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-card rounded-lg border p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Internal Notes
              </h2>
              <p className="text-sm text-muted-foreground">{trip.notes}</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Checklist */}
            <div className="bg-card rounded-lg border p-4">
              <h2 className="text-sm font-semibold mb-3">Operational Checklist</h2>
              <div className="space-y-2">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    {item.done ? (
                      <CheckSquare className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={item.done ? 'text-muted-foreground line-through' : ''}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {checklist.filter((c) => c.done).length}/{checklist.length} completed
              </p>
            </div>

            {/* Linked Files */}
            <div className="bg-card rounded-lg border p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Linked Files
              </h2>
              <div className="space-y-2">
                {mockFiles.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between p-2 rounded-md border text-sm hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">{file.name}</span>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default TripDetailPage;
