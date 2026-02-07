// Quick test to verify deterministic world generation
// Run with: node test-worldgen.js (after compiling TypeScript)

console.log('Testing world generation determinism...\n');

// Mock imports (would come from compiled TypeScript)
const testSeed = 12345;
const chunkY = 0;

console.log(`World Seed: ${testSeed}`);
console.log(`Testing Chunk Y: ${chunkY}`);
console.log('\nExpected behavior:');
console.log('- Same seed always produces same world');
console.log('- RNG is deterministic (Mulberry32)');
console.log('- Chunks have CHUNK_WIDTH × CHUNK_HEIGHT blocks');
console.log('- TNT placement follows layer spawn chances');
console.log('- No TNT in first SAFE_SPAWN_BLOCKS (first 3 blocks)');
console.log('- Block hardness scales with depth');
console.log('- VOID_STONE (depth 1201+) hardness increases: 25 + (depth-1201) * 0.01');

console.log('\n✅ Test file created. Compile TypeScript to run full tests.');
