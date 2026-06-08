export interface FarmSectionData {
  id: string;
  name: string;
  nameEn: string;
  area?: string;
  areaEn?: string;
  descriptionEn?: string;
  type: 'greenhouse' | 'nursery' | 'building' | 'growing' | 'germination' | 'visitor' | 'production';
  color: string;       // border color (used for zone outline + legend)
  position: { x: number; y: number; width: number; height: number };
}

// Border colors per zone type (matches the reference design)
export const TYPE_BORDER_COLORS: Record<FarmSectionData['type'], string> = {
  greenhouse:  '#4a9e5c', // green
  growing:     '#7dba2f', // yellow-green
  nursery:     '#9ab89a', // muted green-gray
  building:    '#a8a89a', // gray
  germination: '#3dbfa8', // teal
  visitor:     '#d4a0c8', // pink/mauve
  production:  '#3d4a4d', // dark slate
};

export const TYPE_LABELS: Record<FarmSectionData['type'], { he: string; en: string }> = {
  greenhouse:  { he: 'חממת גידול רגילה',  en: 'Regular Greenhouse'   },
  growing:     { he: 'חממת גידול קטנה',   en: 'Small Greenhouse'     },
  nursery:     { he: 'משתלה',              en: 'Nursery'              },
  building:    { he: 'חניה',               en: 'Parking / Shed'       },
  germination: { he: 'חממת מבקרים',       en: 'Visitor Greenhouse'   },
  visitor:     { he: 'מרכז מבקרים',       en: 'Visitor Center'       },
  production:  { he: 'מפעל ייצור',        en: 'Production Facility'  },
};

const GH_DESC_EN   = 'Main growing greenhouse for pepper cultivation, equipped with automated irrigation and climate control.';
const GH_SMALL_EN  = 'Secondary growing greenhouse used for overflow capacity and specialty pepper cultivation.';
const GERM_DESC_EN = 'Visitor greenhouse with display plants, interactive exhibits, and educational materials about pepper varieties.';

// Zone types that are valid targets for FIRST planting of a new seedling
export const PLANTABLE_ZONE_TYPES = new Set<FarmSectionData['type']>(['nursery']);

// Zone types that are valid targets when TRANSFERRING an existing seedling
export const TRANSFER_TARGET_ZONE_TYPES = new Set<FarmSectionData['type']>([
  'greenhouse',   // GH-01 to GH-08 — regular growing greenhouses
  'growing',      // GH-09, GH-10   — small growing greenhouses
  'germination',  // GERM-01 to GERM-04 — visitor greenhouses
]);

