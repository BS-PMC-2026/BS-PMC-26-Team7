export interface FarmSectionData {
  id: string;
  name: string;
  nameEn: string;
  area?: string;
  areaEn?: string;
  /** Fallback English description shown when the backend DB has not yet been updated with English text. */
  descriptionEn?: string;
  type: 'greenhouse' | 'nursery' | 'building' | 'growing' | 'germination' | 'visitor' | 'production';
  color: string;
  position: { x: number; y: number; width: number; height: number };
}

const GH_DESC_EN   = 'Main growing greenhouse for pepper cultivation, equipped with automated irrigation and climate control.';
const GH_SMALL_EN  = 'Secondary growing greenhouse used for overflow capacity and specialty pepper cultivation.';
const GERM_DESC_EN = 'Visitor greenhouse with display plants, interactive exhibits, and educational materials about pepper varieties.';

export const FARM_SECTIONS: FarmSectionData[] = [
  { id: 'GH-01', name: 'חממת גידול 1',  nameEn: 'Greenhouse 1',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: '#a8d5a3', position: { x: 40,   y: 40,  width: 58,  height: 320 } },
  { id: 'GH-02', name: 'חממת גידול 2',  nameEn: 'Greenhouse 2',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: '#a8d5a3', position: { x: 105,  y: 40,  width: 58,  height: 320 } },
  { id: 'GH-03', name: 'חממת גידול 3',  nameEn: 'Greenhouse 3',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: '#a8d5a3', position: { x: 170,  y: 40,  width: 58,  height: 320 } },
  { id: 'GH-04', name: 'חממת גידול 4',  nameEn: 'Greenhouse 4',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: '#a8d5a3', position: { x: 235,  y: 40,  width: 58,  height: 320 } },
  { id: 'GH-05', name: 'חממת גידול 5',  nameEn: 'Greenhouse 5',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: '#a8d5a3', position: { x: 300,  y: 40,  width: 58,  height: 320 } },
  { id: 'GH-06', name: 'חממת גידול 6',  nameEn: 'Greenhouse 6',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: '#a8d5a3', position: { x: 365,  y: 40,  width: 58,  height: 320 } },
  { id: 'GH-07', name: 'חממת גידול 7',  nameEn: 'Greenhouse 7',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: '#a8d5a3', position: { x: 430,  y: 40,  width: 58,  height: 320 } },
  { id: 'GH-08', name: 'חממת גידול 8',  nameEn: 'Greenhouse 8',        area: 'מ״ר 400', areaEn: '400 m²', descriptionEn: GH_DESC_EN,   type: 'greenhouse',  color: '#a8d5a3', position: { x: 495,  y: 40,  width: 58,  height: 320 } },
  { id: 'NURSERY',    name: 'משתלה',         nameEn: 'Nursery',             descriptionEn: 'Plant nursery for seedling propagation and early-stage growth before transplanting to production greenhouses.', type: 'nursery',     color: '#9ed9a3', position: { x: 560,  y: 40,  width: 60,  height: 180 } },
  { id: 'SHED-MAIN',  name: 'חניה',          nameEn: 'Main Shed',           descriptionEn: 'Main parking area and equipment storage facility serving farm staff and visitors.',                           type: 'building',    color: '#c9c4b8', position: { x: 637,  y: 42,  width: 140, height: 180 } },
  { id: 'GH-09', name: 'חממת גידול 9',  nameEn: 'Greenhouse 9',        area: '300 מ"ר', areaEn: '300 m²', descriptionEn: GH_SMALL_EN,  type: 'growing',     color: '#b8d96f', position: { x: 560,  y: 230, width: 217, height: 60  } },
  { id: 'GH-10', name: 'חממת גידול 10', nameEn: 'Greenhouse 10',       area: '300 מ"ר', areaEn: '300 m²', descriptionEn: GH_SMALL_EN,  type: 'growing',     color: '#b8d96f', position: { x: 560,  y: 300, width: 217, height: 60  } },
  { id: 'GERM-01',    name: 'חממת מבקרים 1', nameEn: 'Germination 1',       descriptionEn: GERM_DESC_EN, type: 'germination', color: '#a8e6cf', position: { x: 815,  y: 42,  width: 200, height: 48  } },
  { id: 'GERM-02',    name: 'חממת מבקרים 2', nameEn: 'Germination 2',       descriptionEn: GERM_DESC_EN, type: 'germination', color: '#a8e6cf', position: { x: 815,  y: 97,  width: 200, height: 48  } },
  { id: 'GERM-03',    name: 'חממת מבקרים 3', nameEn: 'Germination 3',       descriptionEn: GERM_DESC_EN, type: 'germination', color: '#a8e6cf', position: { x: 815,  y: 255, width: 200, height: 48  } },
  { id: 'GERM-04',    name: 'חממת מבקרים 4', nameEn: 'Germination 4',       descriptionEn: GERM_DESC_EN, type: 'germination', color: '#a8e6cf', position: { x: 815,  y: 310, width: 200, height: 48  } },
  { id: 'VIS-CENTER', name: 'מרכז מבקרים',   nameEn: 'Visitor Center',      descriptionEn: 'Visitor center providing guided tours, tasting sessions, and educational programs about sustainable pepper farming.', type: 'visitor',     color: '#c7e9c0', position: { x: 858,  y: 146, width: 110, height: 100 } },
  { id: 'FACTORY',    name: 'מפעל ייצור',    nameEn: 'Production Facility', descriptionEn: 'Production facility for post-harvest processing, packaging, quality control, and dispatch of farm products.',       type: 'production',  color: '#3d4a4d', position: { x: 1055, y: 40,  width: 110, height: 320 } },
];
