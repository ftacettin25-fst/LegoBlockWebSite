The user wants a redesigned team page for a 2-person company (Halil & Fikret). Currently the team section is embedded in `src/routes/index.tsx` with 3 placeholder people. They want a dedicated layout with a toggle for the center photo.

## Layout (desktop)

Three-column grid spanning full width inside the section container:

- Left column (1/4): Halil's info card (name, role, short bio, maybe socials)
- Middle column (2/4): Large photo with toggle pill button overlaid on top
- Right column (1/4): Fikret's info card

On mobile (current viewport 464px): stack vertically — Halil → photo+toggle → Fikret.

## Toggle button

A segmented pill control sitting above (or overlaid at top-center of) the photo:

```
[ Real ● | ○ Lego ]
```

- Two segments: "Real" (right-side label per user's wording — "right is highlighted... photo from real world") and "Lego" (left side, label when active).
- Wait — re-reading: "in the button there must be right and left, right is highlighted and a text something which indicates that is a photo from real world and in the left when user press highlighted would write lego". So default state: right side highlighted, label says "Real / Photo". Click → left side highlights, label says "Lego". Cycles back and forth on each click.
- Implement as a single button (or two-segment toggle) where clicking anywhere flips the active side. Active side has filled background (`bg-primary text-primary-foreground`), inactive is muted. Smooth transition.
- State: `useState<"real" | "lego">("real")`. onClick toggles.
- Image swap: two `<img>` sources (placeholder URLs for now since real photos don't exist yet). Use a smooth crossfade (opacity transition) between them.

## Where to put it

Two options:

1. Replace the existing `#team` section in `src/routes/index.tsx` in place.
2. Create a dedicated `/team` route file `src/routes/team.tsx` and link to it.

Per TanStack Start conventions in this project (separate routes for distinct sections, better SEO), **create `src/routes/team.tsx`** as a new route AND keep a brief teaser on the home page that links to `/team`. But the user said "in the team page" — they're treating it as a page already. Current "team" is just an anchor section. I'll create the dedicated route and update the navbar/home anchor to link to `/team`.

Actually simpler and matching user intent: since the existing site uses `#team` as an in-page section and the user said "team page", I'll **replace the team section content in `src/routes/index.tsx`** with the new layout. This avoids navbar changes and matches current architecture. If user later wants a separate route, easy to extract.

Decision: edit the team section in `src/routes/index.tsx` in place. Keep `id="team"` so existing nav anchor still works.

## Placeholder content

- Halil — Co-founder. Short bio line ("Designs the brick patterns and obsesses over color accuracy.") — user can edit later.
- Fikret — Co-founder. Short bio line ("Builds the 3D pipeline and ships every order on time.")
- Photos: use two placeholder image URLs (unsplash portrait + a brick/lego placeholder) until user uploads real ones. Mark clearly in comments.

## Files to change

- `src/routes/index.tsx` — replace the `#team` section (the block currently rendering 3 cards) with the new 3-column layout + toggle.

No new dependencies. Uses existing `Card`, `Button`, lucide icons (`Camera`, `Blocks` or similar for the toggle labels).

## Technical notes

- Use `grid-cols-1 lg:grid-cols-4` with the photo column spanning 2 (`lg:col-span-2`) and side cards spanning 1 each.
- Photo container: `aspect-[4/5]` or `aspect-square`, `relative` with toggle absolutely positioned at top center, `rounded-xl overflow-hidden`.
- Crossfade: stack both images absolutely, toggle opacity based on state.
- Toggle component inline (small, no need for a separate file).
