import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Button, IconButton, InputAdornment, Link, OutlinedInput, Paper, Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import TipsAndUpdatesRoundedIcon from '@mui/icons-material/TipsAndUpdatesRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import AltRouteRoundedIcon from '@mui/icons-material/AltRouteRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import PageHeader from '../../components/PageHeader';
import { brand } from '../../theme/brand';
import {
  HELP_SECTIONS, HELP_SOURCE, HELP_TASKS,
  type HelpBlock, type HelpIcon, type HelpSection, type HelpShortcut, type HelpTopic,
} from './helpContent';
import { HelpBlockView } from './HelpBlocks';
import { HelpNavContext, normalize, plainText } from './helpNav';

const ICONS: Record<HelpIcon, React.ReactElement> = {
  login: <LoginRoundedIcon fontSize="small" />,
  scan: <PhotoCameraRoundedIcon fontSize="small" />,
  mapset: <LayersRoundedIcon fontSize="small" />,
  tips: <TipsAndUpdatesRoundedIcon fontSize="small" />,
  building: <ApartmentRoundedIcon fontSize="small" />,
  room: <MeetingRoomRoundedIcon fontSize="small" />,
  indoor: <ViewInArRoundedIcon fontSize="small" />,
  outdoor: <AltRouteRoundedIcon fontSize="small" />,
  event: <EventRoundedIcon fontSize="small" />,
  insights: <InsightsRoundedIcon fontSize="small" />,
  problems: <BuildRoundedIcon fontSize="small" />,
};

const cardSx = {
  borderRadius: '16px',
  border: `1px solid ${brand.border}`,
  boxShadow: '0 1px 3px rgba(30, 31, 28, 0.05)',
} as const;

const topicAnchor = (section: HelpSection, topic: HelpTopic) => `${section.id}-${topic.id}`;

function blocksText(blocks: HelpBlock[] = []): string {
  return blocks
    .map(b => {
      switch (b.kind) {
        case 'p':
        case 'note': return b.text;
        case 'steps':
        case 'list': return b.items.join(' ');
        case 'table': return [...b.head, ...b.rows.flat()].join(' ');
        case 'figure': return b.caption;
      }
    })
    .join(' ');
}

// Texto normalizado de cada sección y tema, para el buscador
const INDEX = HELP_SECTIONS.map(section => ({
  section,
  head: normalize(plainText([section.title, section.summary, blocksText(section.intro)].join(' '))),
  topics: section.topics.map(topic => ({
    topic,
    text: normalize(plainText([topic.title, blocksText(topic.blocks)].join(' '))),
  })),
}));

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function ShortcutButton({ shortcut }: { shortcut: HelpShortcut }) {
  const external = shortcut.to.startsWith('http');
  const common = {
    size: 'small' as const,
    variant: 'outlined' as const,
    sx: { borderRadius: '100px', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', py: '3px' },
  };
  return external ? (
    <Button {...common} component="a" href={shortcut.to} target="_blank" rel="noopener noreferrer"
      endIcon={<OpenInNewRoundedIcon sx={{ fontSize: '14px !important' }} />}>
      {shortcut.label}
    </Button>
  ) : (
    <Button {...common} component={RouterLink} to={shortcut.to}
      endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: '14px !important' }} />}>
      {shortcut.label}
    </Button>
  );
}

