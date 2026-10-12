export type SolarPoint = {
	start: string;
	end: string;
	irradiance: number; // Average W/m2 on the panel surface during this hour
};

export type SolarQuery = {
	latitude: number;
	longitude: number;
	tilt: number; // Degrees from horizontal
	azimuth: number; // Degrees, 0 = south, -90 = east, 90 = west (Open-Meteo convention)
};

// De Bilt, the default location
export const DEFAULT_LOCATION = { name: "De Bilt", latitude: 52.10, longitude: 5.18 };

export async function getSolarForecast({ latitude, longitude, tilt, azimuth }: SolarQuery): Promise<SolarPoint[]>
{
	const params = new URLSearchParams({
		latitude: latitude.toFixed(3),
		longitude: longitude.toFixed(3),
		hourly: "global_tilted_irradiance",
		tilt: String(tilt),
		azimuth: String(azimuth),
		timezone: "GMT",
		timeformat: "unixtime",
		past_days: "1",
		forecast_days: "3",
	});

	const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
	if (!response.ok) {
		throw new Error(`Open-Meteo returned ${response.status}`);
	}

	const data: { hourly: { time: number[]; global_tilted_irradiance: Array<number | null> } } = await response.json();

	// Radiation values are the mean over the preceding hour, so each value belongs to the hour before its timestamp
	return data.hourly.time.map((time, i) => ({
		start: new Date((time - 3600) * 1000).toISOString(),
		end: new Date(time * 1000).toISOString(),
		irradiance: data.hourly.global_tilted_irradiance[i] ?? 0,
	}));
}

// Expected production in kWh for one hour, using a typical performance ratio for losses
export function solarYield(irradiance: number, peakPowerKWp: number, performanceRatio = 0.8): number
{
	return (irradiance / 1000) * peakPowerKWp * performanceRatio;
}

export type GeocodeResult = {
	name: string;
	latitude: number;
	longitude: number;
};

// Looks up a Dutch postcode or place name via the PDOK Locatieserver (Dutch government, no key needed)
export async function geocode(query: string): Promise<GeocodeResult | null>
{
	const params = new URLSearchParams({
		q: query,
		rows: "1",
		fq: "type:(postcode OR woonplaats OR adres)",
		fl: "weergavenaam,centroide_ll",
	});

	const response = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?${params}`);
	if (!response.ok) {
		throw new Error(`PDOK returned ${response.status}`);
	}

	const data: { response: { docs: Array<{ weergavenaam: string; centroide_ll: string }> } } = await response.json();
	const doc = data.response.docs[0];
	const match = doc?.centroide_ll.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
	if (!doc || !match) return null;

	return { name: doc.weergavenaam, longitude: Number(match[1]), latitude: Number(match[2]) };
}
