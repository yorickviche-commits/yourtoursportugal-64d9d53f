/**
 * Mapas do Back Office — todos os componentes de UI.
 *
 * O tema desta página é local e em hex (constante `T` em ./core), de propósito:
 * é um ecrã de alta fidelidade com paleta própria. NÃO converter para classes
 * Tailwind nem para os tokens HSL do index.css.
 */

import { AdvancedMarker, Map, useMap } from '@vis.gl/react-google-maps';
import { Download, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapItem, MapKey, MapsFilters, RouteInfo, Section, Stop } from './core';
import { DESTINOS, FOCUS_ZOOM, MAP_META, PANEL_MAX_WIDTH, PANEL_SNAP_WIDTH, PRECOS, PT_CENTER, PT_ZOOM, ROUTE_LINES, SECTION_TABS, T, TODAS_CATEGORIAS, TODOS_DESTINOS, boundsOf, clampPreview, hasRoute, iconFor } from './core';

// ─── components/MapsHeader.tsx ─────────────────────────────────

interface MapsHeaderProps {
  section: Section;
  subtitle: string;
  syncing?: boolean;
  onSection: (s: Section) => void;
  onExport: () => void;
  onSync: () => void;
}

export function MapsHeader({
  section,
  subtitle,
  syncing,
  onSection,
  onExport,
  onSync,
}: MapsHeaderProps) {
  const title =
    section === 'sup'
      ? 'Mapas · Suppliers & FSEs'
      : 'Mapas · Catálogo Produtos YT';

  return (
    <header style={{ padding: '22px 28px 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span
              aria-hidden
              style={{
                width: 9,
                height: 24,
                borderRadius: 99,
                background: T.grad.titleBar,
                flex: 'none',
              }}
            />
            <h1
              style={{
                fontSize: 27,
                fontWeight: 800,
                letterSpacing: '-.5px',
                color: T.text,
                margin: 0,
              }}
            >
              {title}
            </h1>
          </div>
          <p
            style={{
              margin: '4px 0 0 18px',
              fontSize: 13.5,
              fontWeight: 400,
              color: T.muted,
            }}
          >
            {subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 9, flex: 'none' }}>
          <button
            type="button"
            onClick={onExport}
            className="mapas-btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 36,
              padding: '0 14px',
              background: '#fff',
              border: `1px solid ${T.border2}`,
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              color: T.text2,
              cursor: 'pointer',
            }}
          >
            <Download size={14} />
            Exportar CSV
          </button>

          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="mapas-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 36,
              padding: '0 14px',
              background: T.grad.primaryBtn,
              border: 'none',
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              boxShadow: T.shadow.btn,
              cursor: syncing ? 'progress' : 'pointer',
              opacity: syncing ? 0.75 : 1,
            }}
          >
            <RefreshCw
              size={14}
              style={{
                animation: syncing ? 'mapas-spin 1s linear infinite' : undefined,
              }}
            />
            Sincronizar do Drive
          </button>
        </div>
      </div>

      <nav
        style={{
          display: 'flex',
          gap: 26,
          marginTop: 16,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        {SECTION_TABS.map((tab) => {
          const active = tab.key === section;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSection(tab.key)}
              style={{
                padding: '0 0 10px',
                background: 'none',
                border: 'none',
                borderBottom: `2.5px solid ${active ? T.primary : 'transparent'}`,
                marginBottom: -1,
                fontSize: 13.5,
                fontWeight: 700,
                color: active ? T.text : T.faint,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

// ─── components/MapTabs.tsx ────────────────────────────────────

interface MapTabsProps {
  maps: MapKey[];
  active: MapKey;
  counts: Partial<Record<MapKey, number>>;
  onChange: (m: MapKey) => void;
}

export function MapTabs({ maps, active, counts, onChange }: MapTabsProps) {
  return (
    <div style={{ padding: '16px 28px 0' }}>
      <div
        role="tablist"
        style={{
          display: 'inline-flex',
          padding: 4,
          gap: 4,
          borderRadius: 11,
          background: T.grad.pills,
          boxShadow: 'inset 0 1px 3px rgba(15,47,86,.12)',
        }}
      >
        {maps.map((key) => {
          const on = key === active;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => onChange(key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: on ? '#fff' : 'transparent',
                boxShadow: on ? T.shadow.pill : 'none',
                fontSize: 13,
                fontWeight: 700,
                color: on ? T.text : T.muted,
                cursor: 'pointer',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: on ? T.primary : '#cbd5e1',
                }}
              />
              {MAP_META[key].label}
              <span style={{ color: T.faint, fontWeight: 700 }}>
                {counts[key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── components/MapsToolbar.tsx ────────────────────────────────

interface MapsToolbarProps {
  filters: MapsFilters;
  placeholder: string;
  isDirty: boolean;
  onPatch: (p: Partial<MapsFilters>) => void;
  onClear: () => void;
}

const fieldStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 10,
  background: '#fff',
  border: `1px solid ${T.border}`,
  fontSize: 13,
  fontWeight: 500,
  color: T.text,
  outline: 'none',
};

export function MapsToolbar({
  filters,
  placeholder,
  isDirty,
  onPatch,
  onClear,
}: MapsToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: '14px 28px 16px',
      }}
    >
      <div style={{ position: 'relative', flex: 1, maxWidth: 460 }}>
        <Search
          size={15}
          color={T.faint}
          style={{
            position: 'absolute',
            left: 13,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        />
        <input
          value={filters.q}
          onChange={(e) => onPatch({ q: e.target.value })}
          placeholder={placeholder}
          aria-label={placeholder}
          style={{ ...fieldStyle, width: '100%', padding: '0 14px 0 36px' }}
        />
      </div>

      <select
        value={filters.preco}
        onChange={(e) => onPatch({ preco: e.target.value })}
        aria-label="Faixa de preço"
        style={{ ...fieldStyle, padding: '0 12px', minWidth: 158 }}
      >
        {PRECOS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onClear}
        disabled={!isDirty}
        className="mapas-clear"
        style={{
          height: 42,
          padding: '0 14px',
          borderRadius: 10,
          border: `1px dashed ${T.border2}`,
          background: 'transparent',
          fontSize: 12.5,
          fontWeight: 600,
          color: T.muted,
          cursor: isDirty ? 'pointer' : 'default',
          opacity: isDirty ? 1 : 0.5,
        }}
      >
        Limpar filtros
      </button>
    </div>
  );
}

// ─── components/ChipRows.tsx ───────────────────────────────────

interface ChipRowsProps {
  categorias: readonly string[];
  dest: string;
  cat: string;
  destCount: (d: string) => number;
  catCount: (c: string) => number;
  onDest: (d: string) => void;
  onCat: (c: string) => void;
}

interface ChipProps {
  label: string;
  count: number;
  icon?: string;
  active: boolean;
  variant: 'dest' | 'cat';
  onClick: () => void;
}

function Chip({ label, count, icon, active, variant, onClick }: ChipProps) {
  const activeBg = variant === 'dest' ? T.grad.chipDest : T.grad.chipCat;
  const activeBorder = variant === 'dest' ? '#12408f' : '#0d2a4d';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="mapas-chip"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 12px',
        borderRadius: 8,
        border: `1px solid ${active ? activeBorder : '#d7e2ef'}`,
        background: active ? activeBg : T.grad.chipOff,
        color: active ? '#fff' : T.text3,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {icon && <span aria-hidden>{icon}</span>}
      {label}
      <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.6 }}>
        {count}
      </span>
    </button>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          width: 74,
          flex: 'none',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '.6px',
          textTransform: 'uppercase',
          color: T.faint,
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'flex',
          gap: 7,
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ChipRows({
  categorias,
  dest,
  cat,
  destCount,
  catCount,
  onDest,
  onCat,
}: ChipRowsProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '0 28px 16px',
      }}
    >
      <Row label="Destino">
        <Chip
          label={TODOS_DESTINOS}
          count={destCount(TODOS_DESTINOS)}
          active={dest === TODOS_DESTINOS}
          variant="dest"
          onClick={() => onDest(TODOS_DESTINOS)}
        />
        {DESTINOS.map((d) => (
          <Chip
            key={d}
            label={d}
            count={destCount(d)}
            active={dest === d}
            variant="dest"
            onClick={() => onDest(d)}
          />
        ))}
      </Row>

      <Row label="Categoria">
        <Chip
          label={TODAS_CATEGORIAS}
          count={catCount(TODAS_CATEGORIAS)}
          active={cat === TODAS_CATEGORIAS}
          variant="cat"
          onClick={() => onCat(TODAS_CATEGORIAS)}
        />
        {categorias.map((c) => (
          <Chip
            key={c}
            label={c}
            icon={iconFor(c)}
            count={catCount(c)}
            active={cat === c}
            variant="cat"
            onClick={() => onCat(c)}
          />
        ))}
      </Row>
    </div>
  );
}

// ─── components/ResultCard.tsx ─────────────────────────────────

interface ResultCardProps {
  item: MapItem;
  color: string;
  selected: boolean;
  onSelect: (item: MapItem) => void;
  onHover: (item: MapItem, x: number, y: number) => void;
  onHoverEnd: () => void;
}

function metaLine(item: MapItem) {
  const parts = [item.city, item.dest];
  if (item.dur) parts.push(item.dur);
  else if (item.docs != null) parts.push(`${item.docs} docs`);
  if (item.status) parts.push(item.status);
  return parts.filter(Boolean).join(' · ');
}

function ResultCardBase({
  item,
  color,
  selected,
  onSelect,
  onHover,
  onHoverEnd,
}: ResultCardProps) {
  const icon = iconFor(item.cat);
  const thumb = item.photos?.[0];

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      onMouseEnter={(e) =>
        onHover(item, e.currentTarget.getBoundingClientRect().right + 12, e.clientY)
      }
      onMouseLeave={onHoverEnd}
      className="mapas-result-card"
      data-selected={selected || undefined}
      style={{
        display: 'flex',
        gap: 12,
        padding: 12,
        width: '100%',
        textAlign: 'left',
        borderRadius: 12,
        border: `1.5px solid ${selected ? T.blueBright : T.border3}`,
        background: selected ? T.grad.cardSel : T.grad.card,
        cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative', flex: 'none' }}>
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: 9,
            background: thumb
              ? `center/cover no-repeat url("${thumb}")`
              : `${color}1a`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 22,
          }}
          aria-hidden
        >
          {!thumb && icon}
        </div>
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 20,
            height: 20,
            borderRadius: 6,
            background: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 11,
            boxShadow: T.shadow.pill,
          }}
        >
          {icon}
        </span>
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.4px',
              color,
              background: `${color}14`,
              borderRadius: 5,
              padding: '2px 6px',
            }}
          >
            {icon} {item.cat}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.priceGreen }}>
            {item.price}
          </span>
          {hasRoute(item) && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.4px',
                color: T.route,
                background: '#e6f0ff',
                borderRadius: 5,
                padding: '2px 5px',
              }}
            >
              rota
            </span>
          )}
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: 13.5,
            fontWeight: 700,
            color: T.text,
            textWrap: 'pretty',
          }}
        >
          {item.name}
        </div>

        <div
          style={{
            marginTop: 3,
            fontSize: 11.5,
            fontWeight: 500,
            color: T.muted,
          }}
        >
          {metaLine(item)}
        </div>
      </div>
    </button>
  );
}

