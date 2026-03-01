import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, ImagePlus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export interface ItineraryImage {
  url: string;
  caption: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  description: string;
  images: ItineraryImage[];
  activities?: { time: string; activity: string; details: string; estimatedCost?: number }[];
}

interface EditableItineraryProps {
  days: ItineraryDay[];
  onChange: (days: ItineraryDay[]) => void;
}

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=400&h=260&fit=crop',
  'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&h=260&fit=crop',
  'https://images.unsplash.com/photo-1513735492246-483525079686?w=400&h=260&fit=crop',
];

const EditableItinerary = ({ days, onChange }: EditableItineraryProps) => {
  const [expandedDays, setExpandedDays] = useState<number[]>([days[0]?.day ?? 1]);

  const toggleDay = (day: number) => {
    setExpandedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const updateDay = (index: number, updates: Partial<ItineraryDay>) => {
    const updated = [...days];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const addDay = () => {
    const newDay: ItineraryDay = {
      day: days.length + 1,
      title: '',
      description: '',
      images: [],
    };
    onChange([...days, newDay]);
    setExpandedDays(prev => [...prev, newDay.day]);
  };

  const removeDay = (index: number) => {
    const updated = days.filter((_, i) => i !== index).map((d, i) => ({ ...d, day: i + 1 }));
    onChange(updated);
  };

  const addImage = (dayIndex: number) => {
    const day = days[dayIndex];
    if (day.images.length >= 3) return;
    const placeholder = PLACEHOLDER_IMAGES[day.images.length] || PLACEHOLDER_IMAGES[0];
    const updated = [...days];
    updated[dayIndex] = { ...day, images: [...day.images, { url: placeholder, caption: '' }] };
    onChange(updated);
  };

  const removeImage = (dayIndex: number, imgIndex: number) => {
    const updated = [...days];
    updated[dayIndex] = { ...updated[dayIndex], images: updated[dayIndex].images.filter((_, i) => i !== imgIndex) };
    onChange(updated);
  };

  const updateImage = (dayIndex: number, imgIndex: number, updates: Partial<ItineraryImage>) => {
    const updated = [...days];
    const images = [...updated[dayIndex].images];
    images[imgIndex] = { ...images[imgIndex], ...updates };
    updated[dayIndex] = { ...updated[dayIndex], images };
    onChange(updated);
  };

  return (
    <div className="bg-card rounded-lg border">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold">Itinerary</h2>
        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={addDay}>
          <Plus className="h-3 w-3" /> Adicionar Dia
        </Button>
      </div>

      <div className="divide-y">
        {days.map((day, dayIndex) => {
          const expanded = expandedDays.includes(day.day);
          return (
            <div key={dayIndex}>
              {/* Day header row */}
              <button
                onClick={() => toggleDay(day.day)}
                className="w-full flex items-center gap-3 p-3 px-4 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[hsl(var(--info))] text-white text-xs font-bold shrink-0">
                  {day.day}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {day.title || <span className="text-muted-foreground italic">Sem título</span>}
                  </p>
                  {!expanded && day.description && (
                    <p className="text-xs text-muted-foreground truncate">{day.description}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{day.images.length}/3 imgs</span>
                {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>

              {expanded && (
                <div className="px-4 pb-4 space-y-4">
                  {/* Title input */}
                  <Input
                    className="text-sm font-medium"
                    value={day.title}
                    onChange={e => updateDay(dayIndex, { title: e.target.value })}
                    placeholder="Título do dia..."
                  />

                  {/* Description textarea */}
                  <Textarea
                    className="text-xs min-h-[80px]"
                    value={day.description}
                    onChange={e => updateDay(dayIndex, { description: e.target.value })}
                    placeholder="Descrição do dia..."
                  />

                  {/* Activities (if any from AI) */}
                  {day.activities && day.activities.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase">Atividades</p>
                      {day.activities.map((act, j) => (
                        <div key={j} className="pl-3 border-l-2 border-border space-y-1">
                          <div className="flex gap-2">
                            <Input
                              className="h-7 text-xs w-20"
                              value={act.time}
                              onChange={e => {
                                const acts = [...(day.activities || [])];
                                acts[j] = { ...acts[j], time: e.target.value };
                                updateDay(dayIndex, { activities: acts });
                              }}
                              placeholder="09:00"
                            />
                            <Input
                              className="h-7 text-xs flex-1"
                              value={act.activity}
                              onChange={e => {
                                const acts = [...(day.activities || [])];
                                acts[j] = { ...acts[j], activity: e.target.value };
                                updateDay(dayIndex, { activities: acts });
                              }}
                              placeholder="Atividade..."
                            />
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                              const acts = (day.activities || []).filter((_, i) => i !== j);
                              updateDay(dayIndex, { activities: acts });
                            }}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <Input
                            className="h-7 text-xs"
                            value={act.details}
                            onChange={e => {
                              const acts = [...(day.activities || [])];
                              acts[j] = { ...acts[j], details: e.target.value };
                              updateDay(dayIndex, { activities: acts });
                            }}
                            placeholder="Detalhes..."
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Images section */}
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-2">3 Imagens do Dia</p>
                    <div className="grid grid-cols-3 gap-3">
                      {day.images.map((img, imgIndex) => (
                        <div key={imgIndex} className="relative group">
                          <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted border">
                            <img src={img.url} alt={img.caption} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                          </div>
                          <button
                            onClick={() => removeImage(dayIndex, imgIndex)}
                            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <Input
                            className="h-6 text-[10px] mt-1"
                            value={img.caption}
                            onChange={e => updateImage(dayIndex, imgIndex, { caption: e.target.value })}
                            placeholder="Legenda..."
                          />
                          <Input
                            className="h-6 text-[10px] mt-0.5"
                            value={img.url}
                            onChange={e => updateImage(dayIndex, imgIndex, { url: e.target.value })}
                            placeholder="URL da imagem..."
                          />
                        </div>
                      ))}
                      {day.images.length < 3 && (
                        <button
                          onClick={() => addImage(dayIndex)}
                          className="aspect-[4/3] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                        >
                          <ImagePlus className="h-6 w-6 mb-1" />
                          <span className="text-[10px]">Adicionar Imagem</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Remove day */}
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="text-xs text-destructive gap-1" onClick={() => removeDay(dayIndex)}>
                      <Trash2 className="h-3 w-3" /> Remover Dia
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EditableItinerary;
