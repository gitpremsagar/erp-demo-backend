export type PurchaseTransportStatus =
  | "PENDING"
  | "LOADING"
  | "LOADED"
  | "IN_TRANSIT"
  | "ARRIVED"
  | "UNLOADING"
  | "UNLOADED"
  | "EXITED"
  | "COMPLETED";

/** Product on invoice line; list/history APIs return id/name/code only. getById adds pricing/GST for billing. */
export interface PurchaseInvoiceItemProduct {
  id: string;
  name: string;
  productCode: string;
  mrp?: number;
  gstPercentage?: number | null;
  costPricePerCarton?: number | null;
  Category?: { position: number; name: string };
}

export interface PurchaseInvoiceItem {
  id: string;
  purchaseInvoiceId: string;
  productId: string;
  mrp?: number | null;
  costPricePerPacket?: number | null;
  costPricePerCarton?: number | null;
  packetsPerCarton?: number | null;
  gstPercentage?: number | null;
  palletQuantity: number;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  product: PurchaseInvoiceItemProduct;
}

export interface PurchaseInvoice {
  id: string;
  invoiceID: string | null;
  invoiceDate: string | null;
  invoiceAmount: number | null;
  purchaseId: string;
  createdAt: string;
  updatedAt: string;
  PurchaseInvoiceItem: PurchaseInvoiceItem[];
}

export interface PurchaseStockBatch {
  id: string;
  productId: string;
  manufacturingDate: string;
  arrivalDate: string;
  expiryDate: string;
  stockQuantity: number;
  purchaseId: string;
  purchaseTransportStatus: PurchaseTransportStatus;
  product: PurchaseInvoiceItemProduct;
}

export interface PurchaseTransporter {
  id: string;
  name: string;
  transporterContact: string | null;
  area: string | null;
}

export interface Purchase {
  id: string;
  purchaseDate: string;
  markedArrivedAt?: string | null;
  TargetUnloadingDate?: string | null;
  markedUnloadingAt?: string | null;
  markedUnloadedAt?: string | null;
  VehicleExitedAt?: string | null;
  markedCompletedAt?: string | null;
  transporterId: string;
  vehicleNumber: string | null;
  driverContact: string | null;
  grnNumber?: string | null;
  purchaseTransportStatus: PurchaseTransportStatus;
  createdAt: string;
  updatedAt: string;
  Transporter: PurchaseTransporter;
  PurchaseInvoice: PurchaseInvoice[];
  stockBatches: PurchaseStockBatch[];
}

export interface CreatePurchaseInvoiceItemData {
  productId: string;
  quantity: number;
}

export interface CreatePurchaseInvoiceData {
  invoiceID: string;
  invoiceDate?: string | null;
  invoiceAmount?: number | null;
  items: CreatePurchaseInvoiceItemData[];
}

export interface CreatePurchaseData {
  transporterId: string;
  vehicleNumber?: string | null;
  driverContact?: string | null;
  purchaseTransportStatus?: PurchaseTransportStatus;
  markedArrivedAt?: Date | string | null;
  invoices: CreatePurchaseInvoiceData[];
}

export interface CreatePurchasesBulkData {
  purchases: CreatePurchaseData[];
}

export interface GetPurchaseHistoryParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  transporterId?: string;
}

export interface PurchaseHistoryPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface PurchaseHistoryResponse {
  purchases: Purchase[];
  pagination: PurchaseHistoryPagination;
}