export const ResultCard = memo(ResultCardBase);

// ─── components/ResultsPanel.tsx ───────────────────────────────

interface ResultsPanelProps {
  width: number;
  items: MapItem[];
  map: MapKey;
  loading: boolean;
  selectedId: string | null;
  colorFor: (cat: string) => string;
  onSelect: (item: MapItem) => void;
  onHover: (item: MapItem, x: number, y: number) => void;
  onHoverEnd: () => void;
}

export function ResultsPanel({
  width,
  items,
  map,
  loading,
  selectedId,
  colorFor,
  onSelect,
  onHover,
  onHoverEnd,
}: ResultsPanelProps) {
  const collapsed = width === 0;

  return (
    <aside
      style={{
        width,
        flex: 'none',
        overflow: 'hidden',
        transition: 'width .18s ease',
        display: 'flex',
        flexDirection: 'column',
        background: T.grad.panel,
        borderRight: collapsed ? 'none' : `1px solid ${T.border}`,
        boxShadow: collapsed ? 'none' : T.shadow.rail,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
          padding: '14px 16px 10px',
          borderBottom: `1px solid ${T.border3}`,
          minWidth: 360,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>
          {loading ? '—' : items.length} resultados
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '.4px',
            color: T.faint,
          }}
        >
          {MAP_META[map].label}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          padding: '12px 14px',
          minWidth: 360,
        }}
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 88,
                borderRadius: 12,
                border: `1.5px solid ${T.border3}`,
                background: T.grad.card,
                opacity: 0.6,
              }}
            />
          ))
        ) : items.length === 0 ? (
          <p
            style={{
              padding: '40px 0',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: T.faint,
            }}
          >
            Sem resultados para estes filtros.
          </p>
        ) : (
          items.map((item) => (
            <ResultCard
              key={item.id}
              item={item}
              color={colorFor(item.cat)}
              selected={item.id === selectedId}
              onSelect={onSelect}
              onHover={onHover}
              onHoverEnd={onHoverEnd}
            />
          ))
        )}
      </div>
    </aside>
  );
}

