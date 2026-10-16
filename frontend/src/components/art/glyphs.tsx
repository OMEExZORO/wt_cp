import type { ReactNode } from 'react'
import { ART } from './palette'

export type ArtKind = 'welcome' | 'usg' | 'ct' | 'biopsy' | 'xray' | 'mri' | 'ecg' | 'lab' | 'mammo' | 'reporting' | 'reception'

export const ART_LABEL: Record<ArtKind, string> = {
  welcome: 'Illustration of the diagnostic centre building',
  usg: 'Illustration of an ultrasound machine with a probe',
  ct: 'Illustration of a CT scanner gantry and table',
  biopsy: 'Illustration of a needle reaching a target under ultrasound guidance',
  xray: 'Illustration of a chest X-ray film',
  mri: 'Illustration of an MRI scanner',
  ecg: 'Illustration of a heart with an ECG trace',
  lab: 'Illustration of laboratory test tubes in a rack',
  mammo: 'Illustration of a mammography unit',
  reporting: 'Illustration of a scan on a monitor beside a written report',
  reception: 'Illustration of a reception desk with an appointment calendar',
}

const { navy, navySoft, orange, orangeSoft, tint, tintDeep, white } = ART

function Stage({ children }: { children: ReactNode }) {
  return (
    <>
      <circle cx="400" cy="300" r="250" fill={tint} />
      <circle cx="400" cy="300" r="250" fill="none" stroke={tintDeep} strokeWidth="2" strokeDasharray="4 10" />
      {children}
    </>
  )
}

function Usg() {
  return (
    <Stage>
      <rect x="215" y="120" width="300" height="230" rx="22" fill={navy} />
      <rect x="235" y="140" width="260" height="190" rx="12" fill="#0d1433" />
      <path d="M365 150 L270 320 A190 190 0 0 0 460 320 Z" fill={navySoft} opacity="0.55" />
      <path d="M365 150 L300 320 M365 150 L365 330 M365 150 L430 320" stroke={tintDeep} strokeWidth="2" opacity="0.5" />
      <circle cx="372" cy="250" r="18" fill="none" stroke={orange} strokeWidth="4" />
      <rect x="320" y="350" width="90" height="30" fill={navySoft} />
      <rect x="260" y="380" width="210" height="26" rx="8" fill={navy} />
      <circle cx="285" cy="425" r="14" fill={navySoft} />
      <circle cx="445" cy="425" r="14" fill={navySoft} />
      <path d="M515 250 C590 250 560 400 600 420" fill="none" stroke={navy} strokeWidth="8" strokeLinecap="round" />
      <rect x="585" y="410" width="54" height="86" rx="18" transform="rotate(-18 612 453)" fill={orange} />
      <path d="M560 500 q-30 -14 -18 -46 M530 515 q-46 -22 -30 -76" fill="none" stroke={orange} strokeWidth="5" strokeLinecap="round" opacity="0.6" />
    </Stage>
  )
}

function Ct() {
  return (
    <Stage>
      <rect x="215" y="105" width="330" height="320" rx="36" fill={navy} />
      <circle cx="380" cy="265" r="115" fill={tint} />
      <circle cx="380" cy="265" r="115" fill="none" stroke={orange} strokeWidth="10" />
      <circle cx="380" cy="265" r="84" fill="#0d1433" />
      <circle cx="380" cy="265" r="56" fill="none" stroke={navySoft} strokeWidth="3" />
      <circle cx="380" cy="265" r="28" fill="none" stroke={navySoft} strokeWidth="3" />
      <circle cx="515" cy="145" r="9" fill={orange} />
      <rect x="235" y="415" width="290" height="22" rx="8" fill={navySoft} />
      <path d="M195 330 L565 330" stroke={orange} strokeWidth="10" strokeLinecap="round" />
      <rect x="255" y="437" width="250" height="40" rx="8" fill={navy} />
    </Stage>
  )
}

function Biopsy() {
  return (
    <Stage>
      <path d="M400 110 L205 440 A230 230 0 0 0 595 440 Z" fill={navy} />
      <path d="M400 110 L205 440 A230 230 0 0 0 595 440 Z" fill="none" stroke={navySoft} strokeWidth="3" />
      <path d="M400 110 L335 440 M400 110 L400 470 M400 110 L465 440" stroke={navySoft} strokeWidth="2" />
      <circle cx="430" cy="330" r="46" fill="none" stroke={orangeSoft} strokeWidth="4" strokeDasharray="6 8" />
      <circle cx="430" cy="330" r="14" fill={orange} />
      <path d="M640 140 L440 322" stroke={white} strokeWidth="7" strokeLinecap="round" />
      <path d="M440 322 L432 330" stroke={orange} strokeWidth="7" strokeLinecap="round" />
      <rect x="628" y="110" width="70" height="26" rx="8" transform="rotate(-42 663 123)" fill={orange} />
    </Stage>
  )
}

