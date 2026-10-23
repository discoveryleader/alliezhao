# My Book Library: Design Plan

## 1. Goal

A personal place to keep track of the books you own, borrow and read. Add a book by photographing its barcode, then record how you read it: status, dates, rating, format, location, category and tags.

**Primary user:** one person managing their own shelf, mostly on a phone (scanning) and sometimes on a laptop (browsing and editing).

**Success looks like:**
- Adding a book takes under 15 seconds (photo, check details, save).
- You can answer "what am I reading?", "what did I rate 5 stars?" and "which books are at the library?" in two taps.
- Nothing you entered is ever lost.

## 2. Where we are today

Already built (single page, `my-book-library/index.html`):

| Area | Status |
|---|---|
| Barcode photo → ISBN → title, author, cover (Open Library, Google Books fallback) | Built, tested with mock data only |
| Manual ISBN entry, manual add, "book not found" path | Built |
| Edit form: cover (auto or upload), rating, status + dates, type, category, location, tags | Built |
| Search, status tabs, filters (category, tag, type, location, rating), sorting | Built |
| Grid and list views | Built |
| Export / import, light and dark mode, phone layout | Built |
| Storage | Browser only (localStorage) |

## 3. Design principles

1. **Scan first.** The fastest path is always the most prominent one.
2. **Confirm, don't type.** Pre-fill everything we can; the user only corrects.
3. **Calm and bookish.** Warm paper tones, a serif title, covers as the main visual.
4. **Never lose data.** Anything saved should survive, and anything destructive should be reversible.
5. **Works at phone width first.** Then scale up.

Visual references from Mobbin: [corner](https://mobbin.com/screens/93ede575-15a1-4cf3-8fd1-145608e39926) (segmented status control), [Once](https://mobbin.com/screens/d4dcb2ca-977c-45d8-ae64-27ac1e3a7f33) (cover with "Change cover"), [NotebookLM](https://mobbin.com/screens/5c10dae4-d970-45ad-b7af-c9f2ec9fd9aa) (card grid with a "create new" tile and grid/list toggle), [Klarna](https://mobbin.com/screens/f5d4e3b5-a4bc-4502-9904-bcf37882ecc5) and [Bevel](https://mobbin.com/screens/b1f1b8d0-0c27-4157-a4a1-3f05e69d825a) (scan frame with manual entry below).

## 4. P0: must have (trust and core flow)

These make the app dependable. Ship before adding anything new.

| # | Item | Why | Done when |
|---|---|---|---|
| P0-1 | **Verify live lookups with real books** | Testing so far used made-up API responses | 10 real books (different publishers, one with no cover, one not in either database) add correctly |
| P0-2 | **Protect against data loss** | Data lives in one browser; clearing site data or switching phones erases it | Visible "last backed up" note, a gentle reminder to export after every 10 added books, and a one-tap Export from the footer |
| P0-3 | **Undo delete** | Delete currently ends with a confirm box only | "Book deleted · Undo" toast for 6 seconds |
| P0-4 | **Camera capture on phones** | Users should be able to point the camera at the barcode, not hunt for a saved photo | On phones, the upload area offers "Take photo" as well as "Choose photo" |
| P0-5 | **Scan reliability pass** | Real photos are blurry, angled, glared | Success on 8 of 10 test photos taken on a phone in normal room light; clear guidance when it fails (hold steady, fill the frame, avoid glare) |
| P0-6 | **Offline and blocked-script fallback** | Barcode decoder and fonts load from the internet | If the decoder script fails to load, the page says so and ISBN entry still works; the library itself works offline |
| P0-7 | **Accessibility basics** | Dialogs, star rating and tabs need to work without a mouse | Full keyboard path for scan → save; visible focus; 4.5:1 text contrast in light and dark; stars announced to screen readers; reduced-motion respected |
| P0-8 | **Duplicate protection beyond ISBN** | Manual adds can create the same book twice | Warn when a book with the same title and author already exists |

## 5. P1: should have (speed and richer tracking)

Builds on a trustworthy base.

| # | Item | Why | Done when |
|---|---|---|---|
| P1-1 | **Live camera scanning** | Skips the photo step entirely | Camera view reads the barcode continuously on supported browsers, with photo upload still available |
| P1-2 | **Add several books in a row** | Cataloguing a shelf is the biggest one-time chore | "Save and scan next" button keeps the flow going |
| P1-3 | **Quick actions on cards** | Changing status or rating shouldn't need the full form | Long-press or "⋯" menu on a card: change status, set rating, mark finished today |
| P1-4 | **Shorter edit form** | Form is long on a phone | Sections (Reading, Details, Organise) with the rarely used ones collapsed; Save always visible |
| P1-5 | **Reading stats** | Reason to come back | Header strip: books finished this year, average rating, currently reading |
| P1-6 | **Smarter categories and tags** | Free text will drift ("Sci-fi" vs "Sci-Fi") | Suggest existing values as you type; manage screen to rename or merge a tag or category |
| P1-7 | **Notes and review** | Ratings alone lose the "why" | Optional short note field on each book, shown in the edit form |
| P1-8 | **Sync across devices** | Phone and laptop should show the same shelf | Decision needed: sign-in with hosted database, or file-based sync. Either way, no data loss on first sync |
| P1-9 | **Empty and first-run experience** | New users see a mostly blank page | A short first-run card: "Scan your first book", with a sample barcode to try |
| P1-10 | **Print / share list** | Lending lists, wish lists | Export the current filtered view as CSV |

## 6. Later (not planned yet)

Wish list and lent-out tracking with return dates, reading goals, series grouping, lookup by title search when there is no barcode, import from Goodreads CSV.

## 7. Key screens and states to design

| Screen | States to cover |
|---|---|
| Library (grid) | Empty, loading covers, no results, filters active |
| Library (list) | Same as above; rows collapse on phone |
| Scan | Idle, reading, no barcode found, not an ISBN, no network |
| Review and edit | New (found), new (not found), existing, already in library, validation error |
| Delete | Confirm, then undo toast |
| Filters | Closed, open, count badge, cleared |

## 8. Open questions

1. Is this for one person, or should a household share one shelf? (Decides P1-8.)
2. Do you want the library hosted online, or kept as a file you open locally?
3. Is "Library" as a location meant for borrowed books only? If so, we could add a due date to P1.

## 9. Suggested order

1. P0-1, P0-5, P0-4 (make scanning genuinely reliable on a phone)
2. P0-2, P0-3, P0-8 (protect the user's data)
3. P0-6, P0-7 (resilience and accessibility)
4. P1-2, P1-3, P1-4 (faster everyday use)
5. P1-5, P1-6, P1-7, P1-9, P1-10
6. P1-1, P1-8 once the hosting question is answered