// ─── components/SplitHandle.tsx ────────────────────────────────

interface SplitHandleProps {
  width: number;
  onResize: (w: number) => void;
  onToggle: () => void;
  /** chamado durante o arrasto e no fim da animação de toggle */
  onSettle: () => void;
}

/**
 * Divisória arrastável entre a lista e o mapa.
 * 0–620px; abaixo de 120px colapsa para 0.
 */
export function SplitHandle({ width, onResize, onToggle, onSettle }: SplitHandleProps) {
  const dragging = useRef(false);
  const frame = useRef<number>();

  const onMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current) return;
      const next = Math.min(Math.max(e.clientX - 60, 0), PANEL_MAX_WIDTH);
      onResize(next < PANEL_SNAP_WIDTH ? 0 : next);
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(onSettle);
    },
    [onResize, onSettle],
  );

  const onUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    onSettle();
  }, [onSettle]);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [onMove, onUp]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar painel de resultados"
      className="mapas-handle"
      onMouseDown={() => {
        dragging.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }}
      style={{
        position: 'relative',
        width: 8,
        flex: 'none',
        cursor: 'col-resize',
        background: T.grad.handle,
        borderRight: `1px solid ${T.border2}`,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: 2,
          height: 34,
          borderRadius: 99,
          background: '#9db4cd',
        }}
      />
      <button
        type="button"
        aria-label={width === 0 ? 'Expandir lista' : 'Colapsar lista'}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onToggle}
        style={{
          position: 'absolute',
          left: '50%',
          top: 84,
          transform: 'translateX(-50%)',
          width: 22,
          height: 22,
          borderRadius: 99,
          background: '#fff',
          border: `1px solid ${T.border2}`,
          boxShadow: T.shadow.grip,
          color: T.route,
          fontSize: 13,
          fontWeight: 800,
          lineHeight: 1,
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          zIndex: 2,
        }}
      >
        {width === 0 ? '›' : '‹'}
      </button>
    </div>
  );
}

