---
name: Anonymous Goat ZK
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4d4635'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#7f7663'
  outline-variant: '#d0c5af'
  surface-tint: '#735c00'
  primary: '#735c00'
  on-primary: '#ffffff'
  primary-container: '#d4af37'
  on-primary-container: '#554300'
  inverse-primary: '#e9c349'
  secondary: '#5f5e60'
  on-secondary: '#ffffff'
  secondary-container: '#e5e1e4'
  on-secondary-container: '#656466'
  tertiary: '#855300'
  on-tertiary: '#ffffff'
  tertiary-container: '#f7a00f'
  on-tertiary-container: '#633d00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe088'
  primary-fixed-dim: '#e9c349'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#e5e1e4'
  secondary-fixed-dim: '#c8c6c8'
  on-secondary-fixed: '#1b1b1d'
  on-secondary-fixed-variant: '#474649'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  code-telemetry:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  code-badge:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The visual identity embodies cryptographic certainty, institutional luxury, and uncompromising privacy. Built on Stellar Soroban with Caatinga zero-knowledge primitives, the design system projects authority, mathematical precision, and sovereign anonymity.

The style unites hyper-clean light mode architecture with high-contrast obsidian modules and surgical gilded details. Rather than relying on generic dark-mode crypto conventions, this system employs an editorial, gallery-grade white canvas punctuated by rich onyx cards, sharp dual-stroke borders, and metallic gold accents. The emotional impression is that of a Swiss private vault crossed with an advanced cryptographic terminal: clean, unassailable, and luminous.

## Colors

The palette balances stark brightness with deep crypt-black weight and warm metallic conductivity.

- **Primary (`#D4AF37`)**: Imperial gold. Applied to verified cryptographic state indicators, Merkle tree root commitments, selection rings, primary interactive calls-to-action, and active voting nodes.
- **Secondary (`#0F0F11`)**: Deep pitch obsidian. Anchors the floating container surfaces, high-tier cryptographic cards, telemetry panels, and primary interactive buttons.
- **Tertiary (`#F59E0B`)**: Radiant amber. Reserved for active zero-knowledge proof generation animations, state transitions, gas consumption flags, and live tally counters.
- **Neutral Canvas (`#FFFFFF` & `#F9FAFB`)**: Sterile cryptographic white base, framing heavy contrast elements with expansive clarity.
- **Neutral Borders & Dividers (`#E5E7EB` & `#1F1F24`)**: Adaptive structural bounds that define layout geometry without visual noise.

## Typography

The typographic hierarchy separates structural human-readable content from cryptographic telemetry.

- **Plus Jakarta Sans** provides confident, geometric display titles and section anchors. Set tight with negative tracking on headlines (`-0.02em`) to command attention.
- **Inter** ensures effortless legibility for instructional copy, voting disclosures, and interface controls.
- **JetBrains Mono** is dedicated to zero-knowledge telemetry: cryptographic nullifiers, Merkle paths, transaction hashes, and proof execution metrics. All hexadecimal strings, gas estimates, and zk-SNARK constraints strictly use this monospaced scale.

## Layout & Spacing

The layout operates on an intentional 12-column grid anchored by wide outer canvas margins. 

- **Desktop (1024px+)**: 12 columns with 24px gutters. Dual-pane ballot cards (e.g., GTA 6 vs. Zelda Ocarina of Time Remake) span 6 columns each, flanked by persistent telemetry rails.
- **Tablet (768px - 1023px)**: 8 columns with 20px gutters. Voting cards stack or shift to a side-by-side compressed ratio.
- **Mobile (<768px)**: 4 columns with 16px gutters and 16px margins. Telemetry displays collapse into modular drawers or sticky status pills.

Vertical rhythm adheres strictly to an 8px base grid, using larger 32px to 48px leaps between major dApp stages (e.g., Ballots, ZK Proof Pipeline, On-Chain Tally).

## Elevation & Depth

Depth is established through crisp geometric borders and layered obsidian containers rather than heavy diffuse drop shadows:

- **Level 0 (Canvas Base)**: Pure `#FFFFFF` flat field, accented with subtle hairline gridlines (`#F3F4F6`).
- **Level 1 (Obsidian Cards & Containers)**: Solid `#0F0F11` high-contrast modules with a 1px exterior rim of `#2A2A30` and a hairline inner gold glow (`rgba(212, 175, 55, 0.15)`).
- **Level 2 (Active Focus & Floating Modals)**: Lifted using a sharp double border (outer `#000000`, inner `#D4AF37`) combined with an ultra-tight gold ambient aura: `0 8px 30px rgba(212, 175, 55, 0.12)`.
- **Level 3 (ZK Pipeline Telemetry)**: Recessed tactile planes within dark cards using inner shadows (`inset 0 2px 4px rgba(0, 0, 0, 0.6)`) and monospace matrix borders.

## Shapes

The shape system employs disciplined, architectural rounding. A base radius of 8px (`roundedness: 2`) gives interactive cards, badges, and controls an engineered, precision-tooled presence without circular toy-like exaggeration.

- **Primary Cards & Modals**: 16px corner radius (`rounded-lg`), housing crisp 8px inner telemetry containers.
- **Buttons & Chips**: 8px corner radius (`rounded-md`), ensuring a sturdy, physical feel for signature submission and option selection.
- **Telemetry Hash Capsules**: 6px radius (`rounded-sm`), enforcing strict monospaced block alignment.
- **Vote Option Selector Badges**: Chamfered or dual-stroke rounded squares reflecting the angular geometry of the brand insignia.

## Components

### Buttons & Cryptographic Actions
- **Primary Action (ZK Vote Submission / Wallet Connect)**: Solid `#D4AF37` fill, black `#000000` text, bold `Plus Jakarta Sans`, 8px radius. Hover triggers an intense gold luminescence and slight brightness lift.
- **Secondary Action (View Proof / Verify Soroban State)**: Solid `#0F0F11` obsidian body, 1px `#D4AF37` border, white text, monospace telemetry indicator.
- **Destructive / Reset Action**: Ghost treatment with a 1px `#EF4444` border and subdued red hover state.

### Game Voting Cards (e.g., GTA 6 vs. Zelda: OOT Remake)
- **Base State**: Rich black background (`#0F0F11`), 1px border (`#2A2A30`), high-resolution title lockup, subtle key-art ambient background blur, and vote tally percentage bar in gold.
- **Selected State**: 2px border in metallic `#D4AF37` with a matching 4px concentric gold badge icon. The card deepens in contrast, and a monospaced Caatinga commitment hash generates at the bottom edge.

### ZK Proof Generation Pipeline Visualizer
- Multi-step horizontal progress tracker: (1) Identity Shielding -> (2) Caatinga Merkle Tree Verification -> (3) Soroban Smart Contract Execution.
- Steps feature pulsing gold nodes (`#F59E0B` to `#D4AF37`), live millisecond timers, and streaming zero-knowledge proof byte strings in `JetBrains Mono`.

### High-Tech Telemetry Badges & Hash Displays
- Black pill containers (`#000000`) with hairline borders (`rgba(212, 175, 55, 0.3)`).
- Truncated hashes (e.g., `0x7F...c39A`) rendered in glowing gold text with a click-to-copy tooltip and instant verification status indicator.

### Live On-Chain Tally Bars
- Recessed black tracks (`#09090B`) with dual-tone progress fills: primary in brushed gold gradient, secondary in slate obsidian.
- Real-time tally updates render with mechanical numeric tick animations.