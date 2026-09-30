import { Tab, Tabs } from '@mui/material';

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
        bgcolor: '#F3F4F6',
        borderRadius: '12px',
        p: '3px',
        '& .MuiTabs-indicator': { display: 'none' },
        '& .MuiTab-root': {
          minHeight: 32,
          px: 1.75,
          borderRadius: '9px',
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8rem',
          color: 'text.secondary',
        },
        '& .MuiTab-root.Mui-selected': {
          bgcolor: '#fff',
          color: '#047857',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        },
      }}
    >
      {tabs.map(t => (
        <Tab key={t.value} value={t.value} icon={t.icon} iconPosition="start" label={t.label} />
      ))}
    </Tabs>
  );
}
