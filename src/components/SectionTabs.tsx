import { Tab, Tabs } from '@mui/material';
import { brand } from '../theme/brand';

export interface SectionTab<T extends string> {
  value: T;
  label: string;
  icon: React.ReactElement;
}

interface Props<T extends string> {
  value: T;
  tabs: SectionTab<T>[];
  onChange: (value: T) => void;
}

export default function SectionTabs<T extends string>({ value, tabs, onChange }: Props<T>) {
  return (
    <Tabs
      value={value}
      onChange={(_, v) => onChange(v)}
      variant="scrollable"
      scrollButtons="auto"
      sx={{
        minHeight: 38,
        bgcolor: brand.bgMuted,
        borderRadius: '12px',
        p: '3px',
        '& .MuiTabs-indicator': { display: 'none' },
        '& .MuiTab-root': {
          minHeight: 32,
          px: 1.75,
          borderRadius: '9px',
          textTransform: 'none',
          fontWeight: 700,
          fontSize: '0.8rem',
          color: 'text.secondary',
        },
        '& .MuiTab-root.Mui-selected': {
          bgcolor: '#fff',
          color: brand.greenStrong,
          boxShadow: `0 1px 4px rgba(0,0,0,0.08), inset 0 -3px 0 ${brand.yellow}`,
        },
      }}
    >
      {tabs.map(t => (
        <Tab key={t.value} value={t.value} icon={t.icon} iconPosition="start" label={t.label} />
      ))}
    </Tabs>
  );
}