// ─── components/MapLegend.tsx ──────────────────────────────────

interface MapLegendProps {
  categorias: readonly string[];
  counts: Record<string, number>;
  colorFor: (cat: string) => string;
}

export function MapLegend({ categorias, counts, colorFor }: MapLegendProps) {
  const visible = categorias.filter((c) => (counts[c] ?? 0) > 0);
  if (!visible.length) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 5,
        minWidth: 180,
        padding: '11px 12px',
        borderRadius: 13,
        background: T.grad.glass,
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(18,64,143,.12)',
        boxShadow: T.shadow.panel,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.5px',
          color: T.faint,
          marginBottom: 8,
        }}
      >
        Legenda
      </div>

      <ul style={{ display: 'grid', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
        {visible.map((cat) => {
          const color = colorFor(cat);
          return (
            <li
              key={cat}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  flex: 'none',
                  borderRadius: 6,
                  background: `${color}21`,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 10,
                }}
              >
                {iconFor(cat)}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.text2,
                  whiteSpace: 'nowrap',
                }}
              >
                {cat}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.faint }}>
                {counts[cat]}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── components/MapPin.tsx ─────────────────────────────────────

interface MapPinProps {
  item: MapItem;
  color: string;
  selected: boolean;
  onSelect: (item: MapItem) => void;
  onHover: (item: MapItem, x: number, y: number) => void;
  onHoverEnd: () => void;
}

