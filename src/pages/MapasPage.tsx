import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { MapCanvas, ChipRows, HoverPreviewCard, MapTabs, MapsHeader, MapsToolbar, ResultsPanel, RoutePanel, SplitHandle } from '@/features/mapas/components';
import { MAPS_BY_SECTION, MAP_META, PANEL_DEFAULT_WIDTH, TAXONOMY, T, hasRoute, makeColorFor } from '@/features/mapas/core';
import type { MapItem, MapKey, Section } from '@/features/mapas/core';
import { useMapsData, usePendingGeocode, useMapsFilters, useRoute } from '@/features/mapas/hooks';
import '@/features/mapas/mapas.css';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string) || 'DEMO_MAP_ID';

const HOVER_CLOSE_MS = 160;

function toCsv(items: MapItem[]) {
  const head = [
    'id',
    'nome',
    'categoria',
    'destino',
    'cidade',
    'preco',
    'lat',
    'lng',
    'duracao',
    'docs',
    'estado',
  ];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = items.map((i) =>
    [
      i.id,
      i.name,
      i.cat,
      i.dest,
      i.city,
      i.price,
      i.lat,
      i.lng,
      i.dur ?? '',
      i.docs ?? '',
      i.status ?? '',
    ]
      .map(esc)
      .join(','),
  );
  return [head.join(','), ...rows].join('\n');
}

const MapasPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const initialMap = (params.get('mapa') as MapKey) || 'fses';
  const [map, setMap] = useState<MapKey>(
    ['fses', 'exps', 'prods'].includes(initialMap) ? initialMap : 'fses',
  );
  const section: Section = MAP_META[map].section;

  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_WIDTH);
  const [resizeSignal, setResizeSignal] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [hover, setHover] = useState<{ item: MapItem; x: number; y: number } | null>(
    null,
  );
  const hoverTimer = useRef<number>();

  const { data, isLoading } = useMapsData(map);
  const { data: pendingGeocode } = usePendingGeocode();
  const items = useMemo(() => data ?? [], [data]);

  const categorias = TAXONOMY[map];
  const colorFor = useMemo(() => makeColorFor(categorias), [categorias]);

  const {
    filters,
    patch,
    clear,
    isDirty,
    items: filtered,
    selected,
    selectedId,
    setSelectedId,
    destCount,
    catCount,
  } = useMapsFilters(items);

  const route = useRoute(hasRoute(selected) ? selected.stops : undefined);

  // contagens por tab (só do mapa ativo; os outros ficam a 0 até serem abertos)
  const tabCounts = useMemo(
    () => ({ [map]: items.length }) as Partial<Record<MapKey, number>>,
    [map, items.length],
  );

  useEffect(() => {
    setParams((p) => {
      p.set('mapa', map);
      return p;
    }, { replace: true });
  }, [map, setParams]);

  const settle = useCallback(() => setResizeSignal((n) => n + 1), []);

  const changeMap = useCallback(
    (next: MapKey) => {
      setMap(next);
      clear();
    },
    [clear],
  );

  const changeSection = useCallback(
    (next: Section) => changeMap(MAPS_BY_SECTION[next][0]),
    [changeMap],
  );

  const openHover = useCallback((item: MapItem, x: number, y: number) => {
    window.clearTimeout(hoverTimer.current);
    setHover({ item, x, y });
  }, []);

  const closeHover = useCallback(() => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHover(null), HOVER_CLOSE_MS);
  }, []);

  const keepHover = useCallback(() => {
    window.clearTimeout(hoverTimer.current);
  }, []);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const openDetail = useCallback(
    (item: MapItem) => {
      if (map === 'prods') navigate(`/products/${item.id}`);
      else if (map === 'fses') navigate('/comercial/matriz');
      else navigate('/comercial/suppliers');
    },
    [map, navigate],
  );

  const handleExport = useCallback(() => {
    const blob = new Blob([toCsv(filtered)], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapas-${map}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} linhas exportadas`);
  }, [filtered, map]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('index-drive-fses', {
        body: { mode: 'incremental' },
      });
      if (error) throw error;
      const { error: geoError } = await supabase.functions.invoke(
        'geocode-map-locations',
        { body: { limit: 300 } },
      );
      if (geoError) throw geoError;
      toast.success('Sincronização concluída. A recarregar…');
      window.location.reload();
    } catch (e) {
      toast.error(
        `Falha na sincronização: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSyncing(false);
    }
  }, []);

  if (!API_KEY) {
    return (
      <AppLayout>
        <div className="p-6 text-sm text-muted-foreground">
          <strong className="text-foreground">
            VITE_GOOGLE_MAPS_API_KEY não está definida.
          </strong>
          <p className="mt-1">
            Adiciona a chave nos secrets do projeto para carregar os mapas.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <APIProvider apiKey={API_KEY} libraries={['marker', 'routes']}>
        <div
          className="mapas-root"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 0px)',
            overflow: 'hidden',
            background: T.grad.page,
          }}
        >
          <div style={{ background: T.grad.header, flex: 'none' }}>
            <MapsHeader
              section={section}
              subtitle={MAP_META[map].subtitle}
              syncing={syncing}
              onSection={changeSection}
              onExport={handleExport}
              onSync={handleSync}
            />
            <MapTabs
              maps={MAPS_BY_SECTION[section]}
              active={map}
              counts={tabCounts}
              onChange={changeMap}
            />
            <MapsToolbar
              filters={filters}
              placeholder={MAP_META[map].placeholder}
              isDirty={isDirty}
              onPatch={patch}
              onClear={clear}
            />
            <ChipRows
              categorias={categorias}
              dest={filters.dest}
              cat={filters.cat}
              destCount={destCount}
              catCount={catCount}
              onDest={(dest) => patch({ dest })}
              onCat={(cat) => patch({ cat })}
            />
            {!!pendingGeocode && (
              <p
                style={{
                  margin: 0,
                  padding: '0 28px 12px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: T.muted,
                }}
              >
                {pendingGeocode} registos ainda sem coordenadas — corre
                “Sincronizar do Drive” para os geocodificar.
              </p>
            )}
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            <ResultsPanel
              width={panelWidth}
              items={filtered}
              map={map}
              loading={isLoading}
              selectedId={selectedId}
              colorFor={colorFor}
              onSelect={(item) => setSelectedId(item.id)}
              onHover={openHover}
              onHoverEnd={closeHover}
            />

            <SplitHandle
              width={panelWidth}
              onResize={setPanelWidth}
              onToggle={() => {
                setPanelWidth((w) => (w === 0 ? PANEL_DEFAULT_WIDTH : 0));
                window.setTimeout(settle, 200);
              }}
              onSettle={settle}
            />

            <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
              <MapCanvas
                mapId={MAP_ID}
                items={filtered}
                categorias={categorias}
                selected={selected}
                route={route}
                colorFor={colorFor}
                onSelect={(item) => setSelectedId(item.id)}
                onHover={openHover}
                onHoverEnd={closeHover}
                resizeSignal={resizeSignal}
              />

              {hasRoute(selected) && (
                <RoutePanel
                  item={selected}
                  route={route}
                  onClear={() => setSelectedId(null)}
                />
              )}
            </div>
          </div>

          {hover && (
            <HoverPreviewCard
              item={hover.item}
              x={hover.x}
              y={hover.y}
              color={colorFor(hover.item.cat)}
              onEnter={keepHover}
              onLeave={closeHover}
              onOpen={openDetail}
            />
          )}
        </div>
      </APIProvider>
    </AppLayout>
  );
};

export default MapasPage;
