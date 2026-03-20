/**
 * YOUR TOURS PORTUGAL — Fixed Internal Rate Sheets
 * Source: "Tabela de Preços & Condições - 2026" (FSE Guias Freelancer)
 * Valid: 01/01/2026 – 01/01/2027
 * 
 * These are the INTERNAL NET costs YT pays to freelancer guides.
 * All values include IVA.
 */

// ─── GUIDE RATES (Freelancer) ──────────────────────────
export const GUIDE_RATES = {
  // Guide in YT vehicle (private tours)
  yt_vehicle_fullday: 125, // Full-day (~10h) in YT fleet vehicle

  // Guide + OWN vehicle (private tours, specific routes)
  own_vehicle: {
    douro_vinho_verde_coimbra_aveiro: 265,
    braga_guimaraes_alto_minho_geres: 250,
    santiago_compostela: 275,
    porto_city_fullday: 225,
  },

  // City/local guide (walking tours, bus services)
  city_guide_halfday: 80,  // ~4h, between 07:30-19:30
  city_guide_fullday: 150, // ~10h, between 07:30-19:30

  // Continuous service (multi-day circuits with bus)
  continuous_service_fullday: 180, // FD with 1h meal break included

  // Extras
  extras: {
    meal_allowance: 15,     // Per meal (lunch or dinner)
    night_service: 80,      // 4h between 20:00-02:00
    extra_hour: 20,         // Per extra hour
    displacement: 15,       // Travel to/from service location
    fleet_wash: 4.25,       // Vehicle cleaning (interior + exterior)
  },
} as const;

// ─── COST LAYER CATEGORIES ─────────────────────────────
export type CostLayer = 'transport' | 'guide' | 'experience' | 'accommodation' | 'meal' | 'operational';

export const COST_LAYER_CONFIG: Record<CostLayer, { label: string; color: string; icon: string; order: number }> = {
  transport: { label: 'Transporte', color: 'hsl(var(--info))', icon: '🚐', order: 1 },
  guide: { label: 'Guia', color: 'hsl(var(--success))', icon: '🧑‍🏫', order: 2 },
  experience: { label: 'Experiência', color: 'hsl(var(--warning))', icon: '🍷', order: 3 },
  accommodation: { label: 'Alojamento', color: 'hsl(var(--primary))', icon: '🏨', order: 4 },
  meal: { label: 'Refeição', color: 'hsl(var(--accent))', icon: '🍽️', order: 5 },
  operational: { label: 'Operacional', color: 'hsl(var(--muted-foreground))', icon: '⚙️', order: 6 },
};

/**
 * Determines which guide rate to apply based on route/destination.
 * Used by auto-costing logic.
 */
export function getGuideRate(routeDescription: string, isFullDay: boolean, useOwnVehicle: boolean): number {
  const desc = routeDescription.toLowerCase();

  if (useOwnVehicle) {
    if (desc.includes('douro') || desc.includes('vinho verde') || desc.includes('coimbra') || desc.includes('aveiro')) {
      return GUIDE_RATES.own_vehicle.douro_vinho_verde_coimbra_aveiro;
    }
    if (desc.includes('braga') || desc.includes('guimarães') || desc.includes('guimaraes') || desc.includes('alto-minho') || desc.includes('alto minho') || desc.includes('gerês') || desc.includes('geres')) {
      return GUIDE_RATES.own_vehicle.braga_guimaraes_alto_minho_geres;
    }
    if (desc.includes('santiago') || desc.includes('compostela')) {
      return GUIDE_RATES.own_vehicle.santiago_compostela;
    }
    if (desc.includes('porto')) {
      return GUIDE_RATES.own_vehicle.porto_city_fullday;
    }
    // Default to most common route
    return GUIDE_RATES.own_vehicle.douro_vinho_verde_coimbra_aveiro;
  }

  // Guide in YT vehicle or city guide
  if (isFullDay) {
    return GUIDE_RATES.yt_vehicle_fullday;
  }
  return GUIDE_RATES.city_guide_halfday;
}

/**
 * Builds the guide rate sheet as text context for AI prompts.
 */
export function buildGuideRateContext(): string {
  return `=== YOUR TOURS FIXED GUIDE RATES (NET, IVA incl.) ===
GUIDE IN YT VEHICLE:
• Full-day (~10h): ${GUIDE_RATES.yt_vehicle_fullday}€

GUIDE + OWN VEHICLE (specific routes):
• Douro / Vinho Verde / Coimbra & Aveiro: ${GUIDE_RATES.own_vehicle.douro_vinho_verde_coimbra_aveiro}€
• Braga & Guimarães / Alto-Minho / Gerês: ${GUIDE_RATES.own_vehicle.braga_guimaraes_alto_minho_geres}€
• Santiago de Compostela: ${GUIDE_RATES.own_vehicle.santiago_compostela}€
• Porto City Full-Day: ${GUIDE_RATES.own_vehicle.porto_city_fullday}€

CITY/LOCAL GUIDE:
• Half-day (~4h): ${GUIDE_RATES.city_guide_halfday}€
• Full-day (~10h): ${GUIDE_RATES.city_guide_fullday}€

CONTINUOUS SERVICE (multi-day bus circuits):
• Full-day: ${GUIDE_RATES.continuous_service_fullday}€/day (incl. 1h meal break)

EXTRAS:
• Meal allowance: ${GUIDE_RATES.extras.meal_allowance}€/meal
• Night service (20:00-02:00, 4h): ${GUIDE_RATES.extras.night_service}€
• Extra hour: ${GUIDE_RATES.extras.extra_hour}€/h
• Displacement: ${GUIDE_RATES.extras.displacement}€
• Fleet wash: ${GUIDE_RATES.extras.fleet_wash}€

RULES:
- Full-day = ~10h (07:30-19:30), includes 1h lunch + 20min vehicle cleanup
- Half-day = ~4h (07:30-19:30)
- For multi-day trips (4+ days/3+ nights), use continuous service rate
- Guide meal is ALWAYS an additional cost when guide eats with group
- Night service is additional if activity extends past 20:00`;
}
