export type Locale = 'en' | 'he';

// ── Enum / status translators ────────────────────────────────────────────────

export interface EnumDictionary {
  taskStatus:    Record<string, string>;
  priority:      Record<string, string>;
  roles:         Record<string, string>;
  sensorStatus:  Record<string, string>;
  severity:      Record<string, string>;
  inventoryType: Record<string, string>;
  heatLevel:     Record<string, string>;
  metric:        Record<string, string>;
  taskType:      Record<string, string>;
  stockStatus:   Record<string, string>;
  userStatus:    Record<string, string>;
}

// ── Per-area interfaces ──────────────────────────────────────────────────────

export interface NavDictionary {
  dashboard:  string;
  sensors:    string;
  peppers:    string;
  inventory:  string;
  products:   string;
  tasks:      string;
  reports:    string;
  anomalies:  string;
  map:        string;
}

export interface CommonDictionary {
  loading:          string;
  save:             string;
  saving:           string;
  cancel:           string;
  edit:             string;
  delete:           string;
  back:             string;
  create:           string;
  update:           string;
  add:              string;
  clear:            string;
  search:           string;
  report:           string;
  history:          string;
  active:           string;
  inactive:         string;
  na:               string;
  item:             string;
  items:            string;
  product:          string;
  products:         string;
  variety:          string;
  varieties:        string;
  showing:          string;
  of:               string;
  noData:           string;
  failed:           string;
  backendRunning:   string;
  export:           string;
  print:            string;
  close:            string;
  refresh:          string;
  loadData:         string;
  checkBackLater:   string;
}

export interface AuthDictionary {
  welcomeBack:            string;
  login:                  string;
  loggingIn:              string;
  logout:                 string;
  register:               string;
  registering:            string;
  createAccount:          string;
  email:                  string;
  password:               string;
  fullName:               string;
  emailPlaceholder:       string;
  passwordPlaceholder:    string;
  fullNamePlaceholder:    string;
  passwordMinCharsHint:   string;
  noAccount:              string;
  haveAccount:            string;
  emailPasswordRequired:  string;
  loginFailed:            string;
  networkError:           string;
  fullNameRequired:       string;
  validEmailRequired:     string;
  passwordMinLength:      string;
  registrationFailed:     string;
  registrationSuccess:    string;
  accountCreatedAsVisitor: string;
  goToLogin:              string;
}

export interface ManagerDictionary {
  title:                string;
  subtitle:             string;
  userManagement:       string;
  userManagementSub:    string;
  peppersSub:           string;
  productsSub:          string;
  tasksSub:             string;
  inventorySub:         string;
  farmMap:              string;
  farmMapSub:           string;
  openTasksReport:      string;
  openTasksReportSub:   string;
  sensorsSub:           string;
  sensorAnomalies:      string;
  sensorAnomaliesSub:   string;
  label:                string;
}

export interface DashboardDictionary {
  title:                 string;
  subtitle:              string;
  pepperFarmManagement:  string;
  managerUser:           string;
  tasks:                 string;
  openTasks:             string;
  farmMap:               string;
  deviationData:         string;
  sensorStatistics:      string;
  inventoryAlerts:       string;
  dueDate:               string;
  assignedTo:            string;
  status:                string;
  priority:              string;
  zone:                  string;
  averageTemperature:    string;
  relativeHumidity:      string;
  dailyWaterUsage:       string;
  weeklyYield:           string;
  activeAnomalies:       string;
  highSeverity:          string;
  affectedZones:         string;
  latestReading:         string;
  currentStock:          string;
  requiredStock:         string;
  warehouse:             string;
  inStore:               string;
  inStock:               string;
  lowStock:              string;
  outOfStock:            string;
  noOpenTasks:           string;
  noInventoryAlerts:     string;
  noSensorDataAvailable: string;
  failedToLoad:          string;
  noDueDate:             string;
  unknownWorker:         string;
  unassigned:            string;
}

export interface UsersDictionary {
  searchPlaceholder:        string;
  loadingUsers:             string;
  noUsersFound:             string;
  failedToLoad:             string;
  searchFailed:             string;
  fullName:                 string;
  email:                    string;
  role:                     string;
  status:                   string;
  action:                   string;
  promoteToEmployee:        string;
  promoting:                string;
  revokeEmployee:           string;
  updating:                 string;
  confirmPromote:           string;
  confirmRevoke:            string;
  promotedSuccessfully:     string;
  revokedSuccessfully:      string;
  promotionFailed:          string;
  revokeFailed:             string;
}

export interface TasksDictionary {
  title:                    string;
  subtitle:                 string;
  addTask:                  string;
  newTask:                  string;
  editTask:                 string;
  loading:                  string;
  noTasksYet:               string;
  clickToCreate:            string;
  noTasksMatchFilter:       string;
  clearFilters:             string;
  failedToLoad:             string;
  failedToCreate:           string;
  failedToUpdate:           string;
  createdFromAlert:         string;
  preFilledFromAlert:       string;
  backToAnomalies:          string;
  report:                   string;
  history:                  string;
  filterImportance:         string;
  filterAllImportance:      string;
  filterType:               string;
  filterAllTypes:           string;
  showingOf:                string;
  // History page
  historyTitle:             string;
  historySubtitle:          string;
  loadingCompleted:         string;
  noCompletedFound:         string;
  completedWillAppear:      string;
  completed:                string;
  taskType:                 string;
  status:                   string;
  completedAt:              string;
  noDescription:            string;
  // Open tasks report
  openTasksTitle:           string;
  openTasksSubtitle:        string;
  selectWorker:             string;
  chooseWorker:             string;
  showReport:               string;
  pleaseSelectWorker:       string;
  failedToLoadReport:       string;
  openTasksCount:           string;
  titleCol:                 string;
  typeCol:                  string;
  priorityCol:              string;
  statusCol:                string;
  dueDateCol:               string;
  zoneCol:                  string;
  noOpenTasks:              string;
  failedToLoadWorkers:      string;
  // Form fields
  formTitle:                string;
  formDescription:          string;
  formTaskType:             string;
  formPriority:             string;
  formDueDate:              string;
  formZone:                 string;
  formAssignTo:             string;
  formSelectType:           string;
  formNoZone:               string;
  formUnassigned:           string;
  formSaveChanges:          string;
  formCreateTask:           string;
  formSaving:               string;
  titlePlaceholder:         string;
  descriptionPlaceholder:   string;
  errTitleRequired:         string;
  errTypeRequired:          string;
  errDueDatePast:           string;
  // Card
  editButton:               string;
  typeLabel:                string;
  assignedTo:               string;
  due:                      string;
  zone:                     string;
  startButton:              string;
  completeButton:           string;
  allowedRange:             string;
  clear:                    string;
  // Checklist (US39)
  checklist:                    string;
  addItem:                      string;
  removeItem:                   string;
  editItem:                     string;
  itemPlaceholder:              string;
  noChecklistItems:             string;
  errChecklistItemEmpty:        string;
  progress:                     string;
  progressOf:                   string;
  failedToUpdateChecklistItem:  string;
  completeBlockedByChecklist:   string;
}

export interface InventoryDictionary {
  title:                    string;
  subtitle:                 string;
  label:                    string;
  plantsByVariety:          string;
  addItem:                  string;
  failedToLoad:             string;
  noRecords:                string;
  noRecordsDesc:            string;
  // Table headers
  colItem:                  string;
  colType:                  string;
  colLocation:              string;
  colWarehouse:             string;
  colInStore:               string;
  colLastUpdated:           string;
  // Types
  typeProduct:              string;
  typeWarehouseOnly:        string;
  outOfStock:               string;
  update:                   string;
  // Quantity form
  warehouseQty:             string;
  warehouseQtyHint:         string;
  storeQty:                 string;
  storeQtyHint:             string;
  warehouseLocation:        string;
  warehouseLocationPlaceholder: string;
  errWarehouseRequired:     string;
  errWarehouseWholeNumber:  string;
  errWarehouseNegative:     string;
  errStoreRequired:         string;
  errStoreWholeNumber:      string;
  errStoreNegative:         string;
  errStoreExceedsWarehouse: string;
  updatedSuccessfully:      string;
  // Plants page
  plantsTitle:              string;
  plantsSubtitle:           string;
  backToInventory:          string;
  failedToLoadPlants:       string;
  noVarieties:              string;
  noVarietiesDesc:          string;
  colVariety:               string;
  colPlantCount:            string;
  colTotalWarehouse:        string;
  noPlantsForVariety:       string;
  colPlantId:               string;
  colPlantCode:             string;
  colZone:                  string;
  // Create page
  addItemTitle:             string;
  chooseTypeDesc:           string;
  chooseProduct:            string;
  chooseProductDesc:        string;
  chooseWarehouse:          string;
  chooseWarehouseDesc:      string;
  itemName:                 string;
  itemNamePlaceholder:      string;
  errItemNameRequired:      string;
  errWarehouseNonNegative:  string;
  itemCreated:              string;
  failedToCreate:           string;
  // Edit page
  updateTitle:              string;
  // Error messages
  errExceedsWarehouse:      string;
  errWarehouseOnlyNoStore:  string;
  errNotFound:              string;
  errServerTimeout:         string;
  errNoPermission:          string;
  errGeneric:               string;
}

export interface AnomaliesDictionary {
  // Summary cards
  activeAnomalies:          string;
  attention:                string;
  allClear:                 string;
  highSeverity:             string;
  critical:                 string;
  none:                     string;
  affectedZones:            string;
  impacted:                 string;
  healthy:                  string;
  latestReading:            string;
  noDataTime:               string;
  // Table
  colTime:                  string;
  colZone:                  string;
  colPlant:                 string;
  colPepper:                string;
  colMetric:                string;
  colActual:                string;
  colAllowedRange:          string;
  colSeverity:              string;
  colStatus:                string;
  noAnomaliesFound:         string;
  allReadingsNormal:        string;
  resolved:                 string;
  activeStatus:             string;
  createTask:               string;
  resolve:                  string;
  // Dashboard
  dashboardTitle:           string;
  live:                     string;
  refresh:                  string;
  refreshing:               string;
  overview:                 string;
  analytics:                string;
  anomaliesOverTime:        string;
  last7Days:                string;
  alertsByMetric:           string;
  filteredView:             string;
  allTime:                  string;
  zoneHealth:               string;
  alertHistory:             string;
  recurringOnly:            string;
  allSeverities:            string;
  high:                     string;
  medium:                   string;
  allStatuses:              string;
  activeFilter:             string;
  resolvedFilter:           string;
  prev:                     string;
  next:                     string;
  activeCount:              string;
  failedToLoad:             string;
  // Charts
  noTrendData:              string;
  total:                    string;
  highSeverityChart:        string;
  // Zone health
  zoneHighRisk:             string;
  zoneMediumRisk:           string;
  zoneNormal:               string;
  noHighRiskZones:          string;
  noMediumRiskZones:        string;
  noNormalZones:            string;
  allZonesNormal:           string;
  // Alert details drawer
  alertDetails:             string;
  alertHashId:              string;
  readingHashId:            string;
  alertResolved:            string;
  colMetricName:            string;
  colActualValue:           string;
  colAllowedRangeFull:      string;
  colZoneName:              string;
  colPlantCode:             string;
  colPepperVariety:         string;
  colResolvedAt:            string;
  close:                    string;
  markAsResolved:           string;
  resolving:                string;
  failedToResolve:          string;
  // Recurrence config
  recurrenceThresholds:     string;
  minOccurrences:           string;
  timeWindow:               string;
  window1day:               string;
  window3days:              string;
  window7days:              string;
  window14days:             string;
  window30days:             string;
  failedToSave:             string;
  changesImmediate:         string;
}

