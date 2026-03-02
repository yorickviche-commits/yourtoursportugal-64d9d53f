import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ItineraryMap from '@/components/itinerary/ItineraryMap';
import { MapPin, ChevronRight, Calendar, Users } from 'lucide-react';

interface ItineraryImage {
  url: string;
  caption: string;
}

interface DayData {
  id: string;
  day_number: number;
  title: string;
  narrative: string;
  description: string;
  highlights: string[];
  inclusions: string[];
  images: ItineraryImage[];
  location_name: string;
  latitude: number | null;
  longitude: number | null;
}

interface ItineraryMeta {
  id: string;
  title: string;
  subtitle: string;
  cover_image_url: string;
  travel_dates: string;
  client_name: string;
}

const ItineraryPreviewPage = () => {
  const { id } = useParams<{ id: string }>();
  const [meta, setMeta] = useState<ItineraryMeta | null>(null);
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const dayRefs = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    loadItinerary();
  }, [id]);

  const loadItinerary = async () => {
    try {
      const { data: itinerary, error: itErr } = await supabase
        .from('itineraries')
        .select('*')
        .eq('id', id)
        .single();

      if (itErr || !itinerary) {
        setError('Itinerário não encontrado');
        setLoading(false);
        return;
      }

      const { data: daysData } = await supabase
        .from('itinerary_days')
        .select('*')
        .eq('itinerary_id', itinerary.id)
        .order('day_number');

      setMeta({
        id: itinerary.id,
        title: itinerary.title,
        subtitle: itinerary.subtitle || '',
        cover_image_url: itinerary.cover_image_url || '',
        travel_dates: itinerary.travel_dates || '',
        client_name: itinerary.client_name || '',
      });

      setDays((daysData || []).map(d => ({
        id: d.id,
        day_number: d.day_number,
        title: d.title || '',
        narrative: d.narrative || '',
        description: d.description || '',
        highlights: d.highlights || [],
        inclusions: d.inclusions || [],
        images: (d.images as any[]) || [],
        location_name: d.location_name || '',
        latitude: d.latitude ? Number(d.latitude) : null,
        longitude: d.longitude ? Number(d.longitude) : null,
      })));

      setActiveDay(1);
    } catch {
      setError('Erro ao carregar itinerário');
    } finally {
      setLoading(false);
    }
  };

  const scrollToDay = (dayNumber: number) => {
    setActiveDay(dayNumber);
    dayRefs.current[dayNumber]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const mapPoints = days
    .filter(d => d.latitude && d.longitude)
    .map(d => ({ lat: d.latitude!, lng: d.longitude!, label: d.title, dayNumber: d.day_number }));

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-lg">A carregar itinerário...</div>
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Itinerário não disponível</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const coverImage = meta.cover_image_url || days[0]?.images?.[0]?.url || 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1920&h=800&fit=crop';

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Sticky navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
          <div className="flex items-center gap-0 min-w-max">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
                !activeDay ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {meta.title.length > 40 ? meta.title.slice(0, 40) + '...' : meta.title}
            </button>
            {days.map(day => (
              <button
                key={day.day_number}
                onClick={() => scrollToDay(day.day_number)}
                className={`px-3 py-3 text-[11px] font-medium uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                  activeDay === day.day_number ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}>
                Day {day.day_number} - {day.title.length > 25 ? day.title.slice(0, 25) + '...' : day.title}
              </button>
            ))}
            <button
              onClick={() => document.getElementById('map-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-3 py-3 text-[11px] font-medium uppercase tracking-wide whitespace-nowrap border-b-2 border-transparent text-gray-400 hover:text-gray-600">
              Map
            </button>
          </div>
        </div>
      </nav>

      {/* Hero section */}
      <section className="relative">
        <div className="relative h-[60vh] min-h-[400px] overflow-hidden">
          <img src={coverImage} alt={meta.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16">
            <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight max-w-3xl">
              {meta.title.toUpperCase()}
            </h1>
            {meta.subtitle && (
              <p className="text-lg md:text-xl text-white/80 mt-3">{meta.subtitle}</p>
            )}
            {meta.travel_dates && (
              <p className="text-sm text-white/60 mt-2 flex items-center gap-1">
                <Calendar className="h-4 w-4" /> {meta.travel_dates}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Summary section */}
      <section className="max-w-4xl mx-auto px-4 py-12 md:px-8">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-1">
            <ChevronRight className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Summary & Day-by-Day</h2>
            <p className="text-sm text-gray-500 mt-1">{days.length} days of curated experiences</p>
          </div>
        </div>

        {/* Day cards overview */}
        <div className="grid gap-3">
          {days.map(day => (
            <button key={day.day_number} onClick={() => scrollToDay(day.day_number)}
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left group">
              {day.images[0]?.url ? (
                <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0">
                  <img src={day.images[0].url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-14 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-400">D{day.day_number}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-600 uppercase">Day {day.day_number}</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{day.title}</p>
                {day.location_name && (
                  <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" /> {day.location_name}
                  </p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </section>

      {/* Day-by-day detailed sections */}
      {days.map(day => (
        <section
          key={day.day_number}
          ref={el => { dayRefs.current[day.day_number] = el; }}
          className="border-t border-gray-100"
        >
          {/* Day hero image */}
          {day.images[0]?.url && (
            <div className="relative h-[40vh] min-h-[300px] overflow-hidden">
              <img src={day.images[0].url} alt={day.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
                <p className="text-sm font-bold text-blue-300 uppercase tracking-wider">Day {day.day_number}</p>
                <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">{day.title}</h2>
                {day.location_name && (
                  <p className="text-sm text-white/70 mt-1 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {day.location_name}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto px-4 py-10 md:px-8">
            {!day.images[0]?.url && (
              <div className="mb-6">
                <p className="text-sm font-bold text-blue-600 uppercase tracking-wider">Day {day.day_number}</p>
                <h2 className="text-2xl font-bold text-gray-900 mt-1">{day.title}</h2>
                {day.location_name && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3" /> {day.location_name}
                  </p>
                )}
              </div>
            )}

            {/* Narrative */}
            {day.narrative && (
              <div className="prose prose-gray max-w-none mb-8">
                <p className="text-base text-gray-700 leading-relaxed whitespace-pre-wrap">{day.narrative}</p>
              </div>
            )}

            {/* Image gallery */}
            {day.images.length > 1 && (
              <div className="grid grid-cols-2 gap-3 mb-8">
                {day.images.slice(1).map((img, i) => (
                  <div key={i} className="rounded-xl overflow-hidden">
                    <img src={img.url} alt={img.caption || day.title} className="w-full h-48 md:h-56 object-cover" />
                    {img.caption && (
                      <p className="text-[11px] text-gray-400 mt-1 px-1">{img.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Highlights */}
            {day.highlights.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">Highlights</h3>
                <div className="flex flex-wrap gap-2">
                  {day.highlights.map((h, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                      ✨ {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Inclusions */}
            {day.inclusions.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wide">What's Included</h3>
                <ul className="space-y-2">
                  {day.inclusions.map((inc, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{inc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      ))}

      {/* Map section */}
      {mapPoints.length > 0 && (
        <section id="map-section" className="border-t border-gray-100 py-12">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Your Journey Map</h2>
            <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100">
              <ItineraryMap points={mapPoints} className="h-[500px]" />
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-lg font-bold">Your Tours Portugal</h3>
          <p className="text-sm text-gray-400 mt-2">Crafted with care for unforgettable experiences</p>
          <p className="text-xs text-gray-500 mt-4">© {new Date().getFullYear()} Your Tours Portugal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default ItineraryPreviewPage;
