async function main() {
  const startLoop = Date.now();
  for (let i = 0; i < 50; i++) {
    // dummy delay simulating db wait
    await new Promise(r => setTimeout(r, 2));
  }
  const endLoop = Date.now();
  console.log(`Loop simulated performance: ${endLoop - startLoop}ms`);

  const startCreateMany = Date.now();
  // dummy delay simulating db wait for 1 query instead of 50
  await new Promise(r => setTimeout(r, 5));
  const endCreateMany = Date.now();
  console.log(`createMany simulated performance: ${endCreateMany - startCreateMany}ms`);
}

main().catch(console.error);