/** Pin teardrop com emoji, conforme o design (30px, 36px quando selecionado). */
function MapPinBase({
  item,
  color,
  selected,
  onSelect,
  onHover,
  onHoverEnd,
}: MapPinProps) {
  const size = selected ? 36 : 30;

  return (
    <AdvancedMarker
      position={{ lat: item.lat, lng: item.lng }}
      title={item.name}
      zIndex={selected ? 800 : 1}
      onClick={() => onSelect(item)}
    >
      <div
        onMouseEnter={(e) => onHover(item, e.clientX + 16, e.clientY)}
        onMouseLeave={onHoverEnd}
        style={{
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50% 50% 50% 4px',
          transform: 'rotate(-45deg)',
          border: '2px solid #fff',
          boxShadow: T.shadow.pin,
          background: color,
          outline: selected ? '3px solid rgba(26,128,229,.28)' : undefined,
          transition: 'width .15s ease, height .15s ease',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            transform: 'rotate(45deg)',
            fontSize: Math.round(size * 0.46),
            lineHeight: 1,
          }}
        >
          {iconFor(item.cat)}
        </span>
      </div>
    </AdvancedMarker>
  );
}

export const MapPin = memo(MapPinBase);

// ─── components/RouteOverlay.tsx ───────────────────────────────

interface RouteOverlayProps {
  route: RouteInfo | null;
  stops: Stop[];
}

/**
 * Três polylines empilhadas (casing branco → traço navy → tracejado aqua)
 * + marcadores numerados das paragens.
 *
 * As polylines são imperativas porque o @vis.gl não expõe um componente
 * <Polyline>; os marcadores continuam declarativos.
 */
export function RouteOverlay({ route, stops }: RouteOverlayProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || !route?.path.length) return;

    const lines = ROUTE_LINES.map((style) =>
      new google.maps.Polyline({
        map,
        path: route.path,
        clickable: false,
        strokeColor: style.dashed ? undefined : style.color,
        strokeOpacity: style.dashed ? 0 : style.opacity,
        strokeWeight: style.weight,
        zIndex: 400,
        icons: style.dashed
          ? [
              {
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: style.weight / 2,
                  strokeColor: style.color,
                  strokeOpacity: style.opacity,
                  fillColor: style.color,
                  fillOpacity: style.opacity,
                },
                offset: '0',
                repeat: '18px',
              },
            ]
          : undefined,
      }),
    );

    return () => lines.forEach((l) => l.setMap(null));
  }, [map, route]);

  return (
    <>
      {stops.map((stop, i) => (
        <AdvancedMarker
          key={`${stop.label}-${i}`}
          position={{ lat: stop.lat, lng: stop.lng }}
          title={`${i + 1}. ${stop.label}`}
          zIndex={600}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: '#fff',
              border: `3px solid ${T.route}`,
              boxShadow: T.shadow.stop,
              display: 'grid',
              placeItems: 'center',
              fontSize: 11,
              fontWeight: 800,
              color: T.route,
            }}
          >
            {i + 1}
          </div>
        </AdvancedMarker>
      ))}
    </>
  );
}

// ─── components/MapCanvas.tsx ──────────────────────────────────

interface MapCanvasProps {
  mapId: string;
  items: MapItem[];
  categorias: readonly string[];
  selected: MapItem | null;
  route: RouteInfo | null;
  colorFor: (cat: string) => string;
  onSelect: (item: MapItem) => void;
  onHover: (item: MapItem, x: number, y: number) => void;
  onHoverEnd: () => void;
  /** incrementado quando o painel é redimensionado → força resize do mapa */
  resizeSignal: number;
}

/**
 * Câmara: fit aos limites da rota (padding 25%) quando o item selecionado tem
 * itinerário; caso contrário voa até ao pin em zoom 11. Sem seleção, volta ao
 * enquadramento de Portugal.
 */
