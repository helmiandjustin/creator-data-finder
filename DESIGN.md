---
name: Creator Data Finder
description: Internal cloud creator database with dual Listing and Hijack tracking
colors:
  neutral-bg: "#f5f7fb"
  surface: "#ffffff"
  ink: "#172033"
  ink-soft: "#66728a"
  ink-muted: "#73809a"
  primary: "#2563d9"
  primary-hover: "#1d4fb3"
  primary-deep: "#205bc4"
  accent-soft: "#eef3fb"
  accent-soft-hover: "#dde8fa"
  line: "#e1e6ef"
  line-input: "#cbd4e2"
  success: "#19723e"
  success-soft: "#ecf7f1"
  success-line: "#b7d7c8"
  hijack-ink: "#17643e"
  danger: "#b42318"
  warning: "#96600e"
typography:
  display:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: "28px"
    fontWeight: 700
  headline:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: "19px"
    fontWeight: 700
  title:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 800
    letterSpacing: "0.08em"
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "1.5"
  label:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  icon: "12px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "11px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.accent-soft}"
    textColor: "#2756a7"
    rounded: "{rounded.sm}"
    padding: "11px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.accent-soft-hover}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
  input:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "11px 12px"
  chip-status:
    rounded: "{rounded.full}"
    padding: "4px 8px"
  nav-active:
    textColor: "{colors.primary-deep}"
---

# Design System: Creator Data Finder

## Overview

**Creative North Star: "The Cloud Ledger"**

Creator Data Finder is an internal operator's console, not marketing. The whole system is built to make a high-volume, paste-heavy daily workflow feel calm, legible, and trustworthy. It lives on a cool near-white canvas with a restrained blue primary and a quiet, chip-based semantic vocabulary. There is no hero, no decorative illustration, and no dark theme — the interface disappears so the records do the talking.

The layout is tabular and dense by intent: cards stack as numbered work panels, data lives in tables with hairline row separators, and every control is a plain, unobtrusive rectangle. Density is earned through tight, consistent spacing and a clear hierarchy — small uppercase micro-labels introduce sections, while only actual data metrics get large numerals. Depth is expressed through subtle blue-tinted shadows and tonal surface tints rather than heavy decoration.

The signature idea is **two-tone data semantics**: the master Listing dataset is always blue, and the campaign-attribution Hijack dataset is always green. Provenance reads at a glance anywhere in the app — dashboard blocks, chips, and pipe steps carry the same hue code. This is a functional color system, not an accent for flair.

**Key Characteristics:**
- Cool, light near-white canvas with a single confident blue primary.
- Dual semantic hue code: blue = Listing, green = Hijack.
- Dense tabular layouts with hairline separators; no decorative imagery.
- Subtle blue-tinted shadows and tonal gradient blocks for depth.
- Uppercase micro-labels; large numerals reserved for metrics only.

## Colors

The palette is cool, light, and low-chroma, with two data-meaning accents (blue and green) that never quarrel with each other.