function Xray() {
  const ribs = [190, 230, 270, 310, 350]
  return (
    <Stage>
      <rect x="250" y="100" width="300" height="400" rx="20" fill={navy} />
      <rect x="268" y="118" width="264" height="364" rx="10" fill="#0d1433" />
      <rect x="392" y="140" width="16" height="320" rx="8" fill={tintDeep} opacity="0.85" />
      <path d="M385 180 C300 170 290 360 335 420 C365 430 380 400 385 340 Z" fill={navySoft} opacity="0.5" />
      <path d="M415 180 C500 170 510 360 465 420 C435 430 420 400 415 340 Z" fill={navySoft} opacity="0.5" />
      {ribs.map((y) => (
        <g key={y} fill="none" stroke={tintDeep} strokeWidth="5" strokeLinecap="round" opacity="0.8">
          <path d={`M392 ${y} C340 ${y - 20} 300 ${y + 10} 292 ${y + 50}`} />
          <path d={`M408 ${y} C460 ${y - 20} 500 ${y + 10} 508 ${y + 50}`} />
        </g>
      ))}
      <path d="M300 128 L340 150 M500 128 L460 150" stroke={orange} strokeWidth="6" strokeLinecap="round" />
    </Stage>
  )
}

function Mri() {
  return (
    <Stage>
      <circle cx="400" cy="270" r="190" fill={navy} />
      <circle cx="400" cy="270" r="190" fill="none" stroke={navySoft} strokeWidth="6" />
      <circle cx="400" cy="270" r="140" fill="none" stroke={orange} strokeWidth="8" />
      <circle cx="400" cy="270" r="118" fill="#0d1433" />
      <circle cx="400" cy="270" r="80" fill="none" stroke={navySoft} strokeWidth="3" />
      <circle cx="400" cy="270" r="44" fill="none" stroke={navySoft} strokeWidth="3" />
      <path d="M250 392 L550 392 L520 440 L280 440 Z" fill={tintDeep} />
      <rect x="290" y="372" width="220" height="22" rx="10" fill={orange} />
      <rect x="330" y="440" width="140" height="40" rx="8" fill={navy} />
    </Stage>
  )
}

function Ecg() {
  return (
    <Stage>
      <rect x="170" y="150" width="460" height="300" rx="24" fill={navy} />
      {[200, 240, 280, 320, 360, 400].map((y) => (
        <path key={y} d={`M185 ${y} H615`} stroke={navySoft} strokeWidth="1.5" />
      ))}
      {[230, 290, 350, 410, 470, 530, 590].map((x) => (
        <path key={x} d={`M${x} 165 V435`} stroke={navySoft} strokeWidth="1.5" />
      ))}
      <path d="M185 330 H260 L285 330 L305 270 L330 390 L355 220 L380 360 L400 330 H430 L450 300 L480 300 L500 330 H615" fill="none" stroke={orange} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M400 140 C400 100 345 90 345 135 C345 165 400 195 400 195 C400 195 455 165 455 135 C455 90 400 100 400 140 Z" transform="translate(0 -20)" fill={orange} />
    </Stage>
  )
}

function Lab() {
  const tubes = [
    { x: 250, fill: orange, level: 300 },
    { x: 330, fill: navySoft, level: 260 },
    { x: 410, fill: orangeSoft, level: 320 },
    { x: 490, fill: navy, level: 280 },
  ]
  return (
    <Stage>
      {tubes.map((tube) => (
        <g key={tube.x}>
          <path d={`M${tube.x} 170 V400 a30 30 0 0 0 60 0 V170 Z`} fill={white} stroke={navy} strokeWidth="6" />
          <path d={`M${tube.x + 3} ${tube.level} V400 a27 27 0 0 0 54 0 V${tube.level} Z`} fill={tube.fill} />
          <rect x={tube.x - 6} y="160" width="72" height="16" rx="6" fill={navy} />
        </g>
      ))}
      <rect x="220" y="330" width="360" height="22" rx="8" fill={navy} />
      <rect x="220" y="400" width="360" height="22" rx="8" fill={navy} />
      <path d="M600 190 q22 34 0 52 q-22 -18 0 -52 Z" fill={orange} />
    </Stage>
  )
}

