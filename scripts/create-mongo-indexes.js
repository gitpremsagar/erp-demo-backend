/**
 * Create MongoDB indexes that match the @@index definitions in schema.prisma.
 * Prisma does not create indexes on MongoDB for you — run this script once (or after schema index changes).
 *
 * Usage (from project root):
 *   mongosh "YOUR_DATABASE_URL" --file backend/scripts/create-mongo-indexes.js
 *
 * Example (local):
 *   mongosh "mongodb://localhost:27017/erp" --file backend/scripts/create-mongo-indexes.js
 *
 * If your DB name is not in the URL, switch to it first by uncommenting and setting:
 *   db = db.getSiblingDB('your_db_name');
 */

'use strict';

function createIndex(collection, keys, options = {}) {
  const name = Object.entries(keys)
    .map(([k, v]) => k + '_' + v)
    .join('_');
  try {
    db.getCollection(collection).createIndex(keys, { ...options, name });
    print('  + ' + collection + ': ' + name);
  } catch (e) {
    if (e.codeName === 'IndexOptionsConflict' || e.code === 85) {
      print('  = ' + collection + ': ' + name + ' (already exists)');
    } else {
      print('  ! ' + collection + ': ' + e.message);
    }
  }
}

print('Creating indexes...\n');

// User
print('User');
createIndex('User', { userType: 1 });

// CustomerDetail
print('CustomerDetail');
createIndex('CustomerDetail', { dbUserId: 1 });
createIndex('CustomerDetail', { area: 1 });
createIndex('CustomerDetail', { state: 1 });
createIndex('CustomerDetail', { dbCategory: 1 });

// Product
print('Product');
createIndex('Product', { categoryId: 1 });
createIndex('Product', { productGroupId: 1 });
createIndex('Product', { plantId: 1 });
createIndex('Product', { name: 1 });

// ProductScheme
print('ProductScheme');
createIndex('ProductScheme', { productId: 1 });
createIndex('ProductScheme', { startDate: 1, endDate: 1 });
createIndex('ProductScheme', { isActive: 1 });

// ProductTagRelation
print('ProductTagRelation');
createIndex('ProductTagRelation', { productId: 1 });
createIndex('ProductTagRelation', { productTagId: 1 });

// StockBatch
print('StockBatch');
createIndex('StockBatch', { productId: 1 });
createIndex('StockBatch', { expiryDate: 1 });
createIndex('StockBatch', { productId: 1, isArchived: 1 });

// StockRecord
print('StockRecord');
createIndex('StockRecord', { productId: 1 });
createIndex('StockRecord', { stockBatchId: 1 });
createIndex('StockRecord', { orderId: 1 });
createIndex('StockRecord', { createdAt: 1 });
createIndex('StockRecord', { productId: 1, createdAt: 1 });

// Order
print('Order');
createIndex('Order', { customerId: 1 });
createIndex('Order', { status: 1 });
createIndex('Order', { orderDate: 1 });
createIndex('Order', { driverId: 1 });
createIndex('Order', { customerId: 1, orderDate: 1 });

// OrderItem
print('OrderItem');
createIndex('OrderItem', { orderId: 1 });
createIndex('OrderItem', { productId: 1 });
createIndex('OrderItem', { customerId: 1 });
createIndex('OrderItem', { orderId: 1, productId: 1 });

// DeliveryAddress
print('DeliveryAddress');
createIndex('DeliveryAddress', { userId: 1 });

// OriginalOrder
print('OriginalOrder');
createIndex('OriginalOrder', { originalOrderId: 1 });
createIndex('OriginalOrder', { orderDate: 1 });

// OriginalOrderItem
print('OriginalOrderItem');
createIndex('OriginalOrderItem', { originalOrderId: 1 });
createIndex('OriginalOrderItem', { productId: 1 });

// Forecast
print('Forecast');
createIndex('Forecast', { distributorId: 1 });
createIndex('Forecast', { forecastDate: 1 });
createIndex('Forecast', { distributorId: 1, forecastDate: 1 });

// ForecastItem
print('ForecastItem');
createIndex('ForecastItem', { productId: 1 });
createIndex('ForecastItem', { distributorId: 1 });
createIndex('ForecastItem', { forecastId: 1 });
createIndex('ForecastItem', { forecastDate: 1 });

// PurchaseInvoice
print('PurchaseInvoice');
createIndex('PurchaseInvoice', { transporterId: 1 });
createIndex('PurchaseInvoice', { invoiceDate: 1 });
createIndex('PurchaseInvoice', { purchaseTransportStatus: 1 });

// PurchaseInvoiceItem
print('PurchaseInvoiceItem');
createIndex('PurchaseInvoiceItem', { purchaseInvoiceId: 1 });
createIndex('PurchaseInvoiceItem', { productId: 1 });

// PurchaseCarryingVehicle
print('PurchaseCarryingVehicle');
createIndex('PurchaseCarryingVehicle', { transporterId: 1 });

// SalesOfficerAssignment (compound unique is from Prisma @@unique; these support single-field lookups)
print('SalesOfficerAssignment');
createIndex('SalesOfficerAssignment', { salesOfficerId: 1 });
createIndex('SalesOfficerAssignment', { distributorId: 1 });

// ProductAllocation
print('ProductAllocation');
createIndex('ProductAllocation', { productId: 1 });
createIndex('ProductAllocation', { allocationDate: 1 });

// ProductAllocationBatch
print('ProductAllocationBatch');
createIndex('ProductAllocationBatch', { stockBatchId: 1 }, { unique: true });
createIndex('ProductAllocationBatch', { allocationId: 1 });

// ProductAllocationLine
print('ProductAllocationLine');
createIndex('ProductAllocationLine', { customerId: 1 });
createIndex('ProductAllocationLine', { allocationId: 1, customerId: 1 }, { unique: true });

// ProductAllocationFulfillment
print('ProductAllocationFulfillment');
createIndex('ProductAllocationFulfillment', { allocationLineId: 1 });

print('\nDone. Use db.CollectionName.getIndexes() in the shell to verify.');