export interface SensorsDictionary {
  dashboardTitle:           string;
  managerLabel:             string;
  deviceLabel:              string;
  sensorLabel:              string;
  export:                   string;
  syncFromAtomation:        string;
  syncing:                  string;
  atomationSyncFailed:      string;
  statusLabel:              string;
  lastUpdate:               string;
  minAgo:                   string;
  noReadings:               string;
  latestReadingDetails:     string;
  readingId:                string;
  type:                     string;
  sampleTime:               string;
  gatewayRead:              string;
  atomationCreated:         string;
  location:                 string;
  dataExplorer:             string;
  from:                     string;
  to:                       string;
  loadData:                 string;
  loading:                  string;
  tableView:                string;
  graphView:                string;
  selectDateRange:          string;
  noReadingsInRange:        string;
  redDotsHint:              string;
  readingsCount:            string;
  outOfRange:               string;
  noSensorsFound:           string;
  loadingSensorDashboard:   string;
  back:                     string;
  fromDateError:            string;
  // Export modal
  exportTitle:              string;
  exportInclude:            string;
  exportTableExcel:         string;
  exportLoadFirst:          string;
  exportGraphPdf:           string;
  exportSwitchGraph:        string;
  exportDeliverVia:         string;
  exportDownload:           string;
  exportEmail:              string;
  exportEmailAddress:       string;
  exportEmailPlaceholder:   string;
  exportCancel:             string;
  exportExporting:          string;
  exportExport:             string;
  // Status labels and messages
  inactive:                 string;
  failedToSync:             string;
  failedToLoadDashboard:    string;
  failedToLoadSensorsList:  string;
  failedToLoadReadings:     string;
  statusLive:               string;
  statusRecent:             string;
  statusStale:              string;
  statusNoData:             string;
  statusUnknown:            string;
  msgUpToDate:              string;
  msgRecent:                string;
  msgStale:                 string;
  msgNoData:                string;
  exportSentSuccess:        string;
  exportDownloadSuccess:    string;
  exportFailed:             string;
  readingNumPrefix:         string;
  colId:                    string;
}

export interface ReportsDictionary {
  inventoryLabel:           string;
  inventoryTitle:           string;
  inventorySubtitle:        string;
  totalItems:               string;
  lowStock:                 string;
  totalAvailable:           string;
  category:                 string;
  allCategories:            string;
  sortBy:                   string;
  sortByName:               string;
  sortByQuantity:           string;
  sortByCategory:           string;
  lowStockOnly:             string;
  loading:                  string;
  exportCsv:                string;
  print:                    string;
  colItem:                  string;
  colCategory:              string;
  colLocation:              string;
  colWarehouse:             string;
  colAllocated:             string;
  colAvailable:             string;
  colStatus:                string;
  noItemsMatch:             string;
  showingItems:             string;
  lowStockBadge:            string;
  okBadge:                  string;
}

export interface PeppersDictionary {
  title:                    string;
  subtitle:                 string;
  label:                    string;
  backToDashboard:          string;
  addPepper:                string;
  searchPlaceholder:        string;
  allPepperTypes:           string;
  allHeatLevels:            string;
  mild:                     string;
  medium:                   string;
  hot:                      string;
  veryHot:                  string;
  allGrowingZones:          string;
  loading:                  string;
  noPeppersYet:             string;
  clickToCreate:            string;
  editPepper:               string;
  deletePepper:             string;
  confirmDelete:            string;
  deletedSuccessfully:      string;
  failedToDelete:           string;
  failedToLoad:             string;
  zoneLabel:                string;
}

export interface ProductsDictionary {
  title:                    string;
  subtitle:                 string;
  label:                    string;
  addNewProduct:            string;
  failedToLoad:             string;
  noProducts:               string;
  noProductsDesc:           string;
  checkBackLater:           string;
  outOfStock:               string;
  unitsLeft:                string;
  editProduct:              string;
}

export interface MapDictionary {
  title:                    string;
  subtitle:                 string;
  label:                    string;
  selectPepper:             string;
  choosePepper:             string;
  clickZoneHint:            string;
  pleaseSelectPepper:       string;
  assignedSuccessfully:     string;
  failedToAssign:           string;
  planting:                 string;
  plantHere:                string;
  selectPepperFirst:        string;
  noOpenTasksInZone:        string;
  // Filter toolbar
  filterPlantedPepper:      string;
  filterOpenTask:           string;
  filterSensorAnomaly:      string;
  alertMapTitle:            string;
  alertMapSubtitle:         string;
  // FarmMap popup
  mapArea:                  string;
  mapLoadingCropInfo:       string;
  mapCurrentCrop:           string;
  mapNoCropAssigned:        string;
  mapPlantsInZone:          string;
  mapInteractive:           string;
  mapZoneAlerts:            string;
  mapNoAlerts:              string;
  mapOpenTasksCount:        string;
  mapSensorAlertsCount:     string;
  mapTasksInZone:           string;
  mapSensorHealthInZone:    string;
  // Legend — alert view
  legendBothAlerts:         string;
  legendTaskAlert:          string;
  legendSensorAlert:        string;
  legendNeutral:            string;
  // Legend — pepper filter
  legendHasPepper:          string;
  legendNoPepper:           string;
  // Legend — task filter
  legendHasTasks:           string;
  legendNoTasks:            string;
  // Legend — sensor filter
  legendSensorHigh:         string;
  legendSensorMedium:       string;
  legendSensorNormal:       string;
  legendNoSensorData:       string;
  // Legend — zone type (original)
  legendGreenhouse:         string;
  legendNursery:            string;
  legendSmallGreenhouse:    string;
  legendVisitorGreenhouse:  string;
  legendVisitorCenter:      string;
  legendParking:            string;
  legendProduction:         string;
}

export interface WorkerDictionary {
  label:                    string;
  dashboardTitle:           string;
  dashboardSubtitle:        string;
  farmMap:                  string;
  myTasks:                  string;
  loadingMap:               string;
  loadingTasks:             string;
  noTasksAssigned:          string;
  noTasksMatchFilter:       string;
  failedToLoad:             string;
  failedToUpdateStatus:     string;
  myTasksTitle:             string;
  myTasksSubtitle:          string;
  noTasksYet:               string;
  youHaveNoTasks:           string;
}

export interface VisitorDictionary {
  pepperVarietiesTitle:     string;
  pepperVarietiesSubtitle:  string;
  label:                    string;
  products:                 string;
  map:                      string;
  login:                    string;
  register:                 string;
  logout:                   string;
  failedToLoad:             string;
  noPepperVariants:         string;
  noPepperProductsDesc:     string;
  productCatalogTitle:      string;
  productCatalogSubtitle:   string;
  failedToLoadProducts:     string;
  noProductsAvailable:      string;
  checkBackLater:           string;
  farmMapTitle:             string;
  farmMapSubtitle:          string;
}

export interface LandingDictionary {
  // Navbar
  navPeppers:           string;
  navExplore:           string;
  navFarmMap:           string;
  navProducts:          string;
  navAllVarieties:      string;
  navOurFarm:           string;
  signIn:               string;
  getStarted:           string;
  register:             string;
  // Hero
  heroLine1:            string;
  heroLine2:            string;
  heroDesc:             string;
  shopPeppers:          string;
  tourFarm:             string;
  scroll:               string;
  // Stats
  statPepperVarieties:  string;
  statFarmArea:         string;
  statSunHours:         string;
  statPesticides:       string;
  statZero:             string;
  // Peppers grid
  ourVarieties:         string;
  everyPepperStory:     string;
  peppersGridDesc:      string;
  browseAllVarieties:   string;
  // Pepper card descriptions (names are never translated)
  jalapenoDesc:         string;
  habaneroDesc:         string;
  carolinaDesc:         string;
  shishitoDesc:         string;
  anaheimDesc:          string;
  ghostDesc:            string;
  // Farm story
  ourProcess:           string;
  grownWithIntention:   string;
  feature1Title:        string;
  feature1Body:         string;
  feature2Title:        string;
  feature2Body:         string;
  feature3Title:        string;
  feature3Body:         string;
  // Map teaser
  interactive:          string;
  exploreFarmMap:       string;
  mapDesc:              string;
  openFarmMap:          string;
  // Final CTA
  joinPepperFarm:       string;
  readyToTasteHeat:     string;
  ctaDesc:              string;
  createFreeAccount:    string;
  browseProducts:       string;
  // Footer
  footerLogin:          string;
  footerRegister:       string;
  footerFarmMap:        string;
  footerCopyright:      string;
  // PepperVarietyCard
  exploreVariety:       string;
}

export interface Dictionary {
  nav:        NavDictionary;
  common:     CommonDictionary;
  auth:       AuthDictionary;
  enums:      EnumDictionary;
  manager:    ManagerDictionary;
  dashboard:  DashboardDictionary;
  users:      UsersDictionary;
  tasks:      TasksDictionary;
  inventory:  InventoryDictionary;
  anomalies:  AnomaliesDictionary;
  sensors:    SensorsDictionary;
  reports:    ReportsDictionary;
  peppers:    PeppersDictionary;
  products:   ProductsDictionary;
  map:        MapDictionary;
  worker:     WorkerDictionary;
  visitor:    VisitorDictionary;
  landing:    LandingDictionary;
}

// ── English ──────────────────────────────────────────────────────────────────