### Primary
- **Cloud Blue** (#2563d9): The single action color. Primary buttons, active nav underline, active stepper steps, listed metric icons, and the highlighted "selected day" control. It is the only interactive accent.
- **Deep Navy Blue** (#1d4fb3): Hover state for the primary button — the same action reads as pressed slightly deeper.
- **Link Blue** (#205bc4): Text and underline for active navigation and embedded text links (`.p-username`, `a`).

### Secondary
- **Soft Azure** (#eef3fb): Background of secondary buttons and quiet, non-primary actions; its text is a darker `#2756a7`.

### Tertiary (data semantic)
- **Listing Blue Tint** (#edf3ff, border #dce7ff): Surface of Listing metric blocks and blue-toned stat panels.
- **Hijack Green Tint** (#eaf9f0, border #d3efdd): Surface of Hijack metric blocks; its ink is `#3b8061` / `#17643e`.

### Neutral
- **Cloud Mist** (#f5f7fb): App background — the cool canvas everything sits on.
- **White** (#ffffff): Card and input surfaces.
- **Ink Navy** (#172033): Headings and primary text.
- **Slate Blue** (#66728a): Body copy and table header text.
- **Muted Slate** (#73809a): Placeholder and quiet labels.
- **Hairline** (#e1e6ef / #edf0f5): Card borders and table row separators.

### Named Rules
**The Two-Ledger Rule.** Listing is always blue; Hijack is always green. A block, chip, or icon that reports on a particular dataset uses that dataset's hue — never a decorative third color. Provenance is always legible.

## Typography

**Display Font:** Inter (with `ui-sans-serif, system-ui, sans-serif` fallback). One family carries the whole system; hierarchy is made with size, weight, and tracking rather than font changes.

**Character:** Precise and quietly technical. Weights step cleanly (500 body, 650/700 buttons and headings, 700–800 for labels and numerals). Wide tracking on uppercase micro-labels signals structure without shouting.

### Hierarchy
- **Display** (700, 28px): The single `h1` page title; rare.
- **Headline** (700, 19px): Panel titles (`h2`) atop each card.
- **Title** (800, 14px, letter-spacing 0.08em, uppercase): Metric labels ("LISTING", "HIJACK RECORDS", summary labels).
- **Body** (500, 14px): Descriptions and helper copy; the default measure keeps lines short inside narrow cards.
- **Label** (700, 12px, letter-spacing 0.05em, uppercase): Table headers (`th`) and the header eyebrow.

### Named Rules
**The Metric-Numeral Rule.** Large numerals (48px on metrics, 34–54px on summary cards) are reserved strictly for data values and read in deep navy `#13234a`/`#172033`. Headings stay at 19–28px; nothing decorative is large.

## Layout

The app is a single centered column with a max width of **1180px** and generous outer padding (32px 24px 60px). Panels are white cards stacked with about 18px separation, each holding one logical workflow. Inside a card, content is organized in two-column grids (asymmetric, e.g. 1.35fr/0.65fr) that collapse to a single column at 700–800px. A horizontal nav bar with a 2px underline active state sits above the panels, and the workspace wraps in a scroll region (min table width 750–900px) so dense grids never crush.

Spacing follows a tight rhythm: card padding 22px, internal gaps 10–16px, control padding 8–12px. At ≤700px everything tightens (14–18px padding, single column, stacked toolbars). The shell is calm and consistent; density comes from the tables, not from clutter.

## Elevation & Depth

The system is **mostly flat with one soft, blue-tinted shadow** used on cards and dropdowns. Depth is otherwise conveyed by tonal surface tints and hairline borders, not hard shadows.

### Shadow Vocabulary
- **Card shadow** (`0 4px 16px #263b6310`): The default resting elevation for every card — faint, cool, and barely perceptible.
- **Dropdown shadow** (`0 10px 24px rgba(28,45,78,.14)`): A firmer lift reserved for floating popovers (the brand/product results menu).

### Named Rules
**The Flat-by-Default Rule.** Surfaces rest flat with a hairline border; shadow is a single quiet step used only on cards and dropdowns — never as a decorative glow or on hover.

## Shapes

The form language is **softly rounded but restrained**: full-radius pills only where a status or step is a discrete token, modest 8px radius on controls, and 12–16px on containers. A single 1px hairline border defines edges; inputs and buttons share the 8px radius so controls read as one family. Status chips, stepper pills, and metric icons are the only fully-rounded or distinctly shaped elements, giving the strict rectangular grid a few friendly, scannable anchors.

## Components

### Buttons
- **Shape:** Gentle corners (8px radius); transparent background, solid fill.
- **Primary:** Cloud Blue fill, white text, 11px 16px padding, weight 650. Hover deepens to Deep Navy Blue (`#1d4fb3`).
- **Secondary:** Soft Azure fill (`#eef3fb`) with deep blue text (`#2756a7`); hover warms to `#dde8fa`.
- **Danger:** Solid red `#b42318` fill, white text, disabled at 50% opacity — reserved for destructive deletes.
- **Link (.link):** Text-only, blue `#265fca`, left-aligned, 13px.

### Chips / Status Pills
- **Style:** Fully rounded (999px), 4px 8px padding, 12px weight-700 text on a tinted fill.
- **Semantic states:** neutral (`#eef1f6`/`#556278`), success/found (`#e7f6ec`/`#18723c`), warning/not-found (`#fff3df`/`#96600e`), danger/duplicate (`#fde9e7`/`#a12a20`). Pills carry the same blue/green meaning as the metric blocks.

### Cards / Containers
- **Corner Style:** 12px radius (up to 14–16px on dashboard variants).
- **Background:** White; tinted soft-blue or soft-green gradient blocks for metric panels.
- **Shadow Strategy:** the single card shadow (see Elevation).
- **Border:** 1px hairline `#e1e6ef`.
- **Internal Padding:** 22px, tightening to 16px on narrow screens.

### Inputs / Fields
- **Style:** 1px `#cbd4e2` stroke, 8px radius, 11px 12px padding, white fill, inherited font.
- **Focus:** the border deepens to Cloud Blue.
- **Grid inputs:** borderless full-width cells inside the paste grids; the active row gets a pale blue focus tint (`#f4f8ff`).

### Navigation
- Horizontal tab bar with 1px bottom hairline; active tab carries a 2px underline in Link Blue (`#205bc4`) with the same text color. Inactive tabs are muted slate. No background fill — the underline is the whole signal.

### Signature Component: Stepper (Import Pipeline)
The pipeline is a row of pill steps that track progress. Each step is a full-radius pill with a circular dot (20px) showing the index or a check. **Active** steps get a blue border and tint; **done** steps turn green (border `#b7d7c8`, fill `#ecf7f1`, ink `#19723e`) and become clickable to jump back. Completed steps are the only place the green Hijack hue appears in a workflow control, tying back to the two-ledger semantic.

## Do's and Don'ts

### Do:
- **Do** keep the two data hues sacred: blue for Listing, green for Hijack, everywhere.
- **Do** use uppercase micro-labels (12–14px, 0.05–0.08em tracking) for table headers and metric labels.
- **Do** reserve large numerals for data metrics only.
- **Do** keep tables compact with hairline row separators and left-aligned cells.
- **Do** use fully-rounded pills for discrete status and step tokens.

### Don't:
- **Don't** introduce a third accent hue that competes with the blue/green data semantics.
- **Don't** replace hairline borders with heavy or colorful shadows.
- **Don't** center-align table cells — alignment is consistently left.
- **Don't** use large display type outside the page title and metric numerals.
- **Don't** add decorative gradients, glass, or imagery; the app is an operator console, not a showcase.