function SectionCard({ section, number, topics, showIntro }: {
  section: HelpSection;
  number: number;
  topics: HelpTopic[];
  showIntro: boolean;
}) {
  return (
    <Paper component="section" id={section.id} sx={{ ...cardSx, p: { xs: 2, sm: 3 }, scrollMarginTop: 16 }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 38, height: 38, borderRadius: '12px', flexShrink: 0,
            bgcolor: brand.green50, color: brand.greenStrong,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {ICONS[section.icon]}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.3, color: brand.ink }}>
            <Box component="span" sx={{ color: brand.text4, mr: 1 }}>{number}.</Box>
            {section.title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: '2px' }}>{section.summary}</Typography>
        </Box>
      </Box>

      {section.shortcuts && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          {section.shortcuts.map(s => <ShortcutButton key={s.to} shortcut={s} />)}
        </Box>
      )}

      {showIntro && section.intro && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2.5 }}>
          {section.intro.map((b, i) => <HelpBlockView key={i} block={b} />)}
        </Box>
      )}

      {topics.map(topic => (
        <Box
          key={topic.id}
          id={topicAnchor(section, topic)}
          sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${brand.border}`, scrollMarginTop: 16 }}
        >
          <Typography component="h3" sx={{ fontWeight: 700, fontSize: '0.92rem', color: brand.text, mb: 1.5 }}>
            {topic.title}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {topic.blocks.map((b, i) => <HelpBlockView key={i} block={b} />)}
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

function TaskCards({ onGo }: { onGo: (id: string) => void }) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 1.5, color: brand.text }}>Tareas frecuentes</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        {HELP_TASKS.map(task => (
          <Paper key={task.title} sx={{ ...cardSx, p: 2, borderLeft: `4px solid ${brand.yellow}` }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: brand.ink }}>{task.title}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: '2px', mb: 1.25 }}>
              {task.description}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
              {task.steps.map((step, i) => (
                <Box key={step.target} sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {i > 0 && <ArrowForwardRoundedIcon sx={{ fontSize: 13, color: brand.text4 }} />}
                  <Link
                    component="button"
                    type="button"
                    onClick={() => onGo(step.target)}
                    sx={{ fontSize: '0.78rem', fontWeight: 600, color: brand.greenStrong, textDecorationColor: `${brand.green}66` }}
                  >
                    {step.label}
                  </Link>
                </Box>
              ))}
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

function Toc({ activeId, onGo }: { activeId: string | null; onGo: (id: string) => void }) {
  return (
    <Box
      component="nav"
      aria-label="Contenido de la ayuda"
      sx={{
        display: { xs: 'none', md: 'block' },
        position: 'sticky',
        top: 0,
        maxHeight: 'calc(100vh - 64px - 48px)',
        overflowY: 'auto',
      }}
    >
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: brand.text3, mb: 1, px: 1.5 }}>
        Contenido
      </Typography>
      {HELP_SECTIONS.map((section, i) => {
        const active = section.id === activeId;
        return (
          <Box key={section.id}>
            <Box
              component="button"
              type="button"
              onClick={() => onGo(section.id)}
              sx={{
                all: 'unset',
                boxSizing: 'border-box',
                width: '100%',
                display: 'flex',
                gap: 1,
                px: 1.5,
                py: '6px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                lineHeight: 1.35,
                fontWeight: active ? 700 : 500,
                color: active ? brand.greenStrong : brand.text2,
                bgcolor: active ? brand.green50 : 'transparent',
                '&:hover': { bgcolor: active ? brand.green50 : brand.bgMuted },
                '&:focus-visible': { outline: `2px solid ${brand.green}`, outlineOffset: 1 },
              }}
            >
              <Box component="span" sx={{ color: brand.text4, minWidth: 16 }}>{i + 1}.</Box>
              <span>{section.title}</span>
            </Box>
            {active && section.topics.length > 1 && (
              <Box sx={{ ml: '30px', borderLeft: `2px solid ${brand.green100}`, my: '2px' }}>
                {section.topics.map(topic => (
                  <Box
                    key={topic.id}
                    component="button"
                    type="button"
                    onClick={() => onGo(topicAnchor(section, topic))}
                    sx={{
                      all: 'unset',
                      boxSizing: 'border-box',
                      display: 'block',
                      width: '100%',
                      pl: 1.25,
                      py: '3px',
                      cursor: 'pointer',
                      fontSize: '0.76rem',
                      color: brand.text3,
                      '&:hover': { color: brand.greenStrong },
                      '&:focus-visible': { outline: `2px solid ${brand.green}`, outlineOffset: 1 },
                    }}
                  >
                    {topic.title}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(HELP_SECTIONS[0]?.id ?? null);
  const location = useLocation();
  const navigate = useNavigate();

  const terms = useMemo(() => normalize(query).split(/\s+/).filter(Boolean), [query]);
  const searching = terms.length > 0;

  // Con búsqueda: si la sección coincide se muestra entera; si no, solo los temas que coinciden
  const visible = useMemo(() => {
    if (!searching) return INDEX.map(({ section }) => ({ section, topics: section.topics, whole: true }));
    return INDEX.flatMap(({ section, head, topics }) => {
      if (terms.every(t => head.includes(t))) return [{ section, topics: section.topics, whole: true }];
      const hits = topics.filter(({ text }) => terms.every(t => text.includes(t))).map(({ topic }) => topic);
      return hits.length ? [{ section, topics: hits, whole: false }] : [];
    });
  }, [searching, terms]);

  const resultCount = visible.reduce((n, v) => n + v.topics.length, 0);

  const goTo = useCallback((id: string) => {
    // Si el destino está oculto por la búsqueda, se limpia antes de saltar
    flushSync(() => setQuery(''));
    scrollToId(id);
    navigate({ hash: id }, { replace: true });
  }, [navigate]);

  // Entrar con /help#seccion lleva directo a ese punto
  useEffect(() => {
    if (location.hash) scrollToId(decodeURIComponent(location.hash.slice(1)));
  }, [location.hash]);

  // Resalta en el índice la sección que se está leyendo
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveId(top.target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    HELP_SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [visible]);

  const numberOf = (id: string) => HELP_SECTIONS.findIndex(s => s.id === id) + 1;

  return (
    <HelpNavContext.Provider value={goTo}>
      <Box>
        <PageHeader
          title="Ayuda"
          subtitle="Cómo usar el panel paso a paso y recomendaciones para mapear con MultiSet. La instalación, el código y el servidor están en el Manual técnico UCO MAP."
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '240px minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
          <Toc activeId={activeId} onGo={goTo} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 880, minWidth: 0 }}>
            <Box>
              <OutlinedInput
                fullWidth
                size="small"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar en la ayuda: parche, ascensor, MapSet, evento…"
                inputProps={{ 'aria-label': 'Buscar en la ayuda' }}
                startAdornment={
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                }
                endAdornment={query && (
                  <InputAdornment position="end">
                    <IconButton size="small" aria-label="Limpiar búsqueda" onClick={() => setQuery('')}>
                      <CloseRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                )}
                sx={{ bgcolor: '#fff', borderRadius: '12px' }}
              />
              {searching && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, fontSize: '0.8rem' }} aria-live="polite">
                  {resultCount === 0
                    ? `No encontramos nada con «${query.trim()}». Prueba con otra palabra o revisa Problemas frecuentes.`
                    : `${resultCount} ${resultCount === 1 ? 'tema encontrado' : 'temas encontrados'}`}
                </Typography>
              )}
            </Box>

            {!searching && <TaskCards onGo={goTo} />}

            {visible.map(({ section, topics, whole }) => (
              <SectionCard
                key={section.id}
                section={section}
                number={numberOf(section.id)}
                topics={topics}
                showIntro={whole}
              />
            ))}

            {searching && resultCount === 0 && (
              <Box>
                <Button size="small" onClick={() => goTo('problemas')} sx={{ textTransform: 'none', fontWeight: 600 }}>
                  Ir a Problemas frecuentes
                </Button>
              </Box>
            )}

            <Typography variant="caption" sx={{ color: brand.text3, display: 'block', pb: 2 }}>
              Basado en el {HELP_SOURCE.title} ({HELP_SOURCE.date}), de {HELP_SOURCE.authors}, y en la documentación de MultiSet.
            </Typography>
          </Box>
        </Box>
      </Box>
    </HelpNavContext.Provider>
  );
}
