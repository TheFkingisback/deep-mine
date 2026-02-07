// Simple test file for items
const { ITEMS, getItemValue, getItemsByLayer } = require('./dist/items.js');

console.log('Total items:', Object.keys(ITEMS).length);
console.log('Dirt value:', getItemValue('dirt'));
console.log('Void Stone items:', getItemsByLayer('VOID_STONE'));