export const FARM_SECTIONS: FarmSectionData[] = [
  { id: 'GH-01', name: 'חממת גידול 1',  nameEn: 'Greenhouse 1',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: TYPE_BORDER_COLORS.greenhouse,  position: { x: 40,   y: 40,  width: 58,  height: 320 } },
  { id: 'GH-02', name: 'חממת גידול 2',  nameEn: 'Greenhouse 2',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: TYPE_BORDER_COLORS.greenhouse,  position: { x: 105,  y: 40,  width: 58,  height: 320 } },
  { id: 'GH-03', name: 'חממת גידול 3',  nameEn: 'Greenhouse 3',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: TYPE_BORDER_COLORS.greenhouse,  position: { x: 170,  y: 40,  width: 58,  height: 320 } },
  { id: 'GH-04', name: 'חממת גידול 4',  nameEn: 'Greenhouse 4',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: TYPE_BORDER_COLORS.greenhouse,  position: { x: 235,  y: 40,  width: 58,  height: 320 } },
  { id: 'GH-05', name: 'חממת גידול 5',  nameEn: 'Greenhouse 5',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: TYPE_BORDER_COLORS.greenhouse,  position: { x: 300,  y: 40,  width: 58,  height: 320 } },
  { id: 'GH-06', name: 'חממת גידול 6',  nameEn: 'Greenhouse 6',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: TYPE_BORDER_COLORS.greenhouse,  position: { x: 365,  y: 40,  width: 58,  height: 320 } },
  { id: 'GH-07', name: 'חממת גידול 7',  nameEn: 'Greenhouse 7',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: TYPE_BORDER_COLORS.greenhouse,  position: { x: 430,  y: 40,  width: 58,  height: 320 } },
  { id: 'GH-08', name: 'חממת גידול 8',  nameEn: 'Greenhouse 8',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: TYPE_BORDER_COLORS.greenhouse,  position: { x: 495,  y: 40,  width: 58,  height: 320 } },
  { id: 'NURSERY',    name: 'משתלה',         nameEn: 'Nursery',             descriptionEn: 'Plant nursery for seedling propagation and early-stage growth before transplanting to production greenhouses.', type: 'nursery',     color: TYPE_BORDER_COLORS.nursery,     position: { x: 560,  y: 40,  width: 60,  height: 180 } },
  { id: 'SHED-MAIN',  name: 'חניה',          nameEn: 'Main Shed',           descriptionEn: 'Main parking area and equipment storage facility serving farm staff and visitors.',                           type: 'building',    color: TYPE_BORDER_COLORS.building,    position: { x: 637,  y: 42,  width: 140, height: 180 } },
  { id: 'GH-09', name: 'חממת גידול 9',  nameEn: 'Greenhouse 9',        area: '300 מ"ר', areaEn: '300 m²', descriptionEn: GH_SMALL_EN,  type: 'growing',     color: TYPE_BORDER_COLORS.growing,     position: { x: 560,  y: 230, width: 217, height: 60  } },
  { id: 'GH-10', name: 'חממת גידול 10', nameEn: 'Greenhouse 10',       area: '300 מ"ר', areaEn: '300 m²', descriptionEn: GH_SMALL_EN,  type: 'growing',     color: TYPE_BORDER_COLORS.growing,     position: { x: 560,  y: 300, width: 217, height: 60  } },
  { id: 'GERM-01',    name: 'חממת מבקרים 1', nameEn: 'Germination 1',       descriptionEn: GERM_DESC_EN, type: 'germination', color: TYPE_BORDER_COLORS.germination, position: { x: 815,  y: 42,  width: 200, height: 48  } },
  { id: 'GERM-02',    name: 'חממת מבקרים 2', nameEn: 'Germination 2',       descriptionEn: GERM_DESC_EN, type: 'germination', color: TYPE_BORDER_COLORS.germination, position: { x: 815,  y: 97,  width: 200, height: 48  } },
  { id: 'GERM-03',    name: 'חממת מבקרים 3', nameEn: 'Germination 3',       descriptionEn: GERM_DESC_EN, type: 'germination', color: TYPE_BORDER_COLORS.germination, position: { x: 815,  y: 255, width: 200, height: 48  } },
  { id: 'GERM-04',    name: 'חממת מבקרים 4', nameEn: 'Germination 4',       descriptionEn: GERM_DESC_EN, type: 'germination', color: TYPE_BORDER_COLORS.germination, position: { x: 815,  y: 310, width: 200, height: 48  } },
  { id: 'VIS-CENTER', name: 'מרכז מבקרים',   nameEn: 'Visitor Center',      descriptionEn: 'Visitor center providing guided tours, tasting sessions, and educational programs about sustainable pepper farming.', type: 'visitor',     color: TYPE_BORDER_COLORS.visitor,     position: { x: 858,  y: 146, width: 110, height: 100 } },
  { id: 'FACTORY',    name: 'מפעל ייצור',    nameEn: 'Production Facility', descriptionEn: 'Production facility for post-harvest processing, packaging, quality control, and dispatch of farm products.',       type: 'production',  color: TYPE_BORDER_COLORS.production,  position: { x: 1055, y: 40,  width: 110, height: 320 } },
];
