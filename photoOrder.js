// inspekt-shared/photoOrder.js
//
// Canonical photo-ordering logic, used by all three consumers:
//   - inspektit-app (iOS)        → drives in-app review tab + preview
//   - inspekt-web src/lib        → drives web upload + reorder UI
//   - inspekt-web api/report-jobs → drives cloud-generated PDF
//
// Pure logic, no platform deps, no env vars. Edit ONLY here. The
// consumer repos pull this file via the `shared/` git submodule.

// ─── Computed sort_order from section/subsection ───────────────────────────
// Returns an integer (or decimal for elevation children) that places a photo
// in the canonical reading order: Risk → Roof → Front/Right/Back/Left
// elevations → Interior → Other Structures → Personal Property.
//
// `context` is read for two things only:
//   - context.roomIds: array of interior room ids in display order; used to
//     group interior photos by room.
//
// Photos that don't match any of the rules below get 999999 (sort to end).
export function getPhotoSortOrder(section, subsection = '', context = {}) {
  const key = `${section}::${subsection}`
  const sub = subsection || ''

  const ORDER = {
    // Top level
    'risk::risk_shot': 10,
    'risk::address_verification': 20,
    'interview::contractor_business_card': 30,

    // Roof
    'roof::roof_details': 100,

    'roof::slope_overview_Front': 110,
    'roof::slope_overview_Right': 120,
    'roof::slope_overview_Back': 130,
    'roof::slope_overview_Left': 140,

    'roof::test_square_Front_overview': 150,
    'roof::test_square_Front_details': 151,
    'roof::test_square_Front_hail_hits': 152,
    'roof::test_square_Front_wind_damage': 153,
    // Shingle close-up (formerly "No damage on roof" — UI renamed
    // 2026-05-11, subsection key kept stable so existing photos still sort).
    'roof::test_square_Front_non_claim': 154,
    // Non-claim damage capture types — added 2026-05-11. Slot in decimal
    // increments between Shingle close-up (154) and the next slope's overview
    // (160) so existing rows aren't renumbered. Order mirrors the
    // NON_CLAIM_DAMAGE_TYPES array in inspektit-app's inspectionSchema.js.
    'roof::test_square_Front_nc_mech': 154.1,
    'roof::test_square_Front_nc_wear': 154.2,
    'roof::test_square_Front_nc_nail_pop': 154.3,
    'roof::test_square_Front_nc_tree_rub': 154.4,
    'roof::test_square_Front_nc_foot_traffic': 154.5,
    'roof::test_square_Front_nc_defect': 154.6,
    'roof::test_square_Front_nc_algae': 154.7,
    'roof::test_square_Front_nc_improper_install': 154.8,

    'roof::test_square_Right_overview': 160,
    'roof::test_square_Right_details': 161,
    'roof::test_square_Right_hail_hits': 162,
    'roof::test_square_Right_wind_damage': 163,
    'roof::test_square_Right_non_claim': 164,
    'roof::test_square_Right_nc_mech': 164.1,
    'roof::test_square_Right_nc_wear': 164.2,
    'roof::test_square_Right_nc_nail_pop': 164.3,
    'roof::test_square_Right_nc_tree_rub': 164.4,
    'roof::test_square_Right_nc_foot_traffic': 164.5,
    'roof::test_square_Right_nc_defect': 164.6,
    'roof::test_square_Right_nc_algae': 164.7,
    'roof::test_square_Right_nc_improper_install': 164.8,

    'roof::test_square_Back_overview': 170,
    'roof::test_square_Back_details': 171,
    'roof::test_square_Back_hail_hits': 172,
    'roof::test_square_Back_wind_damage': 173,
    'roof::test_square_Back_non_claim': 174,
    'roof::test_square_Back_nc_mech': 174.1,
    'roof::test_square_Back_nc_wear': 174.2,
    'roof::test_square_Back_nc_nail_pop': 174.3,
    'roof::test_square_Back_nc_tree_rub': 174.4,
    'roof::test_square_Back_nc_foot_traffic': 174.5,
    'roof::test_square_Back_nc_defect': 174.6,
    'roof::test_square_Back_nc_algae': 174.7,
    'roof::test_square_Back_nc_improper_install': 174.8,

    'roof::test_square_Left_overview': 180,
    'roof::test_square_Left_details': 181,
    'roof::test_square_Left_hail_hits': 182,
    'roof::test_square_Left_wind_damage': 183,
    'roof::test_square_Left_non_claim': 184,
    'roof::test_square_Left_nc_mech': 184.1,
    'roof::test_square_Left_nc_wear': 184.2,
    'roof::test_square_Left_nc_nail_pop': 184.3,
    'roof::test_square_Left_nc_tree_rub': 184.4,
    'roof::test_square_Left_nc_foot_traffic': 184.5,
    'roof::test_square_Left_nc_defect': 184.6,
    'roof::test_square_Left_nc_algae': 184.7,
    'roof::test_square_Left_nc_improper_install': 184.8,

    'roof::tarp_photos': 186,
    'roof::tarp_under_photos': 187,

    // Pipe jacks: legacy single bucket first, then subtypes
    'roof::ancillary_pipe_jack': 190,
    'roof::ancillary_pipe_jack_plastic': 191,
    'roof::ancillary_pipe_jack_lead': 192,
    'roof::ancillary_pipe_jack_split_boot': 193,
    'roof::ancillary_pipe_jack_metal_roof': 194,

    // Vents: legacy single bucket first, then subtypes
    'roof::ancillary_vents': 195,
    'roof::ancillary_vent_turtle_plastic': 196,
    'roof::ancillary_vent_turtle_metal': 197,
    'roof::ancillary_vent_standard': 198,
    'roof::ancillary_vent_furnace': 199,
    'roof::ancillary_vent_power_attic': 200,

    'roof::ancillary_rain_diverter': 201,

    'roof::ancillary_flashing': 202,
    'roof::ancillary_chimney': 203,
    'roof::ancillary_skylight': 204,
    'roof::ancillary_solar_panels': 205,
    'roof::ancillary_satellite_dish': 206,
    'roof::ancillary_antenna': 207,
    'roof::ancillary_hvac_curb_unit': 208,
    'roof::ancillary_attic_hatch': 209,
    'roof::ancillary_snow_guards': 210,
    'roof::ancillary_snow_melt_wire': 211,
    'roof::ancillary_weather_head': 212,
    'roof::ancillary_custom': 213,
    'roof::ancillary_other': 214,

    // Elevations — Front
    'front::overview': 300,
    'front::no_damage_closeups': 301,
    'front::soffit': 302,
    'front::fascia': 303,
    'front::gutter': 304,
    'front::gutter_guards': 305,
    'front::downspout': 306,
    'front::paint': 307,
    'front::siding': 308,
    'front::trim': 309,
    'front::door': 310,
    'front::window': 311,
    'front::ac': 312,
    'front::ancillary': 313,
    'front::dryer_vent': 314,
    'front::soffit_vent': 315,
    'front::gable_vent': 316,
    'front::shutters': 317,
    'front::window_screens': 318,
    'front::storm_door': 319,
    'front::exterior_light': 320,
    'front::hose_bib': 321,
    'front::meter_box': 322,
    'front::garage_door': 323,
    'front::garage_door_trim': 324,
    'front::low_voltage_box': 325,
    'front::elec_disconnect': 326,
    'front::elec_panel': 327,
    'front::weather_head': 328,
    'front::window_wells': 329,
    'front::decorative_trim': 330,
    'front::foundation_vent': 331,
    'front::custom': 332,

    // Elevations — Right
    'right::overview': 400,
    'right::no_damage_closeups': 401,
    'right::soffit': 402,
    'right::fascia': 403,
    'right::gutter': 404,
    'right::gutter_guards': 405,
    'right::downspout': 406,
    'right::paint': 407,
    'right::siding': 408,
    'right::trim': 409,
    'right::door': 410,
    'right::window': 411,
    'right::ac': 412,
    'right::ancillary': 413,
    'right::dryer_vent': 414,
    'right::soffit_vent': 415,
    'right::gable_vent': 416,
    'right::shutters': 417,
    'right::window_screens': 418,
    'right::storm_door': 419,
    'right::exterior_light': 420,
    'right::hose_bib': 421,
    'right::meter_box': 422,
    'right::garage_door': 423,
    'right::garage_door_trim': 424,
    'right::low_voltage_box': 425,
    'right::elec_disconnect': 426,
    'right::elec_panel': 427,
    'right::weather_head': 428,
    'right::window_wells': 429,
    'right::decorative_trim': 430,
    'right::foundation_vent': 431,
    'right::custom': 432,

    // Elevations — Back
    'back::overview': 500,
    'back::no_damage_closeups': 501,
    'back::soffit': 502,
    'back::fascia': 503,
    'back::gutter': 504,
    'back::gutter_guards': 505,
    'back::downspout': 506,
    'back::paint': 507,
    'back::siding': 508,
    'back::trim': 509,
    'back::door': 510,
    'back::window': 511,
    'back::ac': 512,
    'back::ancillary': 513,
    'back::dryer_vent': 514,
    'back::soffit_vent': 515,
    'back::gable_vent': 516,
    'back::shutters': 517,
    'back::window_screens': 518,
    'back::storm_door': 519,
    'back::exterior_light': 520,
    'back::hose_bib': 521,
    'back::meter_box': 522,
    'back::garage_door': 523,
    'back::garage_door_trim': 524,
    'back::low_voltage_box': 525,
    'back::elec_disconnect': 526,
    'back::elec_panel': 527,
    'back::weather_head': 528,
    'back::window_wells': 529,
    'back::decorative_trim': 530,
    'back::foundation_vent': 531,
    'back::custom': 532,

    // Elevations — Left
    'left::overview': 600,
    'left::no_damage_closeups': 601,
    'left::soffit': 602,
    'left::fascia': 603,
    'left::gutter': 604,
    'left::gutter_guards': 605,
    'left::downspout': 606,
    'left::paint': 607,
    'left::siding': 608,
    'left::trim': 609,
    'left::door': 610,
    'left::window': 611,
    'left::ac': 612,
    'left::ancillary': 613,
    'left::dryer_vent': 614,
    'left::soffit_vent': 615,
    'left::gable_vent': 616,
    'left::shutters': 617,
    'left::window_screens': 618,
    'left::storm_door': 619,
    'left::exterior_light': 620,
    'left::hose_bib': 621,
    'left::meter_box': 622,
    'left::garage_door': 623,
    'left::garage_door_trim': 624,
    'left::low_voltage_box': 625,
    'left::elec_disconnect': 626,
    'left::elec_panel': 627,
    'left::weather_head': 628,
    'left::window_wells': 629,
    'left::decorative_trim': 630,
    'left::foundation_vent': 631,
    'left::custom': 632,
  }

  const mapped = ORDER[key]
  if (mapped != null) return mapped

  // Custom items per section. CustomItemSection writes photos with
  // subsection = `custom_item_<itemId>`. Without differentiation all custom
  // item photos collide on a single sort_order (999999 fallback), and
  // secondary group_sequence sort interleaves photos across items
  // (item1-photo1, item2-photo1, item1-photo2, item2-photo2, ...).
  // To group them by item — preserving "item 1's photos in capture order,
  // then item 2's photos in capture order, ..." — we look up the item's
  // index in sortContext.customItemOrdersBySection[section] and assign
  // sort_order = sectionCustomBase + idx.
  if (sub.startsWith('custom_item_')) {
    const itemId = sub.slice('custom_item_'.length)
    const map = (context.customItemOrdersBySection || {})[section] || []
    const idx = map.indexOf(itemId)
    const CUSTOM_BASE_BY_SECTION = {
      roof:  250,   // after roof::ancillary_other (204), before interior (700)
      front: 333,   // after front::custom (332), before right::overview (400)
      right: 433,
      back:  533,
      left:  633,
    }
    const base = CUSTOM_BASE_BY_SECTION[section]
    if (base != null) {
      // Unknown item id (idx === -1) → push to end of the section's custom
      // range instead of colliding with idx 0. Keeps reorder predictable
      // when an item id appears in photos that the inspection state
      // doesn't list (rare — happens if the item was deleted post-capture).
      const safeIdx = idx >= 0 ? idx : map.length
      return base + safeIdx
    }
  }

  if (section === 'other_structures') {
    // FENCE first — fence subsection shape is `<id>_fence_<run>_<view>`
    // (e.g. `<fence_id>_fence_front_overview`). The string ends with
    // `_front_overview` so the elevation rules below would match it BEFORE
    // the legacy `_fence_` catch-all at the bottom. That collision put
    // fence-front photos at sort 1030 alongside Simple-mode Building
    // front-elevation photos, which then interleaved by capture timestamp.
    // Per-run buckets keep fence runs in their own contiguous block,
    // ordered front → right → back → left, AFTER any Building photos.
    // Discovered via Justin Waskow claim 01009818211, 2026-05-08.
    if (sub.includes('_fence_front_')) return 1071
    if (sub.includes('_fence_right_')) return 1072
    if (sub.includes('_fence_back_'))  return 1073
    if (sub.includes('_fence_left_'))  return 1074
    if (sub.includes('_fence_'))       return 1075  // unknown fence subsection

    // Building (Simple-mode), Pool, Awning, Landscape, Other — these use
    // the standard <structureId>_<area>_<view> shape. Detail-mode buildings
    // do NOT pass through this branch; they have section_key
    // `building_<id>_<area>` and are handled by the detail-mode block above.
    if (sub.endsWith('_roof_closeup')) return 1020
    if (sub.endsWith('_roof_overview')) return 1010
    if (sub.endsWith('_front_closeup') || sub.endsWith('_front_overview')) return 1030
    if (sub.endsWith('_right_closeup') || sub.endsWith('_right_overview')) return 1040
    if (sub.endsWith('_back_closeup') || sub.endsWith('_back_overview')) return 1050
    if (sub.endsWith('_left_closeup') || sub.endsWith('_left_overview')) return 1060
    if (sub.endsWith('_overview')) return 1000
    return 1080
  }

  // Elevation child subsections — group children with their parent item
  // in the photo report. Without this fallback, child photos like
  // `window_screen`, `door_glass`, and AC instance subcomponents
  // (`ac_<instanceId>_condenser_fins`) all fell through to 999999 and
  // sorted to the bottom of the elevation, interleaved by capture
  // timestamp. The decimal offsets keep each child group flush against
  // its parent (e.g. window_screen at 611.1 sits between window=611 and
  // ac=612). Requires photos.sort_order column to be NUMERIC (migrated
  // 2026-05-03 — see migration change_photos_sort_order_to_numeric).
  if (['front', 'right', 'back', 'left'].includes(section)) {
    // Door children (Storm Door, Glass, Frame/Jamb, Threshold, Hardware)
    // — see ChildComponentLauncher options for door in InspectionFlow.jsx.
    const DOOR_CHILDREN = ['storm_door', 'glass', 'frame_jamb', 'threshold', 'hardware']
    for (let i = 0; i < DOOR_CHILDREN.length; i += 1) {
      if (sub === `door_${DOOR_CHILDREN[i]}`) {
        const doorBase = ORDER[`${section}::door`]
        if (doorBase != null) return doorBase + (i + 1) / 10  // 610.1 .. 610.5
      }
    }

    // Window children (Screen, Glazing Bead, Glass, Frame, Wrap/Trim).
    const WINDOW_CHILDREN = ['screen', 'glazing_bead', 'glass', 'frame', 'wrap_trim']
    for (let i = 0; i < WINDOW_CHILDREN.length; i += 1) {
      if (sub === `window_${WINDOW_CHILDREN[i]}`) {
        const windowBase = ORDER[`${section}::window`]
        if (windowBase != null) return windowBase + (i + 1) / 10  // 611.1 .. 611.5
      }
    }

    // AC instances + their children. Subsection patterns produced by
    // RepeatableParentSection / InstanceCard / RequiredDocRow:
    //   ac_<instanceId>                     → AC instance overview
    //   ac_<instanceId>_ac_tag              → required doc photo
    //   ac_<instanceId>_<childKey>          → child row (condenser_fins,
    //                                         fan_guard, top_shroud,
    //                                         line_set_cover, disconnect, pad)
    // Layout per AC: instance overview, then tag, then child rows in
    // ChildComponentLauncher order. Supports up to 99 AC instances per
    // elevation (instanceIndex / 100 = 0.01 .. 0.99); each instance
    // reserves 0.0001-step slots for tag + 6 child rows.
    if (sub.startsWith('ac_') && sub !== 'ac') {
      const acBase = ORDER[`${section}::ac`]
      if (acBase != null) {
        const m = sub.match(/^ac_(\d+)(?:_(.+))?$/)
        if (m) {
          const instanceIndex = Number(m[1])
          const rest = m[2] || ''
          const instanceOffset = instanceIndex / 100
          // ac_tag first (required doc), then child rows in ItemConfig order.
          const AC_CHILD_OFFSETS = {
            '': 0,
            ac_tag: 0.0001,
            condenser_fins: 0.0002,
            fan_guard: 0.0003,
            top_shroud: 0.0004,
            line_set_cover: 0.0005,
            disconnect: 0.0006,
            pad: 0.0007,
          }
          const childOffset = AC_CHILD_OFFSETS[rest] ?? 0.0009  // unknown → last
          return acBase + instanceOffset + childOffset
        }
      }
    }
  }

  if (section === 'interior') {
    // Group by room first, then surface type within each room.
    // Each room gets a block of 10: room 0 = 700-709, room 1 = 710-719, etc.
    //
    // Range chosen to slot interior photos BETWEEN Left elevation
    // (max 632) and Other Structures (1000+) in the photo report. Per
    // adjuster workflow, the natural reading order is dwelling → roof
    // → elevations (front/right/back/left) → interior → other
    // structures → personal property.
    //
    // extractReportData.getEffectiveSortOrder always RECOMPUTES the
    // sort order for interior photos at report-generation time
    // (interior room ids can shift when rooms are added/removed), so
    // existing claims pick up this new range on the next report
    // regeneration without any DB migration.
    const roomIds = context.roomIds || []
    let roomId = sub
    let surfaceOffset = 0

    if (sub.endsWith('_ceiling')) {
      roomId = sub.replace(/_ceiling$/, '')
      surfaceOffset = 1
    } else if (sub.endsWith('_walls')) {
      roomId = sub.replace(/_walls$/, '')
      surfaceOffset = 2
    } else if (sub.endsWith('_floor')) {
      roomId = sub.replace(/_floor$/, '')
      surfaceOffset = 3
    } else if (sub.endsWith('_fixtures')) {
      roomId = sub.replace(/_fixtures$/, '')
      surfaceOffset = 4
    }
    // overview: surfaceOffset stays 0, roomId is the full subsection

    const roomIndex = roomIds.indexOf(roomId)
    const roomBase = roomIndex >= 0 ? roomIndex : roomIds.length
    return 700 + roomBase * 10 + surfaceOffset
  }

  // Detail-mode building photos live under `building_<id>_<area>` section
  // keys (set by DetailedBuildingFlow in inspektit-app). They conceptually
  // belong with Other Structures (1000-1199) since the building IS an
  // other-structure entry with mode: 'detail'. Slot them after Fence
  // (1070) and before Personal Property (1200), bucketed by area.
  //
  // Within an area, group_sequence (already used as the secondary sort
  // key by extractReportData and the web dashboard) breaks ties so
  // multi-photo areas keep capture order. For a claim with TWO detailed
  // buildings, photos interleave by area (all 'front' photos together
  // regardless of building) — acceptable for V1; if needed later, fold
  // a building index into the bucket math without breaking persisted
  // values.
  //
  // Discovered via Nahun Reyes claim 01009806143, 2026-05-06: 17 Shed
  // photos were stranded at 999999 and sorted AFTER personal property
  // because this branch did not exist. Existing claims keep their
  // persisted sort_order (getEffectiveSortOrder prefers persisted) so
  // this change is forward-only — no surprise reorders on closed claims.
  if (section.startsWith('building_')) {
    const m = section.match(/^building_.+_(roof|front|right|back|left|interior)$/)
    const area = m ? m[1] : null
    const AREA_BASE = { roof: 1100, front: 1110, right: 1120, back: 1130, left: 1140, interior: 1150 }
    if (area && AREA_BASE[area] != null) return AREA_BASE[area]
    return 1160 // building photo with unrecognized area suffix → end of OS slot
  }

  if (section === 'personal_property') return 1200

  return 999999
}

