const crypto = require("crypto");

function adaptApiRows(adapterCode, rows = [], now = new Date()) {
  const code = String(adapterCode || "").trim();
  if (!code) return rows;
  if (code === "aviationstack_flight_schedule") {
    return rows
      .filter(isChinaSouthernGuangzhouDeparture)
      .filter(hasRequiredAviationstackFields)
      .map((row) => adaptAviationstackFlight(row, now));
  }
  throw new Error(`Unsupported API row adapter: ${code}`);
}

function adaptAviationstackFlight(row, now) {
  const flightNo = firstText(row.flight_iata, `${row.airline_iata || ""}${row.flight_number || ""}`);
  const depAirport = "ZGGG";
  const arrAirport = firstText(row.arrival_icao).toUpperCase();
  const std = firstText(row.departure_scheduled);
  const sta = firstText(row.arrival_scheduled);
  const flightDate = firstText(row.flight_date, std.slice(0, 10));
  const sourceRecordId = `${flightNo}|${flightDate}|CAN|${firstText(row.arrival_iata).toUpperCase()}`;
  const businessKey = `${flightNo}|${flightDate}|${depAirport}|${arrAirport}`;
  const actualOrEstimated = firstText(row.departure_actual, row.departure_estimated);

  return {
    flight_segment_id: `AS_${crypto.createHash("sha1").update(sourceRecordId).digest("hex")}`,
    flight_no: flightNo,
    dep_airport: depAirport,
    arr_airport: arrAirport,
    segment_type: String(arrAirport).toUpperCase().startsWith("Z") ? "DOM" : "INT",
    std,
    sta,
    atd: firstText(row.departure_actual) || null,
    flight_status: firstText(row.flight_status, "unknown"),
    delay_code_raw: firstText(row.departure_delay_code, row.delay_code) || null,
    delay_minutes: calculateDelayMinutes(std, actualOrEstimated, row.departure_delay),
    tail_no: firstText(row.aircraft_registration) || null,
    carrier_code: firstText(row.airline_iata, row.airline_icao, "CZ"),
    updated_at: now.toISOString(),
    record_source: "AVIATIONSTACK",
    source_record_id: sourceRecordId,
    business_key: businessKey,
    source_updated_at: firstText(row.departure_actual, row.departure_estimated, row.arrival_actual, row.arrival_estimated) || null,
    ingested_at: now.toISOString(),
    raw_payload: JSON.stringify(row),
  };
}

function isChinaSouthernGuangzhouDeparture(row) {
  const airlineIata = firstText(row.airline_iata).toUpperCase();
  const airlineIcao = firstText(row.airline_icao).toUpperCase();
  const flightIata = firstText(row.flight_iata).toUpperCase();
  const departureIata = firstText(row.departure_iata).toUpperCase();
  const departureIcao = firstText(row.departure_icao).toUpperCase();
  const isChinaSouthern = airlineIata
    ? airlineIata === "CZ"
    : (airlineIcao ? airlineIcao === "CSN" : flightIata.startsWith("CZ"));
  const isGuangzhou = departureIata === "CAN" || departureIcao === "ZGGG";
  return isChinaSouthern && isGuangzhou;
}

function hasRequiredAviationstackFields(row) {
  const flightNo = firstText(row.flight_iata, `${row.airline_iata || ""}${row.flight_number || ""}`);
  const flightDate = firstText(row.flight_date);
  const arrivalIata = firstText(row.arrival_iata);
  const arrivalIcao = firstText(row.arrival_icao);
  return Boolean(
    /\d/.test(flightNo) &&
    flightDate &&
    firstText(row.departure_scheduled) &&
    firstText(row.arrival_scheduled) &&
    arrivalIata &&
    /^[A-Z]{4}$/.test(arrivalIcao.toUpperCase())
  );
}

function calculateDelayMinutes(scheduled, actualOrEstimated, providedDelay) {
  const explicit = Number(providedDelay);
  if (providedDelay !== null && providedDelay !== undefined && providedDelay !== "" && Number.isFinite(explicit)) {
    return Math.max(0, Math.round(explicit));
  }
  const scheduledAt = Date.parse(scheduled);
  const comparisonAt = Date.parse(actualOrEstimated);
  if (!Number.isFinite(scheduledAt) || !Number.isFinite(comparisonAt)) return 0;
  return Math.max(0, Math.round((comparisonAt - scheduledAt) / 60000));
}

function firstText(...values) {
  const value = values.find((item) => item !== null && item !== undefined && String(item).trim() !== "");
  return value === undefined ? "" : String(value).trim();
}

module.exports = {
  adaptApiRows,
};