function Mammo() {
  return (
    <Stage>
      <rect x="300" y="110" width="70" height="360" rx="20" fill={navy} />
      <rect x="280" y="450" width="200" height="30" rx="10" fill={navySoft} />
      <path d="M335 150 H500 a40 40 0 0 1 40 40 V230 H335 Z" fill={navy} />
      <rect x="440" y="250" width="110" height="14" rx="6" fill={orange} />
      <rect x="440" y="340" width="110" height="14" rx="6" fill={orange} />
      <path d="M455 264 Q430 302 455 340 H535 Q555 302 535 264 Z" fill={tintDeep} opacity="0.9" />
      <rect x="400" y="380" width="170" height="20" rx="8" fill={navySoft} />
      <circle cx="335" cy="170" r="10" fill={orange} />
    </Stage>
  )
}

function Reporting() {
  return (
    <Stage>
      <rect x="170" y="130" width="300" height="220" rx="18" fill={navy} />
      <rect x="188" y="148" width="264" height="184" rx="8" fill="#0d1433" />
      <ellipse cx="320" cy="240" rx="82" ry="70" fill={navySoft} opacity="0.7" />
      <ellipse cx="320" cy="240" rx="52" ry="44" fill="none" stroke={tintDeep} strokeWidth="3" />
      <circle cx="340" cy="228" r="12" fill={orange} />
      <rect x="305" y="350" width="30" height="40" fill={navySoft} />
      <rect x="250" y="390" width="140" height="18" rx="8" fill={navy} />
      <rect x="470" y="170" width="170" height="250" rx="14" fill={white} stroke={navy} strokeWidth="6" />
      <rect x="520" y="156" width="70" height="28" rx="10" fill={orange} />
      {[220, 252, 284, 316].map((y, i) => (
        <rect key={y} x="494" y={y} width={i % 2 ? 90 : 122} height="10" rx="5" fill={tintDeep} />
      ))}
      <path d="M494 372 l16 16 l34 -34" fill="none" stroke={orange} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </Stage>
  )
}

function Reception() {
  return (
    <Stage>
      <rect x="170" y="330" width="460" height="150" rx="16" fill={navy} />
      <rect x="150" y="310" width="500" height="28" rx="12" fill={navySoft} />
      <rect x="205" y="360" width="90" height="90" rx="10" fill={navySoft} />
      <rect x="210" y="130" width="190" height="170" rx="16" fill={white} stroke={navy} strokeWidth="6" />
      <rect x="210" y="130" width="190" height="42" rx="16" fill={orange} />
      <circle cx="255" cy="130" r="8" fill={navy} />
      <circle cx="355" cy="130" r="8" fill={navy} />
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2, 3].map((col) => (
          <rect key={`${row}-${col}`} x={226 + col * 40} y={192 + row * 34} width="24" height="20" rx="4" fill={row === 1 && col === 2 ? orange : tintDeep} />
        )),
      )}
      <path d="M520 150 a50 50 0 0 1 100 0 c0 40 -50 90 -50 90 c0 0 -50 -50 -50 -90 Z" fill={orange} />
      <circle cx="570" cy="150" r="18" fill={white} />
    </Stage>
  )
}

function Welcome() {
  return (
    <Stage>
      <rect x="200" y="190" width="400" height="290" rx="16" fill={navy} />
      <rect x="170" y="170" width="460" height="34" rx="12" fill={navySoft} />
      <rect x="352" y="95" width="96" height="96" rx="20" fill={orange} />
      <path d="M400 112 V174 M369 143 H431" stroke={white} strokeWidth="16" strokeLinecap="round" />
      {[0, 1, 2].map((i) => (
        <rect key={`l${i}`} x={230 + i * 62} y="232" width="42" height="56" rx="8" fill={tintDeep} />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={`r${i}`} x={384 + i * 62} y="232" width="42" height="56" rx="8" fill={tintDeep} />
      ))}
      <path d="M350 480 V370 a50 50 0 0 1 100 0 V480 Z" fill={tint} />
      <path d="M400 320 V480" stroke={navySoft} strokeWidth="4" />
    </Stage>
  )
}

const GLYPHS: Record<ArtKind, () => ReactNode> = {
  welcome: Welcome,
  usg: Usg,
  ct: Ct,
  biopsy: Biopsy,
  xray: Xray,
  mri: Mri,
  ecg: Ecg,
  lab: Lab,
  mammo: Mammo,
  reporting: Reporting,
  reception: Reception,
}

export function Glyph({ kind }: { kind: ArtKind }) {
  const Component = GLYPHS[kind]
  return <Component />
}