function Camera({
  selected,
  route,
  itemCount,
  resizeSignal,
}: {
  selected: MapItem | null;
  route: RouteInfo | null;
  itemCount: number;
  resizeSignal: number;
}) {
  const map = useMap();
  const lastFit = useRef<string | null>(null);

  useEffect(() => {
    if (!map) return;
    google.maps.event.trigger(map, 'resize');
  }, [map, resizeSignal]);

  useEffect(() => {
    if (!map) return;

    if (!selected) {
      lastFit.current = null;
      map.panTo(PT_CENTER);
      map.setZoom(PT_ZOOM);
      return;
    }

    const key = `${selected.id}:${route?.path.length ?? 0}`;
    if (lastFit.current === key) return;
    lastFit.current = key;

    if (hasRoute(selected) && route?.path.length) {
      const div = map.getDiv() as HTMLElement;
      const padX = Math.round(div.clientWidth * 0.125);
      const padY = Math.round(div.clientHeight * 0.125);
      map.fitBounds(boundsOf(route.path), {
        top: padY,
        bottom: padY,
        left: padX,
        right: padX,
      });
    } else {
      map.panTo({ lat: selected.lat, lng: selected.lng });
      map.setZoom(FOCUS_ZOOM);
    }
  }, [map, selected, route, itemCount]);

  return null;
}

export function MapCanvas({
  mapId,
  items,
  categorias,
  selected,
  route,
  colorFor,
  onSelect,
  onHover,
  onHoverEnd,
  resizeSignal,
}: MapCanvasProps) {
  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    items.forEach((i) => {
      acc[i.cat] = (acc[i.cat] ?? 0) + 1;
    });
    return acc;
  }, [items]);

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <Map
        mapId={mapId}
        defaultCenter={PT_CENTER}
        defaultZoom={PT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        clickableIcons={false}
        onClick={onHoverEnd}
        style={{ width: '100%', height: '100%', background: T.water }}
      >
        <Camera
          selected={selected}
          route={route}
          itemCount={items.length}
          resizeSignal={resizeSignal}
        />

        {items.map((item) => (
          <MapPin
            key={item.id}
            item={item}
            color={colorFor(item.cat)}
            selected={item.id === selected?.id}
            onSelect={onSelect}
            onHover={onHover}
            onHoverEnd={onHoverEnd}
          />
        ))}

        {hasRoute(selected) && (
          <RouteOverlay route={route} stops={selected.stops ?? []} />
        )}
      </Map>

      <MapLegend categorias={categorias} counts={counts} colorFor={colorFor} />
    </div>
  );
}

// ─── components/RoutePanel.tsx ─────────────────────────────────

interface RoutePanelProps {
  item: MapItem;
  route: RouteInfo | null;
  onClear: () => void;
}

