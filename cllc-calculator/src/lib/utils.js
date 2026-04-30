// Standard formatter (e.g., 1,500,000)
const standardFormatter = new Intl.NumberFormat('en-US');

// Scientific formatter (e.g., 1.5E9)
// maximumFractionDigits ensures it doesn't show "1.50000E9"
const scientificFormatter = new Intl.NumberFormat('en-US', {
  notation: 'scientific',
  maximumFractionDigits: 5 
});

export function formatLargeNumber(value) {
  const bigValue = BigInt(value || 0);

  if (bigValue >= 10000000000n) {
    return scientificFormatter.format(bigValue).toLowerCase().replace('e', 'e+');
  }

  return standardFormatter.format(bigValue);
}

const decimalFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2
});

export function formatDecimal(value) {
  return decimalFormatter.format(value);
}