const en: Dictionary = {
  nav: {
    dashboard: 'Dashboard',
    sensors:   'Sensors',
    peppers:   'Peppers',
    inventory: 'Inventory',
    products:  'Products',
    tasks:     'Tasks',
    reports:   'Reports',
    anomalies: 'Anomalies',
    map:       'Farm Map',
  },

  common: {
    loading:        'Loading...',
    save:           'Save',
    saving:         'Saving...',
    cancel:         'Cancel',
    edit:           'Edit',
    delete:         'Delete',
    back:           'Back',
    create:         'Create',
    update:         'Update',
    add:            'Add',
    clear:          'Clear',
    search:         'Search',
    report:         'Report',
    history:        'History',
    active:         'Active',
    inactive:       'Inactive',
    na:             'N/A',
    item:           'item',
    items:          'items',
    product:        'product',
    products:       'products',
    variety:        'variety',
    varieties:      'varieties',
    showing:        'Showing',
    of:             'of',
    noData:         'No data',
    failed:         'Failed',
    backendRunning: 'Is the backend running?',
    export:         'Export',
    print:          'Print',
    close:          'Close',
    refresh:        'Refresh',
    loadData:       'Load Data',
    checkBackLater: 'Check back later.',
  },

  auth: {
    welcomeBack:            'Welcome Back',
    login:                  'Login',
    loggingIn:              'Logging in...',
    logout:                 'Logout',
    register:               'Register',
    registering:            'Registering...',
    createAccount:          'Create Account',
    email:                  'Email',
    password:               'Password',
    fullName:               'Full Name',
    emailPlaceholder:       'your@email.com',
    passwordPlaceholder:    'Your password',
    fullNamePlaceholder:    'Your full name',
    passwordMinCharsHint:   'Min. 6 characters',
    noAccount:              "Don't have an account?",
    haveAccount:            'Already have an account?',
    emailPasswordRequired:  'Email and password are required.',
    loginFailed:            'Login failed.',
    networkError:           'Network error — please try again.',
    fullNameRequired:       'Full name is required.',
    validEmailRequired:     'Valid email is required.',
    passwordMinLength:      'Password must be at least 6 characters.',
    registrationFailed:     'Registration failed.',
    registrationSuccess:    'Registration Successful!',
    accountCreatedAsVisitor: 'Your account has been created as a Visitor.',
    goToLogin:              'Go to Login',
  },

  enums: {
    taskStatus: {
      todo:        'To Do',
      in_progress: 'In Progress',
      done:        'Done',
      completed:   'Completed',
    },
    priority: {
      low:      'Low',
      medium:   'Medium',
      high:     'High',
      critical: 'Critical',
    },
    roles: {
      FarmManager: 'Farm Manager',
      Worker:      'Worker',
      Visitor:     'Visitor',
    },
    sensorStatus: {
      live:    'Live',
      recent:  'Recent',
      stale:   'Stale',
      no_data: 'No Data',
      unknown: 'Unknown',
    },
    severity: {
      High:   'High',
      Medium: 'Medium',
    },
    inventoryType: {
      Product:        'Product',
      'Warehouse-only': 'Warehouse-only',
    },
    heatLevel: {
      Mild:     'Mild',
      Medium:   'Medium',
      Hot:      'Hot',
      'Very Hot': 'Very Hot',
    },
    metric: {
      Temperature:  'Temperature',
      Humidity:     'Humidity',
      Leak:         'Leak',
      BatteryLevel: 'Battery',
      PAR:          'PAR',
    },
    taskType: {
      inspection: 'Inspection',
      irrigation: 'Irrigation',
    },
    stockStatus: {
      'Out of stock': 'Out of stock',
      'Low Stock':    'Low Stock',
      OK:             'OK',
    },
    userStatus: {
      Active:   'Active',
      Inactive: 'Inactive',
    },
  },

  manager: {
    title:              'PepperFarm',
    subtitle:           'Farm Manager Dashboard',
    label:              'Manager',
    userManagement:     'User Management',
    userManagementSub:  'Promote visitors to employees',
    peppersSub:         'Manage pepper varieties',
    productsSub:        'View the product catalog',
    tasksSub:           'Manage farm tasks',
    inventorySub:       'Update warehouse stock quantities',
    farmMap:            'Farm Map',
    farmMapSub:         'Update plant locations on map',
    openTasksReport:    'Open Tasks Report',
    openTasksReportSub: 'View all open tasks',
    sensorsSub:         'Monitor farm sensors and live readings',
    sensorAnomalies:    'Sensor Anomalies',
    sensorAnomaliesSub: 'Live anomaly dashboard',
  },

  dashboard: {
    title:                 'Farm Manager Dashboard',
    subtitle:              'PepperFarm / Pepper Farm Management',
    pepperFarmManagement:  'PepperFarm Management',
    managerUser:           'Manager',
    tasks:                 'Tasks',
    openTasks:             'Open Tasks',
    farmMap:               'Farm Map',
    deviationData:         'Deviation Data',
    sensorStatistics:      'Sensor Statistics',
    inventoryAlerts:       'Inventory Alerts',
    dueDate:               'Due Date',
    assignedTo:            'Assigned To',
    status:                'Status',
    priority:              'Priority',
    zone:                  'Zone',
    averageTemperature:    'Average Temperature',
    relativeHumidity:      'Relative Humidity',
    dailyWaterUsage:       'Daily Water Usage',
    weeklyYield:           'Weekly Yield',
    activeAnomalies:       'Active Anomalies',
    highSeverity:          'High Severity',
    affectedZones:         'Affected Zones',
    latestReading:         'Latest Reading',
    currentStock:          'Current Stock',
    requiredStock:         'Required Stock',
    warehouse:             'Warehouse',
    inStore:               'In Store',
    inStock:               'In Stock',
    lowStock:              'Low Stock',
    outOfStock:            'Out of Stock',
    noOpenTasks:           'No open tasks',
    noInventoryAlerts:     'No inventory alerts',
    noSensorDataAvailable: 'No sensor data available',
    failedToLoad:          'Failed to load dashboard data.',
    noDueDate:             'No due date',
    unknownWorker:         'Unknown worker',
    unassigned:            'Unassigned',
  },

  users: {
    searchPlaceholder:    'Search by name...',
    loadingUsers:         'Loading users...',
    noUsersFound:         'No users found.',
    failedToLoad:         'Failed to load users.',
    searchFailed:         'Search failed.',
    fullName:             'Full Name',
    email:                'Email',
    role:                 'Role',
    status:               'Status',
    action:               'Action',
    promoteToEmployee:    'Promote to Employee',
    promoting:            'Promoting...',
    revokeEmployee:       'Revoke Employee',
    updating:             'Updating...',
    confirmPromote:       'Are you sure you want to promote this user to Employee?',
    confirmRevoke:        "Are you sure you want to revoke this employee's permissions?",
    promotedSuccessfully: 'User promoted to Worker successfully.',
    revokedSuccessfully:  'Employee role revoked successfully.',
    promotionFailed:      'Promotion failed.',
    revokeFailed:         'Revoke failed.',
  },

  tasks: {
    title:              'Tasks',
    subtitle:           'Manage and assign farm tasks',
    addTask:            '+ Add Task',
    newTask:            'New Task',
    editTask:           'Edit Task',
    loading:            'Loading tasks...',
    noTasksYet:         'No tasks yet.',
    clickToCreate:      'Click + Add Task to create the first one.',
    noTasksMatchFilter: 'No tasks match these filters.',
    clearFilters:       'Clear filters to see all tasks.',
    failedToLoad:       'Failed to load tasks. Is the backend running?',
    failedToCreate:     'Failed to create task.',
    failedToUpdate:     'Failed to update task.',
    createdFromAlert:   'Task created from alert #',
    preFilledFromAlert: 'Pre-filled from alert #',
    backToAnomalies:    'Back to anomalies',
    report:             '📊 Report',
    history:            '📜 History',
    filterImportance:   'Importance',
    filterAllImportance: 'All importance',
    filterType:         'Type',
    filterAllTypes:     'All types',
    showingOf:          'Showing {result} of {total}',
    // History
    historyTitle:       'Completed Tasks History',
    historySubtitle:    'Track completed work and employee performance',
    loadingCompleted:   'Loading completed tasks...',
    noCompletedFound:   'No completed tasks found',
    completedWillAppear: 'Completed tasks will appear here.',
    completed:          'COMPLETED',
    taskType:           'Task Type',
    status:             'Status',
    completedAt:        'Completed At',
    noDescription:      'No description provided.',
    // Open tasks report
    openTasksTitle:     '📋 Open Tasks Report',
    openTasksSubtitle:  'View open tasks by worker',
    selectWorker:       'Select Worker:',
    chooseWorker:       '-- Choose a worker --',
    showReport:         'Show Report',
    pleaseSelectWorker: 'Please select a worker.',
    failedToLoadReport: 'Failed to load report.',
    openTasksCount:     'open tasks',
    titleCol:           'Title',
    typeCol:            'Type',
    priorityCol:        'Priority',
    statusCol:          'Status',
    dueDateCol:         'Due Date',
    zoneCol:            'Zone',
    noOpenTasks:        '✅ No open tasks for this worker!',
    failedToLoadWorkers: 'Failed to load workers.',
    formTitle:           'Title *',
    formDescription:     'Description',
    formTaskType:        'Task Type *',
    formPriority:        'Priority',
    formDueDate:         'Due Date',
    formZone:            'Farm Zone',
    formAssignTo:        'Assign to Worker',
    formSelectType:      'Select a type...',
    formNoZone:          'No zone',
    formUnassigned:      'Unassigned',
    formSaveChanges:     'Save Changes',
    formCreateTask:      'Create Task',
    formSaving:          'Saving...',
    titlePlaceholder:    'e.g. Water zone A',
    descriptionPlaceholder: 'Optional details about the task...',
    errTitleRequired:    'Title is required.',
    errTypeRequired:     'Task type is required.',
    errDueDatePast:      'Due date cannot be in the past.',
    editButton:          'Edit',
    typeLabel:           'Type',
    assignedTo:          'Assigned to',
    due:                 'Due',
    zone:                'Zone',
    startButton:         'Start',
    completeButton:      'Complete',
    allowedRange:        'allowed',
    clear:               'Clear',
    checklist:                   'Checklist',
    addItem:                     '+ Add item',
    removeItem:                  'Remove',
    editItem:                    'Edit item',
    itemPlaceholder:             'e.g. Check humidity',
    noChecklistItems:            'No checklist items',
    errChecklistItemEmpty:       'Checklist item cannot be empty',
    progress:                    'Progress',
    progressOf:                  '{done} / {total} completed',
    failedToUpdateChecklistItem: 'Failed to update checklist item.',
    completeBlockedByChecklist:  'Complete all checklist items first',
  },

  inventory: {
    title:                    'Warehouse Inventory',
    subtitle:                 'Warehouse is the source of truth. Store (allocated) quantity must stay within warehouse quantity.',
    label:                    'PepperFarm',
    plantsByVariety:          '🌱 Plants by Variety',
    addItem:                  '+ Add Item',
    failedToLoad:             'Failed to load inventory. Is the backend running?',
    noRecords:                'No inventory records',
    noRecordsDesc:            'Click "+ Add Item" to add your first warehouse item.',
    colItem:                  'Item',
    colType:                  'Type',
    colLocation:              'Location',
    colWarehouse:             'Warehouse',
    colInStore:               'In Store',
    colLastUpdated:           'Last Updated',
    typeProduct:              'Product',
    typeWarehouseOnly:        'Warehouse-only',
    outOfStock:               'Out of stock',
    update:                   '✏️ Update',
    warehouseQty:             'Warehouse Quantity *',
    warehouseQtyHint:         'Actual units in the farm warehouse (source of truth).',
    storeQty:                 'Store (Allocated) Quantity *',
    storeQtyHint:             'Units exposed in the customer catalog. Must be ≤ warehouse quantity.',
    warehouseLocation:        'Warehouse Location',
    warehouseLocationPlaceholder: 'e.g. Aisle 3, Shelf B',
    errWarehouseRequired:     'Warehouse quantity is required.',
    errWarehouseWholeNumber:  'Warehouse quantity must be a whole number.',
    errWarehouseNegative:     'Warehouse quantity cannot be negative.',
    errStoreRequired:         'Store quantity is required.',
    errStoreWholeNumber:      'Store quantity must be a whole number.',
    errStoreNegative:         'Store quantity cannot be negative.',
    errStoreExceedsWarehouse: 'Store (allocated) quantity cannot exceed warehouse quantity.',
    updatedSuccessfully:      'Inventory updated successfully.',
    plantsTitle:              'Plants by Variety',
    plantsSubtitle:           'Amount of plants and total warehouse stock per variety. Click a row to see the individual plants.',
    backToInventory:          '← Back to Inventory',
    failedToLoadPlants:       'Failed to load plants by variety.',
    noVarieties:              'No varieties',
    noVarietiesDesc:          'No active pepper varieties to show.',
    colVariety:               'Variety',
    colPlantCount:            '# Plants',
    colTotalWarehouse:        'Total warehouse units',
    noPlantsForVariety:       'No plants recorded for this variety.',
    colPlantId:               'Plant ID',
    colPlantCode:             'Plant Code',
    colZone:                  'Zone',
    addItemTitle:             'Add Inventory Item',
    chooseTypeDesc:           'Is this item going to be sold in the store, or is it warehouse-only (seeds, fertilizer, tools, raw stock)?',
    chooseProduct:            '🛒 Product for the store',
    chooseProductDesc:        'Create it as a Product. Its inventory row will be created automatically, and you can set quantities afterward.',
    chooseWarehouse:          '📦 Warehouse-only item',
    chooseWarehouseDesc:      'Not sold in the store. Tracks only warehouse quantity and location (no allocation).',
    itemName:                 'Item Name *',
    itemNamePlaceholder:      'e.g. Fertilizer 5kg, Seed pack - Jalapeño',
    errItemNameRequired:      'Item name is required.',
    errWarehouseNonNegative:  'Warehouse quantity must be a non-negative whole number.',
    itemCreated:              'Inventory item created.',
    failedToCreate:           'Failed to create inventory item.',
    updateTitle:              'Update Inventory',
    errExceedsWarehouse:      'Store quantity cannot exceed warehouse quantity.',
    errWarehouseOnlyNoStore:  'This is a warehouse-only item and cannot have a store quantity.',
    errNotFound:              'Inventory record was not found.',
    errServerTimeout:         'The server is taking too long to respond. Please try again in a moment.',
    errNoPermission:          'You do not have permission to perform this action.',
    errGeneric:               'Something went wrong. Please try again.',
  },

  anomalies: {
    activeAnomalies:  'Active Anomalies',
    attention:        'Attention',
    allClear:         'All clear',
    highSeverity:     'High Severity',
    critical:         'Critical',
    none:             'None',
    affectedZones:    'Affected Zones',
    impacted:         'Impacted',
    healthy:          'Healthy',
    latestReading:    'Latest Reading',
    noDataTime:       'No data',
    colTime:          'Time',
    colZone:          'Zone',
    colPlant:         'Plant',
    colPepper:        'Pepper',
    colMetric:        'Metric',
    colActual:        'Actual',
    colAllowedRange:  'Allowed Range',
    colSeverity:      'Severity',
    colStatus:        'Status',
    noAnomaliesFound: 'No anomalies found',
    allReadingsNormal: 'All sensor readings are within normal range',
    resolved:         'Resolved',
    activeStatus:     'Active',
    createTask:       'Create Task',
    resolve:          'Resolve',
    dashboardTitle:   'Sensor Anomaly Dashboard',
    live:             'Live',
    refresh:          'Refresh',
    refreshing:       'Refreshing',
    overview:         'Overview',
    analytics:        'Analytics',
    anomaliesOverTime: 'Anomalies Over Time',
    last7Days:        'Last 7 days',
    alertsByMetric:   'Alerts by Metric',
    filteredView:     'Filtered view',
    allTime:          'All time',
    zoneHealth:       'Zone Health',
    alertHistory:     'Alert History',
    recurringOnly:    'Recurring only',
    allSeverities:    'All Severities',
    high:             'High',
    medium:           'Medium',
    allStatuses:      'All Statuses',
    activeFilter:     'Active',
    resolvedFilter:   'Resolved',
    prev:             'Prev',
    next:             'Next',
    activeCount:      'active',
    failedToLoad:     'Failed to load anomaly data. Is the backend running?',
    noTrendData:      'No trend data available',
    total:            'Total',
    highSeverityChart: 'High severity',
    zoneHighRisk:      'High Risk',
    zoneMediumRisk:    'Medium Risk',
    zoneNormal:        'Normal',
    noHighRiskZones:   'No high-risk zones',
    noMediumRiskZones: 'No medium-risk zones',
    noNormalZones:     'No normal zones',
    allZonesNormal:    'All zones operating normally',
    alertDetails:      'Alert Details',
    alertHashId:       'Alert #',
    readingHashId:     'Reading #',
    alertResolved:     'This alert has been resolved',
    colMetricName:     'Metric',
    colActualValue:    'Actual Value',
    colAllowedRangeFull: 'Allowed Range',
    colZoneName:       'Zone',
    colPlantCode:      'Plant',
    colPepperVariety:  'Pepper Variety',
    colResolvedAt:     'Resolved At',
    close:             'Close',
    markAsResolved:    'Mark as Resolved',
    resolving:         'Resolving…',
    failedToResolve:   'Failed to resolve alert.',
    recurrenceThresholds: 'Recurrence Thresholds',
    minOccurrences:    'Minimum occurrences to flag as recurring',
    timeWindow:        'Time window for counting occurrences',
    window1day:        '1 day',
    window3days:       '3 days',
    window7days:       '7 days',
    window14days:      '14 days',
    window30days:      '30 days',
    failedToSave:      'Failed to save',
    changesImmediate:  'Changes take effect immediately on new anomaly detections.',
  },

  sensors: {
    dashboardTitle:         'Sensor Dashboard',
    managerLabel:           'Manager',
    deviceLabel:            'Device:',
    sensorLabel:            'Sensor',
    export:                 'Export',
    syncFromAtomation:      'Sync from Atomation',
    syncing:                'Syncing…',
    atomationSyncFailed:    'Atomation sync failed — showing latest data from DB. Details:',
    statusLabel:            'Status:',
    lastUpdate:             'Last update:',
    minAgo:                 'min ago',
    noReadings:             'No readings found for this sensor.',
    latestReadingDetails:   'Latest Reading Details',
    readingId:              'Reading ID',
    type:                   'Type',
    sampleTime:             'Sample Time',
    gatewayRead:            'Gateway Read',
    atomationCreated:       'Atomation Created',
    location:               'Location',
    dataExplorer:           'Data Explorer',
    from:                   'From',
    to:                     'To',
    loadData:               'Load Data',
    loading:                'Loading…',
    tableView:              'table',
    graphView:              'graph',
    selectDateRange:        'Select a date range and click "Load Data" to view readings.',
    noReadingsInRange:      'No readings found for the selected date range.',
    redDotsHint:            'Red dots indicate out-of-range readings',
    readingsCount:          'readings',
    outOfRange:             'out-of-range',
    noSensorsFound:         'No sensors found in the system.',
    loadingSensorDashboard: 'Loading sensor dashboard…',
    back:                   'Back',
    fromDateError:          '"From" date must be before "To" date.',
    exportTitle:            'Export Sensor Data',
    exportInclude:          'Include',
    exportTableExcel:       'Table → Excel (.xlsx)',
    exportLoadFirst:        'Load data first in the Data Explorer',
    exportGraphPdf:         'Graph → PDF',
    exportSwitchGraph:      'Switch to Graph view and load data first',
    exportDeliverVia:       'Deliver via',
    exportDownload:         'Download to device',
    exportEmail:            'Send by email',
    exportEmailAddress:     'Recipient email address',
    exportEmailPlaceholder: 'you@example.com',
    exportCancel:           'Cancel',
    exportExporting:        'Exporting…',
    exportExport:           'Export',
    inactive:               '(inactive)',
    failedToSync:           'Failed to sync from Atomation.',
    failedToLoadDashboard:  'Failed to load sensor dashboard.',
    failedToLoadSensorsList:'Failed to load sensors list.',
    failedToLoadReadings:   'Failed to load readings.',
    statusLive:             'Live',
    statusRecent:           'Recent',
    statusStale:            'Stale',
    statusNoData:           'No Data',
    statusUnknown:          'Unknown',
    msgUpToDate:            'Sensor data is up to date.',
    msgRecent:              'Sensor data is recent, but not fully live.',
    msgStale:               'Sensor data is stale.',
    msgNoData:              'No readings found for this sensor.',
    exportSentSuccess:      'Export sent to {email} successfully.',
    exportDownloadSuccess:  'Export downloaded successfully.',
    exportFailed:           'Export failed.',
    readingNumPrefix:       'Reading #',
    colId:                  'ID',
  },

  reports: {
    inventoryLabel:    'Reports',
    inventoryTitle:    'Inventory Report',
    inventorySubtitle: 'Current stock levels across all items',
    totalItems:        'Total Items',
    lowStock:          'Low Stock',
    totalAvailable:    'Total Available',
    category:          'Category',
    allCategories:     'All categories',
    sortBy:            'Sort by',
    sortByName:        'Item name',
    sortByQuantity:    'Available (low first)',
    sortByCategory:    'Category',
    lowStockOnly:      'Show only low stock items',
    loading:           'Loading report...',
    exportCsv:         '📥 Export CSV',
    print:             '🖨️ Print',
    colItem:           'Item',
    colCategory:       'Category',
    colLocation:       'Location',
    colWarehouse:      'Warehouse',
    colAllocated:      'Allocated',
    colAvailable:      'Available',
    colStatus:         'Status',
    noItemsMatch:      'No inventory items match the current filters.',
    showingItems:      'Showing',
    lowStockBadge:     '⚠ Low Stock',
    okBadge:           '✓ OK',
  },

  peppers: {
    title:          'Pepper Varieties',
    subtitle:       'Manage pepper varieties in the farm',
    label:          'Manager Dashboard',
    backToDashboard: '← Dashboard',
    addPepper:      '+ Add Pepper',
    searchPlaceholder: 'Search pepper by name, scientific name, zone or description...',
    allPepperTypes: 'All Pepper Types',
    allHeatLevels:  'All Heat Levels',
    mild:           'Mild',
    medium:         'Medium',
    hot:            'Hot',
    veryHot:        'Very Hot',
    allGrowingZones: 'All Growing Zones',
    loading:        'Loading peppers...',
    noPeppersYet:   'No pepper varieties yet.',
    clickToCreate:  'Click + Add Pepper to create the first one.',
    editPepper:     'Edit',
    deletePepper:   'Delete',
    confirmDelete:  'Are you sure you want to delete this pepper?',
    deletedSuccessfully: 'Pepper deleted successfully.',
    failedToDelete: 'Failed to delete pepper.',
    failedToLoad:   'Failed to load peppers. Is the backend running?',
    zoneLabel:      'Zone',
  },

  products: {
    title:          'Product Catalog',
    subtitle:       'Browse and manage all products',
    label:          'PepperFarm',
    addNewProduct:  '+ Add New Product',
    failedToLoad:   'Failed to load products. Is the backend running?',
    noProducts:     'No products available',
    noProductsDesc: 'Add your first product using the button above.',
    checkBackLater: 'Check back later.',
    outOfStock:     'Out of stock',
    unitsLeft:      'left',
    editProduct:    '✏️ Edit',
  },

  map: {
    title:             'Farm Map — Assign Peppers to Zones',
    subtitle:          'Select a pepper variety and click a zone to plant it there',
    label:             'PepperFarm',
    selectPepper:      'Select Pepper:',
    choosePepper:      '-- Choose a pepper --',
    clickZoneHint:     '✅ Now click a zone on the map to plant it',
    pleaseSelectPepper: 'Please select a pepper first.',
    assignedSuccessfully: 'assigned to',
    failedToAssign:    'Failed to assign.',
    planting:          'Planting...',
    plantHere:         'Plant here 🌱',
    selectPepperFirst: 'Select a pepper first',
    noOpenTasksInZone: 'No open tasks in this zone',
    filterPlantedPepper:  '🌱 Planted Pepper',
    filterOpenTask:       '📋 Open Task',
    filterSensorAnomaly:  '⚠️ Sensor Anomaly',
    alertMapTitle:        'Farm Alert Map',
    alertMapSubtitle:     'Zones requiring attention are highlighted',
    mapArea:                 'Area',
    mapLoadingCropInfo:      'Loading crop info...',
    mapCurrentCrop:          '🌶 Current crop',
    mapNoCropAssigned:       'No crop assigned to this zone.',
    mapPlantsInZone:         '🌿 Plants in this zone',
    mapInteractive:          'Farm map · Interactive',
    mapZoneAlerts:           'Zone Alerts',
    mapNoAlerts:             'No alerts — this zone is clear.',
    mapOpenTasksCount:       'Open Tasks',
    mapSensorAlertsCount:    'Sensor Alerts',
    mapTasksInZone:          '📋 Tasks in this zone',
    mapSensorHealthInZone:   '⚠️ Sensor health',
    legendBothAlerts:        'Task + Sensor alert',
    legendTaskAlert:         'Open task',
    legendSensorAlert:       'Sensor anomaly',
    legendNeutral:           'No alerts',
    legendHasPepper:         'Has planted pepper',
    legendNoPepper:          'No pepper assigned',
    legendHasTasks:          'Has open tasks',
    legendNoTasks:           'No open tasks',
    legendSensorHigh:        'High severity alert',
    legendSensorMedium:      'Medium severity alert',
    legendSensorNormal:      'Normal',
    legendNoSensorData:      'No sensor data',
    legendGreenhouse:        'Greenhouse',
    legendNursery:           'Nursery',
    legendSmallGreenhouse:   'Small Greenhouse',
    legendVisitorGreenhouse: 'Visitor Greenhouse',
    legendVisitorCenter:     'Visitor Center',
    legendParking:           'Parking',
    legendProduction:        'Production Facility',
  },

  worker: {
    label:              'Worker',
    dashboardTitle:     'My Dashboard',
    dashboardSubtitle:  'Your tasks and farm map — red zones have open tasks assigned to you',
    farmMap:            'Farm Map',
    myTasks:            'My Tasks',
    loadingMap:         'Loading map...',
    loadingTasks:       'Loading tasks...',
    noTasksAssigned:    'No tasks assigned to you.',
    noTasksMatchFilter: 'No tasks match these filters.',
    failedToLoad:       'Failed to load data. Is the backend running?',
    failedToUpdateStatus: 'Failed to update task status.',
    myTasksTitle:       'My Tasks',
    myTasksSubtitle:    'Tasks assigned to you',
    noTasksYet:         'No tasks yet.',
    youHaveNoTasks:     'You have no tasks assigned.',
  },

  visitor: {
    pepperVarietiesTitle:    'Pepper Varieties',
    pepperVarietiesSubtitle: 'Browse all pepper varieties grown at our farm',
    label:                   'PepperFarm',
    products:                'Products',
    map:                     '🗺️ Map',
    login:                   'Login',
    register:                'Register',
    logout:                  'Logout',
    failedToLoad:            'Failed to load pepper varieties. Is the backend running?',
    noPepperVariants:        'No pepper varieties found',
    noPepperProductsDesc:    'Check back later.',
    productCatalogTitle:     'Product Catalog',
    productCatalogSubtitle:  'Browse all products available from our farm',
    failedToLoadProducts:    'Failed to load products. Is the backend running?',
    noProductsAvailable:     'No products available',
    checkBackLater:          'Check back later.',
    farmMapTitle:            'Farm Map',
    farmMapSubtitle:         'Interactive layout of the farm facility — click any section to learn more',
  },

  landing: {
    navPeppers:          'Peppers',
    navExplore:          'Explore',
    navFarmMap:          'Farm Map',
    navProducts:         'Products',
    navAllVarieties:     'All Varieties',
    navOurFarm:          'Our Farm',
    signIn:              'Sign In',
    getStarted:          'Get Started',
    register:            'Register',
    heroLine1:           'From our fields',
    heroLine2:           'to your table.',
    heroDesc:            'We grow over 30 pepper varieties with care, precision, and passion — from mild Shishito to the fearsome Carolina Reaper. Explore our farm, track every plant, taste the difference.',
    shopPeppers:         'Shop Peppers',
    tourFarm:            'Tour the Farm',
    scroll:              'Scroll',
    statPepperVarieties: 'Pepper Varieties',
    statFarmArea:        'Farm Area',
    statSunHours:        'Sun Hours',
    statPesticides:      'Pesticides',
    statZero:            'Zero',
    ourVarieties:        'Our Varieties',
    everyPepperStory:    'Every pepper tells a story',
    peppersGridDesc:     'Thirty cultivars, each with its own personality, heat level, and culinary purpose. We grow them all with the same obsessive care.',
    browseAllVarieties:  'Browse all varieties',
    jalapenoDesc:        'Mild, versatile and crisp — perfect for fresh salsas, pickles and everyday cooking.',
    habaneroDesc:        'Fruity, floral with intense Caribbean heat. Our signature premium variety.',
    carolinaDesc:        'World-record heat meets complex fruity depth. Only for the truly brave.',
    shishitoDesc:        'Delicate Japanese variety — sweet and thin-skinned, perfect for blistering.',
    anaheimDesc:         'California-grown, mildly smoky and incredibly versatile for roasting.',
    ghostDesc:           'Bhut jolokia — the ghost that haunts your palate for hours after each bite.',
    ourProcess:          'Our Process',
    grownWithIntention:  'Grown with intention',
    feature1Title:       'Planted by hand',
    feature1Body:        'Every seedling is started in our nursery and transplanted by hand into raised beds enriched with compost. No shortcuts, no machinery guesswork.',
    feature2Title:       'Smart irrigation',
    feature2Body:        'Our drip-irrigation system delivers precise water at root level, monitored by soil sensors. Plants get exactly what they need — no more, no less.',
    feature3Title:       'Harvested at peak',
    feature3Body:        'We track every plant from seed to harvest day. Peppers are picked at the exact moment of peak flavour and immediately packed for freshness.',
    interactive:         'Interactive',
    exploreFarmMap:      'Explore our farm map',
    mapDesc:             'Navigate every zone of PepperFarm. See which varieties grow where, check plant health, and plan your visit.',
    openFarmMap:         'Open Farm Map',
    joinPepperFarm:      'Join PepperFarm',
    readyToTasteHeat:    'Ready to taste the heat?',
    ctaDesc:             'Create a free account to track your favourite varieties, get harvest notifications, and order directly from our farm.',
    createFreeAccount:   'Create Free Account',
    browseProducts:      'Browse Products',
    footerLogin:         'Login',
    footerRegister:      'Register',
    footerFarmMap:       'Farm Map',
    footerCopyright:     '© {year} PepperFarm. Grown with care in Israel.',
    exploreVariety:      'Explore variety',
  },
};

