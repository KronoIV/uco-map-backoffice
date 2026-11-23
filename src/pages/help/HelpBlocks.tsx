import { Fragment, useContext } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Link, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import TipsAndUpdatesRoundedIcon from '@mui/icons-material/TipsAndUpdatesRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { brand } from '../../theme/brand';
import type { HelpBlock } from './helpContent';
import { HelpNavContext } from './helpNav';

// Capturas opcionales: basta con poner el archivo en src/assets/help con el nombre que pide cada figura.
const IMAGES = import.meta.glob<string>('../../assets/help/*.{webp,png,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function imageFor(file: string): string | undefined {
  for (const [path, url] of Object.entries(IMAGES)) {
    const name = path.split('/').pop()?.replace(/\.[^.]+$/, '');
    if (name === file) return url;
  }
  return undefined;
}

const TOKEN = /(`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function HelpLink({ href, children }: { href: string; children: string }) {
  const goTo = useContext(HelpNavContext);
  const sx = { fontWeight: 600, color: brand.greenStrong, textDecorationColor: `${brand.green}66` };

  if (href.startsWith('#')) {
    return (
      <Link
        href={href}
        onClick={e => { e.preventDefault(); goTo(href.slice(1)); }}
        sx={sx}
      >
        {children}
      </Link>
    );
  }
  if (href.startsWith('/')) {
    return <Link component={RouterLink} to={href} sx={sx}>{children}</Link>;
  }
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" sx={{ ...sx, whiteSpace: 'nowrap' }}>
      {children}
      <OpenInNewRoundedIcon sx={{ fontSize: 13, ml: '2px', verticalAlign: '-2px' }} />
    </Link>
  );
}

/** Texto con `código` y [enlaces](destino). */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(TOKEN).map((part, i) => {
        if (part.length > 1 && part.startsWith('`') && part.endsWith('`')) {
          return (
            <Box
              key={i}
              component="code"
              sx={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: '0.82em',
                bgcolor: brand.bgMuted,
                border: `1px solid ${brand.border}`,
                borderRadius: '6px',
                px: '5px',
                py: '1px',
                wordBreak: 'break-word',
              }}
            >
              {part.slice(1, -1)}
            </Box>
          );
        }
        const link = LINK.exec(part);
        if (link) return <HelpLink key={i} href={link[2]}>{link[1]}</HelpLink>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

const bodySx = { fontSize: '0.875rem', lineHeight: 1.65, color: brand.text2 } as const;

function Steps({ items }: { items: string[] }) {
  return (
    <Box
      component="ol"
      sx={{
        listStyle: 'none',
        counterReset: 'paso',
        p: 0,
        m: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {items.map((item, i) => (
        <Box
          key={i}
          component="li"
          sx={{
            ...bodySx,
            counterIncrement: 'paso',
            position: 'relative',
            pl: '36px',
            '&::before': {
              content: 'counter(paso)',
              position: 'absolute',
              left: 0,
              top: '1px',
              width: 24,
              height: 24,
              borderRadius: '50%',
              bgcolor: brand.green50,
              color: brand.greenStrong,
              border: `1px solid ${brand.green200}`,
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          }}
        >
          <RichText text={item} />
        </Box>
      ))}
    </Box>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item, i) => (
        <Box key={i} component="li" sx={{ ...bodySx, '&::marker': { color: brand.green } }}>
          <RichText text={item} />
        </Box>
      ))}
    </Box>
  );
}

function HelpTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <Box sx={{ overflowX: 'auto', border: `1px solid ${brand.border}`, borderRadius: '12px' }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: brand.bgMuted }}>
            {head.map(h => (
              <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.78rem', color: brand.text, whiteSpace: 'nowrap' }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, r) => (
            <TableRow key={r} sx={{ '&:last-child td': { borderBottom: 0 }, verticalAlign: 'top' }}>
              {row.map((cell, c) => (
                <TableCell
                  key={c}
                  sx={{ fontSize: '0.82rem', lineHeight: 1.55, color: c === 0 ? brand.text : brand.text2, fontWeight: c === 0 ? 600 : 400 }}
                >
                  <RichText text={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function Figure({ file, caption }: { file: string; caption: string }) {
  const src = imageFor(file);
  if (!src) return null;
  return (
    <Box component="figure" sx={{ m: 0 }}>
      <Link href={src} target="_blank" rel="noopener noreferrer" sx={{ display: 'block' }}>
        <Box
          component="img"
          src={src}
          alt={caption}
          loading="lazy"
          sx={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: 380,
            borderRadius: '12px',
            border: `1px solid ${brand.border}`,
            boxShadow: '0 1px 3px rgba(30, 31, 28, 0.06)',
          }}
        />
      </Link>
      <Typography component="figcaption" variant="caption" sx={{ display: 'block', mt: '6px', color: brand.text3 }}>
        {caption}
      </Typography>
    </Box>
  );
}

const NOTE_SEVERITY = { info: 'info', tip: 'success', warning: 'warning' } as const;

export function HelpBlockView({ block }: { block: HelpBlock }) {
  switch (block.kind) {
    case 'p':
      return <Typography sx={bodySx}><RichText text={block.text} /></Typography>;
    case 'steps':
      return <Steps items={block.items} />;
    case 'list':
      return <Bullets items={block.items} />;
    case 'table':
      return <HelpTable head={block.head} rows={block.rows} />;
    case 'figure':
      return <Figure file={block.file} caption={block.caption} />;
    case 'note':
      return (
        <Alert
          severity={NOTE_SEVERITY[block.tone]}
          icon={block.tone === 'tip' ? <TipsAndUpdatesRoundedIcon fontSize="inherit" /> : undefined}
          sx={{ borderRadius: '12px', fontSize: '0.84rem', lineHeight: 1.6, '& .MuiAlert-message': { py: '6px' } }}
        >
          <RichText text={block.text} />
        </Alert>
      );
  }
}
