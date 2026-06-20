if (process.env.npm_config_global !== 'true') {
  console.error('@aspirenx/mantracode can only be installed globally.');
  console.error('');
  console.error('  npm install -g @aspirenx/mantracode');
  console.error('');
  process.exit(1);
}