// ── Hebrew ───────────────────────────────────────────────────────────────────

const he: Dictionary = {
  nav: {
    dashboard: 'לוח בקרה',
    sensors:   'חיישנים',
    peppers:   'פלפלים',
    inventory: 'מלאי',
    products:  'מוצרים',
    tasks:     'משימות',
    reports:   'דוחות',
    anomalies: 'חריגות',
    map:       'מפת חווה',
  },

  common: {
    loading:        'טוען...',
    save:           'שמור',
    saving:         'שומר...',
    cancel:         'ביטול',
    edit:           'עריכה',
    delete:         'מחיקה',
    back:           'חזרה',
    create:         'יצירה',
    update:         'עדכון',
    add:            'הוספה',
    clear:          'נקה',
    search:         'חיפוש',
    report:         'דוח',
    history:        'היסטוריה',
    active:         'פעיל',
    inactive:       'לא פעיל',
    na:             'לא רלוונטי',
    item:           'פריט',
    items:          'פריטים',
    product:        'מוצר',
    products:       'מוצרים',
    variety:        'זן',
    varieties:      'זנים',
    showing:        'מציג',
    of:             'מתוך',
    noData:         'אין נתונים',
    failed:         'נכשל',
    backendRunning: 'האם השרת פועל?',
    export:         'ייצוא',
    print:          'הדפסה',
    close:          'סגור',
    refresh:        'רענון',
    loadData:       'טען נתונים',
    checkBackLater: 'בדוק שוב מאוחר יותר.',
  },

  auth: {
    welcomeBack:            'ברוך השב',
    login:                  'התחברות',
    loggingIn:              'מתחבר...',
    logout:                 'התנתק',
    register:               'הרשמה',
    registering:            'נרשם...',
    createAccount:          'יצירת חשבון',
    email:                  'אימייל',
    password:               'סיסמה',
    fullName:               'שם מלא',
    emailPlaceholder:       'your@email.com',
    passwordPlaceholder:    'הסיסמה שלך',
    fullNamePlaceholder:    'שמך המלא',
    passwordMinCharsHint:   'לפחות 6 תווים',
    noAccount:              'אין לך חשבון?',
    haveAccount:            'יש לך חשבון?',
    emailPasswordRequired:  'אימייל וסיסמה נדרשים.',
    loginFailed:            'ההתחברות נכשלה.',
    networkError:           'שגיאת רשת — אנא נסה שוב.',
    fullNameRequired:       'שם מלא נדרש.',
    validEmailRequired:     'יש להזין אימייל תקין.',
    passwordMinLength:      'הסיסמה חייבת לפחות 6 תווים.',
    registrationFailed:     'ההרשמה נכשלה.',
    registrationSuccess:    'ההרשמה הצליחה!',
    accountCreatedAsVisitor: 'חשבונך נוצר כמבקר.',
    goToLogin:              'עבור להתחברות',
  },

  enums: {
    taskStatus: {
      todo:        'לביצוע',
      in_progress: 'בביצוע',
      done:        'בוצע',
      completed:   'הושלם',
    },
    priority: {
      low:      'נמוכה',
      medium:   'בינונית',
      high:     'גבוהה',
      critical: 'קריטית',
    },
    roles: {
      FarmManager: 'מנהל חווה',
      Worker:      'עובד',
      Visitor:     'מבקר',
    },
    sensorStatus: {
      live:    'חי',
      recent:  'עדכני',
      stale:   'ישן',
      no_data: 'אין נתונים',
      unknown: 'לא ידוע',
    },
    severity: {
      High:   'גבוהה',
      Medium: 'בינונית',
    },
    inventoryType: {
      Product:          'מוצר',
      'Warehouse-only': 'מחסן בלבד',
    },
    heatLevel: {
      Mild:       'עדין',
      Medium:     'בינוני',
      Hot:        'חריף',
      'Very Hot': 'חריף מאוד',
    },
    metric: {
      Temperature:  'טמפרטורה',
      Humidity:     'לחות',
      Leak:         'דליפה',
      BatteryLevel: 'סוללה',
      PAR:          'PAR',
    },
    taskType: {
      inspection: 'בדיקה',
      irrigation: 'השקיה',
    },
    stockStatus: {
      'Out of stock': 'אזל מהמלאי',
      'Low Stock':    'מלאי נמוך',
      OK:             'תקין',
    },
    userStatus: {
      Active:   'פעיל',
      Inactive: 'לא פעיל',
    },
  },

  manager: {
    title:              'פלפל פארם',
    subtitle:           'לוח בקרה של מנהל החווה',
    label:              'מנהל',
    userManagement:     'ניהול משתמשים',
    userManagementSub:  'קידום מבקרים לעובדים',
    peppersSub:         'ניהול זני פלפל',
    productsSub:        'צפה בקטלוג מוצרים',
    tasksSub:           'ניהול משימות חווה',
    inventorySub:       'עדכון כמויות מלאי במחסן',
    farmMap:            'מפת חווה',
    farmMapSub:         'עדכון מיקומי צמחים במפה',
    openTasksReport:    'דוח משימות פתוחות',
    openTasksReportSub: 'הצג את כל המשימות הפתוחות',
    sensorsSub:         'ניטור חיישני החווה וקריאות חיות',
    sensorAnomalies:    'חריגות חיישנים',
    sensorAnomaliesSub: 'לוח חריגות חי',
  },

  dashboard: {
    title:                 'לוח ניהול החווה',
    subtitle:              'PepperFarm / ניהול חוות הפלפלים',
    pepperFarmManagement:  'ניהול PepperFarm',
    managerUser:           'מנהל',
    tasks:                 'משימות',
    openTasks:             'משימות פתוחות',
    farmMap:               'מפת החווה',
    deviationData:         'נתוני חריגות',
    sensorStatistics:      'סטטיסטיקת חיישנים',
    inventoryAlerts:       'התראות מלאי',
    dueDate:               'תאריך יעד',
    assignedTo:            'מוקצה ל',
    status:                'סטטוס',
    priority:              'עדיפות',
    zone:                  'אזור',
    averageTemperature:    'טמפרטורה ממוצעת',
    relativeHumidity:      'לחות יחסית',
    dailyWaterUsage:       'צריכת מים יומית',
    weeklyYield:           'יבול שבועי',
    activeAnomalies:       'חריגות פעילות',
    highSeverity:          'חומרה גבוהה',
    affectedZones:         'אזורים מושפעים',
    latestReading:         'קריאה אחרונה',
    currentStock:          'מלאי נוכחי',
    requiredStock:         'מלאי נדרש',
    warehouse:             'מחסן',
    inStore:               'בחנות',
    inStock:               'במלאי',
    lowStock:              'מלאי נמוך',
    outOfStock:            'אזל מהמלאי',
    noOpenTasks:           'אין משימות פתוחות',
    noInventoryAlerts:     'אין התראות מלאי',
    noSensorDataAvailable: 'אין נתוני חיישנים זמינים',
    failedToLoad:          'טעינת נתוני לוח הניהול נכשלה.',
    noDueDate:             'אין תאריך יעד',
    unknownWorker:         'עובד לא ידוע',
    unassigned:            'לא מוקצה',
  },

  users: {
    searchPlaceholder:    'חיפוש לפי שם...',
    loadingUsers:         'טוען משתמשים...',
    noUsersFound:         'לא נמצאו משתמשים.',
    failedToLoad:         'טעינת משתמשים נכשלה.',
    searchFailed:         'החיפוש נכשל.',
    fullName:             'שם מלא',
    email:                'אימייל',
    role:                 'תפקיד',
    status:               'סטטוס',
    action:               'פעולה',
    promoteToEmployee:    'קידום לעובד',
    promoting:            'מקדם...',
    revokeEmployee:       'ביטול עובד',
    updating:             'מעדכן...',
    confirmPromote:       'האם אתה בטוח שברצונך לקדם משתמש זה לעובד?',
    confirmRevoke:        'האם אתה בטוח שברצונך לבטל הרשאות עובד זה?',
    promotedSuccessfully: 'המשתמש קודם לעובד בהצלחה.',
    revokedSuccessfully:  'תפקיד העובד בוטל בהצלחה.',
    promotionFailed:      'הקידום נכשל.',
    revokeFailed:         'הביטול נכשל.',
  },

  tasks: {
    title:              'משימות',
    subtitle:           'ניהול והקצאת משימות חווה',
    addTask:            '+ הוסף משימה',
    newTask:            'משימה חדשה',
    editTask:           'עריכת משימה',
    loading:            'טוען משימות...',
    noTasksYet:         'אין משימות עדיין.',
    clickToCreate:      'לחץ + הוסף משימה ליצירת הראשונה.',
    noTasksMatchFilter: 'אין משימות התואמות לסינון זה.',
    clearFilters:       'נקה סינון כדי לראות את כל המשימות.',
    failedToLoad:       'טעינת משימות נכשלה. האם השרת פועל?',
    failedToCreate:     'יצירת משימה נכשלה.',
    failedToUpdate:     'עדכון משימה נכשל.',
    createdFromAlert:   'משימה נוצרה מהתראה #',
    preFilledFromAlert: 'מולא מראש מהתראה #',
    backToAnomalies:    'חזרה לחריגות',
    report:             '📊 דוח',
    history:            '📜 היסטוריה',
    filterImportance:   'חשיבות',
    filterAllImportance: 'כל החשיבויות',
    filterType:         'סוג',
    filterAllTypes:     'כל הסוגים',
    showingOf:          'מציג {result} מתוך {total}',
    historyTitle:       'היסטוריית משימות שהושלמו',
    historySubtitle:    'עקוב אחר עבודה שהושלמה וביצועי עובדים',
    loadingCompleted:   'טוען משימות שהושלמו...',
    noCompletedFound:   'לא נמצאו משימות שהושלמו',
    completedWillAppear: 'משימות שהושלמו יופיעו כאן.',
    completed:          'הושלם',
    taskType:           'סוג משימה',
    status:             'סטטוס',
    completedAt:        'הושלם ב',
    noDescription:      'אין תיאור.',
    openTasksTitle:     '📋 דוח משימות פתוחות',
    openTasksSubtitle:  'הצג משימות פתוחות לפי עובד',
    selectWorker:       'בחר עובד:',
    chooseWorker:       '-- בחר עובד --',
    showReport:         'הצג דוח',
    pleaseSelectWorker: 'אנא בחר עובד.',
    failedToLoadReport: 'טעינת הדוח נכשלה.',
    openTasksCount:     'משימות פתוחות',
    titleCol:           'כותרת',
    typeCol:            'סוג',
    priorityCol:        'עדיפות',
    statusCol:          'סטטוס',
    dueDateCol:         'תאריך יעד',
    zoneCol:            'אזור',
    noOpenTasks:        '✅ אין משימות פתוחות לעובד זה!',
    failedToLoadWorkers: 'טעינת רשימת עובדים נכשלה.',
    formTitle:           'כותרת *',
    formDescription:     'תיאור',
    formTaskType:        'סוג משימה *',
    formPriority:        'עדיפות',
    formDueDate:         'תאריך יעד',
    formZone:            'אזור חווה',
    formAssignTo:        'הקצה לעובד',
    formSelectType:      'בחר סוג...',
    formNoZone:          'ללא אזור',
    formUnassigned:      'לא מוקצה',
    formSaveChanges:     'שמור שינויים',
    formCreateTask:      'צור משימה',
    formSaving:          'שומר...',
    titlePlaceholder:    'לדוג׳ השקיית אזור א׳',
    descriptionPlaceholder: 'פרטים נוספים על המשימה...',
    errTitleRequired:    'יש להזין כותרת.',
    errTypeRequired:     'יש לבחור סוג משימה.',
    errDueDatePast:      'תאריך היעד לא יכול להיות בעבר.',
    editButton:          'עריכה',
    typeLabel:           'סוג',
    assignedTo:          'מוקצה ל',
    due:                 'יעד',
    zone:                'אזור',
    startButton:         'התחל',
    completeButton:      'סיים',
    allowedRange:        'מותר',
    clear:               'נקה',
    checklist:                   'רשימת משימות',
    addItem:                     '+ הוסף פריט',
    removeItem:                  'הסר',
    editItem:                    'ערוך פריט',
    itemPlaceholder:             'לדוג׳ בדוק לחות',
    noChecklistItems:            'אין פריטים ברשימה',
    errChecklistItemEmpty:       'פריט ברשימה לא יכול להיות ריק',
    progress:                    'התקדמות',
    progressOf:                  '{done} / {total} הושלמו',
    failedToUpdateChecklistItem: 'עדכון פריט נכשל.',
    completeBlockedByChecklist:  'יש לסיים את כל פריטי הרשימה תחילה',
  },

  inventory: {
    title:                    'מלאי מחסן',
    subtitle:                 'המחסן הוא מקור האמת. כמות החנות חייבת להיות בתוך כמות המחסן.',
    label:                    'פלפל פארם',
    plantsByVariety:          '🌱 צמחים לפי זן',
    addItem:                  '+ הוסף פריט',
    failedToLoad:             'טעינת המלאי נכשלה. האם השרת פועל?',
    noRecords:                'אין רשומות מלאי',
    noRecordsDesc:            'לחץ "+ הוסף פריט" כדי להוסיף את הפריט הראשון.',
    colItem:                  'פריט',
    colType:                  'סוג',
    colLocation:              'מיקום',
    colWarehouse:             'מחסן',
    colInStore:               'בחנות',
    colLastUpdated:           'עודכן לאחרונה',
    typeProduct:              'מוצר',
    typeWarehouseOnly:        'מחסן בלבד',
    outOfStock:               'אזל מהמלאי',
    update:                   '✏️ עדכון',
    warehouseQty:             'כמות מחסן *',
    warehouseQtyHint:         'יחידות בפועל במחסן החווה (מקור האמת).',
    storeQty:                 'כמות חנות (מוקצה) *',
    storeQtyHint:             'יחידות המוצגות בקטלוג לקוחות. חייב להיות ≤ כמות מחסן.',
    warehouseLocation:        'מיקום מחסן',
    warehouseLocationPlaceholder: 'לדוגמה: מעבר 3, מדף ב',
    errWarehouseRequired:     'כמות המחסן נדרשת.',
    errWarehouseWholeNumber:  'כמות המחסן חייבת להיות מספר שלם.',
    errWarehouseNegative:     'כמות המחסן לא יכולה להיות שלילית.',
    errStoreRequired:         'כמות החנות נדרשת.',
    errStoreWholeNumber:      'כמות החנות חייבת להיות מספר שלם.',
    errStoreNegative:         'כמות החנות לא יכולה להיות שלילית.',
    errStoreExceedsWarehouse: 'כמות החנות לא יכולה לעלות על כמות המחסן.',
    updatedSuccessfully:      'המלאי עודכן בהצלחה.',
    plantsTitle:              'צמחים לפי זן',
    plantsSubtitle:           'כמות צמחים ומלאי מחסן כולל לפי זן. לחץ על שורה לראות את הצמחים הבודדים.',
    backToInventory:          '← חזרה למלאי',
    failedToLoadPlants:       'טעינת הצמחים לפי זן נכשלה.',
    noVarieties:              'אין זנים',
    noVarietiesDesc:          'אין זני פלפל פעילים להצגה.',
    colVariety:               'זן',
    colPlantCount:            '# צמחים',
    colTotalWarehouse:        'סה"כ יחידות מחסן',
    noPlantsForVariety:       'אין צמחים רשומים לזן זה.',
    colPlantId:               'מזהה צמח',
    colPlantCode:             'קוד צמח',
    colZone:                  'אזור',
    addItemTitle:             'הוספת פריט למלאי',
    chooseTypeDesc:           'האם פריט זה יימכר בחנות, או שהוא מיועד למחסן בלבד (זרעים, דשן, כלים, חומרי גלם)?',
    chooseProduct:            '🛒 מוצר לחנות',
    chooseProductDesc:        'צור אותו כמוצר. שורת המלאי תיוצר אוטומטית, וניתן לקבוע כמויות לאחר מכן.',
    chooseWarehouse:          '📦 פריט מחסן בלבד',
    chooseWarehouseDesc:      'לא נמכר בחנות. עוקב אחר כמות מחסן ומיקום בלבד (ללא הקצאה).',
    itemName:                 'שם פריט *',
    itemNamePlaceholder:      'לדוג׳ דשן 5 קג, חבילת זרעים - חלפניו',
    errItemNameRequired:      'יש להזין שם פריט.',
    errWarehouseNonNegative:  'כמות המחסן חייבת להיות מספר שלם לא שלילי.',
    itemCreated:              'פריט מלאי נוצר בהצלחה.',
    failedToCreate:           'יצירת פריט מלאי נכשלה.',
    updateTitle:              'עדכון מלאי',
    errExceedsWarehouse:      'כמות החנות לא יכולה לעלות על כמות המחסן.',
    errWarehouseOnlyNoStore:  'זהו פריט מחסן בלבד ולא ניתן לקבוע לו כמות חנות.',
    errNotFound:              'רשומת המלאי לא נמצאה.',
    errServerTimeout:         'השרת לוקח זמן רב מדי. אנא נסה שוב בעוד רגע.',
    errNoPermission:          'אין לך הרשאה לבצע פעולה זו.',
    errGeneric:               'אירעה שגיאה. אנא נסה שוב.',
  },

  anomalies: {
    activeAnomalies:  'חריגות פעילות',
    attention:        'שים לב',
    allClear:         'הכל תקין',
    highSeverity:     'חומרה גבוהה',
    critical:         'קריטי',
    none:             'אין',
    affectedZones:    'אזורים מושפעים',
    impacted:         'מושפע',
    healthy:          'בריא',
    latestReading:    'קריאה אחרונה',
    noDataTime:       'אין נתונים',
    colTime:          'זמן',
    colZone:          'אזור',
    colPlant:         'צמח',
    colPepper:        'פלפל',
    colMetric:        'מדד',
    colActual:        'בפועל',
    colAllowedRange:  'טווח מותר',
    colSeverity:      'חומרה',
    colStatus:        'סטטוס',
    noAnomaliesFound: 'לא נמצאו חריגות',
    allReadingsNormal: 'כל קריאות החיישנים בטווח הנורמלי',
    resolved:         'נפתר',
    activeStatus:     'פעיל',
    createTask:       'יצירת משימה',
    resolve:          'פתרון',
    dashboardTitle:   'לוח חריגות חיישנים',
    live:             'חי',
    refresh:          'רענון',
    refreshing:       'מרענן',
    overview:         'סקירה',
    analytics:        'אנליטיקה',
    anomaliesOverTime: 'חריגות לאורך זמן',
    last7Days:        '7 ימים אחרונים',
    alertsByMetric:   'התראות לפי מדד',
    filteredView:     'תצוגה מסוננת',
    allTime:          'כל הזמנים',
    zoneHealth:       'בריאות האזור',
    alertHistory:     'היסטוריית התראות',
    recurringOnly:    'חוזרים בלבד',
    allSeverities:    'כל החומרות',
    high:             'גבוהה',
    medium:           'בינונית',
    allStatuses:      'כל הסטטוסים',
    activeFilter:     'פעיל',
    resolvedFilter:   'נפתר',
    prev:             'הקודם',
    next:             'הבא',
    activeCount:      'פעיל',
    failedToLoad:     'טעינת נתוני החריגות נכשלה. האם השרת פועל?',
    noTrendData:      'אין נתוני מגמה',
    total:            'סה"כ',
    highSeverityChart: 'חומרה גבוהה',
    zoneHighRisk:      'סיכון גבוה',
    zoneMediumRisk:    'סיכון בינוני',
    zoneNormal:        'תקין',
    noHighRiskZones:   'אין אזורי סיכון גבוה',
    noMediumRiskZones: 'אין אזורי סיכון בינוני',
    noNormalZones:     'אין אזורים תקינים',
    allZonesNormal:    'כל האזורים פועלים כרגיל',
    alertDetails:      'פרטי התראה',
    alertHashId:       'התראה #',
    readingHashId:     'קריאה #',
    alertResolved:     'התראה זו נפתרה',
    colMetricName:     'מדד',
    colActualValue:    'ערך בפועל',
    colAllowedRangeFull: 'טווח מותר',
    colZoneName:       'אזור',
    colPlantCode:      'צמח',
    colPepperVariety:  'זן פלפל',
    colResolvedAt:     'נפתר ב',
    close:             'סגור',
    markAsResolved:    'סמן כנפתר',
    resolving:         'פותר…',
    failedToResolve:   'פתרון ההתראה נכשל.',
    recurrenceThresholds: 'סף חזרתיות',
    minOccurrences:    'מספר מינימלי של התרחשויות לסימון כחוזר',
    timeWindow:        'חלון זמן לספירת התרחשויות',
    window1day:        'יום 1',
    window3days:       '3 ימים',
    window7days:       '7 ימים',
    window14days:      '14 ימים',
    window30days:      '30 ימים',
    failedToSave:      'שמירה נכשלה',
    changesImmediate:  'השינויים ייכנסו לתוקף מיד עם איתורי חריגות חדשים.',
  },

  sensors: {
    dashboardTitle:         'לוח חיישנים',
    managerLabel:           'מנהל',
    deviceLabel:            'מכשיר:',
    sensorLabel:            'חיישן',
    export:                 'ייצוא',
    syncFromAtomation:      'סנכרון מ-Atomation',
    syncing:                'מסנכרן…',
    atomationSyncFailed:    'סנכרון Atomation נכשל — מציג נתונים אחרונים מ-DB. פרטים:',
    statusLabel:            'סטטוס:',
    lastUpdate:             'עדכון אחרון:',
    minAgo:                 'דקות לפני',
    noReadings:             'לא נמצאו קריאות לחיישן זה.',
    latestReadingDetails:   'פרטי הקריאה האחרונה',
    readingId:              'מזהה קריאה',
    type:                   'סוג',
    sampleTime:             'זמן דגימה',
    gatewayRead:            'קריאת שער',
    atomationCreated:       'נוצר ב-Atomation',
    location:               'מיקום',
    dataExplorer:           'סייר נתונים',
    from:                   'מתאריך',
    to:                     'עד תאריך',
    loadData:               'טען נתונים',
    loading:                'טוען…',
    tableView:              'טבלה',
    graphView:              'גרף',
    selectDateRange:        'בחר טווח תאריכים ולחץ "טען נתונים" לצפייה בקריאות.',
    noReadingsInRange:      'לא נמצאו קריאות לטווח התאריכים הנבחר.',
    redDotsHint:            'נקודות אדומות מציינות קריאות מחוץ לטווח',
    readingsCount:          'קריאות',
    outOfRange:             'מחוץ לטווח',
    noSensorsFound:         'לא נמצאו חיישנים במערכת.',
    loadingSensorDashboard: 'טוען לוח חיישנים…',
    back:                   'חזרה',
    fromDateError:          'תאריך "מתאריך" חייב להיות לפני "עד תאריך".',
    exportTitle:            'ייצוא נתוני חיישנים',
    exportInclude:          'כלול',
    exportTableExcel:       'טבלה → Excel (.xlsx)',
    exportLoadFirst:        'טען נתונים תחילה בסייר הנתונים',
    exportGraphPdf:         'גרף → PDF',
    exportSwitchGraph:      'עבור לתצוגת גרף וטען נתונים תחילה',
    exportDeliverVia:       'מסירה באמצעות',
    exportDownload:         'הורד למכשיר',
    exportEmail:            'שלח באימייל',
    exportEmailAddress:     'כתובת אימייל נמען',
    exportEmailPlaceholder: 'you@example.com',
    exportCancel:           'ביטול',
    exportExporting:        'מייצא…',
    exportExport:           'ייצוא',
    inactive:               '(לא פעיל)',
    failedToSync:           'הסנכרון עם Atomation נכשל.',
    failedToLoadDashboard:  'טעינת לוח בקרת החיישנים נכשלה.',
    failedToLoadSensorsList:'טעינת רשימת החיישנים נכשלה.',
    failedToLoadReadings:   'טעינת הקריאות נכשלה.',
    statusLive:             'פעיל',
    statusRecent:           'עדכני',
    statusStale:            'ישן',
    statusNoData:           'אין נתונים',
    statusUnknown:          'לא ידוע',
    msgUpToDate:            'נתוני החיישן מעודכנים.',
    msgRecent:              'נתוני החיישן עדכניים, אך לא בזמן אמת.',
    msgStale:               'נתוני החיישן ישנים.',
    msgNoData:              'לא נמצאו קריאות לחיישן זה.',
    exportSentSuccess:      'הייצוא נשלח ל-{email} בהצלחה.',
    exportDownloadSuccess:  'הייצוא הורד בהצלחה.',
    exportFailed:           'הייצוא נכשל.',
    readingNumPrefix:       'קריאה #',
    colId:                  'מזהה',
  },

  reports: {
    inventoryLabel:    'דוחות',
    inventoryTitle:    'דוח מלאי',
    inventorySubtitle: 'רמות מלאי נוכחיות לכל הפריטים',
    totalItems:        'סה"כ פריטים',
    lowStock:          'מלאי נמוך',
    totalAvailable:    'סה"כ זמין',
    category:          'קטגוריה',
    allCategories:     'כל הקטגוריות',
    sortBy:            'מיין לפי',
    sortByName:        'שם פריט',
    sortByQuantity:    'זמין (נמוך ראשון)',
    sortByCategory:    'קטגוריה',
    lowStockOnly:      'הצג רק פריטים במלאי נמוך',
    loading:           'טוען דוח...',
    exportCsv:         '📥 ייצוא CSV',
    print:             '🖨️ הדפסה',
    colItem:           'פריט',
    colCategory:       'קטגוריה',
    colLocation:       'מיקום',
    colWarehouse:      'מחסן',
    colAllocated:      'מוקצה',
    colAvailable:      'זמין',
    colStatus:         'סטטוס',
    noItemsMatch:      'אין פריטי מלאי התואמים לסינון הנוכחי.',
    showingItems:      'מציג',
    lowStockBadge:     '⚠ מלאי נמוך',
    okBadge:           '✓ תקין',
  },

  peppers: {
    title:           'זני פלפל',
    subtitle:        'ניהול זני פלפל בחווה',
    label:           'לוח מנהל',
    backToDashboard: '← לוח בקרה',
    addPepper:       '+ הוסף פלפל',
    searchPlaceholder: 'חפש פלפל לפי שם, שם מדעי, אזור או תיאור...',
    allPepperTypes:  'כל סוגי הפלפל',
    allHeatLevels:   'כל רמות החום',
    mild:            'עדין',
    medium:          'בינוני',
    hot:             'חריף',
    veryHot:         'חריף מאוד',
    allGrowingZones: 'כל אזורי הגידול',
    loading:         'טוען פלפלים...',
    noPeppersYet:    'אין זני פלפל עדיין.',
    clickToCreate:   'לחץ + הוסף פלפל ליצירת הראשון.',
    editPepper:      'עריכה',
    deletePepper:    'מחיקה',
    confirmDelete:   'האם אתה בטוח שברצונך למחוק את הפלפל הזה?',
    deletedSuccessfully: 'הפלפל נמחק בהצלחה.',
    failedToDelete:  'מחיקת הפלפל נכשלה.',
    failedToLoad:    'טעינת הפלפלים נכשלה. האם השרת פועל?',
    zoneLabel:       'אזור',
  },

  products: {
    title:          'קטלוג מוצרים',
    subtitle:       'עיין ונהל את כל המוצרים',
    label:          'פלפל פארם',
    addNewProduct:  '+ הוסף מוצר חדש',
    failedToLoad:   'טעינת המוצרים נכשלה. האם השרת פועל?',
    noProducts:     'אין מוצרים זמינים',
    noProductsDesc: 'הוסף את המוצר הראשון באמצעות הכפתור למעלה.',
    checkBackLater: 'בדוק שוב מאוחר יותר.',
    outOfStock:     'אזל מהמלאי',
    unitsLeft:      'נותרו',
    editProduct:    '✏️ ערוך',
  },

  map: {
    title:             'מפת חווה — שיוך פלפלים לאזורים',
    subtitle:          'בחר זן פלפל ולחץ על אזור לשתילה',
    label:             'פלפל פארם',
    selectPepper:      'בחר פלפל:',
    choosePepper:      '-- בחר פלפל --',
    clickZoneHint:     '✅ עכשיו לחץ על אזור במפה לשתילה',
    pleaseSelectPepper: 'אנא בחר פלפל תחילה.',
    assignedSuccessfully: 'שויך ל',
    failedToAssign:    'השיוך נכשל.',
    planting:          'שותל...',
    plantHere:         'שתול כאן 🌱',
    selectPepperFirst: 'בחר פלפל תחילה',
    noOpenTasksInZone: 'אין משימות פתוחות באזור זה',
    filterPlantedPepper:  '🌱 פלפל שתול',
    filterOpenTask:       '📋 משימה פתוחה',
    filterSensorAnomaly:  '⚠️ אנומליית חיישן',
    alertMapTitle:        'מפת התראות חווה',
    alertMapSubtitle:     'אזורים הדורשים תשומת לב מסומנים',
    mapArea:                 'שטח',
    mapLoadingCropInfo:      'טוען מידע על גידול...',
    mapCurrentCrop:          '🌶 גידול נוכחי',
    mapNoCropAssigned:       'אין גידול משויך לאזור זה.',
    mapPlantsInZone:         '🌿 צמחים באזור זה',
    mapInteractive:          'מפת חווה · אינטראקטיבי',
    mapZoneAlerts:           'התראות אזור',
    mapNoAlerts:             'אין התראות — אזור זה תקין.',
    mapOpenTasksCount:       'משימות פתוחות',
    mapSensorAlertsCount:    'התראות חיישן',
    mapTasksInZone:          '📋 משימות באזור זה',
    mapSensorHealthInZone:   '⚠️ בריאות חיישן',
    legendBothAlerts:        'משימה + התראת חיישן',
    legendTaskAlert:         'משימה פתוחה',
    legendSensorAlert:       'אנומליית חיישן',
    legendNeutral:           'ללא התראות',
    legendHasPepper:         'יש פלפל שתול',
    legendNoPepper:          'לא שויך פלפל',
    legendHasTasks:          'יש משימות פתוחות',
    legendNoTasks:           'אין משימות פתוחות',
    legendSensorHigh:        'התראה חמורה',
    legendSensorMedium:      'התראה בינונית',
    legendSensorNormal:      'תקין',
    legendNoSensorData:      'אין נתוני חיישן',
    legendGreenhouse:        'חממה גדולה',
    legendNursery:           'משתלה',
    legendSmallGreenhouse:   'חממה קטנה',
    legendVisitorGreenhouse: 'חממת מבקרים',
    legendVisitorCenter:     'מרכז מבקרים',
    legendParking:           'חניה',
    legendProduction:        'מפעל ייצור',
  },

  worker: {
    label:              'עובד',
    dashboardTitle:     'הלוח שלי',
    dashboardSubtitle:  'המשימות שלך ומפת החווה — אזורים אדומים יש בהם משימות פתוחות',
    farmMap:            'מפת חווה',
    myTasks:            'המשימות שלי',
    loadingMap:         'טוען מפה...',
    loadingTasks:       'טוען משימות...',
    noTasksAssigned:    'אין משימות שהוקצו לך.',
    noTasksMatchFilter: 'אין משימות התואמות לסינון.',
    failedToLoad:       'טעינת הנתונים נכשלה. האם השרת פועל?',
    failedToUpdateStatus: 'עדכון סטטוס המשימה נכשל.',
    myTasksTitle:       'המשימות שלי',
    myTasksSubtitle:    'משימות שהוקצו לך',
    noTasksYet:         'אין משימות עדיין.',
    youHaveNoTasks:     'אין לך משימות מוקצות.',
  },

  visitor: {
    pepperVarietiesTitle:    'זני פלפל',
    pepperVarietiesSubtitle: 'עיין בכל זני הפלפל הגדלים בחווה שלנו',
    label:                   'פלפל פארם',
    products:                'מוצרים',
    map:                     '🗺️ מפה',
    login:                   'התחברות',
    register:                'הרשמה',
    logout:                  'התנתק',
    failedToLoad:            'טעינת זני הפלפל נכשלה. האם השרת פועל?',
    noPepperVariants:        'לא נמצאו זני פלפל',
    noPepperProductsDesc:    'בדוק שוב מאוחר יותר.',
    productCatalogTitle:     'קטלוג מוצרים',
    productCatalogSubtitle:  'עיין בכל המוצרים הזמינים מהחווה שלנו',
    failedToLoadProducts:    'טעינת המוצרים נכשלה. האם השרת פועל?',
    noProductsAvailable:     'אין מוצרים זמינים',
    checkBackLater:          'בדוק שוב מאוחר יותר.',
    farmMapTitle:            'מפת החווה',
    farmMapSubtitle:         'פריסה אינטראקטיבית של מתקן החווה — לחץ על כל קטע לפרטים נוספים',
  },

  landing: {
    navPeppers:          'פלפלים',
    navExplore:          'סיור',
    navFarmMap:          'מפת חווה',
    navProducts:         'מוצרים',
    navAllVarieties:     'כל הזנים',
    navOurFarm:          'החווה שלנו',
    signIn:              'כניסה',
    getStarted:          'התחל',
    register:            'הרשמה',
    heroLine1:           'מהשדות שלנו',
    heroLine2:           'לשולחן שלך.',
    heroDesc:            'אנו מגדלים למעלה מ-30 זני פלפל בטיפול, דיוק ותשוקה — מהשישיטו העדין ועד לקרוליינה ריפר המפחיד. גלה את החווה, עקוב אחר כל צמח, טעם את ההבדל.',
    shopPeppers:         'קנה פלפלים',
    tourFarm:            'סיור בחווה',
    scroll:              'גלול',
    statPepperVarieties: 'זני פלפל',
    statFarmArea:        'שטח חווה',
    statSunHours:        'שעות שמש',
    statPesticides:      'חומרי הדברה',
    statZero:            'אפס',
    ourVarieties:        'הזנים שלנו',
    everyPepperStory:    'כל פלפל מספר סיפור',
    peppersGridDesc:     'שלושים זנים, לכל אחד את אישיותו, רמת החריפות ומטרתו הקולינרית. אנו מגדלים את כולם באותה תשומת לב אובססיבית.',
    browseAllVarieties:  'עיין בכל הזנים',
    jalapenoDesc:        'עדין, מגוון ופריך — מושלם לסלסות טריות, חמוצים ובישול יומיומי.',
    habaneroDesc:        'פירותי ופרחוני עם חריפות קריבית עזה. זן הפרמיום החתימתי שלנו.',
    carolinaDesc:        'שיא חריפות עולמי עם עומק פירותי מורכב. רק לאמיצים באמת.',
    shishitoDesc:        'זן יפני עדין — מתוק ודק-קליפה, מושלם לצלייה קלה.',
    anaheimDesc:         'מגודל בקליפורניה, מעושן קלות ומגוון להפליא לצלייה.',
    ghostDesc:           "בהוט ג'ולוקיה — הרוח שרודפת את חיכך שעות לאחר כל נגיסה.",
    ourProcess:          'התהליך שלנו',
    grownWithIntention:  'מגודל בכוונה',
    feature1Title:       'שתילה ביד',
    feature1Body:        'כל שתיל מתחיל במשתלה שלנו ומושתל ביד לערוגות מוגבהות מועשרות קומפוסט. ללא קיצורי דרך, ללא ניחושי מכונות.',
    feature2Title:       'השקיה חכמה',
    feature2Body:        'מערכת הטפטוף שלנו מספקת מים מדויקים ברמת השורשים, מנוטרת על ידי חיישני קרקע. הצמחים מקבלים בדיוק את מה שהם צריכים — לא יותר ולא פחות.',
    feature3Title:       'נקצר בשיא',
    feature3Body:        'אנו עוקבים אחר כל צמח מזרע ועד יום הקציר. הפלפלים נקטפים ברגע המדויק של שיא הטעם ומיד נארזים לשמירה על הטריות.',
    interactive:         'אינטראקטיבי',
    exploreFarmMap:      'גלה את מפת החווה שלנו',
    mapDesc:             'נווט בכל אזור של PepperFarm. ראה אילו זנים גדלים היכן, בדוק את בריאות הצמחים ותכנן את ביקורך.',
    openFarmMap:         'פתח מפת חווה',
    joinPepperFarm:      'הצטרף ל-PepperFarm',
    readyToTasteHeat:    'מוכן לטעום את החריפות?',
    ctaDesc:             'צור חשבון חינמי כדי לעקוב אחר הזנים האהובים עליך, לקבל הודעות קציר ולהזמין ישירות מהחווה שלנו.',
    createFreeAccount:   'צור חשבון חינמי',
    browseProducts:      'עיין במוצרים',
    footerLogin:         'כניסה',
    footerRegister:      'הרשמה',
    footerFarmMap:       'מפת חווה',
    footerCopyright:     '© {year} PepperFarm. מגודל באהבה בישראל.',
    exploreVariety:      'גלה את הזן',
  },
};

// ── Registry & helpers ────────────────────────────────────────────────────────

const dictionaries: Record<Locale, Dictionary> = { en, he };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function translateEnum(
  key: string,
  group: Record<string, string>
): string {
  return group[key] ?? key;
}

export default dictionaries;
