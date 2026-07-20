import { paymentClient } from './payment-client.js';
import { inventoryClient } from './inventory-client.js';
import { logger } from './logger.js';
export function run(): void { paymentClient(); inventoryClient(); logger(); }