// ─── Effective sort_order for a photo row ──────────────────────────────────
// Picks the right sort_order to use at report-generation time, given that:
//   - Persisted DB sort_order is set at capture time using the rules above.
//   - Interior room ids can shift after capture (rooms added/removed/-
//     reordered) so interior photos are normally RECOMPUTED at report time.
//   - The web dashboard supports manual drag-and-drop reorder; when the
//     user drops a photo to a new position we set photos.manual_sort_-
//     override = true and write the new persisted sort_order. From that
//     point on, persisted ALWAYS wins for that photo (including interior).
//
// Used by extractReportData (cloud + iOS) and by the iOS PhotoReviewSurface.
//
// `sortContext` is forwarded to getPhotoSortOrder; supply { roomIds } when
// computing for interior photos.
export function getEffectiveSortOrder(photo, sortContext = {}) {
  const sectionKey = photo.section_key || photo.section || ''
  const subsectionKey = photo.subsection_key || photo.subsection || ''
  const computed = Number(getPhotoSortOrder(sectionKey, subsectionKey, sortContext))

  // Manual override: user dragged this photo into a custom position via the
  // web dashboard. Persisted wins for ALL sections including interior.
  if (photo.manual_sort_override === true) {
    const persisted = photo.sort_order != null ? Number(photo.sort_order) : NaN
    if (Number.isFinite(persisted)) return persisted
    // Fall through to default behavior if persisted is missing for some reason.
  }

  // Default interior behavior: ALWAYS recompute (room ids can shift).
  if (sectionKey === 'interior') return computed

  // Custom items: ALWAYS recompute. Reasons:
  //   1. Items added/reordered in the inspection should reorder their
  //      photos accordingly without a backfill.
  //   2. Photos captured before the per-item sort_order rule landed have
  //      a stale `sort_order = 999999` persisted; recompute fixes them
  //      on the fly.
  if (subsectionKey.startsWith('custom_item_')) return computed

  // Default non-interior behavior: prefer persisted, fall back to computed.
  const persisted = photo.sort_order != null ? Number(photo.sort_order) : NaN
  return Number.isFinite(persisted) ? persisted : computed
}
