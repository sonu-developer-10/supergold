# Stock Variant MRP Fix

Inventory identity is now `Article Code + Size Range + MRP`. Purchase Rate and Selling Rate are not part of stock identity.

Updated flows:
- Manual Stock Inward (`POST /api/stock/inward`)
- Edit Stock (`PUT /api/stock/:id`)
- Bill sale/return stock selection
- Purchase GRN stock receipt
- Article Master variant synchronization
- Stock edit article matching and article dropdown labels

## Safe local migration

1. Stop the backend.
2. Back up the local `wholesale_erp_test` database.
3. Set backend `.env` `MONGO_URI=mongodb://127.0.0.1:27017/wholesale_erp_test`.
4. From `backend`, run `npm run migrate:stock-variant-index`.
5. If it reports duplicate Article+Size+MRP rows, stop and inspect those records; the script deliberately makes no index changes when duplicates are found. Do not run against live Atlas.
6. Start backend and test both Stock Inward and Update Stock.

The migration drops only the old unique index on `articleCode + sizeRange + sellingPrice` and creates the new unique index on `articleCode + sizeRange + mrp`. It does not delete or merge stock records.