export function RoutePanel({ item, route, onClear }: RoutePanelProps) {
  const stops = item.stops ?? [];

  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        zIndex: 6,
        width: 352,
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(255,255,255,.96)',
        backdropFilter: 'blur(8px)',
        boxShadow: T.shadow.route,
      }}
    >
      <div style={{ height: 4, background: T.grad.routeBar }} />

      <div style={{ padding: '12px 14px 14px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.5px',
              color: T.route,
            }}
          >
            {iconFor(item.cat)} Rota do produto · {item.cat}
          </span>
          <button
            type="button"
            onClick={onClear}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 11,
              fontWeight: 600,
              color: T.muted,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            limpar
          </button>
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 15,
            fontWeight: 800,
            color: T.text,
            textWrap: 'pretty',
          }}
        >
          {item.name}
        </div>

        <div
          style={{
            marginTop: 8,
            display: 'flex',
            gap: 14,
            fontSize: 12,
            fontWeight: 700,
            color: T.route,
          }}
        >
          <span>
            {route ? `${route.km} km` : '—'}
            {route?.approximate && (
              <span
                title="Estimativa — o serviço de direções não respondeu"
                style={{ color: T.faint, fontWeight: 600 }}
              >
                {' '}
                aprox.
              </span>
            )}
          </span>
          <span>{route?.duration ?? item.dur ?? '—'}</span>
          <span>{stops.length} paragens</span>
        </div>

        <div
          style={{
            marginTop: 11,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            maxHeight: 108,
            overflowY: 'auto',
          }}
        >
          {stops.map((stop, i) => (
            <span
              key={`${stop.label}-${i}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px 4px 4px',
                borderRadius: 99,
                background: '#eef4ff',
                border: '1px solid #d9e6ff',
                fontSize: 11.5,
                fontWeight: 600,
                color: T.text2,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: 99,
                  background: T.route,
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 9.5,
                  fontWeight: 800,
                }}
              >
                {i + 1}
              </span>
              {stop.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── components/HoverPreviewCard.tsx ───────────────────────────

interface HoverPreviewCardProps {
  item: MapItem;
  x: number;
  y: number;
  color: string;
  onEnter: () => void;
  onLeave: () => void;
  onOpen: (item: MapItem) => void;
}

const FALLBACK = ['1', '2', '3', '4'];

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.5px',
          color: T.faint,
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 2, fontSize: 12, fontWeight: 600, color: T.text2 }}>
        {value}
      </div>
    </div>
  );
}

export function HoverPreviewCard({
  item,
  x,
  y,
  color,
  onEnter,
  onLeave,
  onOpen,
}: HoverPreviewCardProps) {
  const [slide, setSlide] = useState(0);
  const photos = item.photos?.length ? item.photos.slice(0, 4) : FALLBACK;
  const count = photos.length;

  useEffect(() => setSlide(0), [item.id]);

  const step = (delta: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSlide((s) => (s + delta + count) % count);
  };

  const pos = clampPreview(x, y);

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        width: 404,
        zIndex: 1200,
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${T.border4}`,
        boxShadow: T.shadow.hover,
        background: '#fff',
      }}
    >
      <div style={{ position: 'relative', height: 206, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            height: '100%',
            transform: `translateX(-${slide * 100}%)`,
            transition: 'transform .32s cubic-bezier(.4,0,.2,1)',
          }}
        >
          {photos.map((src, i) => (
            <div
              key={`${item.id}-${i}`}
              style={{
                flex: '0 0 100%',
                height: '100%',
                background: item.photos?.length
                  ? `center/cover no-repeat url("${src}")`
                  : `${color}1f`,
                display: 'grid',
                placeItems: 'center',
                fontSize: 42,
              }}
            >
              {!item.photos?.length && iconFor(item.cat)}
            </div>
          ))}
        </div>

        <span
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            padding: '3px 8px',
            borderRadius: 6,
            background: color,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.4px',
          }}
        >
          {iconFor(item.cat)} {item.cat}
        </span>

        {count > 1 && (
          <>
            <span
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'rgba(15,23,42,.55)',
                color: '#fff',
                fontSize: 10.5,
                fontWeight: 700,
              }}
            >
              {slide + 1} / {count}
            </span>

            <button
              type="button"
              aria-label="Foto anterior"
              onClick={step(-1)}
              className="mapas-gallery-nav"
              style={{ left: 10 }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Foto seguinte"
              onClick={step(1)}
              className="mapas-gallery-nav"
              style={{ right: 10 }}
            >
              ›
            </button>

            <div
              style={{
                position: 'absolute',
                bottom: 10,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              {photos.map((_, i) => (
                <span
                  key={i}
                  style={{
                    height: 6,
                    width: i === slide ? 16 : 6,
                    borderRadius: 99,
                    background:
                      i === slide ? '#fff' : 'rgba(255,255,255,.45)',
                    transition: 'width .25s ease',
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div
        style={{
          padding: '15px 18px 17px',
          background: 'linear-gradient(180deg,#fff,#f5f9fd)',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>
          {item.name}
        </div>

        {item.description && (
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 12.5,
              fontWeight: 500,
              color: T.muted,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.description}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px 14px',
            margin: '12px 0',
            padding: '12px 0',
            borderTop: `1px solid ${T.rule}`,
            borderBottom: `1px solid ${T.rule}`,
          }}
        >
          <Detail label="Destino" value={item.dest} />
          <Detail
            label={item.dur ? 'Duração' : 'Documentos'}
            value={item.dur ?? `${item.docs ?? 0} ficheiros`}
          />
          <Detail label="Faixa de preço" value={item.price} />
          <Detail
            label={item.contact ? 'Contacto' : 'Estado'}
            value={item.contact ?? item.status ?? '—'}
          />
        </div>

        {!!item.tags?.length && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {item.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: '3px 9px',
                  borderRadius: 99,
                  background: T.surface4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.text3,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => onOpen(item)}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 9,
              border: 'none',
              background: T.grad.primaryBtn,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              boxShadow: T.shadow.btn,
              cursor: 'pointer',
            }}
          >
            Abrir ficha completa
          </button>
          {item.driveUrl && (
            <a
              href={item.driveUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 36,
                padding: '0 13px',
                borderRadius: 9,
                border: `1px solid ${T.border2}`,
                background: '#fff',
                fontSize: 13,
                fontWeight: 600,
                color: T.text2,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={13} />
              Drive
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
