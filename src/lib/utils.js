// Standard formatter (e.g., 1,500,000)
const standardFormatter = new Intl.NumberFormat('en-US');

// Scientific formatter (e.g., 1.5E9)
// maximumFractionDigits ensures it doesn't show "1.50000E9"
const scientificFormatter = new Intl.NumberFormat('en-US', {
	notation: 'scientific',
	maximumFractionDigits: 5
});

export function formatLargeNumber(value) {
	let bigValue;

	try {
		bigValue = BigInt(value || 0);
	} catch (error) {
		bigValue = 0n; // That moonstone bug...
	}

	if (bigValue >= 10000000000n) {
		return scientificFormatter.format(bigValue).toLowerCase().replace('e', 'e+');
	}

	return standardFormatter.format(bigValue);
}

export function formatDPS(dps) {
	if (dps === 0) return '0 DPS';
	return `${formatLargeNumber(Math.floor(dps))} DPS`;
}

const decimalFormatter = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 2
});

export function formatDecimal(value) {
	return decimalFormatter.format(value);
}

export function getTimeToDestroyInfo(tile, dps, maxTime) {
	if (dps === 0) return { text: '∞', color: 'theme-text-muted' };
	const seconds = Number(tile.health) / dps;
	if (seconds > maxTime) return { text: `>${maxTime}s`, color: 'text-red-500' };
	else if (seconds > maxTime / 2)
		return { text: `${seconds.toFixed(2)}s`, color: 'text-orange-400' };
	else return { text: `${seconds.toFixed(2)}s`, color: 'theme-text-accent' };
}
