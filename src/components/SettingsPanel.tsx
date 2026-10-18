import type { ReactNode } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { FONT_STACKS, READER_THEMES } from '../lib/themes';
import type { FlowMode, PageTurn, FontFamilyKey, MarginSize, ThemeName } from '../types';

function Row({ label, children, id }: { label: string; children: ReactNode; id: string }) {
  return (
    <div className="space-y-2" role="group" aria-labelledby={id}>
      <div id={id} className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

/** Accessible segmented control built on native radios (arrow keys work for free). */
function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string; style?: React.CSSProperties }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-surface2 p-1">
      {options.map((o) => (
        <label
          key={o.value}
          style={o.style}
          className={`relative cursor-pointer rounded-md px-2 py-2 text-center text-[14px] transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-accent ${
            value === o.value ? 'bg-surface font-semibold text-fg shadow-card' : 'text-muted hover:text-fg'
          }`}
        >
          <input type="radio" className="sr-only" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

const THEME_LABEL: Record<ThemeName, string> = { light: 'White', dark: 'Black', sepia: 'Sepia' };

/** Kindle-style "Aa" panel: themes as page swatches, then font, size, layout. */
export function SettingsPanel() {
  const s = useSettingsStore();
  const activeTheme: ThemeName = s.theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : s.theme;

  return (
    <div className="space-y-6">
      <Row label="Theme" id="set-theme">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(READER_THEMES) as ThemeName[]).map((t) => {
            const th = READER_THEMES[t];
            const on = activeTheme === t;
            return (
              <label
                key={t}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 py-3 focus-within:outline focus-within:outline-2 focus-within:outline-accent ${
                  on ? 'border-accent' : 'border-line'
                }`}
                style={{ background: th.bg, color: th.fg }}
              >
                <input type="radio" name="theme" className="sr-only" checked={on} onChange={() => s.set('theme', t)} />
                <span className="font-serif text-2xl leading-none">Aa</span>
                <span className="text-[12px] font-medium">{THEME_LABEL[t]}</span>
              </label>
            );
          })}
        </div>
      </Row>

      <Row label={`Font size · ${s.fontSize}%`} id="set-size">
        <div className="flex items-center gap-3">
          <span className="font-serif text-sm text-muted" aria-hidden>
            A
          </span>
          <input
            type="range"
            min={80}
            max={200}
            step={5}
            value={s.fontSize}
            onChange={(e) => s.set('fontSize', Number(e.target.value))}
            aria-labelledby="set-size"
            className="h-6 flex-1"
          />
          <span className="font-serif text-2xl text-muted" aria-hidden>
            A
          </span>
        </div>
      </Row>

      <Row label="Font" id="set-font">
        <Segmented<FontFamilyKey>
          name="font"
          value={s.fontFamily}
          onChange={(v) => s.set('fontFamily', v)}
          options={[
            { value: 'serif', label: 'Serif', style: { fontFamily: FONT_STACKS.serif } },
            { value: 'sans', label: 'Sans', style: { fontFamily: FONT_STACKS.sans } },
          ]}
        />
      </Row>

      <Row label="Margins" id="set-margin">
        <Segmented<MarginSize>
          name="margin"
          value={s.margin}
          onChange={(v) => s.set('margin', v)}
          options={[
            { value: 'narrow', label: 'Narrow' },
            { value: 'normal', label: 'Normal' },
            { value: 'wide', label: 'Wide' },
          ]}
        />
      </Row>

      <Row label={`Line spacing · ${s.lineHeight.toFixed(1)}`} id="set-lh">
        <input
          type="range"
          min={1.2}
          max={2.2}
          step={0.1}
          value={s.lineHeight}
          onChange={(e) => s.set('lineHeight', Number(e.target.value))}
          aria-labelledby="set-lh"
          className="h-6 w-full"
        />
      </Row>

      <Row label="Layout" id="set-flow">
        <Segmented<FlowMode>
          name="flow"
          value={s.flow}
          onChange={(v) => s.set('flow', v)}
          options={[
            { value: 'paginated', label: 'Pages' },
            { value: 'scrolled', label: 'Continuous scroll' },
          ]}
        />
      </Row>

      {s.flow === 'paginated' && (
        <Row label="Page turn animation" id="set-turn">
          <Segmented<PageTurn>
            name="pageTurn"
            value={s.pageTurn}
            onChange={(v) => s.set('pageTurn', v)}
            options={[
              { value: 'fade', label: 'Fade' },
              { value: 'slide', label: 'Slide' },
              { value: 'none', label: 'None' },
            ]}
          />
        </Row>
      )}

      <label className="flex cursor-pointer items-center justify-between rounded-lg bg-surface2 px-3 py-3 text-[14px]">
        <span>Justify text</span>
        <input type="checkbox" checked={s.justify} onChange={(e) => s.set('justify', e.target.checked)} className="h-5 w-5" />
      </label>

      <button className="btn-ghost w-full" onClick={s.reset}>
        Reset to defaults
      </button>
    </div>
  );
}
