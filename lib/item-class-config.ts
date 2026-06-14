export const REORDERABLE_CLASSES = [
  "BATTERY",
  "BAT-MC",
  "BATT-VRLA",
  "BATT-PPLUS",
  "BATT-COMM",
  "BAT-S-STOP",
  "BAT-IND",
  "BATT-SOLAR",
  "BATT-GEL",
  "BAT-MAC",
  "BAT-OPTIMA",
  "RKT-BATT",
  "BATTERY-AP",
  "BAT-PR-ALK",
  "ACC-MAJIC",
  "ACCESS",
  "ACC-T-END",
  "ACC-ENG-CO",
  "ACC-DI-WAT",
  "ACC-W-WASH",
  "ACC-CABLES",
  "ARMORAL",
  "TB-W-BLADE",
  "WD-40",
  "JHN-PROD",
  "VERSACHEM",
  "CB-FLUID",
  "TBC-OIL",
  "SHELL-OIL",
  "FRZ-TONE",
  "SOL-CABLES",
  "SOL-PANEL",
  "SOL-ACCESS",
  "SOL-INV",
  "VICTRON",
  "MOB-SERV",
  "BAT SERV",
  "SOL-SERV",
  "E-BIKE",
  "VALVES",
] as const;

export const NON_STOCK_CLASSES = [
  "GY-TYRE",
  "HANKOOK",
  "NEXEN",
  "ROADSTONE",
  "LAUFENN",
  "MABOR-CONT",
  "OTANI",
  "CON-TYRES",
  "ROADCRUZA",
  "GY-TUBES",
  "GY-FLAPS",
  "GYR-RUBBER",
  "MATERIALS",
  "DW-RAW-MAT",
  "R-MAT-CBF",
  "CASTROL",
  "MOBIL-OIL",
  "OIL-QS",
  "PENNZOIL",
  "OIL-FILTER",
  "FILTER",
  "REBATE",
  "SCRAP",
  "SCRAP-BATT",
  "SCRAP SERV",
  "SPENT-BAT",
  "PROM",
  "PROMO",
  "BOOKS",
  "ELEC",
  "FURN",
  "FLEET",
  "MISC",
  "CUST-DATA",
  "GUNK",
  "HELMETS",
  "PLUGS",
  "PK-DSK-PAD",
  "PURPLE1",
  "CHEVRON",
  "TYRE SERV.",
  "SERV",
  "EXT-WARR",
  "COMP",
  "RKT-DI",
] as const;

export type NonStockGroupLabel =
  | "Tyres"
  | "Raw Materials"
  | "Oils and Filters"
  | "Services"
  | "Scrap/Disposal"
  | "Promotional and Other";

export const NON_STOCK_GROUP_DEFINITIONS: ReadonlyArray<{
  label: NonStockGroupLabel;
  classes: readonly string[];
}> = [
  {
    label: "Tyres",
    classes: [
      "GY-TYRE",
      "HANKOOK",
      "NEXEN",
      "ROADSTONE",
      "LAUFENN",
      "MABOR-CONT",
      "OTANI",
      "CON-TYRES",
      "ROADCRUZA",
      "GY-TUBES",
      "GY-FLAPS",
      "GYR-RUBBER",
    ],
  },
  {
    label: "Raw Materials",
    classes: ["MATERIALS", "DW-RAW-MAT", "R-MAT-CBF"],
  },
  {
    label: "Oils and Filters",
    classes: ["CASTROL", "MOBIL-OIL", "OIL-QS", "PENNZOIL", "OIL-FILTER", "FILTER"],
  },
  {
    label: "Services",
    classes: ["TYRE SERV.", "SERV", "EXT-WARR", "COMP", "RKT-DI"],
  },
  {
    label: "Scrap/Disposal",
    classes: ["REBATE", "SCRAP", "SCRAP-BATT", "SCRAP SERV", "SPENT-BAT"],
  },
  {
    label: "Promotional and Other",
    classes: [
      "PROM",
      "PROMO",
      "BOOKS",
      "ELEC",
      "FURN",
      "FLEET",
      "MISC",
      "CUST-DATA",
      "GUNK",
      "HELMETS",
      "PLUGS",
      "PK-DSK-PAD",
      "PURPLE1",
      "CHEVRON",
    ],
  },
];

const REORDERABLE_CLASS_SET = new Set(
  REORDERABLE_CLASSES.map((value) => normalizeItemClass(value))
);
const NON_STOCK_CLASS_SET = new Set(
  NON_STOCK_CLASSES.map((value) => normalizeItemClass(value))
);

const NON_STOCK_GROUP_BY_CLASS = new Map<string, NonStockGroupLabel>(
  NON_STOCK_GROUP_DEFINITIONS.flatMap((group) =>
    group.classes.map((itemClass) => [
      normalizeItemClass(itemClass),
      group.label,
    ] as const)
  )
);

export function normalizeItemClass(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function isReorderableClass(itemClass: string | null | undefined): boolean {
  const normalized = normalizeItemClass(itemClass);
  return normalized.length > 0 && REORDERABLE_CLASS_SET.has(normalized);
}

export function isNonStockClass(itemClass: string | null | undefined): boolean {
  const normalized = normalizeItemClass(itemClass);
  return normalized.length > 0 && NON_STOCK_CLASS_SET.has(normalized);
}

export function getNonStockGroupLabel(
  itemClass: string | null | undefined
): NonStockGroupLabel {
  const normalized = normalizeItemClass(itemClass);
  return NON_STOCK_GROUP_BY_CLASS.get(normalized) ?? "Promotional and Other";
}

export const NON_STOCK_GROUP_ORDER: NonStockGroupLabel[] = [
  "Tyres",
  "Raw Materials",
  "Oils and Filters",
  "Services",
  "Scrap/Disposal",
  "Promotional and Other",
];
